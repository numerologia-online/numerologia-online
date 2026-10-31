"""Guarded release of saved library structure; no modifications to account/payment data."""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru";DOMAIN="xn--c1adkkdfjbp1a4l.online"
START=b'        <section class="account-panel'
OLD_START=b'        <section class="account-panel" data-account-content="saved" hidden>'
NEW_START=b'        <section class="account-panel numi-saved-library" data-account-content="saved" hidden>'
END=b'        <section class="account-panel" data-account-content="club" hidden>'
CSS=b'    <style id="numi-saved-library-structure-20261031">'
CSS_END=b'    <!-- Reversible experiment: subtitles on the eight homepage catalog cards only. -->'
def digest(data):return hashlib.sha256(data).digest()
def report(**kwargs):print("NUMI_SAVED_LAYOUT",json.dumps(kwargs,sort_keys=True),flush=True)
def remote_html():
    req=Request("https://"+DOMAIN+"/?saved_layout="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=35) as resp:
        if resp.status!=200:raise RuntimeError("Unexpected HTTP status")
        return resp.read(3000000)
def main():
    source=pathlib.Path("index.html").read_bytes()
    if source.count(NEW_START)!=1 or source.count(END)!=1 or source.count(CSS)!=1 or source.count(CSS_END)!=1:
        raise RuntimeError("Unexpected local saved layout")
    pane=NEW_START+source.split(NEW_START,1)[1].split(END,1)[0]
    styles=CSS+source.split(CSS,1)[1].split(CSS_END,1)[0]
    if b'numi-confirmed-purchases' not in pane or b'numi-saved-empty' not in pane:
        raise RuntimeError("Incomplete saved-page content")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    site=root+"/www/"+DOMAIN
    page=site+"/index.html";guard=site+"/.htaccess"
    def read(path):
        f=io.BytesIO();ftp.retrbinary("RETR "+path,f.write);return f.getvalue()
    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if digest(read(path))!=digest(data):raise RuntimeError("FTP write checksum mismatch")
    try:
        original=read(page);guard_original=read(guard)
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard_original:
            raise RuntimeError("Protected access rules missing")
        if original.count(END)!=1 or original.count(CSS_END)!=1:
            raise RuntimeError("Unexpected live homepage")
        if NEW_START in original or CSS in original:
            if pane in original and styles in original:
                report(success=True,already_published=True)
                return
            raise RuntimeError("Partial/conflicting saved-page update; no write")
        if original.count(OLD_START)!=1:raise RuntimeError("Old saved section missing")
        old=OLD_START+original.split(OLD_START,1)[1].split(END,1)[0]
        if b'account-library-group' not in old or b'account-empty-state' not in old:
            raise RuntimeError("Current section differs from known old structure")
        updated=original.replace(old,pane,1).replace(CSS_END,styles+CSS_END,1)
        folder=root+"/site-safeguard-backups"
        try:ftp.mkd(folder)
        except ftplib.error_perm:ftp.cwd(folder)
        backup=folder+"/saved-layout-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        write(backup+"/index.html.bak",original)
        wrote=False
        try:
            wrote=True;write(page,updated)
            if digest(remote_html())!=digest(updated):raise RuntimeError("Public HTML verification failed")
            if read(guard)!=guard_original:raise RuntimeError("Protected access changed")
            report(success=True,live_verified=True,saved_layout_published=True,backend_unchanged=True)
        except BaseException:
            if wrote:write(page,original)
            report(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as exc:
        report(success=False,reason=str(exc)[:180] if isinstance(exc,RuntimeError) else type(exc).__name__)
        sys.exit(1)
