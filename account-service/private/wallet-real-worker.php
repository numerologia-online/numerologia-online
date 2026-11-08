<?php
declare(strict_types=1);
/**
 * Private, authenticated real-wallet maintenance.
 * Never accepts account/payment IDs, amounts or receipt values from HTTP.
 * Must be called by the protected worker gateway or trusted local CLI.
 * No schema migration, config writes or changes to sandbox wallets.
 */
require_once __DIR__.'/wallet-real-payment.php';

/** YooKassa GET with live Basic Auth; GET is intrinsically idempotent. */
function naRealWorkerFetch(array $config,string $endpoint,?callable $mock=null): array {
    naRealWalletRequireLive($config);
    if(preg_match('~^(?:receipts|refunds)/[a-zA-Z0-9_-]{1,191}$~D',$endpoint)!==1)
        throw new InvalidArgumentException('REAL_WORKER_INVALID_PROVIDER_PATH');
    if($mock!==null){$response=$mock($endpoint);}
    else{
        $curl=curl_init('https://api.yookassa.ru/v3/'.$endpoint);
        if($curl===false)throw new RuntimeException('REAL_PROVIDER_UNAVAILABLE');
        try {
            curl_setopt_array($curl,[
                CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,
                CURLOPT_FOLLOWLOCATION=>false,
                CURLOPT_USERPWD=>$config['shop_id'].':'.$config['secret_key'],
                CURLOPT_HTTPHEADER=>['Accept: application/json'],
            ]);
            $raw=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);
        }finally{curl_close($curl);}
        if(!is_string($raw)||$status!==200)
            throw new RuntimeException('REAL_WORKER_PROVIDER_READ_FAILED');
        $response=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
    }
    if(!is_array($response))throw new RuntimeException('REAL_WORKER_PROVIDER_RESPONSE_INVALID');
    return $response;
}

function naRealWorkerReceiptDescription(string $productCode): string {
    $labels=[
        'redflag_question'=>'Ответ на вопрос о мужчине',
        'yesno_question'=>'Ответ на вопрос Да или Нет',
        'moment_question'=>'Персональный ответ на вопрос',
        'year_full'=>'Персональный разбор года',
        'life_full'=>'Полный нумерологический разбор',
        'compatibility_full'=>'Разбор совместимости',
        'child_full_v1'=>'Детский нумерологический разбор',
        'club_month'=>'Подписка на клуб',
        'school_week'=>'Подписка на школу нумерологии',
    ];
    if(!isset($labels[$productCode]))
        throw new RuntimeException('REAL_OFFSET_PRODUCT_REVIEW_REQUIRED');
    return $labels[$productCode];
}

