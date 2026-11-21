"""Guarded opt-in release of one-day gifts. Never touches orders, payment state or bot.
Requires every existing live file to be byte-identical to the audited base.
Any drift aborts before writing; all changes are backed up and rolled back.
"""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request

BASE_COMMIT="25159e1518c7ea2eb59cbc0254bc502048637426"
OLD_DOMAIN="xn--c1adkkdfjbp1a4l.online"
NEW_DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
HOST="server172.hosting.reg.ru"
ROOT=pathlib.Path(__file__).resolve().parent.parent
MAPPING={
  "account-service/private/core.php":("private","core.php"),
  "account-service/private/wallet-real.php":("private","wallet-real.php"),
  "account-service/private/subscriptions.php":("private","subscriptions.php"),
  "insights/public/numi-gifts.php":("site","api/numi-gifts.php"),
  "insights/public/gift-claim.html":("site","gifts/index.html"),
  "account-browser.js":("site","account-browser.js"),
  "insights/public/index.html":("site","insights/index.html"),
  "insights/public/insights.js":("site","insights/insights.js"),
  "insights/public/insights.css":("site","insights/insights.css"),
}
NEW_FILES={"insights/public/numi-gifts.php","insights/public/gift-claim.html"}

def digest(data):
    return hashlib.sha256(data).hexdigest()
def log(**fields):
    print("NUMI_GIFTS_RELEASE "+json.dumps(fields,ensure_ascii=False),flush=True)
def base_content(path):
    return subprocess.check_output(["git","show",BASE_COMMIT+":"+path],cwd=ROOT)
def request(path,host=NEW_DOMAIN):
    req=urllib.request.Request("https://"+host+"/"+path,headers={"Cache-Control":"no-cache"})
    try:
        with urllib.request.urlopen(req,timeout=30) as result:
            return result.status,result.read(250000)
    except urllib.error.HTTPError as exc:
        return exc.code,exc.read(250000)
def main():
    if not os.environ.get("REG_FTP_USER") or not os.environ.get("REG_FTP_PASSWORD"):
        raise RuntimeError("FTPS_CREDENTIALS_MISSING")
    desired={p:(ROOT/p).read_bytes() for p in MAPPING}
    expected={p:None if p in NEW_FILES else base_content(p) for p in MAPPING}
    for path in MAPPING:
        if not desired[path] or (expected[path] is not None and desired[path]==expected[path]):
            raise RuntimeError("INVALID_RELEASE_PATCH: "+path)
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    site=home+"/www/"+OLD_DOMAIN
    private=home+"/private/numi-account-20261031"
    def read(path):
        out=io.BytesIO()
        try:
            ftp.retrbinary("RETR "+path,out.write)
        except ftplib.error_perm as e:
            if str(e).startswith("550"):return None
            raise
        return out.getvalue()
    def mkdir(path):
        try:ftp.mkd(path)
        except ftplib.error_perm:ftp.cwd(path)
    def write(path,content):
        ftp.storbinary("STOR "+path,io.BytesIO(content))
        if read(path)!=content:raise RuntimeError("READBACK_FAILED")
    targets={}
    original={}
    touched=[]
    try:
        for path,(scope,remote) in MAPPING.items():
            destination=(private if scope=="private" else site)+"/"+remote
            targets[path]=destination
            previous=read(destination)
            original[path]=previous
            if path in NEW_FILES:
                if previous is not None and previous!=desired[path]:
                    raise RuntimeError("NEW_ENDPOINT_EXISTS_WITH_UNKNOWN_CONTENT: "+path)
            elif previous not in (expected[path],desired[path]):
                raise RuntimeError("LIVE_BASELINE_DRIFT: "+path)
        # Protect unrelated homepage, Telegram and payment files by snapshot.
        protected=[site+"/index.html",site+"/auth-profile.js",site+"/.htaccess",
          site+"/api/numi-account.php",private+"/wallet.php",private+"/store.php"]
        protected_bytes={p:read(p) for p in protected}
        if any(v is None for v in protected_bytes.values()):
            raise RuntimeError("CRITICAL_LIVE_FILE_NOT_FOUND")
        mkdir(home+"/site-safeguard-backups")
        backup=home+"/site-safeguard-backups/gift-club-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        mkdir(backup)
        for path in MAPPING:
            prior=original[path]
            if prior is not None:
                write(backup+"/"+path.replace("/","__")+".bak",prior)
        # New page & endpoint are invisible until the whole release is healthy.
        mkdir(site+"/gifts")
        order=list(NEW_FILES)+[p for p in MAPPING if p not in NEW_FILES]
        log(preflight=True,backup=backup.rsplit("/",1)[-1],files=len(order))
        try:
            for path in order:
                if original[path]==desired[path]:continue
                touched.append(path)
                write(targets[path],desired[path])
            status,data=request("api/numi-gifts.php?action=my")
            body=json.loads(data)
            if status!=401 or body.get("error")!="LOGIN_REQUIRED":
                raise RuntimeError("ANONYMOUS_GIFT_API_NOT_LOCKED")
            status,data=request("api/numi-gifts.php?action=overview")
            body=json.loads(data)
            if status!=401 or body.get("error")!="LOGIN_REQUIRED":
                raise RuntimeError("ANONYMOUS_OWNER_REPORT_NOT_LOCKED")
            status,data=request("api/numi-account.php",host=NEW_DOMAIN)
            if status!=405:raise RuntimeError("ACCOUNT_API_METHOD_CHANGED")
            status,data=request("api/numi-insights.php?action=session",host=NEW_DOMAIN)
            body=json.loads(data)
            if status!=200 or body.get("owner") is not False:
                raise RuntimeError("ANALYTICS_ANON_SESSION_CHANGED")
            for p,target in targets.items():
                if MAPPING[p][0]!="site" or p.endswith(".php"):continue
                route=MAPPING[p][1]
                status,data=request(route+"?gift_release="+str(time.time_ns()),host=NEW_DOMAIN)
                if status!=200 or digest(data)!=digest(desired[p]):
                    raise RuntimeError("STATIC_CONTENT_MISMATCH: "+route)
            for p,contents in protected_bytes.items():
                if read(p)!=contents:raise RuntimeError("UNRELATED_FILE_MODIFIED: "+p.rsplit("/",1)[-1])
            log(success=True,files=len(touched),payment_files_unchanged=True,
                original_customer_data_unchanged=True,anonymous_gifts_denied=True,
                backup=backup.rsplit("/",1)[-1])
        except BaseException:
            failed=[]
            for p in reversed(touched):
                try:
                    if original[p] is None:ftp.delete(targets[p])
                    else:write(targets[p],original[p])
                except BaseException:failed.append(p)
            log(rollback_attempted=True,rollback_failed=failed)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:main()
    except BaseException as e:
        log(success=False,error=str(e)[:180])
        sys.exit(1)
