<?php
declare(strict_types=1);
require __DIR__.'/../private/core.php';
require __DIR__.'/../private/store.php';
require __DIR__.'/../private/fulfillment.php';
$count=0;
function check(bool $condition,string $message): void {global $count;$count++;if(!$condition)throw new RuntimeException($message);}
function invalid(callable $call,string $message): void {try{$call();}catch(InvalidArgumentException|RuntimeException $e){check(true,$message);return;}throw new RuntimeException($message);}
check(naRedFlagPaidStatus('ready') && naRedFlagPaidStatus('complete'),
    'published Red Flag text allows ready and complete statuses');
check(!naRedFlagPaidStatus('in-progress') && !naRedFlagPaidStatus('draft')
    && !naRedFlagPaidStatus(null),
    'unapproved Red Flag text never charged');
$subjects=[
 ['product_code'=>'year_full','birth_date'=>'1986-09-09','year'=>2026],
 ['product_code'=>'life_full','birth_date'=>'1986-09-09'],
 ['product_code'=>'compatibility_full','birth_date'=>'1986-09-09','partner_birth_date'=>'1997-05-12'],
 ['product_code'=>'child_full_v1','birth_date'=>'2020-02-29'],
];
foreach($subjects as $subject){foreach([false,true] as $club){$q=naCatalogResolve($subject,$club);check($q['price_kopeks']===($club?49000:99000),'report price');}}
foreach(['club_month'=>49000,'school_week'=>14900] as $code=>$amount){foreach([false,true] as $club)check(naCatalogResolve(['product_code'=>$code],$club)['price_kopeks']===$amount,'subscription price');}
foreach([['generosity',2000,1000],['words-or-deeds',3900,1900],['solve-or-create',7900,3900]] as [$id,$regular,$member]){
 foreach([false,true] as $club){$q=naCatalogResolve(['product_code'=>'redflag_question','birth_date'=>'1986-09-09','category'=>'money','question_id'=>$id],$club);check($q['price_kopeks']===($club?$member:$regular),'redflag tiers');}
}
foreach([false,true] as $club){
 $yesno=naCatalogResolve(['product_code'=>'yesno_question','question_id'=>'yn-man-001','question_time'=>'00:00'],$club);
 check($yesno['price_kopeks']===0,'yesno never independently priced');
 check($yesno['member_included']===$club && $yesno['kind']==='club_included','yesno only included by Club');
 check($yesno['availability']===($club?'CLUB_ACTIVE':'CLUB_REQUIRED'),'yesno Club access state');
 $moment=naCatalogResolve(['product_code'=>'moment_question','question_id'=>'love-001','question_time'=>'23:59'],$club);
 check($moment['price_kopeks']===($club?2500:5000)&&$moment['availability']==='NOT_LAUNCHED','moment closed');
}
invalid(fn()=>naCatalogResolve(['product_code'=>'life_full','birth_date'=>'2026-02-30'],false),'invalid date');
invalid(fn()=>naCatalogResolve(['product_code'=>'yesno_question','question_id'=>'yn-man-999','question_time'=>'12:00'],false),'unknown question');
invalid(fn()=>naCatalogResolve(['product_code'=>'yesno_question','question_id'=>'yn-man-001','question_time'=>'24:00'],false),'invalid time');
invalid(fn()=>naCatalogResolve(['product_code'=>'hacked','price_kopeks'=>1],false),'unknown product');
$owns=fn()=>false;
foreach([false,true] as $club) {
 $freeOnly=naCartResolve([['product_code'=>'yesno_question','question_id'=>'yn-man-001','question_time'=>'12:34']],$club,$owns);
 check($freeOnly['total_kopeks']===0 && !$freeOnly['fulfillment_ready'],'Yes/No never chargeable in cart');
}
$cart=naCartResolve([$subjects[0],['product_code'=>'club_month']],false,$owns);
check($cart['total_kopeks']===148000 && $cart['club_activation_required'],'no speculative club discount');
check(!$cart['fulfillment_ready'],'unconnected fulfillment blocked');
$member=naCartResolve([$subjects[0]],true,$owns,['year_full']);check($member['total_kopeks']===49000,'confirmed club discount');
$cart=naCartResolve([$subjects[0]+['price_kopeks'=>1,'sale_ready'=>true]],false,$owns);check($cart['total_kopeks']===99000&&!$cart['fulfillment_ready'],'ignore browser price and readiness');
$cart=naCartResolve([$subjects[0]],false,fn()=>true,['year_full']);check(!$cart['fulfillment_ready']&&$cart['items'][0]['access_active'],'owned access blocked');
invalid(fn()=>naCartResolve([$subjects[0],$subjects[0]],false,$owns),'duplicates');
invalid(fn()=>naCartResolve([],false,$owns),'empty cart');
invalid(fn()=>naCartResolve(array_fill(0,21,$subjects[0]),false,$owns),'cart limit');
check(!naStoreEnabled([]),'payments default off');check(!naStoreEnabled(['store_test_enabled'=>true,'secret_key'=>'live_not-a-key','shop_id'=>'1']),'live credential refused');
$checkout=['id'=>'checkout-test','provider_payment_id'=>'provider-test','amount_kopeks'=>99000];
$payment=['id'=>'provider-test','test'=>true,'status'=>'succeeded','paid'=>true,'amount'=>['value'=>'990.00','currency'=>'RUB'],'metadata'=>['numi_checkout'=>'checkout-test']];
naStoreVerifyPayment($payment,$checkout);check(true,'verified payment accepted');
foreach(['test'=>false,'id'=>'other','amount'=>['value'=>'1.00','currency'=>'RUB'],'metadata'=>['numi_checkout'=>'other']] as $key=>$value){$bad=$payment;$bad[$key]=$value;invalid(fn()=>naStoreVerifyPayment($bad,$checkout),'unverified payment rejected '.$key);}
check(naStoreAmount(19)==='0.19'&&naStoreAmount(99000)==='990.00','money precision');
echo 'PASS '.$count." store checks\n";

