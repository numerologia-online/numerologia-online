<?php
declare(strict_types=1);
/**
 * Family and household: native Gemini 3 Flash with NO interpretive 22-arcana bank.
 * Reuses the approved private Cloud.ru transport, 31-point arithmetic and validation.
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
    return $m[1]!=='independent'&&in_array($m[1],nfQuestionIds(),true)&&naCatalogDate($m[2])!==null;
}
function nfEngineInstalled(): bool {
    if(!is_file(__DIR__.'/family-live.php') || !is_file(__DIR__.'/family-live-questions.json')
       || !is_file(__DIR__.'/family-live-followups.json') || !is_file(__DIR__.'/intimacy-live-config.php'))
        return false;
    $config=require __DIR__.'/intimacy-live-config.php';
    return is_array($config)&&is_string($config['cloudru_key']??null)
       &&strlen($config['cloudru_key'])>12;
}
function nfPointTitles(): array {
    return [
      'left'=>'День рождения: как проявляется в обычной жизни',
      'top'=>'Месяц рождения: привычные стремления и потребности',
      'right'=>'Год рождения: стиль действий и решений',
      'bottom'=>'Задачи взросления и ответственности',
      'center'=>'Центр личности: базовая реакция',
      'topLeft'=>'Соединение дня и месяца',
      'topRight'=>'Соединение месяца и года',
      'bottomRight'=>'Практическое действие в сложных обстоятельствах',
      'bottomLeft'=>'Эмоциональные привычки',
      'loveHeart'=>'Как строит близкий союз',
      'tailFirst'=>'Повторяющийся сценарий в отношениях',
      'tailSecond'=>'Как меняет старые привычки',
      'moneyPoint'=>'Деньги, практическая устойчивость',
      'wellbeing'=>'Баланс повседневной жизни',
      'rightNear'=>'Воплощение решений в действия'
    ];
}
function nfQuestionPoints(string $id): array {
    $maps=[
      'independent'=>['left','top','center','right','tailFirst','bottom'],
      'household'=>['left','top','center','bottom','rightNear','moneyPoint'],
      'vacation'=>['left','top','center','tailFirst','topLeft','bottomLeft'],
      'plans'=>['left','top','right','center','bottomRight','tailSecond'],
      'children'=>['left','top','loveHeart','center','bottom','tailFirst'],
      'roles'=>['left','top','center','loveHeart','right','bottomLeft'],
      'home'=>['left','top','loveHeart','center','bottom','tailFirst'],
      'conflict'=>['left','top','center','tailFirst','tailSecond','bottom'],
      'money-at-home'=>['left','top','right','moneyPoint','center','bottomRight'],
      'care'=>['left','top','center','loveHeart','bottomLeft','rightNear']
    ];
    if(!isset($maps[$id]))throw new RuntimeException('FAMILY_QUESTION_MAP_MISSING');
    return $maps[$id];
}

/**
 * Family-only provider transport: accept raw Gemini text before enforcing formatting.
 * Other categories retain their original niCloudCall/niValidateGeneratedText.
 * No automatic provider retries or changed model/cost budgets.
 */
