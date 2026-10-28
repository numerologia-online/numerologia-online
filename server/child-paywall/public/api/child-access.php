<?php
declare(strict_types=1);
require __DIR__ . '/../../private/bootstrap.php';
// Public endpoint MUST be deployed to PHP hosting. GitHub Pages cannot run it.
try {
    $config = childConfig();
} catch (Throwable $e) {
    childJson(503, ['ok'=>false, 'access'=>'preview', 'error'=>'NOT_CONFIGURED']);
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
header('Access-Control-Allow-Origin: ' . $config['site_origin']);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Vary: Origin');
if (!hash_equals($config['site_origin'], $origin)) {
    childJson(403, ['ok'=>false, 'access'=>'preview', 'error'=>'ORIGIN']);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') childJson(204, []);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') childJson(405, ['ok'=>false, 'error'=>'METHOD']);
try {
    $raw = file_get_contents('php://input', false, null, 0, 16385);
    if (!is_string($raw) || strlen($raw) > 16384) throw new RuntimeException('Invalid input');
    $body = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
    if (!is_array($body) || ($body['action'] ?? null) !== 'check') throw new RuntimeException('Invalid action');
    $telegramId = verifiedTelegramId((string)($body['init_data'] ?? ''), $config['bot_token']);
    $childId = $body['child_id'] ?? null;
    $birth = $body['birth_date'] ?? '';
    // No client-chosen date or child ID grants access. It only scopes the lookup.
    if (!is_string($childId) || !preg_match('/^[a-f0-9-]{36}$/iD', $childId)
        || !is_string($birth) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $birth)) {
        childJson(200, ['ok'=>true, 'access'=>'preview', 'child_id'=>null]);
    }
    $pdo = childDatabase($config);
    $sql = "SELECT c.id FROM child_profiles c
      JOIN user_accounts a ON a.id=c.account_id
      JOIN child_entitlements e ON e.child_id=c.id AND e.account_id=a.id
      JOIN child_purchases p ON p.id=e.purchase_id AND p.account_id=a.id AND p.child_id=c.id
      WHERE a.provider='telegram' AND a.provider_user_id=:telegram
        AND c.id=:child AND c.birth_date=:birth
        AND e.product_code='child_full_v1' AND e.status='active' AND e.revoked_at IS NULL
        AND p.product_code='child_full_v1' AND p.status='paid'
        AND p.currency='RUB' AND p.amount_kopeks=49000 AND p.verified_at IS NOT NULL
      LIMIT 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['telegram'=>$telegramId, 'child'=>$childId, 'birth'=>$birth]);
    $found = $stmt->fetch();
    childJson(200, [
        'ok'=>true, 'access'=>$found ? 'full' : 'preview',
        'child_id'=>$found ? $childId : null,
        'birth_date'=>$found ? $birth : null
    ]);
} catch (Throwable $e) {
    childJson(401, ['ok'=>false,'access'=>'preview','error'=>'AUTH_OR_ACCESS']);
}
