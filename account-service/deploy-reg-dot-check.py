"""One-line, reversible REG.RU delivery test. Never edits PHP, JS, DB or auth."""
import ftplib, hashlib, io, json, os, pathlib, ssl, sys, time
from urllib.request import Request, urlopen

DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
OLD='<p class="account-kicker">НУМЕРОЛОГИЯ ОНЛАЙН</p><h2 id="account-title">Личный кабинет</h2>'.encode("utf-8")
NEW='<p class="account-kicker">НУМЕРОЛОГИЯ ОНЛАЙН <span id="numi-reg-test-dot-20261031" style="color:#b88b45;font-size:12px" aria-hidden="true">●</span></p><h2 id="account-title">Личный кабинет</h2>'.encode("utf-8")
def digest(x):return hashlib.sha256(x).digest()
def report(**k):print("NUMI_REG_DOT_CHECK",json.dumps(k,sort_keys=True),flush=True)
def get(path):
    url="https://"+DOMAIN+"/"+path+"?reg_dot_test="+str(time.time_ns())
    req=Request(url,headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=35) as resp:
        if resp.status!=200:raise RuntimeError("Public status not 200")
        return resp.read(3000000)
def main():
    source=pathlib.Path("index.html").read_bytes()
    if source.count(NEW)!=1:raise RuntimeError("Local dot is missing")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    page=root+"/www/"+DOMAIN+"/index.html"
    def read(p):
        data=io.BytesIO()
        ftp.retrbinary("RETR "+p,data.write)
        return data.getvalue()
    def write(p,data):
        ftp.storbinary("STOR "+p,io.BytesIO(data))
        if digest(read(p))!=digest(data):
            raise RuntimeError("FTP write mismatch")
    try:
        current=read(page)
        report(ftp_connected=True,live_old_anchor=current.count(OLD),already_present=current.count(NEW))
        if current.count(NEW)==1:
            report(success=True,already_present=True)
            return
        if current.count(OLD)!=1:
            raise RuntimeError("Live page differs; stopped without changes")
        updated=current.replace(OLD,NEW,1)
        backup_parent=root+"/site-safeguard-backups"
        try:ftp.mkd(backup_parent)
        except ftplib.error_perm:ftp.cwd(backup_parent)
        backup=backup_parent+"/reg-dot-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        write(backup+"/index.html.bak",current)
        changed=False
        try:
            changed=True
            write(page,updated)
            public=get("")
            if digest(public)!=digest(updated):
                raise RuntimeError("Public webpage checksum differs from updated FTP file")
            report(success=True,public_verified=True,only_dot_changed=True)
        except Exception:
            if changed:
                write(page,current)
                report(rollback_complete=True)
            raise
    finally:
        try:ftp.quit()
        except Exception:ftp.close()
if __name__=="__main__":
    try:main()
    except Exception as exc:
        report(success=False,error_type=type(exc).__name__,reason=str(exc)[:160])
        sys.exit(1)
