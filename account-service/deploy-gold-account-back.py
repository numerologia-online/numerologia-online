"""Publish just unified cabinet back buttons and their scoped CSS to REG.RU."""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
GOLD='<button class="account-back numi-gold-back" type="button" data-account-back><span aria-hidden="true">←</span> Назад в личный кабинет</button>'.encode()
OLD_LONG='<button class="account-back" type="button" data-account-back>← Назад в личный кабинет</button>'.encode()
OLD_SHORT='<button class="account-back" type="button" data-account-back>← В кабинет</button>'.encode()
PREMIUM='<button class="account-back numi-tariff-back" type="button" data-account-back><span aria-hidden="true">←</span> Назад в личный кабинет</button>'.encode()
BEGIN=b'    <style id="numi-global-account-back-20261031">'
END=b'    <!-- Reversible experiment: subtitles on the eight homepage catalog cards only. -->'
def digest(b):return hashlib.sha256(b).digest()
def report(**v):print("NUMI_GOLD_BACK",json.dumps(v,sort_keys=True),flush=True)
def public_index():
    req=Request("https://"+DOMAIN+"/?gold_back="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=35) as resp:
        if resp.status!=200:raise RuntimeError("Unexpected homepage response")
        return resp.read(3000000)
def main():
    src=pathlib.Path("index.html").read_bytes()
    if src.count(BEGIN)!=1 or src.count(END)!=1 or src.count(GOLD)!=4 or src.count(PREMIUM)!=1:
        raise RuntimeError("Expected five source navigation buttons and scoped CSS")
    block=BEGIN+src.split(BEGIN,1)[1].split(END,1)[0]
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    path=root+"/www/"+DOMAIN+"/index.html"
    guardpath=root+"/www/"+DOMAIN+"/.htaccess"
    def read(p):
        buf=io.BytesIO();ftp.retrbinary("RETR "+p,buf.write);return buf.getvalue()
    def write(p,data):
        ftp.storbinary("STOR "+p,io.BytesIO(data))
        if digest(read(p))!=digest(data):raise RuntimeError("Remote checksum mismatch")
    try:
        prior=read(path)
        guard=read(guardpath)
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("Paid content guard missing")
        if prior.count(END)!=1 or prior.count(PREMIUM)!=1:
            raise RuntimeError("Unrecognized live pricing/navigation baseline; no changes")
        # Saved/club/learning/settings may have either earlier button label.
        # Do not presume the saved-page release landed before this release.
        old_count=prior.count(OLD_SHORT)+prior.count(OLD_LONG)
        gold_count=prior.count(GOLD)
        if old_count+gold_count!=4:
            raise RuntimeError("Unexpected number of cabinet navigation buttons; no changes")
        if BEGIN in prior and block not in prior:
            raise RuntimeError("Conflicting shared back-button styling already exists")
        updated=prior.replace(OLD_LONG,GOLD).replace(OLD_SHORT,GOLD)
        if BEGIN not in prior:
            updated=updated.replace(END,block+END,1)
        if updated.count(GOLD)!=4:
            raise RuntimeError("Navigation transformation incomplete; no changes")
        if updated==prior:
            report(success=True,already_published=True)
            return
        folder=root+"/site-safeguard-backups"
        try:ftp.mkd(folder)
        except ftplib.error_perm:ftp.cwd(folder)
        backup=folder+"/gold-account-back-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup);write(backup+"/index.html.bak",prior)
        attempted=False
        try:
            attempted=True
            write(path,updated)
            if digest(public_index())!=digest(updated):raise RuntimeError("Live homepage differs after publish")
            if read(guardpath)!=guard:raise RuntimeError("Paid content guard changed")
            report(success=True,live_verified=True,account_navigation_only=True)
        except BaseException:
            if attempted:write(path,prior)
            report(rollback_completed=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as error:
        report(success=False,reason=str(error)[:180] if isinstance(error,RuntimeError) else type(error).__name__)
        sys.exit(1)
