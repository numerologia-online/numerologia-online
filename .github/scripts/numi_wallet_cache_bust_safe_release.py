"""One-time safe live HTML cache-bust for the isolated owner-only TEST checkout JS.
It must change exactly one URL query in the actual REG.RU index.html, never replace
the live homepage with a GitHub copy, and never touch payments, bot, or database.
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
HOST="server172.hosting.reg.ru"
SCRIPT="wallet-owner-flow-20261106.js"
OLD=b'wallet-owner-flow-20261106.js?v=1'
NEW=b'wallet-owner-flow-20261106.js?v=b35c41117e20'
MAX=5_000_000

def sha(b):return hashlib.sha256(b).hexdigest()
def http(path):
    url="https://"+DOMAIN+"/"+path+("&" if "?" in path else "?")+"numi_verify="+str(time.time_ns())
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache"})
    with urllib.request.urlopen(req,timeout=23) as r:
        body=r.read(MAX+1)
        if r.status!=200 or len(body)>MAX or r.geturl().split("/")[2]!=DOMAIN:
            raise RuntimeError("PUBLIC_HTTP_MISMATCH")
        return body

def main():
    expected_js=subprocess.check_output(["git","show","HEAD:"+SCRIPT],timeout=18)
    live_js=http(SCRIPT+"?v=b35c41117e20")
    if live_js!=expected_js:raise RuntimeError("TEST_JS_NOT_CURRENT")
    if b"miniApp.openLink(url)" not in expected_js or b'sync_latest' not in expected_js:
        raise RuntimeError("TEST_FIX_MISSING")
    current=http("index.html")
    if current.count(OLD)!=1 or NEW in current:
        raise RuntimeError("LIVE_INDEX_TAG_UNEXPECTED")
    # No git/index.html is used as the source for publication.
    changed=current.replace(OLD,NEW)
    if len(changed)==len(current) or changed.replace(NEW,OLD)!=current:
        raise RuntimeError("INDEX_CHANGE_NOT_EXACT")

    ftps=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=27)
    ftps.connect(HOST,21)
    ftps.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftps.prot_p()
    ftps.set_pasv(True)
    changed_on_server=False
    index_path=None
    try:
        home=ftps.pwd().rstrip("/")
        def read(p):
            chunks=bytearray()
            def add(chunk):
                chunks.extend(chunk)
                if len(chunks)>MAX:raise RuntimeError("FTP_FILE_TOO_LARGE")
            try:ftps.retrbinary("RETR "+p,add)
            except ftplib.error_perm as err:
                if str(err).startswith("550"):return None
                raise
            return bytes(chunks)
        def upload(p,blob):
            ftps.storbinary("STOR "+p,io.BytesIO(blob))
            if sha(read(p) or b"")!=sha(blob):
                raise RuntimeError("FTP_UPLOAD_VERIFY_FAILED")
        root=None
        for candidate in ("www/"+DOMAIN,"www/"+OLD_DOMAIN):
            possible=home+"/"+candidate+"/index.html"
            b=read(possible)
            if b is not None and b==current:
                index_path=possible
                root=home+"/"+candidate
                break
        if root is None:raise RuntimeError("LIVE_SITE_ROOT_DRIFT")
        if read(root+"/"+SCRIPT)!=expected_js:
            raise RuntimeError("LIVE_TEST_SCRIPT_DRIFT")
        unchanged=("app.js","account-browser.js","auth-profile.js",".htaccess")
        hashes={}
        for p in unchanged:
            body=read(root+"/"+p)
            if body is None:raise RuntimeError("UNRELATED_FILE_MISSING")
            hashes[p]=sha(body)
        backups=home+"/site-safeguard-backups"
        try:ftps.mkd(backups)
        except ftplib.error_perm:ftps.cwd(backups)
        backup=backups+"/test-wallet-cachebust-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftps.mkd(backup)
        upload(backup+"/index-before.html.bak",current)
        print("CACHEBUST_INDEX_BACKUP_VERIFIED",flush=True)
        if read(index_path)!=current:raise RuntimeError("CONCURRENT_INDEX_CHANGE")
        try:
            changed_on_server=True
            upload(index_path,changed)
            if http("index.html")!=changed:raise RuntimeError("PUBLIC_INDEX_CACHEBUST_NOT_VERIFIED")
            if http(SCRIPT+"?v=b35c41117e20")!=expected_js:
                raise RuntimeError("CACHEBUST_JS_RESPONSE_MISMATCH")
            for p,h in hashes.items():
                if sha(read(root+"/"+p) or b"")!=h:
                    raise RuntimeError("UNRELATED_FILE_CHANGE")
            print("TEST_WALLET_JS_CACHE_BUST_PUBLISHED_VERIFIED",flush=True)
            print("SCRIPT_URL_VERSION b35c41117e20",flush=True)
            print("UNCHANGED: all HTML except one test JS query parameter; account, bot, paid sections, DB, payment APIs",flush=True)
        except BaseException:
            if changed_on_server:
                try:
                    upload(index_path,current)
                    print("INDEX_ROLLBACK_VERIFIED",flush=True)
                except BaseException:
                    print("INDEX_ROLLBACK_FAILED_MANUAL_REVIEW_REQUIRED",flush=True)
            raise
    finally:
        try:ftps.quit()
        except BaseException:ftps.close()

if __name__=="__main__":
    try:main()
    except BaseException as e:
        allowed={"PUBLIC_HTTP_MISMATCH","TEST_JS_NOT_CURRENT","TEST_FIX_MISSING",
         "LIVE_INDEX_TAG_UNEXPECTED","INDEX_CHANGE_NOT_EXACT","FTP_FILE_TOO_LARGE",
         "FTP_UPLOAD_VERIFY_FAILED","LIVE_SITE_ROOT_DRIFT","LIVE_TEST_SCRIPT_DRIFT",
         "UNRELATED_FILE_MISSING","CONCURRENT_INDEX_CHANGE",
         "PUBLIC_INDEX_CACHEBUST_NOT_VERIFIED","CACHEBUST_JS_RESPONSE_MISMATCH",
         "UNRELATED_FILE_CHANGE"}
        print("SAFE_CACHEBUST_RELEASE_STOPPED:",str(e) if str(e) in allowed else type(e).__name__,flush=True)
        sys.exit(1)
