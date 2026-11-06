"""One-shot primary-domain origin migration for isolated account/school private PHP.
No Telegram Worker change, no daily-bot route/CRON change, no new backups.
Only exact origin strings inside two pinned PRIVATE server files can be written.
"""
import ftplib,hashlib,io,json,os,ssl,subprocess,sys,tempfile,urllib.error,urllib.request
HOST="server172.hosting.reg.ru"
OLD="xn--c1adkkdfjbp1a4l.online"
NEW="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
ACCOUNT="private/numi-account-20261031/core.php"
SCHOOL="private/numi-school-owner-20261103/gate.php"
MAX_BYTES=150000
ACCOUNT_EDITS=[
 ("const NUMI_ACCOUNT_ORIGIN = 'https://"+OLD+"';\nconst NUMI_ACCOUNT_NEW_ORIGIN = 'https://"+NEW+"';",
  "const NUMI_ACCOUNT_ORIGIN = 'https://"+NEW+"';"),
 ("        NUMI_ACCOUNT_ORIGIN,\n        'https://www."+OLD+"',\n        NUMI_ACCOUNT_NEW_ORIGIN,\n        'https://www."+NEW+"',",
  "        NUMI_ACCOUNT_ORIGIN,\n        'https://www."+NEW+"',")
]
SCHOOL_EDITS=[
 ("const NS_ORIGIN = 'https://"+OLD+"';",
  "const NS_ORIGIN = 'https://"+NEW+"';"),
 ("[NS_ORIGIN,'https://www."+OLD+"']",
  "[NS_ORIGIN,'https://www."+NEW+"']")
]
def sha(b):return hashlib.sha256(b).hexdigest()
def patch(data,changes):
    current=data.decode("utf-8")
    for old,new in changes:
        if current.count(old)!=1 or new in current:
            raise RuntimeError("ORIGIN_BASELINE_UNEXPECTED")
        current=current.replace(old,new,1)
    return current.encode("utf-8")
def phpcheck(blob):
    with tempfile.NamedTemporaryFile(suffix=".php") as tmp:
        tmp.write(blob);tmp.flush()
        result=subprocess.run(["php","-l",tmp.name],capture_output=True,timeout=15)
        if result.returncode!=0:
            raise RuntimeError("PHP_SYNTAX_INVALID")
def post(route,origin):
    body=b'{"action":"session"}'
    request=urllib.request.Request("https://"+NEW+"/"+route,data=body,headers={
      "Origin":"https://"+origin,"Content-Type":"application/json","Cache-Control":"no-cache"})
    try:
        with urllib.request.urlopen(request,timeout=24) as r:
            return (r.status,json.loads(r.read(10000)))
    except urllib.error.HTTPError as e:
        try: payload=json.loads(e.read(10000))
        except Exception:payload={}
        return (e.code,payload)
