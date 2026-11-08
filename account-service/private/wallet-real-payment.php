<?php
declare(strict_types=1);
/**
 * SERVER-INTERNAL ONLY. Live card/SBP payment preparation for the existing REAL wallet.
 *
 * This module is intentionally NOT routed from core.php or deployed on REG.RU.
 * It must remain disabled until the fiscal receipt scheme, refund operations,
 * account merge, entitlement serving and end-to-end testing are approved.
 * NEVER accept $receipt from a browser. Build it on the server with the
 * actual audited cash-register policy for a freely spendable RUB advance.
 */
require_once __DIR__.'/wallet-real.php';

/**
 * Build a free-amount advance receipt on the server. YooKassa support confirmed
 * the advance + offset scheme; fiscal parameters are private configuration.
 * Never accept vat_code or fiscal identity from the browser.
 */
function naRealReviewedTopupReceipt(PDO $db,array $account,int $kopeks,mixed $receiptEmail,array $config=[]): array {
    if ($kopeks<100 || $kopeks>10000000)
        throw new InvalidArgumentException('INVALID_TOPUP_AMOUNT');
    // Tax treatment is merchant-specific: no assumed VAT rate or tax regime.
    $vat=$config['advance_receipt_vat_code']??null;
    if (($config['advance_receipt_reviewed']??false)!==true || !is_int($vat)
        || $vat<1 || $vat>12)
        throw new RuntimeException('REAL_FISCAL_ADVANCE_BUILDER_NOT_APPROVED');
    $email=naRealWalletReceiptEmail($receiptEmail);
    return [
        'customer'=>['email'=>$email],
        'items'=>[[
            'description'=>'Аванс за цифровые услуги Нумерология онлайн',
            'quantity'=>1.0,
            'amount'=>['value'=>naStoreAmount($kopeks),'currency'=>'RUB'],
            'vat_code'=>$vat,
            'payment_mode'=>'advance',
            'payment_subject'=>'payment',
        ]],
    ];
}

/**
 * Server-only receipt data for one fulfilled wallet purchase, including
 * manually/automatically renewed subscriptions. This does not submit a receipt.
 * Caller must allocate the spend against a verified original topup payment,
 * preserving the provider's per-payment receipt limit.
 */
function naRealOffsetReceiptPayload(
    string $paymentId,string $verifiedEmail,string $description,
    int $kopeks,array $fiscalConfig
): array {
    if(!preg_match('/^[a-zA-Z0-9_-]{1,191}$/D',$paymentId))
        throw new InvalidArgumentException('REAL_OFFSET_PAYMENT_ID_INVALID');
    if(!filter_var($verifiedEmail,FILTER_VALIDATE_EMAIL))
        throw new InvalidArgumentException('REAL_FISCAL_CONTACT_REQUIRED');
    if(trim($description)==='' || mb_strlen($description)>128 || $kopeks<1)
        throw new InvalidArgumentException('REAL_OFFSET_ITEM_INVALID');
    $vat=$fiscalConfig['offset_receipt_vat_code']??null;
    if(($fiscalConfig['offset_receipt_reviewed']??false)!==true
        || !is_int($vat) || $vat<1 || $vat>12)
        throw new RuntimeException('REAL_OFFSET_FISCAL_POLICY_NOT_APPROVED');
    $amount=['value'=>naStoreAmount($kopeks),'currency'=>'RUB'];
    return [
        'customer'=>['email'=>$verifiedEmail],
        'payment_id'=>$paymentId,
        'type'=>'payment',
        'send'=>true,
        'items'=>[[
            'description'=>$description,'quantity'=>1.0,
            'amount'=>$amount,'vat_code'=>$vat,
            'payment_mode'=>'full_payment',
            'payment_subject'=>'service',
        ]],
        'settlements'=>[['type'=>'prepayment','amount'=>$amount]],
    ];
}

/**
 * Submit an already allocated offset receipt using a stable fiscal event id.
 * The caller must durably associate spend -> original topup before calling.
 * Retrying with the same event id uses exactly the same YooKassa key.
 * This is a server-internal primitive; no public API route enables it.
 */
