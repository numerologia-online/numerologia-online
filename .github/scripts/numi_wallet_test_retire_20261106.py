"""Retire all owner-only wallet TEST public routes and private TEST code from REG.RU.
Do not create any backup. Do not touch production PHP, orders, accounts, bot, database,
or backups. All edits fail closed if actual live site or test assets changed.
"""
import ftplib,hashlib,io,os,ssl,sys,time,urllib.request,urllib.error,subprocess
DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD_DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
MAX=5_000_000
SCRIPT=b'  <script src="wallet-owner-flow-20261106.js?v=51f51f0b664f" defer></script>\n'
PUBLIC={
 "wallet-owner-flow-20261106.js":b"numi-wallet-test.php",
 "wallet-test-checkout-20261106.js":b"YooMoneyCheckoutWidget",
 "wallet-test-checkout-20261106.html":b"wallet-test-checkout-20261106.js",
 "api/numi-wallet-test.php":b"wtServe()",
 "wallet-test.html":b"numi",
 "wallet-sandbox-preview-20261106.html":b"wallet"
}
PRIVATE=(
 "core.php","config.local.php","schema-test.sql",
 "schema-subscriptions-test.sql","subscriptions-test.php"
)
def sha(x):return hashlib.sha256(x).hexdigest()
def http(path):
    url="https://"+DOMAIN+"/"+path+("?" if "?" not in path else "&")+"retire="+str(time.time_ns())
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache"})
    try:
        with urllib.request.urlopen(req,timeout=26) as r:
            x=r.read(MAX+1)
            if r.status!=200 or len(x)>MAX or r.geturl().split("/")[2]!=DOMAIN:
                raise RuntimeError("HTTP_BASELINE_FAILED")
            return x
    except urllib.error.HTTPError as e:
        if e.code==404:return None
        raise

