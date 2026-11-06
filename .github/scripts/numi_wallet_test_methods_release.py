"""Narrow, reversible release of dynamic TEST topups and YooMoney option for owner only."""
import ftplib
import hashlib
import io
import os
import socket
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request

DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD="xn--c1adkkdfjbp1a4l.online"
FQDN="server172.hosting.reg.ru"
JS="wallet-owner-flow-20261106.js"
CORE="wallet-service/private/test-core.php"
PREVIOUS_CORE="8e75cd84791725dcc693929e017a1500e204e8c9"
CURRENT_CORE="ddeb6aeec637e1d9afcbb766b4d02157d29f400d"
PREVIOUS_JS="1db0b943ed02008535403744e037628181b61f44"
CURRENT_JS="fd11249560e309639613871f88a118799491fbce"
MAX_SIZE=500_000

def file_at(sha,path):
    return subprocess.check_output(["git","show",sha+":"+path],timeout=20)

def digest(x):
    return hashlib.sha256(x).hexdigest()

def live(path):
    req=urllib.request.Request("https://"+DOMAIN+"/"+path+"?read_only_check="+str(time.time_ns()),
         headers={"Cache-Control":"no-cache"})
    with urllib.request.urlopen(req,timeout=25) as result:
        data=result.read(MAX_SIZE+1)
        if result.status!=200 or len(data)>MAX_SIZE or result.geturl().split("/")[2]!=DOMAIN:
            raise RuntimeError("LIVE_HTTP_CHECK_FAILED")
        return data

def api_status(origin):
    req=urllib.request.Request("https://"+DOMAIN+"/api/numi-wallet-test.php",data=b'{"action":"status"}',
        method="POST",headers={"Content-Type":"application/json","Origin":origin})
    try:
        with urllib.request.urlopen(req,timeout=20) as r:return r.status
    except urllib.error.HTTPError as e:return e.code

