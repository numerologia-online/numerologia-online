"""Publish only the isolated, owner-only YooKassa TEST wallet via REG.RU FTPS.

Requires a single repository Actions Secret for the TEST shop 1521071.
Never logs or saves the key to GitHub. Existing site files are read-only.
Live payment products and the beautiful demo page remain untouched.
"""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import re
import secrets
import socket
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

DOMAIN = "xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD_DOMAIN = "xn--c1adkkdfjbp1a4l.online"
PRIVATE = "private/numi-wallet-test-20261106"
FILE_API = "api/numi-wallet-test.php"
FILE_UI = "wallet-test.html"
PINNED_SOURCE = "e0475eb3840fea6a6e7663b1e48612cbf7b5fa8e"
TEST_SHOP_ID = "1521071"
SECRET_ENV = "NUMI_YOOKASSA_TEST_SECRET_KEY_1521071"
FTP_HOST_ENV = "REG_FTP_HOST"
MAX_BYTES = 3_000_000

def sha(data):
    return hashlib.sha256(data).digest()

def source_file(name):
    return subprocess.check_output(["git", "show", PINNED_SOURCE + ":" + name], timeout=20)

def get_http(url, data=None, headers=None, limit=MAX_BYTES):
    h = {"Cache-Control": "no-store", "User-Agent": "numi-wallet-sandbox-deployment/1"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h, method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=22) as response:
            payload = response.read(limit+1)
            if len(payload) > limit:
                raise RuntimeError("HTTP response exceeds strict size limit")
            return response.status, response.geturl(), payload
    except urllib.error.HTTPError as exc:
        return exc.code, url, exc.read(min(limit, 50000))

def validate_preconditions():
    secret = os.environ.get(SECRET_ENV, "")
    if not secret:
        print("SANDBOX_KEY_MISSING: no deployment attempted. Add repository Actions secret " + SECRET_ENV, flush=True)
        return None
    if not re.fullmatch(r"test_[A-Za-z0-9_-]{12,480}", secret):
        raise RuntimeError("TEST KEY FORMAT INVALID. Nothing uploaded.")
    host = os.environ.get(FTP_HOST_ENV, "").strip()
    user = os.environ.get("REG_FTP_USER", "").strip()
    pw = os.environ.get("REG_FTP_PASSWORD", "")
    if not (host and user and pw):
        raise RuntimeError("REG.RU protected FTP credentials missing. Nothing uploaded.")
    socket.inet_aton(host)
    ptr = socket.gethostbyaddr(host)[0].lower().rstrip(".")
    if not re.fullmatch(r"[a-z0-9.-]+\.hosting\.reg\.ru", ptr):
        raise RuntimeError("REG.RU FTP DNS identity not verified")
    if host not in {x[4][0] for x in socket.getaddrinfo(ptr,21,type=socket.SOCK_STREAM)}:
        raise RuntimeError("REG.RU FTP DNS mismatch")
    core = source_file("wallet-service/private/test-core.php")
    route = source_file("wallet-service/public/numi-wallet-test.php")
    ui = source_file(FILE_UI)
    schema = source_file("wallet-service/schema-test.sql")
    if not all([
        b"wtServe()" in route,
        b"WT_TEST_SHOP_ID = '1521071'" in core,
        b"wtOwnerOnly($current)" in core,
        b"($p['test']??null)!==true" in core,
        b"TEST ONLY" in schema,
        b"numi_wallet_test_ledger" in schema,
        b"<meta name=\"robots\" content=\"noindex,nofollow,noarchive\">" in ui,
    ]):
        raise RuntimeError("Pinned test-source safety checks failed")
    return secret, host, ptr, user, pw, core, route, ui, schema

