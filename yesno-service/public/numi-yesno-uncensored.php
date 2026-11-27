<?php
declare(strict_types=1);
// Isolated adult owner preview. Standard Yes/No endpoint and quotas are untouched.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function ynUncensoredReply(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST')
        ynUncensoredReply(405,['ok'=>false,'error'=>'POST_REQUIRED']);
    $private=dirname(__DIR__,3).'/private';
    $accountCore=$private.'/numi-account-20261031/core.php';
    if (!is_file($accountCore)) ynUncensoredReply(503,['ok'=>false,'error'=>'ACCESS_UNAVAILABLE']);
    require_once $accountCore;
    $origin=(string)($_SERVER['HTTP_ORIGIN']??'');
    $fetchSite=(string)($_SERVER['HTTP_SEC_FETCH_SITE']??'');
    if (($origin!=='' && !in_array($origin,naAllowedOrigins(),true)) || $fetchSite==='cross-site')
        ynUncensoredReply(403,['ok'=>false,'error'=>'FORBIDDEN_ORIGIN']);
    $account=naCurrent(naDB());
    // Strict verified owner session only, never subscriber access in this preview.
    if (!naTestOwner($account))
        ynUncensoredReply(403,['ok'=>false,'error'=>'UNCENSORED_OWNER_ONLY']);
    $raw=file_get_contents('php://input',false,null,0,2049);
    if (!is_string($raw)||strlen($raw)>2048) ynUncensoredReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $request=json_decode($raw,true);
    if (!is_array($request)) ynUncensoredReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $q=$request['question']??null;
    $clock=$request['time']??null;
    if (!is_string($q)||!preg_match('/^yn-(man|love|work|money|choice|future|home)-[0-9]{3}$/D',$q))
        ynUncensoredReply(404,['ok'=>false,'error'=>'UNCENSORED_NOT_READY']);
    if (!is_string($clock)||!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D',$clock))
        ynUncensoredReply(400,['ok'=>false,'error'=>'INVALID_TIME']);
    $sum=array_sum(array_map('intval',str_split(str_replace(':','',$clock))));
    while ($sum>9) $sum=array_sum(array_map('intval',str_split((string)$sum)));
    $path=$private.'/numi-yesno-v1/uncensored/answer-bank.json';
    if (!is_file($path)) ynUncensoredReply(404,['ok'=>false,'error'=>'UNCENSORED_NOT_READY']);
    $bank=json_decode((string)file_get_contents($path),true);
    if (!is_array($bank)||($bank['mode']??'')!=='uncensored'||($bank['calculation_version']??'')!=='time-digit-sum-v1')
        ynUncensoredReply(503,['ok'=>false,'error'=>'ACCESS_UNAVAILABLE']);
    $data=$bank['questions'][$q]??null;
    if (!is_array($data)||($data['question_id']??'')!==$q||($data['calculation_version']??'')!=='time-digit-sum-v1'
        ||!in_array($data['status']??'', ['draft','approved'],true))
        ynUncensoredReply(404,['ok'=>false,'error'=>'UNCENSORED_NOT_READY']);
    $answer=$data['answers'][(string)$sum]??null;
    if (!is_string($answer)||trim($answer)==='')
        ynUncensoredReply(404,['ok'=>false,'error'=>'UNCENSORED_NOT_READY']);
    ynUncensoredReply(200,['ok'=>true,'question_id'=>$q,'answer'=>$answer,'mode'=>'uncensored']);
} catch (Throwable $error) {
    error_log('NUMI_YESNO_UNCENSORED:'.get_class($error));
    ynUncensoredReply(503,['ok'=>false,'error'=>'ACCESS_UNAVAILABLE']);
}
