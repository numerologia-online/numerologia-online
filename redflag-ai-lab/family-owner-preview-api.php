<?php
declare(strict_types=1);
/**
 * FAMILY OWNER-ONLY manual AI preview.
 * This endpoint cannot be used by customers, creates no purchase, and does
 * not touch the disabled family-live.php customer generator or old KB files.
 */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
require_once dirname(__DIR__,3).'/private/numi-account-20261031/intimacy-live.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow, noarchive');
function foReply(int $status,array $body): never {
    http_response_code($status);
    echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
function foMap(): array {
    // Exactly five relevant matrix positions. First is the LEADING birth-day,
    // second is the birth-month; ALL four other points alter the interpretation.
    return [
      'independent'=>['left','top','right','bottom','tailSecond'],
      'household'=>['left','top','wellbeing','bottom','rightNear'],
      'vacation'=>['left','top','topLeft','bottomLeft','right'],
      'plans'=>['left','top','right','bottomRight','tailSecond'],
      'children'=>['left','top','loveHeart','bottom','tailFirst'],
      'roles'=>['left','top','center','loveHeart','right'],
      'home'=>['left','top','loveHeart','bottom','bottomLeft'],
      'conflict'=>['left','top','center','tailFirst','bottomRight'],
      'money-at-home'=>['left','top','moneyPoint','rightNear','bottomRight'],
      'care'=>['left','top','loveHeart','wellbeing','rightNear']
    ];
}
function foFocus(): array {
    return [
      'independent'=>'Отвечай об умении самому решать повседневные вопросы, не зависеть от мамы и отвечать за свои решения. Харизма, сила, деньги, напор и умение добиваться желаемого НЕ доказывают взрослую самостоятельность.',
      'household'=>'Отвечай именно о регулярной личной работе по дому. Не считай разовый ремонт, умение руководить, большой заработок и любовь к комфорту доказательствами хозяйственности.',
      'vacation'=>'Отвечай о поведении в поездке, планировании маршрута, задержках, решении дорожных проблем и умении дать женщине отдохнуть.',
      'plans'=>'Отвечай, доводит ли мужчина обещания до результата, а не насколько красиво он мечтает и убеждает.',
      'children'=>'Отвечай о готовности к повседневному уходу за ребёнком, а не только о любви к детям, подарках и заработке.',
      'roles'=>'Отвечай о разделении решений и обязанностей, партнёрстве и праве женщины на своё мнение.',
      'home'=>'Отвечай, выбирает ли мужчина семью, время дома и участие в общих делах, а не насколько любит уборку.',
      'conflict'=>'Отвечай о поступках при семейном конфликте: берётся ли решать, давит, исчезает или пытается договориться.',
      'money-at-home'=>'Отвечай о выполнении материальных обязательств и реальной устойчивости дома, а не о богатстве на словах.',
      'care'=>'Отвечай, замечает ли повседневные нужды женщины и помогает ли без напоминаний, а не о статусе и громких подарках.'
    ];
}
function foKnowledge(): array {
    static $bank=null;
    if($bank!==null)return $bank;
    $path=dirname(__DIR__,3).'/private/numi-account-20261031/family-owner-knowledge-v1.txt';
    $raw=@file_get_contents($path);
    if(!is_string($raw)||mb_strlen($raw,'UTF-8')>5000)
        throw new RuntimeException('FAMILY_OWNER_KNOWLEDGE_UNAVAILABLE');
    $lines=preg_split('/\\R/u',trim($raw));
    if(!is_array($lines)||count($lines)!==22)
        throw new RuntimeException('FAMILY_OWNER_KNOWLEDGE_INCOMPLETE');
    $bank=[];
    foreach($lines as $line){
        $parts=explode('|',$line);
        if(count($parts)!==4||!ctype_digit($parts[0]))
            throw new RuntimeException('FAMILY_OWNER_KNOWLEDGE_INVALID');
        $n=(int)$parts[0];
        if($n<1||$n>22||isset($bank[$n]))
            throw new RuntimeException('FAMILY_OWNER_KNOWLEDGE_DUPLICATE');
        $traits=array_map('trim',array_slice($parts,1));
        if(in_array('',$traits,true))
            throw new RuntimeException('FAMILY_OWNER_KNOWLEDGE_EMPTY');
        $bank[$n]=['суть'=>$traits[0],'ресурс'=>$traits[1],'тень'=>$traits[2]];
    }
    for($n=1;$n<=22;$n++)if(!isset($bank[$n]))
        throw new RuntimeException('FAMILY_OWNER_KNOWLEDGE_MISSING');
    return $bank;
}
function foBrief(string $id,int $day,int $month,int $year): array {
    if(!isset(foMap()[$id])||!checkdate($month,$day,$year))
        throw new InvalidArgumentException('INVALID_FAMILY_PREVIEW_INPUT');
    $matrix=ni31($day,$month,$year);
    $knowledge=foKnowledge();
    $roles=[
      'left'=>'ВЕДУЩАЯ энергия дня: основной характер поведения',
      'top'=>'Энергия месяца: привычные потребности и мотивы',
      'right'=>'Стиль действий и решений',
      'bottom'=>'Ответственность и взрослость',
      'center'=>'Повседневная реакция',
      'topLeft'=>'Как соединяются мотивы и потребности',
      'bottomLeft'=>'Эмоциональные привычки',
      'loveHeart'=>'Отношение к близкому союзу',
      'tailFirst'=>'Повторяющийся сценарий',
      'tailSecond'=>'Способ преодолеть старую привычку',
      'wellbeing'=>'Домашний ритм и устойчивость',
      'rightNear'=>'Доведение решений до реальных действий',
      'bottomRight'=>'Поведение в трудной практической ситуации',
      'moneyPoint'=>'Устойчивость материальных обязательств'
    ];
    $five=[];
    foreach(foMap()[$id] as $key){
        $n=$matrix[$key]??null;
        if(!is_int($n)||!isset($knowledge[$n],$roles[$key]))
            throw new RuntimeException('FAMILY_OWNER_POINT_MISSING');
        $five[]=['роль'=>$roles[$key]]+$knowledge[$n];
    }
    if(count($five)!==5||$matrix['left']!==ni22($day)||$matrix['top']!==$month)
        throw new RuntimeException('FAMILY_OWNER_FIVE_POINTS_INVALID');
    return $five;
}
function foPrompt(): string {
    return <<<'PROMPT'
Ты опытный нумеролог «Матрицы судьбы» (22 энергии). Отвечай женщине только на заданный вопрос о мужчине в разделе «Семья и быт». Тебе переданы пять РАЗНЫХ ПО РОЛИ позиций матрицы, вычисленных по полной дате рождения.

День рождения задаёт ведущую тенденцию, месяц раскрывает привычные потребности и мотивы. Три остальные позиции уточняют проявление в конкретном вопросе и могут существенно менять вывод. Используй краткие авторские тезисы всех переданных энергий, но НЕ копируй их формулировки в ответ. Не домысливай характеристики по названиям арканов и не превращай абстрактные качества в готовые бытовые роли.

ОБЯЗАТЕЛЬНО включи в нумерологический синтез все остальные четыре позиции, включая месяц и три дополнительные точки. Каждая должна влиять на поведение или итог, а не быть только декорацией. Дополнительные влияния могут смягчать, усиливать, противоречить ведущей и существенно изменять внешнее проявление мужчины. Сопоставь их именно по РОЛИ точки; если аркан повторяется, он не становится автоматически доказательством качества. Никаких механических долей, процентов, подсчёта плюсов и минусов. Главное не сводить всё к одной энергии и не подменять смысл благозвучным портретом.

С ПЕРВОЙ ФРАЗЫ прямо ответь на заданный вопрос. Затем раскрой 2–3 очень узнаваемых конкретных поступка и необычное противоречие сочетания. Не делай вывод об одном конкретном качестве лишь из общих черт человека. Проверяй именно то, о чём спрашивают, и различай намерение и реальное участие. Не сочиняй доказанные эпизоды из жизни конкретного человека. Пиши как очень умная, меткая и дерзкая подруга после маленького расследования: естественная разговорная речь, уместная ирония, смелость, юмор из реального смысла, никакой сухой методички, театрального выступления, мата и нравоучений. Не делай мужчину хорошим или плохим искусственно.

Пиши с эффектом остроумного разоблачения. Будто две близкие подруги обсуждают мужчину и одна вдруг замечает то, что другая раньше не видела. Подмечай смешные противоречия между тем, каким он хочет казаться, и тем, как может вести себя в обычной жизни. Юмор должен рождаться из точного наблюдения, а не из специально придуманных шуток. Используй простые, живые, современные слова. Читательнице должно быть интересно, немного смешно и очень понятно, о каком поведении идёт речь. Не завуалируй неприятные выводы красивыми формулировками. Не приписывай противоречие только ради шутки, если его нет в переданных значениях.

ЖЁСТКИЙ ФОРМАТ: ровно два абзаца. ПЕРВЫЙ: 650–850 знаков, 4–6 коротких предложений. С первой фразы прямо ответь на вопрос, затем 2–3 конкретные бытовые реакции, одно точное остроумное наблюдение. Не повторяй одну мысль разными красивыми словами. ВТОРОЙ: примерно 600–700 знаков, 5–7 живых коротких предложений. Дай ещё один неожиданный ракурс или тонкое противоречие из тех же рассчитанных характеристик, чтобы возникло любопытство к следующему вопросу. Не повторяй первый абзац и НЕ отвечай на следующий вопрос, а подведи к одному точному названию из списка. Вместе приблизительно 1250–1550 знаков. Пиши простыми, ясными, живыми словами, как меткая подруга, которая с улыбкой раскусила привычку мужчины. Без витиеватых метафор, эпитетов ради эпитетов, канцелярита и бесконечных объяснений. НИКАКИХ длинных тире (—, –, ―): вместо них используй запятую, точку или двоеточие. Не раскрывай числа, арканы, энергии, дату рождения, расчёты и позиции. Никаких заголовков, списка и Markdown.
PROMPT;
}
/**
 * Only the editor's FAMILY preview is formatted here. It never writes JSON,
 * does not call Gemini again, and never changes the numerology calculation.
 */
function foShortenCompleteSentences(string $paragraph,int $max): string {
    $clean=trim(preg_replace('/\s+/u',' ',$paragraph)??$paragraph);
    if(mb_strlen($clean,'UTF-8')<=$max)return $clean;
    $parts=preg_split('/(?<=[.!?…])\s+/u',$clean,-1,PREG_SPLIT_NO_EMPTY);
    $result='';
    foreach(is_array($parts)?$parts:[] as $part){
        $candidate=$result===''?$part:$result.' '.$part;
        if(mb_strlen($candidate,'UTF-8')>$max)break;
        $result=$candidate;
    }
    if(mb_strlen($result,'UTF-8')>=(int)($max*0.55))return $result;
    // Very long single sentences: stop on a word boundary, not inside a word.
    $slice=mb_substr($clean,0,$max-1,'UTF-8');
    $space=mb_strrpos($slice,' ',0,'UTF-8');
    if($space!==false&&$space>(int)($max*0.60))
        $slice=mb_substr($slice,0,$space,'UTF-8');
    return rtrim($slice," ,;:-\t\n").'.';
}
function foShortenTeaser(string $paragraph,array $next): string {
    $clean=trim(preg_replace('/\s+/u',' ',$paragraph)??$paragraph);
    if(mb_strlen($clean,'UTF-8')<=700)return $clean;
    // Prefer the exact next-question title already chosen by Gemini.
    $question=null;
    foreach($next as $title)
        if(is_string($title)&&mb_stripos($clean,$title,0,'UTF-8')!==false)
            $question=$title;
    if($question===null){
        // Keep a natural question from the end if possible.
        if(preg_match('/([^.!?]{15,125}\?)\s*$/u',$clean,$m))
            $question=trim($m[1]);
        else $question=(string)$next[0];
    }
    // Keep the original conclusion and exact follow-up question instead of
    // collapsing an overlong second paragraph into a generic one-line teaser.
    $lead=$clean;
    $questionPos=mb_stripos($lead,$question,0,'UTF-8');
    if($questionPos!==false)
        $lead=trim(mb_substr($lead,0,$questionPos,'UTF-8'));
    $bridge=' А вот какой вопрос теперь интереснее проверить: '.$question;
    $budget=700-mb_strlen($bridge,'UTF-8');
    if($budget<100)throw new RuntimeException('FAMILY_TEASER_TITLE_TOO_LONG');
    $opening=foShortenCompleteSentences($lead,$budget);
    return rtrim($opening).' '.$bridge;
}
function foFormatOwnerAnswer(string $answer,array $next): string {
    $answer=trim(str_replace(["\r\n","\r"],"\n",$answer));
    $paragraphs=preg_split('/\n\s*\n/u',$answer,-1,PREG_SPLIT_NO_EMPTY);
    if(!is_array($paragraphs)||count($paragraphs)!==2)
        throw new RuntimeException('FAMILY_PREVIEW_PARAGRAPHS_INVALID');
    $first=foShortenCompleteSentences($paragraphs[0],850);
    $second=foShortenTeaser($paragraphs[1],$next);
    $result=$first."\n\n".$second;
    // The original model sometimes ignores typography constraints.
    return str_replace(['—','–','―'],'-',$result);
}
try {
    if(!naTestOwner(naCurrent(naDB())))foReply(403,['ok'=>false,'error'=>'OWNER_ONLY']);
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST')
        foReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    if(!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
        foReply(403,['ok'=>false,'error'=>'ORIGIN_NOT_ALLOWED']);
    if((int)($_SERVER['CONTENT_LENGTH']??0)>4096)
        foReply(413,['ok'=>false,'error'=>'REQUEST_TOO_LARGE']);
    $input=json_decode((string)file_get_contents('php://input'),true,10,JSON_THROW_ON_ERROR);
    $id=$input['question_id']??null;
    $day=$input['day']??null;$month=$input['month']??null;$year=$input['year']??null;
    if(($input['category']??null)!=='family'||!is_string($id)||!isset(foMap()[$id])||
       !is_int($day)||!is_int($month)||!is_int($year)||$year<1900||
       $year>(int)gmdate('Y')||!checkdate($month,$day,$year))
        foReply(400,['ok'=>false,'error'=>'INVALID_FAMILY_REQUEST']);
    $catalog=json_decode((string)file_get_contents(__DIR__.'/catalog.json'),true,20,JSON_THROW_ON_ERROR);
    $question=$id==='independent'?['id'=>'independent','title'=>'Самостоятельный мужчина или мамина корзиночка?']:null;
    $next=[];
    foreach($catalog['categories'] as $section){
        foreach($section['questions'] as $q){
            if($section['id']==='family'&&$q['id']===$id)$question=$q;
            if($section['id']==='family'&&$q['id']!==$id)$next[]=$q['title'];
        }
    }
    if($question===null||count($next)<8)foReply(400,['ok'=>false,'error'=>'FAMILY_QUESTION_NOT_FOUND']);
    if(function_exists('set_time_limit'))@set_time_limit(125);
    // Owner-only test runs only when its button is pressed; no PHP session
    // lock or shared 15s cooldown should block other manually selected questions.
    $payload=json_encode([
        'вопрос'=>$question['title'],
        'точный_фокус'=>foFocus()[$id],
        'пять_обязательных_позиций_по_приоритету'=>foBrief($id,$day,$month,$year),
        'следующие_вопросы_на_выбор'=>$next
    ],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    $answer=niCloudCall([
        ['role'=>'system','content'=>foPrompt()],
        ['role'=>'user','content'=>$payload]
    ],2800,'google/gemini-3-flash-preview');
    $answer=foFormatOwnerAnswer($answer,$next);
    foReply(200,['ok'=>true,'owner'=>true,'draft_only'=>true,'published'=>false,
        'category'=>'family','question_id'=>$id,'date_key'=>$day.'-'.$month,
        'model'=>'google/gemini-3-flash-preview','answer'=>$answer]);
} catch(JsonException|InvalidArgumentException $e) {
    foReply(400,['ok'=>false,'error'=>'INVALID_FAMILY_REQUEST']);
} catch(Throwable $e) {
    error_log('FAMILY_OWNER_PREVIEW_FAIL '.(preg_match('/\A[A-Z][A-Z0-9_]{2,70}\z/',$e->getMessage())?$e->getMessage():'INTERNAL_ERROR'));
    foReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);
}
