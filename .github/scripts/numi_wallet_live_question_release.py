"""One-time, narrow, reversible publication: owner-only YooKassa TEST wallet on the real Red Flag page.
Updates only the pilot's private PHP core, the existing homepage's one script tag, and
creates one new JS asset. Keeps all account code, old payment flow, content, bot and DB untouched.
"""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import socket
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request

HOST="server172.hosting.reg.ru"
NEW_DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD_DOMAIN="xn--c1adkkdfjbp1a4l.online"
OLD_CORE_COMMIT="e0475eb3840fea6a6e7663b1e48612cbf7b5fa8e"
NEW_CORE_COMMIT="8e75cd84791725dcc693929e017a1500e204e8c9"
CORE_PATH="wallet-service/private/test-core.php"
ASSET="wallet-owner-flow-20261106.js"
SCRIPT=b'  <script src="wallet-owner-flow-20261106.js?v=1" defer></script>\n'
ANCHOR=b'  <script type="module" src="app.js?v=20261105scrollfit1"></script>\n'
MAX=4_000_000

def sha(data):return hashlib.sha256(data).digest()
def source(sha_value):
    return subprocess.check_output(["git","show",sha_value+":"+CORE_PATH],timeout=15)
def get_http(path):
    url="https://"+NEW_DOMAIN+"/"+path+("?" if "?" not in path else "&")+"wallet_check="+str(time.time_ns())
    request=urllib.request.Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache"})
    with urllib.request.urlopen(request,timeout=28) as response:
        b=response.read(MAX+1)
        if response.status!=200 or len(b)>MAX:raise RuntimeError("PUBLIC_HTTP_NOT_VERIFIED")
        if response.geturl().split("/")[2]!=NEW_DOMAIN:raise RuntimeError("DOMAIN_REDIRECT_UNEXPECTED")
        return b

def http_api(payload,origin):
    url="https://"+NEW_DOMAIN+"/api/numi-wallet-test.php"
    req=urllib.request.Request(url,data=payload,method="POST",headers={
      "Content-Type":"application/json","Origin":origin,"Cache-Control":"no-cache"})
    try:
        with urllib.request.urlopen(req,timeout=28) as resp:
            return resp.status,json.loads(resp.read(12000))
    except urllib.error.HTTPError as exc:
        try:return exc.code,json.loads(exc.read(12000))
        except Exception:return exc.code,{}

def preflight():
    old=source(OLD_CORE_COMMIT);new=source(NEW_CORE_COMMIT)
    a=b"const WT_RETURN_URL = 'https://"+NEW_DOMAIN.encode()+b"/wallet-test.html';"
    b=b"const WT_RETURN_URL = 'https://"+NEW_DOMAIN.encode()+b"/?view=redflag&question=money:generosity';"
    if old.count(a)!=1 or old.count(b"WT_RETURN_URL.'?payment='.$id")!=1:
        raise RuntimeError("ORIGINAL_PILOT_CORE_UNEXPECTED")
    if old.replace(a,b).replace(b"WT_RETURN_URL.'?payment='.$id",b"WT_RETURN_URL.'&payment='.$id")!=new:
        raise RuntimeError("TEST_CORE_CHANGES_OUTSIDE_RETURN_URL")
    if b"wtOwnerOnly($current)" not in new or b"WT_TEST_SHOP_ID = '1521071'" not in new:
        raise RuntimeError("TEST_ONLY_OWNER_GUARD_MISSING")
    js=pathlib.Path(ASSET).read_bytes()
    for needle in (b"numi-wallet-test.php",b"OWNER",b"generosity",b"numi-owner-wallet-tile",
                   b"INSUFFICIENT_TEST_BALANCE",b"account-profile"):
        if needle.lower() not in js.lower():raise RuntimeError("FRONTEND_PILOT_INCOMPLETE")
    if len(js)>150000:raise RuntimeError("FRONTEND_TOO_LARGE")
    return old,new,js

