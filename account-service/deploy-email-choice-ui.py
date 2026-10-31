"""Guarded UI-only release: distinguish existing email users from first-time email setup."""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time
from urllib.request import Request,urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
def sha(data):return hashlib.sha256(data).digest()
def historical(rev):return subprocess.check_output(["git","show",rev+":account-browser.js"])
def log(**vals):print("NUMI_EMAIL_CHOICE",json.dumps(vals,sort_keys=True),flush=True)
def live(path):
    request=Request("https://"+DOMAIN+"/"+path+("?" if "?" not in path else "&")+"ui_check="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(request,timeout=35) as response:
        if response.status!=200:raise RuntimeError("Unexpected HTTP status")
        return response.read(2000000)
def main():
    js=pathlib.Path("account-browser.js").read_bytes()
    for marker in ("У меня уже есть аккаунт ♡","Я впервые - добавить почту","merge_telegram_email"):
        if marker.encode() not in js:raise RuntimeError("Required choice UI missing")
    baselines=[
        (b"account-browser.js?v=3",historical("2cefda4c7fa3706e891aaf164c841f6366e94c22")),
        (b"account-browser.js?v=4",historical("700a0efa645311398d926215613c226c449771ae")),
        (b"account-browser.js?v=5",historical("018f97176007611daf87f8f4af77402f598f3385")),
        (b"account-browser.js?v=6",historical("b1e1895ef1b8665a8b7d5482b134dba825717ea4")),
        (b"account-browser.js?v=7",historical("50669740bd062e7e46223c16d6ea4b88568a9dbb")),
        (b"account-browser.js?v=8",historical("44bb7d1be1ecfbea6295412724bed0de22befc82")),
        (b"account-browser.js?v=9",historical("2c4ef35cdcdce166b08a45c657d3d6a449b488be")),
        (b"account-browser.js?v=10",historical("1f6c2dbbbca81446da84771de9fead396440be95"))
    ]
    newtag=b"account-browser.js?v=11"
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    site=home+"/www/"+DOMAIN
    paths={"index":site+"/index.html","js":site+"/account-browser.js","guard":site+"/.htaccess","profile":site+"/auth-profile.js"}
    def read(path):
        output=io.BytesIO();ftp.retrbinary("RETR "+path,output.write);return output.getvalue()
    def write(path,content):
        ftp.storbinary("STOR "+path,io.BytesIO(content))
        if sha(read(path))!=sha(content):raise RuntimeError("Remote hash mismatch")
    try:
        old={name:read(path) for name,path in paths.items()}
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in old["guard"]:
            raise RuntimeError("Protected paywall guard absent; refuse to deploy")
        matches=[tag for tag,payload in baselines if old["index"].count(tag)==1 and sha(old["js"])==sha(payload)]
        if len(matches)!=1 or newtag in old["index"]:
            raise RuntimeError("Unrecognized live UI revision; no files changed")
        new_index=old["index"].replace(matches[0],newtag,1)
        backup_parent=home+"/site-safeguard-backups"
        try:ftp.mkd(backup_parent)
        except ftplib.error_perm:ftp.cwd(backup_parent)
        backup=backup_parent+"/email-choice-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        for name in ("index","js"):
            write(backup+"/"+name+".bak",old[name])
        changed=[]
        try:
            for name,value in (("js",js),("index",new_index)):
                changed.append(name)
                write(paths[name],value)
            if sha(live("account-browser.js"))!=sha(js) or sha(live(""))!=sha(new_index):
                raise RuntimeError("Live HTTP does not match published UI")
            if read(paths["guard"])!=old["guard"] or read(paths["profile"])!=old["profile"]:
                raise RuntimeError("Unexpected protected-file mutation")
            log(success=True,verified=True,backend_changed=False,paid_material_changed=False)
        except BaseException:
            for name in reversed(changed):
                try:write(paths[name],old[name])
                except BaseException:log(rollback_failed=name)
            log(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as err:
        log(success=False,reason=str(err)[:160] if isinstance(err,RuntimeError) else type(err).__name__)
        sys.exit(1)
