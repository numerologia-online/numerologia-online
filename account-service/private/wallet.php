<?php
declare(strict_types=1);

/**
 * Sandbox wallet for the existing Numi account and paid-material system.
 * Not a separate shop; never enables real funds or bypasses material readiness.
 * Activate ONLY for explicitly allowlisted sandbox accounts.
 */
require_once __DIR__.'/store.php';

function naWalletAllowed(?array $account, array $config): bool {
    return $account !== null
        && naStoreEnabled($config)
        && ($config['store_wallet_test_enabled'] ?? false) === true
        && naTestOwner($account); // Sandbox pilot: verified owner ONLY, never store buyer allowlist.
}

function naWalletSchema(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS numi_wallet_balances (
        account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
        kopeks BIGINT UNSIGNED NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_numi_wallet_balance_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS numi_wallet_topups (
        id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
        account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        kopeks INT UNSIGNED NOT NULL,
        provider_payment_id VARCHAR(191) NULL,
        confirmation_url TEXT NULL,
        status ENUM('pending','credited','canceled') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_wallet_topup_request(account_id,request_key),
        UNIQUE KEY uq_wallet_topup_payment(provider_payment_id),
        CONSTRAINT fk_numi_wallet_topup_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS numi_wallet_spends (
        id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
        account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        product_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        resource_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        kopeks INT UNSIGNED NOT NULL,
        order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        entitlement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_wallet_spend_request(account_id,request_key),
        UNIQUE KEY uq_wallet_spend_order(order_id),
        UNIQUE KEY uq_wallet_spend_entitlement(entitlement_id),
        CONSTRAINT fk_numi_wallet_spend_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS numi_wallet_ledger (
        id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
        account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        kind ENUM('topup','purchase','refund') NOT NULL,
        reference_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        delta_kopeks BIGINT NOT NULL,
        balance_after_kopeks BIGINT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_wallet_event(kind,reference_id),
        KEY ix_wallet_ledger_account(account_id,created_at),
        CONSTRAINT fk_numi_wallet_ledger_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function naWalletKey(mixed $key): string {
    if (!is_string($key) || preg_match('/^[A-Za-z0-9-]{16,64}$/D',$key)!==1)
        throw new InvalidArgumentException('INVALID_REQUEST_KEY');
    return $key;
}

function naWalletBalance(PDO $db, string $accountId, bool $lock=false): int {
    $db->prepare('INSERT IGNORE INTO numi_wallet_balances(account_id) VALUES(?)')->execute([$accountId]);
    $q=$db->prepare('SELECT kopeks FROM numi_wallet_balances WHERE account_id=?'.($lock?' FOR UPDATE':''));
    $q->execute([$accountId]);
    return (int)$q->fetchColumn();
}

function naWalletStatus(PDO $db,array $account): never {
    naWalletSchema($db);
    $balance=naWalletBalance($db,$account['id']);
    $q=$db->prepare('SELECT kind,delta_kopeks,balance_after_kopeks,created_at FROM numi_wallet_ledger WHERE account_id=? ORDER BY created_at DESC,id DESC LIMIT 30');
    $q->execute([$account['id']]);
    naReply(200,['ok'=>true,'test'=>true,'currency'=>'RUB','balance_kopeks'=>$balance,'operations'=>$q->fetchAll()]);
}

function naWalletTopup(PDO $db,array $account,array $config,array $body): never {
    $amount=$body['amount_rub']??null;
    if (!is_int($amount)||$amount<100||$amount>5000) throw new InvalidArgumentException('INVALID_TOPUP_AMOUNT');
    $key=naWalletKey($body['request_key']??null);
    naWalletSchema($db);
    $q=$db->prepare('SELECT * FROM numi_wallet_topups WHERE account_id=? AND request_key=?');
    $q->execute([$account['id'],$key]);$topup=$q->fetch();
    if ($topup && (int)$topup['kopeks']!==$amount*100) throw new InvalidArgumentException('REQUEST_KEY_REUSED');
    if (!$topup) {
        $id=naUuid();
        try {
            $db->prepare('INSERT INTO numi_wallet_topups(id,account_id,request_key,kopeks) VALUES(?,?,?,?)')
                ->execute([$id,$account['id'],$key,$amount*100]);
        } catch (PDOException $e) {
            if ((string)$e->getCode()!=='23000') throw $e;
        }
        $q->execute([$account['id'],$key]);$topup=$q->fetch();
        if (!$topup || (int)$topup['kopeks']!==$amount*100) throw new RuntimeException('TOPUP_CONFLICT');
    }
    if ($topup['status']==='credited') naReply(200,['ok'=>true,'test'=>true,'credited'=>true,'topup_id'=>$topup['id']]);
    if ($topup['status']==='canceled') naReply(409,['ok'=>false,'error'=>'TOPUP_CANCELED']);
    if (!$topup['provider_payment_id']) {
        if (strtotime($topup['created_at'].' UTC')<time()-23*3600)
            naReply(409,['ok'=>false,'error'=>'TOPUP_RECONCILIATION_REQUIRED']);
        $payment=naStoreProvider($config,'POST','/payments',[
            'amount'=>['value'=>naStoreAmount((int)$topup['kopeks']),'currency'=>'RUB'],
            'capture'=>true,
            'confirmation'=>['type'=>'redirect','return_url'=>naPublicOrigin().'/?wallet_topup='.$topup['id']],
            'description'=>'Тестовый аванс Нумерология онлайн',
            'metadata'=>['numi_wallet_topup'=>$topup['id']],
        ],$topup['id']);
        naWalletVerifyPayment($payment,$topup);
        $url=$payment['confirmation']['confirmation_url']??null;
        $host=is_string($url)?parse_url($url,PHP_URL_HOST):null;
        if ($url!==null && (parse_url($url,PHP_URL_SCHEME)!=='https'
             || !in_array($host,['yookassa.ru','yoomoney.ru'],true))) throw new RuntimeException('INVALID_CONFIRMATION_URL');
        $db->prepare('UPDATE numi_wallet_topups SET provider_payment_id=?,confirmation_url=? WHERE id=? AND provider_payment_id IS NULL')
            ->execute([$payment['id'],$url,$topup['id']]);
        $q->execute([$account['id'],$key]);$topup=$q->fetch();
        naWalletApplyPayment($db,$topup,$payment);
    }
    naReply(200,['ok'=>true,'test'=>true,'topup_id'=>$topup['id'],
        'confirmation_url'=>$topup['confirmation_url']]);
}

function naWalletVerifyPayment(array $payment,array $topup): void {
    if (($payment['test']??null)!==true
        || !is_string($payment['id']??null)
        || ($topup['provider_payment_id']!==null && $payment['id']!==$topup['provider_payment_id'])
        || ($payment['amount']['currency']??null)!=='RUB'
        || ($payment['amount']['value']??null)!==naStoreAmount((int)$topup['kopeks'])
        || ($payment['metadata']['numi_wallet_topup']??null)!==$topup['id'])
        throw new RuntimeException('WALLET_PAYMENT_VERIFICATION_FAILED');
}

function naWalletApplyPayment(PDO $db,array $topup,array $payment): void {
    naWalletVerifyPayment($payment,$topup);
    $status=$payment['status']??'';
    if (!in_array($status,['succeeded','canceled'],true)) return;
    $db->beginTransaction();
    try {
        $id=$topup['id'];
        $db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE')->execute([$topup['account_id']]);
        $q=$db->prepare('SELECT status FROM numi_wallet_topups WHERE id=? FOR UPDATE');
        $q->execute([$id]);$old=$q->fetchColumn();
        if ($old==='credited'||$old==='canceled'){$db->commit();return;}
        if ($status==='canceled') {
            $db->prepare("UPDATE numi_wallet_topups SET status='canceled' WHERE id=?")->execute([$id]);
        } else {
            if (($payment['paid']??null)!==true || ($payment['refunded_amount']['value']??'0.00')!=='0.00')
                throw new RuntimeException('WALLET_PAYMENT_NOT_SETTLED');
            $balance=naWalletBalance($db,$topup['account_id'],true)+(int)$topup['kopeks'];
            $db->prepare('UPDATE numi_wallet_balances SET kopeks=? WHERE account_id=?')
                ->execute([$balance,$topup['account_id']]);
            $db->prepare("INSERT INTO numi_wallet_ledger(id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks) VALUES(?,?,'topup',?,?,?)")
                ->execute([naUuid(),$topup['account_id'],$id,(int)$topup['kopeks'],$balance]);
            $db->prepare("UPDATE numi_wallet_topups SET status='credited' WHERE id=?")->execute([$id]);
        }
        $db->commit();
    } catch (Throwable $e) {if($db->inTransaction())$db->rollBack();throw $e;}
}

function naWalletSync(PDO $db,array $account,array $config,array $body): never {
    $id=$body['topup_id']??null;
    if (!is_string($id)||preg_match('/^[a-f0-9-]{36}$/iD',$id)!==1)
        throw new InvalidArgumentException('INVALID_TOPUP_ID');
    naWalletSchema($db);
    $q=$db->prepare('SELECT * FROM numi_wallet_topups WHERE id=? AND account_id=?');
    $q->execute([$id,$account['id']]);$topup=$q->fetch();
    if (!$topup) naReply(404,['ok'=>false,'error'=>'TOPUP_NOT_FOUND']);
    if ($topup['provider_payment_id']) {
        $payment=naStoreProvider($config,'GET','/payments/'.$topup['provider_payment_id']);
        naWalletApplyPayment($db,$topup,$payment);
    }
    $q->execute([$id,$account['id']]);$topup=$q->fetch();
    naReply(200,['ok'=>true,'test'=>true,'topup_id'=>$id,'status'=>$topup['status'],
        'balance_kopeks'=>naWalletBalance($db,$account['id'])]);
}

function naWalletBuy(PDO $db,array $account,array $body): never {
    $key=naWalletKey($body['request_key']??null);
    $input=$body['item']??null;
    if (!is_array($input)) throw new InvalidArgumentException('INVALID_ITEM');
    naWalletSchema($db);
    $club=naCatalogHasAccess($db,$account,'club_month','club');
    require_once __DIR__.'/fulfillment.php';
    $quote=naCartResolve([$input],$club,fn($code,$resource)=>naCatalogHasAccess($db,$account,$code,$resource),[],
        function($item){try{naMaterialBuild($item['product_code'],$item['resource_id']);return true;}catch(Throwable $e){return false;}});
    $item=$quote['items'][0];
    if (!$quote['fulfillment_ready'] || $item['kind']!=='question')
        naReply(409,['ok'=>false,'error'=>'ITEM_NOT_READY']);
    $price=(int)$item['price_kopeks'];
    $db->beginTransaction();
    try {
        $db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE')->execute([$account['id']]);
        $q=$db->prepare('SELECT * FROM numi_wallet_spends WHERE account_id=? AND request_key=?');
        $q->execute([$account['id'],$key]);$prior=$q->fetch();
        if ($prior) {
            if ($prior['product_code']!==$item['product_code']||$prior['resource_id']!==$item['resource_id'])
                throw new InvalidArgumentException('REQUEST_KEY_REUSED');
            $db->commit();
            naReply(200,['ok'=>true,'test'=>true,'already_purchased'=>true,
                'entitlement_id'=>$prior['entitlement_id'],'balance_kopeks'=>naWalletBalance($db,$account['id'])]);
        }
        if (naCatalogHasAccess($db,$account,$item['product_code'],$item['resource_id']))
            throw new InvalidArgumentException('ITEM_ALREADY_OWNED');
        $pending=$db->prepare("SELECT 1 FROM numi_orders WHERE account_id=? AND product_code=? AND resource_id=? AND status='pending' LIMIT 1");
        $pending->execute([$account['id'],$item['product_code'],$item['resource_id']]);
        if ($pending->fetchColumn()) throw new InvalidArgumentException('PAYMENT_PENDING');
        $balance=naWalletBalance($db,$account['id'],true);
        if ($balance<$price) { $db->rollBack();naReply(409,['ok'=>false,'error'=>'INSUFFICIENT_BALANCE','balance_kopeks'=>$balance,'required_kopeks'=>$price]); }
        $newBalance=$balance-$price;
        $order=naUuid();$entitlement=naUuid();$spend=naUuid();
        $db->prepare('UPDATE numi_wallet_balances SET kopeks=? WHERE account_id=?')->execute([$newBalance,$account['id']]);
        $db->prepare("INSERT INTO numi_orders(id,account_id,product_code,resource_id,amount_kopeks,provider,status,verified_at)
             VALUES(?,?,?,?,?,'sandbox_wallet','paid',UTC_TIMESTAMP())")
            ->execute([$order,$account['id'],$item['product_code'],$item['resource_id'],$price]);
        $db->prepare("INSERT INTO numi_entitlements(id,account_id,order_id,product_code,resource_id,status) VALUES(?,?,?,?,?,'active')")
            ->execute([$entitlement,$account['id'],$order,$item['product_code'],$item['resource_id']]);
        $db->prepare('INSERT INTO numi_wallet_spends(id,account_id,request_key,product_code,resource_id,kopeks,order_id,entitlement_id) VALUES(?,?,?,?,?,?,?,?)')
            ->execute([$spend,$account['id'],$key,$item['product_code'],$item['resource_id'],$price,$order,$entitlement]);
        $db->prepare("INSERT INTO numi_wallet_ledger(id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks) VALUES(?,?,'purchase',?,?,?)")
            ->execute([naUuid(),$account['id'],$spend,-$price,$newBalance]);
        $db->commit();
        naReply(200,['ok'=>true,'test'=>true,'entitlement_id'=>$entitlement,'balance_kopeks'=>$newBalance]);
    } catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}

function naWalletServe(PDO $db,string $action,array $body): never {
    $account=naCurrent($db);$config=naStoreConfig();
    if (!$account) naReply(401,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
    if (!naWalletAllowed($account,$config)) naReply(403,['ok'=>false,'error'=>'WALLET_TEST_DISABLED']);
    try {
        if ($action==='wallet_status') naWalletStatus($db,$account);
        if ($action==='wallet_topup') naWalletTopup($db,$account,$config,$body);
        if ($action==='wallet_sync') naWalletSync($db,$account,$config,$body);
        if ($action==='wallet_buy') naWalletBuy($db,$account,$body);
        naReply(400,['ok'=>false,'error'=>'UNKNOWN_ACTION']);
    } catch(InvalidArgumentException $e){naReply(400,['ok'=>false,'error'=>$e->getMessage()]);}
}
