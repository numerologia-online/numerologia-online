"""One-time isolated TEST wallet correction on REG.RU; no live merchant or normal site changes.
Only replace owner-only test core.php and wallet-owner-flow-20261106.js.
Strict exact-baseline checks, private backups, post-deploy checks and rollback.
"""
import ftplib
import hashlib
import io
import os
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request

DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD_DOMAIN="xn--c1adkkdfjbp1a4l.online"
FQDN="server172.hosting.reg.ru"
CORE="wallet-service/private/test-core.php"
JS="wallet-owner-flow-20261106.js"
OLD_CORE_REF="bb6b3d85ca9466f57092711ebfbed0ff76e8adc3"
NEW_CORE_REF="810f302451157fc864d9b915bf91f3fadb693d2e"
OLD_JS_REF="66b8025d99e79ece3f600b4670a5c940807640d8"
NEW_JS_REF="9aa9507874e4e76f0eb8825fc4ae3a85d0b08655"
MAX=850000

def source(ref,path):
    return subprocess.check_output(["git","show",ref+":"+path],timeout=20)
def sha(b):
    return hashlib.sha256(b).hexdigest()
def http(path):
    url="https://"+DOMAIN+"/"+path+("?check="+str(time.time_ns()))
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache"})
    with urllib.request.urlopen(req,timeout=25) as r:
        body=r.read(MAX+1)
        if r.status!=200 or len(body)>MAX or r.geturl().split("/")[2]!=DOMAIN:
            raise RuntimeError("PUBLIC_HTTP_MISMATCH")
        return body
def guest_status(origin):
    request=urllib.request.Request("https://"+DOMAIN+"/api/numi-wallet-test.php",
        data=b'{"action":"status"}',method="POST",
        headers={"Content-Type":"application/json","Origin":origin})
    try:
        with urllib.request.urlopen(request,timeout=24) as r:return r.status
    except urllib.error.HTTPError as e:return e.code

