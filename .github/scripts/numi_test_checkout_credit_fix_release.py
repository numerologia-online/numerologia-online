"""Safe REG.RU release of successful TEST checkout reconciliation.
Only two test-only files: dedicated checkout JS and its HTML script cache version.
Backup, exact baseline guards, hash-verification and rollback. No real merchant code changes.
"""
import ftplib,hashlib,io,os,ssl,subprocess,sys,time,urllib.request
DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD_DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
HTML="wallet-test-checkout-20261106.html"
JS="wallet-test-checkout-20261106.js"
OLD_REF="f0f1c673ef0d6203c1d516401abd23b98f363419"
NEW_REF="d5c925b79c4a07ef06ee497d7d3c1ff12e4e8d81"
OLD_TAG=b"/wallet-test-checkout-20261106.js?v=1"
NEW_TAG=b"/wallet-test-checkout-20261106.js?v=2"
MAX=500000
def source(ref,p):
    return subprocess.check_output(["git","show",ref+":"+p],timeout=18)
def digest(x):
    return hashlib.sha256(x).hexdigest()
def http(p):
    q="&" if "?" in p else "?"
    req=urllib.request.Request("https://"+DOMAIN+"/"+p+q+"check="+str(time.time_ns()),headers={"Cache-Control":"no-cache","Pragma":"no-cache"})
    with urllib.request.urlopen(req,timeout=26) as r:
        x=r.read(MAX+1)
        if r.status!=200 or len(x)>MAX or r.geturl().split("/")[2]!=DOMAIN:
            raise RuntimeError("PUBLIC_VERIFICATION_FAILED")
        return x
def main():
    old_js=source(OLD_REF,JS);new_js=source(NEW_REF,JS)
    if new_js!=source("HEAD",JS):raise RuntimeError("MAIN_JS_CHANGED")
    old_html=source(OLD_REF,HTML)
    if old_html.count(OLD_TAG)!=1 or NEW_TAG in old_html:
        raise RuntimeError("HTML_TAG_DRIFT")
    new_html=old_html.replace(OLD_TAG,NEW_TAG)
    if (b"d.payment_status===undefined" not in new_js or
        b"Number.isFinite(Number(d.balance_kopeks))" not in new_js or
        b"YooMoneyCheckoutWidget" not in new_js or
        b"OWNER_TEST_ONLY" not in new_js or b"secret_key" in new_js):
        raise RuntimeError("TEST_SAFETY_CHECK_FAILED")
    if http(HTML)!=old_html or http(JS)!=old_js:
        raise RuntimeError("LIVE_TEST_ASSETS_DRIFT")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=27)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    changed=[]
    try:
        home=ftp.pwd().rstrip("/")
        def read(p):
            buf=bytearray()
            def add(x):
                buf.extend(x)
                if len(buf)>MAX:raise RuntimeError("FTP_OVERSIZE")
            try:ftp.retrbinary("RETR "+p,add)
            except ftplib.error_perm as e:
                if str(e).startswith("550"):return None
                raise
            return bytes(buf)
        def put(p,data):
            ftp.storbinary("STOR "+p,io.BytesIO(data))
            if read(p)!=data:raise RuntimeError("FTP_UPLOAD_VERIFY_FAILED")
        root=None
        live_index=http("index.html")
        for candidate in ("www/"+DOMAIN,"www/"+OLD_DOMAIN):
            r=home+"/"+candidate
            if read(r+"/index.html")==live_index:
                root=r;break
        if root is None:raise RuntimeError("LIVE_ROOT_MISMATCH")
        phtml=root+"/"+HTML;pjs=root+"/"+JS
        if read(phtml)!=old_html or read(pjs)!=old_js:raise RuntimeError("TEST_FILE_BASELINE_CHANGED")
        backup_base=home+"/site-safeguard-backups"
        try:ftp.mkd(backup_base)
        except ftplib.error_perm:ftp.cwd(backup_base)
        folder=backup_base+"/test-credit-reconcile-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(folder)
        put(folder+"/checkout-old.js.bak",old_js)
        put(folder+"/checkout-old.html.bak",old_html)
        print("TEST_CREDIT_RECONCILIATION_BACKUPS_VERIFIED",flush=True)
        if read(phtml)!=old_html or read(pjs)!=old_js:raise RuntimeError("CONCURRENT_TEST_SITE_CHANGE")
        try:
            changed.append((pjs,old_js));put(pjs,new_js)
            changed.append((phtml,old_html));put(phtml,new_html)
            if http(HTML)!=new_html or http(JS+"?v=2")!=new_js:
                raise RuntimeError("PUBLIC_CREDIT_RELEASE_VERIFY_FAILED")
            if read(root+"/index.html")!=live_index:
                raise RuntimeError("MAIN_INDEX_CHANGED")
            print("TEST_CHECKOUT_CREDIT_RECONCILIATION_PUBLISHED",flush=True)
            print("UNCHANGED: main site, account, bot, real payments, test PHP, database",flush=True)
        except BaseException:
            for p,old in reversed(changed):
                try:put(p,old);print("TEST_ROLLBACK_VERIFIED",flush=True)
                except BaseException:print("ROLLBACK_FAILED_MANUAL_REVIEW_REQUIRED",flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        allowed={"MAIN_JS_CHANGED","HTML_TAG_DRIFT","TEST_SAFETY_CHECK_FAILED","LIVE_TEST_ASSETS_DRIFT","FTP_OVERSIZE","FTP_UPLOAD_VERIFY_FAILED","LIVE_ROOT_MISMATCH","TEST_FILE_BASELINE_CHANGED","CONCURRENT_TEST_SITE_CHANGE","PUBLIC_CREDIT_RELEASE_VERIFY_FAILED","MAIN_INDEX_CHANGED","PUBLIC_VERIFICATION_FAILED"}
        print("TEST_CREDIT_RELEASE_STOPPED:",str(e) if str(e) in allowed else type(e).__name__,flush=True);sys.exit(1)