/** Never submit until the spend -> original topup source is durably recorded. */
function naRealWorkerReceiptSource(PDO $db,string $eventId): array {
    $q=$db->prepare("SELECT f.id AS fiscal_id,f.kopeks AS fiscal_kopeks,
        s.id AS spend_id,s.account_id,s.product_code,s.kopeks AS spend_kopeks,
        rs.kopeks AS allocated_kopeks,t.id AS topup_id,t.account_id AS topup_account_id,
        t.provider_payment_id,t.receipt_email,t.status AS topup_status
        FROM numi_real_wallet_fiscal_events f
        INNER JOIN numi_real_wallet_spends s ON s.id=f.reference_id
        INNER JOIN numi_real_wallet_receipt_sources rs ON rs.spend_id=s.id
        INNER JOIN numi_real_wallet_topups t ON t.id=rs.topup_id
        WHERE f.id=? AND f.kind='advance_offset' LIMIT 1");
    $q->execute([$eventId]);
    $row=$q->fetch(PDO::FETCH_ASSOC);
    if(!$row || $row['topup_status']!=='credited'
        || $row['account_id']!==$row['topup_account_id']
        || !is_string($row['provider_payment_id']) || $row['provider_payment_id']===''
        || !is_string($row['receipt_email'])
        || (int)$row['fiscal_kopeks']!==(int)$row['spend_kopeks']
        || (int)$row['fiscal_kopeks']!==(int)$row['allocated_kopeks'])
        throw new RuntimeException('REAL_OFFSET_SOURCE_REVIEW_REQUIRED');
    $q=$db->prepare("SELECT status FROM numi_real_wallet_fiscal_events
        WHERE kind='advance_in' AND reference_id=? LIMIT 1");
    $q->execute([$row['topup_id']]);
    if($q->fetchColumn()!=='verified')
        throw new RuntimeException('REAL_OFFSET_ADVANCE_NOT_VERIFIED');
    return $row;
}

function naRealWorkerFreeze(PDO $db,string $accountId,string $reason): void {
    $q=$db->prepare("UPDATE numi_real_wallet_balances
        SET blocked_at=COALESCE(blocked_at,UTC_TIMESTAMP()),
            block_reason=CASE WHEN blocked_at IS NULL THEN ? ELSE block_reason END
        WHERE account_id=?");
    $q->execute([$reason,$accountId]);
}

/**
 * Receipt outbox: one POST attempt per event, then GET by provider receipt ID.
 * An uncertain POST is NEVER retried: manual lookup must resolve it first.
 * The gateway must serialize ticks; conditional claims also protect overlap.
 */
function naRealWorkerOffsetTick(
    PDO $db,array $config,int $limit=10,
    ?callable $mockSend=null,?callable $mockGet=null
): array {
    naRealWalletRequireLive($config);
    if(($config['offset_receipt_worker_verified']??false)!==true
        ||($config['offset_receipt_reviewed']??false)!==true)
        throw new RuntimeException('REAL_OFFSET_FISCAL_POLICY_NOT_APPROVED');
    $limit=max(1,min(20,$limit));
    $q=$db->query("SELECT id,provider_receipt_id,attempts
        FROM numi_real_wallet_fiscal_events
        WHERE kind='advance_offset' AND status='pending'
        ORDER BY created_at,id LIMIT ".$limit);
    $result=['verified'=>0,'pending'=>0,'manual_review'=>0];
    foreach($q->fetchAll(PDO::FETCH_ASSOC) as $event){
        try{
            $source=naRealWorkerReceiptSource($db,$event['id']);
            if($event['provider_receipt_id']!==null){
                $receipt=naRealWorkerFetch(
                    $config,'receipts/'.$event['provider_receipt_id'],$mockGet);
                if(($receipt['id']??null)!==$event['provider_receipt_id']
                    ||($receipt['payment_id']??null)!==$source['provider_payment_id']
                    ||($receipt['type']??null)!=='payment')
                    throw new RuntimeException('REAL_OFFSET_PROVIDER_MISMATCH');
                $status=$receipt['status']??null;
                if($status==='succeeded'){
                    $db->prepare("UPDATE numi_real_wallet_fiscal_events
                        SET status='verified' WHERE id=? AND status='pending'
                        AND provider_receipt_id=?")
                        ->execute([$event['id'],$event['provider_receipt_id']]);
                    $result['verified']++;
                }elseif($status==='pending'){$result['pending']++;}
                else{
                    $db->prepare("UPDATE numi_real_wallet_fiscal_events
                        SET status='failed' WHERE id=? AND status='pending'")
                        ->execute([$event['id']]);
                    naRealWorkerFreeze($db,$source['account_id'],'RECEIPT_PROVIDER_REVIEW');
                    $result['manual_review']++;
                }
                continue;
            }
            if((int)$event['attempts']!==0){
                naRealWorkerFreeze($db,$source['account_id'],'RECEIPT_UNCERTAIN');
                $result['manual_review']++;
                continue;
            }
            // Use the immutable email stored with the original advance, never
            // depend on a verified account email or a later profile change.
            $email=naRealWalletReceiptEmail($source['receipt_email']);
            $payload=naRealOffsetReceiptPayload(
                $source['provider_payment_id'],$email,
                naRealWorkerReceiptDescription($source['product_code']),
                (int)$source['fiscal_kopeks'],$config);
            // Claim durably BEFORE provider POST to survive connection timeouts.
            $claim=$db->prepare("UPDATE numi_real_wallet_fiscal_events
                SET attempts=attempts+1 WHERE id=? AND status='pending'
                  AND attempts=0 AND provider_receipt_id IS NULL");
            $claim->execute([$event['id']]);
            if($claim->rowCount()!==1)continue;
            $receipt=naRealOffsetReceiptSend($config,$event['id'],$payload,$mockSend);
            $final=$receipt['status']==='succeeded'?'verified':'pending';
            $saved=$db->prepare("UPDATE numi_real_wallet_fiscal_events
                SET provider_receipt_id=?,status=? WHERE id=?
                  AND attempts=1 AND provider_receipt_id IS NULL AND status='pending'");
            $saved->execute([$receipt['receipt_id'],$final,$event['id']]);
            if($saved->rowCount()!==1)
                throw new RuntimeException('REAL_RECEIPT_OUTBOX_RECONCILIATION_REQUIRED');
            $result[$final==='verified'?'verified':'pending']++;
        }catch(Throwable $e){
            // Do not expose customer email or live credentials in logs.
            $result['manual_review']++;
            try{
                if(isset($source['account_id']))
                    naRealWorkerFreeze($db,$source['account_id'],'RECEIPT_WORKER_REVIEW');
            }catch(Throwable $ignored){}
            error_log('NUMI_REAL_RECEIPT_REVIEW event='.$event['id'].' code='.$e->getMessage());
        }
    }
    return $result;
}

/** Poll paid topups with verified merchant credentials. Never trust webhooks. */
function naRealWorkerTopupTick(PDO $db,array $config,int $limit=10): array {
    naRealWalletRequireLive($config);
    $limit=max(1,min(20,$limit));
    $q=$db->query("SELECT id,account_id FROM numi_real_wallet_topups
        WHERE status='pending' AND provider_payment_id IS NOT NULL
        ORDER BY created_at,id LIMIT ".$limit);
    $result=['credited'=>0,'pending'=>0,'manual_review'=>0];
    foreach($q->fetchAll(PDO::FETCH_ASSOC) as $topup){
        try{
            $state=naRealWalletReconcileTopup($db,$config,$topup['id'],$topup['account_id']);
            if($state==='credited')$result['credited']++;
            elseif($state==='review')$result['manual_review']++;
            else $result['pending']++;
        }catch(Throwable $e){
            $result['manual_review']++;
            error_log('NUMI_REAL_TOPUP_REVIEW id='.$topup['id'].' code='.$e->getMessage());
        }
    }
    return $result;
}

/**
 * Approved refunds only: never create an approval. Provider submission requires
 * frozen wallet and unused balance; a durable first-attempt claim prevents
 * duplicate external sends. Completed refunds stay frozen for fiscal review.
 */
function naRealWorkerRefundTick(PDO $db,array $config,int $limit=10,
    ?callable $mockSend=null,?callable $mockGet=null): array {
    naRealWalletRequireLive($config);
    if(($config['refund_worker_verified']??false)!==true)
        throw new RuntimeException('REAL_REFUND_POLICY_NOT_APPROVED');
    $limit=max(1,min(20,$limit));
    $q=$db->query("SELECT id,provider_refund_id,provider_request_started_at
        FROM numi_real_wallet_refund_cases WHERE status='approved'
        ORDER BY created_at,id LIMIT ".$limit);
    $result=['completed'=>0,'pending'=>0,'manual_review'=>0];
    foreach($q->fetchAll(PDO::FETCH_ASSOC) as $row){
        try{
            if($row['provider_refund_id']===null){
                if($row['provider_request_started_at']!==null){
                    $result['manual_review']++;continue;
                }
                naRealRefundSendApprovedCase($db,$config,$row['id'],$mockSend);
            }
            $reader=$mockGet===null?null:static function(string $id)use($mockGet):array{
                return $mockGet('refunds/'.$id);
            };
            $status=naRealRefundReconcile($db,$config,$row['id'],$reader);
            if($status==='completed')$result['completed']++;
            elseif($status==='pending_receipt'||$status==='pending_review')
                $result['pending']++;
            else $result['manual_review']++;
        }catch(Throwable $e){
            $result['manual_review']++;
            error_log('NUMI_REAL_REFUND_REVIEW id='.$row['id'].' code='.$e->getMessage());
        }
    }
    return $result;
}

function naRealWalletWorkerTick(PDO $db,array $config): array {
    naRealWalletRequireLive($config);
    // Fail closed if schema has not been explicitly installed. No DDL here.
    $db->query('SELECT 1 FROM numi_real_wallet_receipt_sources LIMIT 1');
    return [
        'topups'=>naRealWorkerTopupTick($db,$config),
        'receipts'=>naRealWorkerOffsetTick($db,$config),
        'refunds'=>naRealWorkerRefundTick($db,$config),
    ];
}
