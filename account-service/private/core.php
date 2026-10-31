<?php
declare(strict_types=1);

/**
 * First-party account service. Lives OUTSIDE public webroot on REG.RU.
 * No password secrets, session bearer values or personal records in source control.
 * Payments are never accepted or marked paid from this endpoint.
 */
const NUMI_ACCOUNT_COOKIE = '__Host-numi_session';
const NUMI_ACCOUNT_ORIGIN = 'https://xn--c1adkkdfjbp1a4l.online';

function naReply(int $status, array $body): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
function naHeaders(): void {
    header('Cache-Control: no-store, private, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    if (!$https && !defined('NUMI_ACCOUNT_LOCAL_TEST')) {
        naReply(426, ['ok'=>false,'error'=>'HTTPS_REQUIRED']);
    }
}
function naDB(): PDO {
    require_once dirname(__DIR__).'/db.php';
    if (!function_exists('getDB')) throw new RuntimeException('DATABASE_UNAVAILABLE');
    $db = getDB();
    if (!$db instanceof PDO) throw new RuntimeException('DATABASE_UNAVAILABLE');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $db;
}
function naUuid(): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex,0,8).'-'.substr($hex,8,4).'-'.substr($hex,12,4).'-'.substr($hex,16,4).'-'.substr($hex,20);
}
function naToken(int $bytes=32): string {
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}
function naEmail(mixed $value): ?string {
    if (!is_string($value) || strlen($value)>191) return null;
    $email = strtolower(trim($value));
    return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
}
function naPassword(mixed $password): bool {
    return is_string($password) && strlen($password)>=1 && strlen($password)<=200;
}
function naCookies(string $raw, int $until): void {
    setcookie(NUMI_ACCOUNT_COOKIE, $raw, [
        'expires'=>$until, 'path'=>'/', 'secure'=>true, 'httponly'=>true, 'samesite'=>'Lax'
    ]);
}
function naUser(PDO $db, string $id): ?array {
    $stmt=$db->prepare('SELECT id,email,display_name,birth_date,email_verified_at FROM numi_accounts WHERE id=? LIMIT 1');
    $stmt->execute([$id]);
    $row=$stmt->fetch();
    return $row ?: null;
}
function naPublicAccount(array $account): array {
    return [
        'id'=>$account['id'],
        'name'=>$account['display_name'],
        'email'=>$account['email_verified_at'] ? $account['email'] : null,
        'email_verified'=>(bool)$account['email_verified_at'],
        'birth_date'=>$account['birth_date'],
    ];
}
function naCurrent(PDO $db): ?array {
    $raw=$_COOKIE[NUMI_ACCOUNT_COOKIE]??'';
    if (!is_string($raw) || !preg_match('/^[A-Za-z0-9_-]{43}$/D',$raw)) return null;
    $stmt=$db->prepare('SELECT a.id,a.email,a.display_name,a.birth_date,a.email_verified_at
        FROM numi_sessions s JOIN numi_accounts a ON a.id=s.account_id
        WHERE s.session_hash=? AND s.expires_at>UTC_TIMESTAMP() LIMIT 1');
    $stmt->execute([hash('sha256',$raw)]);
    $row=$stmt->fetch();
    return $row?:null;
}
function naSignIn(PDO $db, string $id): void {
    $raw=naToken();
    $hash=hash('sha256',$raw);
    $stmt=$db->prepare('INSERT INTO numi_sessions(session_hash,account_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY))');
    $stmt->execute([$hash,$id]);
    naCookies($raw,time()+30*86400);
}
function naSignOut(PDO $db): void {
    $raw=$_COOKIE[NUMI_ACCOUNT_COOKIE]??'';
    if (is_string($raw) && preg_match('/^[A-Za-z0-9_-]{43}$/D',$raw)) {
        $stmt=$db->prepare('DELETE FROM numi_sessions WHERE session_hash=?');
        $stmt->execute([hash('sha256',$raw)]);
    }
    naCookies('',time()-3600);
}
function naBucket(string $email): string {
    $ip=(string)($_SERVER['REMOTE_ADDR']??'0');
    return hash('sha256',$ip.'|'.$email.'|numi-auth-v1');
}
function naRate(PDO $db, string $email, bool $record=false): void {
    // Both per-address and per-network limits: rotating recipient emails
    // must not permit registration or password-reset mail floods.
    $recipient=naBucket($email);
    $network=naBucket('*');
    $db->exec('DELETE FROM numi_auth_attempts WHERE created_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 20 MINUTE)');
    $stmt=$db->prepare('SELECT bucket_hash,COUNT(*) AS attempts FROM numi_auth_attempts
        WHERE bucket_hash IN (?,?) AND created_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE)
        GROUP BY bucket_hash');
    $stmt->execute([$recipient,$network]);
    foreach ($stmt->fetchAll() as $row) {
        if (($row['bucket_hash']===$recipient && (int)$row['attempts']>=7)
            || ($row['bucket_hash']===$network && (int)$row['attempts']>=30)) {
            naReply(429,['ok'=>false,'error'=>'TOO_MANY_ATTEMPTS']);
        }
    }
    if ($record) {
        $stmt=$db->prepare('INSERT INTO numi_auth_attempts(bucket_hash) VALUES(?)');
        $stmt->execute([$recipient]);
        $stmt->execute([$network]);
    }
}
function naNewToken(PDO $db, string $id, string $purpose, int $minutes): string {
    $db->prepare('DELETE FROM numi_tokens WHERE account_id=? AND purpose=?')->execute([$id,$purpose]);
    $raw=naToken();
    $stmt=$db->prepare('INSERT INTO numi_tokens(token_hash,account_id,purpose,expires_at)
        VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL '.(int)$minutes.' MINUTE))');
    $stmt->execute([hash('sha256',$raw),$id,$purpose]);
    return $raw;
}
function naMail(string $email,string $title,string $message): bool {
    $subject='=?UTF-8?B?'.base64_encode($title).'?=';
    $headers=[
        'From: Numerologia Online <no-reply@xn--c1adkkdfjbp1a4l.online>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ];
    return @mail($email,$subject,$message,implode("\r\n",$headers));
}
function naSendVerify(PDO $db, string $id,string $email): bool {
    $token=naNewToken($db,$id,'verify_email',60*24);
    $url=NUMI_ACCOUNT_ORIGIN.'/api/numi-account.php?verify='.rawurlencode($token);
    $message="Подтвердите адрес для личного кабинета Нумерология онлайн:\n\n".$url.
        "\n\nСсылка действует 24 часа. Если вы не регистрировались, проигнорируйте письмо.";
    $sent=naMail($email,'Подтверждение почты - Нумерология онлайн',$message);
    if (!$sent) $db->prepare('DELETE FROM numi_tokens WHERE token_hash=?')->execute([hash('sha256',$token)]);
    return $sent;
}
function naVerifyLink(PDO $db, string $raw): never {
    if (!preg_match('/^[A-Za-z0-9_-]{43}$/D',$raw)) naReply(400,['ok'=>false,'error'=>'INVALID_LINK']);
    $hash=hash('sha256',$raw);
    $db->beginTransaction();
    try {
        $stmt=$db->prepare('SELECT account_id FROM numi_tokens WHERE token_hash=? AND purpose=? AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE');
        $stmt->execute([$hash,'verify_email']);
        $id=$stmt->fetchColumn();
        if (!$id) { $db->rollBack(); naReply(400,['ok'=>false,'error'=>'INVALID_OR_EXPIRED_LINK']); }
        $db->prepare('UPDATE numi_accounts SET email_verified_at=UTC_TIMESTAMP() WHERE id=? AND email IS NOT NULL')->execute([$id]);
        $db->prepare('UPDATE numi_tokens SET consumed_at=UTC_TIMESTAMP() WHERE token_hash=?')->execute([$hash]);
        $db->commit();
        naSignOut($db);
        naSignIn($db,(string)$id);
        header('Location: /?account_verified=1',true,303);
        exit;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}
function naReadPost(): array {
    if (($_SERVER['REQUEST_METHOD']??'')!=='POST') naReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    $origin=(string)($_SERVER['HTTP_ORIGIN']??'');
    if (!in_array($origin,[NUMI_ACCOUNT_ORIGIN,'https://www.xn--c1adkkdfjbp1a4l.online'],true) && !defined('NUMI_ACCOUNT_LOCAL_TEST')) {
        naReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
    }
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>8192) naReply(413,['ok'=>false,'error'=>'TOO_LARGE']);
    if (!str_starts_with(strtolower((string)($_SERVER['CONTENT_TYPE']??'')),'application/json')) {
        naReply(415,['ok'=>false,'error'=>'JSON_REQUIRED']);
    }
    $raw=file_get_contents('php://input',false,null,0,8193);
    if (!is_string($raw)||strlen($raw)>8192) naReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    $body=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
    if (!is_array($body)||array_is_list($body)) naReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    return $body;
}
function naTelegramUser(string $signed): ?array {
    if (!$signed) return null;
    require_once dirname(__DIR__).'/numi-content-reg-20261031/core.php';
    $config=numiConfig();
    return numiTelegramUser($signed,numiBotToken($config));
}
function naByIdentity(PDO $db, string $provider,string $external): ?array {
    $stmt=$db->prepare('SELECT a.id,a.email,a.display_name,a.birth_date,a.email_verified_at
        FROM numi_identities i JOIN numi_accounts a ON a.id=i.account_id
        WHERE i.provider=? AND i.provider_user_id=? LIMIT 1');
    $stmt->execute([$provider,$external]);
    return $stmt->fetch() ?: null;
}
function naTelegram(PDO $db,array $body,bool $link=false): never {
    $signed=$body['init_data']??'';
    if (!is_string($signed)||!$signed) naReply(401,['ok'=>false,'error'=>'TELEGRAM_REQUIRED']);
    $telegram=naTelegramUser($signed);
    if (!$telegram || empty($telegram['id'])) naReply(401,['ok'=>false,'error'=>'TELEGRAM_INVALID']);
    $id=(string)$telegram['id'];
    $existing=naByIdentity($db,'telegram',$id);
    if ($link) {
        $session=naCurrent($db);
        if (!$session) naReply(401,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
        if ($existing && $existing['id']!==$session['id']) naReply(409,['ok'=>false,'error'=>'IDENTITY_ALREADY_LINKED']);
        if (!$existing) {
            $stmt=$db->prepare('INSERT INTO numi_identities(provider,provider_user_id,account_id) VALUES(?,?,?)');
            $stmt->execute(['telegram',$id,$session['id']]);
        }
        naReply(200,['ok'=>true,'account'=>naPublicAccount($session),'linked'=>'telegram']);
    }
    if (!$existing) {
        $accountId=naUuid();
        $db->beginTransaction();
        try {
            $db->prepare('INSERT INTO numi_accounts(id,display_name) VALUES(?,?)')
                ->execute([$accountId,substr((string)$telegram['name'],0,80)]);
            $db->prepare('INSERT INTO numi_identities(provider,provider_user_id,account_id) VALUES(?,?,?)')
                ->execute(['telegram',$id,$accountId]);
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            $existing=naByIdentity($db,'telegram',$id);
            if (!$existing) throw $e;
        }
        $existing ??= naUser($db,$accountId);
    }
    naSignOut($db);
    naSignIn($db,$existing['id']);
    naReply(200,['ok'=>true,'authenticated'=>true,'account'=>naPublicAccount($existing)]);
}
function naRegister(PDO $db,array $body): never {
    $email=naEmail($body['email']??null);
    $password=$body['password']??null;
    if (!$email||!naPassword($password)) naReply(400,['ok'=>false,'error'=>'INVALID_EMAIL_OR_PASSWORD']);
    naRate($db,$email,true);
    $stmt=$db->prepare('SELECT id,email_verified_at FROM numi_accounts WHERE email=? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetch()) naReply(409,['ok'=>false,'error'=>'EMAIL_ALREADY_REGISTERED']);
    $id=naUuid();
    try {
        $stmt=$db->prepare('INSERT INTO numi_accounts(id,email,password_hash,display_name) VALUES(?,?,?,?)');
        $stmt->execute([$id,$email,password_hash($password,PASSWORD_DEFAULT),'Пользователь']);
    } catch (PDOException $e) {
        if ((string)$e->getCode()==='23000') naReply(409,['ok'=>false,'error'=>'EMAIL_ALREADY_REGISTERED']);
        throw $e;
    }
    if (!naSendVerify($db,$id,$email)) naReply(503,['ok'=>false,'error'=>'EMAIL_DELIVERY_UNAVAILABLE']);
    naReply(200,['ok'=>true,'confirmation_required'=>true]);
}
function naLogin(PDO $db,array $body): never {
    $email=naEmail($body['email']??null);
    $password=$body['password']??null;
    if (!$email||!is_string($password)||strlen($password)>500) naReply(400,['ok'=>false,'error'=>'INVALID_CREDENTIALS']);
    naRate($db,$email);
    $stmt=$db->prepare('SELECT id,password_hash,email_verified_at FROM numi_accounts WHERE email=? LIMIT 1');
    $stmt->execute([$email]);
    $row=$stmt->fetch();
    if (!$row||!is_string($row['password_hash'])||!password_verify($password,$row['password_hash'])) {
        naRate($db,$email,true);
        naReply(401,['ok'=>false,'error'=>'INVALID_CREDENTIALS']);
    }
    if (!$row['email_verified_at']) naReply(403,['ok'=>false,'error'=>'EMAIL_NOT_VERIFIED']);
    if (password_needs_rehash($row['password_hash'],PASSWORD_DEFAULT)) {
        $db->prepare('UPDATE numi_accounts SET password_hash=? WHERE id=?')->execute([password_hash($password,PASSWORD_DEFAULT),$row['id']]);
    }
    naSignOut($db);
    naSignIn($db,$row['id']);
    naReply(200,['ok'=>true,'authenticated'=>true,'account'=>naPublicAccount(naUser($db,$row['id']))]);
}
function naResetRequest(PDO $db,array $body): never {
    $email=naEmail($body['email']??null);
    if (!$email) naReply(400,['ok'=>false,'error'=>'INVALID_EMAIL']);
    naRate($db,$email,true);
    $stmt=$db->prepare('SELECT id FROM numi_accounts WHERE email=? AND email_verified_at IS NOT NULL LIMIT 1');
    $stmt->execute([$email]);
    $id=$stmt->fetchColumn();
    if ($id) {
        $raw=naNewToken($db,(string)$id,'reset_password',30);
        $url=NUMI_ACCOUNT_ORIGIN.'/?reset_token='.rawurlencode($raw);
        $body="Восстановление доступа к Нумерологии онлайн:\n\n".$url.
            "\n\nСсылка действует 30 минут и используется один раз.\nЕсли вы не запрашивали восстановление, проигнорируйте письмо.";
        if (!naMail($email,'Восстановление пароля - Нумерология онлайн',$body)) {
            $db->prepare('DELETE FROM numi_tokens WHERE token_hash=?')->execute([hash('sha256',$raw)]);
        }
    }
    naReply(200,['ok'=>true,'message'=>'IF_ACCOUNT_EXISTS_EMAIL_SENT']);
}
function naResetPassword(PDO $db,array $body): never {
    $raw=$body['token']??'';
    $password=$body['password']??null;
    if (!is_string($raw)||!preg_match('/^[A-Za-z0-9_-]{43}$/D',$raw)||!naPassword($password)) {
        naReply(400,['ok'=>false,'error'=>'INVALID_RESET_REQUEST']);
    }
    $db->beginTransaction();
    try {
        $stmt=$db->prepare('SELECT account_id FROM numi_tokens WHERE token_hash=? AND purpose=? AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE');
        $stmt->execute([hash('sha256',$raw),'reset_password']);
        $id=$stmt->fetchColumn();
        if (!$id) { $db->rollBack(); naReply(400,['ok'=>false,'error'=>'INVALID_OR_EXPIRED_LINK']); }
        $db->prepare('UPDATE numi_accounts SET password_hash=? WHERE id=?')->execute([password_hash($password,PASSWORD_DEFAULT),$id]);
        $db->prepare('DELETE FROM numi_sessions WHERE account_id=?')->execute([$id]);
        $db->prepare('UPDATE numi_tokens SET consumed_at=UTC_TIMESTAMP() WHERE token_hash=?')->execute([hash('sha256',$raw)]);
        $db->commit();
        naCookies('',time()-3600);
        naReply(200,['ok'=>true,'password_changed'=>true]);
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}
function naEmailForTelegram(PDO $db,array $body): never {
    $current=naCurrent($db);
    if (!$current) naReply(401,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
    $email=naEmail($body['email']??null);
    $password=$body['password']??null;
    if (!$email||!naPassword($password)) naReply(400,['ok'=>false,'error'=>'INVALID_EMAIL_OR_PASSWORD']);
    if ($current['email_verified_at']) naReply(409,['ok'=>false,'error'=>'EMAIL_ALREADY_VERIFIED']);
    $stmt=$db->prepare('SELECT 1 FROM numi_identities WHERE account_id=? AND provider=? LIMIT 1');
    $stmt->execute([$current['id'],'telegram']);
    if (!$stmt->fetchColumn()) naReply(403,['ok'=>false,'error'=>'TELEGRAM_ACCOUNT_REQUIRED']);
    try {
        $db->prepare('UPDATE numi_accounts SET email=?,password_hash=?,email_verified_at=NULL WHERE id=?')
            ->execute([$email,password_hash($password,PASSWORD_DEFAULT),$current['id']]);
    } catch (PDOException $e) {
        if ((string)$e->getCode()==='23000') naReply(409,['ok'=>false,'error'=>'EMAIL_ALREADY_REGISTERED']);
        throw $e;
    }
    if (!naSendVerify($db,$current['id'],$email)) naReply(503,['ok'=>false,'error'=>'EMAIL_DELIVERY_UNAVAILABLE']);
    naReply(200,['ok'=>true,'confirmation_required'=>true]);
}
/**
 * Link a verified email login with a freshly signed Telegram identity.
 * Email/password proves the email account; verified Telegram initData proves Telegram.
 * Orders and entitlements retain their rows and payment verification metadata.
 */
function naMergeTelegramEmail(PDO $db,array $body): never {
    $email=naEmail($body['email']??null);
    $password=$body['password']??null;
    $signed=$body['init_data']??null;
    if (!$email||!is_string($password)||strlen($password)>500||!is_string($signed)||!$signed) {
        naReply(400,['ok'=>false,'error'=>'INVALID_CREDENTIALS']);
    }
    naRate($db,$email);
    $telegram=naTelegramUser($signed);
    if (!$telegram||empty($telegram['id'])) naReply(401,['ok'=>false,'error'=>'TELEGRAM_INVALID']);
    $stmt=$db->prepare('SELECT id,password_hash,email_verified_at FROM numi_accounts WHERE email=? LIMIT 1');
    $stmt->execute([$email]);
    $target=$stmt->fetch();
    if (!$target||!is_string($target['password_hash'])||!password_verify($password,$target['password_hash'])) {
        naRate($db,$email,true);
        naReply(401,['ok'=>false,'error'=>'INVALID_CREDENTIALS']);
    }
    if (!$target['email_verified_at']) naReply(403,['ok'=>false,'error'=>'EMAIL_NOT_VERIFIED']);
    $tgId=(string)$telegram['id'];
    $targetId=(string)$target['id'];
    $db->beginTransaction();
    try {
        // Lock the identity row: concurrent merges cannot silently overwrite each other.
        $stmt=$db->prepare('SELECT account_id FROM numi_identities WHERE provider=? AND provider_user_id=? FOR UPDATE');
        $stmt->execute(['telegram',$tgId]);
        $fromId=$stmt->fetchColumn();
        $fromId=$fromId===false?null:(string)$fromId;
        if ($fromId!==null && $fromId!==$targetId) {
            $stmt=$db->prepare('SELECT id,email,email_verified_at,birth_date FROM numi_accounts WHERE id=? FOR UPDATE');
            $stmt->execute([$fromId]);
            $from=$stmt->fetch();
            if (!$from) throw new RuntimeException('SOURCE_ACCOUNT_MISSING');
            // Never silently merge another email identity or a pending email setup.
            if ($from['email']!==null) {
                $db->rollBack();
                naReply(409,['ok'=>false,'error'=>'TELEGRAM_EMAIL_CONFLICT']);
            }
            $other=$db->prepare('SELECT COUNT(*) FROM numi_identities WHERE account_id=? AND NOT (provider=? AND provider_user_id=?)');
            $other->execute([$fromId,'telegram',$tgId]);
            if ((int)$other->fetchColumn()>0) {
                $db->rollBack();
                naReply(409,['ok'=>false,'error'=>'TELEGRAM_EMAIL_CONFLICT']);
            }
            $db->prepare('UPDATE numi_orders SET account_id=? WHERE account_id=?')->execute([$targetId,$fromId]);
            $db->prepare('UPDATE numi_entitlements SET account_id=? WHERE account_id=?')->execute([$targetId,$fromId]);
            $db->prepare('UPDATE numi_identities SET account_id=? WHERE provider=? AND provider_user_id=? AND account_id=?')
                ->execute([$targetId,'telegram',$tgId,$fromId]);
            $db->prepare('UPDATE numi_accounts SET birth_date=COALESCE(birth_date,?) WHERE id=?')
                ->execute([$from['birth_date'],$targetId]);
            // Invalidate abandoned credentials and tokens; preserve rows/orders for audit.
            $db->prepare('DELETE FROM numi_sessions WHERE account_id=?')->execute([$fromId]);
            $db->prepare('DELETE FROM numi_tokens WHERE account_id=?')->execute([$fromId]);
        } elseif ($fromId===null) {
            $db->prepare('INSERT INTO numi_identities(provider,provider_user_id,account_id) VALUES(?,?,?)')
                ->execute(['telegram',$tgId,$targetId]);
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        if ($e instanceof PDOException && (string)$e->getCode()==='23000') {
            naReply(409,['ok'=>false,'error'=>'IDENTITY_ALREADY_LINKED']);
        }
        throw $e;
    }
    naSignOut($db);
    naSignIn($db,$targetId);
    naReply(200,['ok'=>true,'authenticated'=>true,'linked'=>'telegram',
        'account'=>naPublicAccount(naUser($db,$targetId))]);
}
function naResend(PDO $db,array $body): never {
    $email=naEmail($body['email']??null);
    if (!$email) naReply(400,['ok'=>false,'error'=>'INVALID_EMAIL']);
    naRate($db,$email,true);
    $stmt=$db->prepare('SELECT id FROM numi_accounts WHERE email=? AND email_verified_at IS NULL LIMIT 1');
    $stmt->execute([$email]);
    if ($id=$stmt->fetchColumn()) naSendVerify($db,(string)$id,$email);
    naReply(200,['ok'=>true,'message'=>'IF_ACCOUNT_EXISTS_EMAIL_SENT']);
}
function naSaveBirth(PDO $db,array $body): never {
    $account=naCurrent($db);
    if (!$account) naReply(401,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
    $birth=$body['birth_date']??null;
    if ($birth!==null) {
        if (!is_string($birth)||!preg_match('/^(\d{4})-(\d\d)-(\d\d)$/D',$birth,$m)
            || !checkdate((int)$m[2],(int)$m[3],(int)$m[1])
            || (int)$m[1]<1900||$birth>gmdate('Y-m-d')) {
            naReply(400,['ok'=>false,'error'=>'INVALID_BIRTH_DATE']);
        }
    }
    $db->prepare('UPDATE numi_accounts SET birth_date=? WHERE id=?')->execute([$birth,$account['id']]);
    naReply(200,['ok'=>true,'account'=>naPublicAccount(naUser($db,$account['id']))]);
}
/**
 * Owner-only checkout rehearsal: entirely separate from numi_orders/entitlements.
 * Never grants access to paid content and never represents a real payment.
 */
function naTestOwner(?array $account): bool {
    return $account !== null && !empty($account['email_verified_at'])
        && is_string($account['email']??null)
        && hash_equals('f289c5906895cbbd1b42d74e4e2e07d531fc1af4e91bcf7e5700835856003d29', hash('sha256', strtolower($account['email'])));
}
function naEnsureTestOrders(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS numi_test_purchases (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      product_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      resource_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      title VARCHAR(180) NOT NULL,
      test_answer TEXT NOT NULL,
      hidden_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY ix_numi_test_purchases_account(account_id,hidden_at,created_at),
      CONSTRAINT fk_numi_test_purchases_owner FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function naTestPurchase(PDO $db,array $body): never {
    $owner=naCurrent($db);
    if (!naTestOwner($owner)) naReply(403,['ok'=>false,'error'=>'TEST_NOT_ENABLED']);
    $kind=$body['kind']??null;
    $items=[
      'redflag'=>['Мужчина или Red Flag: пишет первым?','redflag'],
      'moment'=>['Нумерология момента: получится ли задуманное?','moment'],
      'year'=>['Полный разбор года','year'],
    ];
    if (!is_string($kind)||!isset($items[$kind])) naReply(400,['ok'=>false,'error'=>'INVALID_TEST_PRODUCT']);
    [$title,$code]=$items[$kind];
    $date=$body['birth_date']??'';
    if (!is_string($date)||!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/D',$date)) naReply(400,['ok'=>false,'error'=>'INVALID_TEST_DATE']);
    [$year,$month,$day]=array_map('intval',explode('-',$date));
    if (!checkdate($month,$day,$year)||$year<1900||$year>2100) naReply(400,['ok'=>false,'error'=>'INVALID_TEST_DATE']);
    naEnsureTestOrders($db);
    $resource=$kind.':'.$date;
    // Idempotency: repeated checkout for the same question/date never adds a duplicate.
    $stmt=$db->prepare("SELECT id FROM numi_test_purchases
        WHERE account_id=? AND product_code=? AND resource_id=? AND hidden_at IS NULL LIMIT 1");
    $stmt->execute([$owner['id'],$code,$resource]);
    $existing=$stmt->fetchColumn();
    if ($existing) naReply(200,['ok'=>true,'test'=>true,'already_exists'=>true]);
    $id=naUuid();
    $answer='Демонстрационный ответ. Это проверка сохранения, повторного открытия и удаления. Реальный платный текст и право доступа не выдаются.';
    $stmt=$db->prepare('INSERT INTO numi_test_purchases(id,account_id,product_code,resource_id,title,test_answer) VALUES(?,?,?,?,?,?)');
    $stmt->execute([$id,$owner['id'],$code,$resource,$title,$answer]);
    naReply(200,['ok'=>true,'test'=>true,'created'=>true]);
}
function naTestHide(PDO $db,string $id): never {
    $owner=naCurrent($db);
    if (!naTestOwner($owner)) naReply(403,['ok'=>false,'error'=>'TEST_NOT_ENABLED']);
    $uuid=substr($id,5);
    if (!preg_match('/^[a-f0-9-]{36}$/iD',$uuid)) naReply(400,['ok'=>false,'error'=>'INVALID_SAVED_ITEM']);
    naEnsureTestOrders($db);
    $stmt=$db->prepare('UPDATE numi_test_purchases SET hidden_at=UTC_TIMESTAMP() WHERE id=? AND account_id=? AND hidden_at IS NULL');
    $stmt->execute([$uuid,$owner['id']]);
    if ($stmt->rowCount()!==1) naReply(404,['ok'=>false,'error'=>'SAVED_ITEM_NOT_FOUND']);
    naReply(200,['ok'=>true,'hidden'=>true,'test'=>true]);
}
/**
 * Saved-item visibility is deliberately independent from payment rights.
 * This table contains only a reference and a hiding timestamp. Never update
 * numi_orders, numi_entitlements or payment status when hiding an item.
 */
function naEnsureSavedHidden(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS numi_saved_hidden (
        entitlement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
        hidden_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_numi_saved_hidden_entitlement FOREIGN KEY (entitlement_id)
            REFERENCES numi_entitlements(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function naHideSaved(PDO $db,array $body): never {
    $account=naCurrent($db);
    if (!$account) naReply(401,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
    $id=$body['entitlement_id']??null;
    if (is_string($id) && str_starts_with($id,'test:')) naTestHide($db,$id);
    if (!is_string($id) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iD',$id)) {
        naReply(400,['ok'=>false,'error'=>'INVALID_SAVED_ITEM']);
    }
    naEnsureSavedHidden($db);
    $db->beginTransaction();
    try {
        $stmt=$db->prepare("SELECT e.id FROM numi_entitlements e
            JOIN numi_orders o ON o.id=e.order_id
            WHERE e.id=? AND e.account_id=? AND e.status='active'
              AND o.status='paid' AND o.verified_at IS NOT NULL
            FOR UPDATE");
        $stmt->execute([$id,$account['id']]);
        if (!$stmt->fetchColumn()) {
            $db->rollBack();
            naReply(404,['ok'=>false,'error'=>'SAVED_ITEM_NOT_FOUND']);
        }
        $db->prepare('INSERT IGNORE INTO numi_saved_hidden(entitlement_id) VALUES(?)')->execute([$id]);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
    naReply(200,['ok'=>true,'hidden'=>true]);
}
function naPurchases(PDO $db): never {
    $account=naCurrent($db);
    if (!$account) naReply(401,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
    naEnsureSavedHidden($db);
    $testOwner=naTestOwner($account);
    $testPurchases=[];
    if ($testOwner) {
        naEnsureTestOrders($db);
        $tests=$db->prepare('SELECT id,product_code,resource_id,title,test_answer,created_at FROM numi_test_purchases WHERE account_id=? AND hidden_at IS NULL ORDER BY created_at DESC LIMIT 100');
        $tests->execute([$account['id']]);
        foreach ($tests->fetchAll() as $t) {
            $testPurchases[]=[
                'entitlement_id'=>'test:'.$t['id'],'product_code'=>$t['title'],
                'resource_id'=>$t['resource_id'],'created_at'=>$t['created_at'],
                'is_test'=>true,'test_answer'=>$t['test_answer']
            ];
        }
    }
    $stmt=$db->prepare("SELECT e.id AS entitlement_id,e.product_code,e.resource_id,e.expires_at,e.created_at
        FROM numi_entitlements e JOIN numi_orders o ON o.id=e.order_id
        LEFT JOIN numi_saved_hidden h ON h.entitlement_id=e.id
        WHERE e.account_id=? AND e.status='active' AND o.status='paid' AND o.verified_at IS NOT NULL
            AND h.entitlement_id IS NULL
            AND (e.expires_at IS NULL OR e.expires_at>UTC_TIMESTAMP())
        ORDER BY e.created_at DESC LIMIT 100");
    $stmt->execute([$account['id']]);
    naReply(200,['ok'=>true,'purchases'=>array_merge($testPurchases,$stmt->fetchAll()),'test_enabled'=>$testOwner,'account'=>naPublicAccount($account)]);
}
function naServe(): never {
    naHeaders();
    try {
        $db=naDB();
        if (($_SERVER['REQUEST_METHOD']??'')==='GET' && isset($_GET['verify'])) {
            if (!is_string($_GET['verify'])) naReply(400,['ok'=>false,'error'=>'INVALID_LINK']);
            naVerifyLink($db,$_GET['verify']);
        }
        if (($_SERVER['REQUEST_METHOD']??'')==='GET') {
            naReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
        }
        $body=naReadPost();
        $action=$body['action']??'';
        if (!is_string($action)) naReply(400,['ok'=>false,'error'=>'INVALID_ACTION']);
        if ($action==='health') naReply(200,['ok'=>true,'service'=>'numi-account','database'=>true]);
        if ($action==='session') {
            $current=naCurrent($db);
            naReply(200,['ok'=>true,'authenticated'=>(bool)$current,'account'=>$current?naPublicAccount($current):null]);
        }
        if ($action==='register') naRegister($db,$body);
        if ($action==='login') naLogin($db,$body);
        if ($action==='resend') naResend($db,$body);
        if ($action==='request_reset') naResetRequest($db,$body);
        if ($action==='reset_password') naResetPassword($db,$body);
        if ($action==='telegram') naTelegram($db,$body,false);
        if ($action==='link_telegram') naTelegram($db,$body,true);
        if ($action==='merge_telegram_email') naMergeTelegramEmail($db,$body);
        if ($action==='set_email') naEmailForTelegram($db,$body);
        if ($action==='birth') naSaveBirth($db,$body);
        if ($action==='purchases') naPurchases($db);
        if ($action==='test_purchase') naTestPurchase($db,$body);
        if ($action==='hide_saved') naHideSaved($db,$body);
        if ($action==='logout') {
            naSignOut($db);
            naReply(200,['ok'=>true,'authenticated'=>false]);
        }
        naReply(400,['ok'=>false,'error'=>'UNKNOWN_ACTION']);
    } catch (JsonException|InvalidArgumentException $e) {
        naReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
    } catch (Throwable $e) {
        error_log('NUMI_ACCOUNT_SERVER:'.get_class($e));
        naReply(503,['ok'=>false,'error'=>'ACCOUNT_TEMPORARILY_UNAVAILABLE']);
    }
}