function naRealOffsetReceiptSend(
    array $config,string $eventId,array $payload,?callable $testTransport=null
): array {
    naRealWalletRequireLive($config);
    if(($config['offset_receipt_worker_verified']??false)!==true
        ||($config['offset_receipt_reviewed']??false)!==true)
        throw new RuntimeException('REAL_OFFSET_FISCAL_POLICY_NOT_APPROVED');
    if(preg_match('/^[a-f0-9-]{36}$/iD',$eventId)!==1)
        throw new InvalidArgumentException('REAL_OFFSET_EVENT_INVALID');
    if(($payload['type']??null)!=='payment'
        ||($payload['settlements'][0]['type']??null)!=='prepayment'
        ||($payload['items'][0]['payment_mode']??null)!=='full_payment'
        ||!is_string($payload['payment_id']??null))
        throw new RuntimeException('REAL_OFFSET_PAYLOAD_INVALID');
    $key=hash('sha256','numi-real-offset-v1:'.$eventId);
    if($testTransport!==null){
        $response=$testTransport($payload,$key);
    }else{
        $curl=curl_init('https://api.yookassa.ru/v3/receipts');
        if($curl===false)throw new RuntimeException('REAL_PROVIDER_UNAVAILABLE');
        try{
            curl_setopt_array($curl,[
                CURLOPT_POST=>true,
                CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),
                CURLOPT_RETURNTRANSFER=>true,
                CURLOPT_CONNECTTIMEOUT=>5,
                CURLOPT_TIMEOUT=>20,
                CURLOPT_FOLLOWLOCATION=>false,
                CURLOPT_USERPWD=>$config['shop_id'].':'.$config['secret_key'],
                CURLOPT_HTTPHEADER=>[
                    'Content-Type: application/json',
                    'Idempotence-Key: '.$key,
                ],
            ]);
            $raw=curl_exec($curl);
            $status=curl_getinfo($curl,CURLINFO_HTTP_CODE);
        }finally{
            curl_close($curl);
        }
        if(!is_string($raw)||!in_array($status,[200,201],true))
            throw new RuntimeException('REAL_OFFSET_RECEIPT_UNCERTAIN');
        $response=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
    }
    if(!is_array($response)
        ||!is_string($response['id']??null)
        ||!in_array($response['status']??null,['pending','succeeded'],true)
        ||($response['type']??null)!=='payment'
        ||($response['payment_id']??null)!==$payload['payment_id'])
        throw new RuntimeException('REAL_OFFSET_RECEIPT_RESPONSE_INVALID');
    return ['receipt_id'=>$response['id'],'status'=>$response['status']];
}

/**
 * FULL refunds of unused advances: YooKassa issues the refund receipt using
 * the original payment details. No additional receipt payload is submitted.
 * Partial refunds still require a separate reviewed itemized implementation.
 */
function naRealRefundReceiptSettings(array $config): void {
    if(($config['refund_receipt_mode']??null)!=='yookassa_full_auto'
       ||($config['refund_receipt_status_check']??null)!==true)
        throw new RuntimeException('REAL_REFUND_RECEIPT_SETTINGS_MISSING');
}

/**
 * Provider refund primitive. This does not alter balances, grants or fiscal
 * records; a separate audited reconciliation must do so after confirmed success.
 * Accept only an approved server-side refund case with verified original payment.
 */
function naRealRefundSend(
    array $config,string $caseId,string $paymentId,int $kopeks,
    ?callable $testTransport=null
): array {
    naRealWalletRequireLive($config);
    if(($config['refunds_verified']??false)!==true
        ||($config['refund_worker_verified']??false)!==true)
        throw new RuntimeException('REAL_REFUND_POLICY_NOT_APPROVED');
    naRealRefundReceiptSettings($config);
    if(preg_match('/^[a-f0-9-]{36}$/iD',$caseId)!==1)
        throw new InvalidArgumentException('REAL_REFUND_CASE_INVALID');
    if(preg_match('/^[a-zA-Z0-9-]{1,191}$/D',$paymentId)!==1
        ||$kopeks<1||$kopeks>10000000)
        throw new InvalidArgumentException('REAL_REFUND_PAYMENT_INVALID');
    $payload=['payment_id'=>$paymentId,
        'amount'=>['value'=>naStoreAmount($kopeks),'currency'=>'RUB'],
        'description'=>'Возврат покупателю Нумерология онлайн'];
    $key=hash('sha256','numi-real-refund-v1:'.$caseId);
    if($testTransport!==null){
        $response=$testTransport($payload,$key);
    }else{
        $curl=curl_init('https://api.yookassa.ru/v3/refunds');
        if($curl===false)throw new RuntimeException('REAL_PROVIDER_UNAVAILABLE');
        try{
            curl_setopt_array($curl,[
                CURLOPT_POST=>true,
                CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),
                CURLOPT_RETURNTRANSFER=>true,
                CURLOPT_CONNECTTIMEOUT=>5,
                CURLOPT_TIMEOUT=>20,
                CURLOPT_FOLLOWLOCATION=>false,
                CURLOPT_USERPWD=>$config['shop_id'].':'.$config['secret_key'],
                CURLOPT_HTTPHEADER=>['Content-Type: application/json',
                    'Idempotence-Key: '.$key],
            ]);
            $raw=curl_exec($curl);
            $status=curl_getinfo($curl,CURLINFO_HTTP_CODE);
        }finally{curl_close($curl);}
        if(!is_string($raw)||!in_array($status,[200,201],true))
            throw new RuntimeException('REAL_REFUND_PROVIDER_UNCERTAIN');
        $response=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
    }
    if(!is_array($response)
        ||!is_string($response['id']??null)
        ||!in_array($response['status']??null,['pending','succeeded','canceled'],true)
        ||($response['payment_id']??null)!==$paymentId
        ||($response['amount']['value']??null)!==naStoreAmount($kopeks)
        ||($response['amount']['currency']??null)!=='RUB')
        throw new RuntimeException('REAL_REFUND_RESPONSE_INVALID');
    return ['refund_id'=>$response['id'],'status'=>$response['status']];
}

