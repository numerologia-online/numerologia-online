<?php
declare(strict_types=1);
define('NG_TEST',true);
require dirname(__DIR__).'/public/numi-gifts.php';
require dirname(__DIR__,2).'/account-service/private/core.php';
function giftCheck(bool $truth,string $name): void {
    if(!$truth)throw new RuntimeException('FAILED: '.$name);
    echo "PASS ".$name."\n";
}
$dsn=getenv('NG_TEST_DSN');
if(!$dsn){echo "Gift MySQL integration not configured\n";exit;}
$db=new PDO($dsn,'root','gift_test_only',[
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES=>false
]);
$db->exec("SET time_zone='+00:00'");
$db->exec("CREATE TABLE numi_accounts(id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY)");
$db->exec("CREATE TABLE numi_orders(id CHAR(36) PRIMARY KEY,account_id CHAR(36),product_code VARCHAR(64),
  resource_id VARCHAR(128),amount_kopeks INT,status VARCHAR(16),verified_at DATETIME,
  provider VARCHAR(50))");
$db->exec("CREATE TABLE numi_entitlements(id CHAR(36) PRIMARY KEY,account_id CHAR(36),
  order_id CHAR(36),product_code VARCHAR(64),resource_id VARCHAR(128),status VARCHAR(16),expires_at DATETIME)");
ngSchema($db);ngSchema($db);
$accounts=[];
for($i=1;$i<=8;$i++){
    $id=sprintf('00000000-0000-4000-8000-%012d',$i);
    $db->prepare('INSERT INTO numi_accounts VALUES(?)')->execute([$id]);$accounts[]=$id;
}
$paidOrder='00000000-0000-4000-8000-000000000091';
$db->prepare("INSERT INTO numi_orders VALUES(?,?,'club_month','club',49000,'paid',UTC_TIMESTAMP(),'real_subscription')")
  ->execute([$paidOrder,$accounts[0]]);
$db->prepare("INSERT INTO numi_entitlements VALUES(?,?,?,'club_month','club','active',
    DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 DAY))")
  ->execute(['00000000-0000-4000-8000-000000000092',$accounts[0],$paidOrder]);
$expiredOrder='00000000-0000-4000-8000-000000000093';
$db->prepare("INSERT INTO numi_orders VALUES(?,?,'club_month','club',49000,'paid',DATE_SUB(UTC_TIMESTAMP(),INTERVAL 50 DAY),'real_subscription')")
 ->execute([$expiredOrder,$accounts[1]]);
$db->prepare("INSERT INTO numi_entitlements VALUES(?,?,?,'club_month','club','active',DATE_SUB(UTC_TIMESTAMP(),INTERVAL 20 DAY))")
 ->execute(['00000000-0000-4000-8000-000000000094',$accounts[1],$expiredOrder]);
$r=ngOverview($db);
giftCheck($r['accounts']['all']===8,'all accounts');
giftCheck($r['accounts']['paid_club']===1&&$r['accounts']['without_paid_club']===7,'paid club exclusion');
giftCheck($r['accounts']['previously_paid_club']===1,'expired club bucket');
giftCheck($r['accounts']['eligible']===7,'new eligible accounts');
$key='00000000-0000-4000-8000-000000000099';
$result=ngIssue($db,['count'=>2,'request_key'=>$key]);
giftCheck($result['issued']===2,'two gifts offered');
$again=ngIssue($db,['count'=>2,'request_key'=>$key]);
giftCheck($again['already_processed']&&$again['issued']===2,'same request cannot issue twice');
giftCheck(ngOverview($db)['accounts']['eligible']===5,'30-day cooldown');
$q=$db->query('SELECT id,account_id FROM numi_gift_club LIMIT 1');$row=$q->fetch();
giftCheck($row['account_id']!==$accounts[0],'never gift active paying club');
$gift=ngMine($db,['id'=>$row['account_id']]);
giftCheck($gift['gifts'][0]['status']==='ready','ready to claim');
$active=ngActivate($db,['id'=>$row['account_id']],['gift_id'=>$row['id']]);
giftCheck($active['status']==='active'&&$active['expires_at']!==null,'opt-in activation');
giftCheck(naGiftClubExpiry($db,$row['account_id'])!==null,'gift checked by canonical club access');
$again=ngActivate($db,['id'=>$row['account_id']],['gift_id'=>$row['id']]);
giftCheck($again['status']==='already_activated'&&$again['expires_at']===$active['expires_at'],'activation idempotence');
$db->prepare("UPDATE numi_gift_club SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=?")
  ->execute([$row['id']]);
giftCheck(naGiftClubExpiry($db,$row['account_id'])===null,'24h expiry enforced by database clock');
echo "Gift MySQL integration passed\n";