function nfProviderFailure(string $reason,int $status,array $json=[],string $finish=''): never {
    $usage=$json['usage']??[];
    error_log('FAMILY_PROVIDER '.json_encode([
        'error'=>$reason,'http_status'=>$status,'finish_reason'=>$finish,
        'prompt_tokens'=>is_int($usage['prompt_tokens']??null)?$usage['prompt_tokens']:null,
        'completion_tokens'=>is_int($usage['completion_tokens']??null)?$usage['completion_tokens']:null,
        'reasoning_tokens'=>is_int($usage['completion_tokens_details']['reasoning_tokens']??null)
            ?$usage['completion_tokens_details']['reasoning_tokens']:null
    ],JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
    throw new RuntimeException($reason);
}
function nfCloudRaw(array $messages,int $tokens=2800): string {
    $cfg=require __DIR__.'/intimacy-live-config.php';
    $key=is_array($cfg)?($cfg['cloudru_key']??null):null;
    if(!is_string($key)||$key==='')nfProviderFailure('KEY_NOT_CONFIGURED',0);
    $model='google/gemini-3-flash-preview';
    $ch=curl_init('https://foundation-models.api.cloud.ru/v1/chat/completions');
    if($ch===false)nfProviderFailure('PROVIDER_NETWORK_ERROR',0);
    curl_setopt_array($ch,[
        CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>95,
        CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$key],
        CURLOPT_POSTFIELDS=>json_encode([
            'model'=>$model,'messages'=>$messages,'max_tokens'=>$tokens,'stream'=>false
        ],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)
    ]);
    $body=curl_exec($ch);
    $status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
    $curlCode=curl_errno($ch);
    curl_close($ch);
    if($curlCode===28)nfProviderFailure('PROVIDER_TIMEOUT',$status);
    if($curlCode!==0)nfProviderFailure('PROVIDER_NETWORK_ERROR',$status);
    $json=is_string($body)?json_decode($body,true,32):null;
    if(!is_array($json))nfProviderFailure('PROVIDER_INVALID_JSON',$status);
    $error=$json['error']??null;
    $code=is_array($error)&&is_string($error['code']??null)?strtolower($error['code']):'';
    $message=is_string($error)?$error:($error['message']??null);
    $modelMissing=in_array($code,[
        'model_not_found','model_not_available','model_unavailable','model_not_supported',
        'model_deprecated','model_retired'
    ],true);
    if(is_string($message)&&niProviderNotice($message)==='PROVIDER_MODEL_UNAVAILABLE')
        $modelMissing=true;
    if($modelMissing)nfProviderFailure('PROVIDER_MODEL_UNAVAILABLE',$status,$json);
    if($status!==200)nfProviderFailure('PROVIDER_HTTP_'.$status,$status,$json);
    if($error!==null)nfProviderFailure('PROVIDER_SERVICE_MESSAGE',$status,$json);
    $choice=$json['choices'][0]??null;
    if(!is_array($choice))nfProviderFailure('PROVIDER_EMPTY_CHOICES',$status,$json);
    $finish=is_string($choice['finish_reason']??null)?strtolower($choice['finish_reason']):'';
    if(in_array($finish,['length','max_tokens'],true))
        nfProviderFailure('PROVIDER_OUTPUT_LIMIT',$status,$json,$finish);
    if(in_array($finish,['content_filter','safety','blocked','refusal'],true)
       || !empty($choice['message']['refusal']))
        nfProviderFailure('PROVIDER_REFUSAL',$status,$json,$finish);
    $content=$choice['message']['content']??null;
    if(is_array($content)){
        $fragments=[];
        foreach($content as $part){
            if(!is_array($part))continue;
            if(($part['type']??null)==='refusal')
                nfProviderFailure('PROVIDER_REFUSAL',$status,$json,$finish);
            if(is_string($part['text']??null))$fragments[]=$part['text'];
        }
        $content=implode('',$fragments);
    }
    if(!is_string($content)||trim($content)==='')
        nfProviderFailure('EMPTY_ANSWER',$status,$json,$finish);
    $notice=niProviderNotice($content);
    if($notice!==null)nfProviderFailure($notice,$status,$json,$finish);
    return $content;
}
/**
 * Gemini may write three paragraphs, two with an internal newline, or one
 * continuous paragraph. Reassemble the SAME WORDS into exactly two paragraphs
 * instead of discarding a perfectly good completed response.
 */
function nfRestoreTwoParagraphs(string $text): string {
    $text=trim(str_replace(["\r\n","\r"],"\n",$text));
    $blocks=preg_split('/\n[ \t]*\n+/u',$text);
    if(!is_array($blocks))return $text;
    $blocks=array_values(array_filter(array_map('trim',$blocks),static fn($p)=>$p!==''));
    if(count($blocks)===2)return implode("\n\n",$blocks);
    if(count($blocks)===1){
        // Plain newlines with no empty line are also common in model responses.
        $lines=preg_split('/\n+/u',$blocks[0]);
        $lines=is_array($lines)?array_values(array_filter(array_map('trim',$lines))):[];
        if(count($lines)>=2)$blocks=$lines;
    }
    if(count($blocks)>2){
        $last=array_pop($blocks);
        while(mb_strlen($last,'UTF-8')<100&&count($blocks)>1)
            $last=array_pop($blocks).' '.$last;
        $first=trim(implode(' ',array_map('trim',$blocks)));
        if($first!==''&&trim($last)!=='')return $first."\n\n".trim($last);
    }
    if(count($blocks)===2)return implode("\n\n",array_map('trim',$blocks));
    // Single uninterrupted paragraph: split at a genuine sentence boundary,
    // keeping the final 1-2 sentences and recommended question intact.
    $single=trim(preg_replace('/\s+/u',' ',$text)??$text);
    $sentences=preg_split('/(?<=[.!?…])\s+(?=[А-ЯЁ«„"0-9])/u',$single);
    if(!is_array($sentences)||count($sentences)<3)return $text;
    $last=array_pop($sentences);
    while(mb_strlen($last,'UTF-8')<145&&count($sentences)>1)
        $last=array_pop($sentences).' '.$last;
    $first=trim(implode(' ',$sentences));
    if(mb_strlen($first,'UTF-8')<200||trim($last)==='')return $text;
    return $first."\n\n".trim($last);
}

function nfGenerateText(array $question,int $day,int $month,int $year): string {
    $id=$question['id'];
    $matrix=ni31($day,$month,$year);
    $titles=nfPointTitles();
    $selected=[];
    foreach(nfQuestionPoints($id) as $key){
        if(!isset($matrix[$key],$titles[$key]))throw new RuntimeException('FAMILY_MATRIX_POINT_MISSING');
        $selected[]=['роль'=>$titles[$key],'число_аркана'=>$matrix[$key]];
    }
    $raw=json_decode((string)file_get_contents(__DIR__.'/family-live-followups.json'),true,20,JSON_THROW_ON_ERROR);
    if(($raw['version']??null)!==1||count($raw['questions']??[])<65)
        throw new RuntimeException('FAMILY_FOLLOWUPS_UNAVAILABLE');
    $followups=[];
    foreach(nfQuestions() as $q){
        if($q['id']!==$id&&!($q['isFree']??false))
            $followups[]=['раздел'=>'Семья и быт','вопрос'=>$q['title'],'тип'=>'платный'];
    }
    foreach($raw['questions'] as $next){
        if(($next['раздел']??null)==='Семья и быт'&&($next['вопрос']??null)===$question['title'])continue;
        $followups[]=$next;
    }
    $unique=[];
    foreach($followups as $option){
        if(!is_string($option['раздел']??null)||!is_string($option['вопрос']??null))continue;
        $unique[$option['раздел'].'|'.$option['вопрос']]=$option;
    }
    $followups=array_values($unique);
    if(count($followups)<65)throw new RuntimeException('FAMILY_FOLLOWUPS_NOT_READY');
    $system=<<<'PROMPT'
Ты опытный нумеролог, работающий с Матрицей судьбы по системе 22 Старших арканов. Ты говоришь с женщиной о конкретном мужчине. Раздел «Семья и быт»: взрослость, домашние дела, самостоятельность, дети, ответственность, деньги семьи, совместные решения и поведение в трудностях. Отвечай на ОДИН вопрос, а не составляй общий гороскоп или характеристику всей его жизни.

Эксперимент БЕЗ НАШЕЙ БАЗЫ ТРАКТОВОК. Сайт уже математически рассчитал 31 позицию Матрицы судьбы из полной даты рождения. Тебе даны рассчитанные номера и смысл ролей наиболее важных для этого вопроса точек. САМОСТОЯТЕЛЬНО интерпретируй их в привычной системе 22 арканов: 8 это Справедливость, 11 это Сила, 22 это Шут. Никаких готовых авторских характеристик тебе не передано. Не пересчитывай и не изменяй числа; не смешивай с астрологией, жизненным путём из другой школы, MBTI и психологической диагностикой. Сначала сопоставь минимум три точки. ОБЯЗАТЕЛЬНО учитывай И ДЕНЬ, И МЕСЯЦ рождения как равноправные исходные влияния, а остальные точки используй для уточнения: почему он именно так действует. Выбери одну ведущую склонность; не выдавай шаблонный компромисс «может так, а может иначе». Не делай одинаковые выводы для разных дат и разных вопросов.

СТИЛЬ. Пиши как близкая умная подруга, которая видит суть и умеет говорить простым живым языком. Уверенно, наблюдательно, слегка дерзко, иногда с тонкой иронией и бытовым юмором, но не грубо и не зло. Твой ответ должен вызывать узнавание: «Вот это мой муж!», «Вот почему он так делает» или «Как хорошо, что я это узнала». Понятные бытовые поступки сильнее абстрактных черт. Не превращай текст в торжественную речь, литературный рассказ, рекламу или нравоучение. Запрещены завуалированные формулы «его пространство смыслов», «динамика системы», «внутренний ресурс», «путь осознанности», «он проживает сценарий». Говори по-человечески: кто закупает продукты, моет посуду, договаривается, выполняет обещания, не сбегает от трудных решений, участвует в заботе о ребёнке. Но эти примеры не надо перечислять механически, выбирай только действительно относящееся к вопросу.

С ПЕРВОЙ ФРАЗЫ прямо ответь на сформулированный вопрос. Назови два-три РАЗНЫХ и конкретных проявления именно этой склонности. Если мужчина способен поддерживать семью, решать вопросы и быть равноправным партнёром, скажи это ясно, без обязательного подвоха. Если ждёт обслуживания, обещает вместо действий, перекладывает ответственность или пытается командовать, называй это точно и без смягчений. Нельзя превращать любое неудобство в тяжёлую патологию, приписывать ему реальные поступки, объявлять гарантированную измену или делать выводы об истинной пригодности человека к родительству. Нумерология описывает символические склонности, а не доказанные события. Не обвиняй женщину в поступках мужчины и не оправдывай нарушение границ.

ФОРМАТ. Ровно два русских абзаца, всего ориентировочно 850–1100 знаков. Первый примерно 680–850: конкретный ответ и узнаваемые поступки без повторов. Второй примерно 150–230: естественный, остроумный и интригующий переход к ОДНОМУ другому платному вопросу из списка. Лучше вопрос из другого раздела, который раскрывает новую, действительно связанную сторону мужчины; допускается вопрос из «Семья и быт». В конце второго абзаца напиши название выбранного вопроса ТОЧНО по списку. Не пересказывай название вместо подводки и не отвечай заранее на следующий вопрос. Не используй штампы «а теперь давай узнаем», «проверь ещё», «следующий вопрос», «не менее интересно». Не обещай, что вопрос уже опубликован или доступен прямо сейчас.

КЛИЕНТУ НЕЛЬЗЯ ПОКАЗЫВАТЬ даты, номера, названия арканов, энергию, матрицу, методику, технические точки и расчёты. Никаких заголовков, списков, Markdown, эмодзи. Не используй длинные или средние тире «—», «–», «―». Верни только готовый русский текст в двух абзацах.
PROMPT;
    $payload=json_encode([
      'вопрос'=>$question['title'],
      'важные_числовые_точки_для_данного_вопроса'=>$selected,
      'полная_рассчитанная_матрица_для_контекста'=>$matrix,
      'точные_названия_для_перехода'=>$followups
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $text=nfCloudRaw([['role'=>'system','content'=>$system],['role'=>'user','content'=>$payload]],2800);
    $text=nfRestoreTwoParagraphs($text);
    $text=preg_replace('/[ \t]*[—–―][ \t]*/u',': ',$text)??$text;
    $text=preg_replace('/:[ \t]*:/u',':',$text)??$text;
    return preg_replace('/[ \t]{2,}/u',' ',$text)??$text;
}
function nfCacheDirectory(): string {
    $path=__DIR__.'/family-answer-cache';
    if(!is_dir($path)&&!@mkdir($path,0700,true)&&!is_dir($path))
        throw new RuntimeException('FAMILY_CACHE_UNAVAILABLE');
    return $path;
}
function nfCacheFile(string $id,string $date): string {
    if(!in_array($id,nfQuestionIds(),true)||naCatalogDate($date)===null)
        throw new InvalidArgumentException('FAMILY_INVALID_REQUEST');
    return nfCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).'-nokb-v1.json';
}
function nfCachedAnswer(string $id,string $date): ?string {
    $path=nfCacheFile($id,$date);
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
    $existing=nfCachedAnswer($id,$date);
    if($existing!==null)return $existing;
    $path=nfCacheFile($id,$date);
    $lock=@fopen($path.'.lock','c');
    if($lock===false)throw new RuntimeException('FAMILY_LOCK_UNAVAILABLE');
    try {
        if(!flock($lock,LOCK_EX))throw new RuntimeException('FAMILY_LOCK_UNAVAILABLE');
        $existing=nfCachedAnswer($id,$date);
        if($existing!==null)return $existing;
        $q=null;
        foreach(nfQuestions() as $candidate)if($candidate['id']===$id){$q=$candidate;break;}
        if($q===null)throw new RuntimeException('FAMILY_QUESTION_NOT_FOUND');
        [$y,$m,$d]=array_map('intval',explode('-',$date));
        $text=nfGenerateText($q,$d,$m,$y);
        $text=niValidateGeneratedText($text,'stop');
        if(mb_strlen($text,'UTF-8')>1800)throw new RuntimeException('FAMILY_TEXT_TOO_LONG');
        $blob=json_encode(['version'=>1,'question'=>$id,'date'=>$date,'answer'=>$text],
            JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
        $tmp=$path.'.'.bin2hex(random_bytes(6)).'.tmp';
        if(file_put_contents($tmp,$blob,LOCK_EX)===false)throw new RuntimeException('FAMILY_CACHE_WRITE_FAILED');
        @chmod($tmp,0600);
        if(!rename($tmp,$path)){@unlink($tmp);throw new RuntimeException('FAMILY_CACHE_WRITE_FAILED');}
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
    if($answer===null)throw new RuntimeException('MATERIAL_NOT_READY');
    $title='';
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
