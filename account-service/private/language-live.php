<?php
declare(strict_types=1);
/**
 * Native production Gemini 3 Flash for "Языки любви мужчины".
 * Uses the existing, fixed family transport and 31-point matrix; separate short
 * language-specific 22 energy bank, cache and one-free-question quota.
 * No requests to the provider except user-initiated free/owner/buy generation.
 */
require_once __DIR__.'/family-live.php';

function nlQuestionIds(): array {
    return ['love-language','how-to-talk','accept-love','show-love','criticism','ask',
            'distance','hurt','conflict-style','compliment'];
}
function nlQuestions(): array {
    $data=json_decode((string)file_get_contents(__DIR__.'/language-live-questions.json'),true,20,JSON_THROW_ON_ERROR);
    if(($data['id']??null)!=='language'||count($data['questions']??[])!==10
       ||array_column($data['questions'],'id')!==nlQuestionIds())
        throw new RuntimeException('LANGUAGE_QUESTIONS_INVALID');
    return $data['questions'];
}
function nlSupportedPaidResource(string $code,string $resource): bool {
    if($code!=='redflag_question'
       ||preg_match('/^redflag:language:([a-z-]+):((?:19|20)\d\d-\d\d-\d\d)$/D',$resource,$m)!==1)
        return false;
    return $m[1]!=='love-language'&&in_array($m[1],nlQuestionIds(),true)
        &&naCatalogDate($m[2])!==null;
}
function nlEngineInstalled(): bool {
    if(!is_file(__DIR__.'/language-live-questions.json')
       ||!is_file(__DIR__.'/language-live-knowledge.txt')
       ||!is_file(__DIR__.'/family-live-followups.json')
       ||!is_file(__DIR__.'/family-live.php')
       ||!is_file(__DIR__.'/intimacy-live-config.php'))return false;
    $cfg=require __DIR__.'/intimacy-live-config.php';
    return is_array($cfg)&&is_string($cfg['cloudru_key']??null)
        &&strlen($cfg['cloudru_key'])>12;
}
function nlKnowledge(): array {
    static $all=null;
    if($all!==null)return $all;
    $raw=@file_get_contents(__DIR__.'/language-live-knowledge.txt');
    if(!is_string($raw)||mb_strlen($raw,'UTF-8')>5000)
        throw new RuntimeException('LANGUAGE_KB_UNAVAILABLE');
    $lines=preg_split('/\R/u',trim($raw));
    if(!is_array($lines)||count($lines)!==22)
        throw new RuntimeException('LANGUAGE_KB_22_INVALID');
    $found=[];
    foreach($lines as $line){
        $parts=explode('|',$line);
        if(count($parts)!==3||!ctype_digit(trim($parts[0]))
           ||trim($parts[1])===''||trim($parts[2])==='')
            throw new RuntimeException('LANGUAGE_KB_ENTRY_INVALID');
        $number=(int)$parts[0];
        if($number<1||$number>22||isset($found[$number]))
            throw new RuntimeException('LANGUAGE_KB_NUMBER_INVALID');
        $found[$number]=['plus'=>trim($parts[1]),'minus'=>trim($parts[2])];
    }
    for($i=1;$i<=22;$i++)if(!isset($found[$i]))
        throw new RuntimeException('LANGUAGE_KB_INCOMPLETE');
    return $all=$found;
}
function nlPointMap(string $id): array {
    $maps=[
      'love-language'=>['left','top','loveHeart','center','bottomLeft','topLeft'],
      'how-to-talk'=>['left','top','center','topLeft','tailFirst','bottomLeft'],
      'accept-love'=>['left','top','loveHeart','center','tailSecond','bottomLeft'],
      'show-love'=>['left','top','loveHeart','center','rightNear','tailFirst'],
      'criticism'=>['left','top','center','tailFirst','bottomRight','bottomLeft'],
      'ask'=>['left','top','center','topLeft','rightNear','tailSecond'],
      'distance'=>['left','top','loveHeart','center','tailFirst','bottomLeft'],
      'hurt'=>['left','top','loveHeart','center','tailFirst','tailSecond'],
      'conflict-style'=>['left','top','center','tailFirst','bottomLeft','bottomRight'],
      'compliment'=>['left','top','center','loveHeart','topLeft','bottomLeft']
    ];
    if(!isset($maps[$id]))throw new RuntimeException('LANGUAGE_POINT_MAP_MISSING');
    return $maps[$id];
}
function nlQuestionFocus(string $id): string {
    $focus=[
      'love-language'=>'Назови ведущий способ, которым мужчина считывает любовь: слова, поступки, время, прикосновения, подарки или уважение к пространству. Приведи два конкретных сигнала. Не перечисляй всё подряд.',
      'how-to-talk'=>'КАК именно построить разговор, чтобы он услышал: тон, момент, конкретные слова и что вызывает защитную реакцию. Не пиши общий портрет.',
      'accept-love'=>'КАК он воспринимает заботу, ласку и внимание. Что радует, что воспринимает как контроль, какое проявление любви проходит мимо?',
      'show-love'=>'КАК по повторяющимся поступкам увидеть его чувства: действия, инициатива, время, поддержка. Не выдавай единичный жест за доказательство любви.',
      'criticism'=>'ЧТО делает, услышав неприятную правду: слушает, оправдывается, замыкается, спорит? Как лучше донести замечание без унижения?',
      'ask'=>'КАК сформулировать просьбу о конкретном действии и договориться о сроке. Что помогает, а что вызывает сопротивление? Никакой телепатии.',
      'distance'=>'ЧТО делать женщине, когда он закрывается: когда оставить пространство, когда вернуться к разговору и как распознать отказ обсуждать проблему.',
      'hurt'=>'КАКИЕ слова или поступки ранят его сильнее всего в близости, почему именно они и по каким признакам заметна обида. Не оправдывай давление.',
      'conflict-style'=>'КАК вести конфликт: когда говорить, что не делать, где границы. Не описывай его жизнь и не возлагай на женщину ответственность за его поведение.',
      'compliment'=>'КАКАЯ конкретная поддержка и признание ему понятны: за что похвалить, когда дать пространство, какой комплимент звучит фальшиво.'
    ];
    if(!isset($focus[$id]))throw new RuntimeException('LANGUAGE_FOCUS_INVALID');
    return $focus[$id];
}
function nlGenerateText(array $question,int $day,int $month,int $year): string {
    $id=$question['id'];
    $matrix=ni31($day,$month,$year);
    $names=nfPointTitles();
    $knowledge=nlKnowledge();
    $selected=[];
    foreach(nlPointMap($id) as $point){
        if(!isset($matrix[$point],$names[$point],$knowledge[$matrix[$point]]))
            throw new RuntimeException('LANGUAGE_POINT_MISSING');
        $traits=$knowledge[$matrix[$point]];
        $selected[]=['роль'=>$names[$point],'число_аркана'=>$matrix[$point],
            'плюс'=>$traits['plus'],'минус'=>$traits['minus']];
    }
    $follow=[];
    foreach(nlQuestions() as $item){
        if($item['id']!==$id&&!($item['isFree']??false))
            $follow[]=['раздел'=>'Языки любви мужчины','вопрос'=>$item['title'],'тип'=>'платный'];
    }
    $other=json_decode((string)file_get_contents(__DIR__.'/family-live-followups.json'),
        true,20,JSON_THROW_ON_ERROR);
    if(($other['version']??null)!==1||count($other['questions']??[])<65)
        throw new RuntimeException('LANGUAGE_FOLLOWUPS_MISSING');
    foreach($other['questions'] as $item){
        if(!is_string($item['вопрос']??null)||!is_string($item['раздел']??null))continue;
        if($item['раздел']==='Языки любви мужчины'&&$item['вопрос']===$question['title'])continue;
        $follow[]=$item;
    }
    $unique=[];
    foreach($follow as $item)$unique[$item['раздел'].'|'.$item['вопрос']]=$item;
    $follow=array_values($unique);
    $system=<<<'PROMPT'
Ты нумеролог и наблюдательная, немного дерзкая подруга. Отвечай на ОДИН конкретный вопрос блока «Языки любви мужчины». Не составляй общий психологический портрет, не перечисляй черты ради черт. В запросе есть узкий фокус вопроса: следуй ему строго. Женщина должна узнать, что мужчина чувствует, как общается или что делает именно в этой ситуации.

Матрица из 31 точки уже рассчитана. Для шести нужных точек есть короткие авторские плюсы и минусы 22 энергий именно о языке любви. Используй ИХ, а не свои универсальные трактовки. День и месяц учитывай строго 50/50, затем сопоставь минимум две дополнительные точки. Сочетание должно менять вывод для разных месяцев, а не только заменять слова. Не делай все сочетания с одинаковым днём одинаковыми. Не выбирай автоматом ни плюс, ни минус; покажи ведущую склонность и одну существенную тень без расплывчатого «может так или иначе».

Первое предложение СРАЗУ отвечает на вопрос. Первый абзац: только 2–3 узнаваемых поступка, реакции или реплики в рамках конкретного вопроса. Например, при вопросе о критике не рассказывай о подарках, а при вопросе о просьбе не анализируй весь его характер. Никаких романтических сказок, бездоказательных диагнозов, нравоучений и клише «в глубине души», «особый внутренний мир», «невероятное сочетание». Живой, разговорный, прямой язык, немного остроты, но без унижений. Сохраняй различия между чувствами, вниманием, манипуляциями и готовностью отвечать за поступки. Это символический расчёт, не утверждай, будто поступки достоверно известны.

ВТОРОЙ абзац: короткая естественная интригующая подводка к одному ДРУГОМУ платному вопросу из списка. Дай точное название этого вопроса в конце, не отвечай на него заранее и не обещай, что он уже опубликован.

РОВНО два русских абзаца, суммарно примерно 750–1050 знаков: первый 570–820, второй 130–210. Без заголовков, списков, markdown, смайликов, дат, расчётов, упоминаний арканов, энергий или искусственного интеллекта. Не используй длинные тире. Выдай только текст.
PROMPT;
    $payload=json_encode([
      'вопрос'=>$question['title'],
      'фокус_ответа_не_отклоняться'=>nlQuestionFocus($id),
      'важные_точки_с_авторскими_трактовками'=>$selected,
      'полная_рассчитанная_матрица_для_контекста'=>$matrix,
      'названия_вопросов_для_перехода'=>$follow
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    // Reuse the working no-fallback Gemini 3 Flash transport; no automatic retries.
    $text=nfCloudRaw([['role'=>'system','content'=>$system],['role'=>'user','content'=>$payload]],2800);
    $text=nfRestoreTwoParagraphs($text);
    $text=nfFitFamilyAnswerLength($text);
    $text=preg_replace('/[ \t]*[—–―][ \t]*/u',': ',$text)??$text;
    return preg_replace('/[ \t]{2,}/u',' ',$text)??$text;
}
function nlCacheDirectory(): string {
    $p=__DIR__.'/language-answer-cache';
    if(!is_dir($p)&&!@mkdir($p,0700,true)&&!is_dir($p))
        throw new RuntimeException('LANGUAGE_CACHE_UNAVAILABLE');
    return $p;
}
function nlCacheFile(string $id,string $date): string {
    if(!in_array($id,nlQuestionIds(),true)||naCatalogDate($date)===null)
        throw new InvalidArgumentException('LANGUAGE_INVALID_REQUEST');
    return nlCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).'-language-kb-v1.json';
}
function nlCachedAnswer(string $id,string $date): ?string {
    $path=nlCacheFile($id,$date);
    if(!is_file($path))return null;
    $raw=file_get_contents($path);
    if(!is_string($raw)||strlen($raw)>12000)return null;
    $json=json_decode($raw,true);
    $answer=is_array($json)&&($json['version']??null)===1
        &&($json['question']??null)===$id&&($json['date']??null)===$date
        ?($json['answer']??null):null;
    return is_string($answer)&&mb_strlen($answer,'UTF-8')>=450?$answer:null;
}
function nlEnsureAnswer(string $id,string $date): string {
    if(!nlEngineInstalled())throw new RuntimeException('LANGUAGE_ENGINE_UNAVAILABLE');
    $cached=nlCachedAnswer($id,$date);
    if($cached!==null)return $cached;
    $path=nlCacheFile($id,$date);
    $lock=@fopen($path.'.lock','c');
    if($lock===false)throw new RuntimeException('LANGUAGE_LOCK_UNAVAILABLE');
    try {
        if(!flock($lock,LOCK_EX))throw new RuntimeException('LANGUAGE_LOCK_UNAVAILABLE');
        $cached=nlCachedAnswer($id,$date);
        if($cached!==null)return $cached;
        $question=null;
        foreach(nlQuestions() as $q)if($q['id']===$id){$question=$q;break;}
        if($question===null)throw new RuntimeException('LANGUAGE_QUESTION_NOT_FOUND');
        [$year,$month,$day]=array_map('intval',explode('-',$date));
        try {
            $text=nlGenerateText($question,$day,$month,$year);
            $text=niValidateGeneratedText($text,'stop');
            if(mb_strlen($text,'UTF-8')>1800)throw new RuntimeException('LANGUAGE_TEXT_TOO_LONG');
        }catch(Throwable $e){
            $reason=$e instanceof RuntimeException?$e->getMessage():get_class($e);
            if(!is_string($reason)||preg_match('/\A[A-Z][A-Z0-9_]{2,79}\z/D',$reason)!==1)
                $reason='LANGUAGE_UNEXPECTED';
            error_log('LANGUAGE_RESULT_FAIL question='.$id.' reason='.$reason);
            throw $e;
        }
        $json=json_encode(['version'=>1,'question'=>$id,'date'=>$date,'answer'=>$text],
            JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
        $tmp=$path.'.'.bin2hex(random_bytes(6)).'.tmp';
        if(file_put_contents($tmp,$json,LOCK_EX)===false)
            throw new RuntimeException('LANGUAGE_CACHE_WRITE_FAILED');
        @chmod($tmp,0600);
        if(!rename($tmp,$path)){@unlink($tmp);throw new RuntimeException('LANGUAGE_CACHE_WRITE_FAILED');}
        return $text;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function nlEnsurePaidResource(string $resource): string {
    if(!nlSupportedPaidResource('redflag_question',$resource))
        throw new InvalidArgumentException('INVALID_LANGUAGE_RESOURCE');
    if(!preg_match('/^redflag:language:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m))
        throw new RuntimeException('LANGUAGE_RESOURCE_INVALID');
    return nlEnsureAnswer($m[1],$m[2]);
}
function nlMaterialFromCache(string $resource): array {
    if(!nlSupportedPaidResource('redflag_question',$resource))
        throw new RuntimeException('MATERIAL_NOT_READY');
    preg_match('/^redflag:language:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m);
    $answer=nlCachedAnswer($m[1],$m[2]);
    if($answer===null)throw new RuntimeException('MATERIAL_NOT_READY');
    $title='';
    foreach(nlQuestions() as $q)if($q['id']===$m[1]){$title=$q['title'];break;}
    return ['title'=>$title,'sections'=>[['title'=>$title,
        'paragraphs'=>preg_split('/\n\s*\n/u',$answer)]],
        'links'=>[],'pdf_available'=>false];
}
function nlPermitFree(string $date,?array $owner,callable $generate): string {
    if($owner!==null&&naTestOwner($owner))return $generate();
    $cached=nlCachedAnswer('love-language',$date);
    if($cached!==null)return $cached;
    $stamp=gmdate('Ymd');
    $addr=(string)($_SERVER['REMOTE_ADDR']??'');
    $hash=hash('sha256',$stamp.'|'.$addr.'|language-free-v1');
    $path=nlCacheDirectory().'/free-'.$hash.'.quota';
    $handle=@fopen($path,'c+');
    if($handle===false)throw new RuntimeException('FREE_RATE_LIMIT_STORAGE_UNAVAILABLE');
    try {
        if(!flock($handle,LOCK_EX))throw new RuntimeException('FREE_RATE_LIMIT_STORAGE_UNAVAILABLE');
        rewind($handle);$old=trim((string)stream_get_contents($handle));
        if($old!==''&&$old!==$date)throw new RuntimeException('FREE_DAILY_LIMIT');
        $answer=$generate();
        rewind($handle);ftruncate($handle,0);fwrite($handle,$date);fflush($handle);
        return $answer;
    }finally{flock($handle,LOCK_UN);fclose($handle);}
}
