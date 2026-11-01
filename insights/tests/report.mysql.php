<?php
declare(strict_types=1);
define('NI_TEST',true);require __DIR__.'/../public/numi-insights.php';
function check(bool $ok,string $label):void {if(!$ok)throw new RuntimeException($label);echo "PASS $label\n";}
$base=['id'=>'11111111-1111-4111-8111-111111111111','session'=>'22222222-2222-4222-8222-222222222222','type'=>'click','section'=>'moment','item'=>'q_1','title'=>'Что он чувствует?','source'=>'blogger','campaign'=>'anna'];
check(niEvent($base)['item']==='q_1','valid authored question');
foreach([['type'=>'paid'],['section'=>'<script>'],['title'=>'Дата 09.09.1986'],['title'=>'person@example.org'],['item'=>'../../private'],['title'=>str_repeat('a',181)]] as $bad){try{niEvent(array_replace($base,$bad));throw new RuntimeException('accepted bad event');}catch(InvalidArgumentException $e){echo "PASS invalid event rejected\n";}}
check(!niOwner(null)&&!niOwner(['email'=>'stranger@example.org','email_verified_at'=>'2026-11-01']),'anonymous and non-owner denied');
check(niIsClub('club_monthly')&&!niIsClub('redflag'),'subscription classification');
$dsn=getenv('NI_TEST_DSN');if(!$dsn){echo "MySQL integration skipped: no test DSN\n";exit;}
$db=new PDO($dsn,'root','insights_test_only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$db->exec("SET time_zone='+00:00'");
$db->exec("CREATE TABLE numi_orders(id CHAR(36) PRIMARY KEY,account_id CHAR(36),product_code VARCHAR(64),resource_id VARCHAR(128),amount_kopeks INT,currency CHAR(3),provider VARCHAR(50),status VARCHAR(16),verified_at DATETIME,created_at DATETIME)");niSchema($db);niSchema($db);
$insert=$db->prepare('INSERT IGNORE INTO numi_insights_events(id,session_id,event_type,section,item,title,source,campaign,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
$sid=$base['session'];$account='33333333-3333-4333-8333-333333333333';
$types=['impression','click','open','checkout_once','checkout_club'];foreach($types as $i=>$type){$id=sprintf('00000000-0000-4000-8000-%012d',$i+1);$args=[$id,$sid,$type,'moment','q_1','Что он чувствует?','blogger','anna','2026-11-01 08:00:00'];$insert->execute($args);$insert->execute($args);}
$insert->execute(['00000000-0000-4000-8000-000000000020',$sid,'page','moment','-','300 вопросов','blogger','anna','2026-10-31 20:30:00']);
$intent=$db->prepare('INSERT INTO numi_insights_intents VALUES(?,?,?,?,?,?,?,?,?,?)');
foreach(['once','club'] as $i=>$plan)$intent->execute([sprintf('00000000-0000-4000-8000-%012d',30+$i),$sid,$account,'moment','q_1','Что он чувствует?',$plan,'blogger','anna','2026-11-01 08:00:00']);
$order=$db->prepare('INSERT INTO numi_orders VALUES(?,?,?,?,?,?,?,?,?,?,?)');
$fixtures=[['moment','paid','bank','2026-11-01 08:05:00',9900],['club_monthly','paid','bank','2026-11-01 08:06:00',49000],['moment','pending','bank',null,9900],['moment','refunded','bank','2026-11-01 08:05:00',9900],['moment','paid','sandbox','2026-11-01 08:05:00',9900],['moment','paid','bank',null,9900],['moment','paid','bank','2026-11-01 08:05:00',0]];
foreach($fixtures as $i=>[$product,$status,$provider,$verified,$amount])$order->execute([sprintf('00000000-0000-4000-8000-%012d',50+$i),$account,$product,'q_1',$amount,'RUB',$provider,$status,$verified,'2026-11-01 08:04:00']);
$r=niReport($db,'2026-11-01','2026-11-01');
check($r['totals']['orders']===2,'only provider-confirmed non-test payments count');
check($r['totals']['subscriptions']===1&&(float)$r['totals']['revenue']===589.0,'subscription and revenue correct');
check($r['totals']['attributed']===2&&$r['totals']['unattributed']===0,'last eligible checkout attribution');
$q=array_values(array_filter($r['rows'],fn($x)=>$x['item']==='q_1'))[0];
check($q['clicks']===1&&$q['impressions']===1,'event UUID deduplicates delivery retries');
check($q['ctr']===100.0&&$q['orders']===2&&$q['subscriptions']===1,'question funnel and CTR correct');
check($r['totals']['sessions']===1&&count($r['days'])===1,'Samara timezone includes prior UTC evening');
check($r['sources'][0]['orders']===2,'campaign gets confirmed orders');
echo "MySQL report integration passed\n";