def main():
    old_core,new_core,js=preflight()
    # Anonymous security checks before any write.
    code,response=http_api(b'{"action":"status"}',"https://"+NEW_DOMAIN)
    if code!=401 or response.get("error")!="LOGIN_REQUIRED":
        raise RuntimeError("ANONYMOUS_PILOT_ACCESS_UNEXPECTED")
    forbidden,_=http_api(b'{"action":"status"}',"https://untrusted.example.invalid")
    if forbidden!=403:raise RuntimeError("FOREIGN_ORIGIN_NOT_DENIED")
    http_index=get_http("index.html")
    if SCRIPT.strip() in http_index:raise RuntimeError("ALREADY_INSTALLED_STOP")
    if http_index.count(ANCHOR)!=1:raise RuntimeError("HOMEPAGE_INSERTION_ANCHOR_CHANGED")
    ip=socket.gethostbyname(HOST)
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=28)
    changed=[];backup_done=False
    f.connect(HOST,21);f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    f.prot_p();f.set_pasv(True)
    try:
        home=f.pwd().rstrip("/")
        def read(p):
            v=bytearray()
            def add(chunk):
                v.extend(chunk)
                if len(v)>MAX:raise RuntimeError("FILE_SIZE_LIMIT")
            try:f.retrbinary("RETR "+p,add)
            except ftplib.error_perm as exc:
                if str(exc).startswith("550"):return None
                raise
            return bytes(v)
        def put(p,value):
            f.storbinary("STOR "+p,io.BytesIO(value))
            if sha(read(p) or b"")!=sha(value):raise RuntimeError("REMOTE_CHECKSUM_MISMATCH")
        root=None
        for folder in ("www/"+NEW_DOMAIN,"www/"+OLD_DOMAIN):
            sample=read(home+"/"+folder+"/index.html")
            if sample is not None and sha(sample)==sha(http_index):
                root=home+"/"+folder;break
        if root is None:raise RuntimeError("LIVE_ROOT_CANNOT_BE_VERIFIED")
        priv=home+"/private/numi-wallet-test-20261106/core.php"
        index=root+"/index.html"
        asset=root+"/"+ASSET
        original_index=read(index)
        original_core=read(priv)
        if original_index!=http_index or original_core!=old_core:
            raise RuntimeError("LIVE_PILOT_BASELINE_DRIFT")
        if read(asset) is not None:
            raise RuntimeError("OWNER_WALLET_ASSET_ALREADY_EXISTS")
        if read(home+"/private/numi-wallet-test-20261106/config.local.php") is None:
            raise RuntimeError("PRIVATE_TEST_CONFIG_MISSING")
        guard=read(root+"/.htaccess")
        account=read(root+"/account-browser.js")
        app=read(root+"/app.js")
        if any(x is None for x in (guard,account,app)):
            raise RuntimeError("LIVE_SITE_BASELINE_INCOMPLETE")
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("PAID_CONTENT_GUARD_MISSING")
        if b"redflag-feature.js" not in app:
            raise RuntimeError("REDFLAG_ROUTER_MISSING")
        hashes={".htaccess":sha(guard),"account-browser.js":sha(account),"app.js":sha(app)}
        modified_index=original_index.replace(ANCHOR,SCRIPT+ANCHOR,1)
        if modified_index.count(SCRIPT)!=1 or modified_index.replace(SCRIPT,b"",1)!=original_index:
            raise RuntimeError("HOMEPAGE_PATCH_SCOPE_ERROR")
        # Durable, private backups BEFORE touching anything.
        backups=home+"/site-safeguard-backups"
        try:f.mkd(backups)
        except ftplib.error_perm:f.cwd(backups)
        stamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        folder=backups+"/owner-wallet-inline-"+stamp
        f.mkd(folder)
        put(folder+"/index.html.bak",original_index)
        put(folder+"/test-core.php.bak",original_core)
        backup_done=True
        print("SAFE_BACKUPS_VERIFIED; only test core, homepage script tag and new JS asset authorized.",flush=True)
        if read(priv)!=original_core or read(index)!=original_index:
            raise RuntimeError("CONCURRENT_SITE_CHANGE")
        try:
            changed.append(priv);put(priv,new_core)
            changed.append(asset);put(asset,js)
            changed.append(index);put(index,modified_index)
            if sha(get_http("index.html"))!=sha(modified_index):
                raise RuntimeError("LIVE_HOMEPAGE_HTTP_MISMATCH")
            if sha(get_http(ASSET))!=sha(js):
                raise RuntimeError("LIVE_TEST_BRIDGE_JS_MISMATCH")
            for name,h in hashes.items():
                if sha(read(root+"/"+name) or b"")!=h:
                    raise RuntimeError("PROTECTED_SITE_FILE_CHANGED")
            code,result=http_api(b'{"action":"status"}',"https://"+NEW_DOMAIN)
            if code!=401 or result.get("error")!="LOGIN_REQUIRED":
                raise RuntimeError("OWNER_ONLY_API_CHECK_FAILED")
            print("OWNER_WALLET_LIVE: test-only question purchase integrated on new-domain homepage.",flush=True)
            print("SAFE_RESULT: account, bot, real payment routes, paid content and production DB changed=0.",flush=True)
        except BaseException:
            for p in reversed(changed):
                try:
                    if p==index:put(p,original_index)
                    elif p==priv:put(p,original_core)
                    else:f.delete(p)
                    print("ROLLBACK_STAGE_COMPLETE",flush=True)
                except Exception:print("ROLLBACK_FAILED_MANUAL_REVIEW_REQUIRED",flush=True)
            raise
    finally:
        try:f.quit()
        except BaseException:f.close()

if __name__=="__main__":
    try:main()
    except BaseException as exc:
        # Protect API keys, credentials and private paths from CI log output.
        print("OWNER_WALLET_RELEASE_STOPPED: "+(str(exc) if isinstance(exc,RuntimeError) else type(exc).__name__),flush=True)
        sys.exit(1)
