<?php
declare(strict_types=1);
// Existing Red Flag endpoint: owner previews only, no purchase or publication writes.
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
function rfPreviewReply(int $status,array $body): never {
    http_response_code($status);
    echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
function rfCloudCall(array $messages,int $tokens): string {
    $key=base64_decode('__CLOUDRU_KEY_BASE64__',true);
    if(!is_string($key)||$key==='')throw new RuntimeException('KEY_NOT_CONFIGURED');
    $ch=curl_init('https://foundation-models.api.cloud.ru/v1/chat/completions');
    curl_setopt_array($ch,[
        CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>55,
        CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$key],
        CURLOPT_POSTFIELDS=>json_encode(['model'=>'anthropic/claude-haiku-4.5',
            'messages'=>$messages,'max_tokens'=>$tokens,'temperature'=>0.8,'stream'=>false],
            JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)
    ]);
    $body=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    if($status!==200||!is_string($body))throw new RuntimeException('PROVIDER_HTTP_'.$status);
    $data=json_decode($body,true,32,JSON_THROW_ON_ERROR);
    $text=$data['choices'][0]['message']['content']??null;
    if(!is_string($text)||trim($text)==='')throw new RuntimeException('EMPTY_ANSWER');
    return trim($text);
}
try {
    // DEPLOYMENT_HEALTH_SLOT
    if(!naTestOwner(naCurrent(naDB())))rfPreviewReply(403,['ok'=>false,'error'=>'OWNER_ONLY']);
    $method=$_SERVER['REQUEST_METHOD']??'';
    $catalog=json_decode((string)file_get_contents(__DIR__.'/catalog.json'),true,20,JSON_THROW_ON_ERROR);
    if($method==='GET')rfPreviewReply(200,['ok'=>true,'owner'=>true,'catalog'=>$catalog,
        'draft_only'=>true,'published'=>false,'generation_enabled'=>true]);
    if($method!=='POST')rfPreviewReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    if(!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
        rfPreviewReply(403,['ok'=>false,'error'=>'ORIGIN_NOT_ALLOWED']);
    if((int)($_SERVER['CONTENT_LENGTH']??0)>4096)rfPreviewReply(413,['ok'=>false,'error'=>'REQUEST_TOO_LARGE']);
    $input=json_decode((string)file_get_contents('php://input'),true,10,JSON_THROW_ON_ERROR);
    $category=null;$question=null;
    foreach($catalog['categories'] as $item){
        if($item['id']!==($input['category']??''))continue;
        $category=$item;
        foreach($item['questions'] as $q)if($q['id']===($input['question_id']??'')){$question=$q;break;}
        break;
    }
    if($question===null)rfPreviewReply(400,['ok'=>false,'error'=>'QUESTION_NOT_AVAILABLE']);
    $day=$input['day']??null;$month=$input['month']??null;
    if(!is_int($day)||!is_int($month)||!checkdate($month,$day,2000))
        rfPreviewReply(400,['ok'=>false,'error'=>'INVALID_DATE']);
    // Session lock prevents concurrent model requests from repeated taps.
    session_name('numi_redflag_preview');
    session_set_cookie_params(['secure'=>true,'httponly'=>true,'samesite'=>'Strict','path'=>'/redflag-ai-lab/']);
    if(!session_start())throw new RuntimeException('PREVIEW_SESSION_FAILED');
    $last=(int)($_SESSION['last_generation']??0);
    if(time()-$last<15)rfPreviewReply(429,['ok'=>false,'error'=>'WAIT_15_SECONDS']);
    $_SESSION['last_generation']=time();
    $energy=$day;
    while($energy>22)$energy=array_sum(str_split((string)$energy));
    $otherTitles=array_column(array_filter($category['questions'],fn($q)=>$q['id']!==$question['id']),'title');
    $system='Ты нумеролог, обращаешься к женщине тепло и прямо, как подруга. '
        .'Ответь конкретно на её вопрос о мужчине, учитывая вместе день и месяц рождения и теневые стороны их энергий. '
        .'Это символическая нумерологическая интерпретация, а не установленные факты о человеке. '
        .'Пиши два абзаца без заголовков, списков, двоеточий и длинных тире. '
        .'Первый абзац даёт содержательный ответ, второй мягко предлагает один подходящий следующий вопрос из переданного списка. '
        .'Не перечисляй числа и названия энергий, не придумывай биографию. Ориентир 1000–1500 знаков.';
    $user='Вопрос: '.$question['title']."\nДень рождения: ".$day.'; месяц: '.$month
        .'; энергия дня по системе 1–22: '.$energy.'; энергия месяца: '.$month
        ."\nВопросы для мягкого продолжения: ".implode(' | ',$otherTitles);
    $answer=rfCloudCall([['role'=>'system','content'=>$system],['role'=>'user','content'=>$user]],1100);
    session_write_close();
    rfPreviewReply(200,['ok'=>true,'owner'=>true,'draft_only'=>true,'published'=>false,
        'category'=>$category['id'],'question_id'=>$question['id'],'date_key'=>$day.'-'.$month,
        'answer'=>$answer,'model'=>'anthropic/claude-haiku-4.5']);
} catch(Throwable $e) {
    if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
    error_log('REDFLAG_CLOUDRU:'.get_class($e).':'.$e->getMessage());
    rfPreviewReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);
}
