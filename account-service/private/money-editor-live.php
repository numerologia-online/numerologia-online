<?php
declare(strict_types=1);
// Editorial layer exclusively for the ten ordinary Money questions.
require_once __DIR__.'/fulfillment.php';
require_once __DIR__.'/intimacy-live.php';
function meIds(): array {
    return ['gift','generosity','courtship','provider','words-or-deeds','family-load','resource','solve-or-create','responsibility','celebration'];
}
function meDate(string $date): bool {
    return preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date)===1&&naCatalogDate($date)!==null&&(int)substr($date,0,4)<=(int)gmdate('Y');
}
function meParse(string $code,string $resource): ?array {
    if($code!=='redflag_question'||preg_match('/^redflag:money:([a-z-]+):(\d{4}-\d{2}-\d{2})$/D',$resource,$m)!==1
        ||$m[1]==='gift'||!in_array($m[1],meIds(),true)||!meDate($m[2]))return null;
    return [$m[1],$m[2]];
}
function meSource(string $id,string $date,?string $root=null): array {
    if(!in_array($id,meIds(),true)||!meDate($date))throw new InvalidArgumentException('MONEY_EDITOR_REQUEST');
    $bank=naMaterialJson('data/redflag/money/'.$id.'.json',$root);
    [, $month,$day]=array_map('intval',explode('-',$date));
    $key=$day.'-'.$month;$text=$bank['entries'][$key]??null;
    if(($bank['section']??null)!=='money'||($bank['questionId']??null)!==$id||($bank['keyRule']??null)!=='day-month'
        ||!naRedFlagPaidStatus($bank['status']??null)||!is_string($bank['question']??null)||!is_string($text))
        throw new RuntimeException('MONEY_EDITOR_SOURCE');
    $parts=preg_split('/\n\s*\n/u',trim($text));
    if(count($parts)!==2||trim($parts[0])==='')throw new RuntimeException('MONEY_EDITOR_SOURCE_FORMAT');
    return ['id'=>$id,'key'=>$key,'title'=>$bank['question'],'source'=>trim($parts[0]),'original'=>$text];
}
function meFollowups(string $id): array {
    $all=json_decode((string)file_get_contents(__DIR__.'/money-editor-followups.json'),true,32,JSON_THROW_ON_ERROR);
    $rows=$all[$id]??[];
    if(count($rows)!==4)throw new RuntimeException('MONEY_EDITOR_FOLLOWUPS');
    return $rows;
}
function meMessages(array $s): array {
    $options=meFollowups($s['id']);
    $offset=hexdec(substr(hash('sha256',$s['key'].'|'.$s['id']),0,4))%count($options);
    $options=array_merge(array_slice($options,$offset),array_slice($options,0,$offset));
    $rules=<<<'PROMPT'
Ты редактор готового авторского нумерологического текста. Раскрой исходный смысл интересно, подробно и естественно. Не меняй его, не усиливай и не смягчай вывод, не добавляй характеристик, причин, прогнозов или советов, которых не было у автора. Сохраняй все нюансы, условия, плюсы и минусы. Жизненные примеры допустимы только как иллюстрация исходного смысла, не как утверждение о реальном человеке. Первая фраза прямо отвечает на исходный вопрос. Пиши по-русски, как умная наблюдательная подруга, обращайся на «ты», допускай уместную иронию. Без воды, комплиментарности, канцелярита, повторов, эзотерической терминологии, номеров и названий энергий, расчётов, упоминаний ИИ и редактирования. Без длинных тире, списков, заголовков, Markdown и лишних двоеточий. Ровно два абзаца через пустую строку, всего 950–1200 знаков с пробелами. Первый — полный смысловой ответ, второй — короткая естественная подводка к одному наиболее уместному вопросу из переданного списка. Укажи точное название вопроса и название раздела в кавычках «». Не придумывай вопросы, не отвечай на следующий вопрос заранее, не упоминай цену. Приоритет — сохранение авторского смысла, а не искусственное увеличение объёма.
PROMPT;
    return [['role'=>'system','content'=>$rules],['role'=>'user','content'=>json_encode([
        'вопрос'=>$s['title'],'авторская_трактовка'=>$s['source'],'доступные_вопросы_других_разделов'=>$options
    ],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]];
}
function meValidate(string $answer,string $finish,string $id): string {
    $answer=str_replace(['—','–'],['-','-'],niValidateGeneratedText($answer,$finish));
    $n=mb_strlen($answer,'UTF-8');$p=explode("\n\n",$answer);
    if($n<950||$n>1200||substr_count($answer,':')>1||count($p)!==2||mb_strlen($p[1],'UTF-8')>320)
        throw new RuntimeException('MONEY_EDITOR_FORMAT');
    $matches=0;
    foreach(meFollowups($id) as $q)if(str_contains($p[1],'«'.$q['title'].'»')&&str_contains($p[1],'«'.$q['category'].'»'))$matches++;
    if($matches!==1)throw new RuntimeException('MONEY_EDITOR_FOLLOWUP');
    return $answer;
}
function meInstalled(): bool {
    if(!is_file(__DIR__.'/intimacy-live-config.php')||!is_file(__DIR__.'/money-editor-followups.json'))return false;
    $cfg=require __DIR__.'/intimacy-live-config.php';
    return is_array($cfg)&&is_string($cfg['cloudru_key']??null)&&strlen($cfg['cloudru_key'])>12;
}
function meDir(): string {
    $p=__DIR__.'/money-editor-answer-cache';
    if(!is_dir($p)&&!@mkdir($p,0700,true)&&!is_dir($p))throw new RuntimeException('MONEY_EDITOR_CACHE');
    return $p;
}
function meFile(array $s): string {
    return meDir().'/'.$s['id'].'-'.$s['key'].'-'.substr(hash('sha256',$s['title'].'|'.$s['source']),0,24).'-v1.json';
}
function meCached(array $s): ?string {
    $p=meFile($s);
    if(!is_file($p)||filesize($p)>12000)return null;
    $r=json_decode((string)file_get_contents($p),true);
    if(($r['version']??null)!==1||!is_string($r['answer']??null))return null;
    try{return meValidate($r['answer'],'stop',$s['id']);}catch(Throwable $e){return null;}
}
function meEnsure(string $id,string $date): string {
    $s=meSource($id,$date);
    if(($a=meCached($s))!==null)return $a;
    if(!meInstalled())throw new RuntimeException('MONEY_EDITOR_UNAVAILABLE');
    $p=meFile($s);$lock=@fopen($p.'.lock','c');
    if($lock===false)throw new RuntimeException('MONEY_EDITOR_LOCK');
    try{
        if(!flock($lock,LOCK_EX))throw new RuntimeException('MONEY_EDITOR_LOCK');
        if(($a=meCached($s))!==null)return $a;
        $a=niCloudCall(meMessages($s),2800,'google/gemini-3-flash-preview',static fn(string $t,string $f):string=>meValidate($t,$f,$id));
        $raw=json_encode(['version'=>1,'answer'=>$a],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        $tmp=$p.'.'.bin2hex(random_bytes(8)).'.tmp';
        if(file_put_contents($tmp,$raw,LOCK_EX)!==strlen($raw)){@unlink($tmp);throw new RuntimeException('MONEY_EDITOR_WRITE');}
        @chmod($tmp,0600);
        if(!rename($tmp,$p)){@unlink($tmp);throw new RuntimeException('MONEY_EDITOR_WRITE');}
        if(meCached($s)!==$a)throw new RuntimeException('MONEY_EDITOR_READBACK');
        return $a;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function meReady(string $resource): bool {
    $p=meParse('redflag_question',$resource);
    if($p===null)return false;
    try{return meInstalled()&&meSource(...$p)!==[];}catch(Throwable $e){return false;}
}
function meMaterial(string $resource): ?array {
    $p=meParse('redflag_question',$resource);
    if($p===null)return null;
    $s=meSource(...$p);$a=meCached($s);
    if($a===null)return null;
    return ['title'=>$s['title'],'sections'=>[['title'=>$s['title'],'paragraphs'=>explode("\n\n",$a)]],'links'=>[],'pdf_available'=>true];
}
function meFree(string $date,?array $account): array {
    $s=meSource('gift',$date);
    if(($a=meCached($s))!==null)return ['answer'=>$a,'ai_generated'=>true];
    if($account!==null&&naTestOwner($account))return ['answer'=>meEnsure('gift',$date),'ai_generated'=>true];
    // Preserve existing free access even when uncached AI requests are rate limited.
    $key=hash('sha256',gmdate('Ymd').'|'.(string)($_SERVER['REMOTE_ADDR']??'').'|money-editor-free-v1');
    $lock=@fopen(meDir().'/free-'.$key.'.quota','c+');
    if($lock===false)return ['answer'=>$s['original'],'ai_generated'=>false];
    try{
        if(!flock($lock,LOCK_EX))return ['answer'=>$s['original'],'ai_generated'=>false];
        rewind($lock);
        if(trim((string)stream_get_contents($lock))!=='')return ['answer'=>$s['original'],'ai_generated'=>false];
        rewind($lock);ftruncate($lock,0);fwrite($lock,$s['key']);fflush($lock);
        try{return ['answer'=>meEnsure('gift',$date),'ai_generated'=>true];}
        catch(Throwable $e){return ['answer'=>$s['original'],'ai_generated'=>false];}
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
