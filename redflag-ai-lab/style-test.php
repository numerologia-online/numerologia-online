<?php
declare(strict_types=1);
/* Minimal OWNER-ONLY experiment. No changes to public Red Flag answers,
   payment logic, accepted banks, publication or any customer-visible UI. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header("Referrer-Policy: same-origin");
function rfStyleH(string $s): string {return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
$db=naDB();
if (!naTestOwner(naCurrent($db))) {
    http_response_code(403);
    echo '<!doctype html><meta charset="utf-8"><p>Страница доступна только владельцу сайта после входа в аккаунт.</p>';
    exit;
}
$day=filter_input(INPUT_POST,'day',FILTER_VALIDATE_INT);
$month=filter_input(INPUT_POST,'month',FILTER_VALIDATE_INT);
if (!$day)$day=31;if (!$month)$month=10;
$error='';$answer='';
if (($_SERVER['REQUEST_METHOD']??'')==='POST') {
    $origin=(string)($_SERVER['HTTP_ORIGIN']??'');
    if (!in_array($origin,naAllowedOrigins(),true))$error='Нужно открыть пробную страницу на своём сайте.';
    elseif (!checkdate($month,$day,2000))$error='Проверь дату рождения мужчины.';
    else {
        try {
            $configPath=dirname(__DIR__,3).'/private/numi-moment-groq/config.local.php';
            if (!is_file($configPath))throw new RuntimeException('AUTH_NOT_READY');
            $config=require $configPath;
            $key=is_array($config)?($config['groq_api_key']??null):null;
            if (!is_string($key)||!str_starts_with($key,'gsk_'))
                throw new RuntimeException('AUTH_NOT_READY');
            $proof=hash_hmac('sha256','numi-moment-cloudflare-bridge-v1',$key);
            $payload=json_encode([
                'category'=>'flags','question_id'=>'say-no',
                'title'=>'Уважает женское «нет» или начинает давить?',
                'day'=>$day,'month'=>$month,'followups'=>[]
            ],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
            $curl=curl_init('https://numerologia-300-ai.tankraft431.workers.dev/v1/redflag-style-test');
            if ($curl===false)throw new RuntimeException('CONNECT_FAILED');
            curl_setopt_array($curl,[
                CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,
                CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>100,
                CURLOPT_MAXREDIRS=>0,CURLOPT_HTTPHEADER=>[
                    'Content-Type: application/json','Accept: application/json',
                    'X-Numi-Moment-Proof: '.$proof,
                    'User-Agent: NumiRedFlagOwnerStyleTest/1.0'
                ],CURLOPT_POSTFIELDS=>$payload
            ]);
            $body=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);
            $curlErr=curl_errno($curl);curl_close($curl);
            if ($status!==200||!is_string($body)) {
                error_log('REDFLAG_STYLE_TEST_UPSTREAM_STATUS:'.$status.';CURL:'.$curlErr);
                throw new RuntimeException('MODEL_UNAVAILABLE');
            }
            $result=json_decode($body,true,6,JSON_THROW_ON_ERROR);
            if (($result['ok']??null)!==true||($result['style_test']??null)!==true||
                ($result['published']??null)!==false||($result['draft_only']??null)!==true||
                ($result['question_id']??null)!=='say-no'||
                ($result['date_key']??null)!==$day.'-'.$month||
                !is_string($result['answer']??null))
                throw new RuntimeException('INVALID_TEST_ANSWER');
            $answer=trim($result['answer']);
            if (mb_strlen($answer)<750||mb_strlen($answer)>1100)
                throw new RuntimeException('INVALID_LENGTH');
        }catch(Throwable $e) {
            error_log('REDFLAG_STYLE_TEST_ERROR:'.get_class($e).':'.$e->getMessage());
            $error='ИИ не выдал ответ нужного качества или временно недоступен. Попробуй ещё раз.';
        }
    }
}
?><!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Тест новой инструкции Red Flag</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f0f0;color:#28232a;font:17px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:640px;margin:auto;padding:28px 22px 60px}
small{color:#675e65}h1{font-size:26px;line-height:1.2;margin:12px 0 16px}
p{margin:0 0 15px}.answer{white-space:pre-wrap;background:white;border-radius:18px;padding:24px;margin:20px 0;font-size:17px;line-height:1.7}
form{display:flex;gap:9px;flex-wrap:wrap;align-items:end;margin-top:22px}
label{display:grid;font-size:13px;color:#675e65;gap:5px}input{border:1px solid #cac1c7;border-radius:10px;padding:9px;width:86px;font-size:17px}
button{border:0;border-radius:11px;padding:12px 18px;background:#252127;color:white;font-weight:650;font-size:16px;cursor:pointer}
.error{color:#9d2637;font-size:15px}
</style></head><body><main>
<small>Только для владельца. Тест не публикуется клиентам.</small>
<h1>Уважает женское «нет» или начинает давить?</h1>
<p>ИИ сам трактует теневые стороны дня и месяца рождения. Без готовых сюжетов и без навязанных недостатков.</p>
<form method="post">
<label>День<input type="number" name="day" min="1" max="31" value="<?=rfStyleH((string)$day)?>" required></label>
<label>Месяц<input type="number" name="month" min="1" max="12" value="<?=rfStyleH((string)$month)?>" required></label>
<button type="submit">Создать вариант</button>
</form>
<?php if($error!==''): ?><p class="error"><?=rfStyleH($error)?></p><?php endif; ?>
<?php if($answer!==''): ?>
<div class="answer"><?=rfStyleH($answer)?></div>
<small><?=mb_strlen($answer)?> знаков. Это новый ответ ИИ, не заранее написанный образец.</small>
<?php endif; ?>
</main></body></html>