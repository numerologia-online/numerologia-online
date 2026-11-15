<?php
declare(strict_types=1);
/* Only the confirmed owner may read the one-off test generated via Groq on GitHub Actions. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, private, max-age=0');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('X-Content-Type-Options: nosniff');
try {
    $db=naDB();
    $owner=naCurrent($db);
    if(!naTestOwner($owner)) {
        http_response_code(403);
        echo '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Только владелец</title><body><p>Войди на сайте под аккаунтом владельца, чтобы увидеть ответ.</p></body></html>';
        exit;
    }
    $file=dirname(__DIR__,3).'/private/numi-moment-groq/first-answer.json';
    $data=is_file($file)?json_decode((string)file_get_contents($file),true,10,JSON_THROW_ON_ERROR):null;
    $answer=is_array($data)?($data['answer']??null):null;
    if(!is_string($answer)||mb_strlen(trim($answer))<100) {
        http_response_code(503);
        echo '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Ответ ещё не сформирован</title><body><p>Тестовый ответ ещё не сформирован.</p></body></html>';
        exit;
    }
    $safe=htmlspecialchars(trim($answer),ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $model=htmlspecialchars((string)($data['model']??'Groq'),ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $generated=htmlspecialchars((string)($data['generated_utc']??''),ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    echo '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
    echo '<title>Первый ответ · 300 вопросов</title><style>';
    echo ':root{font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#f7f4ec;color:#183e30}';
    echo '*{box-sizing:border-box}body{margin:0;padding:24px 15px 70px}main{max-width:690px;margin:auto}';
    echo 'a{color:#214b38}h1{font:500 clamp(30px,7vw,42px)/1.18 Georgia,serif;margin:23px 0 16px}';
    echo '.paper{border:1px solid #d9c5a1;background:#fffdf9;padding:24px;border-radius:20px;box-shadow:0 8px 28px #153b2c12}';
    echo '.tag{color:#907443;font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase}';
    echo '.answer{white-space:pre-line;line-height:1.65;font-size:17px;margin:18px 0 20px}';
    echo '.note{font-size:14px;color:#617268;line-height:1.5}.pill{display:inline-block;padding:10px 16px;border-radius:10px;border:1px solid #a9844c;margin-top:14px}';
    echo '</style></head><body><main>';
    echo '<a href="./owner-preview.html">← Назад к редактору</a>';
    echo '<h1>Что он чувствует ко мне?</h1><section class="paper">';
    echo '<div class="tag">Первый настоящий ответ ИИ · только для владельца</div>';
    echo '<p class="note">Тест по сочетанию дня и месяца из твоего примера: 9 / 9 и 4 / 10. Ответ сгенерирован через Groq на GitHub, поскольку REG.RU напрямую к Groq не подключается.</p>';
    echo '<div class="answer">'.$safe.'</div>';
    echo '<p class="note">Модель: '.$model.'. Это проверка качества, не публикация и не платный ответ. Дата формирования (UTC): '.$generated.'.</p>';
    echo '<a class="pill" href="./owner-preview.html">Вернуться к 300 вопросам</a>';
    echo '</section></main></body></html>';
} catch(Throwable $e) {
    error_log('MOMENT_FIRST_ANSWER:'.get_class($e));
    http_response_code(503);
    echo 'Ответ временно недоступен.';
}
