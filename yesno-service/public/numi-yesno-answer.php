<?php
declare(strict_types=1);
// Yes/No: one answer per Moscow calendar day for signed-in free accounts.
// The public catalogue stays public. All answer access is enforced here.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function ynReply(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
function ynCreateQuotaTable(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS numi_yesno_daily_uses (
      account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      use_day DATE NOT NULL,
      question_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      question_time CHAR(5) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id, use_day)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function ynClubMember(PDO $db, string $accountId): bool {
    // Real, verified paid club entitlements only. Owner tests and demo orders do not count.
    $sql = "SELECT 1 FROM numi_entitlements e
      JOIN numi_orders o ON o.id=e.order_id
      WHERE e.account_id=? AND e.status='active'
      AND e.product_code IN ('club_month','club','club_monthly','club-monthly','club_subscription','numi_club')
      AND e.expires_at IS NOT NULL AND e.expires_at > UTC_TIMESTAMP()
      AND o.status='paid' AND o.verified_at IS NOT NULL
      LIMIT 1";
    $query=$db->prepare($sql);
    $query->execute([$accountId]);
    return (bool)$query->fetchColumn();
}
function ynUsed(PDO $db, string $accountId, string $day): ?array {
    $stmt=$db->prepare('SELECT question_id,question_time FROM numi_yesno_daily_uses WHERE account_id=? AND use_day=? LIMIT 1');
    $stmt->execute([$accountId,$day]);
    $row=$stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}
try {
    $method=(string)($_SERVER['REQUEST_METHOD']??'GET');
    if ($method !== 'GET' && $method !== 'POST') ynReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    if ($method==='GET' && (($_GET['status']??'')!=='1')) {
        // Old GET answer URLs can no longer bypass the daily server-side quota.
        ynReply(405,['ok'=>false,'error'=>'POST_REQUIRED']);
    }
    $private=dirname(__DIR__,3).'/private';
    $accountCore=$private.'/numi-account-20261031/core.php';
    if (!is_file($accountCore)) ynReply(503,['ok'=>false,'error'=>'ACCESS_UNAVAILABLE']);
    require_once $accountCore;
    $db=naDB();
    $account=naCurrent($db);
    $day=(new DateTimeImmutable('now',new DateTimeZone('Europe/Moscow')))->format('Y-m-d');
    if ($method==='GET' && !$account) {
        ynReply(200,['ok'=>true,'authenticated'=>false,'subscribed'=>false,'remaining'=>0]);
    }
    if (!$account) ynReply(401,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
    $id=(string)$account['id'];
    ynCreateQuotaTable($db);
    $member=ynClubMember($db,$id);
    if ($method==='GET') {
        $used=$member ? null : ynUsed($db,$id,$day);
        ynReply(200,['ok'=>true,'authenticated'=>true,'subscribed'=>$member,'remaining'=>$member ? null : ($used ? 0 : 1)]);
    }
    $origin=(string)($_SERVER['HTTP_ORIGIN']??'');
    $fetchSite=(string)($_SERVER['HTTP_SEC_FETCH_SITE']??'');
    if (($origin!=='' && !in_array($origin,naAllowedOrigins(),true))
        || $fetchSite==='cross-site') ynReply(403,['ok'=>false,'error'=>'FORBIDDEN_ORIGIN']);
    $raw=file_get_contents('php://input',false,null,0,2049);
    if (!is_string($raw)||strlen($raw)>2048) ynReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $request=json_decode($raw,true);
    if (!is_array($request)) ynReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $q=$request['question']??null;
    $clock=$request['time']??null;
    if (!is_string($q)||!preg_match('/^yn-(man|love|work|money|choice|future|home)-[0-9]{3}$/D',$q,$parts))
        ynReply(404,['ok'=>false,'error'=>'ANSWER_NOT_READY']);
    if (!is_string($clock)||!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D',$clock))
        ynReply(400,['ok'=>false,'error'=>'INVALID_TIME']);
    $sum=array_sum(array_map('intval',str_split(str_replace(':','',$clock))));
    while ($sum>9) $sum=array_sum(array_map('intval',str_split((string)$sum)));
    $path=$private.'/numi-yesno-v1/answers/'.$parts[1].'/'.$q.'.json';
    if (!is_file($path)) ynReply(404,['ok'=>false,'error'=>'ANSWER_NOT_READY']);
    $data=json_decode((string)file_get_contents($path),true);
    if (!is_array($data)||($data['status']??'')!=='approved'
        ||($data['question_id']??'')!==$q
        ||($data['calculation_version']??'')!=='time-digit-sum-v1'
        ||!is_string($data['answers'][(string)$sum]??null))
        ynReply(503,['ok'=>false,'error'=>'ANSWER_UNAVAILABLE']);
    // Atomic database claim: concurrent tabs cannot obtain two distinct free answers.
    $paidAnswer=naCatalogHasAccess($db,$account,'yesno_question','yesno:'.$q.':'.$clock);
    if (!$member && !$paidAnswer) {
        $stmt=$db->prepare('INSERT IGNORE INTO numi_yesno_daily_uses(account_id,use_day,question_id,question_time) VALUES(?,?,?,?)');
        $stmt->execute([$id,$day,$q,$clock]);
        if ($stmt->rowCount()!==1) {
            $used=ynUsed($db,$id,$day);
            // Replaying the exact answer after a network interruption is free.
            if (!$used || $used['question_id']!==$q || $used['question_time']!==$clock)
                ynReply(429,['ok'=>false,'error'=>'DAILY_LIMIT_REACHED','remaining'=>0]);
        }
    }
    ynReply(200,['ok'=>true,'question_id'=>$q,'answer'=>$data['answers'][(string)$sum],
        'subscribed'=>$member,'remaining'=>$member ? null : 0]);
} catch (Throwable $error) {
    error_log('NUMI_YESNO_ACCESS:'.get_class($error));
    ynReply(503,['ok'=>false,'error'=>'ACCESS_UNAVAILABLE']);
}
