<?php
declare(strict_types=1);
/* Direct REG.RU -> Cloud.ru model integration for owner review in Red Flag.
 * Owner-only, never sells content, never publishes, one provider request per click.
 */
require dirname(__DIR__, 3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
function cloudReply(int $http, array $body): never {
    http_response_code($http);
    echo json_encode($body, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
try {
    $account=naCurrent(naDB());
    if (!naTestOwner($account)) cloudReply(403,['ok'=>false,'error'=>'OWNER_ONLY']);
    if (($_SERVER['REQUEST_METHOD']??'GET')==='GET')
        cloudReply(200,['ok'=>true,'owner'=>true,'provider'=>'cloud.ru','live_answers_enabled'=>false]);
    if (($_SERVER['REQUEST_METHOD']??'')!=='POST')
        cloudReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    $origin=(string)($_SERVER['HTTP_ORIGIN']??'');
    if ($origin!=='' && !in_array($origin,naAllowedOrigins(),true))
        cloudReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
    $contentType=(string)($_SERVER['CONTENT_TYPE']??'');
    if (stripos($contentType,'application/json')!==0)
        cloudReply(415,['ok'=>false,'error'=>'JSON_REQUIRED']);
    $raw=file_get_contents('php://input',false,null,0,5000);
    if (!is_string($raw)||strlen($raw)>4000)
        cloudReply(413,['ok'=>false,'error'=>'REQUEST_TOO_LARGE']);
    $input=json_decode($raw,true,8,JSON_THROW_ON_ERROR);
    if (!is_array($input)||($input['category']??null)!=='flags')
        cloudReply(400,['ok'=>false,'error'=>'INVALID_CATEGORY']);
    $id=$input['question_id']??null;
    $day=$input['day']??null;
    $month=$input['month']??null;
    if (!is_string($id)||!preg_match('/^[a-z][a-z0-9-]{1,60}$/D',$id)
        || !is_int($day)||!is_int($month)||!checkdate($month,$day,2000))
        cloudReply(400,['ok'=>false,'error'=>'INVALID_SELECTION']);
    // Trusted catalogue prevents arbitrary user text from becoming a prompt.
    $catalog=json_decode((string)file_get_contents(dirname(__DIR__).'/redflag-ai-lab/catalog.json'),true,20,JSON_THROW_ON_ERROR);
    $title=null;
    $followups=[];
    foreach (($catalog['categories']??[]) as $category) {
        if (($category['id']??null)!=='flags')continue;
        foreach (($category['questions']??[]) as $q) {
            if (!is_string($q['id']??null)||!is_string($q['title']??null))continue;
            if ($q['id']===$id)$title=$q['title'];
            else $followups[]=$q['title'];
        }
    }
    if ($title===null)cloudReply(404,['ok'=>false,'error'=>'QUESTION_NOT_FOUND']);
    $cfgPath=dirname(__DIR__,3).'/private/numi-cloudru/config.local.php';
    if (!is_file($cfgPath)) cloudReply(503,['ok'=>false,'error'=>'CLOUDRU_KEY_NOT_CONFIGURED']);
    $cfg=require $cfgPath;
    $key=is_array($cfg)?trim((string)($cfg['cloudru_api_key']??'')):'';
    if (strlen($key)<16) cloudReply(503,['ok'=>false,'error'=>'CLOUDRU_KEY_NOT_CONFIGURED']);
    if (!function_exists('curl_init'))cloudReply(503,['ok'=>false,'error'=>'CURL_UNAVAILABLE']);
    // Server-side throttle protects the linked payment card from rapid repeat taps.
    $lockPath=dirname(__DIR__,3).'/private/numi-cloudru/last-redflag-request.txt';
    $lock=@fopen($lockPath,'c+');
    if ($lock===false)cloudReply(503,['ok'=>false,'error'=>'THROTTLE_UNAVAILABLE']);
    if (!flock($lock,LOCK_EX)) { fclose($lock);cloudReply(503,['ok'=>false,'error'=>'THROTTLE_UNAVAILABLE']); }
    $prev=(int)trim((string)stream_get_contents($lock));
    if (time()-$prev<15) {
        flock($lock,LOCK_UN);fclose($lock);
        cloudReply(429,['ok'=>false,'error'=>'PLEASE_WAIT_15_SECONDS']);
    }
    ftruncate($lock,0);rewind($lock);fwrite($lock,(string)time());fflush($lock);
    flock($lock,LOCK_UN);fclose($lock);
    $system='Ты женщина-нумеролог, которая объясняет женщине возможные теневые стороны мужчины по дню и месяцу рождения. '
        .'Это символическая нумерологическая трактовка, а не факты о мужчине. '
        .'Отвечай конкретно на заданный вопрос, учитывай и день, и месяц. '
        .'Первый абзац — содержательный и живой ответ, узнаваемая бытовая ситуация, без странных придуманных событий и выдуманных доказанных поступков. '
        .'Второй абзац — полезная новая грань и один естественный переход к одному связанному вопросу из списка, с дословным названием в кавычках «». '
        .'Ориентир всего текста 900–1300 символов, ровно два абзаца. '
        .'Пиши естественно, по-русски, как опытный нумеролог и подруга. '
        .'Не упоминай цифры, энергии, арканы, метод расчёта. Не утешай автоматически, не смягчай возможные тревожные признаки. '
        .'Без двоеточий, длинных тире, шаблонных фраз и рекламной лести.';
    $user="Вопрос женщины: ".$title."\nДень рождения мужчины: ".$day."\nМесяц рождения мужчины: ".$month
        ."\nДоступные следующие вопросы: ".implode(' | ',$followups)."\nНапиши только два абзаца ответа.";
    $payload=json_encode([
        'model'=>'openai/gpt-oss-120b',
        'messages'=>[['role'=>'system','content'=>$system],['role'=>'user','content'=>$user]],
        'max_tokens'=>1500,
        'temperature'=>0.8,
        'stream'=>false
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $ch=curl_init('https://foundation-models.api.cloud.ru/v1/chat/completions');
    curl_setopt_array($ch,[
        CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$payload,
        CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_CONNECTTIMEOUT=>12,CURLOPT_TIMEOUT=>75,
        CURLOPT_HTTPHEADER=>[
            'Authorization: Api-Key '.$key,
            'Content-Type: application/json',
            'Accept: application/json',
            'User-Agent: NumiRedFlagDirectCloudRu/1.0'
        ]
    ]);
    $providerBody=curl_exec($ch);
    $status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
    $curlErr=curl_errno($ch);
    curl_close($ch);
    if ($curlErr||!is_string($providerBody)) {
        error_log('REDFLAG_CLOUDRU_NET:'.(int)$curlErr);
        cloudReply(503,['ok'=>false,'error'=>'CLOUDRU_CONNECTION_FAILED']);
    }
    if ($status!==200) {
        error_log('REDFLAG_CLOUDRU_HTTP:'.$status);
        cloudReply(503,['ok'=>false,'error'=>'CLOUDRU_HTTP_'.$status]);
    }
    $result=json_decode($providerBody,true);
    $answer=is_array($result)?($result['choices'][0]['message']['content']??null):null;
    if (!is_string($answer)||mb_strlen(trim($answer))<100)
        cloudReply(503,['ok'=>false,'error'=>'CLOUDRU_EMPTY_ANSWER']);
    cloudReply(200,[
        'ok'=>true,'answer'=>trim($answer),'isDraft'=>true,
        'draft_only'=>true,'published'=>false,'provider'=>'cloud.ru',
        'question_id'=>$id,'date_key'=>$day.'-'.$month
    ]);
} catch(Throwable $exception) {
    error_log('REDFLAG_CLOUDRU_ERROR:'.get_class($exception));
    cloudReply(503,['ok'=>false,'error'=>'CLOUDRU_TEMPORARILY_UNAVAILABLE']);
}
