<?php
declare(strict_types=1);
/** Isolated integration tests, NEVER connected to actual REG.RU or real YooKassa. */
require_once __DIR__.'/../private/core.php';
require_once __DIR__.'/../private/wallet-real.php';
$dsn=getenv('NUMI_TEST_MYSQL_DSN');
if(!$dsn){fwrite(STDERR,"NUMI_TEST_MYSQL_DSN required\n");exit(2);}
$db=new PDO($dsn,getenv('NUMI_TEST_MYSQL_USER')?:'root',getenv('NUMI_TEST_MYSQL_PASSWORD')?:'test',[
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC
]);
function assertReal(bool $ok,string $label): void {
    if(!$ok)throw new RuntimeException('REAL_WALLET_TEST_FAILED: '.$label);
}
function expectReal(callable $callback,string $error): void {
    try{$callback();}catch(Throwable $e){
        if(str_contains($e->getMessage(),$error))return;
        throw new RuntimeException('UNEXPECTED_ERROR: '.$e->getMessage(),0,$e);
    }
    throw new RuntimeException('EXPECTED_ERROR_NOT_THROWN: '.$error);
}
$accountA='00000000-0000-4000-8000-000000000101';
$accountB='00000000-0000-4000-8000-000000000102';
$accountC='00000000-0000-4000-8000-000000000103';
$db->exec("CREATE TABLE IF NOT EXISTS numi_accounts(
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    email VARCHAR(191) NULL,
    email_verified_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
foreach([$accountA,$accountB,$accountC] as $i=>$id)
    $db->prepare('INSERT INTO numi_accounts(id,email,email_verified_at) VALUES(?,?,UTC_TIMESTAMP())')
       ->execute([$id,'verified'.($i+1).'@example.test']);
$db->exec("CREATE TABLE numi_orders(
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    product_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    resource_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    amount_kopeks INT UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'RUB',
    provider VARCHAR(50) NULL,
    status ENUM('pending','paid','refunded','cancelled') NOT NULL DEFAULT 'pending',
    verified_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB");
$db->exec("CREATE TABLE numi_entitlements(
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    product_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    resource_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status ENUM('active','revoked') NOT NULL DEFAULT 'active',
    expires_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB");
naSubscriptionSchema($db);
naWalletSchema($db);  // Existing TEST tables stay separate and retain test money.
naRealWalletSchema($db);
naRealWalletSchema($db); // Schema migration idempotence.
$accA=['id'=>$accountA];$accB=['id'=>$accountB];$accC=['id'=>$accountC];
$good=[
    'wallet_mode'=>'live','real_wallet_enabled'=>true,
    'fiscalization_verified'=>true,'refunds_verified'=>true,
    'advance_offset_receipts_verified'=>true,
    'offset_receipt_worker_verified'=>true,
    'launch_approved'=>true,'provider_test_mode'=>false,
    'shop_id'=>'1234567','secret_key'=>'live_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
];
assertReal(!naRealWalletGate([]),'default fail-closed');
foreach(['real_wallet_enabled','fiscalization_verified','refunds_verified','advance_offset_receipts_verified','offset_receipt_worker_verified','launch_approved'] as $flag){
    $bad=$good;$bad[$flag]=false;
    assertReal(!naRealWalletGate($bad),'gate rejects missing '.$flag);
}
$bad=$good;$bad['secret_key']='test_ABCDEFGHIJKLMNOPQRSTUVWXYZ';
assertReal(!naRealWalletGate($bad),'test key cannot enable real funds');
$bad=$good;$bad['provider_test_mode']=true;
assertReal(!naRealWalletGate($bad),'sandbox provider cannot enable real funds');
expectReal(fn()=>naRealWalletTopupIntent($db,$accA,[],100,'request-key-123456789'), 'REAL_PAYMENTS_DISABLED');
$db->prepare('UPDATE numi_accounts SET email_verified_at=NULL WHERE id=?')->execute([$accountA]);
expectReal(fn()=>naRealWalletTopupIntent($db,$accA,$good,100,'contact-required-123456789'),
    'REAL_FISCAL_CONTACT_REQUIRED');
$db->prepare('UPDATE numi_accounts SET email_verified_at=UTC_TIMESTAMP() WHERE id=?')->execute([$accountA]);
// Test payment and entitlement intentionally belong to TEST tables; must not leak into real status.
$db->prepare("INSERT INTO numi_wallet_balances(account_id,kopeks) VALUES(?,?)")->execute([$accountA,20000]);
$db->prepare("INSERT INTO numi_wallet_ledger(id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks)
    VALUES(?,?,'topup',?,?,?)")->execute([naUuid(),$accountA,naUuid(),20000,20000]);
$db->prepare("INSERT INTO numi_orders(id,account_id,product_code,resource_id,amount_kopeks,provider,status,verified_at)
    VALUES(?,?,'club_month','club',49000,'sandbox_wallet','paid',UTC_TIMESTAMP())")
    ->execute([$testOrder=naUuid(),$accountA]);
$db->prepare("INSERT INTO numi_entitlements(id,account_id,order_id,product_code,resource_id,status,expires_at)
    VALUES(?,?,?,'club_month','club','active',DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY))")
    ->execute([naUuid(),$accountA,$testOrder]);
assertReal(naRealWalletBalance($db,$accountA)===0,'real wallet starts from zero');
assertReal(naRealWalletStatus($db,$accA)['balance_kopeks']===0,'test 200 RUB ignored');
assertReal(!naRealWalletHasAccess($db,$accA,'club_month','club'),'test club cannot grant real discount');
$question=['product_code'=>'redflag_question','category'=>'money','question_id'=>'generosity','birth_date'=>'1986-09-09'];
$ready=static fn(array $item):bool=>true;
$before=naRealWalletQuote($db,$accA,$question,$ready);
assertReal((int)$before['price_kopeks']===2000 && !$before['club_active'],
    '20 RUB price without real club even when TEST club is active');
expectReal(fn()=>naRealWalletTopupIntent($db,$accA,$good,0,'amount-invalid-1234'),'INVALID_TOPUP_AMOUNT');
$top=naRealWalletTopupIntent($db,$accA,$good,100,'topup-unique-123456789001');
assertReal($top['status']==='pending' && $top['amount_kopeks']===10000,'create pending real intent');
assertReal(naRealWalletTopupIntent($db,$accA,$good,100,'topup-unique-123456789001')['topup_id']===$top['topup_id'],
    'topup retry is idempotent');
expectReal(fn()=>naRealWalletTopupIntent($db,$accA,$good,101,'topup-unique-123456789001'),'REAL_TOPUP_KEY_CONFLICT');
$q=$db->prepare('SELECT * FROM numi_real_wallet_topups WHERE id=?');$q->execute([$top['topup_id']]);$row=$q->fetch();
$pay=[
    'id'=>'live-payment-example-123','test'=>false,'status'=>'succeeded','paid'=>true,
    'amount'=>['value'=>'100.00','currency'=>'RUB'],
    'recipient'=>['account_id'=>'1234567'],
    'metadata'=>['numi_real_wallet_topup'=>$top['topup_id']],
    'refunded_amount'=>['value'=>'0.00'],
    'receipt_registration'=>'pending'
];
foreach([
    'sandbox'=>array_replace($pay,['test'=>true]),
    'amount'=>array_replace($pay,['amount'=>['value'=>'101.00','currency'=>'RUB']]),
    'merchant'=>array_replace($pay,['recipient'=>['account_id'=>'9999999']]),
    'metadata'=>array_replace($pay,['metadata'=>['numi_real_wallet_topup'=>'other']]),
    'currency'=>array_replace($pay,['amount'=>['value'=>'100.00','currency'=>'USD']]),
] as $type=>$invalid){
    expectReal(fn()=>naRealWalletPaymentVerify($invalid,$row,$good),'REAL_PROVIDER_PAYMENT_MISMATCH');
}
naRealWalletAttachVerifiedProvider($db,$row,$pay,$good);
$q->execute([$top['topup_id']]);$row=$q->fetch();
assertReal(naRealWalletApplyVerifiedPayment($db,$row,$pay,$good)==='pending_receipt',
    'paid provider status alone cannot credit wallet');
assertReal(naRealWalletBalance($db,$accountA)===0,'no funds without fiscal registration');
$pay['receipt_registration']='succeeded';
assertReal(naRealWalletApplyVerifiedPayment($db,$row,$pay,$good)==='credited','verified receipt credits real money');
assertReal(naRealWalletApplyVerifiedPayment($db,$row,$pay,$good)==='credited','duplicate provider notification is idempotent');
assertReal(naRealWalletBalance($db,$accountA)===10000,'only one real credit');
$qFiscal=$db->prepare("SELECT kind,kopeks,status FROM numi_real_wallet_fiscal_events WHERE reference_id=?");
$qFiscal->execute([$top['topup_id']]);$receipt=$qFiscal->fetch();
assertReal($receipt!==false && $receipt['kind']==='advance_in'
    && (int)$receipt['kopeks']===10000 && $receipt['status']==='verified',
    'verified payment creates one fiscal advance audit event');
naRealWalletInvariant($db,$accountA);
$paid=naRealWalletBuy($db,$accA,$good,$question,'buy-unique-1234567890001',$ready);
assertReal($paid['price_kopeks']===2000 && $paid['balance_kopeks']===8000,'regular price charged');
$canonical=naCatalogResolve($question,false);
assertReal(naRealWalletHasAccess($db,$accA,'redflag_question',$canonical['resource_id']),
    'real purchase grants exact selected answer');
$qFiscal=$db->prepare("SELECT COUNT(*) FROM numi_real_wallet_fiscal_events f
    JOIN numi_real_wallet_spends s ON s.id=f.reference_id
    WHERE s.account_id=? AND s.request_key=? AND f.kind='advance_offset'
      AND f.status='pending' AND f.kopeks=?");
$qFiscal->execute([$accountA,'buy-unique-1234567890001',2000]);
assertReal((int)$qFiscal->fetchColumn()===1,'purchase records one pending fiscal offset');
$again=naRealWalletBuy($db,$accA,$good,$question,'buy-unique-1234567890001',$ready);
assertReal($again['already_purchased']===true && $again['balance_kopeks']===8000,
    'same request cannot double charge');
$qFiscal->execute([$accountA,'buy-unique-1234567890001',2000]);
assertReal((int)$qFiscal->fetchColumn()===1,'duplicate purchase cannot duplicate fiscal offset');
expectReal(fn()=>naRealWalletBuy($db,$accA,$good,['product_code'=>'club_month'],
    'buy-unique-1234567890001',$ready),'REAL_REQUEST_KEY_REUSED');
expectReal(fn()=>naRealWalletBuy($db,$accA,$good,$question,
    'buy-unique-another-123456',$ready),'REAL_ALREADY_PURCHASED');
naRealWalletInvariant($db,$accountA);
// Second payment funds one actual club subscription.
$top2=naRealWalletTopupIntent($db,$accA,$good,500,'topup-unique-123456789002');
$q->execute([$top2['topup_id']]);$row2=$q->fetch();
$pay2=$pay;$pay2['id']='live-payment-example-456';$pay2['amount']['value']='500.00';
$pay2['metadata']['numi_real_wallet_topup']=$top2['topup_id'];
naRealWalletAttachVerifiedProvider($db,$row2,$pay2,$good);
$q->execute([$top2['topup_id']]);$row2=$q->fetch();
assertReal(naRealWalletApplyVerifiedPayment($db,$row2,$pay2,$good)==='credited','second live credit');
$club=naRealWalletBuy($db,$accA,$good,['product_code'=>'club_month'],
    'buy-club-unique-123456789',$ready);
assertReal($club['price_kopeks']===49000,'club charged catalog price');
assertReal(naRealWalletHasAccess($db,$accA,'club_month','club'),'real club now active');
$otherQuestion=['product_code'=>'redflag_question','category'=>'money','question_id'=>'courtship','birth_date'=>'1986-09-09'];
$clubQuote=naRealWalletQuote($db,$accA,$otherQuestion,$ready);
assertReal($clubQuote['club_active'] && $clubQuote['price_kopeks']===1000,
    'verified real club gets 10 RUB price');
$clubBuy=naRealWalletBuy($db,$accA,$good,$otherQuestion,
    'buy-member-unique-123456',$ready);
assertReal($clubBuy['price_kopeks']===1000,'real club member charged ten, not twenty');
naRealWalletInvariant($db,$accountA);
$db->prepare("UPDATE numi_entitlements SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND)
    WHERE order_id=?")->execute([$testOrder]);
assertReal(naRealWalletHasAccess($db,$accA,'club_month','club'),
    'test club expiry has no effect on independent real membership');
$db->prepare("UPDATE numi_entitlements SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND)
    WHERE id=?")->execute([$club['entitlement_id']]);
$notMember=naRealWalletQuote($db,$accA,
    ['product_code'=>'redflag_question','category'=>'money','question_id'=>'provider','birth_date'=>'1986-09-09'],$ready);
assertReal(!$notMember['club_active'] && $notMember['price_kopeks']===3900,
    'expired REAL club receives regular 39 RUB price for provider question');
naRealWalletInvariant($db,$accountA);
// A provider refund on a previously credited top-up must freeze, not make a negative ledger.
$pay2['refunded_amount']['value']='100.00';
assertReal(naRealWalletApplyVerifiedPayment($db,$row2,$pay2,$good)==='review','external refund triggers manual reconciliation');
expectReal(fn()=>naRealWalletBuy($db,$accA,$good,
    ['product_code'=>'redflag_question','category'=>'money','question_id'=>'provider','birth_date'=>'1986-09-09'],
    'blocked-real-buy-123456',$ready),'REAL_WALLET_FROZEN');
naRealWalletInvariant($db,$accountA);
// Separate identities: pending external money must block a merge, then audited transfer.
$pending=naRealWalletTopupIntent($db,$accB,$good,25,'account-b-topup-0000001');
$db->beginTransaction();
expectReal(fn()=>naRealWalletMergeAccounts($db,$accountB,$accountC),'REAL_PENDING_TOPUP_RECONCILIATION');
$db->rollBack();
$db->prepare("UPDATE numi_real_wallet_topups SET status='canceled' WHERE id=?")->execute([$pending['topup_id']]);
$db->prepare("UPDATE numi_real_wallet_balances SET blocked_at=UTC_TIMESTAMP() WHERE account_id=?")
    ->execute([$accountB]);
$db->beginTransaction();
expectReal(fn()=>naRealWalletMergeAccounts($db,$accountB,$accountC),'REAL_WALLET_FROZEN');
$db->rollBack();
$db->prepare('UPDATE numi_real_wallet_balances SET blocked_at=NULL WHERE account_id=?')->execute([$accountB]);
$db->beginTransaction();
naRealWalletMergeAccounts($db,$accountB,$accountC);
$db->commit();
naRealWalletInvariant($db,$accountB);naRealWalletInvariant($db,$accountC);
$db->beginTransaction();
expectReal(fn()=>naRealWalletMergeAccounts($db,$accountB,$accountC),'REAL_ALREADY_MERGED');
$db->rollBack();
expectReal(fn()=>naRealWalletRefund(),'REAL_REFUNDS_REQUIRE_FISCAL_REVIEW');
echo "REAL_WALLET_ISOLATION_SETTLEMENT_CLUB_REFUND_TESTS_PASS\n";
