<?php
declare(strict_types=1);
/**
 * Separate first-party gift campaign. Never writes to orders, wallets or paid
 * entitlements. Owner-only distribution, account-bound opt-in activation.
 */
function ngReply(int $status,array $payload): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
function ngOrigin(): bool {
    $origin=(string)($_SERVER['HTTP_ORIGIN']??'');
    $host=strtolower((string)($_SERVER['HTTP_HOST']??''));
    $allowed=[
        'xn----8sbhhqijddjgdebdz2c2o.xn--p1ai',
        'www.xn----8sbhhqijddjgdebdz2c2o.xn--p1ai',
        'xn--c1adkkdfjbp1a4l.online',
        'www.xn--c1adkkdfjbp1a4l.online'
    ];
    return in_array($host,$allowed,true)&&$origin==='https://'.$host;
}
function ngSchema(PDO $db): void {
    try {
        $db->query('SELECT id FROM numi_gift_club LIMIT 0');
        $db->query('SELECT id FROM numi_gift_batches LIMIT 0');
        return;
    } catch(PDOException $e) {
        if((string)$e->getCode()!=='42S02')throw $e;
    }
    $db->exec("CREATE TABLE IF NOT EXISTS numi_gift_batches (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      requested_count SMALLINT UNSIGNED NOT NULL,
      issued_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_gift_batch_request(request_key),
      KEY ix_gift_batch_created(created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS numi_gift_club (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      batch_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      offered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      claim_by DATETIME NOT NULL,
      activated_at DATETIME NULL,
      expires_at DATETIME NULL,
      KEY ix_gift_account(account_id,offered_at),
      KEY ix_gift_activated(activated_at),
      KEY ix_gift_batch(batch_id),
      CONSTRAINT fk_gift_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id),
      CONSTRAINT fk_gift_batch FOREIGN KEY(batch_id) REFERENCES numi_gift_batches(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
/** Real, verified paid club access, excluding historic sandbox orders. */
function ngPaidClubCondition(): string {
    return "EXISTS(SELECT 1 FROM numi_entitlements e
        JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id
        WHERE e.account_id=a.id AND e.product_code='club_month'
          AND e.resource_id='club' AND e.status='active'
          AND e.expires_at>UTC_TIMESTAMP() AND o.status='paid'
          AND o.verified_at IS NOT NULL
          AND o.provider IN ('real_wallet','real_subscription'))";
}
function ngEligibleCondition(): string {
    return "NOT ".ngPaidClubCondition()."
      AND NOT EXISTS(SELECT 1 FROM numi_gift_club g
        WHERE g.account_id=a.id
          AND g.offered_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 30 DAY))";
}
function ngCount(PDO $db,string $where): int {
    return (int)$db->query("SELECT COUNT(*) FROM numi_accounts a WHERE ".$where)->fetchColumn();
}
function ngOverview(PDO $db): array {
    $all=ngCount($db,'1=1');
    $paid=ngCount($db,ngPaidClubCondition());
    $never=ngCount($db,"NOT EXISTS(SELECT 1 FROM numi_orders o
       WHERE o.account_id=a.id AND o.status='paid' AND o.verified_at IS NOT NULL
         AND o.amount_kopeks>0 AND o.provider IN ('real_wallet','real_subscription'))");
    $had=ngCount($db,"NOT ".ngPaidClubCondition()." AND EXISTS(
       SELECT 1 FROM numi_orders o WHERE o.account_id=a.id
       AND o.product_code='club_month' AND o.status='paid'
       AND o.verified_at IS NOT NULL AND o.provider IN ('real_wallet','real_subscription'))");
    $eligible=ngCount($db,ngEligibleCondition());
    $recent=(int)$db->query("SELECT COUNT(DISTINCT account_id) FROM numi_gift_club
       WHERE offered_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 30 DAY)")->fetchColumn();
    $totals=$db->query("SELECT COUNT(*) issued,
       COALESCE(SUM(activated_at IS NOT NULL),0) activated,
       COALESCE(SUM(activated_at IS NULL AND claim_by>UTC_TIMESTAMP()),0) pending,
       COALESCE(SUM(activated_at IS NOT NULL AND expires_at>UTC_TIMESTAMP()),0) active
       FROM numi_gift_club")->fetch(PDO::FETCH_ASSOC);
    $converted=(int)$db->query("SELECT COUNT(DISTINCT g.account_id)
      FROM numi_gift_club g
      JOIN numi_orders o ON o.account_id=g.account_id
      WHERE g.activated_at IS NOT NULL AND o.verified_at>g.activated_at
        AND o.status='paid' AND o.amount_kopeks>0
        AND o.provider IN ('real_wallet','real_subscription')")->fetchColumn();
    $batches=$db->query("SELECT created_at,requested_count,issued_count
       FROM numi_gift_batches ORDER BY created_at DESC,id DESC LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
    return ['ok'=>true,'accounts'=>[
        'all'=>$all,'paid_club'=>$paid,'without_paid_club'=>$all-$paid,
        'never_purchased'=>$never,'previously_paid_club'=>$had,
        'gifted_last_30_days'=>$recent,'eligible'=>$eligible
      ],'gifts'=>[
        'issued'=>(int)$totals['issued'],'pending'=>(int)$totals['pending'],
        'activated'=>(int)$totals['activated'],'active_now'=>(int)$totals['active'],
        'buyers_after_activation'=>$converted
      ],'batches'=>$batches,'generated_at'=>gmdate('c')];
}
function ngMine(PDO $db,array $user): array {
    $q=$db->prepare("SELECT id,offered_at,claim_by,activated_at,expires_at
       FROM numi_gift_club WHERE account_id=?
       ORDER BY offered_at DESC,id DESC LIMIT 10");
    $q->execute([$user['id']]);
    $items=[];
    foreach($q->fetchAll(PDO::FETCH_ASSOC) as $item) {
        $state=$item['activated_at']!==null
          ? (strtotime($item['expires_at'].' UTC')>time()?'active':'expired')
          : (strtotime($item['claim_by'].' UTC')>time()?'ready':'expired');
        $items[]=['id'=>$item['id'],'status'=>$state,'offered_at'=>$item['offered_at'],
             'claim_by'=>$item['claim_by'],'expires_at'=>$item['expires_at']];
    }
    return ['ok'=>true,'gifts'=>$items];
}
function ngIssue(PDO $db,array $payload): array {
    $count=$payload['count']??null;$key=$payload['request_key']??null;
    if(!is_int($count)||$count<1||$count>50||!is_string($key)
       ||!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/Di',$key))
       throw new InvalidArgumentException('BAD_GIFT_REQUEST');
    $db->beginTransaction();
    try{
        $batchId=naUuid();
        $create=$db->prepare("INSERT IGNORE INTO numi_gift_batches
          (id,request_key,requested_count) VALUES(?,?,?)");
        $create->execute([$batchId,$key,$count]);
        if($create->rowCount()===0){
            $q=$db->prepare("SELECT id,requested_count,issued_count
               FROM numi_gift_batches WHERE request_key=? FOR UPDATE");
            $q->execute([$key]);$saved=$q->fetch(PDO::FETCH_ASSOC);
            if(!$saved||(int)$saved['requested_count']!==$count)
               throw new InvalidArgumentException('REQUEST_KEY_REUSED');
            $db->commit();
            return ['ok'=>true,'already_processed'=>true,'issued'=>(int)$saved['issued_count']];
        }
        // Hard cap to avoid accidentally distributing hundreds of gifts.
        $today=(int)$db->query("SELECT COALESCE(SUM(issued_count),0)
          FROM numi_gift_batches WHERE created_at>=UTC_DATE()")->fetchColumn();
        if($today+$count>100)throw new InvalidArgumentException('DAILY_LIMIT');
        $candidates=$db->query("SELECT a.id FROM numi_accounts a
          WHERE ".ngEligibleCondition()."
          ORDER BY RAND() LIMIT ".($count*4))->fetchAll(PDO::FETCH_COLUMN);
        $lock=$db->prepare("SELECT id FROM numi_accounts WHERE id=? FOR UPDATE");
        $eligible=$db->prepare("SELECT a.id FROM numi_accounts a WHERE a.id=?
          AND ".ngEligibleCondition()." LIMIT 1");
        $insert=$db->prepare("INSERT INTO numi_gift_club
          (id,batch_id,account_id,claim_by)
          VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY))");
        $issued=0;
        foreach($candidates as $id){
            if($issued===$count)break;
            $lock->execute([$id]);if(!$lock->fetchColumn())continue;
            $eligible->execute([$id]);if(!$eligible->fetchColumn())continue;
            $insert->execute([naUuid(),$batchId,$id]);$issued++;
        }
        $db->prepare("UPDATE numi_gift_batches SET issued_count=? WHERE id=?")
            ->execute([$issued,$batchId]);
        $db->commit();
        return ['ok'=>true,'already_processed'=>false,'issued'=>$issued];
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function ngActivate(PDO $db,array $user,array $payload): array {
    $id=$payload['gift_id']??null;
    if(!is_string($id)||!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/Di',$id))
       throw new InvalidArgumentException('BAD_GIFT_ID');
    $db->beginTransaction();
    try{
        $lock=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');
        $lock->execute([$user['id']]);
        if(!$lock->fetchColumn())throw new RuntimeException('ACCOUNT_NOT_FOUND');
        $q=$db->prepare("SELECT id,activated_at,expires_at,claim_by
             FROM numi_gift_club WHERE id=? AND account_id=? FOR UPDATE");
        $q->execute([$id,$user['id']]);$gift=$q->fetch(PDO::FETCH_ASSOC);
        if(!$gift)throw new InvalidArgumentException('GIFT_NOT_FOUND');
        if($gift['activated_at']!==null) {
            $db->commit();return ['ok'=>true,'status'=>'already_activated','expires_at'=>$gift['expires_at']];
        }
        if(strtotime($gift['claim_by'].' UTC')<=time())
            throw new InvalidArgumentException('GIFT_EXPIRED');
        $paid=$db->prepare("SELECT 1 FROM numi_entitlements e JOIN numi_orders o
          ON o.id=e.order_id AND o.account_id=e.account_id
          WHERE e.account_id=? AND e.product_code='club_month' AND e.resource_id='club'
          AND e.status='active' AND e.expires_at>UTC_TIMESTAMP()
          AND o.status='paid' AND o.verified_at IS NOT NULL
          AND o.provider IN ('real_wallet','real_subscription') LIMIT 1");
        $paid->execute([$user['id']]);if($paid->fetchColumn())
            throw new InvalidArgumentException('PAID_CLUB_ACTIVE');
        $db->prepare("UPDATE numi_gift_club
            SET activated_at=UTC_TIMESTAMP(),
                expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR)
            WHERE id=? AND account_id=? AND activated_at IS NULL")
           ->execute([$id,$user['id']]);
        $q=$db->prepare('SELECT expires_at FROM numi_gift_club WHERE id=?');
        $q->execute([$id]);$until=$q->fetchColumn();
        $db->commit();
        return ['ok'=>true,'status'=>'active','expires_at'=>$until];
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function ngMain(): never {
    header('Cache-Control: private, no-store, max-age=0');
    header('X-Content-Type-Options: nosniff');header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    try{
        require_once dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
        naHeaders();$db=naDB();$db->exec("SET time_zone='+00:00'");
        $user=naCurrent($db);
        if(!$user)ngReply(401,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
        $method=$_SERVER['REQUEST_METHOD']??'GET';
        $action=$method==='GET'?($_GET['action']??''):null;
        $body=[];
        if($method==='POST'){
            if(!ngOrigin())ngReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
            if((int)($_SERVER['CONTENT_LENGTH']??0)>4000)ngReply(413,['ok'=>false,'error'=>'TOO_LARGE']);
            $body=json_decode((string)file_get_contents('php://input'),true,8,JSON_THROW_ON_ERROR);
            if(!is_array($body))throw new InvalidArgumentException('BAD_BODY');
            $action=$body['action']??null;
        }
        if(!is_string($action))ngReply(400,['ok'=>false,'error'=>'BAD_ACTION']);
        if(!in_array($action,['my','overview','issue','activate'],true))
            ngReply(400,['ok'=>false,'error'=>'UNKNOWN_ACTION']);
        if(in_array($action,['overview','issue'],true)&&!naTestOwner($user))
            ngReply(403,['ok'=>false,'error'=>'OWNER_REQUIRED']);
        if(!in_array([$method,$action],[['GET','my'],['GET','overview'],['POST','issue'],['POST','activate']],true))
            ngReply(405,['ok'=>false,'error'=>'METHOD']);
        ngSchema($db);
        if($action==='my')ngReply(200,ngMine($db,$user));
        if($action==='overview')ngReply(200,ngOverview($db));
        if($action==='issue')ngReply(200,ngIssue($db,$body));
        if($action==='activate')ngReply(200,ngActivate($db,$user,$body));
    }catch(JsonException|InvalidArgumentException $e){
        ngReply(400,['ok'=>false,'error'=>preg_replace('/[^A-Z_]/','',$e->getMessage())?:'BAD_REQUEST']);
    }catch(Throwable $e){
        if(isset($db)&&$db->inTransaction())$db->rollBack();
        error_log('NUMI_GIFT: '.get_class($e));
        ngReply(503,['ok'=>false,'error'=>'GIFT_UNAVAILABLE']);
    }
}
if(!defined('NG_TEST'))ngMain();
