<?php
declare(strict_types=1);
/** Final Verdict live: same isolated engine as editorial preview. */
require_once __DIR__.'/love-practical-engine.php';
function lvlQuestions(): array {
    $path=__DIR__.'/love-live-questions.json';
    $bank=json_decode((string)file_get_contents($path),true,25,JSON_THROW_ON_ERROR);
    if(($bank['id']??null)!=='love'||count($bank['questions']??[])!==10)
        throw new RuntimeException('LOVE_QUESTIONS_UNAVAILABLE');
    return $bank['questions'];
}
function lvlMapIds(): array {
    return ['romance','relationship-or-comfort','adult-partner','near-him','hard-moment','relationship-format','family-or-triangle','honest-or-disappear','love-or-attention'];
}
function lvlSupportedPaidResource(string $code,string $resource): bool {
    if($code!=='redflag_question'||preg_match('/^redflag:love:([a-z-]+):((?:19|20)\d\d-\d\d-\d\d)$/D',$resource,$m)!==1)
        return false;
    return in_array($m[1],lvlMapIds(),true)&&naCatalogDate($m[2])!==null&&(int)substr($m[2],0,4)<=(int)gmdate('Y');
}
function lvlEngineInstalled(): bool {
    if(!is_file(__DIR__.'/love-live.php')||!is_file(__DIR__.'/intimacy-live-config.php')
       ||!is_file(__DIR__.'/love-practical-engine.php')||!is_file(__DIR__.'/love-practical-knowledge.txt')
       ||!is_file(__DIR__.'/love-live-questions.json'))return false;
    $cfg=require __DIR__.'/intimacy-live-config.php';
    return is_array($cfg)&&is_string($cfg['cloudru_key']??null)
        && strlen($cfg['cloudru_key'])>12;
}
function lvlCacheDirectory(): string {
    $dir=__DIR__.'/love-answer-cache';
    if(!is_dir($dir) && !@mkdir($dir,0700,true)&&!is_dir($dir))
        throw new RuntimeException('LOVE_CACHE_UNAVAILABLE');
    return $dir;
}
function lvlCacheFile(string $id,string $date): string {
    if(!in_array($id,array_merge(['first-step'],lvlMapIds()),true)||naCatalogDate($date)===null||(int)substr($date,0,4)>(int)gmdate('Y'))
        throw new InvalidArgumentException('INVALID_LOVE_REQUEST');
    // New generation never reads the former engine's cache.
    return lvlCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).($id==='first-step'?'-love-humor-v1.json':'-love-v1.json');
}
function lvlCachedAnswer(string $id,string $date): ?string {
    return lvlReadCachedAnswer(lvlCacheFile($id,$date),$id,$date);
}
function lvlReadCachedAnswer(string $file,string $id,string $date): ?string {
    if(!is_file($file))return null;
    $raw=file_get_contents($file);
    if(!is_string($raw)||strlen($raw)>12000)return null;
    $data=json_decode($raw,true);
    $answer=is_array($data)&&($data['question']??null)===$id
        &&($data['date']??null)===$date &&($data['version']??null)===1
        ?($data['answer']??null):null;
    if($id==='first-step'&&(!is_string($answer)||substr_count($answer,'Шуточный вердикт:')!==1))return null;
    return is_string($answer)&&strlen($answer)>450?$answer:null;
}
function lvlEnsureAnswer(string $id,string $date): string {
    if(!lvlEngineInstalled())throw new RuntimeException('LOVE_ENGINE_UNAVAILABLE');
    $path=lvlCacheFile($id,$date);
    $existing=lvlCachedAnswer($id,$date);
    if($existing!==null)return $existing;
    $lock=@fopen($path.'.lock','c');
    if($lock===false)throw new RuntimeException('LOVE_LOCK_UNAVAILABLE');
    try{
        if(!flock($lock,LOCK_EX))throw new RuntimeException('LOVE_LOCK_UNAVAILABLE');
        $existing=lvlCachedAnswer($id,$date);
        if($existing!==null)return $existing;
        [$y,$m,$d]=array_map('intval',explode('-',$date));
        $questions=lvlQuestions();
        $selected=null;$cat=['categories'=>[['id'=>'love','questions'=>[]]]];
        foreach($questions as $q){
            $cat['categories'][0]['questions'][]=['id'=>$q['id'],'title'=>$q['title']];
            if($q['id']===$id)$selected=['id'=>$q['id'],'title'=>$q['title']];
        }
        if($selected===null)throw new RuntimeException('LOVE_QUESTION_NOT_FOUND');
        if($id==='first-step'){
            require_once __DIR__.'/love-first-step-humor.php';
            $text=lvhGenerate($selected,$d,$m,$y);
        }else{
            $text=lvpGenerateText($selected,$d,$m,$y);
        }
        $text=niValidateGeneratedText($text,'stop');
        if(mb_strlen($text,'UTF-8')>1800)throw new RuntimeException('LOVE_TEXT_TOO_LONG');
        $blob=json_encode(['version'=>1,'question'=>$id,'date'=>$date,'answer'=>$text],
            JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
        $tmp=$path.'.'.bin2hex(random_bytes(6)).'.tmp';
        if(file_put_contents($tmp,$blob,LOCK_EX)===false)throw new RuntimeException('LOVE_CACHE_WRITE_FAILED');
        @chmod($tmp,0600);
        if(!rename($tmp,$path)){@unlink($tmp);throw new RuntimeException('LOVE_CACHE_WRITE_FAILED');}
        return $text;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function lvlEnsurePaidResource(string $resource): string {
    if(!lvlSupportedPaidResource('redflag_question',$resource))
        throw new InvalidArgumentException('INVALID_LOVE_RESOURCE');
    if(!preg_match('/^redflag:love:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m))
        throw new RuntimeException('LOVE_RESOURCE_INVALID');
    return lvlEnsureAnswer($m[1],$m[2]);
}
function lvlMaterialFromCache(string $resource): array {
    if(!lvlSupportedPaidResource('redflag_question',$resource))
        throw new RuntimeException('MATERIAL_NOT_READY');
    preg_match('/^redflag:love:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m);
    $answer=lvlCachedAnswer($m[1],$m[2]);
    if($answer===null)throw new RuntimeException('MATERIAL_NOT_READY');
    $title='';
    foreach(lvlQuestions() as $q)if($q['id']===$m[1]){$title=$q['title'];break;}
    return ['title'=>$title,'sections'=>[['title'=>$title,'paragraphs'=>preg_split('/\n\s*\n/u',$answer)]],
        'links'=>[],'pdf_available'=>false];
}
function lvlPermitFree(string $date,?array $owner,callable $generate): string {
    if($owner!==null && naTestOwner($owner))return $generate();
    // One newly calculated free birth date per IP/day; cached answers do not
    // incur any provider cost. All client dates are served by the same engine.
    $cached=lvlCachedAnswer('first-step',$date);
    if($cached!==null)return $cached;
    $day=gmdate('Ymd');
    $addr=(string)($_SERVER['REMOTE_ADDR']??'');
    $hash=hash('sha256',$day.'|'.$addr.'|love-free-v1');
    $path=lvlCacheDirectory().'/free-'.$hash.'.quota';
    $handle=@fopen($path,'c+');
    if($handle===false)throw new RuntimeException('FREE_RATE_LIMIT_STORAGE_UNAVAILABLE');
    try {
        if(!flock($handle,LOCK_EX))throw new RuntimeException('FREE_RATE_LIMIT_STORAGE_UNAVAILABLE');
        rewind($handle);$existing=trim((string)stream_get_contents($handle));
        if($existing!==''&&$existing!==$date)
            throw new RuntimeException('FREE_DAILY_LIMIT');
        $answer=$generate();
        rewind($handle);ftruncate($handle,0);fwrite($handle,$date);fflush($handle);
        return $answer;
    }finally{flock($handle,LOCK_UN);fclose($handle);}
}
