"""Install only isolated TEST subscription tables, owner PHP and wallet JS.
Makes private backups, uses token-protected one-time schema installer, preserves existing site.
No subscription renewal scheduler or real merchant is enabled.
"""
import ftplib,hashlib,io,json,os,secrets,ssl,subprocess,sys,time,urllib.request,urllib.error

DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD_DOMAIN="xn--c1adkkdfjbp1a4l.online"
FQDN="server172.hosting.reg.ru"
CORE="wallet-service/private/test-core.php"
SUBS="wallet-service/private/subscriptions-test.php"
SCHEMA="wallet-service/schema-subscriptions-test.sql"
JS="wallet-owner-flow-20261106.js"
OLD_CORE="ddeb6aeec637e1d9afcbb766b4d02157d29f400d"
NEW_CORE="bb6b3d85ca9466f57092711ebfbed0ff76e8adc3"
NEW_SUB="312d9d9bf9b8efe35b749093f9629d873f05da83"
NEW_SCHEMA="5b9038a92b6ec7c7d9379483ccf4cb81d59c9c43"
OLD_JS="fd11249560e309639613871f88a118799491fbce"
NEW_JS="66b8025d99e79ece3f600b4670a5c940807640d8"
MAX=750_000

def source(ref,path):
    return subprocess.check_output(["git","show",ref+":"+path],timeout=22)
def sha(value):
    return hashlib.sha256(value).hexdigest()
def http(path):
    url="https://"+DOMAIN+"/"+path+"?test_verification="+str(time.time_ns())
    with urllib.request.urlopen(urllib.request.Request(url,headers={"Cache-Control":"no-cache"}),timeout=24) as r:
        body=r.read(MAX+1)
        if r.status!=200 or len(body)>MAX or r.geturl().split("/")[2]!=DOMAIN:raise RuntimeError("HTTP_SITE_MISMATCH")
        return body
def post(path,body,headers=None):
    req=urllib.request.Request("https://"+DOMAIN+"/"+path,data=body,method="POST",
          headers={"Content-Type":"application/json",**(headers or {})})
    try:
        with urllib.request.urlopen(req,timeout=24) as r:return r.status,r.read(70000)
    except urllib.error.HTTPError as e:return e.code,e.read(70000)

def installer(token):
    php=r"""<?php
declare(strict_types=1);
header('Cache-Control: no-store');header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
if (($_SERVER['REQUEST_METHOD']??'')!=='POST'
    || !hash_equals('__TOKEN__',(string)($_SERVER['HTTP_X_NUMI_WALLET_INSTALL']??''))) {
 http_response_code(404); exit;
}
try {
 require dirname(__DIR__,3).'/private/db.php';
 $pdo=getDB();
 if (!$pdo instanceof PDO) throw new RuntimeException('DB_UNAVAILABLE');
 $pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
 $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES,false);
 $need=['numi_wallet_test_subscriptions','numi_wallet_test_subscription_charges'];
 $check=$pdo->prepare('SELECT TABLE_NAME FROM information_schema.tables
 WHERE table_schema=DATABASE() AND TABLE_NAME=?');
 foreach($need as $name) {
  $check->execute([$name]); if ($check->fetchColumn()) throw new RuntimeException('ALREADY_EXISTS');
 }
 $a=$pdo->query("SELECT DATA_TYPE,CHARACTER_MAXIMUM_LENGTH,CHARACTER_SET_NAME,COLLATION_NAME
  FROM information_schema.COLUMNS WHERE table_schema=DATABASE()
  AND TABLE_NAME='numi_accounts' AND COLUMN_NAME='id'")->fetch(PDO::FETCH_ASSOC);
 if(!is_array($a) || $a['DATA_TYPE']!=='char'||(int)$a['CHARACTER_MAXIMUM_LENGTH']!==36
   ||$a['CHARACTER_SET_NAME']!=='ascii'||$a['COLLATION_NAME']!=='ascii_bin')
   throw new RuntimeException('ACCOUNT_SCHEMA_MISMATCH');
 $sql=file_get_contents(dirname(__DIR__,3).'/private/numi-wallet-test-20261106/schema-subscriptions-test.sql');
 if(!is_string($sql) || strlen($sql)>50000)throw new RuntimeException('MIGRATION_MISSING');
 $parts=preg_split('/;\s*(?:\r?\n|$)/',$sql);
 $seen=[];$queries=[];
 foreach($parts as $part){
  $part=preg_replace('/^\s*--[^\r\n]*\r?\n/m','',$part);
  $part=trim($part);if($part==='')continue;
  if(!preg_match('/^CREATE TABLE IF NOT EXISTS (numi_wallet_test_[a-z_]+)\s*\(/',$part,$m)
    ||!in_array($m[1],$need,true)||in_array($m[1],$seen,true))
    throw new RuntimeException('MIGRATION_SCOPE_DENIED');
  $seen[]=$m[1];$queries[]=$part;
 }
 if(count($seen)!==2)throw new RuntimeException('MIGRATION_TABLE_COUNT_MISMATCH');
 foreach($queries as $query)$pdo->exec($query);
 foreach($need as $name){
  $check->execute([$name]);if(!$check->fetchColumn())throw new RuntimeException('TABLE_VERIFICATION_FAILED');
 }
 echo json_encode(['ok'=>true,'test'=>true,'created'=>2]);
} catch(Throwable $e){
 error_log('NUMI_TEST_SUBS_MIGRATION:'.get_class($e));
 http_response_code(503);echo json_encode(['ok'=>false,'error'=>'SUBS_MIGRATION_FAILED']);
}
""".replace("__TOKEN__",token)
    return php.encode("utf-8")

