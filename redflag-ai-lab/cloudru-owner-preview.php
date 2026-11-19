<?php
declare(strict_types=1);
/* Private owner-only Cloud.ru diagnostic. No automatic inference or publishing. */
require dirname(__DIR__, 3) . '/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: same-origin');
function cloudH(string $text): string {
    return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
if (!naTestOwner(naCurrent(naDB()))) {
    http_response_code(403);
    echo '<!doctype html><meta charset="utf-8">Доступно только владельцу сайта после входа в личный кабинет.';
    exit;
}
$day = (int)($_POST['day'] ?? 9);
$month = (int)($_POST['month'] ?? 9);
if ($day < 1 || $day > 31) $day = 9;
if ($month < 1 || $month > 12) $month = 9;
$message = '';
$answer = '';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin !== '' && !in_array($origin, naAllowedOrigins(), true)) {
        $message = 'Ошибка: нужно запускать тест с нашего сайта.';
    } elseif (!checkdate($month, $day, 2000)) {
        $message = 'Неверная дата.';
    } else {
        $configFile = dirname(__DIR__, 3) . '/private/numi-cloudru/config.local.php';
        $cfg = is_file($configFile) ? require $configFile : [];
        $key = is_array($cfg) ? ($cfg['cloudru_api_key'] ?? '') : '';
        if (!is_string($key) || trim($key) === '') {
            $message = 'На REG.RU ещё не установлен API-ключ Cloud.ru.';
        } elseif (!function_exists('curl_init')) {
            $message = 'На REG.RU недоступен PHP cURL.';
        } else {
            $action = (string)($_POST['action'] ?? '');
            if ($action !== 'auth' && $action !== 'generate') {
                $message = 'Неизвестная операция.';
            } else {
                $allowed = true;
                if ($action === 'generate') {
                    $lockPath = dirname(__DIR__, 3) . '/private/numi-cloudru/last-generation.txt';
                    $lock = @fopen($lockPath, 'c+');
                    if (!$lock || !flock($lock, LOCK_EX)) {
                        $allowed = false;
                        $message = 'Не удалось включить защиту от повторных генераций.';
                    } else {
                        $previous = (int)trim((string)stream_get_contents($lock));
                        if (time() - $previous < 60) {
                            $allowed = false;
                            $message = 'Повторный платный запрос заблокирован на 60 секунд.';
                        } else {
                            ftruncate($lock, 0);
                            rewind($lock);
                            fwrite($lock, (string)time());
                            fflush($lock);
                        }
                        flock($lock, LOCK_UN);
                        fclose($lock);
                    }
                }
                if ($allowed) {
                    $model = 'openai/gpt-oss-120b';
                    $payload = [
                        'model' => $model,
                        'messages' => [
                            ['role' => 'system', 'content' =>
                                'Ты опытный нумеролог, женщина. Дай символический разбор мужчины по дню и месяцу рождения без утверждений о реальных поступках. Живой, конкретный, честный ответ на вопрос женщины, без лести, без двоеточий, без длинного тире. Два абзаца суммарно 900–1300 символов. Первый отвечает на вопрос, второй мягко предлагает вопрос «Заботится или будет контролировать каждый твой шаг?». Не упоминай числа, энергии, арканы и расчёты.'],
                            ['role' => 'user', 'content' =>
                                'Вопрос: Уважает женское «нет» или начинает давить? Дата рождения мужчины: ' .
                                sprintf('%02d.%02d', $day, $month) . '. Напиши только ответ.']
                        ],
                        'max_tokens' => 1500,
                        'temperature' => 0.7,
                        'stream' => false
                    ];
                    $url = 'https://foundation-models.api.cloud.ru/v1/' .
                        ($action === 'auth' ? 'models' : 'chat/completions');
                    $ch = curl_init($url);
                    $options = [
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_FOLLOWLOCATION => false,
                        CURLOPT_CONNECTTIMEOUT => 10,
                        CURLOPT_TIMEOUT => 75,
                        CURLOPT_HTTPHEADER => [
                            'Authorization: Bearer ' . $key,
                            'Accept: application/json',
                            'Content-Type: application/json'
                        ],
                    ];
                    if ($action === 'generate') {
                        $options[CURLOPT_POST] = true;
                        $options[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
                    }
                    curl_setopt_array($ch, $options);
                    $raw = curl_exec($ch);
                    $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    $curlError = curl_errno($ch);
                    curl_close($ch);
                    if ($curlError || !is_string($raw)) {
                        $message = 'Ошибка соединения с Cloud.ru (cURL ' . $curlError . '). Повторов не было.';
                    } elseif ($http === 401) {
                        $message = 'Cloud.ru ответил 401: API-ключ не прошёл авторизацию. Повторов не было.';
                    } elseif ($http === 403) {
                        $message = 'Cloud.ru ответил 403: доступ запрещён. Проверь права и сервис Foundation Models.';
                    } elseif ($http !== 200) {
                        $message = 'Cloud.ru ответил HTTP ' . $http . '. Повторов не было.';
                    } else {
                        $data = json_decode($raw, true);
                        if ($action === 'auth') {
                            $models = is_array($data['data'] ?? null) ? $data['data'] : [];
                            $found = false;
                            foreach ($models as $item) {
                                if (($item['id'] ?? null) === $model) $found = true;
                            }
                            $message = 'Авторизация успешна (HTTP 200). Доступных моделей: ' . count($models) .
                                '. Выбранная модель: ' . ($found ? 'есть' : 'не обнаружена в списке') . '.';
                        } else {
                            $answer = trim((string)($data['choices'][0]['message']['content'] ?? ''));
                            $message = $answer !== '' ? 'Получен один ответ от Cloud.ru.' :
                                'Cloud.ru вернул 200, но текста ответа нет. Повторов не было.';
                        }
                    }
                }
            }
        }
    }
}
?><!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cloud.ru — закрытая проверка Red Flag</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f0f0;color:#29252b;font:17px/1.6 system-ui,sans-serif}
main{max-width:650px;margin:auto;padding:28px 20px 70px}h1{font-size:25px;line-height:1.25;margin:10px 0 18px}
p{margin:0 0 14px}small{color:#655e67}form{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:16px 0}
label{display:grid;gap:5px;font-size:14px}input{width:85px;padding:9px;font-size:17px;border:1px solid #bcb5be;border-radius:10px}
button{border:0;background:#29252b;color:white;border-radius:11px;padding:12px 15px;font:600 15px system-ui;cursor:pointer}
button.secondary{background:#716b76}.result{background:white;padding:20px;border-radius:15px;white-space:pre-wrap;margin-top:20px}
</style></head><body><main>
<small>Только для владельца · без автоматической генерации · клиентам не показывается</small>
<h1>Проверка Cloud.ru для Red Flag</h1>
<p>Сначала проверяем API-ключ без генерации текста. Потом, только по отдельному нажатию, получаем один ответ.</p>
<?php if($message !== ''): ?><div class="result"><?=cloudH($message)?></div><?php endif; ?>
<form method="post"><button class="secondary" type="submit" name="action" value="auth">Проверить ключ без генерации</button></form>
<p><small>Следующая кнопка отправляет один запрос к платной модели. Автоповторов нет.</small></p>
<form method="post" onsubmit="this.querySelectorAll('button').forEach(b=>b.disabled=true)"><input type="hidden" name="action" value="generate">
<label>День<input name="day" type="number" min="1" max="31" required value="<?=cloudH((string)$day)?>"></label>
<label>Месяц<input name="month" type="number" min="1" max="12" required value="<?=cloudH((string)$month)?>"></label>
<button type="submit">Получить один ответ</button>
</form>
<?php if($answer !== ''): ?><div class="result"><?=cloudH($answer)?></div><?php endif; ?>
</main></body></html>