def main():
    beforeNew=post("api/numi-account.php",NEW)
    if beforeNew[0]!=200 or beforeNew[1].get("authenticated") is not False:
        raise RuntimeError("ACCOUNT_NEW_DOMAIN_GUEST_FAILED")
    beforeOld=post("api/numi-account.php",OLD)
    if beforeOld[0] not in (200,403):
        raise RuntimeError("ACCOUNT_OLD_DOMAIN_BASELINE_UNEXPECTED")
    schoolNew=post("api/numi-school.php",NEW)
    schoolOld=post("api/numi-school.php",OLD)
    print("PRECHECK_ACCOUNT_NEW_SESSION_OK",flush=True)
    print("PRECHECK_SCHOOL_NEW_HTTP",schoolNew[0],flush=True)
    print("PRECHECK_SCHOOL_OLD_HTTP",schoolOld[0],flush=True)
    # School is currently 404 from both domains; don't change or install it
    # until the public handler is independently proven to be active.
    schoolEligible=(schoolNew[0] == 403 and schoolNew[1].get("error")=="ORIGIN_DENIED"
                    and schoolOld[0]==200)
    if not schoolEligible:
        print("SCHOOL_ORIGIN_LIVE_RELEASE_SKIPPED_UNVERIFIED",flush=True)
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=28)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    try:
        home=ftp.pwd().rstrip("/")
        def read(path):
            out=bytearray()
            def sink(chunk):
                out.extend(chunk)
                if len(out)>MAX_BYTES:raise RuntimeError("FTP_FILE_TOO_LARGE")
            try:ftp.retrbinary("RETR "+path,sink)
            except ftplib.error_perm as e:
                if str(e).startswith("550"):return None
                raise
            return bytes(out)
        def put(path,blob):
            ftp.storbinary("STOR "+path,io.BytesIO(blob))
            if read(path)!=blob:raise RuntimeError("FTP_WRITE_VERIFY_FAILED")
        current=read(home+"/"+ACCOUNT)
        if current is None:raise RuntimeError("ACCOUNT_PRIVATE_CORE_MISSING")
        source=subprocess.check_output(["git","show","HEAD:account-service/private/core.php"],timeout=20)
        # Compare against the exact GitHub output to prevent arbitrary rewrites.
        originalGit=subprocess.check_output(["git","show","HEAD^:account-service/private/core.php"],timeout=20)
        if patch(originalGit,ACCOUNT_EDITS)!=source:
            raise RuntimeError("ACCOUNT_GITHUB_PATCH_CHANGED")
        # Read and modify only the two known origin declaration/allowlist spans.
        desired=patch(current,ACCOUNT_EDITS)
        phpcheck(current);phpcheck(desired)
        if current.count(b"function naAllowedOrigins(): array")!=1:
            raise RuntimeError("ACCOUNT_ORIGIN_GUARD_MISSING")
        # Mail 'From' is deliberately retained pending domain-specific SPF/DKIM review.
        if desired.count(b"From: Numerologia Online")!=1:
            raise RuntimeError("ACCOUNT_MAIL_SENDER_DRIFT")
        schoolCurrent=None
        schoolDesired=None
        if schoolEligible:
            schoolCurrent=read(home+"/"+SCHOOL)
            if schoolCurrent is None:raise RuntimeError("SCHOOL_PRIVATE_GATE_MISSING")
            schoolDesired=patch(schoolCurrent,SCHOOL_EDITS)
            phpcheck(schoolCurrent);phpcheck(schoolDesired)
            if schoolDesired.count(b"nsOwner($config")<1:
                raise RuntimeError("SCHOOL_OWNER_GUARD_MISSING")
        print("NO_NEW_BACKUPS_OR_DIRECTORY_CREATION",flush=True)
        if read(home+"/"+ACCOUNT)!=current:raise RuntimeError("ACCOUNT_CONCURRENT_CHANGE")
        if schoolEligible and read(home+"/"+SCHOOL)!=schoolCurrent:raise RuntimeError("SCHOOL_CONCURRENT_CHANGE")
        modified=[]
        try:
            put(home+"/"+ACCOUNT,desired)
            modified.append((home+"/"+ACCOUNT,current))
            newStatus=post("api/numi-account.php",NEW)
            oldStatus=post("api/numi-account.php",OLD)
            if newStatus[0]!=200 or newStatus[1].get("authenticated") is not False:
                raise RuntimeError("ACCOUNT_NEW_SESSION_REGRESSION")
            if oldStatus[0]!=403 or oldStatus[1].get("error")!="ORIGIN_DENIED":
                raise RuntimeError("ACCOUNT_OLD_ORIGIN_NOT_BLOCKED")
            print("ACCOUNT_LIVE_PRIMARY_ORIGIN_ONLY_VERIFIED",flush=True)
            if schoolEligible:
                put(home+"/"+SCHOOL,schoolDesired)
                modified.append((home+"/"+SCHOOL,schoolCurrent))
                snew=post("api/numi-school.php",NEW)
                sold=post("api/numi-school.php",OLD)
                if snew[0]!=200 or snew[1].get("owner") is not False:
                    raise RuntimeError("SCHOOL_NEW_SESSION_REGRESSION")
                if sold[0]!=403 or sold[1].get("error")!="ORIGIN_DENIED":
                    raise RuntimeError("SCHOOL_OLD_ORIGIN_NOT_BLOCKED")
                print("SCHOOL_LIVE_PRIMARY_ORIGIN_ONLY_VERIFIED",flush=True)
            print("NO_CHANGE_DAILY_FORECAST_BOT_CRON_CALCULATIONS",flush=True)
            print("SERVER_ORIGIN_RELEASE_SUCCESS",flush=True)
        except BaseException:
            for path,prior in reversed(modified):
                try:put(path,prior);print("ORIGIN_ROLLBACK_VERIFIED",flush=True)
                except Exception:print("ORIGIN_ROLLBACK_FAILED",flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        safe={"ACCOUNT_NEW_DOMAIN_GUEST_FAILED","ACCOUNT_OLD_DOMAIN_BASELINE_UNEXPECTED",
              "ACCOUNT_PRIVATE_CORE_MISSING","ACCOUNT_GITHUB_PATCH_CHANGED",
              "ORIGIN_BASELINE_UNEXPECTED","PHP_SYNTAX_INVALID","ACCOUNT_ORIGIN_GUARD_MISSING",
              "ACCOUNT_MAIL_SENDER_DRIFT","SCHOOL_PRIVATE_GATE_MISSING",
              "SCHOOL_OWNER_GUARD_MISSING","ACCOUNT_CONCURRENT_CHANGE","SCHOOL_CONCURRENT_CHANGE",
              "ACCOUNT_NEW_SESSION_REGRESSION","ACCOUNT_OLD_ORIGIN_NOT_BLOCKED",
              "SCHOOL_NEW_SESSION_REGRESSION","SCHOOL_OLD_ORIGIN_NOT_BLOCKED",
              "FTP_FILE_TOO_LARGE","FTP_WRITE_VERIFY_FAILED"}
        c=str(e)
        print("SERVER_ORIGIN_RELEASE_STOPPED:",c if c in safe else type(e).__name__,flush=True)
        sys.exit(1)
