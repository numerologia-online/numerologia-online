"""Deploy independent first-party account API. No changes to existing bot or old login.
- New database tables are created IF NOT EXISTS only.
- Installation token is random and never printed.
- Private PHP lives outside public document root.
- All HTTP checks are anonymous and do not create real accounts.
"""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import re
import secrets
import ssl
import sys
import time
import urllib.error
import urllib.request

DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
PRIVATE="private/numi-account-20261031"
API_FILE="api/numi-account.php"
SOURCE=[
    ("account-service/private/core.php","core.php"),
    ("account-service/schema.sql","schema.sql")
]

def log(**v):print("ACCOUNT_RELEASE",json.dumps(v,sort_keys=True),flush=True)
def sha(v):return hashlib.sha256(v).digest()
def http(data=None,route=API_FILE,headers=None,expected=None):
    payload=None if data is None else json.dumps(data).encode()
    h={"Origin":"https://"+DOMAIN,"Cache-Control":"no-cache",**(headers or {})}
    if payload is not None:h["Content-Type"]="application/json"
    r=urllib.request.Request("https://"+DOMAIN+"/"+route,data=payload,headers=h)
    try:
        with urllib.request.urlopen(r,timeout=28)as resp:
            return resp.status,json.loads(resp.read(30000))
    except urllib.error.HTTPError as e:
        try:body=json.loads(e.read(30000))
        except:body={}
        return e.code,body