def main():
    old_core=source(OLD_CORE,CORE);new_core=source(NEW_CORE,CORE)
    sub=source(NEW_SUB,SUBS);schema=source(NEW_SCHEMA,SCHEMA)
    old_js=source(OLD_JS,JS);new_js=source(NEW_JS,JS)
    if b"WT_TEST_SHOP_ID = '1521071'" not in new_core or b"wtOwnerOnly($current)" not in new_core:
        raise RuntimeError("TEST_CORE_GUARD_MISSING")
    if b"require_once __DIR__.'/subscriptions-test.php';" not in new_core:
        raise RuntimeError("SUBS_BACKEND_NOT_ENABLED")
    for item in (b"save_payment_method",b"auto_renew_consent",b"wtSubCancel",b"payment_method_id"):
        if item not in sub:raise RuntimeError("SUBS_SAFETY_CHECK_FAILED")
    if schema.count(b"CREATE TABLE IF NOT EXISTS numi_wallet_test_")!=2:
        raise RuntimeError("SCHEMA_COUNT_MISMATCH")
    if b"subscription_cancel" not in new_js or b"numi-ow-auto-school" not in new_js:
        raise RuntimeError("FRONTEND_MISSING_SUBSCRIPTION_CONTROLS")
    anonymous,_=post("api/numi-wallet-test.php",b'{"action":"status"}',
         {"Origin":"https://"+DOMAIN})
    forbidden,_=post("api/numi-wallet-test.php",b'{"action":"status"}',
         {"Origin":"https://wrong-origin.example.invalid"})
    if anonymous!=401 or forbidden!=403:raise RuntimeError("EXISTING_TEST_API_GUARD_FAILED")
    if sha(http(JS))!=sha(old_js):raise RuntimeError("LIVE_PILOT_JS_DRIFT")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=25)
    ftp.connect(FQDN,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    uploaded=[];changed=[]
    try:
        home=ftp.pwd().rstrip("/")
        def read(path):
            buf=bytearray()
            def append(x):
                buf.extend(x)
                if len(buf)>MAX:raise RuntimeError("FTP_FILE_TOO_LARGE")
            try:ftp.retrbinary("RETR "+path,append)
            except ftplib.error_perm as ex:
                if str(ex).startswith("550"):return None
                raise
            return bytes(buf)
        def upload(path,value):
            ftp.storbinary("STOR "+path,io.BytesIO(value))
            if sha(read(path) or b"")!=sha(value):raise RuntimeError("UPLOAD_HASH_MISMATCH")
        current_index=http("index.html")
        site=None
        for candidate in ("www/"+DOMAIN,"www/"+OLD_DOMAIN):
            present=read(home+"/"+candidate+"/index.html")
            if present is not None and sha(present)==sha(current_index):
                site=home+"/"+candidate;break
        if site is None:raise RuntimeError("LIVE_SITE_ROOT_MISMATCH")
        private=home+"/private/numi-wallet-test-20261106"
        pcore=private+"/core.php";psub=private+"/subscriptions-test.php";pschema=private+"/schema-subscriptions-test.sql"
        pjs=site+"/"+JS
        if read(pcore)!=old_core or read(pjs)!=old_js:
            raise RuntimeError("SOURCE_FILE_BASELINE_DRIFT")
        if read(psub) is not None or read(pschema) is not None:
            raise RuntimeError("SUBS_ALREADY_STAGED")
        if read(private+"/config.local.php") is None:raise RuntimeError("TEST_CONFIG_NOT_FOUND")
        base={}
        for path in ("index.html","app.js","account-browser.js",".htaccess"):
            body=read(site+"/"+path)
            if body is None:raise RuntimeError("EXISTING_FILE_MISSING")
            base[path]=sha(body)
        backup_dir=home+"/site-safeguard-backups"
        try:ftp.mkd(backup_dir)
        except ftplib.error_perm:ftp.cwd(backup_dir)
        stamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        folder=backup_dir+"/owner-test-subs-"+stamp
        ftp.mkd(folder)
        upload(folder+"/core-before.php.bak",old_core)
        upload(folder+"/wallet-before.js.bak",old_js)
        print("SUBS_BACKUP_VERIFIED",flush=True)

        try:
            # Stage code and schema *outside* webroot before changing current service.
            uploaded.append(psub);upload(psub,sub)
            uploaded.append(pschema);upload(pschema,schema)

            token=secrets.token_urlsafe(36)
            temp_name="numi-test-sub-install-"+secrets.token_hex(12)+".php"
            path=site+"/api/"+temp_name
            if read(path) is not None:raise RuntimeError("INSTALLER_NAME_COLLISION")
            uploaded.append(path);upload(path,installer(token))
            try:
                status,body=post("api/"+temp_name,b"{}",{"X-Numi-Wallet-Install":token})
                try:response=json.loads(body)
                except Exception:response={}
                if status!=200 or response.get("ok") is not True or response.get("created")!=2:
                    raise RuntimeError("SUBS_SCHEMA_INSTALL_VERIFICATION_FAILED")
                print("TWO_NEW_TEST_SUBSCRIPTION_TABLES_CREATED",flush=True)
            finally:
                ftp.delete(path);uploaded.remove(path)

            if read(pcore)!=old_core or read(pjs)!=old_js:
                raise RuntimeError("CONCURRENT_PILOT_CHANGE")
            changed.append(pcore);upload(pcore,new_core)
            changed.append(pjs);upload(pjs,new_js)
            if sha(http(JS))!=sha(new_js):raise RuntimeError("PUBLIC_SUBS_UI_NOT_VERIFIED")
            anonymous,_=post("api/numi-wallet-test.php",b'{"action":"status"}',
                {"Origin":"https://"+DOMAIN})
            forbidden,_=post("api/numi-wallet-test.php",b'{"action":"status"}',
                {"Origin":"https://wrong-origin.example.invalid"})
            if anonymous!=401 or forbidden!=403:raise RuntimeError("SUBS_AUTH_GUARD_REGRESSION")
            for path,digest in base.items():
                if sha(read(site+"/"+path) or b"")!=digest:raise RuntimeError("EXISTING_SITE_FILE_CHANGED")
            print("TWO_TEST_SUBSCRIPTIONS_PUBLISHED_OWNER_ONLY; no renewal scheduler enabled.",flush=True)
            print("UNCHANGED: public site homepage, account, bot, real payment gateway, real entitlements",flush=True)
        except BaseException:
            for path in reversed(changed):
                try:
                    upload(path,old_core if path==pcore else old_js)
                    print("TEST_SUBS_CHANGE_RESTORED",flush=True)
                except Exception:print("TEST_SUBS_ROLLBACK_FAILED",flush=True)
            for path in reversed(uploaded):
                try:ftp.delete(path)
                except Exception:print("TEST_SUBS_CLEANUP_FAILED",flush=True)
            # Deliberately never drop MySQL tables (might have gained data).
            raise
    finally:
        try:ftp.quit()
        except Exception:ftp.close()

if __name__=="__main__":
    try:main()
    except BaseException as error:
        safe={"TEST_CORE_GUARD_MISSING","SUBS_BACKEND_NOT_ENABLED","SUBS_SAFETY_CHECK_FAILED","SCHEMA_COUNT_MISMATCH",
          "FRONTEND_MISSING_SUBSCRIPTION_CONTROLS","EXISTING_TEST_API_GUARD_FAILED","LIVE_PILOT_JS_DRIFT",
          "FTP_FILE_TOO_LARGE","UPLOAD_HASH_MISMATCH","LIVE_SITE_ROOT_MISMATCH","SOURCE_FILE_BASELINE_DRIFT",
          "SUBS_ALREADY_STAGED","TEST_CONFIG_NOT_FOUND","EXISTING_FILE_MISSING",
          "INSTALLER_NAME_COLLISION","SUBS_SCHEMA_INSTALL_VERIFICATION_FAILED",
          "CONCURRENT_PILOT_CHANGE","PUBLIC_SUBS_UI_NOT_VERIFIED","SUBS_AUTH_GUARD_REGRESSION",
          "EXISTING_SITE_FILE_CHANGED"}
        print("TEST_SUBS_RELEASE_STOPPED:",str(error) if str(error) in safe else type(error).__name__,flush=True)
        sys.exit(1)
