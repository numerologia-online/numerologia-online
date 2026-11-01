<?php
declare(strict_types=1);

/**
 * Privacy-first, aggregate-only analytics; no user identifiers or event log.
 * For installation only in /api/numi-analytics.php on REG.RU.
 * Does NOT enable until analytics/schema.sql has been applied.
 */
require_once dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function axReply(int $code,array $data): never {
    http_response_code($code);
    echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
// Dedicated analytics session. A Telegram or ordinary-site session is NOT
// sufficient to access statistics. Login must verify the owner's password.
function axSession(): void {
    if (session_status()===PHP_SESSION_ACTIVE) return;
    session_name('__Host-numi_analytics');
    session_set_cookie_params([
        'lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Strict'
    ]);
    ini_set('session.use_strict_mode','1');
    ini_set('session.use_only_cookies','1');
    ini_set('session.cookie_httponly','1');
    ini_set('session.cookie_secure','1');
    ini_set('session.gc_maxlifetime','14400');
    session_start();
}
function axAdmin(PDO $db): bool {
    axSession();
    $id=$_SESSION['analytics_owner_id']??null;
    $original=$_SESSION['analytics_password_fingerprint']??null;
    $loggedAt=$_SESSION['analytics_logged_at']??0;
    if (!is_string($id)||!is_string($original)||!is_int($loggedAt)||time()-$loggedAt>14400) return false;
    $stmt=$db->prepare('SELECT id,email,email_verified_at,password_hash FROM numi_accounts WHERE id=? LIMIT 1');
    $stmt->execute([$id]);
    $account=$stmt->fetch();
    return is_array($account)&&naTestOwner($account)
        &&is_string($account['password_hash']??null)
        &&hash_equals($original,hash('sha256',$account['password_hash']));
}
function axLogin(PDO $db,array $body): never {
    // Explicit password check required even if site is already Telegram-authenticated.
    $email=naEmail($body['email']??null);
    $password=$body['password']??null;
    if (!$email||!is_string($password)||strlen($password)>500) axReply(401,['ok'=>false,'error'=>'INVALID_CREDENTIALS']);
    naRate($db,$email);
    $stmt=$db->prepare('SELECT id,email,email_verified_at,password_hash FROM numi_accounts WHERE email=? LIMIT 1');
    $stmt->execute([$email]);$account=$stmt->fetch();
    if (!$account||!naTestOwner($account)
        ||!is_string($account['password_hash']??null)
        ||!password_verify($password,$account['password_hash'])) {
        naRate($db,$email,true);
        axReply(401,['ok'=>false,'error'=>'INVALID_CREDENTIALS']);
    }
    // Initialize only the new aggregate table after verified OWNER password login.
    // Never modify account, payment, Telegram or existing analytics tables.
    $db->exec("CREATE TABLE IF NOT EXISTS numi_analytics_daily (
      day_utc DATE NOT NULL,
      event_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      section VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      item VARCHAR(72) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      campaign VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      event_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (day_utc,event_type,section,item,campaign),
      KEY ix_numi_analytics_section (section,day_utc)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    axSession();
    session_regenerate_id(true);
    $_SESSION=[
        'analytics_owner_id'=>$account['id'],
        'analytics_password_fingerprint'=>hash('sha256',$account['password_hash']),
        'analytics_logged_at'=>time(),
    ];
    session_write_close();
    axReply(200,['ok'=>true,'authenticated'=>true]);
}
function axLogout(): never {
    axSession();
    $_SESSION=[];session_regenerate_id(true);session_destroy();
    setcookie('__Host-numi_analytics','',['expires'=>time()-3600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);
    axReply(200,['ok'=>true,'authenticated'=>false]);
}
function axOriginAllowed(): bool {
    $origin=(string)($_SERVER['HTTP_ORIGIN']??'');
    $host=(string)($_SERVER['HTTP_HOST']??'');
    return in_array($origin,[
        'https://xn--c1adkkdfjbp1a4l.online',
        'https://www.xn--c1adkkdfjbp1a4l.online'
    ],true) && in_array($host,[
        'xn--c1adkkdfjbp1a4l.online',
        'www.xn--c1adkkdfjbp1a4l.online'
    ],true);
}
try {
    $db=naDB();
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if ($method==='POST') {
        if (!axOriginAllowed()) axReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
        if ((int)($_SERVER['CONTENT_LENGTH']??0)>1024) axReply(413,['ok'=>false,'error'=>'TOO_LARGE']);
        $raw=file_get_contents('php://input',false,null,0,1025);
        if (!is_string($raw)||strlen($raw)>1024) axReply(400,['ok'=>false,'error'=>'BAD_REQUEST']);
        $body=json_decode($raw,true,8,JSON_THROW_ON_ERROR);
        if (!is_array($body)||array_is_list($body)) axReply(400,['ok'=>false,'error'=>'BAD_REQUEST']);
        $action=$body['action']??null;
        if ($action==='admin_login') axLogin($db,$body);
        if ($action==='admin_logout') {
            if (!axAdmin($db)) axReply(403,['ok'=>false,'error'=>'ADMIN_REQUIRED']);
            axLogout();
        }
        $type=$body['type']??null;
        $section=$body['section']??null;
        $item=$body['item']??'-';
        $campaign=$body['campaign']??'-';
        if (!is_string($type)||!in_array($type,['page','category','question','search','campaign'],true)
          ||!is_string($section)||!preg_match('/^[a-z0-9_-]{1,48}$/D',$section)
          ||!is_string($item)||!preg_match('/^[a-z0-9_-]{1,72}$/D',$item)
          ||!is_string($campaign)||!preg_match('/^[a-z0-9_-]{1,48}$/D',$campaign)) {
            axReply(400,['ok'=>false,'error'=>'BAD_EVENT']);
        }
        // Drop raw search text, user ID, referrer, IP, date of birth and
        // unknown body fields; only 5 enumerated properties are stored.
        $stmt=$db->prepare('INSERT INTO numi_analytics_daily
            (day_utc,event_type,section,item,campaign,event_count)
            VALUES (UTC_DATE(),?,?,?,?,1)
            ON DUPLICATE KEY UPDATE event_count=event_count+1');
        $stmt->execute([$type,$section,$item,$campaign]);
        axReply(200,['ok'=>true]);
    }
    if ($method!=='GET') axReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    if (($_GET['action']??'')==='session') axReply(200,['ok'=>true,'authenticated'=>axAdmin($db)]);
    if (!axAdmin($db)) axReply(403,['ok'=>false,'error'=>'ADMIN_REQUIRED']);
    $days=filter_var($_GET['days']??7,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>90]]);
    if ($days===false) axReply(400,['ok'=>false,'error'=>'BAD_RANGE']);
    $stmt=$db->prepare('SELECT day_utc,event_type,section,item,campaign,event_count
        FROM numi_analytics_daily
        WHERE day_utc>=DATE_SUB(UTC_DATE(),INTERVAL ? DAY)
        ORDER BY day_utc DESC,event_count DESC
        LIMIT 15000');
    $stmt->bindValue(1,$days-1,PDO::PARAM_INT);
    $stmt->execute();
    axReply(200,['ok'=>true,'period_days'=>$days,'rows'=>$stmt->fetchAll()]);
} catch (Throwable $e) {
    error_log('NUMI_AGG_ANALYTICS:'.get_class($e));
    axReply(503,['ok'=>false,'error'=>'ANALYTICS_UNAVAILABLE']);
}
