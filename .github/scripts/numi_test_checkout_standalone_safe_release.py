"""Release one standalone owner-only TEST checkout page to REG.RU safely.
Changes strictly: 2 new TEST checkout files, 1 existing owner-only TEST JS,
and one URL query in live index.html. No live payment PHP/DB/account/bot changes.
"""
import ftplib,hashlib,io,os,ssl,subprocess,sys,time,urllib.request,urllib.error

DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD_DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
UI="wallet-owner-flow-20261106.js"
HTML="wallet-test-checkout-20261106.html"
JS="wallet-test-checkout-20261106.js"
OLD_UI_REF="3bd72b28ed943f30e9e78db6b6ec06aafb54a407"
NEW_UI_REF="fed25a77f86d7310e6f20548f27cd993c6c4d202"
OLD_TAG=b"wallet-owner-flow-20261106.js?v=470b948530dc"
NEW_TAG=b"wallet-owner-flow-20261106.js?v=51f51f0b664f"
MAX_BYTES=5_000_000

def source(ref,p):
    return subprocess.check_output(["git","show",ref+":"+p],timeout=20)
def digest(b):return hashlib.sha256(b).hexdigest()
def http(p,allow_missing=False):
    suffix=("&" if "?" in p else "?")+"check="+str(time.time_ns())
    url="https://"+DOMAIN+"/"+p+suffix
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache"})
    try:
        with urllib.request.urlopen(req,timeout=26) as r:
            data=r.read(MAX_BYTES+1)
            if r.status!=200 or len(data)>MAX_BYTES or r.geturl().split("/")[2]!=DOMAIN:
                raise RuntimeError("PUBLIC_HTTP_FAILED")
            return data
    except urllib.error.HTTPError as exc:
        if exc.code==404 and allow_missing:return None
        raise

def guest_code(origin,action):
    req=urllib.request.Request("https://"+DOMAIN+"/api/numi-wallet-test.php",
         data=("{\"action\":\""+action+"\"}").encode(),method="POST",
         headers={"Content-Type":"application/json","Origin":origin})
    try:
        with urllib.request.urlopen(req,timeout=20) as r:return r.status
    except urllib.error.HTTPError as exc:return exc.code

