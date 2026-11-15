<?php
declare(strict_types=1);
/* Owner-only demo for 300 Moment questions. No wallet, orders, other reports. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private, max-age=0');
function omReply(int $status,array $data): never {
    http_response_code($status);
    echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
function omDate(mixed $value): bool {
    if(!is_string($value)||!preg_match('/^(19|20)\d\d-\d\d-\d\d$/D',$value))return false;
    $date=DateTimeImmutable::createFromFormat('!Y-m-d',$value);
    return $date instanceof DateTimeImmutable&&$date->format('Y-m-d')===$value;
}
try{
    $db=naDB();$account=naCurrent($db);
    if(!naTestOwner($account))omReply(403,['ok'=>false,'error'=>'OWNER_LOGIN_REQUIRED']);
    $catalog=json_decode((string)file_get_contents(__DIR__.'/questions.json'),true,20,JSON_THROW_ON_ERROR);
    if(!isset($catalog['questions'])||count($catalog['questions'])!==300)omReply(503,['ok'=>false,'error'=>'CATALOG_NOT_READY']);
    if($_SERVER['REQUEST_METHOD']==='GET')omReply(200,['ok'=>true,'owner'=>true,'question_count'=>300,'mode'=>'test_only']);
    if($_SERVER['REQUEST_METHOD']!=='POST')omReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    if(!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
        omReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
    $raw=file_get_contents('php://input',false,null,0,2049);
    if(!is_string($raw)||strlen($raw)>2048)omReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $body=json_decode($raw,true,12,JSON_THROW_ON_ERROR);
    if(!is_array($body))omReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $id=$body['question_id']??null;
    if(!is_string($id)||!preg_match('/^[a-z]+-\d{3}$/D',$id))omReply(400,['ok'=>false,'error'=>'INVALID_QUESTION']);
    $q=null;foreach($catalog['questions'] as $item)if(($item['id']??null)===$id){$q=$item;break;}
    if(!$q)omReply(400,['ok'=>false,'error'=>'UNKNOWN_QUESTION']);
    $birth=$body['birth_date']??null;$other=$body['other_date']??null;
    if(!omDate($birth))omReply(400,['ok'=>false,'error'=>'BIRTH_DATE_REQUIRED']);
    if($q['mode']==='partner'&&!omDate($other))omReply(400,['ok'=>false,'error'=>'OTHER_DATE_REQUIRED']);
    if($other!==null&&$other!==''&&!omDate($other))omReply(400,['ok'=>false,'error'=>'INVALID_OTHER_DATE']);
    $moment=$body['moment']??null;
    if($moment!==null&&$moment!==''&&(!is_string($moment)||!preg_match('/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d$/D',$moment)))
        omReply(400,['ok'=>false,'error'=>'INVALID_MOMENT']);
    $configPath=dirname(__DIR__,3).'/private/numi-moment-groq/config.local.php';
    if(!is_file($configPath))omReply(503,['ok'=>false,'error'=>'GROQ_CONFIG_NOT_READY']);
    $config=require $configPath;$key=is_array($config)?($config['groq_api_key']??null):null;
    if(!is_string($key)||!str_starts_with($key,'gsk_'))omReply(503,['ok'=>false,'error'=>'GROQ_CONFIG_NOT_READY']);
    $energy=function(string $s): string {
        $parts=explode('-',$s);$day=(int)$parts[2];$month=(int)$parts[1];
        while($day>22)$day=array_sum(array_map('intval',str_split((string)$day)));
        return 'день '.$day.', месяц '.$month;
    };
    $data="Вопрос: ".$q['title']."; ID: ".$id."\nСпрашивающий: ".$birth." (".$energy($birth).").";
    if(is_string($other)&&$other!=='')$data.="\nВторой человек: ".$other." (".$energy($other).").";
    if(is_string($moment)&&$moment!=='')$data.="\nМомент вопроса: ".$moment." (локальное время).";
    $instruction='Только тестовый нумерологический ответ для одного вопроса раздела «300 вопросов о жизни». Символическая трактовка не даёт знания чужих мыслей и фактов будущего. Отвечай на конкретный вопрос, не пиши общий портрет. Учитывай как сильные, так и теневые проявления, противоречия, практические признаки. Не льсти, не выдумывай обвинения. Если спрашивают о мыслях или чувствах другого человека, нельзя утверждать, что мы их знаем; предлагай смотреть на поступки. Пиши по-русски естественно, как нумеролог и подруга, без формул и названий энергий, без долгих вступлений, штампов и длинного тире. Два абзаца: сначала ответ по существу, потом конкретная рекомендация. 110–180 слов. Не обещай медицинских или финансовых результатов.';
    $payload=['model'=>'openai/gpt-oss-120b','temperature'=>0.65,'max_completion_tokens'=>750,
      'messages'=>[['role'=>'system','content'=>$instruction],['role'=>'user','content'=>$data]]];
    $curl=curl_init('https://api.groq.com/openai/v1/chat/completions');
    curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,
      CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>50,CURLOPT_HTTPHEADER=>[
      'Authorization: Bearer '.$key,'Content-Type: application/json','Accept: application/json',
      'User-Agent: numi-moment-owner-preview/1.0'],
      CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
    $response=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);
    if(!is_string($response)||$status!==200||strlen($response)>40000){
        error_log('MOMENT_GROQ_STATUS:'.($status?:'network'));
        omReply(503,['ok'=>false,'error'=>'MODEL_UNAVAILABLE']);
    }
    $parsed=json_decode($response,true,20,JSON_THROW_ON_ERROR);
    $answer=$parsed['choices'][0]['message']['content']??null;
    if(!is_string($answer)||mb_strlen(trim($answer))<90||mb_strlen($answer)>3000)
        omReply(503,['ok'=>false,'error'=>'MODEL_OUTPUT_NOT_READY']);
    omReply(200,['ok'=>true,'test'=>true,'question_id'=>$id,'question'=>$q['title'],'answer'=>trim($answer)]);
}catch(Throwable $e){
    error_log('MOMENT_OWNER_PREVIEW:'.get_class($e));
    omReply(503,['ok'=>false,'error'=>'TEMPORARILY_UNAVAILABLE']);
}
