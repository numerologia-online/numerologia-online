<?php
declare(strict_types=1);
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
require dirname(__DIR__,3).'/private/numi-account-20261031/money-editor-live.php';
naHeaders();header('X-Robots-Tag: noindex, nofollow, noarchive');
try{
    $body=naReadPost();
    if(($body['question_id']??null)!=='gift')naReply(400,['ok'=>false,'error'=>'INVALID_FREE_QUESTION']);
    $date=naCatalogDate($body['birth_date']??null);
    if(!is_string($date)||!meDate($date))naReply(400,['ok'=>false,'error'=>'INVALID_BIRTH_DATE']);
    if(!naAdultBirthDate($date))naReply(400,['ok'=>false,'error'=>'REDFLAG_AGE_RESTRICTED']);
    if(function_exists('set_time_limit'))@set_time_limit(125);
    $a=meFree($date,naCurrent(naDB()));
    naReply(200,array_merge(['ok'=>true,'free'=>true,'question_id'=>'gift','birth_date'=>$date],$a));
}catch(JsonException|InvalidArgumentException $e){naReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);}
catch(Throwable $e){error_log('MONEY_EDITOR_ENDPOINT:'.get_class($e));naReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);}
