"""Publish only approved Telegram email-link UI; fail closed on unrecognized live files."""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time
from urllib.request import Request,urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
def sha(v):return hashlib.sha256(v).digest()
def prior(commit):return subprocess.check_output(["git","show",commit+":account-browser.js"])
def log(**x):print("NUMI_TELEGRAM_NOTE",json.dumps(x,sort_keys=True),flush=True)
def http_get(path):
    req=Request("https://"+DOMAIN+"/"+path+"?tg_note="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=30) as res:
        if res.status!=200:raise RuntimeError("HTTP status unexpected")
        return res.read(2000000)
def main():
    new_js=pathlib.Path("account-browser.js").read_bytes()
    if b"numi-telegram-link-prompt" not in new_js or b"numi-account-privacy" not in new_js:
        raise RuntimeError("Approved text missing")
    baselines=[
      (b"account-browser.js?v=1",prior("8526946c219af9036231bdfb77a18503da550c6e^")),
      (b"account-browser.js?v=2",prior("8526946c219af9036231bdfb77a18503da550c6e")),
      (b"account-browser.js?v=3",prior("2cefda4c7fa3706e891aaf164c841f6366e94c22")),
      (b"account-browser.js?v=4",prior("700a0efa645311398d926215613c226c449771ae")),
      (b"account-browser.js?v=5",prior("018f97176007611daf87f8f4af77402f598f3385")),
    ]
    dest_tag=b"account-browser.js?v=6"
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    f.connect(HOST,21);f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);f.prot_p();f.set_pasv(True)
    base=f.pwd().rstrip("/")
    site=base+"/www/"+DOMAIN
    paths={"index":site+"/index.html","js":site+"/account-browser.js","guard":site+"/.htaccess","telegram":site+"/auth-profile.js"}
    def read(path):
        buf=io.BytesIO();f.retrbinary("RETR "+path,buf.write);return buf.getvalue()
    def put(path,data):
        f.storbinary("STOR "+path,io.BytesIO(data))
        if sha(read(path))!=sha(data):raise RuntimeError("Remote integrity mismatch")
    try:
        original={k:read(v) for k,v in paths.items()}
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in original["guard"]:
            raise RuntimeError("Protected baseline missing")
        matched=[tag for tag,js in baselines if original["index"].count(tag)==1 and sha(original["js"])==sha(js)]
        if len(matched)!=1 or dest_tag in original["index"]:
            raise RuntimeError("Live UI differs from known exact baseline: no write")
        new_index=original["index"].replace(matched[0],dest_tag,1)
        backupfolder=base+"/site-safeguard-backups"
        try:f.mkd(backupfolder)
        except ftplib.error_perm:f.cwd(backupfolder)
        folder=backupfolder+"/telegram-link-note-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        f.mkd(folder)
        for k in ("index","js"):put(folder+"/"+k+".bak",original[k])
        changed=[]
        try:
            for k,v in (("js",new_js),("index",new_index)):
                changed.append(k);put(paths[k],v)
            if sha(http_get("account-browser.js"))!=sha(new_js) or sha(http_get(""))!=sha(new_index):
                raise RuntimeError("Live HTTP differs from deployed files")
            if original["guard"]!=read(paths["guard"]) or original["telegram"]!=read(paths["telegram"]):
                raise RuntimeError("Protected files changed")
            log(success=True,telegram_note_live=True,backend_unchanged=True,guard_unchanged=True)
        except BaseException:
            for k in reversed(changed):
                try:put(paths[k],original[k])
                except BaseException:log(rollback_failed=k)
            raise
    finally:
        try:f.quit()
        except BaseException:f.close()
if __name__=="__main__":
    try:main()
    except BaseException as exc:
        log(success=False,error=type(exc).__name__,reason=str(exc)[:120] if isinstance(exc,RuntimeError) else "remote_error")
        sys.exit(1)
