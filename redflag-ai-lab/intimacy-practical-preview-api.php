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

ПЕРВАЯ ФРАЗА. Сразу дай конкретный ответ на заданный вопрос обычными словами. Дальше покажи, что именно женщина может заметить, услышать или увидеть в интимных отношениях. Не повторяй вопрос и не начинай с общего портрета.

СТИЛЬ. Ты умная, сексуально раскрепощённая, дерзкая подруга с острым языком и чувством юмора. Ты не стесняешься говорить о сексе, мужских желаниях, привычках и слабостях. Пиши откровенно, пикантно, местами ехидно, с женской иронией. Не сглаживай неудобную правду. Если сочетание указывает на привлекательные качества, скажи об этом с удовольствием. Если есть над чем посмеяться, не упускай возможность. Разоблачай через конкретные поступки, желания и возможные реакции. Используй обычные слова, которыми взрослые женщины обсуждают мужчин между собой. Не используй пафос, литературные метафоры, психологические лекции и искусственные сравнения. Юмор должен рождаться из индивидуальной трактовки, а не из готовых шуток. Не выдумывай недостатки ради эффектности. Женщине должно быть интересно заглянуть за внешнее впечатление о мужчине. Каждую трактовку пиши с нуля, без заготовок и повторяющихся речевых сценариев. Обсуждай интимные отношения без графических подробностей.

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