class StoreTestDB extends PDO {
    public function prepare(string $query,array $options=[]): PDOStatement|false {
        $query=str_replace([' FOR UPDATE','INSERT IGNORE'],['','INSERT OR IGNORE'],$query);
        return parent::prepare($query,$options);
    }
}
$db=new StoreTestDB('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
@$db->sqliteCreateFunction('UTC_TIMESTAMP',fn()=>gmdate('Y-m-d H:i:s'));
$db->exec('CREATE TABLE numi_accounts(id TEXT PRIMARY KEY); CREATE TABLE numi_checkouts(id TEXT PRIMARY KEY); CREATE TABLE numi_checkout_items(checkout_id TEXT,order_id TEXT); CREATE TABLE numi_orders(id TEXT PRIMARY KEY,account_id TEXT,product_code TEXT,resource_id TEXT,status TEXT,verified_at TEXT); CREATE TABLE numi_entitlements(id TEXT PRIMARY KEY,account_id TEXT,order_id TEXT UNIQUE,product_code TEXT,resource_id TEXT,status TEXT,expires_at TEXT)');
$db->exec("INSERT INTO numi_accounts VALUES('alice'); INSERT INTO numi_checkouts VALUES('checkout-test'); INSERT INTO numi_orders VALUES('order-1','alice','year_full','year:2026:1986-09-09','pending',NULL); INSERT INTO numi_checkout_items VALUES('checkout-test','order-1')");
$checkout['account_id']='alice';
$pending=$payment;$pending['status']='pending';$pending['paid']=false;
naStoreApply($db,$checkout,$pending);check((int)$db->query('SELECT COUNT(*) FROM numi_entitlements')->fetchColumn()===0,'pending does not grant');
naStoreApply($db,$checkout,$payment);naStoreApply($db,$checkout,$payment);
check((int)$db->query('SELECT COUNT(*) FROM numi_entitlements')->fetchColumn()===1,'repeated notification grants exactly once');
check($db->query('SELECT status FROM numi_orders')->fetchColumn()==='paid','paid state');
$refunded=$payment;$refunded['refunded_amount']=['value'=>'990.00','currency'=>'RUB'];naStoreApply($db,$checkout,$refunded);
check($db->query('SELECT status FROM numi_orders')->fetchColumn()==='refunded','refund order');
check($db->query('SELECT status FROM numi_entitlements')->fetchColumn()==='revoked','refund revokes');
naStoreApply($db,$checkout,$payment);check($db->query('SELECT status FROM numi_entitlements')->fetchColumn()==='revoked','old success cannot resurrect refunded access');
$db->exec('CREATE TABLE numi_subscription_settings(account_id TEXT,product_code TEXT,auto_renew INT)');
$db->exec("INSERT INTO numi_orders VALUES('order-2','alice','school_week','school','pending',NULL); INSERT INTO numi_checkout_items VALUES('checkout-test','order-2')");
$cancel=$payment;$cancel['status']='canceled';$cancel['paid']=false;naStoreApply($db,$checkout,$cancel);
check($db->query("SELECT status FROM numi_orders WHERE id='order-2'")->fetchColumn()==='cancelled','cancellation');
check((int)$db->query('SELECT COUNT(*) FROM numi_entitlements')->fetchColumn()===1,'cancel does not grant');
check(naStoreExpiry('club_month',new DateTimeImmutable('2027-01-31 12:34:00'))==='2027-02-28 12:34:00','calendar month clamped');
check(naStoreExpiry('school_week',new DateTimeImmutable('2026-11-06 12:34:00'))==='2026-11-13 12:34:00','seven days');
echo 'PASS '.$count." total store checks (SQLite settlement; MySQL concurrency not exercised)\n";

$catalog=json_decode(file_get_contents(__DIR__.'/../../store-catalog.json'),true,32,JSON_THROW_ON_ERROR);
foreach(['redflag'=>'redflag_question','yesno'=>'yesno_question','moment'=>'moment_question'] as $group=>$code) {
    foreach($catalog[$group] as $question) foreach([false,true] as $club) {
        $input=['product_code'=>$code,'question_id'=>$question['id'],'category'=>$question['category'],'birth_date'=>'1986-09-09','question_time'=>'12:34'];
        $quote=naCatalogResolve($input,$club);check($quote['product_code']===$code,'catalog coverage '.$question['id']);
    }
}

$private=json_decode((string)file_get_contents(__DIR__.'/../private/redflag-catalog.json'),true,32,JSON_THROW_ON_ERROR);
check(($private['version']??null)===1,'private catalog version');
$groups=['money'=>'money-questions','love'=>'love','flags'=>'flags','infidelity'=>'infidelity',
    'intimacy'=>'intimacy','family'=>'family','language'=>'language','verdict'=>'verdict'];
$seen=0;
foreach($groups as $category=>$bank){
    $original=json_decode((string)file_get_contents(__DIR__.'/../../data/redflag/banks/'.$bank.'.json'),true,32,JSON_THROW_ON_ERROR);
    check(count($private['questions'][$category]??[])===count($original['questions']), 'no extra or missing '.$category);
    foreach($original['questions'] as $index=>$question){
        $id=$question['id'];$meta=$private['questions'][$category][$id]??null;
        check(is_array($meta) && ($meta['tier']??null)===$question['priceRub']
            && ($meta['free']??null)===($index===0)
            && is_bool($meta['ready']??null), 'one tier and status source: '.$category.'/'.$id);
        $input=['product_code'=>'redflag_question','category'=>$category,
            'question_id'=>$id,'birth_date'=>'1986-09-09'];
        foreach([false,true] as $club){
            $quote=naCatalogResolve($input,$club);
            $expectedPrices=[10=>[2000,1000],29=>[3900,1900],49=>[7900,3900]];
            $expected=$index===0?0:$expectedPrices[$question['priceRub']][$club?1:0];
            check($quote['price_kopeks']===$expected,'one server price: '.$category.'/'.$id);
            $expectedStatus=$index===0?'FREE_PREVIEW':
                ($meta['ready']?'FULFILLMENT_NOT_CONNECTED':'AUTHOR_TEXT_NOT_CONFIRMED');
            check($quote['availability']===$expectedStatus,'one readiness: '.$category.'/'.$id);
            if($index!==0){
                $canBuy=naCartResolve([$input],$club,fn()=>false,[],fn()=>true);
                check($canBuy['fulfillment_ready']===$meta['ready'],
                    'draft cannot be charged even when material adapter returns ready: '.$category.'/'.$id);
            }
        }
        $seen++;
    }
}
check($seen===81,'80 core questions plus one bonus must be registered');
invalid(fn()=>naCatalogResolve(['product_code'=>'redflag_question',
    'category'=>'money','question_id'=>'invented','birth_date'=>'1986-09-09'],false),
    'unregistered question cannot be charged');
invalid(fn()=>naCatalogResolve(['product_code'=>'redflag_question',
    'category'=>'../money','question_id'=>'generosity','birth_date'=>'1986-09-09'],false),
    'unsafe category cannot resolve to a purchasable item');
check(!str_contains((string)file_get_contents(__DIR__.'/../private/core.php'),
    '$catalog=json_decode(\'{"money"'), 'duplicated hard-coded PHP question list removed');

echo 'PASS '.$count." checks including every public question and both tariffs\n";
