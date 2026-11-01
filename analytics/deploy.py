"""Deploy isolated aggregate analytics to existing REG.RU site, guarded.

Only 8 allowlisted files, private backups, checksums, rollback. No database,
account, bot, DNS, payment, entitlement or site home-file modification.
The analytics database table is created only by a verified owner password
login on the installed PHP endpoint.
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
from urllib.request import Request,urlopen

DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
FILES={
    "moment/index.html":"moment/index.html",
    "moment/moment.js":"moment/moment.js",
    "moment/yes-no/index.html":"moment/yes-no/index.html",
    "moment/yes-no/yes-no.js":"moment/yes-no/yes-no.js",
    "moment/analytics.js":"moment/analytics.js",
    "analytics/admin/index.html":"analytics/index.html",
    "analytics/admin/dashboard.js":"analytics/dashboard.js",
    "analytics/public/numi-analytics.php":"api/numi-analytics.php",
}
def sha(data):return hashlib.sha256(data).hexdigest()
def log(**data):print("NUMI_AGG_ANALYTICS_DEPLOY",json.dumps(data,sort_keys=True),flush=True)
def public_get(path):
    url="https://"+DOMAIN+"/"+path+"?aggregate_check="+str(time.time_ns())
    try:
        with urlopen(Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache"}),timeout=40) as r:
            return r.status,r.read(2_000_000)
    except urllib.error.HTTPError as err:
        return err.code,err.read(4096)
def public_login_probe():
    """Do not use real credentials; ensure unauthorized password login is handled by PHP."""
    url="https://"+DOMAIN+"/api/numi-analytics.php"
    payload=json.dumps({
        "action":"admin_login",
        "email":"analytics-probe@invalid.example",
        "password":"invalid-check-only"
    }).encode("utf-8")
    req=Request(url,data=payload,headers={
        "Origin":"https://"+DOMAIN,
        "Content-Type":"application/json",
        "Cache-Control":"no-cache"
    },method="POST")
    try:
        with urlopen(req,timeout=40) as response:
            code=response.status;body=response.read(2000)
    except urllib.error.HTTPError as err:
        code=err.code;body=err.read(2000)
    try:
        parsed=json.loads(body)
    except ValueError:
        parsed={}
    return code,parsed.get("error")
def validate():
    parts={dest:pathlib.Path(src).read_bytes() for src,dest in FILES.items()}
    if not all(parts.values()):raise RuntimeError("Missing source data")
    if "NUMI_ANALYTICS_OWNER_ID" in parts["api/numi-analytics.php"].decode():
        raise RuntimeError("Expected owner password auth, not a placeholder admin id")
    if "admin_login" not in parts["api/numi-analytics.php"].decode():
        raise RuntimeError("Owner password login missing")
    if "analytics.js" not in parts["moment/index.html"].decode() or "analytics.js" not in parts["moment/yes-no/index.html"].decode():
        raise RuntimeError("Tracker not loaded by both catalogs")
    for p in ("moment/moment.js","moment/yes-no/yes-no.js","moment/analytics.js","analytics/admin/dashboard.js"):
        proc=subprocess.run(["node","--check",p],capture_output=True,text=True)
        if proc.returncode:raise RuntimeError("Invalid JavaScript "+p+": "+proc.stderr[:220])
    proc=subprocess.run(["php","-l","analytics/public/numi-analytics.php"],capture_output=True,text=True)
    if proc.returncode:raise RuntimeError("Invalid PHP: "+proc.stdout[:220]+proc.stderr[:220])
    # Already published live analytics baseline, before password recovery UI.
    # Only files that match this exact version may be replaced.
    BASE_SHA="652a6551562db19003676ad3b1f0ecddee8c1104"
    previous={}
    for src,dest in FILES.items():
        previous[dest]=subprocess.check_output(["git","show",BASE_SHA+":"+src])
    log(validated=True,assets=len(parts),password_auth=True)
    return parts,previous
def main():
    parts,previous=validate()
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    base=root+"/www/"+DOMAIN
    def read(path):
        buf=io.BytesIO()
        try:ftp.retrbinary("RETR "+path,buf.write)
        except ftplib.error_perm as e:
            if str(e).startswith("550"):return None
            raise
        return buf.getvalue()
    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if sha(read(path) or b"")!=sha(data):raise RuntimeError("FTP checksum mismatch "+path.rsplit("/",1)[-1])
    def mkdir(path):
        try:ftp.mkd(path)
        except ftplib.error_perm:ftp.cwd(path)
    try:
        # Only already-known target dirs; create the new /analytics directory.
        mkdir(base+"/analytics")
        current={}
        for path,new in parts.items():
            dest=base+"/"+path
            old=read(dest)
            if old is not None and old!=new:
                if path not in previous or old!=previous[path]:
                    raise RuntimeError("Production file differs from preflight baseline; stopped: "+path)
            current[dest]=old
        backupdir=root+"/site-safeguard-backups"
        mkdir(backupdir)
        snapshot=backupdir+"/analytics-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        mkdir(snapshot)
        for path,old in current.items():
            if old is not None:
                write(snapshot+"/"+path.replace("/","_").replace(base.replace("/","_")+"_","")+".bak",old)
        touched=[]
        try:
            for path,new in parts.items():
                dest=base+"/"+path
                if current[dest]!=new:
                    touched.append(dest);write(dest,new)
            # HTML/JS are publicly accessible; the API must be private.
            for path,new in parts.items():
                if path.endswith(".php"):continue
                code,body=public_get(path)
                if code!=200 or sha(body)!=sha(new):
                    raise RuntimeError("Public checksum mismatch "+path)
            code,body=public_get("api/numi-analytics.php")
            if code!=403:
                raise RuntimeError("Analytics API is not protected: HTTP "+str(code))
            code,body=public_get("api/numi-analytics.php?action=session")
            if code not in (200,403):
                raise RuntimeError("Analytics session check unexpected HTTP "+str(code))
            if code==200:
                try:
                    status=json.loads(body)
                    if status.get("authenticated") is not False:
                        raise RuntimeError("Anonymous visitor unexpectedly authenticated")
                except ValueError:raise RuntimeError("Invalid session-check JSON")
            # Some protected hosting layers return 403 for any anonymous GET
            # to a private API. Distinguish that from an unreachable PHP handler
            # by testing rejected credentials through the actual login handler.
            login_code,login_error=public_login_probe()
            log(anonymous_session_http=code,negative_login_http=login_code,negative_login_error=login_error)
            if login_code!=401 or login_error!="INVALID_CREDENTIALS":
                raise RuntimeError("Login handler not independently verified: HTTP "+str(login_code))
            log(success=True,verified=True,login_required=True,updated_files=len(touched))
        except BaseException:
            for dest in reversed(touched):
                old=current[dest]
                try:
                    if old is None:ftp.delete(dest)
                    else:write(dest,old)
                except BaseException as e:log(rollback_failed=dest.rsplit("/",1)[-1],error=type(e).__name__)
            log(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        log(success=False,reason=str(e)[:260] if isinstance(e,RuntimeError) else type(e).__name__)
        sys.exit(1)
