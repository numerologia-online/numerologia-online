<?php
declare(strict_types=1);
/**
 * PRODUCTION wallet CORE, deliberately NOT connected to public HTTP routes.
 * Existing numi_wallet_* tables hold TEST rubles ONLY. Never migrate/copy them.
 * Activate only after fiscal receipts, refund workflow and payment reconciliation
 * have been reviewed. Do not use this file to create a live payment yet.
 *
 * DB schema migration is a separate explicit CLI operation, never inside a debit.
 * All monetary amounts are integer kopeks. No browser-supplied prices.
 */
require_once __DIR__.'/wallet.php';

/** Never load live credentials from the existing TEST provider configuration. */
function naRealWalletConfig(): array {
    $path=dirname(__DIR__).'/numi-wallet-live/config.local.php';
    if(!is_file($path))return [];
    $config=require $path;
    return is_array($config)?$config:[];
}

function naRealWalletGate(array $config): bool {
    return ($config['wallet_mode']??null)==='live'
        && ($config['real_wallet_enabled']??null)===true
        && ($config['fiscalization_verified']??null)===true
        && ($config['refunds_verified']??null)===true
        && ($config['advance_offset_receipts_verified']??null)===true
        && ($config['offset_receipt_worker_verified']??null)===true
        && ($config['launch_approved']??null)===true
        && ($config['provider_test_mode']??null)===false
        && preg_match('/^[0-9]+$/D',(string)($config['shop_id']??''))===1
        && is_string($config['secret_key']??null)
        && preg_match('/^live_[A-Za-z0-9_-]{12,480}$/D',$config['secret_key'])===1;
}
function naRealWalletRequireLive(array $config): void {
    if(!naRealWalletGate($config))throw new RuntimeException('REAL_PAYMENTS_DISABLED');
}
function naRealWalletSchema(PDO $db): void {
    // The protected migration prepares subscription preferences as well.
    // No customer payment route ever invokes this DDL.
    naSubscriptionSchema($db);
    // Additive new tables. No historical sandbox balances or ledger are copied.
    $db->exec("CREATE TABLE IF NOT EXISTS numi_real_wallet_balances (
      account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      kopeks BIGINT UNSIGNED NOT NULL DEFAULT 0,
      blocked_at DATETIME NULL,
      block_reason VARCHAR(80) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_real_wallet_balance_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS numi_real_wallet_topups (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      kopeks INT UNSIGNED NOT NULL,
      receipt_email VARCHAR(254) NULL,
      provider_payment_id VARCHAR(191) NULL,
      payment_method ENUM('bank_card','sbp') NULL,
      provider_request_started_at DATETIME NULL,
      confirmation_url VARCHAR(2048) NULL,
      status ENUM('pending','credited','canceled','review') NOT NULL DEFAULT 'pending',
      credited_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_real_topup_request(account_id,request_key),
      UNIQUE KEY uq_real_topup_provider(provider_payment_id),
      KEY ix_real_topup_account(account_id,status),
      CONSTRAINT fk_real_topup_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    // Additive migration for an existing live wallet. Only the protected migration
    // endpoint invokes DDL; the payment endpoint never creates or alters tables.
    $column=$db->query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='numi_real_wallet_topups'
          AND COLUMN_NAME='receipt_email'")->fetchColumn();
    if((int)$column===0)
        $db->exec("ALTER TABLE numi_real_wallet_topups
            ADD COLUMN receipt_email VARCHAR(254) NULL AFTER kopeks");
    $db->exec("CREATE TABLE IF NOT EXISTS numi_real_wallet_spends (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      product_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      resource_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      kopeks INT UNSIGNED NOT NULL,
      order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      entitlement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_real_spend_request(account_id,request_key),
      UNIQUE KEY uq_real_spend_order(order_id),
      UNIQUE KEY uq_real_spend_entitlement(entitlement_id),
      CONSTRAINT fk_real_spend_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS numi_real_wallet_ledger (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      kind ENUM('topup','purchase','refund','transfer_in','transfer_out') NOT NULL,
      reference_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      delta_kopeks BIGINT NOT NULL,
      balance_after_kopeks BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_real_ledger_event(kind,reference_id),
      KEY ix_real_ledger_account(account_id,created_at),
      CONSTRAINT fk_real_ledger_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS numi_real_wallet_merges (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      source_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      destination_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      kopeks BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_real_merge_source(source_account_id),
      CONSTRAINT fk_real_merge_source FOREIGN KEY(source_account_id) REFERENCES numi_accounts(id),
      CONSTRAINT fk_real_merge_destination FOREIGN KEY(destination_account_id) REFERENCES numi_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    // One purchase must have one known verified advance source before any debit.
    // The current conservative version only permits a single-source purchase;
    // multi-source offset receipts require separately reviewed allocation logic.
    $db->exec("CREATE TABLE IF NOT EXISTS numi_real_wallet_receipt_sources (
      spend_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      topup_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      kopeks BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY ix_real_receipt_source_topup(topup_id),
      CONSTRAINT fk_real_receipt_source_spend FOREIGN KEY(spend_id)
        REFERENCES numi_real_wallet_spends(id),
      CONSTRAINT fk_real_receipt_source_topup FOREIGN KEY(topup_id)
        REFERENCES numi_real_wallet_topups(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    // Durable fiscal outbox: no wallet use without an auditable receipt event.
    // The offset receipt worker is intentionally NOT enabled before the cash-register review.
    $db->exec("CREATE TABLE IF NOT EXISTS numi_real_wallet_fiscal_events (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      kind ENUM('advance_in','advance_offset','refund') NOT NULL,
      reference_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      kopeks BIGINT UNSIGNED NOT NULL,
      status ENUM('pending','verified','failed') NOT NULL DEFAULT 'pending',
      provider_receipt_id VARCHAR(191) NULL,
      attempts INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_real_fiscal_event(kind,reference_id),
      UNIQUE KEY uq_real_provider_receipt(provider_receipt_id),
      KEY ix_real_fiscal_pending(status,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS numi_real_wallet_refund_cases (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      topup_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
      spend_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
      kopeks BIGINT UNSIGNED NOT NULL,
      status ENUM('review','approved','rejected','completed') NOT NULL DEFAULT 'review',
      provider_refund_id VARCHAR(191) NULL,
      provider_request_started_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_real_refund_provider(provider_refund_id),
      CONSTRAINT fk_real_refund_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function naRealWalletBalance(PDO $db,string $accountId,bool $lock=false): int {
    $db->prepare('INSERT IGNORE INTO numi_real_wallet_balances(account_id) VALUES(?)')->execute([$accountId]);
    $q=$db->prepare('SELECT kopeks FROM numi_real_wallet_balances WHERE account_id=?'.($lock?' FOR UPDATE':''));
    $q->execute([$accountId]);
    $value=$q->fetchColumn();
    if($value===false)throw new RuntimeException('REAL_WALLET_ACCOUNT_NOT_FOUND');
    return (int)$value;
}
function naRealWalletAssertOpen(PDO $db,string $accountId): void {
    $q=$db->prepare('SELECT blocked_at FROM numi_real_wallet_balances WHERE account_id=? FOR UPDATE');
    $q->execute([$accountId]);
    if($q->fetchColumn()!==null)throw new RuntimeException('REAL_WALLET_FROZEN');
}
function naRealWalletInvariant(PDO $db,string $accountId): void {
    $balance=naRealWalletBalance($db,$accountId);
    $q=$db->prepare('SELECT COALESCE(SUM(delta_kopeks),0) FROM numi_real_wallet_ledger WHERE account_id=?');
    $q->execute([$accountId]);
    if((int)$q->fetchColumn()!==$balance)throw new RuntimeException('REAL_WALLET_LEDGER_MISMATCH');
}
function naRealWalletHasAccess(PDO $db,array $account,string $code,string $resource): bool {
    // Sandbox payments, including previous club subscriptions, NEVER count as real.
    $q=$db->prepare("SELECT 1 FROM numi_entitlements e
        JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id
        WHERE e.account_id=? AND e.product_code=? AND e.resource_id=?
        AND e.status='active' AND (e.expires_at IS NULL OR e.expires_at>UTC_TIMESTAMP())
        AND o.status='paid' AND o.verified_at IS NOT NULL AND o.provider='real_wallet'
        LIMIT 1");
    $q->execute([$account['id'],$code,$resource]);
    return (bool)$q->fetchColumn();
}
function naRealWalletStatus(PDO $db,array $account): array {
    $q=$db->prepare('SELECT kind,delta_kopeks,balance_after_kopeks,created_at FROM numi_real_wallet_ledger WHERE account_id=? ORDER BY created_at DESC,id DESC LIMIT 30');
    $q->execute([$account['id']]);
    return ['ok'=>true,'currency'=>'RUB','test'=>false,
        'balance_kopeks'=>naRealWalletBalance($db,$account['id']),
        'club_active'=>naRealWalletHasAccess($db,$account,'club_month','club'),
        'operations'=>$q->fetchAll()];
}
/**
 * Receipt email is collected at checkout, independent of account registration.
 * Preserve the same normalized contact for the original advance and offsets.
 */
function naRealWalletReceiptEmail(mixed $value): string {
    if(!is_string($value))throw new InvalidArgumentException('REAL_FISCAL_CONTACT_REQUIRED');
    $email=strtolower(trim($value));
    if($email===''||strlen($email)>254
       ||filter_var($email,FILTER_VALIDATE_EMAIL)===false)
        throw new InvalidArgumentException('REAL_FISCAL_CONTACT_REQUIRED');
    return $email;
}
function naRealWalletTopupIntent(PDO $db,array $account,array $config,int $rub,string $key,mixed $receiptEmail): array {
    naRealWalletRequireLive($config);
    if($rub<1 || $rub>100000)throw new InvalidArgumentException('INVALID_TOPUP_AMOUNT');
    $key=naWalletKey($key);
    $receiptEmail=naRealWalletReceiptEmail($receiptEmail);
    // Expects schema already installed by CLI. No implicit DDL.
    naRealWalletBalance($db,$account['id']);
    $q=$db->prepare('SELECT id,kopeks,status,receipt_email FROM numi_real_wallet_topups WHERE account_id=? AND request_key=?');
    $q->execute([$account['id'],$key]);$row=$q->fetch();
    if(!$row){
        $id=naUuid();
        try{
            $db->prepare('INSERT INTO numi_real_wallet_topups(id,account_id,request_key,kopeks,receipt_email) VALUES(?,?,?,?,?)')
                ->execute([$id,$account['id'],$key,$rub*100,$receiptEmail]);
        }catch(PDOException $e){if((string)$e->getCode()!=='23000')throw $e;}
        $q->execute([$account['id'],$key]);$row=$q->fetch();
    }
    if(!$row || (int)$row['kopeks']!==$rub*100)throw new RuntimeException('REAL_TOPUP_KEY_CONFLICT');
    if($row['receipt_email']!==$receiptEmail)
        throw new InvalidArgumentException('REAL_FISCAL_CONTACT_MISMATCH');
    return ['topup_id'=>$row['id'],'status'=>$row['status'],'amount_kopeks'=>(int)$row['kopeks']];
}
function naRealWalletPaymentVerify(array $payment,array $topup,array $config): void {
    naRealWalletRequireLive($config);
    if(($payment['test']??null)!==false
        || !is_string($payment['id']??null)
        || preg_match('/^[a-zA-Z0-9-]{1,191}$/D',$payment['id'])!==1
        || ($topup['provider_payment_id']!==null && $payment['id']!==$topup['provider_payment_id'])
        || ($payment['amount']['currency']??null)!=='RUB'
        || ($payment['amount']['value']??null)!==naStoreAmount((int)$topup['kopeks'])
        || ($payment['metadata']['numi_real_wallet_topup']??null)!==$topup['id']
        || (string)($payment['recipient']['account_id']??'')!==(string)$config['shop_id'])
        throw new RuntimeException('REAL_PROVIDER_PAYMENT_MISMATCH');
}
/**
 * SERVER-INTERNAL ONLY. Call after a fresh GET /payments/{id} with authenticated
 * LIVE shop credentials; NEVER with browser/webhook JSON or a sandbox response.
 * A captured payment without confirmed fiscal registration remains uncredited.
 */
function naRealWalletApplyVerifiedPayment(PDO $db,array $topup,array $payment,array $config): string {
    naRealWalletPaymentVerify($payment,$topup,$config);
    $state=$payment['status']??'';
    if(!in_array($state,['succeeded','canceled'],true))return 'pending';
    $accountId=$topup['account_id'];
    $db->beginTransaction();
    try{
        $q=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');
        $q->execute([$accountId]);if(!$q->fetchColumn())throw new RuntimeException('ACCOUNT_NOT_FOUND');
        $q=$db->prepare('SELECT * FROM numi_real_wallet_topups WHERE id=? AND account_id=? FOR UPDATE');
        $q->execute([$topup['id'],$accountId]);$saved=$q->fetch();
        if(!$saved)throw new RuntimeException('REAL_TOPUP_NOT_FOUND');
        naRealWalletPaymentVerify($payment,$saved,$config);
        if($saved['provider_payment_id']===null)
            throw new RuntimeException('PROVIDER_REFERENCE_NOT_ATTACHED');
        $balance=naRealWalletBalance($db,$accountId,true);
        $refunded=$payment['refunded_amount']['value']??'0.00';
        if($refunded!=='0.00'){
            // An outside refund of loaded funds can make the wallet insolvent.
            // Freeze for manual financial reconciliation: do not auto debit/credit.
            $db->prepare("UPDATE numi_real_wallet_balances SET blocked_at=COALESCE(blocked_at,UTC_TIMESTAMP()),block_reason='PROVIDER_REFUND_REVIEW' WHERE account_id=?")
                ->execute([$accountId]);
            $db->prepare("UPDATE numi_real_wallet_topups SET status='review' WHERE id=?")
                ->execute([$saved['id']]);
            $db->commit();return 'review';
        }
        if($saved['status']==='credited'){$db->commit();return 'credited';}
        if($saved['status']==='review'){$db->commit();return 'review';}
        if($saved['status']==='canceled'){$db->commit();return 'canceled';}
        if($state==='canceled'){
            $db->prepare("UPDATE numi_real_wallet_topups SET status='canceled' WHERE id=?")
                ->execute([$saved['id']]);
            $db->commit();return 'canceled';
        }
        if(($payment['paid']??null)!==true)
            throw new RuntimeException('REAL_PAYMENT_NOT_SETTLED');
        if(($payment['receipt_registration']??null)!=='succeeded'){
            $db->commit();return 'pending_receipt';
        }
        naRealWalletAssertOpen($db,$accountId);
        $new=$balance+(int)$saved['kopeks'];
        if($new<$balance || $new>PHP_INT_MAX)throw new RuntimeException('REAL_BALANCE_OVERFLOW');
        $db->prepare('UPDATE numi_real_wallet_balances SET kopeks=? WHERE account_id=?')
            ->execute([$new,$accountId]);
        $db->prepare("INSERT INTO numi_real_wallet_ledger(id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks)
            VALUES(?,?,'topup',?,?,?)")
            ->execute([naUuid(),$accountId,$saved['id'],(int)$saved['kopeks'],$new]);
        $db->prepare("UPDATE numi_real_wallet_topups SET status='credited',credited_at=UTC_TIMESTAMP() WHERE id=?")
            ->execute([$saved['id']]);
        $db->prepare("INSERT INTO numi_real_wallet_fiscal_events(id,kind,reference_id,kopeks,status)
            VALUES(?,'advance_in',?,?,'verified')")
            ->execute([naUuid(),$saved['id'],(int)$saved['kopeks']]);
        $db->commit();return 'credited';
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
/** Never let untrusted HTTP input attach a provider reference. */
function naRealWalletAttachVerifiedProvider(PDO $db,array $topup,array $payment,array $config): void {
    naRealWalletPaymentVerify($payment,$topup,$config);
    $db->beginTransaction();
    try{
        $q=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');
        $q->execute([$topup['account_id']]);if(!$q->fetchColumn())throw new RuntimeException('ACCOUNT_NOT_FOUND');
        $q=$db->prepare('SELECT * FROM numi_real_wallet_topups WHERE id=? AND account_id=? FOR UPDATE');
        $q->execute([$topup['id'],$topup['account_id']]);$fresh=$q->fetch();
        if(!$fresh)throw new RuntimeException('REAL_TOPUP_NOT_FOUND');
        naRealWalletPaymentVerify($payment,$fresh,$config);
        if($fresh['provider_payment_id']===null){
            $db->prepare('UPDATE numi_real_wallet_topups SET provider_payment_id=? WHERE id=?')
                ->execute([$payment['id'],$fresh['id']]);
        }
        $db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
/** LIVE provider GET only, never a browser-provided payment object. */
function naRealWalletFetchPayment(array $config,string $paymentId): array {
    naRealWalletRequireLive($config);
    if(preg_match('/^[A-Za-z0-9-]{1,191}$/D',$paymentId)!==1)
        throw new InvalidArgumentException('INVALID_PAYMENT_ID');
    $curl=curl_init('https://api.yookassa.ru/v3/payments/'.$paymentId);
    curl_setopt_array($curl,[
        CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,
        CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_USERPWD=>$config['shop_id'].':'.$config['secret_key'],
        CURLOPT_HTTPHEADER=>['Content-Type: application/json']]);
    $raw=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);
    if(!is_string($raw)||$status!==200)throw new RuntimeException('REAL_PROVIDER_UNAVAILABLE');
    $data=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
    if(!is_array($data))throw new RuntimeException('INVALID_REAL_PROVIDER_RESPONSE');
    return $data;
}
function naRealWalletReconcileTopup(PDO $db,array $config,string $topupId,string $accountId): string {
    naRealWalletRequireLive($config);
    $q=$db->prepare('SELECT * FROM numi_real_wallet_topups WHERE id=? AND account_id=?');
    $q->execute([$topupId,$accountId]);$topup=$q->fetch();
    if(!$topup)throw new RuntimeException('REAL_TOPUP_NOT_FOUND');
    if(!$topup['provider_payment_id'])return 'pending';
    $payment=naRealWalletFetchPayment($config,$topup['provider_payment_id']);
    return naRealWalletApplyVerifiedPayment($db,$topup,$payment,$config);
}
function naRealWalletQuote(PDO $db,array $account,array $input,callable $materialReady): array {
    $club=naRealWalletHasAccess($db,$account,'club_month','club');
    $quote=naCartResolve([$input],$club,
        fn($code,$resource)=>naRealWalletHasAccess($db,$account,$code,$resource),[],
        $materialReady);
    $item=$quote['items'][0];
    return ['price_kopeks'=>$item['price_kopeks'],
        'regular_price_kopeks'=>naCatalogResolve($input,false)['price_kopeks'],
        'club_price_kopeks'=>naCatalogResolve($input,true)['price_kopeks'],
        'club_active'=>$club,'owned'=>$item['access_active'],
        'ready'=>$item['sale_ready'],'kind'=>$item['kind'],
        'product_code'=>$item['product_code'],'resource_id'=>$item['resource_id'],
        'real_balance_kopeks'=>naRealWalletBalance($db,$account['id'])];
}
/**
 * Allocate each fulfilled purchase to its actual original credited advance.
 * Caller MUST already hold the account FOR UPDATE lock inside the purchase
 * transaction. Reserve one receipt for advance and one possible refund: at
 * most 48 offset events per original provider payment (below the 50 cap).
 * This conservative allocator refuses multi-source purchases for now.
 */
function naRealWalletAllocateReceiptSource(PDO $db,string $accountId,int $kopeks): string {
    if($kopeks<1||!$db->inTransaction())
        throw new RuntimeException('REAL_RECEIPT_SOURCE_INVALID');
    $q=$db->prepare("SELECT id,kopeks FROM numi_real_wallet_topups
        WHERE account_id=? AND status='credited'
          AND provider_payment_id IS NOT NULL AND receipt_email IS NOT NULL
        ORDER BY credited_at ASC,id ASC FOR UPDATE");
    $q->execute([$accountId]);
    $sources=$q->fetchAll(PDO::FETCH_ASSOC);
    $used=$db->prepare("SELECT COALESCE(SUM(kopeks),0) AS used_kopeks,
         COUNT(*) AS receipt_count FROM numi_real_wallet_receipt_sources WHERE topup_id=?");
    foreach($sources as $topup){
        $used->execute([$topup['id']]);$amount=$used->fetch(PDO::FETCH_ASSOC);
        $free=(int)$topup['kopeks']-(int)$amount['used_kopeks'];
        if($free >= $kopeks && (int)$amount['receipt_count'] < 48)
            return $topup['id'];
    }
    throw new RuntimeException('REAL_RECEIPT_SOURCE_UNAVAILABLE');
}

/**
 * Manual balance purchase. Never executes an external charge; no cart.
 * Only REAL paid entitlements count as owned or grant the club discount.
 */
function naRealWalletBuy(PDO $db,array $account,array $config,array $input,string $requestKey,callable $materialReady): array {
    naRealWalletRequireLive($config);
    $requestKey=naWalletKey($requestKey);
    // Fiscal contact comes from the original paid top-up, not the account email.
    // All schema migrations must have run before any money transaction.
    // Check material presence before the account lock, then again after.
    $pre=naRealWalletQuote($db,$account,$input,$materialReady);
    if(!$pre['ready'])throw new RuntimeException('REAL_MATERIAL_NOT_READY');
    $db->beginTransaction();
    try{
        $q=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');
        $q->execute([$account['id']]);if(!$q->fetchColumn())throw new RuntimeException('ACCOUNT_NOT_FOUND');
        $q=$db->prepare('SELECT * FROM numi_real_wallet_spends WHERE account_id=? AND request_key=? FOR UPDATE');
        $q->execute([$account['id'],$requestKey]);$prior=$q->fetch();
        $club=naRealWalletHasAccess($db,$account,'club_month','club');
        $item=naCatalogResolve($input,$club);
        if($prior){
            if($prior['product_code']!==$item['product_code'] || $prior['resource_id']!==$item['resource_id'])
                throw new InvalidArgumentException('REAL_REQUEST_KEY_REUSED');
            $db->commit();
            return ['already_purchased'=>true,'entitlement_id'=>$prior['entitlement_id'],
                'balance_kopeks'=>naRealWalletBalance($db,$account['id'])];
        }
        $quote=naCartResolve([$input],$club,
            fn($code,$resource)=>naRealWalletHasAccess($db,$account,$code,$resource),[],
            $materialReady);
        $item=$quote['items'][0];
        $price=(int)$item['price_kopeks'];
        if($item['kind']!=='subscription' && naRealWalletHasAccess($db,$account,$item['product_code'],$item['resource_id']))
            throw new RuntimeException('REAL_ALREADY_PURCHASED');
        if(!$quote['fulfillment_ready'] || $price<1
           || !in_array($item['kind'],['question','report','subscription'],true))
            throw new RuntimeException('REAL_MATERIAL_NOT_READY');
        $balance=naRealWalletBalance($db,$account['id'],true);
        naRealWalletAssertOpen($db,$account['id']);
        if($balance<$price)throw new RuntimeException('REAL_INSUFFICIENT_BALANCE');
        $new=$balance-$price;
        $orderId=naUuid();$entitlementId=naUuid();$spendId=naUuid();
        $db->prepare('UPDATE numi_real_wallet_balances SET kopeks=? WHERE account_id=?')
            ->execute([$new,$account['id']]);
        $db->prepare("INSERT INTO numi_orders(id,account_id,product_code,resource_id,amount_kopeks,provider,status,verified_at)
            VALUES(?,?,?,?,?,'real_wallet','paid',UTC_TIMESTAMP())")
            ->execute([$orderId,$account['id'],$item['product_code'],$item['resource_id'],$price]);
        $starts=new DateTimeImmutable('now',new DateTimeZone('UTC'));
        if($item['kind']==='subscription'){
            $q=$db->prepare("SELECT MAX(e.expires_at) FROM numi_entitlements e
                JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id
                WHERE e.account_id=? AND e.product_code=? AND o.provider='real_wallet'
                  AND e.status='active' AND o.status='paid' AND o.verified_at IS NOT NULL");
            $q->execute([$account['id'],$item['product_code']]);$expiry=$q->fetchColumn();
            if($expiry && new DateTimeImmutable($expiry,new DateTimeZone('UTC'))>$starts)
                $starts=new DateTimeImmutable($expiry,new DateTimeZone('UTC'));
        }
        $expiry=naStoreExpiry($item['product_code'],$starts);
        $db->prepare("INSERT INTO numi_entitlements(id,account_id,order_id,product_code,resource_id,status,expires_at)
            VALUES(?,?,?,?,?,'active',?)")
            ->execute([$entitlementId,$account['id'],$orderId,$item['product_code'],$item['resource_id'],$expiry]);
        if($item['kind']==='subscription'){
            $db->prepare("INSERT INTO numi_subscription_settings(account_id,product_code,auto_renew,source_order_id)
                VALUES(?,?,0,?) ON DUPLICATE KEY UPDATE auto_renew=0,
                payment_method_id=NULL,source_order_id=VALUES(source_order_id)")
                ->execute([$account['id'],$item['product_code'],$orderId]);
        }
        $db->prepare('INSERT INTO numi_real_wallet_spends(id,account_id,request_key,product_code,resource_id,kopeks,order_id,entitlement_id) VALUES(?,?,?,?,?,?,?,?)')
            ->execute([$spendId,$account['id'],$requestKey,$item['product_code'],$item['resource_id'],$price,$orderId,$entitlementId]);
        $sourceTopupId=naRealWalletAllocateReceiptSource($db,$account['id'],$price);
        $db->prepare('INSERT INTO numi_real_wallet_receipt_sources(spend_id,topup_id,kopeks) VALUES(?,?,?)')
            ->execute([$spendId,$sourceTopupId,$price]);
        $db->prepare("INSERT INTO numi_real_wallet_ledger(id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks)
            VALUES(?,?,'purchase',?,?,?)")
            ->execute([naUuid(),$account['id'],$spendId,-$price,$new]);
        // Exactly one fiscal offset outbox event per spend, atomically.
        $db->prepare("INSERT INTO numi_real_wallet_fiscal_events(id,kind,reference_id,kopeks,status)
            VALUES(?,'advance_offset',?,?,'pending')")
            ->execute([naUuid(),$spendId,$price]);
        $db->commit();
        return ['already_purchased'=>false,'entitlement_id'=>$entitlementId,
            'balance_kopeks'=>$new,'price_kopeks'=>$price,'expires_at'=>$expiry,
            'renewal'=>'manual'];
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
/**
 * Stop future subscription billing immediately, without revoking already paid
 * access. This action is authorized by the existing login session and does not
 * require calling an external payment provider.
 */
function naRealWalletCancelSubscription(PDO $db,array $account,string $code): void {
    if(!in_array($code,['club_month','school_week'],true))
        throw new InvalidArgumentException('INVALID_SUBSCRIPTION');
    $db->prepare("INSERT IGNORE INTO numi_subscription_settings(account_id,product_code)
        VALUES(?,?)")->execute([$account['id'],$code]);
    $db->prepare("UPDATE numi_subscription_settings
        SET auto_renew=0,payment_method_id=NULL,cancelled_at=UTC_TIMESTAMP()
        WHERE account_id=? AND product_code=?")->execute([$account['id'],$code]);
}
/** Atomic account merge; caller locks numi_accounts in sorted order. */
function naRealWalletMergeAccounts(PDO $db,string $from,string $to): void {
    if($from===$to)return;
    if(!$db->inTransaction())throw new RuntimeException('REAL_MERGE_REQUIRES_TRANSACTION');
    $q=$db->prepare('SELECT id FROM numi_real_wallet_merges WHERE source_account_id=? FOR UPDATE');
    $q->execute([$from]);if($q->fetchColumn())throw new RuntimeException('REAL_ALREADY_MERGED');
    $q=$db->prepare("SELECT COUNT(*) FROM numi_real_wallet_topups WHERE account_id=? AND status IN ('pending','review')");
    $q->execute([$from]);if((int)$q->fetchColumn()>0)throw new RuntimeException('REAL_PENDING_TOPUP_RECONCILIATION');
    $source=naRealWalletBalance($db,$from,true);
    $target=naRealWalletBalance($db,$to,true);
    naRealWalletAssertOpen($db,$from);
    naRealWalletAssertOpen($db,$to);
    naRealWalletInvariant($db,$from);naRealWalletInvariant($db,$to);
    if($source>PHP_INT_MAX-$target)throw new RuntimeException('REAL_MERGE_OVERFLOW');
    $mergeId=naUuid();
    $db->prepare('UPDATE numi_real_wallet_balances SET kopeks=0 WHERE account_id=?')->execute([$from]);
    $db->prepare('UPDATE numi_real_wallet_balances SET kopeks=? WHERE account_id=?')->execute([$target+$source,$to]);
    $db->prepare('UPDATE numi_real_wallet_topups SET account_id=? WHERE account_id=?')->execute([$to,$from]);
    $db->prepare('UPDATE numi_real_wallet_spends SET account_id=? WHERE account_id=?')->execute([$to,$from]);
    $db->prepare('INSERT INTO numi_real_wallet_merges(id,source_account_id,destination_account_id,kopeks) VALUES(?,?,?,?)')
        ->execute([$mergeId,$from,$to,$source]);
    if($source>0){
        $insert=$db->prepare('INSERT INTO numi_real_wallet_ledger(id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks) VALUES(?,?,?,?,?,?)');
        $insert->execute([naUuid(),$from,'transfer_out',$mergeId,-$source,0]);
        $insert->execute([naUuid(),$to,'transfer_in',$mergeId,$source,$target+$source]);
    }
}
/** No refunds without a reviewed fiscal/refund policy and real provider reversal. */
function naRealWalletRefund(): never {
    throw new RuntimeException('REAL_REFUNDS_REQUIRE_FISCAL_REVIEW');
}
