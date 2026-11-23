<?php
declare(strict_types=1);
/** Live free first question in Family and Household. No owner-only bypass. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
require dirname(__DIR__,3).'/private/numi-account-20261031/family-live.php';
naHeaders();
header('X-Robots-Tag: noindex, nofollow, noarchive');
try {
    if(function_exists('set_time_limit'))@set_time_limit(125);
    $body=naReadPost();
    if(($body['question_id']??null)!=='independent')
        naReply(400,['ok'=>false,'error'=>'INVALID_QUESTION']);
    $date=naCatalogDate($body['birth_date']??null);
    if($date===null)naReply(400,['ok'=>false,'error'=>'INVALID_BIRTH_DATE']);
    [$y,$m,$d]=array_map('intval',explode('-',$date));
    if($y>(int)gmdate('Y'))naReply(400,['ok'=>false,'error'=>'INVALID_BIRTH_DATE']);
    $db=naDB();$account=naCurrent($db);
    $answer=nfPermitFree($date,$account,static fn():string=>nfEnsureAnswer('independent',$date));
    naReply(200,['ok'=>true,'free'=>true,'ai_generated'=>true,
        'question_id'=>'independent','date_key'=>$d.'-'.$m,'answer'=>$answer]);
}catch(JsonException|InvalidArgumentException $e){
    naReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
}catch(RuntimeException $e){
    if($e->getMessage()==='FREE_DAILY_LIMIT')
        naReply(429,['ok'=>false,'error'=>'FREE_DAILY_LIMIT']);
    error_log('FAMILY_FREE:'.$e->getMessage());
    naReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);
}catch(Throwable $e){
    error_log('FAMILY_FREE_UNEXPECTED:'.get_class($e));
    naReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);
}
