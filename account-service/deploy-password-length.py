"""Guarded REG.RU deployment of the password-length change only."""
import ftplib, hashlib, io, json, os, pathlib, ssl, subprocess, sys, time
from urllib.request import Request, urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
def sha(b): return hashlib.sha256(b).digest()
def prior(path, ref): return subprocess.check_output(["git","show",ref+":"+path])
def log(**x): print("NUMI_PASSWORD_LENGTH",json.dumps(x,sort_keys=True),flush=True)
def webget(path):
    req=Request("https://"+DOMAIN+"/"+path+"?length_release="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=30) as r:
        if r.status!=200: raise RuntimeError("Unexpected HTTP status")
        return r.read(2000000)
def main():
    desired_js=pathlib.Path("account-browser.js").read_bytes()
    desired_php=pathlib.Path("account-service/private/core.php").read_bytes()
    baseline_php=prior("account-service/private/core.php","ca679206742d551697e48400bc378ef71e6b15b4")
    if sha(desired_php)==sha(baseline_php) or b"strlen($password)>=1" not in desired_php:
        raise RuntimeError("Expected backend edit missing")
    versions=[
      (b"account-browser.js?v=1",prior("account-browser.js","8526946c219af9036231bdfb77a18503da550c6e^")),
      (b"account-browser.js?v=2",prior("account-browser.js","8526946c219af9036231bdfb77a18503da550c6e")),
      (b"account-browser.js?v=3",prior("account-browser.js","2cefda4c7fa3706e891aaf164c841f6366e94c22")),
    ]
    next_tag=b"account-browser.js?v=4"
    if b'minlength="10"' in desired_js or b'password.length<10' in desired_js:
        raise RuntimeError("Frontend still imposes ten-character limit")
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    f.connect(HOST,21);f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);f.prot_p();f.set_pasv(True)
    home=f.pwd().rstrip("/")
    site=home+"/www/"+DOMAIN
    paths={"index":site+"/index.html","js":site+"/account-browser.js","core":home+"/private/numi-account-20261031/core.php","guard":site+"/.htaccess","telegram":site+"/auth-profile.js"}
    def read(p):
        buf=io.BytesIO();f.retrbinary("RETR "+p,buf.write);return buf.getvalue()
    def put(p,b):
        f.storbinary("STOR "+p,io.BytesIO(b))
        if sha(read(p))!=sha(b):raise RuntimeError("File checksum mismatch")
    try:
        originals={key:read(p) for key,p in paths.items()}
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in originals["guard"]:
            raise RuntimeError("Paywall guard mismatch")
        if sha(originals["core"])!=sha(baseline_php):
            raise RuntimeError("Backend differs from verified baseline: no changes")
        matches=[tag for tag,bytes_ in versions if originals["index"].count(tag)==1 and sha(originals["js"])==sha(bytes_)]
        if len(matches)!=1:
            raise RuntimeError("Frontend differs from verified previous versions: no changes")
        replacement=originals["index"].replace(matches[0],next_tag,1)
        backupdir=home+"/site-safeguard-backups"
        try:f.mkd(backupdir)
        except ftplib.error_perm:f.cwd(backupdir)
        backup=backupdir+"/password-length-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        f.mkd(backup)
        for key in ("index","js","core"):put(backup+"/"+key+".bak",originals[key])
        log(backup_verified=True)
        changed=[]
        try:
            for key,desired in (("core",desired_php),("js",desired_js),("index",replacement)):
                changed.append(key);put(paths[key],desired)
            if sha(webget("account-browser.js"))!=sha(desired_js) or sha(webget(""))!=sha(replacement):
                raise RuntimeError("Live files do not match")
            if read(paths["guard"])!=originals["guard"] or read(paths["telegram"])!=originals["telegram"]:
                raise RuntimeError("Protected baseline changed")
            log(success=True,removed_minimum_length=True,backend_and_frontend_verified=True,telegram_unchanged=True,paywall_unchanged=True)
        except BaseException:
            for key in reversed(changed):
                try:put(paths[key],originals[key])
                except BaseException:log(rollback_failed=key)
            raise
    finally:
        try:f.quit()
        except BaseException:f.close()
if __name__=="__main__":
    try:main()
    except BaseException as exc:
        log(success=False,error=type(exc).__name__,detail=str(exc)[:160] if isinstance(exc,RuntimeError) else "remote_access")
        sys.exit(1)
