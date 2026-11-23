<?php
declare(strict_types=1);
require dirname(__DIR__).'/account-service/private/family-household-five-points-pilot.php';
function nfPilotAssert(bool $condition,string $message): void {
    if(!$condition)throw new RuntimeException('FAMILY_PILOT_TEST_FAILED '.$message);
}
$dictionary=nfhPilotEnergies();
nfPilotAssert(count($dictionary)===22,'22 meanings');
$cases=[[15,7,1987],[15,7,2000],[4,4,1987],[4,7,1987],[4,10,1987],[15,4,1987],[22,7,1987]];
foreach($cases as [$d,$m,$y]){
    $result=nfhPilotBrief($d,$m,$y);
    nfPilotAssert(count($result['five'])===5,'exactly five positions');
    nfPilotAssert($result['five'][0]['energy']===ni22($d),'leading day');
    nfPilotAssert($result['five'][1]['energy']===$m,'month second');
    nfPilotAssert(!isset($result['score'])&&!isset($result['verdict']),'no mechanical scores');
    $model=nfhPilotModelData($result);
    nfPilotAssert(isset($model['ведущая_энергия_дня']),'day leading');
    nfPilotAssert(count($model['четыре_обязательных_влияния'])===4,'all four supports');
    $json=json_encode($model,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    nfPilotAssert(!str_contains($json,(string)$y),'no year in model text');
    nfPilotAssert(!str_contains($json,'"energy"'),'no energy numbers leaked');
}
nfPilotAssert(nfhPilotBrief(15,7,1987)['five']!==nfhPilotBrief(15,7,2000)['five'],
    'other points vary by year');
$prompt=nfhPilotPrompt();
nfPilotAssert(str_contains($prompt,'Энергия дня рождения ВЕДУЩАЯ'),'lead');
nfPilotAssert(str_contains($prompt,'ВСЕ четыре остальные'),'all others');
nfPilotAssert(!str_contains($prompt,'50/50'),'no artificial weights');
echo "FAMILY_HOUSEHOLD_5_POINT_PILOT_STATIC_PASS\n";