def main():
    p = validate_preconditions()
    if p is None:
        return
    secret, host, ptr, user, pw, core, route, ui, schema = p
    # The secret is used only in an encrypted upload to the non-public private directory.
    config = ("<?php\n"
              "declare(strict_types=1);\n"
              "return ['test_only'=>true, 'shop_id'=>'" + TEST_SHOP_ID + "',"
              " 'secret_key'=>'" + secret + "'];\n").encode("ascii")
    # Confirm the current HTTPS homepage and resolve the actual public document root.
    status, final_url, live_index = get_http("https://" + DOMAIN + "/index.html")
    if status != 200 or urllib.parse.urlparse(final_url).hostname != DOMAIN:
        raise RuntimeError("New-domain live homepage not verified. Nothing uploaded.")
    print("HTTPS new-domain homepage checked; no main-site write access used.", flush=True)

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=22)
    deployed = []
    original_config = None
    original_probes = {}
    try:
        ftp.connect(ptr,21); ftp.auth(); ftp.login(user,pw); ftp.prot_p(); ftp.set_pasv(True)
        home = ftp.pwd().rstrip("/")
        site = None
        def read(remote, limit=MAX_BYTES):
            result = bytearray()
            def gather(chunk):
                result.extend(chunk)
                if len(result)>limit:
                    raise RuntimeError("Remote file exceeded limit")
            try:
                ftp.retrbinary("RETR "+remote,gather)
                return bytes(result)
            except ftplib.error_perm as exc:
                if str(exc).startswith("550"):
                    return None
                raise
        def upload(remote, content, create_only=True):
            if create_only and read(remote) is not None:
                raise RuntimeError("Refusing overwrite of existing file: "+remote.rsplit("/",1)[-1])
            ftp.storbinary("STOR "+remote,io.BytesIO(content))
            deployed.append(remote)
            if sha(read(remote) or b"")!=sha(content):
                raise RuntimeError("Uploaded file checksum mismatch")
        # The previous deployment verified that new-domain HTTP may map to
        # either the new or the old REG.RU hosting document root.
        for candidate in ("www/"+DOMAIN,"www/"+OLD_DOMAIN):
            data = read(home+"/"+candidate+"/index.html")
            if data is not None and sha(data)==sha(live_index):
                site=home+"/"+candidate
                break
        if site is None:
            raise RuntimeError("Exact new-domain document root not verified. No files modified.")
        print("SAFE_CHECKPOINT: verified document root",flush=True)
        private = home+"/"+PRIVATE
        if read(home+"/private/numi-account-20261031/core.php") is None:
            raise RuntimeError("Existing account backend not found; stopping")
        account_core=read(home+"/private/numi-account-20261031/core.php")
        print("SAFE_ACCOUNT_CAPABILITIES: db=%s session=%s owner=%s" % (b"function naDB()" in account_core,b"function naCurrent(" in account_core,b"function naTestOwner(" in account_core),flush=True)
        if not all(x in account_core for x in [b"function naDB()",b"function naCurrent("]):
            raise RuntimeError("Existing account backend lacks required owner-only safeguards")
        print("SAFE_CHECKPOINT: account core verified",flush=True)
        # Confirm the user-created private directory is present and separate from webroot.
        ftp.cwd(private)
        if site.startswith(private+"/") or private.startswith(site+"/"):
            raise RuntimeError("Unsafe directory layout")
        ftp.cwd(site)
        ftp.cwd(site+"/api")
        print("SAFE_CHECKPOINT: private folder and public api exist",flush=True)
        # No existing real-site files can be replaced by this pilot.
        new_paths = {
            private+"/core.php":core,
            private+"/schema-test.sql":schema,
            site+"/"+FILE_API:route,
            site+"/"+FILE_UI:ui,
        }
        for remote in new_paths:
            if read(remote) is not None:
                raise RuntimeError("Pilot file already exists; refusing overwrite: "+remote.rsplit("/",1)[-1])
        original_config=read(private+"/config.local.php")
        if original_config != b"":
            raise RuntimeError("Private config is not the expected empty owner-created file. No files uploaded.")
        for item in ("index.html",".htaccess","api/numi-account.php"):
            content=read(site+"/"+item)
            if content is None:
                raise RuntimeError("Could not verify baseline file: "+item)
            original_probes[item]=sha(content)
        print("PRECHECK OK: owner private directory, empty config, new pilot paths only.", flush=True)
        # Upload private code and schema first; they are not web-accessible.
        upload(private+"/core.php",core)
        upload(private+"/schema-test.sql",schema)
        print("Private sandbox backend staged outside document root.", flush=True)

        # One-time schema creation endpoint; random 288-bit token never logged.
        # Four new wallet tables only. Existing users/orders/rights never altered.
        token=secrets.token_urlsafe(36)
        probe_name="numi-wallet-install-"+secrets.token_hex(12)+".php"
        probe_path=site+"/api/"+probe_name
        php= r"""<?php
declare(strict_types=1);
header('Cache-Control: no-store');
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
if (($_SERVER['REQUEST_METHOD']??'')!=='POST' ||
    !hash_equals('__TOKEN__', (string)($_SERVER['HTTP_X_NUMI_WALLET_INSTALL']??''))) {
    http_response_code(404); exit;
}
try {
  require dirname(__DIR__,3).'/private/db.php';
  $pdo=getDB();
  if (!($pdo instanceof PDO)) throw new RuntimeException('NO_DB');
  $pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
  $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES,false);
  $need=['numi_wallet_test_balances','numi_wallet_test_topups',
         'numi_wallet_test_unlocks','numi_wallet_test_ledger'];
  $check=$pdo->prepare('SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=DATABASE() AND TABLE_NAME=?');
  foreach ($need as $name) {
    $check->execute([$name]);
    if ($check->fetchColumn()) throw new RuntimeException('PILOT_TABLE_ALREADY_EXISTS');
  }
  $a=$pdo->query("SELECT DATA_TYPE,CHARACTER_MAXIMUM_LENGTH,CHARACTER_SET_NAME,COLLATION_NAME FROM information_schema.COLUMNS WHERE table_schema=DATABASE() AND TABLE_NAME='numi_accounts' AND COLUMN_NAME='id'")->fetch(PDO::FETCH_ASSOC);
  if (!is_array($a) || $a['DATA_TYPE']!=='char' || (int)$a['CHARACTER_MAXIMUM_LENGTH']!==36 ||
      $a['CHARACTER_SET_NAME']!=='ascii' || $a['COLLATION_NAME']!=='ascii_bin') {
    throw new RuntimeException('ACCOUNT_SCHEMA_MISMATCH');
  }
  $sql=file_get_contents(dirname(__DIR__,3).'/private/numi-wallet-test-20261106/schema-test.sql');
  if (!is_string($sql)) throw new RuntimeException('SCHEMA_UNAVAILABLE');
  $chunks=preg_split('/;\s*(?:\r?\n|$)/',$sql);
  $found=[];$statements=[];
  foreach ($chunks as $piece) {
    $piece=preg_replace('/^\s*--[^\r\n]*\r?\n/m','',$piece);
    $piece=trim($piece);
    if ($piece==='') continue;
    if (!preg_match('/^CREATE TABLE IF NOT EXISTS (numi_wallet_test_[a-z_]+)\s*\(/',$piece,$m) ||
        !in_array($m[1],$need,true) || in_array($m[1],$found,true)) throw new RuntimeException('SCHEMA_SCOPE_DENIED');
    $found[]=$m[1];$statements[]=$piece;
  }
  if (count($found)!==4 || count(array_unique($found))!==4) throw new RuntimeException('SCHEMA_COUNT_DENIED');
  foreach ($statements as $statement) $pdo->exec($statement);
  foreach ($need as $name) {
    $check->execute([$name]);if (!$check->fetchColumn()) throw new RuntimeException('TABLE_CREATION_FAILED');
  }
  echo json_encode(['ok'=>true,'test'=>true,'new_tables'=>count($need)]);
} catch (Throwable $exc) {
  http_response_code(503);
  error_log('NUMI_WALLET_TEST_INSTALL:'.get_class($exc));
  echo json_encode(['ok'=>false,'error'=>'WALLET_TEST_SCHEMA_UNAVAILABLE']);
}
""".replace("__TOKEN__",token).encode("utf-8")
        try:
            upload(probe_path,php)
            headers={"X-Numi-Wallet-Install":token,"Content-Type":"application/json"}
            url="https://"+DOMAIN+"/api/"+probe_name
            result_status,_,payload=get_http(url,data=b"{}",headers=headers,limit=30000)
            try:response=json.loads(payload)
            except Exception:response={}
            if result_status!=200 or response.get("ok") is not True or response.get("new_tables")!=4:
                raise RuntimeError("Isolated test schema could not be verified. HTTP "+str(result_status))
            print("New wallet-only MySQL tables created and checked (4). Existing tables unchanged.", flush=True)
        finally:
            ftp.delete(probe_path)
            deployed.remove(probe_path)
        # Never store the key in GitHub or print it.
        # Owner-created config was verified to have 0 bytes; no existing secret replaced.
        ftp.storbinary("STOR "+private+"/config.local.php",io.BytesIO(config))
        deployed.append(private+"/config.local.php")
        if sha(read(private+"/config.local.php") or b"")!=sha(config):
            raise RuntimeError("Config encrypted-upload integrity failed")
        try:ftp.sendcmd("SITE CHMOD 600 "+private+"/config.local.php")
        except ftplib.error_perm:pass
        # Public wrapper and test UI are new isolated paths, never part of
        # homepage, menus, static paywall, subscriptions or bot.
        upload(site+"/"+FILE_API,route)
        upload(site+"/"+FILE_UI,ui)
        for item,prior_hash in original_probes.items():
            if sha(read(site+"/"+item) or b"")!=prior_hash:
                raise RuntimeError("Existing site baseline changed unexpectedly: "+item)
        # An anonymous request may only get LOGIN_REQUIRED; reject malicious origins.
        request_url="https://"+DOMAIN+"/"+FILE_API
        hdr={"Origin":"https://"+DOMAIN,"Content-Type":"application/json"}
        status,_,body=get_http(request_url,b'{"action":"status"}',hdr,limit=10000)
        try:anonymous=json.loads(body)
        except Exception:anonymous={}
        if status!=401 or anonymous.get("error")!="LOGIN_REQUIRED":
            raise RuntimeError("Owner-only API did not reject anonymous request: HTTP "+str(status))
        other={"Origin":"https://attacker.invalid","Content-Type":"application/json"}
        forbidden,_,_=get_http(request_url,b'{"action":"status"}',other,limit=10000)
        if forbidden!=403:
            raise RuntimeError("Owner-only API did not reject foreign origin")
        ui_status,ui_url,ui_data=get_http("https://"+DOMAIN+"/"+FILE_UI,limit=200000)
        if ui_status!=200 or urllib.parse.urlparse(ui_url).hostname!=DOMAIN or sha(ui_data)!=sha(ui):
            raise RuntimeError("Test-only page did not match deployed source")
        print("SANDBOX DEPLOYED: 4 new tables, private test code and config, owner-only public API and test page.", flush=True)
        print("LIVE URL: https://"+DOMAIN+"/"+FILE_UI,flush=True)
        print("SAFEGUARD: other site files changed = 0; no live funds or entitlements touched.",flush=True)
    except BaseException:
        # Do not automatically drop any database tables, which could gain data.
        # Remove newly created public paths and restore the pre-existing 0-byte config.
        for path in reversed(deployed):
            try:
                if path.endswith("/config.local.php"):
                    ftp.storbinary("STOR "+path,io.BytesIO(b""))
                else:
                    ftp.delete(path)
                print("ROLLBACK: reverted newly staged sandbox file",flush=True)
            except Exception:
                print("ROLLBACK_WARNING: sandbox cleanup needs manual review",flush=True)
        raise
    finally:
        try:ftp.quit()
        except Exception:ftp.close()

if __name__=="__main__":
    try:main()
    except BaseException as exc:
        # Only allowlisted preflight messages are safe to expose; never log credentials or server paths.
        known = {
          'Exact new-domain document root not verified. No files modified.':'DOCUMENT_ROOT_MISMATCH',
          'Existing account backend not found; stopping':'ACCOUNT_CORE_NOT_FOUND',
          'Existing account backend lacks required owner-only safeguards':'ACCOUNT_CORE_GUARD_MISMATCH',
          'Unsafe directory layout':'UNSAFE_DIRECTORY_LAYOUT',
          'Private config is not the expected empty owner-created file. No files uploaded.':'CONFIG_NOT_EMPTY',
          'Could not verify baseline file: index.html':'INDEX_MISSING',
          'Could not verify baseline file: .htaccess':'HTACCESS_MISSING',
          'Could not verify baseline file: api/numi-account.php':'ACCOUNT_ROUTE_MISSING',
        }
        message = known.get(str(exc),'OTHER') if isinstance(exc,RuntimeError) else type(exc).__name__
        print('WALLET_TEST_RELEASE_STOPPED: '+message,flush=True)
        sys.exit(1)
