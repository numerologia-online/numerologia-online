<?php
/**
 * Numerologia Online | reliable daily Telegram delivery, for ~100-1000 users.
 * PHP 8.1+ CLI, deployed alongside private/db.php and private/bot-config.php.
 * Schedule: every 5 minutes. First sends at 08:00 Europe/Moscow;
 * automatic retry and backlog processing through 11:59 Europe/Moscow.
 * Cron command remains: php ~/private/numerologia-daily-08-msk-21-10-2026.php --run
 *
 * Uses the EXISTING Telegram bot and the EXISTING users table.
 * Does not change webhook, subscriber preferences, bot menu, or the website.
 * Preserves legacy delivery records including SENT and UNCERTAIN.
 * No private tokens or Telegram payloads are written into reports.
 *
 * Telegram Bot API provides no idempotency key for sendMessage: if the server
 * accepted a message but its acknowledgement was lost, a retry can cause a
 * duplicate. The retry strategy favors recovering missing forecasts.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

const EXPECTED_BOT_ID = '8814989076';
const DELIVERY_TABLE = 'daily_forecast_delivery';
const DISPATCH_LOCK = 'numerologia_daily_send_v3';
const MAX_ATTEMPTS = 15;
const MAX_BATCH = 220;
const MAX_RUN_SECONDS = 205;
const BETWEEN_SEND_US = 350000; // ~2.85 requests/s, far below Telegram limits.
const REQUEST_TIMEOUT = 20;

$zone = new DateTimeZone('Europe/Moscow');
$now = new DateTimeImmutable('now', $zone);
$today = $now->format('Y-m-d');
$mode = $argv[1] ?? '--run';
if (!in_array($mode, ['--run', '--check', '--status'], true)) {
    fwrite(STDERR, "Usage: php numerologia-daily-08-msk-21-10-2026.php [--check|--run|--status]\n");
    exit(2);
}

$bankOrigins = [
    'https://numerologia-online.github.io/numerologia-online/',
];

function report(string $event, array $data = []): void {
    fwrite(STDOUT, json_encode(['event'=>$event] + $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
}
function digits(int $number): int {
    return array_sum(array_map('intval', str_split((string)abs($number))));
}
function reduceNine(int $number): int {
    $number = abs($number);
    while ($number > 9) $number = digits($number);
    return $number ?: 9;
}
function reduceTwentyTwo(int $number): int {
    $number = abs($number);
    while ($number > 22) $number -= 22;
    return $number ?: 22;
}
function reduceThirtyOne(int $number): int {
    $number = abs($number);
    while ($number > 31) $number -= 31;
    return $number ?: 31;
}
function personalKeys(string $birthISO, DateTimeImmutable $date): ?array {
    $birth = DateTimeImmutable::createFromFormat('!Y-m-d', $birthISO, new DateTimeZone('UTC'));
    if (!$birth || $birth->format('Y-m-d') !== $birthISO || $birth > $date) return null;
    $day = (int)$birth->format('j');
    $month = (int)$birth->format('n');
    $year = (int)$birth->format('Y');
    if ($year < 1900) return null;
    $today = (int)$date->format('j');
    $currentMonth = (int)$date->format('n');
    $currentYear = (int)$date->format('Y');
    // Identical arithmetic to the original working daily PHP file.
    $personalYear = reduceNine($day + $month + digits($currentYear));
    $personalMonth = reduceNine($personalYear + $currentMonth);
    $personalDay = reduceNine($personalMonth + $today);
    $universalDay = reduceNine($today + $currentMonth + digits($currentYear));
    $lifePath = digits($day) + digits($month) + digits($year);
    while ($lifePath > 9 && !in_array($lifePath, [11, 22, 33], true)) $lifePath = digits($lifePath);
    $energy = reduceTwentyTwo($personalDay + $personalMonth + $universalDay + $day + $currentMonth);
    $personalNumber = reduceThirtyOne($lifePath + $day + $today + digits($year));
    return [$energy, $personalNumber];
}
function getJson(string $url, int $timeout = 12): ?array {
    if (!function_exists('curl_init')) return null;
    $c = curl_init($url);
    curl_setopt_array($c, [
        CURLOPT_RETURNTRANSFER=>true, CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_CONNECTTIMEOUT=>5, CURLOPT_TIMEOUT=>$timeout,
        CURLOPT_USERAGENT=>'NumerologiaOnline-Daily/3.0',
        CURLOPT_HTTPHEADER=>['Accept: application/json'],
        CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,
    ]);
    $body = curl_exec($c);
    $status = (int)curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    if (!is_string($body) || $status !== 200 || strlen($body) > 1048576) return null;
    $json = json_decode($body, true);
    return is_array($json) ? $json : null;
}
function forecastBank(string $file, array $origins): ?array {
    static $cache = [];
    if (array_key_exists($file, $cache)) return $cache[$file];
    foreach ($origins as $origin) {
        $bank = getJson(rtrim($origin, '/') . '/' . $file);
        if (is_array($bank) && is_array($bank['entries'] ?? null)) {
            return $cache[$file] = $bank;
        }
    }
    return $cache[$file] = null;
}
function forecastEntry(array $bank, int $energy, int $number): ?array {
    $item = $bank['entries'][(string)$number] ?? $bank['entries'][$energy . '-' . $number] ?? null;
    return is_array($item) ? $item : null;
}
function buildForecast(string $birthISO, DateTimeImmutable $date, array $origins): ?string {
    $keys = personalKeys($birthISO, $date);
    if (!$keys) return null;
    [$energy, $number] = $keys;
    $part = sprintf('%02d', $energy);
    $general = forecastBank('data/day/general/general-day-' . $part . '.json', $origins);
    if (!$general) return null;
    $main = forecastEntry($general, $energy, $number);
    if (!is_string($main['text'] ?? null) || trim($main['text']) === '') return null;
    $monthNames = [1=>'января', 2=>'февраля', 3=>'марта', 4=>'апреля', 5=>'мая', 6=>'июня',
        7=>'июля', 8=>'августа', 9=>'сентября', 10=>'октября', 11=>'ноября', 12=>'декабря'];
    $displayDate = $date->format('j') . ' ' . $monthNames[(int)$date->format('n')] . ' ' . $date->format('Y');
    $message = "Доброе утро, твой личный расчёт на сегодня готов 🫶 {$displayDate}. " . trim($main['text']);
    $practical = forecastBank('data/day/practical/practical-day-' . $part . '.json', $origins);
    if ($practical) {
        $advice = forecastEntry($practical, $energy, $number);
        foreach ([['todayNeed', 'Сегодня нужно'], ['todayAvoid', 'Сегодня нельзя']] as [$key, $heading]) {
            $items = $advice[$key] ?? null;
            if (!is_array($items)) continue;
            $parts = array_filter(array_map('trim', array_filter($items, 'is_string')));
            if ($parts) $message .= "\n\n{$heading}:\n• " . implode("\n• ", $parts);
        }
    }
    return mb_substr($message, 0, 4000, 'UTF-8');
}
function database(): PDO {
    if (!is_file(__DIR__ . '/db.php')) throw new RuntimeException('DB_CONFIG_MISSING');
    require_once __DIR__ . '/db.php';
    if (!function_exists('getDB')) throw new RuntimeException('DB_FUNCTION_MISSING');
    $db = getDB();
    if (!$db instanceof PDO) throw new RuntimeException('DB_CONNECT_FAILED');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    return $db;
}
function botToken(): string {
    if (!is_file(__DIR__ . '/bot-config.php')) throw new RuntimeException('BOT_CONFIG_MISSING');
    $cfg = require __DIR__ . '/bot-config.php';
    $token = is_array($cfg) ? ($cfg['token'] ?? null) : null;
    if (!is_string($token) || !preg_match('/^([0-9]{5,15}):[A-Za-z0-9_-]{30,100}$/D', $token, $m)
        || $m[1] !== EXPECTED_BOT_ID) throw new RuntimeException('BOT_TOKEN_INVALID');
    return $token;
}
/**
 * Safe error categories only. No Telegram response bodies, subscriber IDs or
 * credentials leave the PHP process. 429 obeys retry_after. 4xx stops retry.
 */
