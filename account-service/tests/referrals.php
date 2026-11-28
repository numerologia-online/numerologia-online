<?php
declare(strict_types=1);
require __DIR__.'/../private/referrals.php';
function rfAssert(bool $v,string $why): void {if(!$v)throw new RuntimeException($why);}
rfAssert(nrReward('club_month',49000)===4900,'club');
rfAssert(nrReward('year_full',99000)===10000,'full');
rfAssert(nrReward('child_full_v1',49000)===5000,'discount');
foreach(['school_week','redflag_question','moment_question','wallet_topup','yesno_question'] as $x)
    rfAssert(nrReward($x,49000)===0,'excluded '.$x);
rfAssert(nrReward('club_month',100)===0,'cash only');
rfAssert(!nrValidCode('bad')&&nrValidCode(str_repeat('a',24)),'token');
if(!getenv('NUMI_TEST_MYSQL_DSN')){echo "REFERRAL_UNIT_PASS; MYSQL_NOT_RUN\n";exit(0);}
$db=new PDO(getenv('NUMI_TEST_MYSQL_DSN'),getenv('NUMI_TEST_MYSQL_USER')?:'root',getenv('NUMI_TEST_MYSQL_PASSWORD')?:'test',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
foreach(['schema.sql','referrals-schema.sql'] as $file){
    $sql=preg_replace('/^--[^\n]*$/m','',file_get_contents(__DIR__.'/../'.$file));
    foreach(explode(';',$sql) as $s)if(trim($s)!=='')$db->exec($s);
}
$a='00000000-0000-4000-8000-000000000101';$b='00000000-0000-4000-8000-000000000102';$c='00000000-0000-4000-8000-000000000103';
foreach([$a,$b,$c] as $id)$db->prepare('INSERT INTO numi_accounts(id) VALUES(?)')->execute([$id]);
function rfOrder(PDO $db,string $account,int $i,string $product,int $price,string $provider='real_wallet',string $status='paid',int $days=15): string {
    $id=sprintf('00000000-0000-4000-8000-%012d',$i);
    $q=$db->prepare("INSERT INTO numi_orders(id,account_id,product_code,resource_id,amount_kopeks,provider,status,verified_at,created_at)
        VALUES(?,?,?,'fixture',?,?,?,DATE_SUB(UTC_TIMESTAMP(),INTERVAL ".$days." DAY),DATE_SUB(UTC_TIMESTAMP(),INTERVAL ".$days." DAY))");
    $q->execute([$id,$account,$product,$price,$provider,$status]);return $id;
}
rfAssert(nrIssue($db,$a)===null&&!nrMine($db,$a)['eligible'],'free account has no link');
rfOrder($db,$a,90,'club_month',49000,'sandbox');
rfOrder($db,$a,91,'club_month',49000,'real_subscription','refunded');
rfOrder($db,$a,92,'club_month',49000,'real_subscription','pending');
rfAssert(nrIssue($db,$a)===null,'test refunded and pending are not eligible');
$qualifying=rfOrder($db,$a,93,'club_month',49000,'real_subscription','paid',90);
$code=nrIssue($db,$a);rfAssert(is_string($code)&&nrIssue($db,$a)===$code,'stable link after paid club, even expired');
$db->beginTransaction();nrBindNew($db,$a,$code);nrBindNew($db,$b,$code);nrBindNew($db,$b,str_repeat('f',24));$db->commit();
$db->exec("UPDATE numi_referral_bindings SET bound_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 60 DAY)");
rfOrder($db,$b,1,'club_month',49000,'real_subscription');
rfOrder($db,$b,2,'club_month',49000,'real_wallet','paid',1);
$report=rfOrder($db,$b,3,'life_full',99000);
rfOrder($db,$b,4,'year_full',49000,'real_wallet','paid',1);
rfOrder($db,$b,5,'redflag_question',49000);
rfOrder($db,$b,6,'life_full',99000,'sandbox');
rfOrder($db,$b,7,'life_full',99000,'real_wallet','pending');
rfOrder($db,$c,8,'life_full',99000);
rfAssert(nrAccrue($db)===4,'four eligible orders including renewal after 30 days');
rfAssert(nrAccrue($db)===0,'repeat idempotency');
$m=nrMine($db,$a);rfAssert($m['invited']===1&&$m['buyers']===1,'counts');
rfAssert($m['calculated_kopeks']===14900&&$m['pending_kopeks']===9900&&$m['spendable_kopeks']===0,'held estimates');
$stats=nrOwnerReport($db,'2000-01-01 00:00:00','2099-01-01 00:00:00');
rfAssert($stats['orders']===4&&$stats['cash_order_kopeks']===246000&&$stats['reward_kopeks']===24800,'owner cash and bonus estimates separate');
rfAssert($stats['spent_kopeks']===null,'unimplemented spending must not be reported as zero');
$db->prepare("UPDATE numi_orders SET status='refunded' WHERE id=?")->execute([$report]);
rfAssert(nrMine($db,$a)['calculated_kopeks']===4900,'refund removed');
$db->prepare("UPDATE numi_orders SET status='refunded' WHERE id=?")->execute([$qualifying]);
rfAssert(nrIssue($db,$a)===null&&!nrMine($db,$a)['eligible'],'qualifying refund disables existing code');
$db->beginTransaction();nrBindNew($db,$c,$code);$db->commit();
$q=$db->prepare("SELECT COUNT(*) FROM numi_referral_bindings WHERE invitee_id=?");$q->execute([$c]);rfAssert((int)$q->fetchColumn()===0,'refunded link cannot invite');
rfOrder($db,$b,94,'year_full',99000,'real_wallet','paid',0);
rfAssert(nrAccrue($db)===0,'no accrual while disqualified');
rfAssert(nrOwnerReport($db,'2000-01-01 00:00:00','2099-01-01 00:00:00')['reward_kopeks']===0,'suspended estimates excluded');
rfOrder($db,$a,95,'club_month',49000,'real_wallet','paid',0);
rfAssert(nrIssue($db,$a)===$code,'repurchase restores original code');
$db->beginTransaction();nrMerge($db,$b,$c);$db->commit();
rfAssert(nrMine($db,$a)['calculated_kopeks']===0,'merged invitee reviewed');
echo "REFERRAL_MYSQL_PASS\n";
