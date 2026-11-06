<?php
declare(strict_types=1);
/**
 * Isolated first-touch partner attribution for REG.RU.
 * Does not create orders, modify payment statuses, or grant paid access.
 * Migration: insights/partners/schema.sql. Install and verify before enabling clients.
 */
const NP_OWNER_HASH = 'f289c5906895cbbd1b42d74e4e2e07d531fc1af4e91bcf7e5700835856003d29';
const NP_COOKIE = 'numi_partner_ref';
const NP_HINT_COOKIE = 'numi_partner_hint';
const NP_LIFETIME = 2592000; // 30 days

function npReply(int $code, array $body): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
function npOwner(?array $account): bool {
    return $account !== null && !empty($account['email_verified_at'])
        && is_string($account['email'] ?? null)
        && hash_equals(NP_OWNER_HASH, hash('sha256', strtolower($account['email'])));
}
function npCode(mixed $value): ?string {
    if (!is_string($value)) return null;
    $v = strtolower(trim($value));
    return preg_match('/^[a-z][a-z0-9_-]{2,39}$/D', $v) ? $v : null;
}
function npSafeOrigin(): bool {
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    return in_array($host, ['xn----8sbhhqijddjgdebdz2c2o.xn--p1ai', 'www.xn----8sbhhqijddjgdebdz2c2o.xn--p1ai'], true)
        && hash_equals('https://' . $host, $origin);
}
function npToken(): string {
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}
function npCookieValue(): ?string {
    $s = $_COOKIE[NP_COOKIE] ?? null;
    return is_string($s) && preg_match('/^[A-Za-z0-9_-]{43}$/D', $s) ? $s : null;
}
function npSetCookies(string $token): void {
    $opts = ['expires' => time() + NP_LIFETIME, 'path' => '/', 'secure' => true, 'samesite' => 'Lax'];
    setcookie(NP_COOKIE, $token, $opts + ['httponly' => true]);
    setcookie(NP_HINT_COOKIE, '1', $opts + ['httponly' => false]);
}
function npTablesReady(PDO $db): bool {
    try {
        foreach (['numi_partner_codes','numi_partner_tokens','numi_partner_clicks','numi_partner_accounts'] as $table) {
            $db->query('SELECT 1 FROM ' . $table . ' LIMIT 0');
        }
        return true;
    } catch (PDOException $e) { return false; }
}
function npBind(PDO $db, ?array $account, ?string $token): bool {
    if (!$account || !$token || !isset($account['id'])) return false;
    $hash = hash('sha256', $token);
    // First eligible partner wins. No retroactive attribution for prior paying customers.
    $stmt = $db->prepare("INSERT IGNORE INTO numi_partner_accounts
        (account_id,partner_id,token_hash,bound_at,expires_at)
        SELECT ?,t.partner_id,t.token_hash,UTC_TIMESTAMP(),t.expires_at
        FROM numi_partner_tokens t JOIN numi_partner_codes p ON p.id=t.partner_id
        WHERE t.token_hash=? AND t.expires_at>UTC_TIMESTAMP() AND p.active=1
          AND NOT EXISTS (
            SELECT 1 FROM numi_orders o WHERE o.account_id=?
            AND o.status='paid' AND o.verified_at IS NOT NULL
            AND o.verified_at<t.created_at
          )");
    $stmt->execute([$account['id'], $hash, $account['id']]);
    return $stmt->rowCount() === 1;
}
function npVisit(PDO $db, string $code, ?array $account): array {
    $q = $db->prepare('SELECT id FROM numi_partner_codes WHERE code=? AND active=1 LIMIT 1');
    $q->execute([$code]); $clicked = $q->fetchColumn();
    if (!$clicked) return ['ok' => false, 'error' => 'UNKNOWN_PARTNER'];
    $raw = npCookieValue(); $firstTouch = null;
    if ($raw !== null) {
        $q = $db->prepare('SELECT partner_id FROM numi_partner_tokens WHERE token_hash=? AND expires_at>UTC_TIMESTAMP()');
        $q->execute([hash('sha256', $raw)]);
        $firstTouch = $q->fetchColumn();
    }
    if (!$firstTouch) {
        $raw = npToken(); $hash = hash('sha256', $raw);
        $q = $db->prepare('INSERT INTO numi_partner_tokens(token_hash,partner_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY))');
        $q->execute([$hash, (int)$clicked]);
    }
    npSetCookies($raw);
    $hash = hash('sha256', $raw);
    // De-duplicate repeated click requests for the same browser and partner within 30 seconds.
    $q = $db->prepare('SELECT 1 FROM numi_partner_clicks WHERE partner_id=? AND token_hash=? AND clicked_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 30 SECOND) LIMIT 1');
    $q->execute([(int)$clicked, $hash]);
    if (!$q->fetchColumn()) {
        $q = $db->prepare('INSERT INTO numi_partner_clicks(partner_id,token_hash) VALUES(?,?)');
        $q->execute([(int)$clicked, $hash]);
    }
    npBind($db, $account, $raw);
    return ['ok' => true, 'recorded' => true];
}
function npCreate(PDO $db, array $data): array {
    $code = npCode($data['code'] ?? null);
    $label = trim((string)($data['label'] ?? ''));
    $rate = $data['rate_bps'] ?? 2500;
    if (!$code || mb_strlen($label) < 2 || mb_strlen($label) > 80
        || !is_int($rate) || $rate < 0 || $rate > 5000) {
        return ['ok' => false, 'error' => 'INVALID_PARTNER'];
    }
    try {
        $q = $db->prepare('INSERT INTO numi_partner_codes(code,label,rate_bps) VALUES(?,?,?)');
        $q->execute([$code, $label, $rate]);
    } catch (PDOException $e) {
        if ((string)$e->getCode() === '23000') return ['ok' => false, 'error' => 'CODE_EXISTS'];
        throw $e;
    }
    return ['ok' => true, 'code' => $code, 'url' => 'https://нумерология.online/?ref=' . $code];
}
function npReport(PDO $db, string $from, string $to): array {
    $zone = new DateTimeZone('Europe/Samara');
    $utc = new DateTimeZone('UTC');
    $start = (new DateTimeImmutable($from . ' 00:00:00', $zone))->setTimezone($utc)->format('Y-m-d H:i:s');
    $end = (new DateTimeImmutable($to . ' 00:00:00', $zone))->modify('+1 day')->setTimezone($utc)->format('Y-m-d H:i:s');
    $q = $db->query('SELECT id,code,label,rate_bps,active,created_at FROM numi_partner_codes ORDER BY created_at DESC,id DESC LIMIT 1000');
    $partners = [];
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $r['clicks'] = 0; $r['unique_links'] = 0; $r['accounts'] = 0;
        $r['registrations'] = 0; $r['buyers'] = 0; $r['paid_orders'] = 0;
        $r['revenue_kopeks'] = 0; $r['commission_kopeks'] = 0;
        $r['rate_bps'] = (int)$r['rate_bps']; $r['active'] = (bool)$r['active'];
        $partners[(int)$r['id']] = $r;
    }
    $q = $db->prepare('SELECT partner_id,COUNT(*) clicks,COUNT(DISTINCT token_hash) unique_links
        FROM numi_partner_clicks WHERE clicked_at>=? AND clicked_at<? GROUP BY partner_id');
    $q->execute([$start,$end]);
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $id = (int)$row['partner_id'];
        if (isset($partners[$id])) {
            $partners[$id]['clicks'] = (int)$row['clicks'];
            $partners[$id]['unique_links'] = (int)$row['unique_links'];
        }
    }
    $q = $db->prepare('SELECT b.partner_id,COUNT(*) accounts,
        SUM(IF(a.created_at>=t.created_at AND a.created_at<=b.bound_at,1,0)) registrations
        FROM numi_partner_accounts b
        JOIN numi_accounts a ON a.id=b.account_id
        JOIN numi_partner_tokens t ON t.token_hash=b.token_hash
        WHERE b.bound_at>=? AND b.bound_at<? GROUP BY b.partner_id');
    $q->execute([$start,$end]);
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $id = (int)$row['partner_id'];
        if (isset($partners[$id])) {
            $partners[$id]['accounts'] = (int)$row['accounts'];
            $partners[$id]['registrations'] = (int)$row['registrations'];
        }
    }
    // Read ONLY verified real payments from the authoritative order table.
    // Refunded/cancelled/test/pending payments never count. Nothing is written to orders.
    $q = $db->prepare("SELECT b.partner_id,
        COUNT(DISTINCT o.account_id) buyers,COUNT(*) paid_orders,
        COALESCE(SUM(o.amount_kopeks),0) revenue_kopeks,
        COALESCE(SUM(FLOOR((o.amount_kopeks*p.rate_bps+5000)/10000)),0) commission_kopeks
        FROM numi_partner_accounts b JOIN numi_partner_codes p ON p.id=b.partner_id
        JOIN numi_orders o ON o.account_id=b.account_id
        WHERE o.status='paid' AND o.verified_at IS NOT NULL
          AND o.amount_kopeks>0 AND o.currency='RUB' AND o.provider IS NOT NULL
          AND o.provider NOT IN ('test','sandbox')
          AND o.created_at>=b.bound_at
          AND o.verified_at>=b.bound_at AND o.verified_at<b.expires_at
          AND o.verified_at>=? AND o.verified_at<?
        GROUP BY b.partner_id");
    $q->execute([$start,$end]);
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $id = (int)$row['partner_id'];
        if (isset($partners[$id])) foreach (['buyers','paid_orders','revenue_kopeks','commission_kopeks'] as $key)
            $partners[$id][$key] = (int)$row[$key];
    }
    return ['ok'=>true,'from'=>$from,'to'=>$to,'timezone'=>'Europe/Samara',
        'method'=>'first_touch_30_days_verified_orders_only',
        'payouts_automated'=>false,'partners'=>array_values($partners)];
}
function npMain(): never {
    header('Cache-Control: no-store, private, max-age=0');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    try {
        require_once dirname(__DIR__,3) . '/private/numi-account-20261031/core.php';
        $db = naDB();
        $db->exec("SET time_zone='+00:00'");
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $action = $_GET['action'] ?? '';
        $account = naCurrent($db);
        if ($method === 'POST' && !npSafeOrigin()) npReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
        if ($method === 'POST') {
            if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0)>2048) npReply(413,['ok'=>false,'error'=>'TOO_LARGE']);
            $raw = file_get_contents('php://input',false,null,0,2049);
            if (!is_string($raw)||strlen($raw)>2048) npReply(413,['ok'=>false,'error'=>'TOO_LARGE']);
            $data = json_decode($raw,true,8,JSON_THROW_ON_ERROR);
            if (!is_array($data)) npReply(400,['ok'=>false,'error'=>'BAD_BODY']);
        } else $data = [];
        if (!npTablesReady($db)) npReply(503,['ok'=>false,'error'=>'PARTNERS_NOT_INSTALLED']);
        if ($method==='POST' && $action==='visit') {
            $code = npCode($data['code'] ?? null);
            if (!$code) npReply(400,['ok'=>false,'error'=>'INVALID_CODE']);
            $res = npVisit($db,$code,$account);
            npReply($res['ok']?200:404,$res);
        }
        if ($method==='POST' && $action==='bind') {
            npReply(200,['ok'=>true,'bound'=>npBind($db,$account,npCookieValue())]);
        }
        if (!npOwner($account)) npReply(401,['ok'=>false,'error'=>'OWNER_LOGIN_REQUIRED']);
        if ($method==='POST' && $action==='create') {
            $res = npCreate($db,$data);
            npReply($res['ok']?201:400,$res);
        }
        if ($method==='GET' && $action==='partners') {
            $from = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
            if (!is_string($from)||!is_string($to)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$from)
                ||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$to)
                ||!checkdate((int)substr($from,5,2),(int)substr($from,8,2),(int)substr($from,0,4))
                ||!checkdate((int)substr($to,5,2),(int)substr($to,8,2),(int)substr($to,0,4))
                ||$from>$to || (strtotime($to)-strtotime($from))>366*86400) {
                npReply(400,['ok'=>false,'error'=>'BAD_RANGE']);
            }
            npReply(200,npReport($db,$from,$to));
        }
        npReply(404,['ok'=>false,'error'=>'NOT_FOUND']);
    } catch (JsonException $e) {
        npReply(400,['ok'=>false,'error'=>'BAD_JSON']);
    } catch (Throwable $e) {
        error_log('NUMI_PARTNERS '.get_class($e));
        npReply(503,['ok'=>false,'error'=>'PARTNERS_UNAVAILABLE']);
    }
}
if (!defined('NUMI_PARTNERS_TEST')) npMain();
