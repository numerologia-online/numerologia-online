<?php
declare(strict_types=1);
/**
 * Family live: approved practical engine and isolated comic verdict. Previously purchased answers remain readable.
 * Reuses approved 31-point arithmetic and the existing family-only transport/validation.
 */
require_once __DIR__.'/intimacy-live.php';

function nfQuestionIds(): array {
    return ['independent','household','vacation','plans','children','roles','home','conflict','money-at-home','care'];
}
function nfQuestions(): array {
    $path=__DIR__.'/family-live-questions.json';
    $data=json_decode((string)file_get_contents($path),true,20,JSON_THROW_ON_ERROR);
    if(($data['id']??null)!=='family'||count($data['questions']??[])!==10)
        throw new RuntimeException('FAMILY_QUESTIONS_UNAVAILABLE');
    if(array_column($data['questions'],'id')!==nfQuestionIds())
        throw new RuntimeException('FAMILY_QUESTION_IDS_INVALID');
    return $data['questions'];
}
function nfSupportedPaidResource(string $code,string $resource): bool {
    if($code!=='redflag_question' || preg_match('/^redflag:family:([a-z-]+):((?:19|20)\d\d-\d\d-\d\d)$/D',$resource,$m)!==1)
        return false;
    return $m[1]!=='independent'&&in_array($m[1],array_merge(nfQuestionIds(),['comic-verdict-family']),true)&&naCatalogDate($m[2])!==null;
}
function nfEngineInstalled(): bool {
    foreach(['family-practical-engine.php','family-owner-knowledge-v1.txt','family-live-questions.json','family-comic-verdict.php','family-comic-verdict.json','intimacy-live-config.php'] as $file)
        if(!is_file(__DIR__.'/'.$file))return false;
    $cfg=require __DIR__.'/intimacy-live-config.php';
    return is_array($cfg)&&is_string($cfg['cloudru_key']??null)&&strlen($cfg['cloudru_key'])>12;
}