def main():
    previous_js=file_at(PREVIOUS_JS,JS);current_js=file_at(CURRENT_JS,JS)
    previous_core=file_at(PREVIOUS_CORE,CORE);current_core=file_at(CURRENT_CORE,CORE)
    if b"function wtTopup(PDO $db,string $uid,array $body)" not in current_core:
        raise RuntimeError("NEW_CORE_MISSING_AMOUNT_SUPPORT")
    if b"payment_method_data'=>['type'=>$method]" not in current_core:
        raise RuntimeError("NEW_CORE_MISSING_YOOMONEY_SUPPORT")
    if b"WT_TEST_SHOP_ID = '1521071'" not in current_core or b"wtOwnerOnly($current)" not in current_core:
        raise RuntimeError("TEST_ONLY_GUARDS_MISSING")
    if any(x not in current_js for x in (b"numi-ow-choice",b"numi-ow-amount",b"numi-ow-yoomoney",
                                          b"numi-wallet-test.php",b"min=\"100\"")):
        raise RuntimeError("NEW_FRONTEND_MISSING_CHOOSER")
    if b"localStorage" in current_js or b"secret_key" in current_js:
        raise RuntimeError("UNSAFE_CLIENT_STATE")
    if api_status("https://"+DOMAIN)!=401 or api_status("https://evil.example.invalid")!=403:
        raise RuntimeError("PILOT_OWNER_ONLY_API_NOT_VERIFIED")
    old_http_js=live(JS)
    if digest(old_http_js)!=digest(previous_js):
        raise RuntimeError("CURRENT_WALLET_SCRIPT_CHANGED_EXTERNALLY")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=25)
    ftp.connect(FQDN,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    changed=[]
    try:
        home=ftp.pwd().rstrip("/")
        def read(name):
            buf=bytearray()
            def add(block):
                buf.extend(block)
                if len(buf)>MAX_SIZE:raise RuntimeError("FILE_TOO_LARGE")
            try:ftp.retrbinary("RETR "+name,add)
            except ftplib.error_perm as err:
                if str(err).startswith("550"):return None
                raise
            return bytes(buf)
        def put(name,data):
            ftp.storbinary("STOR "+name,io.BytesIO(data))
            if digest(read(name) or b"")!=digest(data):
                raise RuntimeError("REMOTE_UPLOAD_VERIFICATION_FAILED")
        html=live("index.html")
        root=None
        for candidate in ("www/"+DOMAIN,"www/"+OLD):
            b=read(home+"/"+candidate+"/index.html")
            if b is not None and digest(b)==digest(html):root=home+"/"+candidate;break
        if root is None:raise RuntimeError("LIVE_SITE_ROOT_NOT_VERIFIED")
        pjs=root+"/"+JS
        pcore=home+"/private/numi-wallet-test-20261106/core.php"
        if read(pjs)!=previous_js or read(pcore)!=previous_core:
            raise RuntimeError("PILOT_SCRIPT_OR_CORE_BASELINE_MISMATCH")
        must_unchanged=["index.html","app.js","account-browser.js",".htaccess"]
        hashes={}
        for path in must_unchanged:
            b=read(root+"/"+path)
            if b is None:raise RuntimeError("EXISTING_SITE_REFERENCE_MISSING")
            hashes[path]=digest(b)
        backups=home+"/site-safeguard-backups"
        try:ftp.mkd(backups)
        except ftplib.error_perm:ftp.cwd(backups)
        backup_dir=backups+"/owner-wallet-methods-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup_dir)
        put(backup_dir+"/test-core-before.php.bak",previous_core)
        put(backup_dir+"/wallet-owner-before.js.bak",previous_js)
        print("BACKUPS_VERIFIED: previous sandbox script and private code",flush=True)
        if read(pjs)!=previous_js or read(pcore)!=previous_core:
            raise RuntimeError("CONCURRENT_SITE_CHANGE_DETECTED")
        try:
            changed.append(pcore);put(pcore,current_core)
            changed.append(pjs);put(pjs,current_js)
            if digest(live(JS))!=digest(current_js):raise RuntimeError("PUBLIC_JS_HTTP_MISMATCH")
            if api_status("https://"+DOMAIN)!=401 or api_status("https://evil.example.invalid")!=403:
                raise RuntimeError("OWNER_ONLY_API_REGRESSION")
            for path,h in hashes.items():
                if digest(read(root+"/"+path) or b"")!=h:raise RuntimeError("EXISTING_SITE_CHANGED")
            print("TEST_METHODS_LIVE_VERIFIED: card, YooMoney, amount >=100, single-question choice",flush=True)
            print("UNCHANGED: homepage, existing account, app router, bot, real payments, database",flush=True)
        except BaseException:
            for path in reversed(changed):
                try:put(path,previous_core if path==pcore else previous_js);print("PILOT_FILE_RESTORED",flush=True)
                except BaseException:print("ROLLBACK_FAILED_MANUAL_REVIEW_REQUIRED",flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:main()
    except BaseException as error:
        allowed={"LIVE_HTTP_CHECK_FAILED","NEW_CORE_MISSING_AMOUNT_SUPPORT","NEW_CORE_MISSING_YOOMONEY_SUPPORT",
                 "TEST_ONLY_GUARDS_MISSING","NEW_FRONTEND_MISSING_CHOOSER","UNSAFE_CLIENT_STATE",
                 "PILOT_OWNER_ONLY_API_NOT_VERIFIED","CURRENT_WALLET_SCRIPT_CHANGED_EXTERNALLY",
                 "FILE_TOO_LARGE","REMOTE_UPLOAD_VERIFICATION_FAILED","LIVE_SITE_ROOT_NOT_VERIFIED",
                 "PILOT_SCRIPT_OR_CORE_BASELINE_MISMATCH","EXISTING_SITE_REFERENCE_MISSING",
                 "CONCURRENT_SITE_CHANGE_DETECTED","PUBLIC_JS_HTTP_MISMATCH","OWNER_ONLY_API_REGRESSION",
                 "EXISTING_SITE_CHANGED"}
        reason=str(error) if str(error) in allowed else type(error).__name__
        print("WALLET_TEST_METHOD_RELEASE_STOPPED:",reason,flush=True);sys.exit(1)
