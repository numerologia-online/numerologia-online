<?php
declare(strict_types=1);
/* Owner-only asynchronous Groq queue for 300 Moment questions, no billing or other reports. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private, max-age=0');
header('X-Content-Type-Options: nosniff');
function mqReply(int $status,array $data): never {
    http_response_code($status);
    echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
function mqDate(mixed $date): bool {
    if(!is_string($date)||!preg_match('/^(19|20)\d\d-\d\d-\d\d$/D',$date))return false;
    $d=DateTimeImmutable::createFromFormat('!Y-m-d',$date);
    return $d instanceof DateTimeImmutable&&$d->format('Y-m-d')===$date;
}
try {
    $db=naDB();$owner=naCurrent($db);
    if(!naTestOwner($owner))mqReply(403,['ok'=>false,'error'=>'OWNER_LOGIN_REQUIRED']);
    $folder=dirname(__DIR__,3).'/private/numi-moment-groq/jobs';
    if(!is_dir($folder))mqReply(503,['ok'=>false,'error'=>'QUEUE_NOT_INSTALLED']);
    if($_SERVER['REQUEST_METHOD']==='GET') {
        $id=$_GET['job']??null;
        if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id))
            mqReply(400,['ok'=>false,'error'=>'JOB_ID_REQUIRED']);
        $result=$folder.'/'.$id.'.result.json';
        if(is_file($result)){
            $out=json_decode((string)file_get_contents($result),true,10,JSON_THROW_ON_ERROR);
            if(!is_array($out)||!is_bool($out['ok']??null))mqReply(503,['ok'=>false,'error'=>'RESULT_CORRUPTED']);
            if($out['ok']===true){
                $answer=$out['answer']??null;
                if(!is_string($answer)||mb_strlen(trim($answer))<80)mqReply(503,['ok'=>false,'error'=>'RESULT_NOT_READY']);
                mqReply(200,['ok'=>true,'status'=>'complete','answer'=>trim($answer)]);
            }
            mqReply(200,['ok'=>true,'status'=>'failed','error'=>is_string($out['error']??null)?$out['error']:'MODEL_UNAVAILABLE']);
        }
        if(is_file($folder.'/'.$id.'.pending.json')||is_file($folder.'/'.$id.'.working.json'))
            mqReply(200,['ok'=>true,'status'=>'pending']);
        mqReply(404,['ok'=>false,'error'=>'JOB_NOT_FOUND']);
    }
    if($_SERVER['REQUEST_METHOD']!=='POST')mqReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    if(!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
        mqReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
    $raw=file_get_contents('php://input',false,null,0,2049);
    if(!is_string($raw)||strlen($raw)>2048)mqReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $body=json_decode($raw,true,10,JSON_THROW_ON_ERROR);
    if(!is_array($body))mqReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $id=$body['question_id']??null;
    if(!is_string($id)||!preg_match('/^[a-z]+-\d{3}$/D',$id))mqReply(400,['ok'=>false,'error'=>'INVALID_QUESTION']);
    $catalog=json_decode((string)file_get_contents(__DIR__.'/questions.json'),true,20,JSON_THROW_ON_ERROR);
    if(!isset($catalog['questions'])||count($catalog['questions'])!==300)
        mqReply(503,['ok'=>false,'error'=>'CATALOG_NOT_READY']);
    $question=null;
    foreach($catalog['questions'] as $item){
        if(($item['id']??null)===$id){$question=$item;break;}
    }
    if(!is_array($question))mqReply(400,['ok'=>false,'error'=>'UNKNOWN_QUESTION']);
    $birth=$body['birth_date']??null;$other=$body['other_date']??null;
    if(!mqDate($birth))mqReply(400,['ok'=>false,'error'=>'BIRTH_DATE_REQUIRED']);
    if(($question['mode']??null)==='partner'&&!mqDate($other))
        mqReply(400,['ok'=>false,'error'=>'OTHER_DATE_REQUIRED']);
    if($other!==null&&$other!==''&&!mqDate($other))mqReply(400,['ok'=>false,'error'=>'INVALID_OTHER_DATE']);
    $moment=$body['moment']??null;
    if($moment!==null&&$moment!==''&&(!is_string($moment)||!preg_match('/^(19|20)\d{2}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d$/D',$moment)||!mqDate(substr($moment,0,10))))
        mqReply(400,['ok'=>false,'error'=>'INVALID_MOMENT']);
    // Only one in-flight owner request at a time; avoid repetitive free API consumption.
    $pending=glob($folder.'/*.{pending,working}.json',GLOB_BRACE);
    if(is_array($pending)&&count($pending)>0)
        mqReply(429,['ok'=>false,'error'=>'PREVIOUS_TEST_STILL_RUNNING']);
    $recent=0;
    foreach((array)glob($folder.'/*.result.json') as $file){
        if(@filemtime($file)>time()-86400)$recent++;
    }
    if($recent>=30)mqReply(429,['ok'=>false,'error'=>'OWNER_TEST_LIMIT_REACHED']);
    $job=bin2hex(random_bytes(16));
    $record=[
        'question_id'=>$id,
        'title'=>(string)$question['title'],
        'birth_date'=>$birth,
        'other_date'=>is_string($other)&&$other!==''?$other:null,
        'moment'=>is_string($moment)&&$moment!==''?$moment:null,
        'created_utc'=>gmdate('c')
    ];
    $json=json_encode($record,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $tmp=$folder.'/'.$job.'.tmp';
    $dest=$folder.'/'.$job.'.pending.json';
    if(file_put_contents($tmp,$json,LOCK_EX)===false)mqReply(503,['ok'=>false,'error'=>'QUEUE_WRITE_FAILED']);
    @chmod($tmp,0600);
    if(!rename($tmp,$dest)){
        @unlink($tmp);
        mqReply(503,['ok'=>false,'error'=>'QUEUE_WRITE_FAILED']);
    }
    mqReply(202,['ok'=>true,'status'=>'pending','job'=>$job]);
}catch(Throwable $e){
    error_log('MOMENT_GROQ_QUEUE:'.get_class($e));
    mqReply(503,['ok'=>false,'error'=>'QUEUE_TEMPORARILY_UNAVAILABLE']);
}
