"""Guarded release of first-party account merge only (never edits DB or paid content).
Live files must exactly match a known revision; independent backups and full rollback.
"""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time
from urllib.request import Request,urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
def digest(data):return hashlib.sha256(data).digest()
def gitfile(rev,path):return subprocess.check_output(["git","show",rev+":"+path])
def report(**kwargs):print("NUMI_ACCOUNT_MERGE",json.dumps(kwargs,sort_keys=True),flush=True)
def readurl(path):
    url="https://"+DOMAIN+"/"+path+("?merge_check="+str(time.time_ns()) if "?" not in path else "&merge_check="+str(time.time_ns()))
    with urlopen(Request(url,headers={"Cache-Control":"no-cache"}),timeout=30) as res:
        if res.status!=200:raise RuntimeError("Unexpected public HTTP status")
        return res.read(2000000)
def health():
    body=b'{"action":"health"}'
    req=Request("https://"+DOMAIN+"/api/numi-account.php",data=body,
        headers={"Content-Type":"application/json","Origin":"https://"+DOMAIN},method="POST")
    with urlopen(req,timeout=30) as res:
        result=json.loads(res.read(10000))
        if res.status!=200 or result.get("ok") is not True or result.get("database") is not True:
            raise RuntimeError("Account endpoint health failed")
def main():
    source={
      "core":pathlib.Path("account-service/private/core.php").read_bytes(),
      "js":pathlib.Path("account-browser.js").read_bytes(),
    }
    if b"merge_telegram_email" not in source["core"] or b"numi-existing-email-form" not in source["js"]:
        raise RuntimeError("Merge source missing")
    baselines=[
        (b"account-browser.js?v=3",gitfile("2cefda4c7fa3706e891aaf164c841f6366e94c22","account-browser.js")),
        (b"account-browser.js?v=4",gitfile("700a0efa645311398d926215613c226c449771ae","account-browser.js")),
        (b"account-browser.js?v=5",gitfile("018f97176007611daf87f8f4af77402f598f3385","account-browser.js")),
        (b"account-browser.js?v=6",gitfile("b1e1895ef1b8665a8b7d5482b134dba825717ea4","account-browser.js")),
        (b"account-browser.js?v=7",gitfile("50669740bd062e7e46223c16d6ea4b88568a9dbb","account-browser.js")),
        (b"account-browser.js?v=8",gitfile("44bb7d1be1ecfbea6295412724bed0de22befc82","account-browser.js")),
        (b"account-browser.js?v=9",gitfile("2c4ef35cdcdce166b08a45c657d3d6a449b488be","account-browser.js"))
    ]
    old_core=gitfile("7559abedee85e2594fac9b736cc32e21dbd63c5d^","account-service/private/core.php")
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    f.connect(HOST,21);f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    f.prot_p();f.set_pasv(True)
    home=f.pwd().rstrip("/")
    site=home+"/www/"+DOMAIN
    paths={"core":home+"/private/numi-account-20261031/core.php",
           "js":site+"/account-browser.js",
           "index":site+"/index.html",
           "guard":site+"/.htaccess",
           "telegram":site+"/auth-profile.js"}
    def read(path):
        buf=io.BytesIO()
        f.retrbinary("RETR "+path,buf.write)
        return buf.getvalue()
    def write(path,content):
        f.storbinary("STOR "+path,io.BytesIO(content))
        if digest(read(path))!=digest(content):raise RuntimeError("Remote integrity mismatch")
    try:
        current={key:read(path) for key,path in paths.items()}
        if digest(current["core"]) not in (digest(old_core),digest(source["core"])):
            raise RuntimeError("Live backend differs from known verified baseline: no write")
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in current["guard"]:
            raise RuntimeError("Paid content guard missing: no write")
        matches=[tag for tag,blob in baselines
                 if current["index"].count(tag)==1 and digest(current["js"])==digest(blob)]
        if len(matches)!=1 or b"account-browser.js?v=10" in current["index"]:
            raise RuntimeError("Live frontend is not an approved baseline: no write")
        new_index=current["index"].replace(matches[0],b"account-browser.js?v=10",1)
        parent=home+"/site-safeguard-backups"
        try:f.mkd(parent)
        except ftplib.error_perm:f.cwd(parent)
        backup=parent+"/account-merge-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        f.mkd(backup)
        for name in ("core","index","js"):
            write(backup+"/"+name+".bak",current[name])
        report(backup_created=True)
        modified=[]
        try:
            for name,data in (("core",source["core"]),("js",source["js"]),("index",new_index)):
                modified.append(name)
                write(paths[name],data)
            if digest(readurl("account-browser.js"))!=digest(source["js"]):
                raise RuntimeError("Published JS mismatch")
            if digest(readurl(""))!=digest(new_index):
                raise RuntimeError("Published homepage mismatch")
            health()
            if read(paths["guard"])!=current["guard"] or read(paths["telegram"])!=current["telegram"]:
                raise RuntimeError("Protected baseline changed")
            report(success=True,account_merge_live=True,paid_content_unchanged=True,db_unchanged=True)
        except BaseException:
            for name in reversed(modified):
                try:write(paths[name],current[name])
                except BaseException:report(rollback_failed=name)
            report(rollback_attempted=True)
            raise
    finally:
        try:f.quit()
        except BaseException:f.close()
if __name__=="__main__":
    try:main()
    except BaseException as exc:
        report(success=False,reason=str(exc)[:160] if isinstance(exc,RuntimeError) else type(exc).__name__)
        sys.exit(1)
