"""Narrow reversible release of TEST-only YooKassa widget diagnostics on REG.RU.
Only TEST wallet JS and its query-string version in live index.html; no payment API changes.
"""
import ftplib,hashlib,io,os,ssl,subprocess,sys,time,urllib.request,urllib.error
DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD_DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
JS="wallet-owner-flow-20261106.js"
OLD_REF="bd169644edff7bf4b4badefe9d0834b60fd06772"
NEW_REF="3bd72b28ed943f30e9e78db6b6ec06aafb54a407"
OLD_TAG=b"wallet-owner-flow-20261106.js?v=bffee56b2774"
NEW_TAG=b"wallet-owner-flow-20261106.js?v=470b948530dc"
MAX=5_000_000
def git(ref,p):return subprocess.check_output(["git","show",ref+":"+p],timeout=22)
def digest(b):return hashlib.sha256(b).hexdigest()
def web(p):
    req=urllib.request.Request("https://"+DOMAIN+"/"+p+("&" if "?" in p else "?")+"audit="+str(time.time_ns()),headers={"Cache-Control":"no-cache","Pragma":"no-cache"})
    with urllib.request.urlopen(req,timeout=26) as response:
        content=response.read(MAX+1)
        if response.status!=200 or len(content)>MAX or response.geturl().split("/")[2]!=DOMAIN:raise RuntimeError("PUBLIC_HTTP_FAILED")
        return content
def guest(origin):
    req=urllib.request.Request("https://"+DOMAIN+"/api/numi-wallet-test.php",
      data=b'{"action":"status"}',method="POST",headers={"Content-Type":"application/json","Origin":origin})
    try:
        with urllib.request.urlopen(req,timeout=20) as response:return response.status
    except urllib.error.HTTPError as e:return e.code

def main():
    before=git(OLD_REF,JS); after=git(NEW_REF,JS)
    if after!=git("HEAD",JS):raise RuntimeError("MAIN_JS_CHANGED")
    for marker in (b'error_callback:(error)',b'WIDGET_RENDER_TIMEOUT',b'OWNER_TEST_ONLY',b'paymentWidget.on("complete"',b'request("topup_widget"'):
        if marker not in after:raise RuntimeError("TEST_WIDGET_MARKER_MISSING")
    if b"secret_key" in after:raise RuntimeError("CLIENT_SECRET_MARKER")
    index=web("index.html")
    if index.count(OLD_TAG)!=1 or NEW_TAG in index:raise RuntimeError("INDEX_TAG_DRIFT")
    modified=index.replace(OLD_TAG,NEW_TAG)
    if modified.replace(NEW_TAG,OLD_TAG)!=index:raise RuntimeError("INDEX_CHANGE_UNEXPECTED")
    if web(JS)!=before:raise RuntimeError("LIVE_JS_DRIFT")
    if guest("https://"+DOMAIN)!=401 or guest("https://malicious.invalid")!=403:
        raise RuntimeError("AUTH_BASELINE_FAILED")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=27)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    changed=[]
    try:
        home=ftp.pwd().rstrip("/")
        def read(p):
            buf=bytearray()
            def add(x):
                buf.extend(x)
                if len(buf)>MAX:raise RuntimeError("FTP_FILE_TOO_LARGE")
            try:ftp.retrbinary("RETR "+p,add)
            except ftplib.error_perm as e:
                if str(e).startswith("550"):return None
                raise
            return bytes(buf)
        def put(p,data):
            ftp.storbinary("STOR "+p,io.BytesIO(data))
            if read(p)!=data:raise RuntimeError("FTP_VERIFY_FAILED")
        root=None
        for folder in ("www/"+DOMAIN,"www/"+OLD_DOMAIN):
            candidate=home+"/"+folder
            if read(candidate+"/index.html")==index:root=candidate;break
        if root is None:raise RuntimeError("LIVE_ROOT_UNVERIFIED")
        pjs=root+"/"+JS; pindex=root+"/index.html"
        if read(pjs)!=before:raise RuntimeError("LIVE_JS_CHANGED")
        protected=("app.js","account-browser.js","auth-profile.js",".htaccess")
        fingerprints={}
        for p in protected:
            blob=read(root+"/"+p)
            if blob is None:raise RuntimeError("PROTECTED_FILE_MISSING")
            fingerprints[p]=digest(blob)
        backups=home+"/site-safeguard-backups"
        try:ftp.mkd(backups)
        except ftplib.error_perm:ftp.cwd(backups)
        backup=backups+"/test-widget-diagnostics-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        put(backup+"/index-before.html.bak",index)
        put(backup+"/wallet-test-js-before.js.bak",before)
        print("TEST_WIDGET_DIAGNOSTIC_BACKUPS_VERIFIED",flush=True)
        if read(pjs)!=before or read(pindex)!=index:raise RuntimeError("CONCURRENT_SITE_CHANGE")
        try:
            changed.append((pjs,before));put(pjs,after)
            changed.append((pindex,index));put(pindex,modified)
            if web("index.html")!=modified or web(JS+"?v=470b948530dc")!=after:
                raise RuntimeError("PUBLIC_DIAGNOSTIC_VERIFICATION_FAILED")
            if guest("https://"+DOMAIN)!=401 or guest("https://malicious.invalid")!=403:
                raise RuntimeError("OWNER_ONLY_AUTH_REGRESSION")
            for p,h in fingerprints.items():
                if digest(read(root+"/"+p) or b"")!=h:raise RuntimeError("NONTEST_FILE_CHANGED")
            print("TEST_WIDGET_DIAGNOSTIC_PUBLISHED_VERIFIED",flush=True)
            print("UNCHANGED: normal site and account, bot, database, private API, real payment processing",flush=True)
        except BaseException:
            for p,old in reversed(changed):
                try:put(p,old);print("ROLLBACK_VERIFIED",flush=True)
                except BaseException:print("ROLLBACK_FAILED_MANUAL_REVIEW_REQUIRED",flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        allowed={"PUBLIC_HTTP_FAILED","MAIN_JS_CHANGED","TEST_WIDGET_MARKER_MISSING","CLIENT_SECRET_MARKER","INDEX_TAG_DRIFT",
          "INDEX_CHANGE_UNEXPECTED","LIVE_JS_DRIFT","AUTH_BASELINE_FAILED","FTP_FILE_TOO_LARGE","FTP_VERIFY_FAILED",
          "LIVE_ROOT_UNVERIFIED","LIVE_JS_CHANGED","PROTECTED_FILE_MISSING","CONCURRENT_SITE_CHANGE",
          "PUBLIC_DIAGNOSTIC_VERIFICATION_FAILED","OWNER_ONLY_AUTH_REGRESSION","NONTEST_FILE_CHANGED"}
        print("TEST_WIDGET_DIAGNOSTIC_RELEASE_STOPPED:",str(e) if str(e) in allowed else type(e).__name__,flush=True)
        sys.exit(1)