def main():
    before_js=source(OLD_UI_REF,UI)
    after_js=source(NEW_UI_REF,UI)
    new_html=source("HEAD",HTML)
    new_script=source("HEAD",JS)
    if after_js!=source("HEAD",UI):
        raise RuntimeError("MAIN_UI_VERSION_DRIFT")
    if (b"wallet-test-checkout-20261106.html" not in after_js
        or b"topup_widget" not in new_script
        or b"OWNER_TEST_ONLY" not in new_script
        or b"YooMoneyCheckoutWidget" not in new_script
        or b"wallet-test-checkout-20261106.js?v=1" not in new_html
        or b"<dialog" in new_html
        or b"secret_key" in new_script):
        raise RuntimeError("STANDALONE_TEST_GUARD_FAILED")
    if after_js.count(b'wallet-test-checkout-20261106.html')!=1:
        raise RuntimeError("TEST_BUTTON_NOT_UNIQUE")
    index=http("index.html")
    if index.count(OLD_TAG)!=1 or NEW_TAG in index:
        raise RuntimeError("INDEX_SCRIPT_VERSION_DRIFT")
    changed_index=index.replace(OLD_TAG,NEW_TAG)
    if changed_index.replace(NEW_TAG,OLD_TAG)!=index:
        raise RuntimeError("INDEX_SCOPE_MISMATCH")
    if http(UI)!=before_js:
        raise RuntimeError("LIVE_OWNER_JS_CHANGED")
    if http(HTML,True) is not None or http(JS,True) is not None:
        raise RuntimeError("NEW_FILES_ALREADY_EXIST")
    if guest_code("https://"+DOMAIN,"status")!=401 or guest_code("https://malicious.invalid","topup_widget")!=403:
        raise RuntimeError("TEST_API_GUEST_AUTH_DRIFT")

    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=28)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    changed=[]
    try:
        home=ftp.pwd().rstrip("/")
        def read(path):
            data=bytearray()
            def add(block):
                data.extend(block)
                if len(data)>MAX_BYTES:raise RuntimeError("FTP_SIZE_EXCEEDED")
            try:ftp.retrbinary("RETR "+path,add)
            except ftplib.error_perm as e:
                if str(e).startswith("550"):return None
                raise
            return bytes(data)
        def put(path,data):
            ftp.storbinary("STOR "+path,io.BytesIO(data))
            if read(path)!=data:raise RuntimeError("UPLOAD_VERIFY_FAILED")
        root=None
        for candidate in ("www/"+DOMAIN,"www/"+OLD_DOMAIN):
            p=home+"/"+candidate
            if read(p+"/index.html")==index:root=p;break
        if root is None:raise RuntimeError("ACTUAL_SITE_ROOT_NOT_FOUND")
        pindex=root+"/index.html"
        pui=root+"/"+UI
        phtml=root+"/"+HTML
        pjs=root+"/"+JS
        if read(pui)!=before_js or read(phtml) is not None or read(pjs) is not None:
            raise RuntimeError("FTP_BASELINE_MISMATCH")
        unchanged=("app.js","account-browser.js","auth-profile.js",".htaccess")
        checks={}
        for name in unchanged:
            blob=read(root+"/"+name)
            if blob is None:raise RuntimeError("PROTECTED_SITE_FILE_MISSING")
            checks[name]=digest(blob)
        backups=home+"/site-safeguard-backups"
        try:ftp.mkd(backups)
        except ftplib.error_perm:ftp.cwd(backups)
        folder=backups+"/standalone-test-checkout-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(folder)
        put(folder+"/index-before.html.bak",index)
        put(folder+"/owner-wallet-before.js.bak",before_js)
        print("TEST_STANDALONE_BACKUPS_VERIFIED",flush=True)
        if read(pindex)!=index or read(pui)!=before_js or read(phtml) is not None or read(pjs) is not None:
            raise RuntimeError("CONCURRENT_SITE_CHANGE_STOP")
        try:
            # New files first, then owner-only test button, finally versioned reference.
            changed.append((phtml,None));put(phtml,new_html)
            changed.append((pjs,None));put(pjs,new_script)
            changed.append((pui,before_js));put(pui,after_js)
            changed.append((pindex,index));put(pindex,changed_index)
            if (http(HTML)!=new_html or http(JS)!=new_script or http(UI+"?v=51f51f0b664f")!=after_js
                or http("index.html")!=changed_index):
                raise RuntimeError("PUBLIC_TEST_RELEASE_MISMATCH")
            if (guest_code("https://"+DOMAIN,"status")!=401
                or guest_code("https://malicious.invalid","topup_widget")!=403):
                raise RuntimeError("TEST_API_AUTH_REGRESSION")
            for name,hash_before in checks.items():
                if digest(read(root+"/"+name) or b"")!=hash_before:
                    raise RuntimeError("UNRELATED_SITE_FILE_CHANGED")
            print("STANDALONE_TEST_CHECKOUT_PUBLISHED_AND_VERIFIED",flush=True)
            print("UNCHANGED: original normal site and account, real payments, bot, database, private wallet core",flush=True)
            print("TEST_ONLY: new files plus owner-only script and one HTML query parameter",flush=True)
        except BaseException:
            for path,original in reversed(changed):
                try:
                    if original is None:
                        ftp.delete(path)
                        if read(path) is not None:raise RuntimeError("NEW_FILE_NOT_DELETED")
                    else:put(path,original)
                    print("TEST_STANDALONE_ROLLBACK_VERIFIED",flush=True)
                except BaseException:
                    print("ROLLBACK_FAILED_MANUAL_REVIEW_REQUIRED",flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:main()
    except BaseException as e:
        allowed={"MAIN_UI_VERSION_DRIFT","STANDALONE_TEST_GUARD_FAILED","TEST_BUTTON_NOT_UNIQUE",
          "INDEX_SCRIPT_VERSION_DRIFT","INDEX_SCOPE_MISMATCH","LIVE_OWNER_JS_CHANGED",
          "NEW_FILES_ALREADY_EXIST","TEST_API_GUEST_AUTH_DRIFT","FTP_SIZE_EXCEEDED","UPLOAD_VERIFY_FAILED",
          "ACTUAL_SITE_ROOT_NOT_FOUND","FTP_BASELINE_MISMATCH","PROTECTED_SITE_FILE_MISSING",
          "CONCURRENT_SITE_CHANGE_STOP","PUBLIC_TEST_RELEASE_MISMATCH","TEST_API_AUTH_REGRESSION",
          "UNRELATED_SITE_FILE_CHANGED","PUBLIC_HTTP_FAILED"}
        print("STANDALONE_TEST_RELEASE_STOPPED:",str(e) if str(e) in allowed else type(e).__name__,flush=True)
        sys.exit(1)
