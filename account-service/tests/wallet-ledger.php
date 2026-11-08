<?php
declare(strict_types=1);
require __DIR__.'/../private/core.php';
require __DIR__.'/../private/wallet.php';
$dsn=getenv('NUMI_TEST_MYSQL_DSN');
if(!$dsn){fwrite(STDERR,"NUMI_TEST_MYSQL_DSN is required\n");exit(2);}
$db=new PDO($dsn,getenv('NUMI_TEST_MYSQL_USER')?:'root',getenv('NUMI_TEST_MYSQL_PASSWORD')?:'test',
    [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$db->exec("CREATE TABLE IF NOT EXISTS numi_accounts (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  email VARCHAR(191) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
function check(bool $condition,string $msg): void {
    if(!$condition)throw new RuntimeException('FAIL '.$msg);
}
$source='00000000-0000-4000-8000-000000000001';
$dest='00000000-0000-4000-8000-000000000002';
$db->prepare("INSERT INTO numi_accounts(id) VALUES(?),(?)")->execute([$source,$dest]);
naWalletSchema($db);
naSubscriptionSchema($db);
$db->prepare('INSERT INTO numi_wallet_balances(account_id,kopeks) VALUES(?,?),(?,?)')
    ->execute([$source,10000,$dest,3000]);
$db->prepare('INSERT INTO numi_wallet_ledger(id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks) VALUES(?,?,?,?,?,?)')
    ->execute(['00000000-0000-4000-8000-000000000011',$source,'topup','00000000-0000-4000-8000-000000000012',10000,10000]);
$db->prepare('INSERT INTO numi_wallet_ledger(id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks) VALUES(?,?,?,?,?,?)')
    ->execute(['00000000-0000-4000-8000-000000000021',$dest,'topup','00000000-0000-4000-8000-000000000022',5000,5000]);
$db->prepare('INSERT INTO numi_wallet_ledger(id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks) VALUES(?,?,?,?,?,?)')
    ->execute(['00000000-0000-4000-8000-000000000023',$dest,'purchase','00000000-0000-4000-8000-000000000024',-2000,3000]);
$db->prepare('INSERT INTO numi_wallet_topups(id,account_id,request_key,kopeks) VALUES(?,?,?,?)')
    ->execute(['00000000-0000-4000-8000-000000000031',$source,'request-original-001',1000]);
$db->prepare('INSERT INTO numi_wallet_spends(id,account_id,request_key,product_code,resource_id,kopeks,order_id,entitlement_id) VALUES(?,?,?,?,?,?,?,?)')
    ->execute(['00000000-0000-4000-8000-000000000041',$source,'request-spend-001','yesno_question',
        'yesno:yn-man-001:12:00',1900,'00000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000043']);
$db->prepare('INSERT INTO numi_subscription_settings(account_id,product_code,auto_renew,payment_method_id) VALUES(?,?,?,?)')
    ->execute([$source,'club_month',1,'opaque-test-method']);
$db->beginTransaction();
try{
    naWalletMergeAccounts($db,$source,$dest);
    naSubscriptionMergeAccounts($db,$source,$dest);
    $db->commit();
}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
check(naWalletBalance($db,$source)===0,'source balance becomes zero');
check(naWalletBalance($db,$dest)===13000,'destination balance adds balances');
foreach([[$source,0],[$dest,13000]] as [$id,$balance]){
    $q=$db->prepare('SELECT COALESCE(SUM(delta_kopeks),0) FROM numi_wallet_ledger WHERE account_id=?');
    $q->execute([$id]);check((int)$q->fetchColumn()===$balance,'ledger sum equals balance');
}
foreach(['numi_wallet_topups','numi_wallet_spends'] as $table){
    $q=$db->prepare("SELECT account_id FROM $table LIMIT 1");$q->execute();
    check($q->fetchColumn()===$dest,'transactions continue from destination account');
}
$q=$db->prepare('SELECT kopeks FROM numi_wallet_merges WHERE source_account_id=? AND destination_account_id=?');
$q->execute([$source,$dest]);check((int)$q->fetchColumn()===10000,'audited transfer');
$q=$db->prepare('SELECT auto_renew,payment_method_id FROM numi_subscription_settings WHERE account_id=? AND product_code=?');
$q->execute([$dest,'club_month']);$sub=$q->fetch();
check($sub!==false && (int)$sub['auto_renew']===0 && $sub['payment_method_id']===null,
    'subscription preserved without silent autopayment');
$rejected=false;
$db->beginTransaction();
try{naWalletMergeAccounts($db,$source,$dest);}
catch(RuntimeException $e){$rejected=$e->getMessage()==='WALLET_ALREADY_MERGED';}
$db->rollBack();
check($rejected,'duplicate account merge rejected');

/* The two displayed prices must match the entitlement-dependent server quote. */
$question=['product_code'=>'redflag_question','category'=>'money',
  'question_id'=>'generosity','birth_date'=>'1986-09-09'];
check(naCatalogResolve($question,false)['price_kopeks']===2000,'regular Red Flag price 20 RUB');
check(naCatalogResolve($question,true)['price_kopeks']===1000,'active member price 10 RUB');
check(naCatalogResolve(['product_code'=>'club_month'],false)['price_kopeks']===49000,
  'club membership price comes from catalog');
$db->exec("CREATE TABLE numi_orders (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status VARCHAR(30) NOT NULL,
 verified_at DATETIME NULL
) ENGINE=InnoDB");
$db->exec("CREATE TABLE numi_entitlements (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 product_code VARCHAR(64) NOT NULL,resource_id VARCHAR(128) NOT NULL,
 status VARCHAR(30) NOT NULL,expires_at DATETIME NULL
) ENGINE=InnoDB");
check(naWalletClubStatus($db,['id'=>$dest])['club_active']===false,'no club without paid entitlement');
$clubOrder='00000000-0000-4000-8000-000000000051';
$db->prepare("INSERT INTO numi_orders(id,account_id,status,verified_at) VALUES(?,?,'paid',UTC_TIMESTAMP())")
    ->execute([$clubOrder,$dest]);
$db->prepare("INSERT INTO numi_entitlements(id,account_id,order_id,product_code,resource_id,status,expires_at)
 VALUES(?,?,?,'club_month','club','active',DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY))")
    ->execute(['00000000-0000-4000-8000-000000000052',$dest,$clubOrder]);
$active=naWalletClubStatus($db,['id'=>$dest]);
check($active['club_active']===true && is_string($active['club_expires_at']),
    'verified active club and expiry shown');
check(naWalletClubStatus($db,['id'=>$source])['club_active']===false,
    'club is never borrowed by another account');
$db->prepare("UPDATE numi_entitlements SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE order_id=?")
    ->execute([$clubOrder]);
check(naWalletClubStatus($db,['id'=>$dest])['club_active']===false,
    'expired club cannot receive discount');
$db->prepare("UPDATE numi_entitlements SET expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY) WHERE order_id=?")
    ->execute([$clubOrder]);
$db->prepare("UPDATE numi_orders SET verified_at=NULL WHERE id=?")->execute([$clubOrder]);
check(naWalletClubStatus($db,['id'=>$dest])['club_active']===false,
    'unverified payment cannot activate discount');
echo "CLUB_PRICING_ENTITLEMENT_TESTS_PASS\n";

echo "WALLET_LEDGER_MERGE_TESTS_PASS\n";
