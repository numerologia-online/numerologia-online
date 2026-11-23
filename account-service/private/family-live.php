<?php
declare(strict_types=1);
/**
 * Family and household: Gemini 3 Flash grounded in an owner-approved short 22-arcana family bank.
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
    return $m[1]!=='independent'&&in_array($m[1],nfQuestionIds(),true)&&naCatalogDate($m[2])!==null;
}
function nfEngineInstalled(): bool {
    if(!is_file(__DIR__.'/family-live.php') || !is_file(__DIR__.'/family-live-questions.json')
       || !is_file(__DIR__.'/family-live-followups.json') || !is_file(__DIR__.'/intimacy-live-config.php')
       || !is_file(__DIR__.'/family-live-knowledge.txt'))
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
    // The whole matrix is calculated, but only four RELEVANT perspectives are
    // supplied. A conclusion is synthesized rather than listing six types.
    $maps=[
      'independent'=>['left','top','center','bottom'],
      'household'=>['left','top','center','rightNear'],
      'vacation'=>['left','top','topLeft','bottomLeft'],
      'plans'=>['left','top','right','bottomRight'],
      'children'=>['left','top','loveHeart','bottom'],
      'roles'=>['left','top','center','loveHeart'],
      'home'=>['left','top','loveHeart','bottom'],
      'conflict'=>['left','top','center','tailFirst'],
      'money-at-home'=>['left','top','moneyPoint','bottomRight'],
      'care'=>['left','top','loveHeart','rightNear']
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


/** Author-approved plus/minus family tendencies, max 5000 Unicode characters total. */
function nfFamilyKnowledge(): array {
    static $knowledge=null;
    if($knowledge!==null)return $knowledge;
    $raw=@file_get_contents(__DIR__.'/family-live-knowledge.txt');
    if(!is_string($raw)||mb_strlen($raw,'UTF-8')>5000)
        throw new RuntimeException('FAMILY_KB_MISSING_OR_TOO_LONG');
    $lines=preg_split('/\R/u',trim($raw));
    if(!is_array($lines)||count($lines)!==22)throw new RuntimeException('FAMILY_KB_22_INVALID');
    $parsed=[];
    foreach($lines as $line){
        $fields=explode('|',trim($line));
        if(count($fields)!==3||!ctype_digit($fields[0])||trim($fields[1])===''||trim($fields[2])==='')
            throw new RuntimeException('FAMILY_KB_ENTRY_INVALID');
        $number=(int)$fields[0];
        if($number<1||$number>22||isset($parsed[(string)$number]))
            throw new RuntimeException('FAMILY_KB_NUMBER_INVALID');
        $parsed[(string)$number]=['plus'=>trim($fields[1]),'minus'=>trim($fields[2])];
    }
    for($i=1;$i<=22;$i++)if(!isset($parsed[(string)$i]))
        throw new RuntimeException('FAMILY_KB_INCOMPLETE');
    return $knowledge=$parsed;
}

/**
 * Family-only length guard: retain the completed provider answer but cut
 * surplus sentences from the first paragraph, keeping the paid follow-up.
 * Unlike re-generation, this incurs no additional provider request.
 */
function nfFitFamilyAnswerLength(string $text): string {
    if(mb_strlen($text,'UTF-8')<=1350)return $text;
    $parts=preg_split('/\n\s*\n/u',trim($text));
    if(!is_array($parts)||count($parts)!==2)return $text;
    [$first,$second]=array_map('trim',$parts);
    $limit=min(1100,max(550,1350-mb_strlen($second,'UTF-8')-2));
    if(mb_strlen($first,'UTF-8')<=$limit)return $text;
    $sentences=preg_split('/(?<=[.!?…])\s+(?=[А-ЯЁ«„"0-9])/u',$first);
    if(!is_array($sentences)||count($sentences)<3)return $text;
    $kept=[];
    foreach($sentences as $sentence){
        $candidate=implode(' ',array_merge($kept,[$sentence]));
        if(mb_strlen($candidate,'UTF-8')>$limit)break;
        $kept[]=$sentence;
    }
    $newFirst=trim(implode(' ',$kept));
    if(mb_strlen($newFirst,'UTF-8')<450)return $text;
    $result=$newFirst."\n\n".$second;
    return mb_strlen($result,'UTF-8')<=1350?$result:$text;
}

/**
 * The actual customer question is the entire subject. The AI must answer that
 * question, not transform the answer into a personality portrait.
 */
