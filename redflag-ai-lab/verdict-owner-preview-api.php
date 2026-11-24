<?php
declare(strict_types=1);
/**
 * VERDICT OWNER-ONLY manual AI preview.
 * This endpoint cannot be used by customers, creates no purchase, and does
 * not touch the customer generator or other sections.
 */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
require_once dirname(__DIR__,3).'/private/numi-account-20261031/verdict-practical-engine.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow, noarchive');
function voReply(int $status,array $body): never {
    http_response_code($status);
    echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
try {
    if(!naTestOwner(naCurrent(naDB())))voReply(403,['ok'=>false,'error'=>'OWNER_ONLY']);
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST')
        voReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    if(!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
        voReply(403,['ok'=>false,'error'=>'ORIGIN_NOT_ALLOWED']);
    if((int)($_SERVER['CONTENT_LENGTH']??0)>4096)
        voReply(413,['ok'=>false,'error'=>'REQUEST_TOO_LARGE']);
    $input=json_decode((string)file_get_contents('php://input'),true,10,JSON_THROW_ON_ERROR);
    $id=$input['question_id']??null;
    $day=$input['day']??null;$month=$input['month']??null;$year=$input['year']??null;
    if(($input['category']??null)!=='verdict'||!is_string($id)||!in_array($id,vpQuestionIds(),true)||
       !is_int($day)||!is_int($month)||!is_int($year)||$year<1900||
       $year>(int)gmdate('Y')||!checkdate($month,$day,$year))
        voReply(400,['ok'=>false,'error'=>'INVALID_VERDICT_REQUEST']);
    $question=null;
    foreach(vpQuestions() as $q)if($q['id']===$id)$question=$q;
    if($question===null)voReply(400,['ok'=>false,'error'=>'VERDICT_QUESTION_NOT_FOUND']);
    if(function_exists('set_time_limit'))@set_time_limit(125);
    $answer=vpGenerateText($question,$day,$month,$year);
    voReply(200,['ok'=>true,'owner'=>true,'draft_only'=>true,'published'=>false,
        'category'=>'verdict','question_id'=>$id,'date_key'=>$day.'-'.$month,
        'model'=>'google/gemini-3-flash-preview','answer'=>$answer]);
} catch(JsonException|InvalidArgumentException $e) {
    voReply(400,['ok'=>false,'error'=>'INVALID_VERDICT_REQUEST']);
} catch(Throwable $e) {
    error_log('VERDICT_OWNER_PREVIEW_FAIL '.(preg_match('/\A[A-Z][A-Z0-9_]{2,70}\z/',$e->getMessage())?$e->getMessage():'INTERNAL_ERROR'));
    voReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);
}
