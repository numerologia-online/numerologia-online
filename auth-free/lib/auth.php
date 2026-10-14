<?php
declare(strict_types=1);

function config(): array {
    static $config = null;
    if ($config !== null) return $config;
    $file = __DIR__ . '/config.local.php';
    if (!is_file($file)) throw new RuntimeException('Configuration missing');
    $settings = require $file;
    foreach (['telegram_client_id','telegram_client_secret','session_secret','auth_url','site_url'] as $key) {
        if (!is_array($settings) || empty($settings[$key])) throw new RuntimeException('Incomplete auth configuration');
    }
    if (strlen((string)$settings['session_secret']) < 32) throw new RuntimeException('Weak session signing key');
    $settings['auth_url'] = rtrim((string)$settings['auth_url'], '/');
    $settings['site_url'] = (string)$settings['site_url'];
    if (!str_starts_with($settings['auth_url'], 'https://')
        || !str_starts_with($settings['site_url'], 'https://')) throw new RuntimeException('HTTPS required');
    $config = $settings;
    return $config;
}
function b64url(string $data): string { return rtrim(strtr(base64_encode($data), '+/', '-_'), '='); }
function unb64(string $str): string {
    $res = base64_decode(strtr($str, '-_', '+/'), true);
    if ($res === false) throw new RuntimeException('Invalid token encoding');
    return $res;
}
function random_token(int $bytes=24): string { return b64url(random_bytes($bytes)); }
function sign_data(array $payload, string $secret): string {
    $body = b64url(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    return $body . '.' . b64url(hash_hmac('sha256', $body, $secret, true));
}
function read_signed(string $value, string $secret): array {
    $parts = explode('.', $value);
    if (count($parts) !== 2 || !$parts[0] || !$parts[1]) throw new RuntimeException('Invalid token');
    $correct = b64url(hash_hmac('sha256', $parts[0], $secret, true));
    if (!hash_equals($correct, $parts[1])) throw new RuntimeException('Invalid signature');
    $body = json_decode(unb64($parts[0]), true, 20, JSON_THROW_ON_ERROR);
    if (!is_array($body) || !isset($body['exp']) || !is_numeric($body['exp'])
        || (int)$body['exp'] <= time()) throw new RuntimeException('Token expired');
    return $body;
}
function flow_cookie(string $value, int $expire): void {
    setcookie('num_tg_flow', $value, [
        'expires'=>$expire, 'path'=>'/', 'secure'=>true, 'httponly'=>true, 'samesite'=>'Lax'
    ]);
}
function safety_headers(): void {
    header('Cache-Control: no-store, private');
    header('Referrer-Policy: no-referrer');
    header('X-Content-Type-Options: nosniff');
}
function send_error(string $message): never {
    http_response_code(400);
    safety_headers();
    header('Content-Type: text/html; charset=UTF-8');
    echo '<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ошибка входа</title>';
    echo '<body style="font:16px system-ui;max-width:500px;margin:40px auto;padding:20px"><h2>Не удалось завершить вход</h2>';
    echo '<p>' . htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p>';
    echo '<a href="https://numerologia-online.github.io/numerologia-online/">Вернуться на сайт</a></body></html>';
    exit;
}
function https_post(string $url, array $fields, string $basic): array {
    if (!function_exists('curl_init')) throw new RuntimeException('cURL PHP extension is unavailable');
    $c = curl_init($url);
    curl_setopt_array($c, [
        CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>http_build_query($fields),
        CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded','Authorization: Basic ' . $basic],
        CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>12, CURLOPT_CONNECTTIMEOUT=>6,
        CURLOPT_FOLLOWLOCATION=>false, CURLOPT_SSL_VERIFYPEER=>true
    ]);
    $raw = curl_exec($c);
    $httpCode = (int)curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    if (!is_string($raw) || $httpCode !== 200) throw new RuntimeException('Telegram token endpoint unavailable');
    $data = json_decode($raw, true, 20, JSON_THROW_ON_ERROR);
    if (!is_array($data)) throw new RuntimeException('Invalid Telegram response');
    return $data;
}
function https_json(string $url): array {
    if (!function_exists('curl_init')) throw new RuntimeException('cURL PHP extension is unavailable');
    $c = curl_init($url);
    curl_setopt_array($c, [
        CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>12, CURLOPT_CONNECTTIMEOUT=>6,
        CURLOPT_FOLLOWLOCATION=>false, CURLOPT_SSL_VERIFYPEER=>true
    ]);
    $raw = curl_exec($c);
    $httpCode = (int)curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    if (!is_string($raw) || $httpCode !== 200) throw new RuntimeException('Telegram public keys unavailable');
    return json_decode($raw, true, 20, JSON_THROW_ON_ERROR);
}
function asn1_len(int $n): string {
    if ($n < 128) return chr($n);
    $buf = '';
    while ($n > 0) { $buf = chr($n & 255) . $buf; $n >>= 8; }
    return chr(0x80 | strlen($buf)) . $buf;
}
function asn1_sequence(string $x): string { return "\x30" . asn1_len(strlen($x)) . $x; }
function asn1_int(string $x): string {
    $x = ltrim($x, "\x00");
    if ($x === '') $x = "\x00";
    if (ord($x[0]) & 0x80) $x = "\x00" . $x;
    return "\x02" . asn1_len(strlen($x)) . $x;
}
function rsa_public_key_pem(array $jwk): string {
    if (!isset($jwk['n'], $jwk['e'])) throw new RuntimeException('Incomplete public key');
    $key = asn1_sequence(asn1_int(unb64($jwk['n'])) . asn1_int(unb64($jwk['e'])));
    $algorithm = hex2bin('300d06092a864886f70d0101010500');
    $bits = "\x03" . asn1_len(strlen($key)+1) . "\x00" . $key;
    $public = asn1_sequence($algorithm . $bits);
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($public), 64, "\n") . "-----END PUBLIC KEY-----";
}
function verify_telegram(string $jwt, string $nonce, string $clientId): array {
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) throw new RuntimeException('Invalid ID token');
    [$h,$p,$s] = $parts;
    $header = json_decode(unb64($h), true, 20, JSON_THROW_ON_ERROR);
    $claims = json_decode(unb64($p), true, 20, JSON_THROW_ON_ERROR);
    if (!is_array($header) || ($header['alg'] ?? '') !== 'RS256' || empty($header['kid'])
        || !is_array($claims)) throw new RuntimeException('Unsupported ID token');
    $j = https_json('https://oauth.telegram.org/.well-known/jwks.json');
    $key = null;
    foreach (($j['keys'] ?? []) as $item) {
        if (($item['kid'] ?? '') === $header['kid'] && ($item['kty'] ?? '') === 'RSA') { $key = $item; break; }
    }
    if ($key === null || openssl_verify($h.'.'.$p, unb64($s), rsa_public_key_pem($key), OPENSSL_ALGO_SHA256) !== 1) {
        throw new RuntimeException('Invalid Telegram signature');
    }
    $aud = $claims['aud'] ?? null;
    if (!is_array($aud)) $aud = [$aud];
    $aud = array_map('strval', $aud);
    if (($claims['iss'] ?? '') !== 'https://oauth.telegram.org'
        || !in_array($clientId, $aud, true)
        || ($claims['nonce'] ?? '') !== $nonce
        || !isset($claims['exp'], $claims['iat'], $claims['id'])
        || (int)$claims['exp'] <= time()
        || (int)$claims['iat'] > time()+60
        || filter_var((string)$claims['id'], FILTER_VALIDATE_INT) === false
        || (int)$claims['id'] <= 0
    ) throw new RuntimeException('Telegram token claims rejected');
    return [
        'id'=>(string)$claims['id'],
        'name'=>mb_substr((string)($claims['name'] ?? $claims['given_name'] ?? 'Пользователь'), 0, 80, 'UTF-8'),
    ];
}