function nfCacheDirectory(): string {
    $path=__DIR__.'/family-answer-cache';
    if(!is_dir($path)&&!@mkdir($path,0700,true)&&!is_dir($path))
        throw new RuntimeException('FAMILY_CACHE_UNAVAILABLE');
    return $path;
}
function nfCacheFile(string $id,string $date): string {
    if(!in_array($id,array_merge(nfQuestionIds(),['comic-verdict-family']),true)||naCatalogDate($date)===null)
        throw new InvalidArgumentException('FAMILY_INVALID_REQUEST');
    return nfCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).'-family-practical-live-v10.json';
}
function nfCachedAnswer(string $id,string $date): ?string {
    return nfReadCachedAnswer(nfCacheFile($id,$date),$id,$date);
}
/** Existing paid materials remain readable from both earlier cache formats. */
function nfLegacyCachedAnswer(string $id,string $date): ?string {
    if(!in_array($id,array_merge(nfQuestionIds(),['comic-verdict-family']),true)||naCatalogDate($date)===null)return null;
    $prefix=nfCacheDirectory().'/'.$id.'-'.str_replace('-','',$date);
    foreach(['-family-rebuilt-v9.json','-family-precise-v8.json','-family-conversational-v7.json','-family-punch-v6.json','-family-ideal-synthesis-v5.json','-family-focused-v4.json','-family-focused-v3.json','-family-kb-v2.json','-nokb-v1.json'] as $suffix){
        $answer=nfReadCachedAnswer($prefix.$suffix,$id,$date);
        if($answer!==null)return $answer;
    }
    return null;
}
function nfReadCachedAnswer(string $path,string $id,string $date): ?string {
    if(!is_file($path))return null;
    $raw=file_get_contents($path);
    if(!is_string($raw)||strlen($raw)>12000)return null;
    $v=json_decode($raw,true);
    $answer=is_array($v)&&($v['version']??null)===1
        &&($v['question']??null)===$id&&($v['date']??null)===$date ? ($v['answer']??null):null;
    return is_string($answer)&&mb_strlen($answer,'UTF-8')>=450?$answer:null;
}
function nfEnsureAnswer(string $id,string $date): string {
    if(!nfEngineInstalled())throw new RuntimeException('FAMILY_ENGINE_UNAVAILABLE');
    $path=nfCacheFile($id,$date);
    $existing=nfCachedAnswer($id,$date);
    if($existing!==null)return $existing;
    $lock=@fopen($path.'.lock','c');
    if($lock===false)throw new RuntimeException('FAMILY_LOCK_UNAVAILABLE');
    try{
        if(!flock($lock,LOCK_EX))throw new RuntimeException('FAMILY_LOCK_UNAVAILABLE');
        $existing=nfCachedAnswer($id,$date);
        if($existing!==null)return $existing;
        [$y,$m,$d]=array_map('intval',explode('-',$date));
        if($id==='comic-verdict-family'){
            require_once __DIR__.'/family-comic-verdict.php';
            $text=hcvGenerate($d,$m,$y);
        }else{
            require_once __DIR__.'/family-practical-engine.php';
            $question=null;
            foreach(fpQuestions() as $q)if($q['id']===$id){$question=$q;break;}
            if($question===null)throw new RuntimeException('FAMILY_QUESTION_NOT_FOUND');
            $text=fpGenerateText($question,$d,$m,$y);
        }
        $text=niValidateGeneratedText($text,'stop');
        if(mb_strlen($text,'UTF-8')>1800)throw new RuntimeException('FAMILY_TEXT_TOO_LONG');
        $blob=json_encode(['version'=>1,'question'=>$id,'date'=>$date,'answer'=>$text],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        $tmp=$path.'.'.bin2hex(random_bytes(6)).'.tmp';
        if(file_put_contents($tmp,$blob,LOCK_EX)!==strlen($blob)){@unlink($tmp);throw new RuntimeException('FAMILY_CACHE_WRITE_FAILED');}
        @chmod($tmp,0600);
        if(!rename($tmp,$path)){@unlink($tmp);throw new RuntimeException('FAMILY_CACHE_WRITE_FAILED');}
        if(nfCachedAnswer($id,$date)!==$text)throw new RuntimeException('FAMILY_CACHE_READBACK_FAILED');
        return $text;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function nfEnsurePaidResource(string $resource): string {
    if(!nfSupportedPaidResource('redflag_question',$resource))
        throw new InvalidArgumentException('INVALID_FAMILY_RESOURCE');
    if(!preg_match('/^redflag:family:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m))
        throw new RuntimeException('FAMILY_RESOURCE_INVALID');
    return nfEnsureAnswer($m[1],$m[2]);
}
function nfMaterialFromCache(string $resource): array {
    if(!nfSupportedPaidResource('redflag_question',$resource))
        throw new RuntimeException('MATERIAL_NOT_READY');
    preg_match('/^redflag:family:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m);
    $answer=nfCachedAnswer($m[1],$m[2]);
    if($answer===null)$answer=nfLegacyCachedAnswer($m[1],$m[2]);
    if($answer===null)throw new RuntimeException('MATERIAL_NOT_READY');
    $title=$m[1]==='comic-verdict-family'?'😂 Шуточный вердикт':'';
    foreach(nfQuestions() as $q)if($q['id']===$m[1]){$title=$q['title'];break;}
    return ['title'=>$title,'sections'=>[['title'=>$title,
        'paragraphs'=>preg_split('/\n\s*\n/u',$answer)]],
        'links'=>[],'pdf_available'=>false];
}
function nfPermitFree(string $date,?array $owner,callable $generate): string {
    if($owner!==null&&naTestOwner($owner))return $generate();
    $cached=nfCachedAnswer('independent',$date);
    if($cached!==null)return $cached;
    $day=gmdate('Ymd');
    $addr=(string)($_SERVER['REMOTE_ADDR']??'');
    $hash=hash('sha256',$day.'|'.$addr.'|family-free-nokb-v1');
    $path=nfCacheDirectory().'/free-'.$hash.'.quota';
    $handle=@fopen($path,'c+');
    if($handle===false)throw new RuntimeException('FREE_RATE_LIMIT_STORAGE_UNAVAILABLE');
    try {
        if(!flock($handle,LOCK_EX))throw new RuntimeException('FREE_RATE_LIMIT_STORAGE_UNAVAILABLE');
        rewind($handle);$existing=trim((string)stream_get_contents($handle));
        if($existing!==''&&$existing!==$date)throw new RuntimeException('FREE_DAILY_LIMIT');
        $answer=$generate();
        rewind($handle);ftruncate($handle,0);fwrite($handle,$date);fflush($handle);
        return $answer;
    }finally{flock($handle,LOCK_UN);fclose($handle);}
}
