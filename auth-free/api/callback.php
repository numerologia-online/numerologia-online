<?php
declare(strict_types=1);
require __DIR__ . '/../lib/auth.php';
safety_headers();
try {
    $conf = config();
    $flow = read_signed((string)($_COOKIE['num_tg_flow'] ?? ''), $conf['session_secret']);
    flow_cookie('', time()-3600);
    if (!isset($_GET['code'], $_GET['state']) || !is_string($_GET['code']) || !is_string($_GET['state'])
        || !hash_equals((string)($flow['state'] ?? ''), $_GET['state'])) {
        throw new RuntimeException('State mismatch');
    }
    $token = https_post('https://oauth.telegram.org/token', [
        'grant_type'=>'authorization_code', 'client_id'=>$conf['telegram_client_id'],
        'code'=>$_GET['code'],
        'redirect_uri'=>$conf['auth_url'] . '/api/callback.php',
        'code_verifier'=>$flow['verifier'],
    ], base64_encode($conf['telegram_client_id'] . ':' . $conf['telegram_client_secret']));
    $user = verify_telegram((string)($token['id_token'] ?? ''), (string)$flow['nonce'], (string)$conf['telegram_client_id']);
    $ticket = sign_data(['id'=>$user['id'],'name'=>$user['name'],'exp'=>time()+3600], $conf['session_secret']);
    $site = $conf['site_url'];
    header('Location: ' . $site . '#tg_session=' . rawurlencode($ticket), true, 303);
} catch (Throwable $e) { send_error('Попробуйте войти ещё раз. Если проблема повторится, сообщите владельцу сайта.'); }