def main():
    private_core=pathlib.Path(SOURCE[0][0]).read_bytes()
    schema=pathlib.Path(SOURCE[1][0]).read_bytes()
    wrapper=pathlib.Path("account-service/public/numi-account.php").read_bytes()
    for check in (b"function naServe()",b"function naDB()",b"PASSWORD_DEFAULT"):
        if check not in private_core:raise RuntimeError("Backend source incomplete")
    if schema.count(b"CREATE TABLE IF NOT EXISTS")!=7:
        raise RuntimeError("Unexpected schema scope")
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    f.connect(HOST,21);f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);f.prot_p();f.set_pasv(True)
    try:
        home=f.pwd().rstrip("/")
        site=home+"/www/"+DOMAIN
        private=home+"/"+PRIVATE
        def read(remote):
            b=io.BytesIO()
            try:f.retrbinary("RETR "+remote,b.write)
            except ftplib.error_perm as e:
                if str(e).startswith("550"):return None
                raise
            return b.getvalue()
        def write(remote,value):
            f.storbinary("STOR "+remote,io.BytesIO(value))
            if sha(read(remote) or b"")!=sha(value):raise RuntimeError("Uploaded bytes differ")
        def mkdir(remote):
            try:f.mkd(remote)
            except ftplib.error_perm:
                f.cwd(remote)
        live_auth=read(site+"/auth-profile.js")
        live_index=read(site+"/index.html")
        guard=read(site+"/.htaccess")
        if live_auth is None or live_index is None or guard is None:
            raise RuntimeError("Production baseline unavailable")
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("Private content protection baseline not installed")
        if b"auth-profile.js" not in live_index:
            raise RuntimeError("Telegram login script not present")
        prior=read(site+"/"+API_FILE)
        if prior is not None and sha(prior)!=sha(wrapper):
            raise RuntimeError("Existing account API differs: will not overwrite")
        mkdir(private)
        for local,target in SOURCE:
            current=read(private+"/"+target)
            expected=pathlib.Path(local).read_bytes()
            if current is not None and sha(current)!=sha(expected):
                raise RuntimeError("Private backend file differs; refusing overwrite")
        for local,target in SOURCE:
            write(private+"/"+target,pathlib.Path(local).read_bytes())
            try:f.sendcmd("SITE CHMOD 600 "+private+"/"+target)
            except ftplib.error_perm:pass
        log(private_code_outside_webroot=True,existing_site_files_modified=0,sql_tables_requested=7)
        # A one-time protected PHP installation probe. Deleted in finally, even on errors.
        token=secrets.token_urlsafe(36)
        probe_name="account-schema-"+secrets.token_hex(12)+".php"
        script="""<?php
        declare(strict_types=1);
        header('Cache-Control: no-store');
        header('Content-Type: application/json; charset=UTF-8');
        if (!hash_equals('__TOKEN__',$_SERVER['HTTP_X_NUMI_INSTALL']??'')){http_response_code(404);exit;}
        try {
          require dirname(__DIR__,3).'/private/db.php';
          $db=getDB(); if (!($db instanceof PDO)) throw new RuntimeException('DATABASE');
          $db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
          $sql=file_get_contents(dirname(__DIR__,3).'/private/numi-account-20261031/schema.sql');
          $statements=preg_split('/;[\\r\\n]+/',$sql);
          $executed=0;
          foreach($statements as $s) {
            $s=trim($s);
            if (!$s || !preg_match('/CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+numi_[a-z_]+/i',$s)) continue;
            $db->exec($s);$executed++;
          }
          $expected=['numi_accounts','numi_identities','numi_sessions','numi_tokens',
                     'numi_auth_attempts','numi_orders','numi_entitlements'];
          $names=$db->query('SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE()')->fetchAll(PDO::FETCH_COLUMN);
          foreach($expected as $item) if (!in_array($item,$names,true)) throw new RuntimeException('MISSING_TABLE');
          echo json_encode(['ok'=>true,'new_table_count'=>count($expected),'statements_executed'=>$executed]);
        } catch(Throwable $e) {http_response_code(503);echo json_encode(['ok'=>false,'error'=>get_class($e)]);}
        """.replace("__TOKEN__",token).encode()
        try:
            write(site+"/api/"+probe_name,script)
            status,result=http({},route="api/"+probe_name,headers={"X-Numi-Install":token})
            if status!=200 or result.get("ok") is not True or result.get("new_table_count")!=7 or result.get("statements_executed")!=7:
                raise RuntimeError("New isolated account database schema not verified: "+str(status)+" "+str(result.get("error")))
            log(mysql_tables_created_or_confirmed=7,existing_tables_untouched=True)
        finally:
            try:f.delete(site+"/api/"+probe_name)
            except ftplib.error_perm:log(urgent_cleanup_failed=True)
        if prior is None:write(site+"/"+API_FILE,wrapper)
        for action in ("health","session"):
            status,result=http({"action":action})
            if status!=200 or result.get("ok") is not True:
                if prior is None:f.delete(site+"/"+API_FILE)
                raise RuntimeError("Account API health verification failed")
            if action=="session" and (result.get("authenticated")is not False or result.get("account") is not None):
                if prior is None:f.delete(site+"/"+API_FILE)
                raise RuntimeError("Anonymous visitor improperly authenticated")
        status,result=http({"action":"login","email":"no-such-user@example.invalid","password":"example_not_a_real_password"})
        if status!=401 or result.get("error")!="INVALID_CREDENTIALS":
            if prior is None:f.delete(site+"/"+API_FILE)
            raise RuntimeError("Invalid-password login unexpectedly allowed")
        status,result=http({"action":"register","email":"invalid-email","password":"short"})
        if status!=400:
            if prior is None:f.delete(site+"/"+API_FILE)
            raise RuntimeError("Invalid signup unexpectedly allowed")
        if sha(read(site+"/auth-profile.js"))!=sha(live_auth) or sha(read(site+"/index.html"))!=sha(live_index) or sha(read(site+"/.htaccess"))!=sha(guard):
            raise RuntimeError("Unexpected modification of existing website content")
        log(success=True,account_api_live=True,anonymous_session_denied=True,
            invalid_credentials_denied=True,invalid_registration_denied=True,
            telegram_login_unchanged=True,old_database_tables_untouched=True,
            public_ui_unchanged=True)
    finally:
        try:f.quit()
        except BaseException:f.close()

if __name__=="__main__":
    try:main()
    except BaseException as err:
        log(stopped=type(err).__name__,detail=str(err)[:150] if isinstance(err,RuntimeError) else "")
        sys.exit(1)
