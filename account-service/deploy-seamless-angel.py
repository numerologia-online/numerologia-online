"""Safely publish only the Saved angel's seamless background and visible title."""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time
from urllib.request import Request,urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
CSS_START=b'    <style id="numi-angel-seamless-background-20261031">'
CSS_END=b'    <!-- Reversible experiment: subtitles on the eight homepage catalog cards only. -->'
OLD='          <div class="account-empty-state numi-saved-empty">\n            <img class="numi-angel" src="assets/numi-angel-soft-20261031.webp" width="310" height="300" loading="lazy" decoding="async" alt="Нежный ангел с крылышками держит сердце: Ответы на твои вопросы">'.encode('utf-8')
NEW='          <div class="account-empty-state numi-saved-empty">\n            <div class="numi-saved-angel-title">♡ Ответы на твои вопросы</div>\n            <img class="numi-angel" src="assets/numi-angel-soft-20261031.webp" width="310" height="300" loading="lazy" decoding="async" alt="Нежный ангел с крылышками держит сердце с ответами">'.encode('utf-8')
def sha(b):return hashlib.sha256(b).digest()
def report(**kwargs):print("NUMI_ANGEL_BG",json.dumps(kwargs,sort_keys=True),flush=True)
def public_page():
    uri="https://"+DOMAIN+"/?angel_background="+str(time.time_ns())
    with urlopen(Request(uri,headers={"Cache-Control":"no-cache"}),timeout=40) as response:
        if response.status!=200:raise RuntimeError("Unexpected HTTP response")
        return response.read(3000000)
def main():
    src=pathlib.Path("index.html").read_bytes()
    if src.count(CSS_START)!=1 or src.count(NEW)!=1 or src.count(CSS_END)!=1:
        raise RuntimeError("Source markup not ready")
    css=CSS_START+src.split(CSS_START,1)[1].split(CSS_END,1)[0]
    if b"mix-blend-mode:multiply" not in css:raise RuntimeError("Background blending missing")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    page=root+"/www/"+DOMAIN+"/index.html"
    guard=root+"/www/"+DOMAIN+"/.htaccess"
    def read(p):
        o=io.BytesIO();ftp.retrbinary("RETR "+p,o.write);return o.getvalue()
    def write(p,blob):
        ftp.storbinary("STOR "+p,io.BytesIO(blob))
        if sha(read(p))!=sha(blob):raise RuntimeError("FTPS integrity mismatch")
    try:
        before=read(page);protected=read(guard)
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in protected:
            raise RuntimeError("Paid-content protection unavailable")
        if before.count(CSS_END)!=1:raise RuntimeError("Live styling anchor missing")
        if CSS_START in before:
            if NEW in before and css in before:
                report(success=True,already_published=True)
                return
            raise RuntimeError("Different angel style exists")
        if before.count(OLD)!=1:raise RuntimeError("Old angel UI changed unexpectedly")
        newer=before.replace(OLD,NEW,1).replace(CSS_END,css+CSS_END,1)
        backup_root=root+"/site-safeguard-backups"
        try:ftp.mkd(backup_root)
        except ftplib.error_perm:ftp.cwd(backup_root)
        backup=backup_root+"/angel-seamless-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        write(backup+"/index.html.bak",before)
        attempted=False
        try:
            attempted=True
            write(page,newer)
            if sha(public_page())!=sha(newer):raise RuntimeError("Live homepage didn't match update")
            if read(guard)!=protected:raise RuntimeError("Paid-content security changed")
            report(success=True,live_verified=True,only_angel_ui_changed=True)
        except BaseException:
            if attempted:write(page,before)
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