function nfQuestionFocus(string $id): string {
    $focus=[
      'independent'=>'Отвечай: сам решает и обслуживает себя или зависит от матери/родных? Покажи реальные самостоятельные действия; не путай с желанием командовать.',
      'household'=>'Отвечай: сам готовит, моет, убирает, замечает беспорядок или ждёт обслуживания? Умение организовать ремонт не равно ежедневной хозяйственности.',
      'vacation'=>'Отвечай: приятно ли именно путешествовать вместе? Кто планирует дорогу, чемоданы, билеты; как переносит задержки, перемены и неудобства.',
      'plans'=>'Отвечай: доводит ли обещанное до результата? Покажи, что происходит от слов и инициативы до выполнения и напоминаний.',
      'children'=>'Отвечай: готов ли участвовать именно в повседневной заботе о ребёнке, а не просто любить детей, развлекать их или зарабатывать.',
      'roles'=>'Отвечай: советуется ли с женой, делит ли решения и ответственность или диктует правила? Не подменяй партнёрство чистотой дома.',
      'home'=>'Отвечай: выбирает ли время с семьёй и возвращение домой или постоянно находит другие занятия? Не путай любовь к дому с любовью к уборке.',
      'conflict'=>'Отвечай: при первой серьёзной семейной проблеме пытается разговаривать и решать или давит, замолкает, сбегает? Только действия в конфликте.',
      'money-at-home'=>'Отвечай: создаёт ли стабильную материальную базу и выполняет обязательства или лишь говорит о больших планах? Не оценивай чистоту.',
      'care'=>'Отвечай: замечает ли нужды жены и помогает в обычных мелочах без просьб или перекладывает ежедневную заботу? Не подменяй заботу статусом.'
    ];
    if(!isset($focus[$id]))throw new RuntimeException('FAMILY_QUESTION_FOCUS_MISSING');
    return $focus[$id];
}

