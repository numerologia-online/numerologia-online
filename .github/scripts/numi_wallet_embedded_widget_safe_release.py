"""One-time owner-only TEST YooKassa embedded widget deployment on REG.RU.
Only private TEST core, one TEST JS and one test JS URL in the live index.
No real payment code, databases, bot, account or paid product files touched.
"""
import ftplib,hashlib,io,os,ssl,subprocess,sys,time,urllib.request,urllib.error

DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD_DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
JS="wallet-owner-flow-20261106.js"
CORE="wallet-service/private/test-core.php"
OLD_JS_REF="9aa9507874e4e76f0eb8825fc4ae3a85d0b08655"
NEW_JS_REF="bd169644edff7bf4b4badefe9d0834b60fd06772"
OLD_CORE_REF="810f302451157fc864d9b915bf91f3fadb693d2e"
NEW_CORE_REF="439f959233b9ecdc28d92c96a88ddde85a0664ae"
OLD_TAG=b"wallet-owner-flow-20261106.js?v=b35c41117e20"
NEW_TAG=b"wallet-owner-flow-20261106.js?v=bffee56b2774"
MAX=5_000_000

def get_source(ref,path):
    return subprocess.check_output(["git","show",ref+":"+path],timeout=22)
def sha(blob):return hashlib.sha256(blob).hexdigest()
def http(path):
    url="https://"+DOMAIN+"/"+path+("&" if "?" in path else "?")+"validation="+str(time.time_ns())
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache"})
    with urllib.request.urlopen(req,timeout=25) as response:
        blob=response.read(MAX+1)
        if response.status!=200 or len(blob)>MAX or response.geturl().split("/")[2]!=DOMAIN:
            raise RuntimeError("HTTP_PUBLIC_VERIFICATION_FAILED")
        return blob
def guest_status(origin):
    request=urllib.request.Request("https://"+DOMAIN+"/api/numi-wallet-test.php",
        data=b'{"action":"status"}',method="POST",
        headers={"Content-Type":"application/json","Origin":origin})
    try:
        with urllib.request.urlopen(request,timeout=20) as response:return response.status
    except urllib.error.HTTPError as exc:return exc.code

