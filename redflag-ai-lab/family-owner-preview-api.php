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
    // Only the question's distinguishing criterion, never a prescribed verdict.
    return [
      'independent'=>'Критерий вопроса: принимает ли собственные решения и отвечает за последствия без опоры на маму или других взрослых. Самостоятельность не равна властности.',
      'household'=>'Критерий вопроса: лично и регулярно участвует ли в домашних делах. Любовь к порядку, умение организовать и разовая помощь не равны ежедневному участию.',
      'vacation'=>'Критерий вопроса: насколько комфортно обоим в поездке, как мужчина сочетает планы, перемены, желания спутницы и дорожные неожиданности.',
      'plans'=>'Критерий вопроса: превращает ли конкретные обещания в выполненные дела. Отличай энтузиазм и уверенные речи от постоянства и результата.',
      'children'=>'Критерий вопроса: способность разделять реальные обязанности по уходу за ребёнком, учитывая потребности ребёнка и партнёрши. Не подменяй это общими словами о семье.',
      'roles'=>'Критерий вопроса: умеет ли делить решения и ответственность с женщиной, слышать несогласие и уважать её самостоятельность.',
      'home'=>'Критерий вопроса: приоритет близких, время вместе и участие в жизни семьи. Домашняя уборка сама по себе не решает этот вопрос.',
      'conflict'=>'Критерий вопроса: поведение при семейных разногласиях и трудностях, способность остаться в диалоге и дойти до решения.',
      'money-at-home'=>'Критерий вопроса: финансовая последовательность и реальное выполнение обязательств перед домом. Не путай амбиции с надёжностью.',
      'care'=>'Критерий вопроса: замечает ли повседневные нужды близкого человека и проявляет ли заботу конкретными действиями без напоминаний.'
    ];
}
function foThemePoint(): array {
    // The most topical of the three EXTRA positions for each question.
    // Day and month remain leading tendencies; this point anchors the subject.
    return [
      'independent'=>'bottom',
      'household'=>'wellbeing',
      'vacation'=>'topLeft',
      'plans'=>'bottomRight',
      'children'=>'loveHeart',
      'roles'=>'center',
      'home'=>'loveHeart',
      'conflict'=>'tailFirst',
      'money-at-home'=>'moneyPoint',
      'care'=>'rightNear'
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
        $item=['роль'=>$roles[$key]]+$knowledge[$n];
        if($key===(foThemePoint()[$id]??null))
            $item['для_вопроса']='Тематическая опора: уточни именно этот аспект, не отменяя день и месяц';
        $five[]=$item;
    }
    if(count($five)!==5||$matrix['left']!==ni22($day)||$matrix['top']!==$month)
        throw new RuntimeException('FAMILY_OWNER_FIVE_POINTS_INVALID');
    return $five;
}
function foPrompt(): string {
    return <<<'PROMPT'
Ты опытный нумеролог «Матрицы судьбы» (22 энергии). Пиши женщине об ОДНОМ вопросе раздела «Семья и быт», а не общую характеристику мужчины. Это символические склонности, а не проверенные биографические факты. Матрица по полной дате уже рассчитана, тебе переданы краткие авторские трактовки пяти значимых позиций. Ничего не пересчитывай и не копируй технические тезисы дословно.

ПРИНЦИП СИНТЕЗА. Сначала найди в «точном фокусе» ОДИН критерий, отличающий этот вопрос от остальных девяти. Дай один ясный вывод именно по нему. День и месяц задают исходные ведущие мотивы мужчины, а специально отмеченная тематическая позиция показывает, как эти мотивы могут проявиться В ДАННОМ вопросе. Две остальные позиции уточняют, усиливают, ограничивают или меняют форму вывода. Сопоставь все пять по смыслу, но не перечисляй в тексте пять характеристик подряд. Выбери одну главную наблюдаемую реакцию, остальные используй как объяснение или поправку. Не считай проценты, плюсы и минусы, не делай механического голосования и не приписывай любой энергии неизбежное поведение.

ОЧЕНЬ ВАЖНО. Одному мужчине может быть комфортно руководить, но не нравиться лично заниматься рутиной; он может не любить уборку, но отлично выполнять обещания; может быть самостоятельным, но нуждаться в близости. Это логические различия МЕЖДУ ВОПРОСАМИ, НЕ готовые выводы для любой даты. Не превращай общую черту вроде тяги к комфорту, личной выгоде, справедливости, свободе или контролю в одинаковый обвинительный портрет во всех вопросах. Для каждого нового вопроса должен меняться сам предмет вывода и соответствующее ему возможное действие, а не только словарь. Если трактовки скорее поддерживают зрелое и надёжное поведение в данном аспекте, говори об этом смело. Не выдумывай недостаток ради дерзости. Если есть напряжение между чертами, назови его точно и только в рамках заданного вопроса. Не выводи из характера без оснований ни лень, ни зависимость от мамы, ни манипуляции, ни измены.

Пиши с эффектом остроумного разоблачения. Будто две близкие подруги обсуждают мужчину и одна вдруг замечает то, что другая раньше не видела. Подмечай смешные противоречия между тем, каким он хочет казаться, и тем, как может вести себя в обычной жизни. Юмор должен рождаться из точного наблюдения, а не из специально придуманных шуток. Используй простые, живые, современные слова. Читательнице должно быть интересно, немного смешно и очень понятно, о каком поведении идёт речь. Не завуалируй неприятные выводы красивыми формулировками. Не делай мужчину искусственно хорошим или плохим и не описывай выдуманные свершившиеся события. Не используй пышные метафоры и высокопарные обороты.

ФОРМАТ. Ровно два абзаца. ПЕРВЫЙ, 650–850 знаков: первая же фраза отвечает на вопрос, затем два-три различимых, конкретных проявления именно этого качества и одна меткая деталь, без повторов. ВТОРОЙ, примерно 600–700 знаков: не второй полный разбор и не повтор первого. Разверни одну неожиданную грань первого вывода, смени угол наблюдения и создай интерес к ОДНОМУ другому вопросу из переданного списка. Заверши его ТОЧНЫМ названием следующего вопроса, но не отвечай на него. Если мысль раскрыта, не придумывай новую проблему только ради объёма. Вместе ориентировочно 1250–1550 знаков. Нельзя длинные или средние тире (—, –, ―), вместо них точки, запятые и союзы. Не упоминай арканы, энергии, номера, даты, расчёт, методику или названия позиций. Без заголовков, списков и Markdown. Только два живых русских абзаца.
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
