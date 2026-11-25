<?php
declare(strict_types=1);
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
require dirname(__DIR__,3).'/private/numi-account-20261031/flags-fidelity-live.php';
naHeaders();
header('X-Robots-Tag: noindex, nofollow, noarchive');
try{
    $b=naReadPost();$c=$b['category']??null;$id=$b['question_id']??null;$date=$b['birth_date']??null;
    if(!is_string($c)||!is_string($id)||$id!==rfsFreeId($c)||!is_string($date)||!rfsDate($date))
        naReply(400,['ok'=>false,'error'=>'INVALID_FREE_QUESTION']);
    if(!naAdultBirthDate($date))naReply(400,['ok'=>false,'error'=>'REDFLAG_AGE_RESTRICTED']);
    if(function_exists('set_time_limit'))@set_time_limit(125);
    $a=rfsPermitFree($c,$id,$date,naCurrent(naDB()));
    naReply(200,['ok'=>true,'free'=>true,'ai_generated'=>true,'category'=>$c,'question_id'=>$id,'birth_date'=>$date,'answer'=>$a]);
}catch(JsonException|InvalidArgumentException $e){naReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);}
catch(RuntimeException $e){if($e->getMessage()==='FREE_DAILY_LIMIT')naReply(429,['ok'=>false,'error'=>'FREE_DAILY_LIMIT']);error_log('REDFLAG_FREE:'.get_class($e));naReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);}
catch(Throwable $e){error_log('REDFLAG_FREE:'.get_class($e));naReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);}
