<?php
declare(strict_types=1);
/* Private editorial review of 300 Moment questions. NEVER accepts payments or publishes answers. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('Cache-Control: no-store, private, max-age=0');

function mrReply(int $status,array $data): never {
    http_response_code($status);
    echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
function mrValue(mixed $value,int $max): string {
    if(!is_string($value)||mb_strlen($value,'UTF-8')>$max)return '';
    return trim($value);
}
function mrRead(string $path): ?array {
    if(!is_file($path))return null;
    $raw=file_get_contents($path);
    if(!is_string($raw)||strlen($raw)>26000)return null;
    $record=json_decode($raw,true);
    return is_array($record)?$record:null;
}
try {
    $db=naDB();
    $owner=naCurrent($db);
    if(!naTestOwner($owner))mrReply(403,['ok'=>false,'error'=>'OWNER_LOGIN_REQUIRED']);
    $catalog=json_decode((string)file_get_contents(__DIR__.'/questions.json'),true,20,JSON_THROW_ON_ERROR);
    if(!isset($catalog['questions'])||!is_array($catalog['questions'])||count($catalog['questions'])!==300)
        mrReply(503,['ok'=>false,'error'=>'CATALOG_NOT_READY']);
    $questions=[];
    foreach($catalog['questions'] as $q){
        if(isset($q['id'])&&is_string($q['id'])&&preg_match('/^[a-z]+-\d{3}$/D',$q['id']))
            $questions[$q['id']]=$q;
    }
    if(count($questions)!==300)mrReply(503,['ok'=>false,'error'=>'CATALOG_NOT_READY']);
    $directory=dirname(__DIR__,3).'/private/numi-moment-editorial-review';
    if(!is_dir($directory)&&!mkdir($directory,0700,true)&&!is_dir($directory))
        mrReply(503,['ok'=>false,'error'=>'REVIEW_STORAGE_UNAVAILABLE']);
    @chmod($directory,0700);
    if($_SERVER['REQUEST_METHOD']==='GET'){
        $id=$_GET['question']??null;
        if($id!==null){
            if(!is_string($id)||!isset($questions[$id]))mrReply(400,['ok'=>false,'error'=>'UNKNOWN_QUESTION']);
            $record=mrRead($directory.'/'.$id.'.json');
            mrReply(200,['ok'=>true,'question_id'=>$id,'record'=>$record]);
        }
        $statuses=[];
        $counts=['new'=>0,'draft'=>0,'revision'=>0,'approved'=>0];
        foreach($questions as $qid=>$q){
            $record=mrRead($directory.'/'.$qid.'.json');
            $status=$record['status']??'new';
            if(!isset($counts[$status]))$status='new';
            $statuses[$qid]=$status;
            $counts[$status]++;
        }
        mrReply(200,['ok'=>true,'total'=>300,'counts'=>$counts,'statuses'=>$statuses]);
    }
    if($_SERVER['REQUEST_METHOD']!=='POST')mrReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    if(!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
        mrReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
    if(!str_starts_with(strtolower((string)($_SERVER['CONTENT_TYPE']??'')),'application/json'))
        mrReply(415,['ok'=>false,'error'=>'JSON_REQUIRED']);
    $raw=file_get_contents('php://input',false,null,0,17001);
    if(!is_string($raw)||strlen($raw)>17000)mrReply(413,['ok'=>false,'error'=>'REVIEW_TOO_LARGE']);
    $body=json_decode($raw,true,12,JSON_THROW_ON_ERROR);
    if(!is_array($body))mrReply(400,['ok'=>false,'error'=>'INVALID_JSON']);
    $id=$body['question_id']??null;
    if(!is_string($id)||!isset($questions[$id]))mrReply(400,['ok'=>false,'error'=>'UNKNOWN_QUESTION']);
    $action=$body['action']??null;
    if(!in_array($action,['save_draft','request_revision','approve'],true))
        mrReply(400,['ok'=>false,'error'=>'INVALID_REVIEW_ACTION']);
    $answer=mrValue($body['answer']??null,8000);
    if(mb_strlen($answer,'UTF-8')<70)mrReply(400,['ok'=>false,'error'=>'REVIEW_ANSWER_REQUIRED']);
    $note=mrValue($body['note']??'',1200);
    if(isset($body['note'])&&mb_strlen((string)$body['note'],'UTF-8')>1200)
        mrReply(400,['ok'=>false,'error'=>'NOTE_TOO_LONG']);
    $birth=mrValue($body['birth_date']??'',10);
    $other=mrValue($body['other_date']??'',10);
    $moment=mrValue($body['moment']??'',16);
    // Dates are retained as private test metadata, not as proof of a customer's purchase.
    if($birth!==''&&!preg_match('/^(19|20)\d\d-\d\d-\d\d$/D',$birth))
        mrReply(400,['ok'=>false,'error'=>'INVALID_BIRTH_DATE']);
    if($other!==''&&!preg_match('/^(19|20)\d\d-\d\d-\d\d$/D',$other))
        mrReply(400,['ok'=>false,'error'=>'INVALID_OTHER_DATE']);
    if($moment!==''&&!preg_match('/^(19|20)\d\d-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d$/D',$moment))
        mrReply(400,['ok'=>false,'error'=>'INVALID_MOMENT']);
    $status=['save_draft'=>'draft','request_revision'=>'revision','approve'=>'approved'][$action];
    $path=$directory.'/'.$id.'.json';
    $lockPath=$directory.'/'.$id.'.lock';
    $lock=fopen($lockPath,'c');
    if($lock===false||!flock($lock,LOCK_EX))mrReply(503,['ok'=>false,'error'=>'REVIEW_LOCK_UNAVAILABLE']);
    try {
        $previous=mrRead($path);
        if(($previous['status']??'')==='approved' && $action==='save_draft' && ($body['override_approved']??false)!==true)
            mrReply(409,['ok'=>false,'error'=>'ALREADY_APPROVED_USE_EXPLICIT_REVISION']);
        $record=[
            'schema'=>1,
            'question_id'=>$id,
            'question'=>$questions[$id]['title'],
            'status'=>$status,
            'answer'=>$answer,
            'note'=>$note,
            'birth_date'=>$birth,
            'other_date'=>$other,
            'moment'=>$moment,
            'updated_utc'=>gmdate('c'),
            'revision'=>(int)($previous['revision']??0)+1
        ];
        $json=json_encode($record,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
        $temporary=$directory.'/'.$id.'.'.bin2hex(random_bytes(7)).'.tmp';
        if(file_put_contents($temporary,$json,LOCK_EX)===false)
            mrReply(503,['ok'=>false,'error'=>'REVIEW_WRITE_FAILED']);
        @chmod($temporary,0600);
        if(!rename($temporary,$path)){
            @unlink($temporary);
            mrReply(503,['ok'=>false,'error'=>'REVIEW_WRITE_FAILED']);
        }
        @chmod($path,0600);
    } finally {
        flock($lock,LOCK_UN);
        fclose($lock);
    }
    mrReply(200,['ok'=>true,'question_id'=>$id,'status'=>$status,'revision'=>$record['revision'],
        'saved_utc'=>$record['updated_utc'],'published'=>false,'charged'=>false]);
} catch(Throwable $e){
    error_log('MOMENT_EDITORIAL_REVIEW:'.get_class($e));
    mrReply(503,['ok'=>false,'error'=>'REVIEW_TEMPORARILY_UNAVAILABLE']);
}