def main():
    oldcore=source(OLD_CORE_REF,CORE)
    newcore=source(NEW_CORE_REF,CORE)
    oldjs=source(OLD_JS_REF,JS)
    newjs=source(NEW_JS_REF,JS)
    if newjs!=source("HEAD",JS):raise RuntimeError("MAIN_SCRIPT_DRIFT")
    if sha(newcore)==sha(oldcore) or sha(newjs)==sha(oldjs):
        raise RuntimeError("EXPECTED_CHANGE_MISSING")

    # Byte-for-byte prove all of the PHP core is unchanged except new owner-only recovery dispatches.
    anchor=b"        if ($action==='buy') wtBuy($db,$current['id']);"
    if oldcore.count(anchor)!=1 or newcore.count(anchor)!=1:
        raise RuntimeError("CORE_ANCHOR_MISSING")
    oldprefix,oldsuffix=oldcore.split(anchor)
    if not newcore.startswith(oldprefix) or not newcore.endswith(anchor+oldsuffix):
        raise RuntimeError("CORE_UNEXPECTED_CHANGE")
    extra=newcore[len(oldprefix):len(newcore)-len(anchor+oldsuffix)]
    if (b"if ($action==='sync_latest')" not in extra
        or b"if ($action==='subscription_sync_latest')" not in extra
        or extra.count(b"wtStatus($db,$current['id'])")!=2
        or b"wtOwnerOnly($current)" not in newcore
        or b"WT_TEST_SHOP_ID = '1521071'" not in newcore):
        raise RuntimeError("RECOVERY_ISOLATION_FAILED")
    for required in (b"miniApp.openLink(url)",b"numi-ow-external",
        b"subscription_sync_latest",b"numi-owner-wallet-topup-test-20261106",
        b"numi-wallet-test.php",b"OWNER_TEST_ONLY"):
        if required not in newjs:raise RuntimeError("FRONTEND_SAFETY_CHECK_FAILED")
    if b"secret_key" in newjs or b"location.assign(url.href)" in newjs:
        raise RuntimeError("CLIENT_PAYMENT_GUARD_FAILED")
    if guest_status("https://"+DOMAIN)!=401 or guest_status("https://untrusted.example.invalid")!=403:
        raise RuntimeError("EXISTING_TEST_AUTH_GUARDS_FAILED")

    old_http_js=http(JS)
    if old_http_js!=oldjs:raise RuntimeError("LIVE_TEST_SCRIPT_NOT_AT_BASELINE")
    index=http("index.html")
    if b'wallet-owner-flow-20261106.js?v=1' not in index:
        raise RuntimeError("LIVE_BRIDGE_NOT_INSTALLED")

    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=27)
    ftp.connect(FQDN,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    changed=[]
    try:
        home=ftp.pwd().rstrip("/")
        def read(path):
            buf=bytearray()
            def append(chunk):
                buf.extend(chunk)
                if len(buf)>MAX:raise RuntimeError("FTP_FILE_TOO_LARGE")
            try:ftp.retrbinary("RETR "+path,append)
            except ftplib.error_perm as exc:
                if str(exc).startswith("550"):return None
                raise
            return bytes(buf)
        def put(path,body):
            ftp.storbinary("STOR "+path,io.BytesIO(body))
            if sha(read(path) or b"")!=sha(body):raise RuntimeError("FTP_WRITE_NOT_VERIFIED")
        root=None
        for candidate in ("www/"+DOMAIN,"www/"+OLD_DOMAIN):
            b=read(home+"/"+candidate+"/index.html")
            if b is not None and sha(b)==sha(index):
                root=home+"/"+candidate
                break
        if root is None:raise RuntimeError("ACTUAL_SITE_ROOT_NOT_VERIFIED")
        pjs=root+"/"+JS
        pcore=home+"/private/numi-wallet-test-20261106/core.php"
        if read(pjs)!=oldjs or read(pcore)!=oldcore:
            raise RuntimeError("TEST_BASELINE_CHANGED_STOP")
        unaffected=("index.html","app.js","account-browser.js",".htaccess")
        fingerprints={}
        for relative in unaffected:
            body=read(root+"/"+relative)
            if body is None:raise RuntimeError("EXISTING_SITE_FILE_MISSING")
            fingerprints[relative]=sha(body)
        folder=home+"/site-safeguard-backups"
        try:ftp.mkd(folder)
        except ftplib.error_perm:ftp.cwd(folder)
        backup=folder+"/test-external-browser-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        put(backup+"/core-before.php.bak",oldcore)
        put(backup+"/wallet-js-before.js.bak",oldjs)
        print("TEST_ONLY_BACKUPS_VERIFIED",flush=True)
        if read(pjs)!=oldjs or read(pcore)!=oldcore:
            raise RuntimeError("CONCURRENT_TEST_CHANGE_STOP")
        try:
            changed.append(pcore);put(pcore,newcore)
            changed.append(pjs);put(pjs,newjs)
            if sha(http(JS))!=sha(newjs):
                raise RuntimeError("PUBLIC_TEST_JS_VERIFY_FAILED")
            if read(pcore)!=newcore:
                raise RuntimeError("PRIVATE_TEST_CORE_VERIFY_FAILED")
            if guest_status("https://"+DOMAIN)!=401 or guest_status("https://untrusted.example.invalid")!=403:
                raise RuntimeError("OWNER_ONLY_AUTH_REGRESSION")
            for relative,fingerprint in fingerprints.items():
                if sha(read(root+"/"+relative) or b"")!=fingerprint:
                    raise RuntimeError("UNRELATED_SITE_FILE_CHANGED")
            print("TEST_WALLET_EXTERNAL_BROWSER_AND_RECOVERY_PUBLISHED",flush=True)
            print("UNCHANGED: homepage, normal account, bot, real gateway, real orders, database",flush=True)
            print("NEXT: owner-only manual successful test in external browser still required",flush=True)
        except BaseException:
            for changed_path in reversed(changed):
                try:
                    put(changed_path,oldcore if changed_path==pcore else oldjs)
                    print("TEST_ONLY_ROLLBACK_VERIFIED",flush=True)
                except BaseException:
                    print("ROLLBACK_FAILED_MANUAL_REVIEW_REQUIRED",flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:main()
    except BaseException as error:
        allowed={"MAIN_SCRIPT_DRIFT","EXPECTED_CHANGE_MISSING","CORE_ANCHOR_MISSING",
          "CORE_UNEXPECTED_CHANGE","RECOVERY_ISOLATION_FAILED","FRONTEND_SAFETY_CHECK_FAILED",
          "CLIENT_PAYMENT_GUARD_FAILED","EXISTING_TEST_AUTH_GUARDS_FAILED",
          "LIVE_TEST_SCRIPT_NOT_AT_BASELINE","LIVE_BRIDGE_NOT_INSTALLED",
          "FTP_FILE_TOO_LARGE","FTP_WRITE_NOT_VERIFIED","ACTUAL_SITE_ROOT_NOT_VERIFIED",
          "TEST_BASELINE_CHANGED_STOP","EXISTING_SITE_FILE_MISSING",
          "CONCURRENT_TEST_CHANGE_STOP","PUBLIC_TEST_JS_VERIFY_FAILED",
          "PRIVATE_TEST_CORE_VERIFY_FAILED","OWNER_ONLY_AUTH_REGRESSION","UNRELATED_SITE_FILE_CHANGED",
          "PUBLIC_HTTP_MISMATCH"}
        reason=str(error) if str(error) in allowed else type(error).__name__
        print("TEST_WALLET_SAFE_RELEASE_STOPPED:",reason,flush=True)
        sys.exit(1)
