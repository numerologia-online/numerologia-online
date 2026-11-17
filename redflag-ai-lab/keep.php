<?php
declare(strict_types=1);
/* Owner-only saved editorial AI drafts. NEVER publish, charge or serve to customers. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
function rfKeepReply(int $status,array $body): never {
    http_response_code($status);
    echo json_encode($body,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
}
try {
    if (!naTestOwner(naCurrent(naDB())))
        rfKeepReply(403,['ok'=>false,'error'=>'OWNER_ONLY']);
    if (($_SERVER['REQUEST_METHOD']??'')!=='POST')
        rfKeepReply(405,['ok'=>false,'error'=>'POST_ONLY']);
    if (!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
        rfKeepReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
    $raw=file_get_contents('php://input',false,null,0,6500);
    if (!is_string($raw)||strlen($raw)>6400)
        rfKeepReply(400,['ok'=>false,'error'=>'REQUEST_TOO_LARGE']);
    $data=json_decode($raw,true,12,JSON_THROW_ON_ERROR);
    if (!is_array($data))rfKeepReply(400,['ok'=>false,'error'=>'INVALID_JSON']);
    $action=$data['action']??null;
    $category=$data['category']??null;
    $id=$data['question_id']??null;
    $day=$data['day']??null;
    $month=$data['month']??null;
    if (!in_array($action,['get','save'],true)||
        !is_string($category)||!preg_match('/^[a-z][a-z0-9-]{1,50}$/D',$category)||
        !is_string($id)||!preg_match('/^[a-z][a-z0-9-]{1,70}$/D',$id)||
        !is_int($day)||!is_int($month)||!checkdate($month,$day,2000))
        rfKeepReply(400,['ok'=>false,'error'=>'INVALID_SELECTION']);
    $catalog=json_decode((string)file_get_contents(__DIR__.'/catalog.json'),true,20,JSON_THROW_ON_ERROR);
    if (($catalog['mode']??'')!=='owner_draft_only'||($catalog['questions']??0)!==54)
        rfKeepReply(503,['ok'=>false,'error'=>'DRAFT_CATALOG_UNAVAILABLE']);
    $found=false;
    foreach ($catalog['categories'] as $entry) {
        if (($entry['id']??null)!==$category)continue;
        foreach ($entry['questions'] as $question) {
            if (($question['id']??null)===$id){$found=true;break 2;}
        }
    }
    if (!$found)rfKeepReply(400,['ok'=>false,'error'=>'UNPUBLISHED_QUESTION_REQUIRED']);
    $dir=dirname(__DIR__,3).'/private/numi-redflag-owner-kept-v1';
    $key=$day.'-'.$month;
    $file=$dir.'/'.$category.'__'.$id.'__'.$key.'.json';
    if ($action==='get') {
        if (!is_file($file))
            rfKeepReply(200,['ok'=>true,'saved'=>false,'published'=>false]);
        $stored=json_decode((string)file_get_contents($file),true,10,JSON_THROW_ON_ERROR);
        $answer=$stored['answer']??null;
        if (($stored['category']??null)!==$category||
            ($stored['question_id']??null)!==$id||
            ($stored['date_key']??null)!==$key||
            !is_string($answer)||mb_strlen($answer)>5200)
            rfKeepReply(503,['ok'=>false,'error'=>'SAVED_DRAFT_CORRUPTED']);
        rfKeepReply(200,['ok'=>true,'saved'=>true,'draft_only'=>true,
            'published'=>false,'category'=>$category,'question_id'=>$id,
            'date_key'=>$key,'answer'=>$answer]);
    }
    $answer=$data['answer']??null;
    if (!is_string($answer))
        rfKeepReply(400,['ok'=>false,'error'=>'TEXT_REQUIRED']);
    $answer=trim(str_replace("\r\n","\n",$answer));
    if (mb_strlen($answer)<300||mb_strlen($answer)>5200||
        !preg_match('/\S+\n\s*\n\S+/us',$answer))
        rfKeepReply(400,['ok'=>false,'error'=>'TEXT_MUST_HAVE_TWO_PARAGRAPHS']);
    if (!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))
        rfKeepReply(503,['ok'=>false,'error'=>'PRIVATE_STORAGE_UNAVAILABLE']);
    $payload=json_encode([
        'schemaVersion'=>1,'status'=>'draft_kept_by_owner','autoPublish'=>false,
        'category'=>$category,'question_id'=>$id,'date_key'=>$key,'answer'=>$answer,
        'kept_at'=>gmdate('c')
    ],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    $tmp=tempnam($dir,'redflag-');
    if ($tmp===false)rfKeepReply(503,['ok'=>false,'error'=>'PRIVATE_STORAGE_UNAVAILABLE']);
    try {
        @chmod($tmp,0600);
        if (file_put_contents($tmp,$payload,LOCK_EX)===false||
            !rename($tmp,$file))
            rfKeepReply(503,['ok'=>false,'error'=>'PRIVATE_SAVE_FAILED']);
        @chmod($file,0600);
    } finally {
        if (is_file($tmp))@unlink($tmp);
    }
    rfKeepReply(200,['ok'=>true,'saved'=>true,'draft_only'=>true,
        'published'=>false,'category'=>$category,'question_id'=>$id,
        'date_key'=>$key,'answer'=>$answer]);
} catch (Throwable $e) {
    error_log('REDFLAG_OWNER_KEEP:'.get_class($e));
    rfKeepReply(503,['ok'=>false,'error'=>'PRIVATE_STORAGE_UNAVAILABLE']);
}
