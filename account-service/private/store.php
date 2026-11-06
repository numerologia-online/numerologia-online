<?php
declare(strict_types=1);
require_once __DIR__.'/subscriptions.php';
/** Extension of the existing account/order service. Live charging is deliberately unsupported. */
function naStoreConfig(): array {
    // Same private configuration used by the retired test checkout; never copy credentials to source.
    $path=dirname(__DIR__).'/numi-wallet-test-20261106/config.local.php';
    $config=is_file($path) ? require $path : [];
    return is_array($config) ? $config : [];
}
function naStoreEnabled(array $config): bool {
    return ($config['store_test_enabled']??false)===true
        && is_string($config['secret_key']??null) && str_starts_with($config['secret_key'],'test_')
        && preg_match('/^[0-9]+$/D',(string)($config['shop_id']??''))===1;
}
function naCartResolve(array $inputs,bool $club,callable $owns,array $ready=[],?callable $readyCheck=null): array {
    if (!array_is_list($inputs) || count($inputs)<1 || count($inputs)>20)
        throw new InvalidArgumentException('INVALID_CART');
    $items=[];$seen=[];$total=0;$hasClub=false;$blocked=false;
    foreach ($inputs as $input) {
        if (!is_array($input)) throw new InvalidArgumentException('INVALID_CART_ITEM');
        $quote=naCatalogResolve($input,$club);
        $key=$quote['product_code'].'|'.$quote['resource_id'];
        if (isset($seen[$key])) throw new InvalidArgumentException('DUPLICATE_CART_ITEM');
        $seen[$key]=true;
        $quote['access_active']=$owns($quote['product_code'],$quote['resource_id']) || $quote['member_included'];
        // Readiness requires a reviewed fulfillment adapter; a client flag never makes an item sellable.
        $quote['sale_ready']=$quote['product_code']!=='moment_question'
            && is_int($quote['price_kopeks']) && $quote['price_kopeks']>0
            && ($readyCheck ? $readyCheck($quote) : (in_array($quote['product_code'],$ready,true) && $quote['availability']==='FULFILLMENT_NOT_CONNECTED'));
        if (($quote['access_active'] && $quote['kind']!=='subscription') || !$quote['sale_ready']) $blocked=true;
        $total+=(int)$quote['price_kopeks'];
        $hasClub=$hasClub || $quote['product_code']==='club_month';
        $items[]=$quote;
    }
    return ['items'=>$items,'total_kopeks'=>$total,'currency'=>'RUB','club_active'=>$club,
        'club_activation_required'=>$hasClub && !$club,
        'discount_note'=>$hasClub && !$club ? 'Сначала оплатите и активируйте клуб. Затем цены оставшихся товаров пересчитаются.' : null,
        'fulfillment_ready'=>!$blocked];
}
function naStoreSchema(PDO $db): void {
    naSubscriptionSchema($db);
    // Only additive tables. The existing numi_orders and numi_entitlements stay canonical.
    $db->exec("CREATE TABLE IF NOT EXISTS numi_checkouts (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      cart_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      amount_kopeks INT UNSIGNED NOT NULL, provider_payment_id VARCHAR(191) NULL,
      confirmation_url TEXT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_checkout_request(account_id,request_key),
      UNIQUE KEY uq_checkout_payment(provider_payment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS numi_checkout_items (
      checkout_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      KEY ix_checkout_items(checkout_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function naStoreProvider(array $config,string $method,string $path,?array $body=null,?string $key=null): array {
    if (!naStoreEnabled($config)) throw new RuntimeException('PAYMENTS_DISABLED');
    if (!preg_match('~^/(?:payments(?:/[a-zA-Z0-9-]+)?|refunds/[a-zA-Z0-9-]+)$~D',$path))
        throw new InvalidArgumentException('INVALID_PROVIDER_PATH');
    $curl=curl_init('https://api.yookassa.ru/v3'.$path);
    $headers=['Content-Type: application/json'];
    if ($key!==null) $headers[]='Idempotence-Key: '.$key;
    curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,
        CURLOPT_FOLLOWLOCATION=>false,CURLOPT_USERPWD=>$config['shop_id'].':'.$config['secret_key'],
        CURLOPT_HTTPHEADER=>$headers,CURLOPT_CUSTOMREQUEST=>$method]);
    if ($body!==null) curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($body,JSON_THROW_ON_ERROR));
    $raw=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);
    if (!is_string($raw)||$status<200||$status>=300) throw new RuntimeException('PAYMENT_NETWORK_ERROR');
    $data=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
    if (!is_array($data)) throw new RuntimeException('INVALID_PROVIDER_RESPONSE');
    return $data;
}
function naStoreAmount(int $kopeks): string { return intdiv($kopeks,100).'.'.str_pad((string)($kopeks%100),2,'0',STR_PAD_LEFT); }
function naStoreVerifyPayment(array $payment,array $checkout): void {
    if (($payment['test']??false)!==true || ($payment['id']??'')!==$checkout['provider_payment_id']
        || ($payment['amount']['currency']??'')!=='RUB'
        || ($payment['amount']['value']??'')!==naStoreAmount((int)$checkout['amount_kopeks'])
        || ($payment['metadata']['numi_checkout']??'')!==$checkout['id'])
        throw new RuntimeException('PAYMENT_VERIFICATION_FAILED');
}
function naStoreSync(PDO $db,array $config,array $checkout): void {
    if (!$checkout['provider_payment_id']) return;
    // Never trust a browser/webhook status. Fetch the payment from the provider every time.
    $payment=naStoreProvider($config,'GET','/payments/'.$checkout['provider_payment_id']);
    naStoreVerifyPayment($payment,$checkout);
    $url=$payment['confirmation']['confirmation_url']??null;
    if(is_string($url)&&parse_url($url,PHP_URL_SCHEME)==='https'&&in_array(parse_url($url,PHP_URL_HOST),['yoomoney.ru','yookassa.ru'],true))
        $db->prepare('UPDATE numi_checkouts SET confirmation_url=? WHERE id=?')->execute([$url,$checkout['id']]);
    naStoreApply($db,$checkout,$payment);
}
function naStoreExpiry(string $code,DateTimeImmutable $now): ?string {
    if ($code==='school_week') return $now->modify('+7 days')->format('Y-m-d H:i:s');
    if ($code!=='club_month') return null;
    $next=$now->modify('first day of next month');
    return $next->setDate((int)$next->format('Y'),(int)$next->format('m'),min((int)$now->format('d'),(int)$next->format('t')))->format('Y-m-d H:i:s');
}
function naStoreApply(PDO $db,array $checkout,array $payment): void {
    naStoreVerifyPayment($payment,$checkout);
    $state=$payment['status']??'';
    if (!in_array($state,['succeeded','canceled'],true)) return;
    $db->beginTransaction();
    try {
        // Serialize settlement of the whole basket, including retries from different tabs.
        $accountLock=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');$accountLock->execute([$checkout['account_id']]);
        $lock=$db->prepare('SELECT id FROM numi_checkouts WHERE id=? FOR UPDATE');$lock->execute([$checkout['id']]);
        $orders=$db->prepare('SELECT o.* FROM numi_orders o JOIN numi_checkout_items i ON i.order_id=o.id WHERE i.checkout_id=? ORDER BY o.id FOR UPDATE');
        $orders->execute([$checkout['id']]);
        $refund=$payment['refunded_amount']??['value'=>'0.00','currency'=>'RUB'];
        if (!is_string($refund['value']??null) || !preg_match('/^[0-9]+\.[0-9]{2}$/D',$refund['value']) || ($refund['currency']??'')!=='RUB')
            throw new RuntimeException('INVALID_REFUND_AMOUNT');
        [$rub,$kop]=explode('.',$refund['value']);$refunded=(int)$rub*100+(int)$kop;
        if ($refunded>(int)$checkout['amount_kopeks']) throw new RuntimeException('INVALID_REFUND_AMOUNT');
        foreach ($orders->fetchAll() as $order) {
            if ($refunded>0 && $state==='succeeded') {
                $db->prepare("UPDATE numi_orders SET status='refunded' WHERE id=?")->execute([$order['id']]);
                $db->prepare("UPDATE numi_entitlements SET status='revoked' WHERE order_id=?")->execute([$order['id']]);
                if(naSubscriptionCode($order['product_code']))$db->prepare('UPDATE numi_subscription_settings SET auto_renew=0,cancelled_at=UTC_TIMESTAMP() WHERE account_id=? AND product_code=?')->execute([$order['account_id'],$order['product_code']]);
                continue;
            }
            if ($order['status']!=='pending') continue;
            if ($state==='canceled') {
                $db->prepare("UPDATE numi_orders SET status='cancelled' WHERE id=?")->execute([$order['id']]);
                if(naSubscriptionCode($order['product_code']))$db->prepare('UPDATE numi_subscription_settings SET auto_renew=0 WHERE account_id=? AND product_code=?')->execute([$order['account_id'],$order['product_code']]);
                continue;
            }
            if (($payment['paid']??false)!==true) throw new RuntimeException('PAYMENT_NOT_PAID');
            $db->prepare("UPDATE numi_orders SET status='paid',verified_at=UTC_TIMESTAMP() WHERE id=?")->execute([$order['id']]);
            $start=new DateTimeImmutable('now',new DateTimeZone('UTC'));
            if(in_array($order['product_code'],['club_month','school_week'],true)){
                $latest=$db->prepare("SELECT MAX(e.expires_at) FROM numi_entitlements e JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id WHERE e.account_id=? AND e.product_code=? AND e.status='active' AND o.status='paid' AND o.verified_at IS NOT NULL");
                $latest->execute([$order['account_id'],$order['product_code']]);$until=$latest->fetchColumn();
                if($until&&new DateTimeImmutable($until,new DateTimeZone('UTC'))>$start)$start=new DateTimeImmutable($until,new DateTimeZone('UTC'));
            }
            $expires=naStoreExpiry($order['product_code'],$start);
            $db->prepare("INSERT IGNORE INTO numi_entitlements(id,account_id,order_id,product_code,resource_id,status,expires_at) VALUES(?,?,?,?,?,'active',?)")
                ->execute([naUuid(),$order['account_id'],$order['id'],$order['product_code'],$order['resource_id'],$expires]);
            naSubscriptionSettled($db,$checkout,$order,$payment);
        }
        $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack();throw $e; }
}
function naStoreServe(PDO $db,string $action,array $body): never {
    $account=naCurrent($db);$config=naStoreConfig();
    try {
        if ($action==='cart_quote' || $action==='checkout') {
            if (!is_array($body['items']??null)) throw new InvalidArgumentException('INVALID_CART');
            $club=naCatalogHasAccess($db,$account,'club_month','club');
            require_once __DIR__.'/fulfillment.php';
            $quote=naCartResolve($body['items']??[],$club,fn($c,$r)=>naCatalogHasAccess($db,$account,$c,$r),[],function($item){try{naMaterialBuild($item['product_code'],$item['resource_id']);return true;}catch(Throwable $e){return false;}});
            $enabled=naStoreEnabled($config) && $account && (naTestOwner($account)||in_array($account['id'],$config['store_test_account_ids']??[],true));
            $quote['checkout_enabled']=(bool)$enabled && $quote['fulfillment_ready'];
            $quote['authenticated']=$account!==null;
            $quote['recurring_enabled']=($config['store_recurring_test_enabled']??false)===true;
            if ($action==='cart_quote') naReply(200,['ok'=>true]+$quote);
            if (!$account) naReply(401,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
            if (!$quote['checkout_enabled']) naReply(409,['ok'=>false,'error'=>'CHECKOUT_NOT_READY','quote'=>$quote]);
            naStoreCheckout($db,$account,$config,$body,$quote);
        }
        if (!$account) naReply(401,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
        if ($action==='cancel_renewal') {naSubscriptionCancel($db,$account,$body['product_code']??null);naReply(200,['ok'=>true,'auto_renew'=>false]);}
        if ($action==='order_history') {
            naStoreSchema($db);
            $q=$db->prepare('SELECT o.id,o.product_code,o.resource_id,o.amount_kopeks,o.currency,o.status,o.verified_at,o.created_at,e.id AS entitlement_id,e.expires_at,e.status AS entitlement_status,i.checkout_id FROM numi_orders o LEFT JOIN numi_entitlements e ON e.order_id=o.id AND e.account_id=o.account_id LEFT JOIN numi_checkout_items i ON i.order_id=o.id WHERE o.account_id=? ORDER BY o.created_at DESC LIMIT 200');$q->execute([$account['id']]);
            naReply(200,['ok'=>true,'orders'=>$q->fetchAll(),'subscriptions'=>naSubscriptionList($db,$account,$config)]);
        }
        if ($action==='order_status') {
            naStoreSchema($db);
            $q=$db->prepare('SELECT * FROM numi_checkouts WHERE id=? AND account_id=?');$q->execute([$body['checkout_id']??'',$account['id']]);$checkout=$q->fetch();
            if (!$checkout) naReply(404,['ok'=>false,'error'=>'ORDER_NOT_FOUND']);
            naStoreSync($db,$config,$checkout);
            $q->execute([$body['checkout_id']??'',$account['id']]);$checkout=$q->fetch();
            $items=$db->prepare('SELECT o.product_code,o.resource_id,o.status FROM numi_orders o JOIN numi_checkout_items i ON i.order_id=o.id WHERE i.checkout_id=? AND o.account_id=?');$items->execute([$checkout['id'],$account['id']]);
            naReply(200,['ok'=>true,'checkout_id'=>$checkout['id'],'items'=>$items->fetchAll(),'confirmation_url'=>$checkout['confirmation_url']]);
        }
        naReply(400,['ok'=>false,'error'=>'UNKNOWN_ACTION']);
    } catch (InvalidArgumentException $e) { naReply(400,['ok'=>false,'error'=>$e->getMessage()]); }
}
function naStorePrepareCheckout(PDO $db,array $account,array $body,array $quote): array {
    $key=$body['request_key']??'';
    if (!is_string($key)||!preg_match('/^[a-zA-Z0-9-]{16,64}$/D',$key)) throw new InvalidArgumentException('INVALID_REQUEST_KEY');
    naStoreSchema($db);
    $consent=($body['auto_renew_consent']??false)===true;
    $hash=hash('sha256',json_encode([$quote['items'],$consent],JSON_THROW_ON_ERROR));
    $db->beginTransaction();
    try {
        $lock=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');$lock->execute([$account['id']]);
        $find=$db->prepare('SELECT * FROM numi_checkouts WHERE account_id=? AND request_key=?');$find->execute([$account['id'],$key]);$checkout=$find->fetch();
        if ($checkout && !hash_equals($checkout['cart_hash'],$hash)) throw new InvalidArgumentException('REQUEST_KEY_REUSED');
        if (!$checkout) {
            foreach ($quote['items'] as $item) {
                // An existing paid access or unresolved payment must not be sold twice.
                $pending=$db->prepare("SELECT id FROM numi_orders WHERE account_id=? AND product_code=? AND resource_id=? AND status='pending' LIMIT 1");
                $pending->execute([$account['id'],$item['product_code'],$item['resource_id']]);
                if ($pending->fetchColumn() || ($item['kind']!=='subscription' && naCatalogHasAccess($db,$account,$item['product_code'],$item['resource_id']))) throw new InvalidArgumentException('ITEM_ALREADY_ORDERED');
            }
            $id=naUuid();
            $db->prepare('INSERT INTO numi_checkouts(id,account_id,request_key,cart_hash,amount_kopeks) VALUES(?,?,?,?,?)')->execute([$id,$account['id'],$key,$hash,$quote['total_kopeks']]);
            foreach ($quote['items'] as $item) {
                if($consent&&naSubscriptionCode($item['product_code'])){
                    $db->prepare("INSERT INTO numi_checkout_consents(checkout_id,product_code,consent_at,version) VALUES(?,?,UTC_TIMESTAMP(),'recurring-20261106')")->execute([$id,$item['product_code']]);
                    $db->prepare('INSERT IGNORE INTO numi_subscription_settings(account_id,product_code) VALUES(?,?)')->execute([$account['id'],$item['product_code']]);
                }
                $order=naUuid();
                $db->prepare("INSERT INTO numi_orders(id,account_id,product_code,resource_id,amount_kopeks,provider) VALUES(?,?,?,?,?,'sandbox')")->execute([$order,$account['id'],$item['product_code'],$item['resource_id'],$item['price_kopeks']]);
                $db->prepare('INSERT INTO numi_checkout_items(checkout_id,order_id) VALUES(?,?)')->execute([$id,$order]);
            }
            $checkout=['id'=>$id,'account_id'=>$account['id'],'amount_kopeks'=>$quote['total_kopeks'],'provider_payment_id'=>null,'confirmation_url'=>null,'created_at'=>gmdate('Y-m-d H:i:s')];
        }
        $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack();throw $e; }
    return $checkout;
}
function naStoreCheckout(PDO $db,array $account,array $config,array $body,array $quote): never {
    if(($body['auto_renew_consent']??false)===true&&($config['store_recurring_test_enabled']??false)!==true)throw new InvalidArgumentException('RECURRING_DISABLED');
    $checkout=naStorePrepareCheckout($db,$account,$body,$quote);
    // Do not retry creation after the provider's 24-hour idempotency window.
    if (!$checkout['provider_payment_id'] && strtotime($checkout['created_at'].' UTC')<time()-23*3600)
        naReply(409,['ok'=>false,'error'=>'PAYMENT_RECONCILIATION_REQUIRED']);
    if (!$checkout['provider_payment_id']) {
        $payment=naStoreProvider($config,'POST','/payments',[
            'amount'=>['value'=>naStoreAmount((int)$checkout['amount_kopeks']),'currency'=>'RUB'],
            'save_payment_method'=>($body['auto_renew_consent']??false)===true,
            'capture'=>true,'confirmation'=>['type'=>'redirect','return_url'=>naPublicOrigin().'/?checkout='.$checkout['id']],
            'description'=>'Тестовый заказ Нумерология онлайн','metadata'=>['numi_checkout'=>$checkout['id']],
        ],$checkout['id']);
        $checkout['provider_payment_id']=$payment['id']??'';naStoreVerifyPayment($payment,$checkout);
        // Save the provider identity even if the payment finished during a lost response.
        $db->prepare('UPDATE numi_checkouts SET provider_payment_id=? WHERE id=? AND provider_payment_id IS NULL')->execute([$checkout['provider_payment_id'],$checkout['id']]);
        if (in_array($payment['status']??'',['succeeded','canceled'],true)) {
            naStoreApply($db,$checkout,$payment);
            naReply(200,['ok'=>true,'test'=>true,'completed'=>true,'checkout_id'=>$checkout['id']]);
        }
        $url=$payment['confirmation']['confirmation_url']??'';
        $host=parse_url($url,PHP_URL_HOST);
        if (parse_url($url,PHP_URL_SCHEME)!=='https'||!in_array($host,['yoomoney.ru','yookassa.ru'],true)) throw new RuntimeException('INVALID_CONFIRMATION_URL');
        $db->prepare('UPDATE numi_checkouts SET provider_payment_id=?,confirmation_url=? WHERE id=?')->execute([$checkout['provider_payment_id'],$url,$checkout['id']]);
        $checkout['confirmation_url']=$url;
    }
    if (!$checkout['confirmation_url']) {
        naStoreSync($db,$config,$checkout);
        naReply(200,['ok'=>true,'test'=>true,'completed'=>true,'checkout_id'=>$checkout['id']]);
    }
    naReply(200,['ok'=>true,'test'=>true,'checkout_id'=>$checkout['id'],'confirmation_url'=>$checkout['confirmation_url']]);
}

/** Notification payload is only a lookup hint. Provider GET is the authority. */
function naStoreNotification(PDO $db): never {
    if (($_SERVER['REQUEST_METHOD']??'')!=='POST') naReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    $raw=file_get_contents('php://input',false,null,0,8193);
    if (!is_string($raw)||strlen($raw)>8192) naReply(400,['ok'=>false,'error'=>'INVALID_NOTIFICATION']);
    $body=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
    $event=$body['event']??'';$id=$body['object']['id']??'';
    if (!in_array($event,['payment.succeeded','payment.canceled','refund.succeeded'],true)
        || !is_string($id)||!preg_match('/^[a-zA-Z0-9-]{1,64}$/D',$id)) naReply(400,['ok'=>false,'error'=>'INVALID_NOTIFICATION']);
    $config=naStoreConfig();
    if (!naStoreEnabled($config)) naReply(409,['ok'=>false,'error'=>'PAYMENTS_DISABLED']);
    naStoreSchema($db);
    if ($event==='refund.succeeded') {
        $refund=naStoreProvider($config,'GET','/refunds/'.$id);
        if (($refund['status']??'')!=='succeeded') naReply(200,['ok'=>true]);
        $id=$refund['payment_id']??'';
    }
    $q=$db->prepare('SELECT * FROM numi_checkouts WHERE provider_payment_id=?');$q->execute([$id]);$checkout=$q->fetch();
    if ($checkout) naStoreSync($db,$config,$checkout);
    naReply(200,['ok'=>true]);
}