/**
 * Resolve one operator-approved refund to its ORIGINAL YooKassa top-up.
 * Never trust a payment_id, amount or account_id from a browser/HTTP request.
 * A separate reconciliation process handles wallet deductions and fiscal
 * reversal; this helper cannot make a live transfer by itself.
 */
function naRealRefundApprovedCase(PDO $db,string $caseId): array {
    if(preg_match('/^[a-f0-9-]{36}$/iD',$caseId)!==1)
        throw new InvalidArgumentException('REAL_REFUND_CASE_INVALID');
    $q=$db->prepare("SELECT c.id,c.account_id,c.topup_id,c.spend_id,c.kopeks,
            c.status,c.provider_refund_id,
            t.account_id AS topup_account_id,t.provider_payment_id,
            t.kopeks AS topup_kopeks,t.status AS topup_status
        FROM numi_real_wallet_refund_cases c
        INNER JOIN numi_real_wallet_topups t ON t.id=c.topup_id
        WHERE c.id=? LIMIT 1");
    $q->execute([$caseId]);$row=$q->fetch(PDO::FETCH_ASSOC);
    if(!$row||$row['status']!=='approved'
       ||!is_string($row['provider_payment_id'])
       ||$row['provider_payment_id']===''
       ||$row['topup_status']!=='credited'
       ||$row['account_id']!==$row['topup_account_id']
       ||$row['spend_id']!==null)
        throw new RuntimeException('REAL_REFUND_CASE_NOT_APPROVED');
    $kopeks=(int)$row['kopeks'];
    if($kopeks<1||$kopeks>(int)$row['topup_kopeks'])
        throw new RuntimeException('REAL_REFUND_AMOUNT_EXCEEDS_SOURCE');
    // Full refunds of untouched advances are currently supported. Partial
    // refunds require the merchant's reviewed itemized fiscal scheme.
    if($kopeks!==(int)$row['topup_kopeks'])
        throw new RuntimeException('REAL_PARTIAL_REFUND_FISCAL_REVIEW_REQUIRED');
    $q=$db->prepare('SELECT COALESCE(SUM(kopeks),0) FROM numi_real_wallet_receipt_sources WHERE topup_id=?');
    $q->execute([$row['topup_id']]);
    if((int)$q->fetchColumn()!==0)
        throw new RuntimeException('REAL_REFUND_SOURCE_ALREADY_SPENT');
    // One active or settled refund per source payment until partial-refund
    // allocation and the original-advance fiscal reconciliation are installed.
    $q=$db->prepare("SELECT COUNT(*) FROM numi_real_wallet_refund_cases
        WHERE topup_id=? AND id<>? AND status IN ('review','approved','completed')");
    $q->execute([$row['topup_id'],$caseId]);
    if((int)$q->fetchColumn()!==0)
        throw new RuntimeException('REAL_REFUND_SOURCE_ALREADY_RESERVED');
    if($row['provider_refund_id']!==null)
        throw new RuntimeException('REAL_REFUND_ALREADY_SUBMITTED');
    return ['case_id'=>$row['id'],'account_id'=>$row['account_id'],
        'topup_id'=>$row['topup_id'],'payment_id'=>$row['provider_payment_id'],
        'kopeks'=>$kopeks];
}

/**
 * Send a refund ONLY for a database-approved original payment.
 * Refuses a second send when a provider refund id has already been stored.
 * Human approval and reconciliation still required; intentionally no HTTP route.
 */
function naRealRefundSendApprovedCase(
    PDO $db,array $config,string $caseId,?callable $testTransport=null
): array {
    naRealWalletRequireLive($config);
    // Refuse if the account isn't frozen for refund reconciliation.
    $ref=naRealRefundApprovedCase($db,$caseId);
    $q=$db->prepare('SELECT blocked_at,kopeks FROM numi_real_wallet_balances WHERE account_id=?');
    $q->execute([$ref['account_id']]);
    $balance=$q->fetch(PDO::FETCH_ASSOC);
    if(!$balance||$balance['blocked_at']===null)
        throw new RuntimeException('REAL_REFUND_WALLET_MUST_BE_FROZEN');
    if((int)$balance['kopeks']<$ref['kopeks'])
        throw new RuntimeException('REAL_REFUND_EXCEEDS_UNSPENT_BALANCE');
    naRealWalletInvariant($db,$ref['account_id']);
    // Durable one-time claim precedes the external POST. An uncertain response
    // must be investigated, never automatically reissued after YooKassa's
    // 24-hour idempotency window.
    $claim=$db->prepare("UPDATE numi_real_wallet_refund_cases
        SET provider_request_started_at=UTC_TIMESTAMP()
        WHERE id=? AND status='approved' AND provider_refund_id IS NULL
          AND provider_request_started_at IS NULL");
    $claim->execute([$caseId]);
    if($claim->rowCount()!==1){
        $q=$db->prepare('SELECT provider_refund_id FROM numi_real_wallet_refund_cases WHERE id=?');
        $q->execute([$caseId]);
        if($q->fetchColumn())throw new RuntimeException('REAL_REFUND_ALREADY_SUBMITTED');
        throw new RuntimeException('REAL_REFUND_UNCERTAIN_RECONCILIATION_REQUIRED');
    }
    $result=naRealRefundSend($config,$ref['case_id'],$ref['payment_id'],
        $ref['kopeks'],$testTransport);
    $q=$db->prepare("UPDATE numi_real_wallet_refund_cases SET provider_refund_id=?
        WHERE id=? AND status='approved' AND provider_refund_id IS NULL");
    $q->execute([$result['refund_id'],$caseId]);
    if($q->rowCount()!==1)
        throw new RuntimeException('REAL_REFUND_RECONCILIATION_REQUIRED');
    return $result;
}

/**
 * Reconcile an already sent refund by fetching its status from YooKassa.
 * The authoritative provider response is never accepted from the browser.
 * Keep wallet frozen after settlement until fiscal review releases it.
 */
function naRealRefundReconcile(
    PDO $db,array $config,string $caseId,?callable $testGet=null
): string {
    naRealWalletRequireLive($config);
    if(($config['refund_worker_verified']??false)!==true)
        throw new RuntimeException('REAL_REFUND_POLICY_NOT_APPROVED');
    naRealRefundReceiptSettings($config);
    if(preg_match('/^[a-f0-9-]{36}$/iD',$caseId)!==1)
        throw new InvalidArgumentException('REAL_REFUND_CASE_INVALID');
    $q=$db->prepare("SELECT c.*,t.provider_payment_id,t.account_id AS topup_account_id
        FROM numi_real_wallet_refund_cases c
        INNER JOIN numi_real_wallet_topups t ON t.id=c.topup_id
        WHERE c.id=? LIMIT 1");
    $q->execute([$caseId]);$row=$q->fetch(PDO::FETCH_ASSOC);
    if(!$row||!is_string($row['provider_refund_id'])
       ||$row['provider_refund_id']===''
       ||$row['account_id']!==$row['topup_account_id'])
        throw new RuntimeException('REAL_REFUND_RECONCILIATION_REQUIRED');
    if($row['status']==='completed')return 'completed';
    if($row['status']!=='approved')throw new RuntimeException('REAL_REFUND_CASE_NOT_APPROVED');
    if($testGet!==null){
        $payment=$testGet($row['provider_refund_id']);
    }else{
        if(!preg_match('/^[a-zA-Z0-9-]{1,191}$/D',$row['provider_refund_id']))
            throw new RuntimeException('REAL_REFUND_ID_INVALID');
        $curl=curl_init('https://api.yookassa.ru/v3/refunds/'.$row['provider_refund_id']);
        if($curl===false)throw new RuntimeException('REAL_PROVIDER_UNAVAILABLE');
        try{
            curl_setopt_array($curl,[
                CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,
                CURLOPT_TIMEOUT=>20,CURLOPT_FOLLOWLOCATION=>false,
                CURLOPT_USERPWD=>$config['shop_id'].':'.$config['secret_key'],
                CURLOPT_HTTPHEADER=>['Content-Type: application/json'],
            ]);
            $raw=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);
        }finally{curl_close($curl);}
        if(!is_string($raw)||$status!==200)
            throw new RuntimeException('REAL_REFUND_PROVIDER_UNAVAILABLE');
        $payment=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
    }
    if(!is_array($payment)
       ||($payment['id']??null)!==$row['provider_refund_id']
       ||($payment['payment_id']??null)!==$row['provider_payment_id']
       ||($payment['amount']['value']??null)!==naStoreAmount((int)$row['kopeks'])
       ||($payment['amount']['currency']??null)!=='RUB')
        throw new RuntimeException('REAL_REFUND_PROVIDER_MISMATCH');
    if(($payment['status']??null)!=='succeeded')return 'pending_review';
    // Refund fiscalization differs by merchant integration. Never silently
    // assume a refund receipt exists if YooKassa did not confirm registration.
    if(($payment['receipt_registration']??null)!=='succeeded')
        return 'pending_receipt';
    $db->beginTransaction();
    try{
        $q=$db->prepare('SELECT * FROM numi_real_wallet_refund_cases WHERE id=? FOR UPDATE');
        $q->execute([$caseId]);$fresh=$q->fetch(PDO::FETCH_ASSOC);
        if(!$fresh||$fresh['provider_refund_id']!==$row['provider_refund_id'])
            throw new RuntimeException('REAL_REFUND_RECONCILIATION_REQUIRED');
        if($fresh['status']==='completed'){$db->commit();return 'completed';}
        if($fresh['status']!=='approved')
            throw new RuntimeException('REAL_REFUND_CASE_NOT_APPROVED');
        $balance=naRealWalletBalance($db,$fresh['account_id'],true);
        $q=$db->prepare('SELECT blocked_at FROM numi_real_wallet_balances WHERE account_id=? FOR UPDATE');
        $q->execute([$fresh['account_id']]);
        if($q->fetchColumn()===null)
            throw new RuntimeException('REAL_REFUND_WALLET_MUST_BE_FROZEN');
        $kopeks=(int)$fresh['kopeks'];
        if($kopeks>$balance)throw new RuntimeException('REAL_REFUND_BALANCE_RECONCILIATION');
        naRealWalletInvariant($db,$fresh['account_id']);
        $new=$balance-$kopeks;
        $db->prepare('UPDATE numi_real_wallet_balances SET kopeks=? WHERE account_id=?')
            ->execute([$new,$fresh['account_id']]);
        $db->prepare("INSERT INTO numi_real_wallet_ledger
            (id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks)
            VALUES(?,?,'refund',?,?,?)")
            ->execute([naUuid(),$fresh['account_id'],$fresh['id'],-$kopeks,$new]);
        $db->prepare("INSERT INTO numi_real_wallet_fiscal_events
            (id,kind,reference_id,kopeks,status,provider_receipt_id)
            VALUES(?,'refund',?,?,'verified',NULL)")
            ->execute([naUuid(),$fresh['id'],$kopeks]);
        $db->prepare("UPDATE numi_real_wallet_refund_cases SET status='completed' WHERE id=?")
            ->execute([$fresh['id']]);
        $db->commit();
        return 'completed';
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}

/** This route is called only after the private live-mode switch AND all gates. */
function naRealWalletServe(PDO $db,string $action,array $body,array $account,array $config): never {
    if(!naRealWalletGate($config))
        naReply(503,['ok'=>false,'error'=>'REAL_PAYMENTS_DISABLED']);
    try {
        if($action==='wallet_status'){
            $result=naRealWalletStatus($db,$account);
            $q=$db->prepare("SELECT MAX(e.expires_at) FROM numi_entitlements e
                JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id
                WHERE e.account_id=? AND e.product_code='club_month'
                  AND e.status='active' AND (e.expires_at IS NULL OR e.expires_at>UTC_TIMESTAMP())
                  AND o.status='paid' AND o.verified_at IS NOT NULL AND o.provider='real_wallet'");
            $q->execute([$account['id']]);
            $result['club_expires_at']=$q->fetchColumn()?:null;
            $periods=$db->prepare("SELECT e.product_code,MAX(e.expires_at) AS expires_at
                FROM numi_entitlements e
                JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id
                WHERE e.account_id=? AND e.product_code IN ('club_month','school_week')
                  AND e.status='active' AND o.status='paid'
                  AND o.verified_at IS NOT NULL AND o.provider='real_wallet'
                GROUP BY e.product_code");
            $periods->execute([$account['id']]);
            $byPeriod=[];
            foreach($periods->fetchAll(PDO::FETCH_ASSOC) as $row)
                $byPeriod[$row['product_code']]=$row['expires_at'];
            $prefs=$db->prepare("SELECT product_code,auto_renew,cancelled_at
                FROM numi_subscription_settings
                WHERE account_id=? AND product_code IN ('club_month','school_week')");
            $prefs->execute([$account['id']]);
            $byPref=[];
            foreach($prefs->fetchAll(PDO::FETCH_ASSOC) as $row)
                $byPref[$row['product_code']]=$row;
            $now=new DateTimeImmutable('now',new DateTimeZone('UTC'));
            $subs=[];
            foreach(['club_month'=>49000,'school_week'=>14900] as $code=>$price){
                $until=$byPeriod[$code]??null;
                $active=is_string($until) && new DateTimeImmutable(
                    $until,new DateTimeZone('UTC'))>$now;
                // No live recurring charge is enabled until merchant approval
                // and a verified, explicitly consented payment method exist.
                $subs[]=['product_code'=>$code,'active'=>$active,
                    'expires_at'=>$until,'price_kopeks'=>$price,
                    'auto_renew'=>false,'renewal'=>'manual',
                    'recurring_available'=>false,
                    'cancelled_at'=>$byPref[$code]['cancelled_at']??null];
            }
            $result['subscriptions']=$subs;
            $result['payment_methods']=['bank_card','sbp'];
            naReply(200,$result);
        }
        // Live subscription management belongs to the authenticated wallet
        // account. An opt-out never revokes the already paid membership.
        if($action==='subscription_cancel'){
            $code=$body['product_code']??null;
            if(!is_string($code)||!in_array($code,['club_month','school_week'],true))
                throw new InvalidArgumentException('INVALID_SUBSCRIPTION');
            $db->prepare('INSERT IGNORE INTO numi_subscription_settings(account_id,product_code)
                VALUES(?,?)')->execute([$account['id'],$code]);
            $db->prepare("UPDATE numi_subscription_settings SET auto_renew=0,
                payment_method_id=NULL,cancelled_at=UTC_TIMESTAMP()
                WHERE account_id=? AND product_code=?")
                ->execute([$account['id'],$code]);
            naReply(200,['ok'=>true,'test'=>false,'auto_renew'=>false,
                'product_code'=>$code,'access_unchanged'=>true]);
        }
        if($action==='wallet_quote'){
            $input=$body['item']??null;
            if(!is_array($input))throw new InvalidArgumentException('INVALID_ITEM');
            require_once __DIR__.'/fulfillment.php';
            $ready=static function(array $item):bool{
                if(($item['kind']??null)==='subscription')return true;
                try{naMaterialBuild($item['product_code'],$item['resource_id']);return true;}
                catch(Throwable $e){return false;}
            };
            $data=naRealWalletQuote($db,$account,$input,$ready);
            $entitlement=null;
            if($data['owned'] && $data['kind']!=='subscription'){
                $q=$db->prepare("SELECT e.id FROM numi_entitlements e
                    JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id
                    WHERE e.account_id=? AND e.product_code=? AND e.resource_id=?
                      AND e.status='active' AND (e.expires_at IS NULL OR e.expires_at>UTC_TIMESTAMP())
                      AND o.status='paid' AND o.verified_at IS NOT NULL AND o.provider='real_wallet'
                    ORDER BY o.created_at DESC LIMIT 1");
                $q->execute([$account['id'],$data['product_code'],$data['resource_id']]);
                $entitlement=$q->fetchColumn()?:null;
            }
            $raw=naCatalogResolve($input,$data['club_active']);
            naReply(200,array_merge($data,[
                'balance_kopeks'=>$data['real_balance_kopeks'],
                'member_included'=>$raw['member_included'],
                'club_subscription_price_kopeks'=>naCatalogResolve(['product_code'=>'club_month'],false)['price_kopeks'],
                'entitlement_id'=>$entitlement,
                'currency'=>'RUB','test'=>false,'renewal'=>'manual',
            ]));
        }
        if($action==='wallet_topup'){
            $rub=$body['amount_rub']??null;
            if(!is_int($rub)||$rub<1||$rub>100000)
                throw new InvalidArgumentException('INVALID_TOPUP_AMOUNT');
            $method=naRealPaymentMethod($body['payment_method']??null);
            $key=naWalletKey($body['request_key']??null);
            // Strictly fail before any payment initiation until legal fiscalization
            // of a wallet topup is actually supported by the configured provider.
            $email=naRealWalletReceiptEmail($body['receipt_email']??null);
            $receipt=naRealReviewedTopupReceipt($db,$account,$rub*100,$email,$config);
            $payment=naRealWalletCreatePayment($db,$account,$config,$rub,$key,$method,$email,$receipt);
            naReply(200,array_merge(['ok'=>true,'test'=>false],$payment));
        }
        if($action==='wallet_sync'){
            $id=$body['topup_id']??null;
            if(!is_string($id)||preg_match('/^[a-f0-9-]{36}$/iD',$id)!==1)
                throw new InvalidArgumentException('INVALID_TOPUP_ID');
            $state=naRealWalletReconcileTopup($db,$config,$id,$account['id']);
            naReply(200,['ok'=>true,'test'=>false,'status'=>$state,'topup_id'=>$id,
                'balance_kopeks'=>naRealWalletBalance($db,$account['id'])]);
        }
        if($action==='wallet_buy'){
            $input=$body['item']??null;
            if(!is_array($input))throw new InvalidArgumentException('INVALID_ITEM');
            $key=naWalletKey($body['request_key']??null);
            require_once __DIR__.'/fulfillment.php';
            $ready=static function(array $item):bool{
                if(($item['kind']??null)==='subscription')return true;
                try{naMaterialBuild($item['product_code'],$item['resource_id']);return true;}
                catch(Throwable $e){return false;}
            };
            $result=naRealWalletBuy($db,$account,$config,$input,$key,$ready);
            naReply(200,array_merge(['ok'=>true,'test'=>false],$result));
        }
        naReply(400,['ok'=>false,'error'=>'UNKNOWN_ACTION']);
    } catch(InvalidArgumentException $e){
        naReply(400,['ok'=>false,'error'=>$e->getMessage()]);
    } catch(RuntimeException $e){
        // Expected fiscal/cashflow blockers are safe to surface as error codes.
        if(in_array($e->getMessage(),[
            'REAL_FISCAL_ADVANCE_BUILDER_NOT_APPROVED',
            'REAL_FISCAL_CONTACT_REQUIRED','REAL_FISCAL_CONTACT_MISMATCH','REAL_PAYMENTS_DISABLED',
            'REAL_TOPUP_RECONCILIATION_REQUIRED','REAL_TOPUP_METHOD_CHANGED',
            'REAL_ALREADY_PURCHASED','REAL_INSUFFICIENT_BALANCE',
            'REAL_MATERIAL_NOT_READY','REAL_WALLET_FROZEN',
        ],true))naReply(409,['ok'=>false,'error'=>$e->getMessage()]);
        throw $e;
    }
}

function naRealPaymentMethod(mixed $method): string {
    if (!is_string($method) || !in_array($method,['bank_card','sbp'],true))
        throw new InvalidArgumentException('REAL_UNSUPPORTED_PAYMENT_METHOD');
    return $method;
}
function naRealPaymentIdempotenceKey(string $topupId): string {
    if (preg_match('/^[a-f0-9-]{36}$/iD',$topupId)!==1)
        throw new InvalidArgumentException('INVALID_REAL_TOPUP_ID');
    // Deterministic per durable topup. Never switch the method or amount on retry.
    return hash('sha256','numi-real-wallet-topup-v1:'.$topupId);
}
function naRealPaymentReceipt(array $receipt,string $verifiedEmail,int $kopeks): array {
    // No fiscal values are invented here. An audited, server-only fiscal builder
    // must supply payment_subject, payment_mode, VAT and description.
    if (($receipt['customer']['email']??null)!==$verifiedEmail)
        throw new RuntimeException('REAL_FISCAL_CONTACT_MISMATCH');
    $items=$receipt['items']??null;
    if (!is_array($items)||array_is_list($items)===false||count($items)!==1)
        throw new RuntimeException('REAL_FISCAL_RECEIPT_NOT_REVIEWED');
    $item=$items[0];
    if (!is_array($item)||!is_string($item['description']??null)
        ||trim($item['description'])===''||mb_strlen($item['description'])>128
        ||!in_array($item['payment_mode']??null,['advance','full_prepayment'],true)
        ||!is_string($item['payment_subject']??null)||!isset($item['vat_code'])
        ||!in_array((string)($item['quantity']??''),['1','1.0','1.000'],true)
        ||($item['amount']['currency']??null)!=='RUB'
        ||($item['amount']['value']??null)!==naStoreAmount($kopeks))
        throw new RuntimeException('REAL_FISCAL_RECEIPT_NOT_REVIEWED');
    return ['customer'=>['email'=>$verifiedEmail],'items'=>[$item]];
}
function naRealPaymentPayload(array $topup,string $method,string $verifiedEmail,array $receipt): array {
    $method=naRealPaymentMethod($method);
    $kopeks=(int)($topup['kopeks']??0);
    if ($kopeks<100||$kopeks>10000000)
        throw new InvalidArgumentException('INVALID_REAL_PAYMENT_AMOUNT');
    $id=$topup['id']??null;
    if (!is_string($id)||preg_match('/^[a-f0-9-]{36}$/iD',$id)!==1)
        throw new InvalidArgumentException('INVALID_REAL_TOPUP_ID');
    return [
        'amount'=>['value'=>naStoreAmount($kopeks),'currency'=>'RUB'],
        'capture'=>true,
        'payment_method_data'=>['type'=>$method],
        'confirmation'=>[
            'type'=>'redirect',
            'return_url'=>'https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/?account=1&wallet_topup='.$id,
        ],
        'description'=>'Пополнение баланса Numerologia Online №'.substr($id,0,8),
        'save_payment_method'=>false,
        'metadata'=>['numi_real_wallet_topup'=>$id],
        'receipt'=>naRealPaymentReceipt($receipt,$verifiedEmail,$kopeks),
    ];
}
function naRealPaymentConfirmationUrl(array $payment): ?string {
    if (($payment['confirmation']['type']??null)!=='redirect')return null;
    $url=$payment['confirmation']['confirmation_url']??null;
    if (!is_string($url)||strlen($url)>2000)return null;
    $parts=parse_url($url);
    if (!is_array($parts)||($parts['scheme']??null)!=='https'||isset($parts['user'])||isset($parts['pass'])
        ||isset($parts['port'])||!is_string($parts['host']??null))return null;
    $host=strtolower($parts['host']);
    $allowed=$host==='yookassa.ru'||$host==='yoomoney.ru'
        ||str_ends_with($host,'.yookassa.ru')||str_ends_with($host,'.yoomoney.ru');
    return $allowed ? $url : null;
}
/** Injectable POST transport for isolated tests. The production transport never logs credentials. */
function naRealPaymentTransport(array $config,string $idempotenceKey,array $payload,?callable $testTransport=null): array {
    naRealWalletRequireLive($config);
    if ($testTransport!==null) {
        $response=$testTransport($payload,$idempotenceKey);
        if (!is_array($response))throw new RuntimeException('REAL_PROVIDER_INVALID_RESPONSE');
        return $response;
    }
    $json=json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    $curl=curl_init('https://api.yookassa.ru/v3/payments');
    if ($curl===false)throw new RuntimeException('REAL_PROVIDER_UNAVAILABLE');
    try {
        curl_setopt_array($curl,[
            CURLOPT_POST=>true,
            CURLOPT_POSTFIELDS=>$json,
            CURLOPT_RETURNTRANSFER=>true,
            CURLOPT_CONNECTTIMEOUT=>5,
            CURLOPT_TIMEOUT=>20,
            CURLOPT_FOLLOWLOCATION=>false,
            CURLOPT_USERPWD=>$config['shop_id'].':'.$config['secret_key'],
            CURLOPT_HTTPHEADER=>[
                'Content-Type: application/json',
                'Idempotence-Key: '.$idempotenceKey,
            ],
        ]);
        $raw=curl_exec($curl);
        $status=curl_getinfo($curl,CURLINFO_HTTP_CODE);
    } finally {
        curl_close($curl);
    }
    // 500/timeout are ambiguous. Retry only with the SAME key within 23h.
    if (!is_string($raw)||!in_array($status,[200,201],true))
        throw new RuntimeException('REAL_PROVIDER_CREATION_UNCERTAIN');
    $response=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
    if (!is_array($response))throw new RuntimeException('REAL_PROVIDER_INVALID_RESPONSE');
    return $response;
}
/**
 * Create exactly one external payment for a durable topup intent.
 * Only a trusted server operation can invoke this; no public API route exists.
 * The same request key never changes the method, amount or fiscal receipt.
 */
function naRealWalletCreatePayment(
    PDO $db,array $account,array $config,int $rub,string $requestKey,string $method,
    mixed $receiptEmail,array $reviewedServerReceipt,?callable $testTransport=null
): array {
    naRealWalletRequireLive($config);
    $method=naRealPaymentMethod($method);
    $email=naRealWalletReceiptEmail($receiptEmail);
    $intent=naRealWalletTopupIntent($db,$account,$config,$rub,$requestKey,$email);
    $topupId=$intent['topup_id'];
    $db->beginTransaction();
    try {
        // Serialize concurrent requests from the same account before any provider POST.
        $q=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');
        $q->execute([$account['id']]);
        if (!$q->fetchColumn())throw new RuntimeException('ACCOUNT_NOT_FOUND');
        $q=$db->prepare('SELECT * FROM numi_real_wallet_topups WHERE id=? AND account_id=? FOR UPDATE');
        $q->execute([$topupId,$account['id']]);
        $topup=$q->fetch();
        if (!$topup)throw new RuntimeException('REAL_TOPUP_NOT_FOUND');
        if ($topup['status']!=='pending')throw new RuntimeException('REAL_TOPUP_NOT_PENDING');
        if ($topup['payment_method']!==null && $topup['payment_method']!==$method)
            throw new RuntimeException('REAL_TOPUP_METHOD_CHANGED');
        if ($topup['receipt_email']!==$email)
            throw new InvalidArgumentException('REAL_FISCAL_CONTACT_MISMATCH');
        // Check receipt before registering the intended method: bad fiscal data must fail closed.
        $payload=naRealPaymentPayload($topup,$method,$email,$reviewedServerReceipt);
        if ($topup['provider_payment_id']) {
            $db->commit();
            return [
                'topup_id'=>$topupId,'payment_id'=>$topup['provider_payment_id'],
                'confirmation_url'=>$topup['confirmation_url']?:null,
                'status'=>'pending','method'=>$method,'reused'=>true,
            ];
        }
        // YooKassa Idempotence-Key expires in 24h. Refuse any potentially
        // duplicate POST after 23h; do not silently create another debit.
        if ($topup['provider_request_started_at']!==null) {
            $age=time()-(new DateTimeImmutable(
                $topup['provider_request_started_at'],new DateTimeZone('UTC')))->getTimestamp();
            if ($age>=23*3600||$age<(-60))
                throw new RuntimeException('REAL_TOPUP_RECONCILIATION_REQUIRED');
        } else {
            $db->prepare('UPDATE numi_real_wallet_topups SET payment_method=?,provider_request_started_at=UTC_TIMESTAMP() WHERE id=?')
                ->execute([$method,$topupId]);
        }
        $db->commit();
    } catch(Throwable $e) {
        if ($db->inTransaction())$db->rollBack();
        throw $e;
    }
    // Outside the DB transaction, but always using the persisted stable topup ID.
    $response=naRealPaymentTransport(
        $config,naRealPaymentIdempotenceKey($topupId),$payload,$testTransport);
    naRealWalletPaymentVerify($response,$topup,$config);
    if (($response['payment_method']['type']??$method)!==$method)
        throw new RuntimeException('REAL_PROVIDER_METHOD_MISMATCH');
    $url=naRealPaymentConfirmationUrl($response);
    if (($response['status']??null)==='pending' && $url===null)
        throw new RuntimeException('REAL_PROVIDER_CONFIRMATION_MISSING');
    naRealWalletAttachVerifiedProvider($db,$topup,$response,$config);
    $db->prepare('UPDATE numi_real_wallet_topups SET confirmation_url=? WHERE id=? AND provider_payment_id=?')
        ->execute([$url,$topupId,$response['id']]);
    return [
        'topup_id'=>$topupId,'payment_id'=>$response['id'],'confirmation_url'=>$url,
        'status'=>$response['status']??'pending','method'=>$method,'reused'=>false,
    ];
}
