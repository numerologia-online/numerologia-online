<?php
declare(strict_types=1);
/* Public and genuinely FREE Red Flag answer for exactly flags/say-no.
   One birthday day-month => one cached AI answer for 24 hours. No charges,
   owner-only drafts, paid content, answer bank or user profile modifications. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
function rfFreeReply(int $status,array $result): never {
    http_response_code($status);
    echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
function rfFreeValidResponse(string $answer): bool {
    return mb_strlen($answer)>=450&&mb_strlen($answer)<=1900&&
        (bool)preg_match('/\S+\n\s*\n\S+/u',$answer)&&
        !preg_match('/(?:аркан|энерг|нумеролог|девятк|восьм[её]рк|сочетани\w*\s+чисел|число\s+рождения|\d{1,2}\s*[-\/]\s*\d{1,2})/iu',$answer);
}
function rfFreeClean(string $text): string {
    $text=str_replace("\r\n","\n",trim($text));
    // Decorative long dashes and colons have no place in customer prose.
    $text=preg_replace('/\s*[:—]\s*/u',', ',$text)??$text;
    $text=preg_replace('/,\s*,+/u',', ',$text)??$text;
    return trim($text);
}
try {
    if (($_SERVER['REQUEST_METHOD']??'')!=='POST')
        rfFreeReply(405,['ok'=>false,'error'=>'POST_ONLY']);
    $origin=(string)($_SERVER['HTTP_ORIGIN']??'');
    if (!in_array($origin,naAllowedOrigins(),true))
        rfFreeReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
    $raw=file_get_contents('php://input',false,null,0,1025);
    if (!is_string($raw)||strlen($raw)>1024)
        rfFreeReply(400,['ok'=>false,'error'=>'BAD_REQUEST']);
    $input=json_decode($raw,true,5,JSON_THROW_ON_ERROR);
    if (!is_array($input)||($input['question_id']??null)!=='say-no'||
        !is_int($input['day']??null)||!is_int($input['month']??null)||
        !checkdate($input['month'],$input['day'],2000))
        rfFreeReply(400,['ok'=>false,'error'=>'INVALID_DATE_OR_QUESTION']);
    $day=$input['day'];$month=$input['month'];
    $key=$day.'-'.$month;
    $store=dirname(__DIR__,3).'/private/numi-redflag-free-ai-v1';
    if (!is_dir($store)&&!mkdir($store,0700,true)&&!is_dir($store))
        rfFreeReply(503,['ok'=>false,'error'=>'TEMPORARILY_UNAVAILABLE']);
    $file=$store.'/day-'.$day.'-month-'.$month.'.json';
    $replyAnswer=static function(string $text,string $key): never {
        rfFreeReply(200,['ok'=>true,'free'=>true,'ai_generated'=>true,
            'question_id'=>'say-no','date_key'=>$key,'answer'=>$text]);
    };
    $load=static function(string $path): ?string {
        if (!is_file($path)||time()-(int)filemtime($path)>86400)return null;
        $saved=json_decode((string)file_get_contents($path),true);
        $answer=$saved['answer']??null;
        return is_string($answer)&&rfFreeValidResponse($answer)?$answer:null;
    };
    // Keep one calculated result stable throughout the day even when a
    // customer reloads Telegram. Other birth dates have independent caches.
    if (($cached=$load($file))!==null)$replyAnswer($cached,$key);
    $lock=fopen($file.'.lock','c');
    if (!$lock||!flock($lock,LOCK_EX))rfFreeReply(503,['ok'=>false,'error'=>'TEMPORARILY_UNAVAILABLE']);
    if (($cached=$load($file))!==null)$replyAnswer($cached,$key);
    // Rate-limit *new* expensive AI generations, not cache reads.
    // Derive key from REMOTE_ADDR only, never trust forwarded client headers.
    $ip=(string)($_SERVER['REMOTE_ADDR']??'unknown');
    $rate=$store.'/rate-'.hash('sha256',$ip).'.json';
    $handle=fopen($rate,'c+');
    if (!$handle||!flock($handle,LOCK_EX))
        rfFreeReply(503,['ok'=>false,'error'=>'TEMPORARILY_UNAVAILABLE']);
    rewind($handle);
    $current=json_decode((string)stream_get_contents($handle),true);
    $now=time();
    $recent=array_values(array_filter(is_array($current)?$current:[],static fn($t)=>
        is_int($t)&&$t>$now-86400));
    $last5=array_filter($recent,static fn($t)=>$t>$now-300);
    if (count($recent)>=80||count($last5)>=8) {
        flock($handle,LOCK_UN);fclose($handle);
        rfFreeReply(429,['ok'=>false,'error'=>'RATE_LIMITED']);
    }
    $recent[]=$now;
    ftruncate($handle,0);rewind($handle);
    fwrite($handle,json_encode($recent,JSON_THROW_ON_ERROR));
    fflush($handle);flock($handle,LOCK_UN);fclose($handle);
    $configPath=dirname(__DIR__,3).'/private/numi-moment-groq/config.local.php';
    if (!is_file($configPath))rfFreeReply(503,['ok'=>false,'error'=>'AI_NOT_READY']);
    $config=require $configPath;
    $groqKey=is_array($config)?($config['groq_api_key']??null):null;
    if (!is_string($groqKey)||!str_starts_with($groqKey,'gsk_'))
        rfFreeReply(503,['ok'=>false,'error'=>'AI_NOT_READY']);
    $proof=hash_hmac('sha256','numi-moment-cloudflare-bridge-v1',$groqKey);
    $followups=[
        'Держит слово или опять одни красивые разговоры?',
        'Верный или у него каждая вторая «просто подруга»?',
        'Какой финальный вердикт по этому мужчине без розовых очков?'
    ];
    $payload=json_encode([
        'category'=>'flags','question_id'=>'say-no',
        'title'=>'Уважает женское «нет» или начинает давить?',
        'day'=>$day,'month'=>$month,'followups'=>$followups
    ],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    $curl=curl_init('https://numerologia-300-ai.tankraft431.workers.dev/v1/redflag-draft');
    if ($curl===false)rfFreeReply(503,['ok'=>false,'error'=>'AI_UNAVAILABLE']);
    curl_setopt_array($curl,[
        CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>85,
        CURLOPT_MAXREDIRS=>0,CURLOPT_HTTPHEADER=>[
            'Content-Type: application/json','Accept: application/json',
            'X-Numi-Moment-Proof: '.$proof,
            'User-Agent: NumiRedFlagFreeAnswer/1.0'
        ],CURLOPT_POSTFIELDS=>$payload
    ]);
    $body=curl_exec($curl);
    $status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);
    $curlError=curl_errno($curl);
    curl_close($curl);
    if (!is_string($body)||$status!==200||strlen($body)>16000) {
        error_log('REDFLAG_FREE_AI_WORKER_STATUS:'.($status?:'network').';curl:'.$curlError);
        rfFreeReply(503,['ok'=>false,'error'=>'AI_TEMPORARILY_UNAVAILABLE']);
    }
    $json=json_decode($body,true,10,JSON_THROW_ON_ERROR);
    $answer=$json['answer']??null;
    if (($json['ok']??false)!==true||($json['draft_only']??false)!==true||
        ($json['question_id']??null)!=='say-no'||
        ($json['category']??null)!=='flags'||($json['date_key']??null)!==$key||
        !is_string($answer))
        rfFreeReply(503,['ok'=>false,'error'=>'AI_INVALID_RESPONSE']);
    $answer=rfFreeClean($answer);
    if (!rfFreeValidResponse($answer))
        rfFreeReply(503,['ok'=>false,'error'=>'AI_INVALID_RESPONSE']);
    // The cache is an implementation detail, not a public answer bank.
    // Never expose a cached text through a direct URL or user content API.
    $tmp=tempnam($store,'rf-free-');
    if ($tmp===false)rfFreeReply(503,['ok'=>false,'error'=>'CACHE_UNAVAILABLE']);
    @chmod($tmp,0600);
    $record=json_encode(['question_id'=>'say-no','date_key'=>$key,'answer'=>$answer,
        'created_at'=>gmdate('c')],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
    if (file_put_contents($tmp,$record,LOCK_EX)===false||!rename($tmp,$file))
        rfFreeReply(503,['ok'=>false,'error'=>'CACHE_UNAVAILABLE']);
    @chmod($file,0600);
    $replyAnswer($answer,$key);
} catch (Throwable $e) {
    error_log('REDFLAG_FREE_AI:'.get_class($e));
    rfFreeReply(503,['ok'=>false,'error'=>'TEMPORARILY_UNAVAILABLE']);
}
