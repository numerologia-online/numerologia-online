<?php
declare(strict_types=1);
/** Final Verdict live: same isolated engine as editorial preview. */
require_once __DIR__.'/verdict-practical-engine.php';
function nvQuestions(): array {
    $path=__DIR__.'/verdict-owner-questions.json';
    $bank=json_decode((string)file_get_contents($path),true,25,JSON_THROW_ON_ERROR);
    if(($bank['id']??null)!=='verdict'||count($bank['questions']??[])!==10)
        throw new RuntimeException('VERDICT_QUESTIONS_UNAVAILABLE');
    return $bank['questions'];
}
function nvMapIds(): array {
    return ['worth-it','beauty-and-flag','check','main-advice','his-need','weak-point','best-side','format','bottom-line'];
}
function nvSupportedPaidResource(string $code,string $resource): bool {
    if($code!=='redflag_question'||preg_match('/^redflag:verdict:([a-z-]+):((?:19|20)\d\d-\d\d-\d\d)$/D',$resource,$m)!==1)
        return false;
    return in_array($m[1],nvMapIds(),true)&&naCatalogDate($m[2])!==null&&(int)substr($m[2],0,4)<=(int)gmdate('Y');
}
function nvEngineInstalled(): bool {
    if(!is_file(__DIR__.'/verdict-live.php')||!is_file(__DIR__.'/intimacy-live-config.php')
       ||!is_file(__DIR__.'/verdict-practical-engine.php')||!is_file(__DIR__.'/verdict-owner-knowledge-v1.txt')
       ||!is_file(__DIR__.'/verdict-owner-questions.json'))return false;
    $cfg=require __DIR__.'/intimacy-live-config.php';
    return is_array($cfg)&&is_string($cfg['cloudru_key']??null)
        && strlen($cfg['cloudru_key'])>12;
}
function nvCacheDirectory(): string {
    $dir=__DIR__.'/verdict-answer-cache';
    if(!is_dir($dir) && !@mkdir($dir,0700,true)&&!is_dir($dir))
        throw new RuntimeException('VERDICT_CACHE_UNAVAILABLE');
    return $dir;
}
function nvCacheFile(string $id,string $date): string {
    if(!in_array($id,array_merge(['final'],nvMapIds()),true)||naCatalogDate($date)===null||(int)substr($date,0,4)>(int)gmdate('Y'))
        throw new InvalidArgumentException('INVALID_VERDICT_REQUEST');
    // Refresh only free answers whose selected matrix positions include energy 4.
    // Already purchased paid answers retain their existing cache keys.
    $suffix=$id==='beauty-and-flag'?'-verdict-dignity-v2.json':'-verdict-v1.json';
    if($id==='final'){
        [$y,$m,$d]=array_map('intval',explode('-',$date));
        $matrix=ni31($d,$m,$y);
        foreach(vpPointMap($id) as $point)if($matrix[$point]===4){$suffix='-verdict-energy4-v2.json';break;}
    }
    return nvCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).$suffix;
}
function nvCachedAnswer(string $id,string $date): ?string {
    return nvReadCachedAnswer(nvCacheFile($id,$date),$id,$date);
}
function nvReadCachedAnswer(string $file,string $id,string $date): ?string {
    if(!is_file($file))return null;
    $raw=file_get_contents($file);
    if(!is_string($raw)||strlen($raw)>12000)return null;
    $data=json_decode($raw,true);
    $answer=is_array($data)&&($data['question']??null)===$id
        &&($data['date']??null)===$date &&($data['version']??null)===1
        ?($data['answer']??null):null;
    return is_string($answer)&&strlen($answer)>450?$answer:null;
}
function nvEnsureAnswer(string $id,string $date): string {
    if(!nvEngineInstalled())throw new RuntimeException('VERDICT_ENGINE_UNAVAILABLE');
    $path=nvCacheFile($id,$date);
    $existing=nvCachedAnswer($id,$date);
    if($existing!==null)return $existing;
    $lock=@fopen($path.'.lock','c');
    if($lock===false)throw new RuntimeException('VERDICT_LOCK_UNAVAILABLE');
    try{
        if(!flock($lock,LOCK_EX))throw new RuntimeException('VERDICT_LOCK_UNAVAILABLE');
        $existing=nvCachedAnswer($id,$date);
        if($existing!==null)return $existing;
        [$y,$m,$d]=array_map('intval',explode('-',$date));
        $questions=nvQuestions();
        $selected=null;$cat=['categories'=>[['id'=>'verdict','questions'=>[]]]];
        foreach($questions as $q){
            $cat['categories'][0]['questions'][]=['id'=>$q['id'],'title'=>$q['title']];
            if($q['id']===$id)$selected=['id'=>$q['id'],'title'=>$q['title']];
        }
        if($selected===null)throw new RuntimeException('VERDICT_QUESTION_NOT_FOUND');
        $text=vpGenerateText($selected,$d,$m,$y);
        $text=niValidateGeneratedText($text,'stop');
        if(mb_strlen($text,'UTF-8')>1800)throw new RuntimeException('VERDICT_TEXT_TOO_LONG');
        $blob=json_encode(['version'=>1,'question'=>$id,'date'=>$date,'answer'=>$text],
            JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
        $tmp=$path.'.'.bin2hex(random_bytes(6)).'.tmp';
        if(file_put_contents($tmp,$blob,LOCK_EX)===false)throw new RuntimeException('VERDICT_CACHE_WRITE_FAILED');
        @chmod($tmp,0600);
        if(!rename($tmp,$path)){@unlink($tmp);throw new RuntimeException('VERDICT_CACHE_WRITE_FAILED');}
        return $text;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function nvEnsurePaidResource(string $resource): string {
    if(!nvSupportedPaidResource('redflag_question',$resource))
        throw new InvalidArgumentException('INVALID_VERDICT_RESOURCE');
    if(!preg_match('/^redflag:verdict:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m))
        throw new RuntimeException('VERDICT_RESOURCE_INVALID');
    return nvEnsureAnswer($m[1],$m[2]);
}
function nvMaterialFromCache(string $resource): array {
    if(!nvSupportedPaidResource('redflag_question',$resource))
        throw new RuntimeException('MATERIAL_NOT_READY');
    preg_match('/^redflag:verdict:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m);
    $answer=nvCachedAnswer($m[1],$m[2]);
    if($answer===null&&$m[1]==='beauty-and-flag')$answer=nvReadCachedAnswer(nvCacheDirectory().'/'.$m[1].'-'.str_replace('-','',$m[2]).'-verdict-v1.json',$m[1],$m[2]);
    if($answer===null)throw new RuntimeException('MATERIAL_NOT_READY');
    $title='';
    foreach(nvQuestions() as $q)if($q['id']===$m[1]){$title=$q['title'];break;}
    return ['title'=>$title,'sections'=>[['title'=>$title,'paragraphs'=>preg_split('/\n\s*\n/u',$answer)]],
        'links'=>[],'pdf_available'=>false];
}
function nvPermitFree(string $date,?array $owner,callable $generate): string {
    if($owner!==null && naTestOwner($owner))return $generate();
    // One newly calculated free birth date per IP/day; cached answers do not
    // incur any provider cost. All client dates are served by the same engine.
    $cached=nvCachedAnswer('final',$date);
    if($cached!==null)return $cached;
    $day=gmdate('Ymd');
    $addr=(string)($_SERVER['REMOTE_ADDR']??'');
    $hash=hash('sha256',$day.'|'.$addr.'|verdict-free-v1');
    $path=nvCacheDirectory().'/free-'.$hash.'.quota';
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
