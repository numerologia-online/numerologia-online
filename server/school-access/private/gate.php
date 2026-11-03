<?php
declare(strict_types=1);

// A separate owner-only gate for the self-study. Existing login and paid APIs stay separate.
const NS_COOKIE = '__Host-numi_school_owner';
const NS_TTL = 900;
const NS_ORIGIN = 'https://xn--c1adkkdfjbp1a4l.online';

function nsBinding(): string {
    $raw = $_COOKIE['__Host-numi_session'] ?? '';
    return hash('sha256', is_string($raw) ? $raw : '');
}
function nsCookie(string $owner, string $key, string $binding, int $now): string {
    $payload = $owner.'.'.($now + NS_TTL).'.'.$binding;
    return $payload.'.'.hash_hmac('sha256', $payload, $key);
}
function nsValidCookie(string $raw, string $owner, string $key, string $binding, int $now): bool {
    if (!preg_match('/^([1-9][0-9]{3,19})\.([0-9]{10})\.([a-f0-9]{64})\.([a-f0-9]{64})$/D', $raw, $m)) return false;
    if (!hash_equals($owner, $m[1]) || !hash_equals($binding, $m[3]) || (int)$m[2] <= $now || (int)$m[2] > $now + NS_TTL) return false;
    return hash_equals(hash_hmac('sha256', $m[1].'.'.$m[2].'.'.$m[3], $key), $m[4]);
}
function nsManagementAccount(?array $account, string $verifiedEmailHash = 'f289c5906895cbbd1b42d74e4e2e07d531fc1af4e91bcf7e5700835856003d29'): bool {
    return $account !== null && !empty($account['email_verified_at']) && is_string($account['email'] ?? null)
        && hash_equals($verifiedEmailHash, hash('sha256', strtolower($account['email'])));
}
function nsAccountOwner(string $ownerId): bool {
    if (empty($_COOKIE['__Host-numi_session'])) return false;
    try {
        require_once dirname(__DIR__).'/numi-account-20261031/core.php';
        $db = naDB();
        $account = naCurrent($db);
        if (!$account) return false;
        if (nsManagementAccount($account)) return true;
        $query = $db->prepare('SELECT 1 FROM numi_identities WHERE account_id=? AND provider=? AND provider_user_id=? LIMIT 1');
        $query->execute([(string)$account['id'], 'telegram', $ownerId]);
        return (bool)$query->fetchColumn();
    } catch (Throwable $error) { return false; }
}
function nsOwner(array $config, string $key, string $signed = '', ?callable $accountCheck = null): bool {
    $owner = (string)$config['owner_id'];
    if ($signed !== '') {
        $user = numiTelegramUser($signed, numiBotToken($config));
        return numiIsOwner($user, $config);
    }
    $cookie = $_COOKIE[NS_COOKIE] ?? '';
    if (is_string($cookie) && nsValidCookie($cookie, $owner, $key, nsBinding(), time())) return true;
    return $accountCheck ? (bool)$accountCheck($owner) : nsAccountOwner($owner);
}
function nsIssueCookie(array $config, string $key): void {
    setcookie(NS_COOKIE, nsCookie((string)$config['owner_id'], $key, nsBinding(), time()), [
        'expires'=>time()+NS_TTL, 'path'=>'/', 'secure'=>true, 'httponly'=>true, 'samesite'=>'Lax'
    ]);
}
function nsPath(string $uri): ?string {
    $path = parse_url($uri, PHP_URL_PATH);
    if (!is_string($path) || strlen($path)>500) return null;
    $path = rawurldecode($path);
    if (!preg_match('~^/pro/(?:school(?:/|$)|schools/)[A-Za-z0-9_./-]*$~D', $path)) return null;
    if (preg_match('~(^|/)\.{1,2}(/|$)~', $path) || str_contains($path, '//') || str_contains($path, '%')) return null;
    $path = ltrim($path, '/');
    if ($path === 'pro/school') $path .= '/';
    if (str_ends_with($path, '/')) $path .= 'index.html';
    return $path;
}
function nsAllowed(string $path, array $allowed): bool {
    return in_array($path, $allowed, true) && in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), ['html','css','js','json','svg','md'], true);
}
function nsPublic(string $path): bool {
    return in_array($path, ['pro/schools/index.html', 'pro/schools/schools.css'], true);
}
function nsJson(int $status, array $value): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($value, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
function nsHeaders(): void {
    header('Cache-Control: private, no-store, max-age=0');
    header('Pragma: no-cache');
    header('Vary: Cookie');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex, nofollow');
}
function nsFile(string $root, string $path, array $allowed, array $config, ?string $sourceRoot = null): string {
    if (!nsAllowed($path, $allowed)) throw new RuntimeException('NOT_FOUND');
    if (str_ends_with($path, '.json') && isset(numiManifest()['files'][$path])) return numiPrivateRead($path, $config);
    $sourceRoot ??= __DIR__.'/sources';
    $base = realpath($sourceRoot);
    $candidate = $sourceRoot.'/'.hash('sha256',$path);
    $file = realpath($candidate);
    if ($base === false || $file === false || !str_starts_with($file, $base.'/') || !is_file($file) || is_link($candidate) || filesize($file)>2_000_000) throw new RuntimeException('NOT_FOUND');
    $body = file_get_contents($file);
    if (!is_string($body)) throw new RuntimeException('READ_FAILED');
    return $body;
}
function nsReference(string $reference, string $context, array $allowed): string {
    if ($reference==='' || $reference[0]==='#' || preg_match('~^(?:[a-z][a-z0-9+.-]*:|//)~i',$reference)) return $reference;
    $parts=parse_url($reference);
    if (!is_array($parts)) return $reference;
    $path=$parts['path']??'';
    if ($path==='') return $reference;
    $path=$path[0]==='/'?$path:dirname('/'.ltrim($context,'/')).'/'.$path;
    $segments=[];
    foreach(explode('/',$path)as$segment){if($segment===''||$segment==='.')continue;if($segment==='..'){array_pop($segments);continue;}$segments[]=$segment;}
    $trailing=str_ends_with($path,'/');$path='/'.implode('/',$segments);if($path!=='/'&&$trailing)$path.='/';
    $logical=ltrim($path,'/');if(str_ends_with($logical,'/'))$logical.='index.html';
    $query=isset($parts['query'])?$parts['query']:'';$fragment=isset($parts['fragment'])?'#'.$parts['fragment']:'';
    return nsAllowed($logical,$allowed)?'/api/numi-school.php?file='.rawurlencode($logical).($query!==''?'&'.$query:'').$fragment:$path.($query!==''?'?'.$query:'').$fragment;
}
function nsRewriteJs(string $source,string $path,array $allowed):string{
    return preg_replace_callback('~(\b(?:from|import)\s*(?:\(\s*)?)([\x22\x27])([^\x22\x27]+)\2~',function($m)use($path,$allowed){return $m[1].$m[2].nsReference($m[3],$path,$allowed).$m[2];},$source);
}
function nsRewriteHtml(string $source,string $path,array $allowed):string{
    $context=$path;
    if(preg_match('~<base\b[^>]*href=[\x22\x27]([^\x22\x27]+)~i',$source,$base)){
        $resolved=nsReference($base[1],$path,[]);$context=ltrim($resolved,'/').(str_ends_with($resolved,'/')?'index.html':'');
    }else{
        $baseHref='/'.trim(dirname($path),'/').'/';
        $source=preg_replace('~<head([^>]*)>~i','<head$1><base href="'.$baseHref.'">',$source,1);
    }
    $source=preg_replace_callback('~<(?:script|link)\b[^>]*>~i',function($tag)use($context,$allowed){return preg_replace_callback('~\b(src|href)=([\x22\x27])([^\x22\x27]+)\2~i',fn($m)=>$m[1].'='.$m[2].htmlspecialchars(nsReference(html_entity_decode($m[3],ENT_QUOTES),$context,$allowed),ENT_QUOTES).$m[2],$tag[0]);},$source);
    return str_ireplace('</head>','<script src="/assets/numi-school-fetch-20261103.js?v=1"></script></head>',$source);
}
function nsRewriteCss(string $source,string $path,array $allowed):string{
    return preg_replace_callback('~url\(\s*([\x22\x27]?)([^)\x22\x27]+)\1\s*\)~i',fn($m)=>'url('.$m[1].nsReference(trim($m[2]),$path,$allowed).$m[1].')',$source);
}
function nsServe(string $root): never {
    nsHeaders();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET','HEAD','POST'], true)) nsJson(405, ['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    try {
        require_once dirname(__DIR__).'/numi-content-reg-20261031/core.php';
        $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS']!=='off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')==='https';
        if (!$secure) nsJson(426, ['ok'=>false,'error'=>'HTTPS_REQUIRED']);
        $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
        if ($origin !== '' && !in_array($origin, [NS_ORIGIN,'https://www.xn--c1adkkdfjbp1a4l.online'], true)) nsJson(403, ['ok'=>false,'error'=>'ORIGIN_DENIED']);
        $config = numiConfig();
        $key = hash_hmac('sha256', 'numi-school-owner-v1', numiBotToken($config), true);
        $allowed = json_decode(file_get_contents(__DIR__.'/allowlist.json'), true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($allowed) || count($allowed)<20) throw new RuntimeException('INVALID_ALLOWLIST');
        if ($method==='POST') {
            $body = numiInput();
            $action = $body['action'] ?? 'session';
            if (!in_array($action, ['session','content'], true)) nsJson(400, ['ok'=>false,'error'=>'INVALID_ACTION']);
            $signed = $body['init_data'] ?? '';
            $owner = nsOwner($config, $key, is_string($signed) ? $signed : '');
            if ($owner) nsIssueCookie($config, $key);
            if ($action==='session') nsJson(200, ['ok'=>true,'owner'=>$owner]);
            if (!$owner) nsJson(403, ['ok'=>false,'error'=>'SCHOOL_SUBSCRIPTION_REQUIRED']);
            $path = $body['path'] ?? '';
            if (!is_string($path) || !preg_match('~^pro/school/lessons/[a-z0-9-]+\.json$~D', $path) || !nsAllowed($path, $allowed)) nsJson(404, ['ok'=>false,'error'=>'NOT_FOUND']);
            nsJson(200, ['ok'=>true,'content'=>json_decode(nsFile($root,$path,$allowed,$config),true,64,JSON_THROW_ON_ERROR)]);
        }
        if (($_GET['offer'] ?? '')==='1') {
            header('Content-Type: text/html; charset=UTF-8');
            if ($method!=='HEAD') readfile(__DIR__.'/offer.html');
            exit;
        }
        $path = isset($_GET['file']) && is_string($_GET['file']) ? $_GET['file'] : nsPath((string)($_SERVER['REQUEST_URI'] ?? ''));
        if ($path===null || nsPublic($path) || !nsAllowed($path,$allowed)) nsJson(404, ['ok'=>false,'error'=>'NOT_FOUND']);
        if (!nsOwner($config,$key)) {
            if (!str_ends_with($path,'.html')) nsJson(403, ['ok'=>false,'error'=>'SCHOOL_SUBSCRIPTION_REQUIRED']);
            header('Content-Type: text/html; charset=UTF-8');
            if ($method!=='HEAD') readfile(__DIR__.'/offer.html');
            exit;
        }
        $types = ['html'=>'text/html; charset=UTF-8','js'=>'text/javascript; charset=UTF-8','css'=>'text/css; charset=UTF-8','json'=>'application/json; charset=UTF-8','svg'=>'image/svg+xml','md'=>'text/plain; charset=UTF-8'];
        header('Content-Type: '.$types[strtolower(pathinfo($path,PATHINFO_EXTENSION))]);
        if ($method!=='HEAD') {
            $source=nsFile($root,$path,$allowed,$config);
            $extension=strtolower(pathinfo($path,PATHINFO_EXTENSION));
            if($extension==='js')$source=nsRewriteJs($source,$path,$allowed);
            if($extension==='html')$source=nsRewriteHtml($source,$path,$allowed);
            if($extension==='css')$source=nsRewriteCss($source,$path,$allowed);
            echo $source;
        }
        exit;
    } catch (Throwable $error) {
        error_log('NUMI_SCHOOL_GATE:'.get_class($error));
        nsJson(503,['ok'=>false,'error'=>'SCHOOL_TEMPORARILY_UNAVAILABLE']);
    }
}
