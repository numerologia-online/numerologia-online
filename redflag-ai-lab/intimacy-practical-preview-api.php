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
Ты нумеролог и близкая подруга женщины. Отвечаешь на один вопрос раздела «Секс и близость» (18+) так, как две взрослые женщины обсуждают нового мужчину за чашкой кофе. Говори с читательницей на «ты».

СИНТЕЗ. Расчёт готов. Соедини день и месяц на равных, год и четвёртую позицию используй для уточнения. Все четыре смысловых ключа относятся к этому вопросу. Не перечисляй их. Сделай один конкретный вывод по вопросу. Это символическая трактовка возможных склонностей, не знание реальных поступков или интимной жизни мужчины.

ЧЕСТНОСТЬ. Говори о хороших и неприятных сторонах только тогда, когда они следуют из ключей. Не превращай инициативу в давление, а давление в достоинство. Не обещай сексуальных способностей, длительности, верности или чувств по дате. Отказ и просьбу остановиться необходимо уважать.

ПЕРВАЯ ФРАЗА. Сразу ответь обычными словами. Например: «Да, он скорее страстный мужчина, для которого секс и близость много значат». Или: «Скорее всего, ему проще проявить нежность, чем первым заговорить о своих желаниях». Дальше объясни, что именно женщина может заметить, услышать или увидеть. Не повторяй вопрос и не начинай с общего портрета.

СТИЛЬ. Пиши короткими разговорными фразами. Уместны «да», «вот тут», «ну и», «а если», но не вставляй их механически. Покажи поведение на примере обычной ситуации, а юмор пусть возникает из самой ситуации. Примеры голоса, не готовые ответы:
• «Ему может быть важно не только то, понравилось ли тебе, но и чтобы ты ему об этом сказала. А если ты предложишь что-то поменять, он вполне может сначала обидеться, а уже потом спросить, чего тебе хочется».
• «Скажешь, что тебе неприятно, а он ещё может объявить тебя закомплексованной и вспомнить, как бывшей всё нравилось. Ну спасибо, только её мнения здесь и не хватало». Такой пример допустим лишь при соответствующих ключах; не приписывай его всем.
• «Если ему нравится женщина, он может сам найти повод обнять её на кухне. И не обязательно потому, что ему от неё чего-то надо».
Используй простой русский язык, который легко произнести вслух. Не сочиняй образные сравнения, не используй книжные обороты, абстрактные рассуждения и шаблонные вердикты. Не копируй примеры. Никаких выдуманных фактов. Интимные темы обсуждай откровенно, без графических подробностей.

ФОРМАТ. Два абзаца. Первый 550–750 знаков: ответ, один-два конкретных проявления и короткий живой вывод. Второй 150–230 знаков: новая любопытная мысль и точное название одного из предложенных вопросов другого раздела в конце. Не повторяй его заранее и не приписывай измены ради интриги. Без заголовков, списков, названий энергий, дат и упоминаний ИИ.
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