function sendTelegram(string $token, string $chat, string $message): array {
    $c = curl_init('https://api.telegram.org/bot' . $token . '/sendMessage');
    curl_setopt_array($c, [
        CURLOPT_POST=>true,
        CURLOPT_POSTFIELDS=>http_build_query(['chat_id'=>$chat, 'text'=>$message, 'disable_web_page_preview'=>'true']),
        CURLOPT_RETURNTRANSFER=>true, CURLOPT_CONNECTTIMEOUT=>7,
        CURLOPT_TIMEOUT=>REQUEST_TIMEOUT,
        CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,
    ]);
    $reply = curl_exec($c);
    $http = (int)curl_getinfo($c, CURLINFO_HTTP_CODE);
    $curlError = curl_errno($c);
    curl_close($c);
    if ($curlError !== 0 || !is_string($reply)) {
        // A timeout can happen after Telegram accepted the message. Rare duplicate risk.
        return ['ok'=>false, 'retry'=>true, 'code'=>'NETWORK_OR_TIMEOUT', 'wait'=>180, 'message_id'=>null];
    }
    $json = json_decode($reply, true);
    if ($http === 200 && ($json['ok'] ?? false) === true) {
        $id = $json['result']['message_id'] ?? null;
        return ['ok'=>true, 'retry'=>false, 'code'=>null, 'wait'=>0,
            'message_id'=>is_int($id) && $id > 0 ? $id : null];
    }
    if ($http === 429) {
        $wait = is_array($json) ? (int)($json['parameters']['retry_after'] ?? 120) : 120;
        return ['ok'=>false, 'retry'=>true, 'code'=>'RATE_LIMIT', 'wait'=>min(3600, max(60, $wait + 5)), 'message_id'=>null];
    }
    if ($http === 400 || $http === 403 || $http === 404) {
        return ['ok'=>false, 'retry'=>false, 'code'=>'CHAT_OR_PERMISSION_' . $http, 'wait'=>0, 'message_id'=>null];
    }
    if ($http === 401) {
        return ['ok'=>false, 'retry'=>false, 'code'=>'BOT_AUTH_401', 'wait'=>0, 'message_id'=>null];
    }
    return ['ok'=>false, 'retry'=>true, 'code'=>$http >= 500 ? 'TELEGRAM_SERVER_ERROR' : 'TELEGRAM_HTTP_ERROR', 'wait'=>180, 'message_id'=>null];
}
/** Migration only adds columns; never deletes or resets old statuses. */
function ensureSchema(PDO $db): void {
    $db->exec('CREATE TABLE IF NOT EXISTS `' . DELIVERY_TABLE . '` (' .
        '`telegram_id` BIGINT UNSIGNED NOT NULL, `forecast_date` DATE NOT NULL,' .
        '`status` VARCHAR(16) NOT NULL, `attempts` INT UNSIGNED NOT NULL DEFAULT 0,' .
        '`retry_after` DATETIME NULL, `last_error_code` VARCHAR(32) NULL,' .
        '`telegram_message_id` BIGINT NULL,' .
        '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,' .
        '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,' .
        'PRIMARY KEY (`telegram_id`,`forecast_date`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $cols = $db->query('SHOW COLUMNS FROM `' . DELIVERY_TABLE . '`')->fetchAll(PDO::FETCH_COLUMN);
    $add = [
        'attempts'=>'`attempts` INT UNSIGNED NOT NULL DEFAULT 0',
        'retry_after'=>'`retry_after` DATETIME NULL',
        'last_error_code'=>'`last_error_code` VARCHAR(32) NULL',
        'telegram_message_id'=>'`telegram_message_id` BIGINT NULL',
    ];
    foreach ($add as $column=>$definition) {
        if (!in_array($column, $cols, true)) $db->exec('ALTER TABLE `' . DELIVERY_TABLE . '` ADD COLUMN ' . $definition);
    }
}
function deliveryCounts(PDO $db, string $day): array {
    $q = $db->prepare('SELECT status, COUNT(*) AS n FROM `' . DELIVERY_TABLE . '` WHERE forecast_date = ? GROUP BY status');
    $q->execute([$day]);
    $result = [];
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) $result[$r['status']] = (int)$r['n'];
    return $result;
}
function enabledCount(PDO $db): int {
    return (int)$db->query('SELECT COUNT(*) FROM users WHERE daily_enabled=1 AND birth_date IS NOT NULL')->fetchColumn();
}
function backoff(int $attempt, int $minimum): int {
    // Increase delay for recurring failures; scheduled every 5 minutes.
    return max($minimum, min(1800, 60 * (2 ** min($attempt, 5))));
}

