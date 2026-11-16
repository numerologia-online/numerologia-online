<?php
declare(strict_types=1);
// Single first-party server authority for site owner preview access.
// Access is evaluated from the real REG.RU login session, never from a URL,
// client-side flag or Telegram username.
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private, max-age=0');
header('X-Robots-Tag: noindex, nofollow, noarchive');
if (($_SERVER['REQUEST_METHOD']??'')!=='GET') {
    http_response_code(405);
    header('Allow: GET');
    echo '{"ok":false,"error":"METHOD_NOT_ALLOWED"}';
    exit;
}
try {
    $db=naDB();
    $account=naCurrent($db);
    echo json_encode([
      'ok'=>true,
      'authenticated'=>$account!==null,
      'owner'=>naTestOwner($account),
      'access_mode'=>'owner_preview_only',
      'charged'=>false
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    error_log('NUMI_OWNER_ACCESS_CHECK:'.get_class($e));
    http_response_code(503);
    echo '{"ok":false,"error":"OWNER_AUTH_TEMPORARILY_UNAVAILABLE"}';
}
