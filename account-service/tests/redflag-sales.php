<?php
declare(strict_types=1);
require_once __DIR__.'/../private/core.php';
require_once __DIR__.'/../private/flags-fidelity-live.php';
require_once __DIR__.'/../private/store.php';
function checkSales($v,string $m):void{if(!$v)throw new RuntimeException($m);}
$n=0;$paid=0;
foreach(naRedFlagCatalog() as $c=>$questions)foreach($questions as $id=>$q){
    checkSales($q['ready']===true,'not ready '.$c.'/'.$id);
    foreach([false,true] as $club){
        $item=['product_code'=>'redflag_question','category'=>$c,'question_id'=>$id,'birth_date'=>'1988-07-15','price_kopeks'=>1];
        $quote=naCatalogResolve($item,$club);$prices=[10=>[2000,1000],29=>[3900,1900],49=>[7900,3900]];
        checkSales($quote['price_kopeks']===($q['free']?0:$prices[$q['tier']][$club?1:0]),'price');
        checkSales(naCartResolve([$item],$club,static fn()=>false,[],static fn()=>true)['fulfillment_ready']===!$q['free'],'free/paid');
    }
    if(in_array($c,['flags','infidelity'],true)){
        checkSales(rfsSupportedPaidResource('redflag_question','redflag:'.$c.':'.$id.':1988-07-15')===!$q['free'],'resource');
        foreach(['1988-07-15','1986-09-09','2000-02-29'] as $date){
            $messages=rfsMessages($c,$id,$date);checkSales(count($messages)===2&&$messages[0]['role']==='system'&&$messages[1]['role']==='user','messages');
            checkSales(strlen($messages[1]['content'])>100,'empty context');
        }
    }
    $n++;if(!$q['free'])$paid++;
}
checkSales($n===81&&$paid===73,'catalog coverage');
checkSales(!rfsSupportedPaidResource('redflag_question','redflag:flags:fake:1988-07-15'),'unknown question');
checkSales(!rfsSupportedPaidResource('redflag_question','redflag:flags:hero:2020-02-30'),'invalid date');
echo "REDFLAG_SALES_OFFLINE_PASS 81 cards 73 paid 60 editor payloads\n";
