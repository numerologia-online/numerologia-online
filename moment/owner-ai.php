<?php
declare(strict_types=1);
/* Owner-only demo for 300 Moment questions. No wallet, orders, other reports. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private, max-age=0');
function omReply(int $status,array $data): never {
    http_response_code($status);
    echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
function omDate(mixed $value): bool {
    if(!is_string($value)||!preg_match('/^(19|20)\d\d-\d\d-\d\d$/D',$value))return false;
    $date=DateTimeImmutable::createFromFormat('!Y-m-d',$value);
    return $date instanceof DateTimeImmutable&&$date->format('Y-m-d')===$value;
}
try{
    $db=naDB();$account=naCurrent($db);
    if(!naTestOwner($account))omReply(403,['ok'=>false,'error'=>'OWNER_LOGIN_REQUIRED']);
    $catalog=json_decode((string)file_get_contents(__DIR__.'/questions.json'),true,20,JSON_THROW_ON_ERROR);
    if(!isset($catalog['questions'])||count($catalog['questions'])!==300)omReply(503,['ok'=>false,'error'=>'CATALOG_NOT_READY']);
    if($_SERVER['REQUEST_METHOD']==='GET')omReply(200,['ok'=>true,'owner'=>true,'question_count'=>300,'mode'=>'test_only']);
    if($_SERVER['REQUEST_METHOD']!=='POST')omReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    if(!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
        omReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
    $raw=file_get_contents('php://input',false,null,0,2049);
    if(!is_string($raw)||strlen($raw)>2048)omReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $body=json_decode($raw,true,12,JSON_THROW_ON_ERROR);
    if(!is_array($body))omReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $id=$body['question_id']??null;
    if(!is_string($id)||!preg_match('/^[a-z]+-\d{3}$/D',$id))omReply(400,['ok'=>false,'error'=>'INVALID_QUESTION']);
    $q=null;foreach($catalog['questions'] as $item)if(($item['id']??null)===$id){$q=$item;break;}
    if(!$q)omReply(400,['ok'=>false,'error'=>'UNKNOWN_QUESTION']);
    $birth=$body['birth_date']??null;$other=$body['other_date']??null;
    if(!omDate($birth))omReply(400,['ok'=>false,'error'=>'BIRTH_DATE_REQUIRED']);
    if($q['mode']==='partner'&&!omDate($other))omReply(400,['ok'=>false,'error'=>'OTHER_DATE_REQUIRED']);
    if($other!==null&&$other!==''&&!omDate($other))omReply(400,['ok'=>false,'error'=>'INVALID_OTHER_DATE']);
    $moment=$body['moment']??null;
    if($moment!==null&&$moment!==''&&(!is_string($moment)||!preg_match('/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d$/D',$moment)))
        omReply(400,['ok'=>false,'error'=>'INVALID_MOMENT']);
    $configPath=dirname(__DIR__,3).'/private/numi-moment-groq/config.local.php';
    if(!is_file($configPath))omReply(503,['ok'=>false,'error'=>'GROQ_CONFIG_NOT_READY']);
    $config=require $configPath;$key=is_array($config)?($config['groq_api_key']??null):null;
    if(!is_string($key)||!str_starts_with($key,'gsk_'))omReply(503,['ok'=>false,'error'=>'GROQ_CONFIG_NOT_READY']);
    // Connect only the authenticated owner's 300-question test to the separate
    // Cloudflare Worker. The original Groq key never leaves the REG.RU server.
    $proof=hash_hmac('sha256','numi-moment-cloudflare-bridge-v1',$key);
    $payload=[
      'question_id'=>$id,
      'title'=>(string)$q['title'],
      'birth_date'=>$birth,
      'other_date'=>(is_string($other)&&$other!=='')?$other:null,
      'moment'=>(is_string($moment)&&$moment!=='')?$moment:null
    ];
    $encoded=json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $worker='https://numerologia-300-ai.tankraft431.workers.dev/v1/owner-preview';
    $curl=curl_init($worker);
    if($curl===false)omReply(503,['ok'=>false,'error'=>'WORKER_CONNECT_FAILED']);
    curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,
      CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>85,
      CURLOPT_MAXREDIRS=>0,CURLOPT_HTTPHEADER=>[
        'Content-Type: application/json','Accept: application/json',
        'X-Numi-Moment-Proof: '.$proof,
        'User-Agent: NumiMomentOwnerPreview/2.0'
      ],CURLOPT_POSTFIELDS=>$encoded]);
    $response=curl_exec($curl);
    $status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);
    $curlError=curl_errno($curl);
    curl_close($curl);
    if(!is_string($response)||$status!==200||strlen($response)>40000){
      error_log('MOMENT_WORKERS_AI_STATUS:'.($status?:'network').';curl:'.$curlError);
      omReply(503,['ok'=>false,'error'=>'WORKER_MODEL_UNAVAILABLE']);
    }
    $parsed=json_decode($response,true,20,JSON_THROW_ON_ERROR);
    $answer=is_array($parsed)?($parsed['answer']??null):null;
    if(($parsed['ok']??false)!==true||!is_string($answer)||mb_strlen(trim($answer))<70||mb_strlen($answer)>5000)
      omReply(503,['ok'=>false,'error'=>'WORKER_MODEL_OUTPUT_NOT_READY']);
    $answer=str_replace('—',':',trim($answer));
    header('X-Numi-Moment-AI: cloudflare');
    omReply(200,['ok'=>true,'test'=>true,'provider'=>'cloudflare',
      'question_id'=>$id,'question'=>$q['title'],'answer'=>$answer]);
}catch(Throwable $e){
    error_log('MOMENT_OWNER_PREVIEW:'.get_class($e));
    omReply(503,['ok'=>false,'error'=>'TEMPORARILY_UNAVAILABLE']);
}
