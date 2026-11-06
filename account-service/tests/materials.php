<?php
declare(strict_types=1);
require __DIR__.'/../private/core.php';require __DIR__.'/../private/fulfillment.php';
$root=$argv[1]??'';$checks=0;
foreach([
 ['year_full','year:2026:1986-09-09'],['life_full','life:1986-09-09'],['compatibility_full','pair:1986-09-09:1997-05-12'],['redflag_question','redflag:money:generosity:1986-09-09'],['redflag_question','redflag:love:romance:1986-09-09'],['club_month','club'],['school_week','school'],['child_full_v1','child:2020-02-29']
] as[$code,$resource]){
 try{$doc=naMaterialBuild($code,$resource,$root);if(!$doc['sections'])throw new RuntimeException('Empty doc');echo $code.' ready '.count($doc['sections'])." sections\n";$checks++;}
 catch(Throwable $e){echo $code.' BLOCKED '.$e->getMessage()."\n";}
}
$rf=naMaterialBuild('redflag_question','redflag:money:generosity:1986-09-09',$root);
assert(count($rf['sections'])===1&&count($rf['sections'][0]['paragraphs'])===1);
try{naMaterialBuild('moment_question','moment:love-001:12:00',$root);throw new LogicException('Moment sold');}catch(RuntimeException $e){$checks++;}
try{naMaterialRead('../core.php',$root);throw new LogicException('Traversal');}catch(RuntimeException $e){$checks++;}
echo "PASS $checks material checks\n";
