<?php
declare(strict_types=1);
/** Billing preferences only; access and expiry remain exclusively in numi_entitlements. */
function naSubscriptionSchema(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS numi_subscription_settings (
      account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      product_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      auto_renew TINYINT NOT NULL DEFAULT 0,payment_method_id VARCHAR(191) NULL,
      consent_at DATETIME NULL,cancelled_at DATETIME NULL,source_order_id CHAR(36) NULL,
      PRIMARY KEY(account_id,product_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS numi_checkout_consents (
      checkout_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      product_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      consent_at DATETIME NOT NULL,version VARCHAR(30) NOT NULL,
      PRIMARY KEY(checkout_id,product_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function naSubscriptionCode(mixed $code): bool { return is_string($code)&&in_array($code,['club_month','school_week'],true); }
function naSubscriptionState(?string $expires,bool $revoked=false,?DateTimeImmutable $now=null): string {
    if($revoked)return 'revoked';if(!$expires)return 'inactive';$now??=new DateTimeImmutable('now',new DateTimeZone('UTC'));
    return new DateTimeImmutable($expires,new DateTimeZone('UTC'))>$now?'active':'expired';
}
function naSubscriptionSettled(PDO $db,array $checkout,array $order,array $payment): void {
    if(!naSubscriptionCode($order['product_code']))return;
    $q=$db->prepare('SELECT consent_at FROM numi_checkout_consents WHERE checkout_id=? AND product_code=?');$q->execute([$checkout['id'],$order['product_code']]);$consent=$q->fetchColumn();
    $db->prepare('INSERT IGNORE INTO numi_subscription_settings(account_id,product_code) VALUES(?,?)')->execute([$order['account_id'],$order['product_code']]);
    if($consent&&($payment['payment_method']['saved']??false)===true&&is_string($payment['payment_method']['id']??null)&&preg_match('/^[a-zA-Z0-9-]{1,191}$/D',$payment['payment_method']['id'])){
        // Cancellation made after consent wins, including during an unfinished payment.
        $db->prepare('UPDATE numi_subscription_settings SET payment_method_id=?,consent_at=?,auto_renew=CASE WHEN cancelled_at IS NULL OR cancelled_at<? THEN 1 ELSE 0 END,source_order_id=? WHERE account_id=? AND product_code=?')
            ->execute([$payment['payment_method']['id'],$consent,$consent,$order['id'],$order['account_id'],$order['product_code']]);
    }else{
        $db->prepare('UPDATE numi_subscription_settings SET source_order_id=? WHERE account_id=? AND product_code=?')->execute([$order['id'],$order['account_id'],$order['product_code']]);
    }
}
function naSubscriptionList(PDO $db,array $account,array $config): array {
    $q=$db->prepare("SELECT e.product_code,MAX(e.expires_at) AS expires_at FROM numi_entitlements e JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id WHERE e.account_id=? AND e.product_code IN ('club_month','school_week') AND e.status='active' AND o.status='paid' AND o.verified_at IS NOT NULL GROUP BY e.product_code");$q->execute([$account['id']]);$periods=$q->fetchAll();
    naSubscriptionSchema($db);$prefs=$db->prepare('SELECT product_code,auto_renew,cancelled_at FROM numi_subscription_settings WHERE account_id=?');$prefs->execute([$account['id']]);$by=[];foreach($prefs->fetchAll()as$p)$by[$p['product_code']]=$p;
    return array_map(function($p)use($by,$config){$setting=$by[$p['product_code']]??[];$enabled=(bool)($setting['auto_renew']??false);return $p+['status'=>naSubscriptionState($p['expires_at']),'auto_renew'=>$enabled,'renewal'=>$enabled?'provider':'manual','processing_enabled'=>($config['store_recurring_test_enabled']??false)===true,'cancelled_at'=>$setting['cancelled_at']??null];},$periods);
}
function naSubscriptionCancel(PDO $db,array $account,mixed $code): void {
    if(!naSubscriptionCode($code))throw new InvalidArgumentException('INVALID_SUBSCRIPTION');
    naSubscriptionSchema($db);
    $db->prepare('INSERT IGNORE INTO numi_subscription_settings(account_id,product_code) VALUES(?,?)')->execute([$account['id'],$code]);
    $db->prepare('UPDATE numi_subscription_settings SET auto_renew=0,cancelled_at=UTC_TIMESTAMP() WHERE account_id=? AND product_code=?')->execute([$account['id'],$code]);
}
/** Run only from the private CLI worker. It never changes existing CRON or mailing jobs. */
function naSubscriptionTick(PDO $db,array $config): array {
    if(!naStoreEnabled($config)||($config['store_recurring_test_enabled']??false)!==true)throw new RuntimeException('RECURRING_DISABLED');
    naStoreSchema($db);$result=[];
    $list=$db->query('SELECT account_id,product_code,payment_method_id,source_order_id FROM numi_subscription_settings WHERE auto_renew=1 AND payment_method_id IS NOT NULL')->fetchAll();
    foreach($list as$preference){
        $account=naUser($db,$preference['account_id']);if(!$account||(!naTestOwner($account)&&!in_array($account['id'],$config['store_test_account_ids']??[],true)))continue;
        $code=$preference['product_code'];if(!naSubscriptionCode($code)||!$preference['source_order_id'])continue;
        $period=$db->prepare("SELECT MAX(e.expires_at) FROM numi_entitlements e JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id WHERE e.account_id=? AND e.product_code=? AND e.status='active' AND o.status='paid' AND o.verified_at IS NOT NULL");$period->execute([$account['id'],$code]);$until=$period->fetchColumn();
        if(!$until){naSubscriptionCancel($db,$account,$code);continue;}if(naSubscriptionState($until)==='active')continue;
        require_once __DIR__.'/fulfillment.php';
        try{naMaterialBuild($code,$code==='club_month'?'club':'school');}catch(Throwable $e){$result[]=['product_code'=>$code,'status'=>'material_unavailable'];continue;}
        $item=naCatalogResolve(['product_code'=>$code],false);$quote=['items'=>[$item],'total_kopeks'=>$item['price_kopeks']];
        $key='renew-'.substr(hash('sha256',$preference['source_order_id'].'|'.$code),0,56);
        $checkout=naStorePrepareCheckout($db,$account,['request_key'=>$key],$quote);
        if($checkout['provider_payment_id']){naStoreSync($db,$config,$checkout);continue;}
        if(strtotime($checkout['created_at'].' UTC')<time()-23*3600)throw new RuntimeException('PAYMENT_RECONCILIATION_REQUIRED');
        $db->beginTransaction();
        try{
            $lock=$db->prepare('SELECT auto_renew,payment_method_id FROM numi_subscription_settings WHERE account_id=? AND product_code=? FOR UPDATE');$lock->execute([$account['id'],$code]);$latest=$lock->fetch();
            if(!$latest||!(bool)$latest['auto_renew']||$latest['payment_method_id']!==$preference['payment_method_id']){$db->prepare("UPDATE numi_orders SET status='cancelled' WHERE id IN (SELECT order_id FROM numi_checkout_items WHERE checkout_id=?) AND status='pending'")->execute([$checkout['id']]);$db->commit();continue;}
            // Same provider, same checkout idempotency key; store only its opaque method token.
            $payment=naStoreProvider($config,'POST','/payments',['amount'=>['value'=>naStoreAmount((int)$checkout['amount_kopeks']),'currency'=>'RUB'],'capture'=>true,'payment_method_id'=>$latest['payment_method_id'],'description'=>'Тестовое продление подписки','metadata'=>['numi_checkout'=>$checkout['id']]],$checkout['id']);
            $checkout['provider_payment_id']=$payment['id']??'';naStoreVerifyPayment($payment,$checkout);
            $db->prepare('UPDATE numi_checkouts SET provider_payment_id=? WHERE id=?')->execute([$checkout['provider_payment_id'],$checkout['id']]);
            if(($payment['status']??'')==='canceled')$db->prepare('UPDATE numi_subscription_settings SET auto_renew=0 WHERE account_id=? AND product_code=?')->execute([$account['id'],$code]);
            $db->commit();
        }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
        naStoreApply($db,$checkout,$payment);$result[]=['checkout_id'=>$checkout['id'],'status'=>$payment['status']??'pending'];
    }
    return $result;
}
