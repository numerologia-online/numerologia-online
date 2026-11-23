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

Ровно два абзаца, вместе ориентировочно 900–1100 знаков. Первый главный, второй короткая естественная интрига к одному точному следующему вопросу из списка, не отвечай на него. Не раскрывай числа, арканы, энергии, дату рождения, расчёты и позиции. Никаких заголовков, списка, Markdown и длинных тире.
PROMPT;
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
    $question=null;$next=[];
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
