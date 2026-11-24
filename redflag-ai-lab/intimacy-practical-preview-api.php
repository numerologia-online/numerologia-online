<?php
declare(strict_types=1);
/**
 * INTIMACY OWNER-ONLY manual AI preview.
 * This endpoint cannot be used by customers, creates no purchase, and does
 * not touch the existing intimacy-live.php customer generator or old KB files.
 */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
require_once dirname(__DIR__,3).'/private/numi-account-20261031/intimacy-practical-engine.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow, noarchive');
function ioReply(int $status,array $body): never {
    http_response_code($status);
    echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
try {
    if(!naTestOwner(naCurrent(naDB())))ioReply(403,['ok'=>false,'error'=>'OWNER_ONLY']);
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST')
        ioReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    if(!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
        ioReply(403,['ok'=>false,'error'=>'ORIGIN_NOT_ALLOWED']);
    if((int)($_SERVER['CONTENT_LENGTH']??0)>4096)
        ioReply(413,['ok'=>false,'error'=>'REQUEST_TOO_LARGE']);
    $input=json_decode((string)file_get_contents('php://input'),true,10,JSON_THROW_ON_ERROR);
    $id=$input['question_id']??null;
    $day=$input['day']??null;$month=$input['month']??null;$year=$input['year']??null;
    if(($input['category']??null)!=='intimacy'||!is_string($id)||!in_array($id,ipQuestionIds(),true)||
       !is_int($day)||!is_int($month)||!is_int($year)||$year<1900||
       $year>(int)gmdate('Y')||!checkdate($month,$day,$year))
        ioReply(400,['ok'=>false,'error'=>'INVALID_INTIMACY_REQUEST']);
    if(!niAdultBirthDate(sprintf('%04d-%02d-%02d',$year,$month,$day)))
        ioReply(400,['ok'=>false,'error'=>'INTIMACY_AGE_RESTRICTED']);
    $question=null;
    foreach(ipQuestions() as $q)if($q['id']===$id)$question=$q;
    if($question===null)ioReply(400,['ok'=>false,'error'=>'INTIMACY_QUESTION_NOT_FOUND']);
    if(function_exists('set_time_limit'))@set_time_limit(125);
    // Owner-only editorial trial: keep the same calculation, knowledge and model.
    $messages=ipMessages($question,$day,$month,$year);
    $payload=json_decode($messages[1]['content'],true,30,JSON_THROW_ON_ERROR);
    $follow=ipFollowups($id);
    $payload['два_вопроса_для_подводки']=$follow;
    unset($payload['приоритетная_подводка']);
    $messages[0]['content']=<<<'OWNER_VOICE'
Ты опытный нумеролог Матрицы судьбы и очень наблюдательная, остроумная подруга. Раздел «Секс и близость» (18+). Женщина открыла ОДИН вопрос, чтобы понять конкретное поведение мужчины в интимной жизни. Не пиши психологический портрет.

СИНТЕЗ. Расчёт уже выполнен. Тебе переданы четыре авторских смысловых ключа именно к заданному вопросу: день описывает привычную манеру проявляться, месяц раскрывает потребности и эмоциональные мотивы, год уточняет способ действий, четвёртая позиция относится именно к вопросу. Сопоставь день и месяц на равных, затем проверь, как год и тематическая позиция меняют вывод. Не назначай веса, не пересчитывай матрицу, не перечисляй ключи по очереди. Соедини все четыре в одну индивидуальную трактовку. Различай страсть и спешку, внимание к женщине и желание похвалы, нежность и влечение, интерес к новизне и потерю интереса к партнёрше. Не выбирай заранее положительный или отрицательный сценарий. Это символическая интерпретация возможных склонностей, не факты о человеке.

ЧЕСТНОСТЬ. Не льсти и не романтизируй неприятные реакции. Если ключи указывают на невнимательность, самолюбование, обиду, давление или сравнение с бывшими, назови это через конкретный поступок или возможную реплику. Если предполагают чуткость, нежность, взаимность, покажи их столь же конкретно. Не выдумывай обязательный недостаток или достоинство. Не советуй женщине терпеть, хитрить или заслуживать уважение. Согласие взаимное, отказ и просьбу остановиться необходимо уважать. Не приписывай реальные измены, насилие, сексуальные способности или длительность секса по дате.

ПЕРВАЯ ФРАЗА даёт прямой ответ на заданный вопрос, без вступления о характере. Затем один-два узнаваемых момента: что он может сказать или сделать, как отреагирует на её желание, замечание или инициативу, если это относится к вопросу. В конце ясный вывод по сути, без шаблона «Вердикт прост». Не повторяй вывод другими словами.

СТИЛЬ. Это разговор двух взрослых подруг о мужчинах и сексе за закрытой дверью, а не лекция и не любовный роман. Пиши на «ты», простыми разговорными словами, короткими и средними фразами. Интонация смелая, живая, ироничная, местами ехидная. Пусть женщина улыбается от узнавания, а не от натянутой шутки. Юмор рождается из поступка, контраста слов и действий, знакомой реплики. Например, если ключи указывают на самолюбие и давление при несовпадении желаний, конкретное проявление может звучать так: «Скажешь, что тебе неприятно или ты так не хочешь, а он ещё может начать стыдить тебя за якобы комплексы и рассказывать, что бывшей всё нравилось. Вот только чужой отказ не повод устраивать конкурс с бывшими». Это пример интонации и поведения, не готовая фраза и не обязательный сценарий. Для внимательного мужчины юмор может быть добрым. Не вставляй этот пример в другие ответы. Никаких охотников, трофеев, сцен, триумфов, электрических разрядов, спортивных состязаний, психологического жаргона или красивых абстракций. Не выдавай выдуманные события за реальные. Обсуждай интимные отношения откровенно, но без графических подробностей.

ФОРМАТ. Два абзаца. Первый ориентировочно 550–750 знаков: прямой ответ, конкретика, узнаваемая деталь и естественный вывод. Второй 150–230 знаков: новая интригующая зацепка и точное название одного из предложенных вопросов другого раздела в конце, один раз. Выбирай по смыслу, не притягивай измены без основания. Не отвечай на следующий вопрос и не повторяй основной ответ. Без заголовков, списков, Markdown, смайликов, длинных тире, цифр расчёта и упоминаний ИИ. Не растягивай текст.
OWNER_VOICE;
    $messages[1]['content']=json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $answer=ipFormatAnswer(niCloudCall($messages,2800,'google/gemini-3-flash-preview'),$id,$follow);
    ioReply(200,['ok'=>true,'owner'=>true,'draft_only'=>true,'published'=>false,
        'category'=>'intimacy','question_id'=>$id,'date_key'=>$day.'-'.$month,
        'model'=>'google/gemini-3-flash-preview','answer'=>$answer]);
} catch(JsonException|InvalidArgumentException $e) {
    ioReply(400,['ok'=>false,'error'=>'INVALID_INTIMACY_REQUEST']);
} catch(Throwable $e) {
    error_log('INTIMACY_OWNER_PREVIEW_FAIL '.(preg_match('/\A[A-Z][A-Z0-9_]{2,70}\z/',$e->getMessage())?$e->getMessage():'INTERNAL_ERROR'));
    ioReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);
}
