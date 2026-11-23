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
function foArcanaNames(): array {
    return [
      1=>'Маг',2=>'Жрица',3=>'Императрица',4=>'Император',5=>'Иерофант',
      6=>'Влюблённые',7=>'Колесница',8=>'Справедливость',9=>'Отшельник',
      10=>'Колесо Фортуны',11=>'Сила',12=>'Повешенный',13=>'Смерть',
      14=>'Умеренность',15=>'Дьявол',16=>'Башня',17=>'Звезда',18=>'Луна',
      19=>'Солнце',20=>'Суд',21=>'Мир',22=>'Шут'
    ];
}
function foBrief(string $id,int $day,int $month,int $year): array {
    if(!isset(foMap()[$id])||!checkdate($month,$day,$year))
        throw new InvalidArgumentException('INVALID_FAMILY_PREVIEW_INPUT');
    $matrix=ni31($day,$month,$year);
    $names=foArcanaNames();
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
        if(!is_int($n)||!isset($names[$n],$roles[$key]))
            throw new RuntimeException('FAMILY_OWNER_POINT_MISSING');
        $five[]=['роль'=>$roles[$key],'энергия'=>$n,'аркан'=>$names[$n]];
    }
    if(count($five)!==5||$five[0]['энергия']!==ni22($day)||$five[1]['энергия']!==$month)
        throw new RuntimeException('FAMILY_OWNER_FIVE_POINTS_INVALID');
    return $five;
}
function foPrompt(): string {
    return <<<'PROMPT'
Ты опытный нумеролог «Матрицы судьбы» (22 энергии). Отвечай женщине только на заданный вопрос о мужчине в разделе «Семья и быт». Тебе переданы пять РАЗНЫХ ПО РОЛИ позиций матрицы, вычисленных по полной дате рождения.

ВЕДУЩАЯ позиция всегда первая, энергия дня рождения. Если день 15, это Дьявол, сильные желания, удовольствие и личная выгода, в тени манипуляции и перекладывание неприятных дел. НЕ превращай 15 в прилежного бытового организатора только потому, что другая точка указывает на силу, инициативу или способность решать проблемы. Если день 4, это Император, практичный и предусмотрительный, организует, рассчитывает заранее, в тени может командовать, придираться и больше учить, чем делать. Если встречается 7, это Колесница, свобода, движение, нетерпение к скучной повторяющейся рутине, хотя может активно решить отдельную срочную задачу.

ОБЯЗАТЕЛЬНО включи в нумерологический синтез все остальные четыре позиции, включая месяц и три дополнительные точки. Каждая должна влиять на поведение или итог, а не быть только декорацией. Дополнительные влияния могут смягчать, усиливать, противоречить ведущей и существенно изменять внешнее проявление мужчины. Сопоставь их именно по РОЛИ точки; если аркан повторяется, он не становится автоматически доказательством качества. Никаких механических долей, процентов, подсчёта плюсов и минусов. Главное не сводить всё к одной энергии и не подменять смысл благозвучным портретом.

С ПЕРВОЙ ФРАЗЫ прямо ответь на заданный вопрос. Затем раскрой 2–3 очень узнаваемых конкретных поступка и необычное противоречие сочетания. НЕ выдавай автоматически любую инициативность, силу, амбиции или любовь к комфорту за бытовую самостоятельность. Не сочиняй доказанные эпизоды из жизни конкретного человека. Пиши как очень умная, меткая и дерзкая подруга после маленького расследования: естественная разговорная речь, уместная ирония, смелость, юмор из реального смысла, никакой сухой методички, театрального выступления, мата и нравоучений. Не делай мужчину хорошим или плохим искусственно.

Пиши с эффектом остроумного разоблачения. Будто две близкие подруги обсуждают мужчину и одна вдруг замечает то, что другая раньше не видела. Подмечай смешные противоречия между тем, каким он хочет казаться, и тем, как может вести себя в обычной жизни. Юмор должен рождаться из точного наблюдения, а не из специально придуманных шуток. Используй простые, живые, современные слова. Читательнице должно быть интересно, немного смешно и очень понятно, о каком поведении идёт речь. Не завуалируй неприятные выводы красивыми формулировками. Не приписывай противоречие только ради шутки, если его нет в переданных значениях.

ЖЁСТКИЙ ФОРМАТ: ровно два абзаца. ПЕРВЫЙ: 650–850 знаков, 4–6 коротких предложений. С первой фразы прямо ответь на вопрос, затем 2–3 конкретные бытовые реакции, одно точное остроумное наблюдение. Не повторяй одну мысль разными красивыми словами. ВТОРОЙ: 180–300 знаков, два-три коротких предложения. Это НЕ второй разбор и НЕ новый психологический портрет. Только любопытная подводка к одному другому вопросу из списка с его точным названием, без ответа на него. Вместе приблизительно 850–1150 знаков. Пиши простыми, ясными, живыми словами, как меткая подруга, которая с улыбкой раскусила привычку мужчины. Без витиеватых метафор, эпитетов ради эпитетов, канцелярита и бесконечных объяснений. НИКАКИХ длинных тире (—, –, ―): вместо них используй запятую, точку или двоеточие. Не раскрывай числа, арканы, энергии, дату рождения, расчёты и позиции. Никаких заголовков, списка и Markdown.
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
    if(mb_strlen($clean,'UTF-8')<=300)return $clean;
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
    $sentences=preg_split('/(?<=[.!?…])\s+/u',$clean,-1,PREG_SPLIT_NO_EMPTY);
    $opening=is_array($sentences)?trim($sentences[0]??''):'';
    if($opening!=='' && mb_strlen($opening,'UTF-8')<=125 &&
       !str_contains($opening,'?') &&
       mb_strlen($opening.' '.$question,'UTF-8')<=300)
        return $opening.' '.$question;
    return 'А вот что ещё стоит проверить: '.$question;
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
    session_name('numi_family_owner_preview');
    session_set_cookie_params(['secure'=>true,'httponly'=>true,'samesite'=>'Strict','path'=>'/redflag-ai-lab/']);
    if(!session_start())throw new RuntimeException('FAMILY_PREVIEW_SESSION_UNAVAILABLE');
    if(time()-(int)($_SESSION['last_generation']??0)<15)
        foReply(429,['ok'=>false,'error'=>'WAIT_15_SECONDS']);
    $_SESSION['last_generation']=time();
    $payload=json_encode([
        'вопрос'=>$question['title'],
        'точный_фокус'=>foFocus()[$id],
        'пять_обязательных_позиций_по_приоритету'=>foBrief($id,$day,$month,$year),
        'следующие_вопросы_на_выбор'=>$next
    ],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    try {
        $answer=niCloudCall([
            ['role'=>'system','content'=>foPrompt()],
            ['role'=>'user','content'=>$payload]
        ],2800,'google/gemini-3-flash-preview');
        $answer=foFormatOwnerAnswer($answer,$next);
    }catch(Throwable $e){
        unset($_SESSION['last_generation']);
        throw $e;
    }finally{if(session_status()===PHP_SESSION_ACTIVE)session_write_close();}
    foReply(200,['ok'=>true,'owner'=>true,'draft_only'=>true,'published'=>false,
        'category'=>'family','question_id'=>$id,'date_key'=>$day.'-'.$month,
        'model'=>'google/gemini-3-flash-preview','answer'=>$answer]);
} catch(JsonException|InvalidArgumentException $e) {
    foReply(400,['ok'=>false,'error'=>'INVALID_FAMILY_REQUEST']);
} catch(Throwable $e) {
    if(session_status()===PHP_SESSION_ACTIVE){unset($_SESSION['last_generation']);session_write_close();}
    error_log('FAMILY_OWNER_PREVIEW_FAIL '.(preg_match('/\A[A-Z][A-Z0-9_]{2,70}\z/',$e->getMessage())?$e->getMessage():'INTERNAL_ERROR'));
    foReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);
}