def main():
    oldjs=get_source(OLD_JS_REF,JS)
    newjs=get_source(NEW_JS_REF,JS)
    oldcore=get_source(OLD_CORE_REF,CORE)
    newcore=get_source(NEW_CORE_REF,CORE)
    if get_source("HEAD",JS)!=newjs:raise RuntimeError("MAIN_FRONTEND_NOT_PINNED")
    if not newcore.startswith(oldcore[:oldcore.index(b"function wtSync(")]):
        # New code is inserted immediately before wtSync, original prefix through old topup is identical.
        raise RuntimeError("UNEXPECTED_SERVER_CHANGE")
    if (newcore.count(b"function wtTopupWidget(")!=1 or
        b"if ($action==='topup_widget') wtTopupWidget(" not in newcore or
        b"wtOwnerOnly($current)" not in newcore or
        b"WT_TEST_SHOP_ID = '1521071'" not in newcore or
        b"'confirmation'=>['type'=>'embedded']" not in newcore):
        raise RuntimeError("TEST_ONLY_EMBEDDED_GUARDS_MISSING")
    if (newjs.count(b"request(\"topup_widget\"")!=1 or
        b"YooMoneyCheckoutWidget" not in newjs or
        b"request(\"sync\",{payment_ref:paymentRef})" not in newjs or
        b"OWNER_TEST_ONLY" not in newjs or
        b"secret_key" in newjs):
        raise RuntimeError("TEST_WIDGET_CLIENT_GUARDS_MISSING")

    original_index=http("index.html")
    if original_index.count(OLD_TAG)!=1 or NEW_TAG in original_index:
        raise RuntimeError("INDEX_TAG_BASELINE_DRIFT")
    changed_index=original_index.replace(OLD_TAG,NEW_TAG)
    if changed_index.replace(NEW_TAG,OLD_TAG)!=original_index:
        raise RuntimeError("INDEX_NON_ISOLATED_CHANGE")
    if http(JS)!=oldjs:raise RuntimeError("LIVE_TEST_JS_DRIFT")
    if guest_status("https://"+DOMAIN)!=401 or guest_status("https://untrusted.example.invalid")!=403:
        raise RuntimeError("EXISTING_TEST_AUTH_FAILED")

    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=27)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    changes=[]
    try:
        home=ftp.pwd().rstrip("/")
        def read(p):
            data=bytearray()
            def append(chunk):
                data.extend(chunk)
                if len(data)>MAX:raise RuntimeError("FTP_FILE_TOO_LARGE")
            try:ftp.retrbinary("RETR "+p,append)
            except ftplib.error_perm as e:
                if str(e).startswith("550"):return None
                raise
            return bytes(data)
        def put(p,blob):
            ftp.storbinary("STOR "+p,io.BytesIO(blob))
            if read(p)!=blob:raise RuntimeError("FTP_WRITE_MISMATCH")

        root=None
        for folder in ("www/"+DOMAIN,"www/"+OLD_DOMAIN):
            value=home+"/"+folder
            if read(value+"/index.html")==original_index:
                root=value;break
        if root is None:raise RuntimeError("LIVE_SITE_ROOT_NOT_MATCHED")
        index_path=root+"/index.html"
        js_path=root+"/"+JS
        core_path=home+"/private/numi-wallet-test-20261106/core.php"
        if read(js_path)!=oldjs or read(core_path)!=oldcore:
            raise RuntimeError("LIVE_TEST_FILES_CHANGED_STOP")
        unaffected=("app.js","account-browser.js","auth-profile.js",".htaccess")
        hashes={}
        for name in unaffected:
            blob=read(root+"/"+name)
            if blob is None:raise RuntimeError("OTHER_SITE_FILE_NOT_FOUND")
            hashes[name]=sha(blob)
        backups=home+"/site-safeguard-backups"
        try:ftp.mkd(backups)
        except ftplib.error_perm:ftp.cwd(backups)
        folder=backups+"/yookassa-test-embedded-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(folder)
        put(folder+"/test-core-before.php.bak",oldcore)
        put(folder+"/test-wallet-before.js.bak",oldjs)
        put(folder+"/index-before.html.bak",original_index)
        print("EMBEDDED_TEST_BACKUPS_VERIFIED",flush=True)
        if (read(core_path)!=oldcore or read(js_path)!=oldjs or
            read(index_path)!=original_index):
            raise RuntimeError("CONCURRENT_TEST_CHANGE")
        try:
            changes.append((core_path,oldcore));put(core_path,newcore)
            changes.append((js_path,oldjs));put(js_path,newjs)
            # New URL loads the new test UI; homepage is updated last.
            changes.append((index_path,original_index));put(index_path,changed_index)
            if http("index.html")!=changed_index:
                raise RuntimeError("PUBLIC_INDEX_NOT_UPDATED")
            if http(JS+"?v=bffee56b2774")!=newjs:
                raise RuntimeError("PUBLIC_TEST_JS_NOT_UPDATED")
            if read(core_path)!=newcore:
                raise RuntimeError("PRIVATE_TEST_CORE_NOT_UPDATED")
            if guest_status("https://"+DOMAIN)!=401 or guest_status("https://untrusted.example.invalid")!=403:
                raise RuntimeError("TEST_AUTH_REGRESSION")
            for name,expected in hashes.items():
                if sha(read(root+"/"+name) or b"")!=expected:
                    raise RuntimeError("NONTEST_FILE_CHANGED")
            print("TEST_EMBEDDED_WIDGET_PUBLISHED_AND_VERIFIED",flush=True)
            print("UNCHANGED: normal site logic, account, bot, real gateway, subscriptions, database",flush=True)
            print("OWNER_ONLY: all payments still test:true, no real entitlements or charges",flush=True)
        except BaseException:
            for path,old in reversed(changes):
                try:put(path,old);print("TEST_FILE_ROLLBACK_VERIFIED",flush=True)
                except BaseException:print("ROLLBACK_FAILED_MANUAL_REVIEW_REQUIRED",flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:main()
    except BaseException as exc:
        allowed={"HTTP_PUBLIC_VERIFICATION_FAILED","MAIN_FRONTEND_NOT_PINN",
            "UNEXPECTED_SERVER_CHANGE","TEST_ONLY_EMBEDDED_GUARDS_MISSING",
            "TEST_WIDGET_CLIENT_GUARDS_MISSING","INDEX_TAG_BASELINE_DRIFT",
            "INDEX_NON_ISOLATED_CHANGE","LIVE_TEST_JS_DRIFT","EXISTING_TEST_AUTH_FAILED",
            "FTP_FILE_TOO_LARGE","FTP_WRITE_MISMATCH","LIVE_SITE_ROOT_NOT_MATCHED",
            "LIVE_TEST_FILES_CHANGED_STOP","OTHER_SITE_FILE_NOT_FOUND",
            "CONCURRENT_TEST_CHANGE","PUBLIC_INDEX_NOT_UPDATED","PUBLIC_TEST_JS_NOT_UPDATED",
            "PRIVATE_TEST_CORE_NOT_UPDATED","TEST_AUTH_REGRESSION","NONTEST_FILE_CHANGED"}
        reason=str(exc) if str(exc) in allowed else type(exc).__name__
        print("EMBEDDED_TEST_SAFE_RELEASE_STOPPED:",reason,flush=True)
        sys.exit(1)