function nfGenerateText(array $question,int $day,int $month,int $year): string {
    $id=$question['id'];
    $matrix=ni31($day,$month,$year);
    $titles=nfPointTitles();
    $kb=nfFamilyKnowledge();
    $selected=[];
    foreach(nfQuestionPoints($id) as $key){
        if(!isset($matrix[$key],$titles[$key]))throw new RuntimeException('FAMILY_MATRIX_POINT_MISSING');
        $traits=$kb[(string)$matrix[$key]]??null;
        if(!is_array($traits))throw new RuntimeException('FAMILY_KB_POSITION_MISSING');
        $selected[]=['роль'=>$titles[$key],
            'плюс'=>$traits['plus'],'минус'=>$traits['minus']];
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
Ты опытный нумеролог Матрицы судьбы (22 Старших аркана), пишешь женщине о мужчине. Это раздел «Семья и быт». Отвечай на ОДИН заданный вопрос, не на всю жизнь мужчины.

У тебя НЕТ готовых выводов или банка готовых ответов. Сайт уже математически рассчитал полную матрицу мужчины. Ты получаешь только ПОНЯТНЫЕ СЛОВЕСНЫЕ ХАРАКТЕРИСТИКИ нескольких значимых для этого вопроса позиций из нашей базы знаний, без номеров и названий арканов. Объединяй именно эти характеристики, ничего не пересчитывай. Нельзя переносить формулировки из технических данных в клиентский текст.

Перед тем как писать, самостоятельно сопоставь полученные характеристики, выбери ОДНУ ведущую конкретную склонность и уточни, как остальные действительно меняют её проявление. Не распределяй влияние по процентам, не перечисляй по очереди все плюсы и минусы. Дополнительные позиции нужны для вывода, а не для новых противоречивых портретов. Не превращай противоречие в бессмысленную золотую середину. Если одна характеристика уточняет или смягчает другую, отрази это в едином сценарии. Для разных дат и разных вопросов меняй сам вывод, а не только слова.

Не дипломатничай там, где характеристики указывают на конкретную бытовую слабость. Лень, безответственность, инфантильность, перекладывание обязанностей, мелочные придирки и стремление распоряжаться чужими делами называй прямо, если это соответствует сочетанию. Но не делай мужчину жёстким, ленивым или властным автоматически. Если сочетание указывает на самостоятельность, заботу, расчётливость, гибкость или хозяйственность, говори это уверенно, не выдумывай недостатки для равновесия. Это символические возможные склонности, не проверенные факты.

Пиши как умная, дерзкая, наблюдательная подруга. Чётко, ярко, нормальными словами, заметно острее и смелее, чем вежливый психолог, с узнаваемыми поступками. В ПЕРВОЙ ФРАЗЕ прямой ответ именно на поставленный вопрос. Затем два-три РАЗНЫХ конкретных проявления выбранного вывода и чем это оборачивается для женщины. Не переключайся на карьеру, характер вообще, весь жизненный путь или другие темы. Одна меткая, неожиданная формулировка лучше трёх дипломатичных объяснений.

Не бойся назвать неприятные проявления прямо, если они вытекают из переданных характеристик. Но никакой грубости к женщине, искусственного драматизма и обвинений без оснований. Никакой воды, пафоса, нравоучений, повторов или необязательных похвал. Не смягчай обоснованный вывод и не заставляй женщину отвечать за мужское поведение. Нельзя: «он не со зла», «это не злой умысел», «он просто такой», «ему нужно понять», «если ты умеешь объяснять», «на самом деле ему важно», «в целом», «зато». Не выдумывай уже совершённых поступков.

ФОРМАТ. Ровно два абзаца, вместе ориентировочно 950–1200 знаков. Первый, основной, примерно 730–950 знаков: главный вывод, два-три РАЗНЫХ признака и конкретный риск или достоинство, без воды и повторов. Второй, примерно 150–230 знаков, это НЕ голая ссылка и НЕ пересказ названия. Он должен оставить лёгкое напряжение и вызвать желание открыть следующий вопрос. Напиши две-три живые фразы: сначала конкретная неожиданная зацепка, вытекающая именно из вывода ПЕРВОГО абзаца, затем поверни разговор к ДРУГОЙ стороне отношений, закончи ОДНИМ ТОЧНЫМ названием следующего платного вопроса из переданного списка. Не отвечай на следующий вопрос вместо того, чтобы заинтересовать. Не называй следующий вопрос случайно, выбирай содержательную связь. Избегай шаблонов «раз уж мы разобрались», «а теперь давай узнаем», «интересно, что будет дальше», «не менее важный вопрос», «следующий вопрос», «логично спросить». Каждая подводка должна быть самостоятельной, цепкой и отличаться от подводок к другим ответам. Если текст уже насыщен, не растягивай его ради количества знаков.

Не называй покупательнице арканы, числа, энергии, дату, методику, внутренние расчёты или названия технических позиций. Нужны исключительно человеческие черты и поступки. НЕЛЬЗЯ ИСПОЛЬЗОВАТЬ ДЛИННОЕ ИЛИ СРЕДНЕЕ ТИРЕ: «—», «–», «―». Перестрой предложения через точку, двоеточие или союз. Вычитай собственный ответ перед отправкой. Без заголовков, списков и Markdown. Верни только два русских абзаца.
PROMPT;
    $payload=json_encode([
      'вопрос'=>$question['title'],
      'фокус_ответа_не_отклоняться'=>nfQuestionFocus($id),
      'смысловые_характеристики_для_вывода'=>$selected,
      'точные_названия_для_перехода'=>$followups
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $text=nfCloudRaw([['role'=>'system','content'=>$system],['role'=>'user','content'=>$payload]],2800);
    $text=nfRestoreTwoParagraphs($text);
    $text=nfFitFamilyAnswerLength($text);
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
    return nfCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).'-family-ideal-synthesis-v5.json';
}
function nfCachedAnswer(string $id,string $date): ?string {
    return nfReadCachedAnswer(nfCacheFile($id,$date),$id,$date);
}
/** Existing paid materials remain readable from both earlier cache formats. */
function nfLegacyCachedAnswer(string $id,string $date): ?string {
    if(!in_array($id,nfQuestionIds(),true)||naCatalogDate($date)===null)return null;
    $prefix=nfCacheDirectory().'/'.$id.'-'.str_replace('-','',$date);
    foreach(['-family-focused-v4.json','-family-focused-v3.json','-family-kb-v2.json','-nokb-v1.json'] as $suffix){
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
        try {
            $text=nfGenerateText($q,$d,$m,$y);
            $text=niValidateGeneratedText($text,'stop');
            if(mb_strlen($text,'UTF-8')>1800)
                throw new RuntimeException('FAMILY_TEXT_TOO_LONG');
        }catch(Throwable $e){
            // Private log records only an allowlisted reason and public question ID.
            // No customer date, account, AI answer, credentials or provider payload.
            $reason=$e instanceof RuntimeException?$e->getMessage():get_class($e);
            if(!is_string($reason)||preg_match('/\\A[A-Z][A-Z0-9_]{2,79}\\z/D',$reason)!==1)
                $reason='FAMILY_UNEXPECTED';
            error_log('FAMILY_RESULT_FAIL question='.$id.' reason='.$reason);
            throw $e;
        }
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
    if($answer===null)$answer=nfLegacyCachedAnswer($m[1],$m[2]);
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