try {
    if (!function_exists('curl_init') || !function_exists('mb_substr')) {
        throw new RuntimeException('PHP_EXTENSION_MISSING');
    }
    $db = database();
    $token = botToken();
    if ($mode === '--check') {
        $bank = forecastBank('data/day/general/general-day-01.json', $bankOrigins);
        $me = getJson('https://api.telegram.org/bot' . $token . '/getMe');
        $identityMatches = ($me['ok'] ?? false) === true
            && (string)($me['result']['id'] ?? '') === EXPECTED_BOT_ID;
        report('CHECK', [
            'date'=>$today, 'db'=>'READY', 'enabled_rows'=>enabledCount($db),
            'forecast_bank'=>$bank ? 'READY' : 'UNAVAILABLE',
            'telegram'=>$identityMatches ? 'READY' : 'UNAVAILABLE',
        ]);
        exit($bank && $identityMatches ? 0 : 3);
    }
    if ($mode === '--status') {
        // Read-only, no new table/column changes.
        report('STATUS', ['date'=>$today, 'enabled_rows'=>enabledCount($db), 'delivery'=>deliveryCounts($db, $today)]);
        exit(0);
    }
    $hour = (int)$now->format('G');
    if ($hour < 8 || $hour > 11) {
        report('OUTSIDE_SEND_WINDOW', ['moscow_time'=>$now->format('H:i:s')]);
        exit(0);
    }
    $lock = (int)$db->query("SELECT GET_LOCK('" . DISPATCH_LOCK . "',0)")->fetchColumn();
    if ($lock !== 1) { report('ANOTHER_RUN_ACTIVE'); exit(0); }
    try {
        // Telegram may be unreachable briefly. Stop this run without marking
        // anyone delivered; the next 5-minute cron run will try again.
        $me = getJson('https://api.telegram.org/bot' . $token . '/getMe');
        if (($me['ok'] ?? false) !== true || (string)($me['result']['id'] ?? '') !== EXPECTED_BOT_ID) {
            throw new RuntimeException('TELEGRAM_PREFLIGHT_FAILED');
        }
        ensureSchema($db);
        // The original daily_forecast_delivery table retains the complete
        // historical record, including SENT and legacy UNCERTAIN. Do not retry
        // old UNCERTAIN records automatically: they could have been delivered.
        $enqueue = $db->prepare('INSERT IGNORE INTO `' . DELIVERY_TABLE . '` (telegram_id,forecast_date,status) ' .
            "SELECT telegram_id, ?, 'PENDING' FROM users WHERE daily_enabled=1 AND birth_date IS NOT NULL");
        $enqueue->execute([$today]);
        // If an earlier process died after claiming a send, recover it.
        // Unlike Telegram, MySQL will retain a stale SENDING row forever without
        // this safe, delayed re-queue. Duplicates remain theoretically possible.
        $db->exec('UPDATE `' . DELIVERY_TABLE . '` SET status = \'FAILED\', last_error_code=\'RETRY_LIMIT_REACHED\' ' .
            'WHERE status = \'SENDING\' AND attempts >= ' . MAX_ATTEMPTS . ' AND updated_at < (NOW() - INTERVAL 10 MINUTE)');
        $db->exec('UPDATE `' . DELIVERY_TABLE . '` SET status = \'RETRY\', retry_after = UTC_TIMESTAMP() ' .
            'WHERE status = \'SENDING\' AND attempts < ' . MAX_ATTEMPTS . ' AND updated_at < (NOW() - INTERVAL 10 MINUTE)');
        $q = $db->prepare('SELECT d.telegram_id,d.attempts,u.chat_id,u.birth_date ' .
            'FROM `' . DELIVERY_TABLE . '` d INNER JOIN users u ON u.telegram_id=d.telegram_id ' .
            'WHERE d.forecast_date = ? AND u.daily_enabled=1 AND u.birth_date IS NOT NULL ' .
            "AND d.attempts < " . MAX_ATTEMPTS . " AND (d.status='PENDING' OR (d.status='RETRY' AND (d.retry_after IS NULL OR d.retry_after <= UTC_TIMESTAMP()))) " .
            'ORDER BY d.created_at,d.telegram_id LIMIT ' . MAX_BATCH);
        $q->execute([$today]);
        $rows = $q->fetchAll(PDO::FETCH_ASSOC);
        $claim = $db->prepare('UPDATE `' . DELIVERY_TABLE . '` SET status = \'SENDING\',attempts=attempts+1,retry_after=NULL,last_error_code=NULL ' .
            'WHERE telegram_id=? AND forecast_date=? AND status IN (\'PENDING\',\'RETRY\')');
        $finish = $db->prepare('UPDATE `' . DELIVERY_TABLE . '` SET status=?,retry_after=?,last_error_code=?,telegram_message_id=? ' .
            'WHERE telegram_id=? AND forecast_date=? AND status=\'SENDING\'');
        $stats = ['processed'=>0, 'sent'=>0, 'retry_scheduled'=>0, 'failed_permanent'=>0];
        $start = microtime(true);
        foreach ($rows as $row) {
            if (microtime(true) - $start >= MAX_RUN_SECONDS) break;
            $telegramId = (string)$row['telegram_id'];
            $attempt = (int)$row['attempts'] + 1;
            $claim->execute([$telegramId, $today]);
            if ($claim->rowCount() !== 1) continue;
            $chat = $telegramId; // All opt-ins are from private Telegram chats (chat_id == telegram_id).
            $birth = (string)$row['birth_date'];
            if (!preg_match('/^[1-9][0-9]{0,15}$/D', $chat)) {
                $result = ['ok'=>false,'retry'=>false,'code'=>'INVALID_CHAT_ID','wait'=>0,'message_id'=>null];
            } else {
                $text = buildForecast($birth, $now, $bankOrigins);
                $result = $text === null
                    ? ['ok'=>false,'retry'=>true,'code'=>'FORECAST_NOT_READY','wait'=>300,'message_id'=>null]
                    : sendTelegram($token, $chat, $text);
            }
            if ($result['ok']) {
                $status = 'SENT'; $next = null; $code = null;
                $stats['sent']++;
            } else {
                $code = $result['code'];
                if ($result['retry'] && $attempt < MAX_ATTEMPTS) {
                    $status = 'RETRY';
                    $seconds = backoff($attempt, (int)$result['wait']);
                    $next = gmdate('Y-m-d H:i:s', time() + $seconds);
                    $stats['retry_scheduled']++;
                } else {
                    $status = 'FAILED'; $next = null;
                    $stats['failed_permanent']++;
                }
            }
            $finish->execute([$status,$next,$code,$result['message_id'],$telegramId,$today]);
            $stats['processed']++;
            usleep(BETWEEN_SEND_US);
        }
        report('DONE', ['date'=>$today] + $stats + ['delivery'=>deliveryCounts($db, $today)]);
    } finally {
        $db->query("SELECT RELEASE_LOCK('" . DISPATCH_LOCK . "')")->fetchColumn();
    }
} catch (Throwable $e) {
    // Errors are classified without revealing database details or credentials.
    report('ERROR', ['class'=>$e instanceof RuntimeException ? 'CONFIG_OR_CONNECTIVITY' : 'DATABASE_OR_RUNTIME']);
    exit(1);
}