"""Narrow PHP rate-limit hardening, with exact old hash and rollback."""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time,urllib.request
DOMAIN="xn--c1adkkdfjbp1a4l.online"
def sha(v):return hashlib.sha256(v).digest()
def log(**d):print("ACCOUNT_RATE",json.dumps(d,sort_keys=True),flush=True)
def main():
    path="account-service/private/core.php"
    old=subprocess.check_output(["git","show","ef5fe9cbb946859a8b70131c4ebd5367cb92b807:"+path])
    updated=pathlib.Path(path).read_bytes()
    if old==updated or b"$network=naBucket('*');" not in updated:
        raise RuntimeError("Expected specific rate limiter change absent")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=24)
    ftp.connect("server172.hosting.reg.ru",21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p()
    home=ftp.pwd().rstrip("/")
    remote=home+"/private/numi-account-20261031/core.php"
    def read(p):
        b=io.BytesIO();ftp.retrbinary("RETR "+p,b.write);return b.getvalue()
    def put(p,data):
        ftp.storbinary("STOR "+p,io.BytesIO(data))
        if sha(read(p))!=sha(data):raise RuntimeError("Integrity mismatch")
    try:
        found=read(remote)
        if sha(found)!=sha(old):
            raise RuntimeError("Private account core diverged, no overwrite")
        backup=home+"/site-safeguard-backups/numi-account-core-before-rate-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+".php"
        put(backup,found)
        try:
            put(remote,updated)
            req=urllib.request.Request("https://"+DOMAIN+"/api/numi-account.php",
                data=b'{"action":"health"}',headers={"Origin":"https://"+DOMAIN,"Content-Type":"application/json"})
            with urllib.request.urlopen(req,timeout=25)as r:
                result=json.loads(r.read(12000))
            if result.get("ok") is not True or result.get("database") is not True:
                raise RuntimeError("Account API did not respond correctly after hardening")
            log(success=True,backend_rate_limited_by_ip=True,live_ui_unchanged=True,source_backup_outside_webroot=True)
        except BaseException:
            put(remote,old)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        log(stopped=type(e).__name__,reason=str(e)[:120] if isinstance(e,RuntimeError) else "")
        sys.exit(1)
