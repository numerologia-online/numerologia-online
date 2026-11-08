<?php
declare(strict_types=1);

/**
 * First-party account service. Lives OUTSIDE public webroot on REG.RU.
 * No password secrets, session bearer values or personal records in source control.
 * Payments are never accepted or marked paid from this endpoint.
 */
const NUMI_ACCOUNT_COOKIE = '__Host-numi_session';
const NUMI_ACCOUNT_ORIGIN = 'https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai';

// Restrict account mutations to the two genuine storefront domains.
function naAllowedOrigins(): array {
    return [
        NUMI_ACCOUNT_ORIGIN,
        'https://www.xn----8sbhhqijddjgdebdz2c2o.xn--p1ai',
    ];
}

/**
 * All access to REAL material and membership must switch together with the
 * private wallet. A key merely existing in REG.RU does NOT enable this mode.
 */
function naLiveWalletModeSelected(): bool {
    static $selected=null;
    if($selected!==null)return $selected;
    $path=dirname(__DIR__).'/numi-wallet-live/config.local.php';
    if(!is_file($path))return $selected=false;
    $config=require $path;
    return $selected=is_array($config)&&($config['wallet_mode']??null)==='live';
}

// Verification/reset links return to the domain where the request began.
function naPublicOrigin(): string {
    $origin = strtolower((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    return in_array($origin, naAllowedOrigins(), true) ? $origin : NUMI_ACCOUNT_ORIGIN;
}

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
function naHasLinkedTelegram(PDO $db,string $accountId): bool {
    $query=$db->prepare('SELECT 1 FROM numi_identities WHERE account_id=? AND provider=? LIMIT 1');
    $query->execute([$accountId,'telegram']);
    return (bool)$query->fetchColumn();
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
    $url=naPublicOrigin().'/api/numi-account.php?verify='.rawurlencode($token);
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
    if (!in_array($origin, naAllowedOrigins(), true) && !defined('NUMI_ACCOUNT_LOCAL_TEST')) {
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
        $url=naPublicOrigin().'/?reset_token='.rawurlencode($raw);
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
    // CREATE/ALTER TABLE must be completed BEFORE an atomic identity/money transfer.
    require_once __DIR__.'/wallet.php';
    naStoreSchema($db);
    naWalletSchema($db);
    // Production wallet schema is migrated separately, never inside a login.
    // Require the live merge helper before moving any financial identifiers.
    if(naLiveWalletModeSelected())require_once __DIR__.'/wallet-real.php';
    $db->beginTransaction();
    try {
        // Lock the identity row: concurrent merges cannot silently overwrite each other.
        $stmt=$db->prepare('SELECT account_id FROM numi_identities WHERE provider=? AND provider_user_id=? FOR UPDATE');
        $stmt->execute(['telegram',$tgId]);
        $fromId=$stmt->fetchColumn();
        $fromId=$fromId===false?null:(string)$fromId;
        if ($fromId!==null && $fromId!==$targetId) {
            // The debit path locks account rows; lock both before moving any funds.
            $accounts=$db->prepare('SELECT id FROM numi_accounts WHERE id IN (?,?) ORDER BY id FOR UPDATE');
            $accounts->execute([$fromId,$targetId]);
            if(count($accounts->fetchAll())!==2)throw new RuntimeException('SOURCE_ACCOUNT_MISSING');
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
            $db->prepare('UPDATE numi_checkouts SET account_id=? WHERE account_id=?')->execute([$targetId,$fromId]);
            naSubscriptionMergeAccounts($db,$fromId,$targetId);
            if(naLiveWalletModeSelected())naRealWalletMergeAccounts($db,$fromId,$targetId);
            naWalletMergeAccounts($db,$fromId,$targetId);
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
        $providerOnly=naLiveWalletModeSelected()?" AND o.provider='real_wallet'":"";
        $stmt=$db->prepare("SELECT e.id FROM numi_entitlements e
            JOIN numi_orders o ON o.id=e.order_id
            WHERE e.id=? AND e.account_id=? AND e.status='active'
              AND o.status='paid' AND o.verified_at IS NOT NULL
              $providerOnly
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

/**
 * Read-only, existing-account product registry and exact entitlement check.
 * Does not create orders, charge cards, grant rights or reveal paid content.
 * Canonical quote is server-derived; browser prices are ignored.
 */
function naCatalogDate(mixed $input): ?string {
    if (!is_string($input) || !preg_match('/^(19|20)\d\d-\d\d-\d\d$/D',$input)) return null;
    [$year,$month,$day]=array_map('intval',explode('-',$input));
    return checkdate($month,$day,$year) ? $input : null;
}
function naCatalogHasAccess(PDO $db, ?array $account, string $code, string $resource): bool {
    if ($account===null) return false;
    $providerOnly=naLiveWalletModeSelected()?" AND o.provider='real_wallet'":"";
    $stmt=$db->prepare("SELECT 1 FROM numi_entitlements e
        INNER JOIN numi_orders o ON o.id=e.order_id
        WHERE e.account_id=? AND e.product_code=? AND e.resource_id=?
          AND e.status='active' AND (e.expires_at IS NULL OR e.expires_at>UTC_TIMESTAMP())
          AND o.status='paid' AND o.verified_at IS NOT NULL
          $providerOnly LIMIT 1");
    $stmt->execute([$account['id'],$code,$resource]);
    return (bool)$stmt->fetchColumn();
}
function naCatalogResolve(array $input,bool $club): array {
    $code=$input['product_code']??null;
    if (!is_string($code) || strlen($code)>64) throw new InvalidArgumentException('INVALID_PRODUCT');
    $price=null;
    $resource=null;
    $availability='FULFILLMENT_NOT_CONNECTED';
    $kind='item';
    $memberIncluded=false;
    $date=naCatalogDate($input['birth_date']??null);
    if ($code==='year_full') {
        $year=$input['year']??null;
        if (!is_int($year) || $year<1900 || $year>2050 || $date===null)
            throw new InvalidArgumentException('INVALID_YEAR_SUBJECT');
        $resource='year:'.$year.':'.$date;
        $price=$club?49000:99000;
        $kind='report';
    } elseif ($code==='life_full') {
        if ($date===null) throw new InvalidArgumentException('INVALID_BIRTH_DATE');
        $resource='life:'.$date; $price=$club?49000:99000; $kind='report';
    } elseif ($code==='compatibility_full') {
        $second=naCatalogDate($input['partner_birth_date']??null);
        if ($date===null || $second===null) throw new InvalidArgumentException('INVALID_PAIR');
        $resource='pair:'.$date.':'.$second;
        $price=$club?49000:99000; $kind='report';
    } elseif ($code==='child_full_v1') {
        if ($date===null) throw new InvalidArgumentException('INVALID_CHILD_DATE');
        // Ownership of the specific child must be established before sale.
        $resource='child:'.$date; $price=$club?49000:99000; $kind='report';
    } elseif ($code==='redflag_question') {
        $category=$input['category']??null; $question=$input['question_id']??null;
        if (!is_string($category) || !is_string($question) || $date===null)
            throw new InvalidArgumentException('INVALID_QUESTION_SUBJECT');
        $catalog=json_decode('{"money":{"gift":[10,1,1],"generosity":[10,0,1],"courtship":[10,0,1],"provider":[29,0,0],"words-or-deeds":[29,0,1],"family-load":[29,0,0],"resource":[29,0,1],"solve-or-create":[49,0,1],"responsibility":[49,0,1],"celebration":[49,0,1],"comic-verdict-money":[49,0,0]},"love":{"first-step":[10,1,0],"romance":[10,0,0],"relationship-or-comfort":[10,0,0],"adult-partner":[29,0,0],"near-him":[29,0,0],"hard-moment":[29,0,0],"relationship-format":[29,0,0],"family-or-triangle":[49,0,0],"honest-or-disappear":[49,0,0],"love-or-attention":[49,0,0]},"flags":{"say-no":[10,1,0],"care-or-control":[29,0,0],"hero":[29,0,0],"jealousy":[29,0,0],"argument":[29,0,0],"abuse-signal":[49,0,0],"support-or-cause":[49,0,0],"apology":[49,0,0],"weak-place":[49,0,0],"calm-or-swings":[49,0,0]},"infidelity":{"faithful":[10,1,0],"options":[10,0,0],"flirt":[10,0,0],"trust":[29,0,0],"ex":[29,0,0],"temptation":[29,0,0],"physical-or-emotional":[29,0,0],"secrecy":[49,0,0],"return":[49,0,0],"after-mistake":[49,0,0]},"intimacy":{"fire":[10,1,0],"her-pleasure":[10,0,0],"pace":[10,0,0],"desire-talk":[29,0,0],"tenderness":[29,0,0],"boundaries":[29,0,0],"closeness":[29,0,0],"initiative":[49,0,0],"compatibility":[49,0,0],"after":[49,0,0]},"family":{"independent":[10,1,0],"household":[10,0,0],"vacation":[10,0,0],"plans":[29,0,0],"children":[29,0,0],"roles":[29,0,0],"home":[29,0,0],"conflict":[49,0,0],"money-at-home":[49,0,0],"care":[49,0,0]},"language":{"love-language":[10,1,0],"how-to-talk":[10,0,0],"accept-love":[10,0,0],"show-love":[49,0,0],"criticism":[29,0,0],"ask":[29,0,0],"distance":[29,0,0],"hurt":[49,0,0],"conflict-style":[49,0,0],"compliment":[49,0,0]},"verdict":{"final":[10,1,0],"worth-it":[10,0,0],"beauty-and-flag":[10,0,0],"check":[29,0,0],"main-advice":[29,0,0],"his-need":[29,0,0],"weak-point":[29,0,0],"best-side":[49,0,0],"format":[49,0,0],"bottom-line":[49,0,0]}}',true,16,JSON_THROW_ON_ERROR);
        $meta=$catalog[$category][$question]??null;
        if (!is_array($meta) || count($meta)!==3)
            throw new InvalidArgumentException('UNKNOWN_QUESTION');
        $tier=(int)$meta[0]; $isPreview=(bool)$meta[1]; $isReady=(bool)$meta[2];
        $prices=[10=>[2000,1000],29=>[3900,1900],49=>[7900,3900]];
        $price=$isPreview?0:($club?$prices[$tier][1]:$prices[$tier][0]);
        $resource='redflag:'.$category.':'.$question.':'.$date;
        $kind='question';
        $availability=$isPreview?'FREE_PREVIEW':(
            !$isReady || !in_array($category,['money','love'],true)
             ?'AUTHOR_TEXT_NOT_CONFIRMED':'FULFILLMENT_NOT_CONNECTED');
    } elseif ($code==='yesno_question') {
        $question=$input['question_id']??null;
        $clock=$input['question_time']??null;
        if (!is_string($question)||!in_array($question,explode(',','yn-man-001,yn-man-002,yn-man-003,yn-man-004,yn-man-005,yn-man-006,yn-man-007,yn-man-008,yn-man-009,yn-man-010,yn-man-011,yn-man-012,yn-man-013,yn-man-014,yn-man-015,yn-man-016,yn-man-017,yn-man-018,yn-man-019,yn-man-020,yn-love-001,yn-love-002,yn-love-003,yn-love-004,yn-love-005,yn-love-006,yn-love-007,yn-love-008,yn-love-009,yn-love-010,yn-love-011,yn-love-012,yn-love-013,yn-love-014,yn-love-015,yn-work-001,yn-work-002,yn-work-003,yn-work-004,yn-work-005,yn-work-006,yn-work-007,yn-work-008,yn-work-009,yn-work-010,yn-work-011,yn-work-012,yn-work-013,yn-work-014,yn-work-015,yn-money-001,yn-money-002,yn-money-003,yn-money-004,yn-money-005,yn-money-006,yn-money-007,yn-money-008,yn-money-009,yn-money-010,yn-money-011,yn-money-012,yn-money-013,yn-money-014,yn-money-015,yn-choice-001,yn-choice-002,yn-choice-003,yn-choice-004,yn-choice-005,yn-choice-006,yn-choice-007,yn-choice-008,yn-choice-009,yn-choice-010,yn-choice-011,yn-choice-012,yn-choice-013,yn-choice-014,yn-choice-015,yn-future-001,yn-future-002,yn-future-003,yn-future-004,yn-future-005,yn-future-006,yn-future-007,yn-future-008,yn-future-009,yn-future-010,yn-home-001,yn-home-002,yn-home-003,yn-home-004,yn-home-005,yn-home-006,yn-home-007,yn-home-008,yn-home-009,yn-home-010'),true)
          || !is_string($clock)||!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D',$clock))
          throw new InvalidArgumentException('INVALID_QUESTION_SUBJECT');
        $resource='yesno:'.$question.':'.$clock;
        $price=$club?0:1900;
        $memberIncluded=$club;
        $kind='question';
        $availability='PAID_ANSWER_NOT_CONFIRMED';
    } elseif ($code==='moment_question') {
        $question=$input['question_id']??null;
        $clock=$input['question_time']??null;
        if (!is_string($question)||!in_array($question,explode(',','love-001,love-002,love-003,love-004,love-005,love-006,love-007,love-008,love-009,love-010,love-011,love-012,love-013,love-014,love-015,love-016,love-017,love-018,love-019,love-020,love-021,love-022,love-023,love-024,love-025,men-001,men-002,men-003,men-004,men-005,men-006,men-007,men-008,men-009,men-010,men-011,men-012,men-013,men-014,men-015,men-016,men-017,men-018,men-019,men-020,men-021,men-022,men-023,men-024,men-025,family-001,family-002,family-003,family-004,family-005,family-006,family-007,family-008,family-009,family-010,family-011,family-012,family-013,family-014,family-015,family-016,family-017,family-018,family-019,family-020,family-021,family-022,family-023,family-024,family-025,money-001,money-002,money-003,money-004,money-005,money-006,money-007,money-008,money-009,money-010,money-011,money-012,money-013,money-014,money-015,money-016,money-017,money-018,money-019,money-020,money-021,money-022,money-023,money-024,money-025,work-001,work-002,work-003,work-004,work-005,work-006,work-007,work-008,work-009,work-010,work-011,work-012,work-013,work-014,work-015,work-016,work-017,work-018,work-019,work-020,work-021,work-022,work-023,work-024,work-025,future-001,future-002,future-003,future-004,future-005,future-006,future-007,future-008,future-009,future-010,future-011,future-012,future-013,future-014,future-015,future-016,future-017,future-018,future-019,future-020,future-021,future-022,future-023,future-024,future-025,choice-001,choice-002,choice-003,choice-004,choice-005,choice-006,choice-007,choice-008,choice-009,choice-010,choice-011,choice-012,choice-013,choice-014,choice-015,choice-016,choice-017,choice-018,choice-019,choice-020,choice-021,choice-022,choice-023,choice-024,choice-025,home-001,home-002,home-003,home-004,home-005,home-006,home-007,home-008,home-009,home-010,home-011,home-012,home-013,home-014,home-015,home-016,home-017,home-018,home-019,home-020,home-021,home-022,home-023,home-024,home-025,self-001,self-002,self-003,self-004,self-005,self-006,self-007,self-008,self-009,self-010,self-011,self-012,self-013,self-014,self-015,self-016,self-017,self-018,self-019,self-020,self-021,self-022,self-023,self-024,self-025,friends-001,friends-002,friends-003,friends-004,friends-005,friends-006,friends-007,friends-008,friends-009,friends-010,friends-011,friends-012,friends-013,friends-014,friends-015,friends-016,friends-017,friends-018,friends-019,friends-020,friends-021,friends-022,friends-023,friends-024,friends-025,dates-001,dates-002,dates-003,dates-004,dates-005,dates-006,dates-007,dates-008,dates-009,dates-010,dates-011,dates-012,dates-013,dates-014,dates-015,dates-016,dates-017,dates-018,dates-019,dates-020,dates-021,dates-022,dates-023,dates-024,dates-025,yesno-001,yesno-002,yesno-003,yesno-004,yesno-005,yesno-006,yesno-007,yesno-008,yesno-009,yesno-010,yesno-011,yesno-012,yesno-013,yesno-014,yesno-015,yesno-016,yesno-017,yesno-018,yesno-019,yesno-020,yesno-021,yesno-022,yesno-023,yesno-024,yesno-025'),true)
          || !is_string($clock)||!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D',$clock))
          throw new InvalidArgumentException('INVALID_QUESTION_SUBJECT');
        $resource='moment:'.$question.':'.$clock;
        $price=$club?2500:5000;
        $kind='question';$availability='NOT_LAUNCHED';
    } elseif ($code==='club_month') {
        $resource='club';$price=49000;$kind='subscription';
    } elseif ($code==='school_week') {
        $resource='school';$price=14900;$kind='subscription';
    } elseif ($code==='money_rituals') {
        $resource='club';$price=0;$memberIncluded=$club;
        $kind='club_included';$availability=$club?'CLUB_ACTIVE':'CLUB_REQUIRED';
    } elseif ($code==='wallet_topup') {
        $resource='wallet';$kind='wallet';
        $availability='WALLET_NOT_CONNECTED';
    } else {
        throw new InvalidArgumentException('UNKNOWN_PRODUCT');
    }
    return [
        'product_code'=>$code,'resource_id'=>$resource,'kind'=>$kind,
        'price_kopeks'=>$price,'currency'=>'RUB','club_active'=>$club,
        'member_included'=>$memberIncluded,'availability'=>$availability,
    ];
}
function naCatalogQuote(PDO $db,array $input): never {
    $account=naCurrent($db);
    $club=naCatalogHasAccess($db,$account,'club_month','club');
    try { $quote=naCatalogResolve($input,$club); }
    catch (InvalidArgumentException $e) { naReply(400,['ok'=>false,'error'=>$e->getMessage()]); }
    naReply(200,array_merge($quote,[
        'ok'=>true,'access_active'=>naCatalogHasAccess($db,$account,$quote['product_code'],$quote['resource_id']) || $quote['member_included'],
        'checkout_enabled'=>false,'authenticated'=>$account!==null,
    ]));
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
    $providerOnly=naLiveWalletModeSelected()?" AND o.provider='real_wallet'":"";
    $stmt=$db->prepare("SELECT e.id AS entitlement_id,e.product_code,e.resource_id,e.expires_at,e.created_at
        FROM numi_entitlements e JOIN numi_orders o ON o.id=e.order_id
        LEFT JOIN numi_saved_hidden h ON h.entitlement_id=e.id
        WHERE e.account_id=? AND e.status='active' AND o.status='paid' AND o.verified_at IS NOT NULL
            AND h.entitlement_id IS NULL
            AND (e.expires_at IS NULL OR e.expires_at>UTC_TIMESTAMP())
            $providerOnly
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
        if (($_GET['notification']??'')==='yookassa') {
            require_once __DIR__.'/store.php';
            naStoreNotification($db);
        }
        $body=naReadPost();
        $action=$body['action']??'';
        if (!is_string($action)) naReply(400,['ok'=>false,'error'=>'INVALID_ACTION']);
        if ($action==='health') naReply(200,['ok'=>true,'service'=>'numi-account','database'=>true]);
        if ($action==='session') {
            $current=naCurrent($db);
            naReply(200,['ok'=>true,'authenticated'=>(bool)$current,'account'=>$current?array_merge(naPublicAccount($current),['telegram_linked'=>naHasLinkedTelegram($db,(string)$current['id'])]):null]);
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
        if (in_array($action,['cart_quote','checkout','order_history','order_status','cancel_renewal'],true)) {
            require_once __DIR__.'/store.php';
            naStoreServe($db,$action,$body);
        }
        if (in_array($action,['wallet_status','wallet_quote','wallet_topup','wallet_sync','wallet_buy','subscription_cancel'],true)) {
            require_once __DIR__.'/wallet.php';
            naWalletServe($db,$action,$body);
        }
        if ($action==='material') { require_once __DIR__.'/fulfillment.php';naMaterialServe($db,$body); }
        if ($action==='product_quote') naCatalogQuote($db,$body);
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
