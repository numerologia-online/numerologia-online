<?php
declare(strict_types=1);
require dirname(__DIR__).'/account-service/private/family-household-five-points-pilot.php';
function nfPilotAssert(bool $condition,string $message): void {
    if(!$condition)throw new RuntimeException('FAMILY_PILOT_TEST_FAILED '.$message);
}
$dictionary=nfhPilotEnergies();
nfPilotAssert(count($dictionary)===22,'22 meanings');
$cases=[
  [15,7,1987,-4,'Скучные повседневные'],
  [15,7,2000,-4,'Скучные повседневные'],
  [4,4,1987,4,'Склонен поддерживать'],
  [4,7,1987,0,'Противоречивый бытовой'],
  [4,10,1987,1,'Бытовая включённость'],
  [15,4,1987,0,'Противоречивый бытовой'],
  [22,7,1987,-4,'Скучные повседневные']
];
foreach($cases as [$d,$m,$y,$score,$verdict]){
    $result=nfhPilotBrief($d,$m,$y);
    nfPilotAssert(count($result['five'])===5,'exactly five positions');
    nfPilotAssert($result['five'][0]['energy']===ni22($d),'day first');
    nfPilotAssert($result['five'][1]['energy']===$m,'month second');
    nfPilotAssert($result['score']===$score,'main pair weighted equally');
    nfPilotAssert(str_starts_with($result['verdict'],$verdict),'anchored verdict');
    $model=nfhPilotModelData($result);
    nfPilotAssert(count($model['две_равные_главные_позиции'])===2,'2 anchors');
    nfPilotAssert(count($model['три_уточняющие_позиции_не_меняют_вывод'])===3,'3 supports');
    $json=json_encode($model,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    nfPilotAssert(!str_contains($json,(string)$y),'no birth year in model request');
    nfPilotAssert(!str_contains($json,'"energy"'),'no energy numbers in model request');
}
nfPilotAssert(nfhPilotBrief(15,7,1987)['verdict']===nfhPilotBrief(15,7,2000)['verdict'],
    'extra points do not invert 15/7');
nfPilotAssert(str_contains(nfhPilotPrompt(),'50/50'),'50/50 in writer prompt');
nfPilotAssert(str_contains(nfhPilotPrompt(),'Три остальные'),'secondary point rule');
echo "FAMILY_HOUSEHOLD_5_POINT_PILOT_STATIC_PASS\n";
