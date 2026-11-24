<?php
declare(strict_types=1);
/** Truly free personal Gemini answer for first Love Languages question. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
require dirname(__DIR__,3).'/private/numi-account-20261031/language-live.php';
naHeaders();
header('X-Robots-Tag: noindex, nofollow, noarchive');
try {
    if(function_exists('set_time_limit'))@set_time_limit(125);
    $body=naReadPost();
    if(($body['question_id']??null)!=='love-language')
        naReply(400,['ok'=>false,'error'=>'INVALID_QUESTION']);
    $date=naCatalogDate($body['birth_date']??null);
    if($date===null)naReply(400,['ok'=>false,'error'=>'INVALID_BIRTH_DATE']);
    [$year,$month,$day]=array_map('intval',explode('-',$date));
    if($year>(int)gmdate('Y'))naReply(400,['ok'=>false,'error'=>'INVALID_BIRTH_DATE']);
    $db=naDB();$account=naCurrent($db);
    $answer=$account!==null&&naTestOwner($account)
        ?nlFreshAnswer('love-language',$date)
        :nlPermitFree($date,$account,static fn():string=>nlEnsureAnswer('love-language',$date));
    naReply(200,['ok'=>true,'free'=>true,'ai_generated'=>true,
        'question_id'=>'love-language','date_key'=>$day.'-'.$month,'answer'=>$answer]);
}catch(JsonException|InvalidArgumentException $e){
    naReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
}catch(RuntimeException $e){
    if($e->getMessage()==='FREE_DAILY_LIMIT')
        naReply(429,['ok'=>false,'error'=>'FREE_DAILY_LIMIT']);
    $code=$e->getMessage();
    if(!preg_match('/\A[A-Z][A-Z0-9_]{2,79}\z/D',$code))$code='LANGUAGE_UNEXPECTED';
    error_log('LANGUAGE_FREE:'.$code);
    naReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);
}catch(Throwable $e){
    error_log('LANGUAGE_FREE_UNEXPECTED:'.get_class($e));
    naReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);
}
