<?php
declare(strict_types=1);
require __DIR__ . '/../lib/auth.php';
safety_headers();
try {
    $conf = config();
    $state = random_token();
    $nonce = random_token();
    $verifier = random_token(32);
    $challenge = b64url(hash('sha256', $verifier, true));
    $flow = sign_data(['state'=>$state,'nonce'=>$nonce,'verifier'=>$verifier,'exp'=>time()+600], $conf['session_secret']);
    flow_cookie($flow, time()+600);
    $params = http_build_query([
        'client_id'=>$conf['telegram_client_id'],
        'redirect_uri'=>$conf['auth_url'] . '/api/callback.php',
        'response_type'=>'code',
        'scope'=>'openid profile',
        'state'=>$state,
        'nonce'=>$nonce,
        'code_challenge'=>$challenge,
        'code_challenge_method'=>'S256',
    ], '', '&', PHP_QUERY_RFC3986);
    header('Location: https://oauth.telegram.org/auth?' . $params, true, 302);
} catch (Throwable $e) { send_error('Сервис авторизации ещё не настроен.'); }