def main():
    index=http("index.html")
    if index is None or index.count(SCRIPT)!=1 or index.count(b"wallet-owner-flow-20261106.js")!=1:
        raise RuntimeError("INDEX_TEST_TAG_DRIFT")
    cleaned=index.replace(SCRIPT,b"",1)
    if cleaned.count(b"wallet-owner-flow-20261106.js")!=0:
        raise RuntimeError("TEST_SCRIPT_TAG_REMAINS")
    old_live_js=subprocess.check_output(["git","show","fed25a77f86d7310e6f20548f27cd993c6c4d202:wallet-owner-flow-20261106.js"],timeout=20)
    if http("wallet-owner-flow-20261106.js")!=old_live_js:
        raise RuntimeError("LIVE_TEST_UI_DRIFT")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=28)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    try:
        home=ftp.pwd().rstrip("/")
        def read(path):
            b=bytearray()
            def add(x):
                b.extend(x)
                if len(b)>MAX:raise RuntimeError("FILE_TOO_LARGE")
            try:ftp.retrbinary("RETR "+path,add)
            except ftplib.error_perm as e:
                if str(e).startswith("550"):return None
                raise
            return bytes(b)
        def put(path,content):
            ftp.storbinary("STOR "+path,io.BytesIO(content))
            if read(path)!=content:raise RuntimeError("VERIFY_WRITE_FAILED")
        root=None
        for candidate in ("www/"+DOMAIN,"www/"+OLD_DOMAIN):
            p=home+"/"+candidate
            if read(p+"/index.html")==index:root=p;break
        if root is None:raise RuntimeError("LIVE_SITE_ROOT_MISMATCH")
        protected=("app.js","account-browser.js","auth-profile.js",".htaccess","api/numi-account.php")
        fingerprints={}
        for name in protected:
            content=read(root+"/"+name)
            if content is None:raise RuntimeError("PROTECTED_FILE_MISSING")
            fingerprints[name]=sha(content)
        private=home+"/private/numi-wallet-test-20261106"
        pubpresent={}
        for name,marker in PUBLIC.items():
            content=read(root+"/"+name)
            if content is None:continue
            if marker not in content:raise RuntimeError("PUBLIC_TEST_FILE_UNEXPECTED_"+name)
            pubpresent[name]=sha(content)
        if "api/numi-wallet-test.php" not in pubpresent or "wallet-owner-flow-20261106.js" not in pubpresent:
            raise RuntimeError("REQUIRED_TEST_FILES_MISSING")
        privatepresent={}
        for name in PRIVATE:
            content=read(private+"/"+name)
            if content is None:continue
            if name=="core.php" and b"WT_TEST_SHOP_ID = '1521071'" not in content:
                raise RuntimeError("PRIVATE_TEST_CORE_UNEXPECTED")
            if name=="config.local.php" and (b"test_" not in content or len(content)>10000):
                raise RuntimeError("PRIVATE_TEST_CONFIG_UNEXPECTED")
            privatepresent[name]=sha(content)
        if "core.php" not in privatepresent or "config.local.php" not in privatepresent:
            raise RuntimeError("PRIVATE_TEST_FILES_MISSING")
        if read(root+"/index.html")!=index:raise RuntimeError("CONCURRENT_SITE_CHANGE")
        print("RETIRE_PREFLIGHT_OK public_count="+str(len(pubpresent))+" private_count="+str(len(privatepresent)),flush=True)
        print("NO_NEW_BACKUPS_CREATED",flush=True)
        # Remove script reference first, so site can no longer open test wallet after reload.
        put(root+"/index.html",cleaned)
        if http("index.html")!=cleaned:
            put(root+"/index.html",index)
            raise RuntimeError("PUBLIC_INDEX_DISABLE_FAILED")
        print("TEST_SCRIPT_REMOVED_FROM_LIVE_HOME",flush=True)
        # Delete strictly identified test-only assets. No other path can be deleted.
        for name,expected in pubpresent.items():
            p=root+"/"+name
            if sha(read(p) or b"")!=expected:raise RuntimeError("TEST_FILE_CHANGED_STOP")
            ftp.delete(p)
            if read(p) is not None:raise RuntimeError("TEST_FILE_DELETE_FAILED")
            print("TEST_PUBLIC_REMOVED "+name,flush=True)
        for name,expected in privatepresent.items():
            p=private+"/"+name
            if sha(read(p) or b"")!=expected:raise RuntimeError("TEST_PRIVATE_CHANGED_STOP")
            ftp.delete(p)
            if read(p) is not None:raise RuntimeError("TEST_PRIVATE_DELETE_FAILED")
            print("TEST_PRIVATE_REMOVED "+name,flush=True)
        try:
            names=ftp.nlst(private)
            if len(names)==0:ftp.rmd(private)
            else:print("PRIVATE_TEST_FOLDER_HAS_UNEXPECTED_CONTENT; kept directory",flush=True)
        except ftplib.error_perm:
            pass
        for name in PUBLIC:
            if http(name) is not None:raise RuntimeError("TEST_PUBLIC_STILL_SERVING")
        if http("index.html")!=cleaned:raise RuntimeError("PUBLIC_INDEX_REGRESSION")
        for name,expected in fingerprints.items():
            if sha(read(root+"/"+name) or b"")!=expected:
                raise RuntimeError("PROTECTED_FILE_CHANGED")
        print("WALLET_TEST_PUBLIC_AND_PRIVATE_CODE_REMOVED_VERIFIED",flush=True)
        print("UNCHANGED: account, bot, real payments, school, app, database, backups",flush=True)
        # Existing backups are only inventoried, never added or deleted.
        backup_prefixes=("owner-wallet","wallet","test-wallet","yookassa-test-embedded",
           "test-external-browser","test-credit-reconcile","test-widget-diagnostics",
           "standalone-test-checkout","test-checkout-","test-subs","numi-wallet")
        backdir=home+"/site-safeguard-backups"
        try:
            items=ftp.nlst(backdir)
            dirs=[x.rsplit("/",1)[-1] for x in items]
            matches=[x for x in dirs if x.startswith(backup_prefixes)]
            print("EXISTING_PAYMENT_TEST_BACKUP_FOLDERS_COUNT",len(matches),flush=True)
        except ftplib.all_errors:
            print("EXISTING_BACKUPS_NOT_LISTED",flush=True)
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        safe=("INDEX_TEST_TAG_DRIFT","TEST_SCRIPT_TAG_REMAINS","LIVE_TEST_UI_DRIFT","HTTP_BASELINE_FAILED",
          "FILE_TOO_LARGE","VERIFY_WRITE_FAILED","LIVE_SITE_ROOT_MISMATCH",
          "PROTECTED_FILE_MISSING","REQUIRED_TEST_FILES_MISSING",
          "PRIVATE_TEST_CORE_UNEXPECTED","PRIVATE_TEST_CONFIG_UNEXPECTED",
          "PRIVATE_TEST_FILES_MISSING","CONCURRENT_SITE_CHANGE",
          "PUBLIC_INDEX_DISABLE_FAILED","TEST_FILE_CHANGED_STOP","TEST_FILE_DELETE_FAILED",
          "TEST_PRIVATE_CHANGED_STOP","TEST_PRIVATE_DELETE_FAILED",
          "TEST_PUBLIC_STILL_SERVING","PUBLIC_INDEX_REGRESSION","PROTECTED_FILE_CHANGED")
        m=str(e)
        print("WALLET_TEST_RETIRE_STOPPED:",m if m in safe or m.startswith("PUBLIC_TEST_FILE_UNEXPECTED_") else type(e).__name__,flush=True)
        sys.exit(1)
