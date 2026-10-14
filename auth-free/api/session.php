<?php
declare(strict_types=1);
require __DIR__ . '/../lib/auth.php';
safety_headers();
header('Content-Type: application/json; charset=UTF-8');
try {
    $conf = config();
    $siteOrigin = parse_url($conf['site_url'], PHP_URL_SCHEME) . '://' . parse_url($conf['site_url'], PHP_URL_HOST);
    if (($_SERVER['HTTP_ORIGIN'] ?? '') === $siteOrigin) {
        header('Access-Control-Allow-Origin: ' . $siteOrigin);
        header('Access-Control-Allow-Methods: GET, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization');
        header('Vary: Origin');
    } elseif (isset($_SERVER['HTTP_ORIGIN'])) {
        http_response_code(403); echo '{"error":"Origin not permitted"}'; exit;
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        http_response_code(405); echo '{"error":"Method not allowed"}'; exit;
    }
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/^Bearer ([A-Za-z0-9_.-]+)$/D', $header, $m)) {
        http_response_code(401); echo '{"error":"Authorization required"}'; exit;
    }
    $payload = read_signed($m[1], $conf['session_secret']);
    if (empty($payload['id']) || empty($payload['name'])) throw new RuntimeException('Invalid session');
    echo json_encode(['user'=>['id'=>$payload['id'],'name'=>$payload['name']]], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $e) { http_response_code(401); echo '{"error":"Session expired"}'; }
