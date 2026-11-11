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
    $live=function_exists('naLiveWalletModeSelected')&&naLiveWalletModeSelected();
    $providerOnly=$live?" AND o.provider IN ('real_wallet','real_subscription')":"";
    $q=$db->prepare("SELECT e.product_code,MAX(e.expires_at) AS expires_at
        FROM numi_entitlements e JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id
        WHERE e.account_id=? AND e.product_code IN ('club_month','school_week')
          AND e.status='active' AND o.status='paid' AND o.verified_at IS NOT NULL
          $providerOnly GROUP BY e.product_code");
    $q->execute([$account['id']]);$periods=$q->fetchAll();
    naSubscriptionSchema($db);$prefs=$db->prepare('SELECT product_code,auto_renew,cancelled_at FROM numi_subscription_settings WHERE account_id=?');$prefs->execute([$account['id']]);$by=[];foreach($prefs->fetchAll()as$p)$by[$p['product_code']]=$p;
    return array_map(function($p)use($by,$config,$live){
        $setting=$by[$p['product_code']]??[];
        // LIVE subscriptions currently use only manually renewed wallet funds.
        $enabled=!$live&&(bool)($setting['auto_renew']??false);
        return $p+['status'=>naSubscriptionState($p['expires_at']),
            'auto_renew'=>$enabled,'renewal'=>$enabled?'provider':'manual',
            'processing_enabled'=>!$live&&($config['store_recurring_test_enabled']??false)===true,
            'cancelled_at'=>$setting['cancelled_at']??null];
    },$periods);
}
/** Merge active subscription records by entitlements; never inherit recurring consent silently. */
function naSubscriptionMergeAccounts(PDO $db,string $from,string $to): void {
    if($from===$to)return;
    $q=$db->prepare('SELECT product_code,source_order_id FROM numi_subscription_settings WHERE account_id=? FOR UPDATE');
    $q->execute([$from]);
    foreach($q->fetchAll() as $setting){
        if(!naSubscriptionCode($setting['product_code']))continue;
        $db->prepare('INSERT IGNORE INTO numi_subscription_settings(account_id,product_code,auto_renew,source_order_id) VALUES(?,?,0,?)')
            ->execute([$to,$setting['product_code'],$setting['source_order_id']]);
        // After joining identities, explicit new consent is required for any future auto-payment.
        $db->prepare('UPDATE numi_subscription_settings SET auto_renew=0,payment_method_id=NULL,
                consent_at=NULL,cancelled_at=UTC_TIMESTAMP() WHERE account_id=? AND product_code=?')
            ->execute([$to,$setting['product_code']]);
    }
    $db->prepare('DELETE FROM numi_subscription_settings WHERE account_id=?')->execute([$from]);
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


/**
 * LIVE card subscription, distinct from wallet top-ups and TEST renewals.
 * Reuses numi_checkouts, numi_checkout_items, numi_checkout_consents,
 * numi_subscription_settings, numi_orders and numi_entitlements.
 * Merchant approval, fiscal review and an explicit private opt-in are ALL
 * required before a real card payment can be created.
 */
function naLiveRecurringAllowed(array $config): bool {
    return naRealWalletGate($config)
        && ($config['recurring_merchant_approved']??false)===true
        && ($config['subscription_receipts_verified']??false)===true
        && ($config['live_recurring_enabled']??false)===true
        && ($config['offset_receipt_reviewed']??false)===true
        && is_int($config['offset_receipt_vat_code']??null)
        && $config['offset_receipt_vat_code']>=1
        && $config['offset_receipt_vat_code']<=12;
}
function naLiveSubscriptionItem(string $code): array {
    if(!naSubscriptionCode($code))throw new InvalidArgumentException('INVALID_SUBSCRIPTION');
    $item=naCatalogResolve(['product_code'=>$code],false);
    if(($item['kind']??null)!=='subscription' || ($item['price_kopeks']??0)<1)
        throw new RuntimeException('SUBSCRIPTION_PRODUCT_UNAVAILABLE');
    return $item;
}
function naLiveSubscriptionReceipt(array $config,string $code,int $kopeks,string $email): array {
    if(!naLiveRecurringAllowed($config))throw new RuntimeException('REAL_RECURRING_NOT_APPROVED');
    $email=naRealWalletReceiptEmail($email);
    $vat=$config['offset_receipt_vat_code'];
    if($vat<1 || $vat>12)throw new RuntimeException('REAL_SUBSCRIPTION_VAT_NOT_REVIEWED');
    $label=$code==='club_month'?'Подписка Нумерология онлайн, 1 месяц'
        :'Самоучитель нумерологии, 7 дней';
    return ['customer'=>['email'=>$email],'items'=>[[
        'description'=>$label,'quantity'=>1.0,
        'amount'=>['value'=>naStoreAmount($kopeks),'currency'=>'RUB'],
        'vat_code'=>$vat,'payment_mode'=>'full_payment',
        'payment_subject'=>'service',
    ]]];
}
function naLiveSubscriptionPaymentCheck(array $payment,array $checkout,array $order): void {
    if(($payment['test']??null)!==false
        || !is_string($payment['id']??null)
        || !preg_match('/^[A-Za-z0-9-]{1,191}$/D',$payment['id'])
        || ($payment['amount']['currency']??null)!=='RUB'
        || ($payment['amount']['value']??null)!==naStoreAmount((int)$checkout['amount_kopeks'])
        || ($payment['metadata']['numi_subscription_checkout']??null)!==$checkout['id']
        || ($order['provider']??null)!=='real_subscription'
        || (int)$order['amount_kopeks']!==(int)$checkout['amount_kopeks'])
        throw new RuntimeException('REAL_SUBSCRIPTION_PAYMENT_VERIFICATION_FAILED');
}
function naLiveSubscriptionCheckoutData(PDO $db,string $checkoutId,string $accountId): array {
    $q=$db->prepare("SELECT c.*,o.id AS order_id,o.product_code,
        o.resource_id,o.amount_kopeks AS order_amount,o.provider,o.status AS order_status
        FROM numi_checkouts c JOIN numi_checkout_items i ON i.checkout_id=c.id
        JOIN numi_orders o ON o.id=i.order_id
        WHERE c.id=? AND c.account_id=? AND o.account_id=? AND o.provider='real_subscription'
        LIMIT 1");
    $q->execute([$checkoutId,$accountId,$accountId]);
    $row=$q->fetch(PDO::FETCH_ASSOC);
    if(!$row)throw new RuntimeException('REAL_SUBSCRIPTION_CHECKOUT_NOT_FOUND');
    return $row;
}
/** Explicitly consented *initial* purchase, not a wallet top-up. */
function naLiveSubscriptionStart(
    PDO $db,array $account,array $config,string $code,string $email,string $requestKey,
    ?callable $testTransport=null
): array {
    if(!naLiveRecurringAllowed($config))throw new RuntimeException('REAL_RECURRING_NOT_APPROVED');
    $item=naLiveSubscriptionItem($code);
    $email=naRealWalletReceiptEmail($email);
    $key=naWalletKey($requestKey);
    $hash=hash('sha256',json_encode(['real_subscription_v1',$code,$item['price_kopeks'],$email],JSON_THROW_ON_ERROR));
    $db->beginTransaction();
    try{
        $q=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');
        $q->execute([$account['id']]);
        if(!$q->fetchColumn())throw new RuntimeException('ACCOUNT_NOT_FOUND');
        $q=$db->prepare('SELECT * FROM numi_checkouts WHERE account_id=? AND request_key=?');
        $q->execute([$account['id'],$key]);$existing=$q->fetch(PDO::FETCH_ASSOC);
        if($existing && !hash_equals($existing['cart_hash'],$hash))
            throw new InvalidArgumentException('REAL_SUBSCRIPTION_REQUEST_KEY_REUSED');
        if($existing){
            $id=$existing['id'];
            $saved=naLiveSubscriptionCheckoutData($db,$id,$account['id']);
            if($saved['product_code']!==$code || $saved['order_status']==='cancelled')
                throw new RuntimeException('REAL_SUBSCRIPTION_ORDER_CANCELED');
        }else{
            $q=$db->prepare("SELECT 1 FROM numi_orders WHERE account_id=?
                AND product_code=? AND provider='real_subscription' AND status='pending' LIMIT 1");
            $q->execute([$account['id'],$code]);
            if($q->fetchColumn())throw new RuntimeException('REAL_SUBSCRIPTION_PENDING_REVIEW');
            $id=naUuid();$orderId=naUuid();
            $db->prepare('INSERT INTO numi_checkouts
                (id,account_id,request_key,cart_hash,amount_kopeks) VALUES(?,?,?,?,?)')
                ->execute([$id,$account['id'],$key,$hash,$item['price_kopeks']]);
            $db->prepare("INSERT INTO numi_orders
                (id,account_id,product_code,resource_id,amount_kopeks,provider)
                VALUES(?,?,?,?,?,'real_subscription')")
                ->execute([$orderId,$account['id'],$code,$item['resource_id'],$item['price_kopeks']]);
            $db->prepare('INSERT INTO numi_checkout_items(checkout_id,order_id) VALUES(?,?)')
                ->execute([$id,$orderId]);
            $db->prepare("INSERT INTO numi_checkout_consents
                (checkout_id,product_code,consent_at,version,receipt_email)
                VALUES(?,?,UTC_TIMESTAMP(),'live-subscription-v1',?)")
                ->execute([$id,$code,$email]);
            $db->prepare("INSERT IGNORE INTO numi_subscription_settings
                (account_id,product_code) VALUES(?,?)")->execute([$account['id'],$code]);
            $pref=$db->prepare("SELECT auto_renew FROM numi_subscription_settings
                WHERE account_id=? AND product_code=? FOR UPDATE");
            $pref->execute([$account['id'],$code]);
            if((bool)$pref->fetchColumn())throw new RuntimeException('REAL_SUBSCRIPTION_ALREADY_AUTO_RENEWING');
            $db->prepare("UPDATE numi_subscription_settings
                SET cancelled_at=NULL,auto_renew=0,receipt_email=?,
                    consent_at=UTC_TIMESTAMP(),payment_method_id=NULL,
                    source_order_id=?
                WHERE account_id=? AND product_code=?")
                ->execute([$email,$orderId,$account['id'],$code]);
        }
        $db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    if(isset($saved) && $saved['order_status']==='paid')
        return ['checkout_id'=>$id,'status'=>'succeeded','confirmation_url'=>null,
            'reused'=>true];
    return naLiveSubscriptionCreatePayment($db,$config,$id,$account['id'],null,$testTransport);
}
/**
 * Runs under the account lock, including the provider POST: a cancellation
 * cannot race a new charge after it has returned. Same checkout UUID means
 * same provider idempotency key; ambiguous requests are never replayed after 23h.
 */
function naLiveSubscriptionCreatePayment(
    PDO $db,array $config,string $checkoutId,string $accountId,?string $renewMethod,
    ?callable $testTransport=null
): array {
    if(!naLiveRecurringAllowed($config))throw new RuntimeException('REAL_RECURRING_NOT_APPROVED');
    $db->beginTransaction();
    try{
        $q=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');
        $q->execute([$accountId]);
        if(!$q->fetchColumn())throw new RuntimeException('ACCOUNT_NOT_FOUND');
        // A new subscriber may not yet have a balance row; create the empty row
        // before checking an existing account freeze. This does not credit funds.
        naRealWalletBalance($db,$accountId);
        naRealWalletAssertOpen($db,$accountId);
        $checkout=naLiveSubscriptionCheckoutData($db,$checkoutId,$accountId);
        $order=['provider'=>$checkout['provider'],'amount_kopeks'=>$checkout['order_amount']];
        $code=$checkout['product_code'];
        if($checkout['order_status']!=='pending')
            throw new RuntimeException('REAL_SUBSCRIPTION_NOT_PENDING');
        if($checkout['provider_payment_id']!==null){
            $db->commit();
            return ['checkout_id'=>$checkoutId,'payment_id'=>$checkout['provider_payment_id'],
                'confirmation_url'=>$checkout['confirmation_url'],
                'reused'=>true,'status'=>'pending'];
        }
        $age=time()-(new DateTimeImmutable($checkout['created_at'],new DateTimeZone('UTC')))->getTimestamp();
        if($age>23*3600 || $age<(-60))
            throw new RuntimeException('REAL_SUBSCRIPTION_RECONCILIATION_REQUIRED');
        $pref=$db->prepare("SELECT auto_renew,payment_method_id,cancelled_at,receipt_email,source_order_id
            FROM numi_subscription_settings WHERE account_id=? AND product_code=? FOR UPDATE");
        $pref->execute([$accountId,$code]);$state=$pref->fetch(PDO::FETCH_ASSOC);
        if(!$state || $state['cancelled_at']!==null)
            throw new RuntimeException('REAL_SUBSCRIPTION_CONSENT_REVOKED');
        $consent=$db->prepare("SELECT receipt_email FROM numi_checkout_consents
            WHERE checkout_id=? AND product_code=? AND version='live-subscription-v1'");
        $consent->execute([$checkoutId,$code]);$firstEmail=$consent->fetchColumn();
        $initial=$firstEmail!==false;
        if($initial){
            if($renewMethod!==null || $state['source_order_id']!==$checkout['order_id'])
                throw new RuntimeException('REAL_SUBSCRIPTION_INVALID_MODE');
            $email=naRealWalletReceiptEmail($firstEmail);
        }else{
            if(!(bool)$state['auto_renew']
                || !is_string($state['payment_method_id'])
                || !hash_equals($state['payment_method_id'],(string)$renewMethod))
                throw new RuntimeException('REAL_SUBSCRIPTION_CONSENT_REVOKED');
            $email=naRealWalletReceiptEmail($state['receipt_email']);
        }
        $receipt=naLiveSubscriptionReceipt($config,$code,(int)$checkout['amount_kopeks'],$email);
        $payload=[
            'amount'=>['value'=>naStoreAmount((int)$checkout['amount_kopeks']),'currency'=>'RUB'],
            'capture'=>true,
            'description'=>$code==='club_month'?'Подписка Нумерология онлайн'
                :'Самоучитель нумерологии',
            'metadata'=>['numi_subscription_checkout'=>$checkoutId],
            'receipt'=>$receipt,
        ];
        if($initial){
            $payload['payment_method_data']=['type'=>'bank_card'];
            $payload['save_payment_method']=true;
            $payload['confirmation']=['type'=>'redirect',
                'return_url'=>naPublicOrigin().'/?account=1&subscription_checkout='.$checkoutId];
        }else{
            $payload['payment_method_id']=$renewMethod;
            $payload['save_payment_method']=false;
        }
        $key=hash('sha256','numi-live-sub-v1:'.$checkoutId);
        $payment=naRealPaymentTransport($config,$key,$payload,$testTransport);
        naLiveSubscriptionPaymentCheck($payment,$checkout,$order);
        $url=$initial?naRealPaymentConfirmationUrl($payment):null;
        if($initial && ($payment['status']??null)==='pending' && $url===null)
            throw new RuntimeException('REAL_SUBSCRIPTION_CONFIRMATION_MISSING');
        if(!$initial && isset($payment['confirmation']))
            throw new RuntimeException('REAL_SUBSCRIPTION_RENEWAL_REQUIRES_REVIEW');
        $db->prepare("UPDATE numi_checkouts SET provider_payment_id=?,confirmation_url=?
            WHERE id=? AND provider_payment_id IS NULL")
            ->execute([$payment['id'],$url,$checkoutId]);
        $db->prepare("UPDATE numi_orders SET provider_payment_id=?
            WHERE id=? AND provider_payment_id IS NULL")
            ->execute([$payment['id'],$checkout['order_id']]);
        $db->commit();
        return ['checkout_id'=>$checkoutId,'payment_id'=>$payment['id'],
            'confirmation_url'=>$url,'status'=>$payment['status']??'pending','reused'=>false];
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}


/** Reconcile only a persisted live provider payment; never trust browser status. */
function naLiveSubscriptionSync(PDO $db,array $config,string $checkoutId,string $accountId,?callable $testReader=null): array {
    naRealWalletRequireLive($config);
    $checkout=naLiveSubscriptionCheckoutData($db,$checkoutId,$accountId);
    if(!$checkout['provider_payment_id'])
        return ['checkout_id'=>$checkoutId,'status'=>'pending'];
    $payment=$testReader!==null?$testReader($checkout['provider_payment_id'])
        :naRealWalletFetchPayment($config,$checkout['provider_payment_id']);
    if(($payment['id']??null)!==$checkout['provider_payment_id'])
        throw new RuntimeException('REAL_SUBSCRIPTION_PAYMENT_REFERENCE_MISMATCH');
    naLiveSubscriptionPaymentCheck($payment,$checkout,[
        'provider'=>$checkout['provider'],'amount_kopeks'=>$checkout['order_amount'],
    ]);
    $state=$payment['status']??'pending';
    $refunded=$payment['refunded_amount']['value']??'0.00';
    if(!is_string($refunded) || !preg_match('/^[0-9]+\.[0-9]{2}$/D',$refunded)
        || ($payment['refunded_amount']['currency']??'RUB')!=='RUB')
        throw new RuntimeException('REAL_SUBSCRIPTION_REFUND_NEEDS_REVIEW');
    if(!in_array($state,['succeeded','canceled'],true))
        return ['checkout_id'=>$checkoutId,'status'=>'pending'];
    if($state==='succeeded' && ($payment['paid']??null)!==true)
        throw new RuntimeException('REAL_SUBSCRIPTION_PAYMENT_NOT_PAID');
    if($state==='succeeded' && $refunded==='0.00'
        && ($payment['receipt_registration']??null)!=='succeeded')
        return ['checkout_id'=>$checkoutId,'status'=>'pending_receipt'];
    $db->beginTransaction();
    try{
        $q=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');
        $q->execute([$accountId]);
        if(!$q->fetchColumn())throw new RuntimeException('ACCOUNT_NOT_FOUND');
        $fresh=naLiveSubscriptionCheckoutData($db,$checkoutId,$accountId);
        if($fresh['provider_payment_id']!==$payment['id'])
            throw new RuntimeException('REAL_SUBSCRIPTION_PAYMENT_REFERENCE_MISMATCH');
        $order=$db->prepare('SELECT status,product_code FROM numi_orders WHERE id=? FOR UPDATE');
        $order->execute([$fresh['order_id']]);$row=$order->fetch(PDO::FETCH_ASSOC);
        if(!$row)throw new RuntimeException('REAL_SUBSCRIPTION_ORDER_MISSING');
        $code=$row['product_code'];
        $db->prepare("INSERT IGNORE INTO numi_subscription_settings
            (account_id,product_code) VALUES(?,?)")->execute([$accountId,$code]);
        $pref=$db->prepare("SELECT auto_renew,payment_method_id,cancelled_at,source_order_id
            FROM numi_subscription_settings WHERE account_id=? AND product_code=? FOR UPDATE");
        $pref->execute([$accountId,$code]);$settings=$pref->fetch(PDO::FETCH_ASSOC);
        if($refunded!=='0.00' || $state==='canceled'){
            $status=$refunded!=='0.00'?'refunded':'cancelled';
            if($row['status']==='pending' || $row['status']==='paid'){
                $db->prepare('UPDATE numi_orders SET status=? WHERE id=?')
                    ->execute([$status,$fresh['order_id']]);
                $db->prepare("UPDATE numi_entitlements SET status='revoked'
                    WHERE order_id=?")->execute([$fresh['order_id']]);
            }
            $db->prepare("UPDATE numi_subscription_settings
                SET auto_renew=0,payment_method_id=NULL,cancelled_at=UTC_TIMESTAMP()
                WHERE account_id=? AND product_code=?")->execute([$accountId,$code]);
            $db->commit();
            return ['checkout_id'=>$checkoutId,'status'=>$status,'auto_renew'=>false];
        }
        if($row['status']==='pending'){
            // Entitlement extension and payment settlement happen exactly once.
            $period=$db->prepare("SELECT MAX(e.expires_at) FROM numi_entitlements e
                JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id
                WHERE e.account_id=? AND e.product_code=? AND e.status='active'
                    AND o.status='paid' AND o.verified_at IS NOT NULL
                    AND o.provider IN ('real_wallet','real_subscription')");
            $period->execute([$accountId,$code]);
            $oldUntil=$period->fetchColumn();
            $start=new DateTimeImmutable('now',new DateTimeZone('UTC'));
            if(is_string($oldUntil) && $oldUntil!=='' &&
                new DateTimeImmutable($oldUntil,new DateTimeZone('UTC'))>$start)
                $start=new DateTimeImmutable($oldUntil,new DateTimeZone('UTC'));
            $expires=naStoreExpiry($code,$start);
            $db->prepare("UPDATE numi_orders SET status='paid',verified_at=UTC_TIMESTAMP()
                WHERE id=? AND status='pending'")->execute([$fresh['order_id']]);
            $db->prepare("INSERT IGNORE INTO numi_entitlements
                (id,account_id,order_id,product_code,resource_id,status,expires_at)
                VALUES(?,?,?,?,?,'active',?)")
                ->execute([naUuid(),$accountId,$fresh['order_id'],$code,$fresh['resource_id'],$expires]);
            $consent=$db->prepare("SELECT receipt_email,consent_at FROM numi_checkout_consents
                WHERE checkout_id=? AND product_code=? AND version='live-subscription-v1'");
            $consent->execute([$checkoutId,$code]);$first=$consent->fetch(PDO::FETCH_ASSOC);
            if($first){
                $method=$payment['payment_method']??[];
                $savedId=$method['id']??null;
                $valid=($method['saved']??null)===true
                    && ($method['type']??null)==='bank_card'
                    && is_string($savedId)
                    && preg_match('/^[A-Za-z0-9-]{1,191}$/D',$savedId)===1;
                if($settings['cancelled_at']===null
                    && $settings['source_order_id']===$fresh['order_id'] && $valid){
                    $db->prepare("UPDATE numi_subscription_settings
                        SET auto_renew=1,payment_method_id=?,receipt_email=?,
                            consent_at=?,source_order_id=?
                        WHERE account_id=? AND product_code=? AND cancelled_at IS NULL")
                        ->execute([$savedId,$first['receipt_email'],$first['consent_at'],
                            $fresh['order_id'],$accountId,$code]);
                }else{
                    // Paid access remains valid even if saving the card failed
                    // or user revoked consent while the initial payment was pending.
                    $db->prepare("UPDATE numi_subscription_settings
                        SET auto_renew=0,payment_method_id=NULL,source_order_id=?
                        WHERE account_id=? AND product_code=?")
                        ->execute([$fresh['order_id'],$accountId,$code]);
                }
            }else{
                // A renewal never grants fresh consent or reactivates a cancelled card.
                $db->prepare("UPDATE numi_subscription_settings SET source_order_id=?
                    WHERE account_id=? AND product_code=? AND auto_renew=1
                    AND payment_method_id IS NOT NULL AND cancelled_at IS NULL")
                    ->execute([$fresh['order_id'],$accountId,$code]);
            }
        }
        $pref->execute([$accountId,$code]);$after=$pref->fetch(PDO::FETCH_ASSOC);
        $db->commit();
        return ['checkout_id'=>$checkoutId,'status'=>'paid',
            'auto_renew'=>(bool)($after['auto_renew']??false)];
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}

/** A durable renewal intent keyed to the last successfully settled order. */
function naLiveSubscriptionRenewIntent(PDO $db,array $config,string $accountId,string $code): ?array {
    if(!naLiveRecurringAllowed($config))return null;
    $item=naLiveSubscriptionItem($code);
    $db->beginTransaction();
    try{
        $q=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');
        $q->execute([$accountId]);
        if(!$q->fetchColumn())throw new RuntimeException('ACCOUNT_NOT_FOUND');
        $q=$db->prepare("SELECT auto_renew,payment_method_id,cancelled_at,receipt_email,source_order_id
            FROM numi_subscription_settings WHERE account_id=? AND product_code=? FOR UPDATE");
        $q->execute([$accountId,$code]);$setting=$q->fetch(PDO::FETCH_ASSOC);
        if(!$setting || !(bool)$setting['auto_renew'] || $setting['cancelled_at']!==null
            || !is_string($setting['payment_method_id']) || $setting['payment_method_id']===''
            || !is_string($setting['source_order_id'])){
            $db->commit();return null;
        }
        $email=naRealWalletReceiptEmail($setting['receipt_email']);
        $q=$db->prepare("SELECT MAX(e.expires_at) FROM numi_entitlements e
            JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id
            WHERE e.account_id=? AND e.product_code=? AND e.status='active'
              AND o.status='paid' AND o.verified_at IS NOT NULL
              AND o.provider IN ('real_wallet','real_subscription')");
        $q->execute([$accountId,$code]);$expires=$q->fetchColumn();
        if(!is_string($expires) || $expires===''){
            // Without a verified original paid period, refuse a charge.
            $db->commit();return null;
        }
        if(new DateTimeImmutable($expires,new DateTimeZone('UTC')) >
            new DateTimeImmutable('now',new DateTimeZone('UTC'))){
            $db->commit();return null;
        }
        $q=$db->prepare("SELECT c.id,c.provider_payment_id
            FROM numi_checkouts c JOIN numi_checkout_items i ON i.checkout_id=c.id
            JOIN numi_orders o ON o.id=i.order_id
            WHERE c.account_id=? AND o.account_id=? AND o.product_code=?
              AND o.provider='real_subscription' AND o.status='pending'
            ORDER BY c.created_at LIMIT 1");
        $q->execute([$accountId,$accountId,$code]);$pending=$q->fetch(PDO::FETCH_ASSOC);
        if($pending){
            $db->commit();
            return ['checkout_id'=>$pending['id'],'payment_method_id'=>$setting['payment_method_id'],
                'has_payment'=>$pending['provider_payment_id']!==null];
        }
        $key='sub-renew-'.substr(hash('sha256',$accountId.'|'.$code.'|'.$setting['source_order_id']),0,48);
        $hash=hash('sha256',json_encode(['real_subscription_renewal_v1',$code,
            $item['price_kopeks'],$setting['source_order_id'],$email],JSON_THROW_ON_ERROR));
        $q=$db->prepare('SELECT id,cart_hash FROM numi_checkouts WHERE account_id=? AND request_key=?');
        $q->execute([$accountId,$key]);$prior=$q->fetch(PDO::FETCH_ASSOC);
        if($prior){
            if(!hash_equals($prior['cart_hash'],$hash))
                throw new RuntimeException('REAL_SUBSCRIPTION_RENEWAL_KEY_REUSED');
            $id=$prior['id'];
        }else{
            $id=naUuid();$orderId=naUuid();
            $db->prepare("INSERT INTO numi_checkouts
                (id,account_id,request_key,cart_hash,amount_kopeks) VALUES(?,?,?,?,?)")
                ->execute([$id,$accountId,$key,$hash,$item['price_kopeks']]);
            $db->prepare("INSERT INTO numi_orders
                (id,account_id,product_code,resource_id,amount_kopeks,provider)
                VALUES(?,?,?,?,?,'real_subscription')")
                ->execute([$orderId,$accountId,$code,$item['resource_id'],$item['price_kopeks']]);
            $db->prepare('INSERT INTO numi_checkout_items(checkout_id,order_id) VALUES(?,?)')
                ->execute([$id,$orderId]);
        }
        $db->commit();
        return ['checkout_id'=>$id,'payment_method_id'=>$setting['payment_method_id'],
            'has_payment'=>false];
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
/** Invoked only by the existing authenticated worker, never a customer API. */
function naLiveSubscriptionTick(PDO $db,array $config,?callable $testTransport=null,?callable $testReader=null): array {
    if(!naLiveRecurringAllowed($config))return ['enabled'=>false,'processed'=>0];
    $result=['enabled'=>true,'reconciled'=>0,'started'=>0,'review'=>0];
    // Reconcile pending payment/receipt first, even when user has disabled renewal.
    $pending=$db->query("SELECT c.id,c.account_id FROM numi_checkouts c
        JOIN numi_checkout_items i ON i.checkout_id=c.id
        JOIN numi_orders o ON o.id=i.order_id
        WHERE o.provider='real_subscription' AND o.status='pending'
        AND c.provider_payment_id IS NOT NULL ORDER BY c.created_at LIMIT 30");
    foreach($pending->fetchAll(PDO::FETCH_ASSOC) as $row){
        try{
            naLiveSubscriptionSync($db,$config,$row['id'],$row['account_id'],$testReader);
            $result['reconciled']++;
        }catch(Throwable $e){
            $result['review']++;
            error_log('NUMI_LIVE_SUBSCRIPTION_RECONCILE '.get_class($e));
        }
    }
    $q=$db->query("SELECT account_id,product_code FROM numi_subscription_settings
        WHERE auto_renew=1 AND cancelled_at IS NULL AND payment_method_id IS NOT NULL
          AND receipt_email IS NOT NULL
          AND product_code IN ('club_month','school_week')
        ORDER BY account_id LIMIT 20");
    foreach($q->fetchAll(PDO::FETCH_ASSOC) as $item){
        try{
            $renew=naLiveSubscriptionRenewIntent($db,$config,$item['account_id'],$item['product_code']);
            if($renew===null)continue;
            if($renew['has_payment']){
                naLiveSubscriptionSync($db,$config,$renew['checkout_id'],$item['account_id'],$testReader);
            }else{
                naLiveSubscriptionCreatePayment($db,$config,$renew['checkout_id'],
                    $item['account_id'],$renew['payment_method_id'],$testTransport);
            }
            $result['started']++;
        }catch(Throwable $e){
            $result['review']++;
            error_log('NUMI_LIVE_SUBSCRIPTION_RENEW '.get_class($e));
        }
    }
    return $result;
}
