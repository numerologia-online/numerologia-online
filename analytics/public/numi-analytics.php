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
function axAdmin(PDO $db): bool {
    // Fail closed if no explicit owner account was configured outside GitHub.
    $owner=getenv('NUMI_ANALYTICS_OWNER_ID');
    if (!is_string($owner)||!preg_match('/^[a-f0-9-]{36}$/iD',$owner)) return false;
    $account=naCurrent($db);
    return is_array($account)&&hash_equals(strtolower($owner),strtolower((string)$account['id']));
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
