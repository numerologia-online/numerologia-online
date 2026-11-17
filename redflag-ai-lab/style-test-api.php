<?php
declare(strict_types=1);
/* Owner-only Red Flag NEW PROMPT preview inside Telegram's existing mini-app.
   Never writes answers, charges users, or changes public paid/free products. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
function rfStyleApiReply(int $status,array $data): never {
    http_response_code($status);
    echo json_encode($data,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
}
try {
    if(!naTestOwner(naCurrent(naDB())))rfStyleApiReply(403,['ok'=>false,'error'=>'OWNER_ONLY']);
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST')rfStyleApiReply(405,['ok'=>false,'error'=>'POST_ONLY']);
    if(!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
        rfStyleApiReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
    $raw=file_get_contents('php://input',false,null,0,1025);
    if(!is_string($raw)||strlen($raw)>1024)rfStyleApiReply(400,['ok'=>false,'error'=>'BAD_INPUT']);
    $req=json_decode($raw,true,5,JSON_THROW_ON_ERROR);
    if(!is_array($req)||($req['question_id']??'')!=='say-no'||
       !is_int($req['day']??null)||!is_int($req['month']??null)||
       !checkdate($req['month'],$req['day'],2000))
       rfStyleApiReply(400,['ok'=>false,'error'=>'INVALID_SELECTION']);
    $day=$req['day'];$month=$req['month'];
    $path=dirname(__DIR__,3).'/private/numi-moment-groq/config.local.php';
    if(!is_file($path))rfStyleApiReply(503,['ok'=>false,'error'=>'AI_NOT_READY']);
    $config=require $path;
    $secret=is_array($config)?($config['groq_api_key']??null):null;
    if(!is_string($secret)||!str_starts_with($secret,'gsk_'))
        rfStyleApiReply(503,['ok'=>false,'error'=>'AI_NOT_READY']);
    $proof=hash_hmac('sha256','numi-moment-cloudflare-bridge-v1',$secret);
    $body=json_encode([
        'category'=>'flags','question_id'=>'say-no',
        'title'=>'Уважает женское «нет» или начинает давить?',
        'day'=>$day,'month'=>$month,'followups'=>[]
    ],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    $curl=curl_init('https://numerologia-300-ai.tankraft431.workers.dev/v1/redflag-style-test');
    if($curl===false)rfStyleApiReply(503,['ok'=>false,'error'=>'AI_CONNECT_FAILED']);
    curl_setopt_array($curl,[
        CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>100,
        CURLOPT_MAXREDIRS=>0,CURLOPT_HTTPHEADER=>[
            'Content-Type: application/json','Accept: application/json',
            'X-Numi-Moment-Proof: '.$proof,
            'User-Agent: NumiRedFlagTelegramStyleTest/1.0'
        ],CURLOPT_POSTFIELDS=>$body
    ]);
    $result=curl_exec($curl);
    $status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);
    $errno=curl_errno($curl);
    curl_close($curl);
    if($status!==200||!is_string($result)||strlen($result)>14000){
        error_log('REDFLAG_TELEGRAM_STYLE_TEST_HTTP:'.$status.' CURL:'.$errno);
        rfStyleApiReply(503,['ok'=>false,'error'=>'AI_UNAVAILABLE']);
    }
    $json=json_decode($result,true,8,JSON_THROW_ON_ERROR);
    $answer=$json['answer']??null;
    if(($json['ok']??false)!==true||($json['style_test']??false)!==true||
       ($json['published']??null)!==false||($json['draft_only']??null)!==true||
       ($json['question_id']??null)!=='say-no'||
       ($json['date_key']??null)!==($day.'-'.$month)||
       !is_string($answer)||mb_strlen(trim($answer))<420||mb_strlen($answer)>1800)
       rfStyleApiReply(503,['ok'=>false,'error'=>'INVALID_AI_ANSWER']);
    rfStyleApiReply(200,['ok'=>true,'draft_only'=>true,'published'=>false,
        'style_test'=>true,'question_id'=>'say-no',
        'date_key'=>$day.'-'.$month,'answer'=>trim($answer)]);
} catch(Throwable $e) {
    error_log('REDFLAG_TELEGRAM_STYLE_TEST_ERROR:'.get_class($e));
    rfStyleApiReply(503,['ok'=>false,'error'=>'TEMPORARILY_UNAVAILABLE']);
}
