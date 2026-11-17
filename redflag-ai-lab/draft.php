<?php
declare(strict_types=1);
/* OWNER-ONLY AI drafts for Red Flag. No customer API, charge, bank writes or publication. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
function rfLabReply(int $status,array $response): never {
    http_response_code($status);
    echo json_encode($response,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
try {
    $db=naDB();
    if (!naTestOwner(naCurrent($db))) rfLabReply(403,['ok'=>false,'error'=>'OWNER_ONLY']);
    $catalog=json_decode((string)file_get_contents(__DIR__.'/catalog.json'),true,20,JSON_THROW_ON_ERROR);
    if (($catalog['mode']??'')!=='owner_draft_only'||($catalog['keyRule']??'')!=='day-month'
        ||($catalog['questions']??0)!==54||count($catalog['categories']??[])!==6)
        rfLabReply(503,['ok'=>false,'error'=>'CATALOG_UNAVAILABLE']);
    if ($_SERVER['REQUEST_METHOD']==='GET') {
        rfLabReply(200,['ok'=>true,'owner'=>true,'draft_only'=>true,
            'auto_publish'=>false,'catalog'=>$catalog]);
    }
    if ($_SERVER['REQUEST_METHOD']!=='POST')
        rfLabReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    if (!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
        rfLabReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
    $raw=file_get_contents('php://input',false,null,0,5001);
    if (!is_string($raw)||strlen($raw)>5000)
        rfLabReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $body=json_decode($raw,true,10,JSON_THROW_ON_ERROR);
    if (!is_array($body))
        rfLabReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $category=$body['category']??null;
    $id=$body['question_id']??null;
    $day=$body['day']??null;
    $month=$body['month']??null;
    if (!is_string($category)||!is_string($id)||!is_int($day)||!is_int($month)
        ||!checkdate($month,$day,2000))
        rfLabReply(400,['ok'=>false,'error'=>'INVALID_SELECTION']);
    // Only owner-generated drafts may carry short previews of earlier answers.
    $avoid=$body['avoid_summaries']??[];
    if (!is_array($avoid)||!array_is_list($avoid)||count($avoid)>6)
        rfLabReply(400,['ok'=>false,'error'=>'INVALID_CONTEXT']);
    foreach ($avoid as $preview)
        if (!is_string($preview)||mb_strlen($preview)>210)
            rfLabReply(400,['ok'=>false,'error'=>'INVALID_CONTEXT']);
    $selectedCategory=null;$selectedQuestion=null;
    foreach ($catalog['categories'] as $entry) {
        if (($entry['id']??null)===$category) {
            $selectedCategory=$entry;
            foreach (($entry['questions']??[]) as $question)
                if (($question['id']??null)===$id) {$selectedQuestion=$question;break;}
            break;
        }
    }
    if ($selectedCategory===null||$selectedQuestion===null)
        rfLabReply(400,['ok'=>false,'error'=>'QUESTION_NOT_IN_DRAFT_CATALOG']);
    // Recommend only actual already-published questions, NEVER a draft/soon item.
    // Keep these titles synchronized with redflag-public-catalog.js ready entries.
    $publishedRelated=[
        'flags'=>['Уважает женское «нет» или начинает давить?','Верный или у него каждая вторая «просто подруга»?','Держит слово или опять одни красивые разговоры?'],
        'infidelity'=>['Верный или у него каждая вторая «просто подруга»?','Уважает женское «нет» или начинает давить?','Какой финальный вердикт по этому мужчине без розовых очков?'],
        'intimacy'=>['Сексуальный огонь или пять минут — и спасибо?','На каком языке любви он вообще понимает чувства?','Уважает женское «нет» или начинает давить?'],
        'family'=>['Самостоятельный мужчина или мамина корзиночка?','Будет опорой для семьи или всё снова окажется на твоих плечах?','Держит слово или опять одни красивые разговоры?'],
        'language'=>['На каком языке любви он вообще понимает чувства?','Пишет первым или ждёт инициативы от женщины?','Держит слово или опять одни красивые разговоры?'],
        'verdict'=>['Какой финальный вердикт по этому мужчине без розовых очков?','Верный или у него каждая вторая «просто подруга»?','Щедрый мужчина или считает каждую копейку?'],
    ];
    $followups=[]; // Owner diversity test must never force identical upsells.
    $configPath=dirname(__DIR__,3).'/private/numi-moment-groq/config.local.php';
    if (!is_file($configPath))rfLabReply(503,['ok'=>false,'error'=>'AI_AUTH_NOT_READY']);
    $config=require $configPath;
    $key=is_array($config)?($config['groq_api_key']??null):null;
    if (!is_string($key)||!str_starts_with($key,'gsk_'))
        rfLabReply(503,['ok'=>false,'error'=>'AI_AUTH_NOT_READY']);
    // Reuse the already-established server-only Cloudflare bridge proof.
    // Never send the Groq API key, account details or Telegram init_data to Cloudflare.
    $proof=hash_hmac('sha256','numi-moment-cloudflare-bridge-v1',$key);
    $encoded=json_encode([
        'category'=>$category,'question_id'=>$id,
        'title'=>(string)$selectedQuestion['title'],
        'day'=>$day,'month'=>$month,'followups'=>$followups,'avoid_summaries'=>$avoid
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $curl=curl_init('https://numerologia-300-ai.tankraft431.workers.dev/v1/redflag-owner-question');
    if ($curl===false)rfLabReply(503,['ok'=>false,'error'=>'AI_CONNECT_FAILED']);
    curl_setopt_array($curl,[
        CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>85,
        CURLOPT_MAXREDIRS=>0,CURLOPT_HTTPHEADER=>[
            'Content-Type: application/json','Accept: application/json',
            'X-Numi-Moment-Proof: '.$proof,
            'User-Agent: NumiRedFlagOwnerDraft/1.0'
        ],CURLOPT_POSTFIELDS=>$encoded
    ]);
    $result=curl_exec($curl);
    $status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);
    $error=curl_errno($curl);
    curl_close($curl);
    if (!is_string($result)||$status!==200||strlen($result)>14000) {
        error_log('REDFLAG_OWNER_AI_WORKER_STATUS:'.($status?:'network').';curl:'.$error);
        rfLabReply(503,['ok'=>false,'error'=>'DRAFT_GENERATION_UNAVAILABLE']);
    }
    $parsed=json_decode($result,true,10,JSON_THROW_ON_ERROR);
    $answer=$parsed['answer']??null;
    $expectedKey=$day.'-'.$month;
    if (($parsed['ok']??false)!==true||($parsed['draft_only']??false)!==true||
        ($parsed['category']??null)!==$category||($parsed['question_id']??null)!==$id||
        ($parsed['date_key']??null)!==$expectedKey||!is_string($answer)||
        mb_strlen(trim($answer))<380||mb_strlen($answer)>5200)
        rfLabReply(503,['ok'=>false,'error'=>'DRAFT_OUTPUT_UNAVAILABLE']);
    rfLabReply(200,['ok'=>true,'draft_only'=>true,'published'=>false,
        'category'=>$category,'question_id'=>$id,
        'question'=>(string)$selectedQuestion['title'],
        'date_key'=>$expectedKey,'answer'=>str_replace(['—',':'],[',',','],trim($answer))]);
}catch(Throwable $exception){
    error_log('REDFLAG_OWNER_AI_DRAFT:'.get_class($exception));
    rfLabReply(503,['ok'=>false,'error'=>'TEMPORARILY_UNAVAILABLE']);
}
