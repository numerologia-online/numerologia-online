<?php
declare(strict_types=1);
// Place this file and config.local.php OUTSIDE the public webroot on REG.RU.
function childConfig(): array {
    $path = __DIR__ . '/config.local.php';
    if (!is_file($path)) throw new RuntimeException('Access server is not configured');
    $config = require $path;
    foreach (['bot_token','mysql_dsn','mysql_user','mysql_password','site_origin'] as $key) {
        if (!is_array($config) || !is_string($config[$key] ?? null) || $config[$key] === '') {
            throw new RuntimeException('Missing private config: ' . $key);
        }
    }
    if (!str_starts_with($config['site_origin'], 'https://')) {
        throw new RuntimeException('HTTPS site origin is required');
    }
    return $config;
}
function childDatabase(array $config): PDO {
    return new PDO($config['mysql_dsn'], $config['mysql_user'], $config['mysql_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
}
function childJson(int $status, array $data): never {
    http_response_code($status);
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function verifiedTelegramId(string $initData, string $botToken): string {
    if ($initData === '' || strlen($initData) > 16000) throw new RuntimeException('Auth required');
    $input = [];
    foreach (explode('&', $initData) as $piece) {
        $parts = explode('=', $piece, 2);
        $key = urldecode($parts[0]);
        if ($key === '' || array_key_exists($key, $input)) throw new RuntimeException('Invalid auth fields');
        $input[$key] = urldecode($parts[1] ?? '');
    }
    $hash = $input['hash'] ?? '';
    $issued = $input['auth_date'] ?? '';
    if (!preg_match('/^[a-f0-9]{64}$/D', $hash) || !ctype_digit($issued) ||
        (int)$issued > time() + 60 || time() - (int)$issued > 86400) {
        throw new RuntimeException('Expired or unsigned session');
    }
    unset($input['hash']);
    ksort($input, SORT_STRING);
    $pairs = [];
    foreach ($input as $key => $value) $pairs[] = $key . '=' . $value;
    $secret = hash_hmac('sha256', $botToken, 'WebAppData', true);
    $expected = hash_hmac('sha256', implode("\n", $pairs), $secret);
    if (!hash_equals($expected, $hash)) throw new RuntimeException('Invalid Telegram signature');
    $user = json_decode($input['user'] ?? '', true, 20, JSON_THROW_ON_ERROR);
    $id = $user['id'] ?? null;
    if ((!is_int($id) && !is_string($id)) || !preg_match('/^[1-9][0-9]{3,19}$/D', (string)$id)) {
        throw new RuntimeException('Invalid Telegram user');
    }
    return (string)$id;
}
