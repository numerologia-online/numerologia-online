<?php
declare(strict_types=1);
define('NUMI_PARTNERS_TEST',true);
ob_start(); // PHP CLI visit tests use setcookie(); do not emit headers first.
require __DIR__ . '/../numi-partners.php';
function check(bool $ok, string $what): void {
    if (!$ok) throw new RuntimeException('FAIL ' . $what);
    echo 'PASS ' . $what . PHP_EOL;
}
check(npCode('Vasya_1')==='vasya_1' && npCode('x')===null && npCode('../evil')===null, 'strict partner codes');
check(!npOwner(null) && !npOwner(['email'=>'x@example.org','email_verified_at'=>'2026-11-01']), 'owner-only reporting');
$dsn = getenv('NP_TEST_DSN');
if (!$dsn) {echo "MySQL required; set NP_TEST_DSN\n";exit(2);}
$db = new PDO($dsn,'root','partners_test_only',[
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_EMULATE_PREPARES=>false,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
]);
$db->exec("SET time_zone='+00:00'");
$db->exec('CREATE TABLE numi_accounts (id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
$db->exec("CREATE TABLE numi_orders (
    id CHAR(36) PRIMARY KEY,account_id CHAR(36) NOT NULL, product_code VARCHAR(64),
    amount_kopeks INT, currency CHAR(3),provider VARCHAR(50),status VARCHAR(16),
    verified_at DATETIME,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)");
$schema = file_get_contents(__DIR__ . '/../schema.sql');
foreach (explode(';',$schema) as $statement) if (trim($statement) !== '') $db->exec($statement);
check(npTablesReady($db),'isolated schema installed');
$db->exec("INSERT INTO numi_partner_codes(code,label,rate_bps) VALUES
    ('anna','Anna',2500),('vasya','Vasya',2000)");
$anna=(int)$db->query("SELECT id FROM numi_partner_codes WHERE code='anna'")->fetchColumn();
$vasya=(int)$db->query("SELECT id FROM numi_partner_codes WHERE code='vasya'")->fetchColumn();
$account='33333333-3333-4333-8333-333333333333';
$old='44444444-4444-4444-8444-444444444444';
$raw=npToken(); $other=npToken();
$db->prepare('INSERT INTO numi_partner_tokens(token_hash,partner_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))')
    ->execute([hash('sha256',$raw),$anna]);
$db->prepare('INSERT INTO numi_partner_tokens(token_hash,partner_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))')
    ->execute([hash('sha256',$other),$vasya]);
$db->prepare('INSERT INTO numi_accounts(id) VALUES(?),(?)')->execute([$account,$old]);
check(npBind($db,['id'=>$account],$raw),'first touch binds account');
check(!npBind($db,['id'=>$account],$other),'second partner cannot overwrite first touch');
$_COOKIE[NP_COOKIE]=$raw;
check(npVisit($db,'anna',null)['ok'],'valid landing records a click');
check(npVisit($db,'anna',null)['ok'],'duplicate visit accepted');
$count=(int)$db->query('SELECT COUNT(*) FROM numi_partner_clicks')->fetchColumn();
check($count===1,'retries within 30 seconds deduplicate clicks');
$insert=$db->prepare('INSERT INTO numi_orders(id,account_id,product_code,amount_kopeks,currency,provider,status,verified_at,created_at) VALUES(?,?,?,?,?,?,?,?,UTC_TIMESTAMP())');
$base='00000000-0000-4000-8000-';
$orders=[
    ['000000000001',$account,49000,'RUB','yookassa','paid','NOW'],
    ['000000000002',$account,9900,'RUB','yookassa','paid','NOW'],
    ['000000000003',$account,99000,'RUB','yookassa','pending',null],
    ['000000000004',$account,20000,'RUB','yookassa','refunded','NOW'],
    ['000000000005',$account,20000,'RUB','sandbox','paid','NOW'],
];
foreach($orders as [$suffix,$id,$sum,$currency,$provider,$status,$verified]){
    $stmt=$verified===null?'NULL':'UTC_TIMESTAMP()';
    $db->prepare('INSERT INTO numi_orders(id,account_id,product_code,amount_kopeks,currency,provider,status,verified_at,created_at) VALUES(?,?,?,?,?,?,?,' . $stmt . ',UTC_TIMESTAMP())')
        ->execute([$base.$suffix,$id,'full',$sum,$currency,$provider,$status]);
}
$db->prepare("INSERT INTO numi_orders(id,account_id,product_code,amount_kopeks,currency,provider,status,verified_at,created_at)
  VALUES(?,?, 'full',9900,'RUB','yookassa','paid',DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY),DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY))")
  ->execute([$base.'000000000006',$old]);
check(!npBind($db,['id'=>$old],$other),'past customer not attributed retroactively');
$day=(new DateTimeImmutable('now',new DateTimeZone('Europe/Samara')))->format('Y-m-d');
$report=npReport($db,$day,$day);
$rows=array_column($report['partners'],null,'code');
check($rows['anna']['clicks']===1 && $rows['anna']['unique_links']===1,'accurate click and browser count');
check($rows['anna']['accounts']===1 && $rows['anna']['registrations']===1,'new registrations and linked accounts');
check($rows['anna']['buyers']===1 && $rows['anna']['paid_orders']===2,'confirmed buyer and orders');
check($rows['anna']['revenue_kopeks']===58900 && $rows['anna']['commission_kopeks']===14725,'net confirmed revenue and 25 percent commission');
check($rows['vasya']['paid_orders']===0,'other partners do not inherit sales');
$db->prepare("UPDATE numi_orders SET status='refunded' WHERE id=?")->execute([$base.'000000000001']);
$after=npReport($db,$day,$day);
$annaAfter=array_column($after['partners'],null,'code')['anna'];
check($annaAfter['revenue_kopeks']===9900 && $annaAfter['commission_kopeks']===2475,'refunded order immediately excluded from estimates');
echo "All partner integration tests passed\n";
