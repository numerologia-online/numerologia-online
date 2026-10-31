"""Isolated tariff text and responsive CSS release, safe rollback and HTTP verification."""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time
from urllib.request import Request,urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online";HOST="server172.hosting.reg.ru"
CSS_START=b'    <style id="numi-tariff-legibility-fix-20261031">'
END=b'    <!-- Reversible experiment: subtitles on the eight homepage catalog cards only. -->'
UPDATES=[
 ('<span class="numi-tariff-card-foot">Без обязательств</span>','<span class="numi-tariff-card-foot">Без подписки</span>'),
 ('<span role="cell" class="numi-club-free">БЕСПЛАТНО</span>','<span role="cell" class="numi-club-free"><strong>БЕСПЛАТНО</strong></span>'),
 ('<strong role="cell">Календарь важных чисел</strong><span role="cell">Недоступно</span><span role="cell">Включено</span>','<strong role="cell">Календарь важных чисел</strong><span role="cell" class="numi-tariff-unavailable">—</span><span role="cell" class="numi-club-included"><strong>✓</strong><small>Включено</small></span>'),
 ('<strong role="cell">Денежные ритуалы</strong><span role="cell">Недоступно</span><span role="cell">В клубе</span>','<strong role="cell">Денежные ритуалы</strong><span role="cell" class="numi-tariff-unavailable">—</span><span role="cell" class="numi-club-included"><strong>✓</strong><small>Только в клубе</small></span>'),
]
def hash_(data):return hashlib.sha256(data).digest()
def log(**kwargs):print("NUMI_TARIFF_READABILITY",json.dumps(kwargs,sort_keys=True),flush=True)
def public():
    req=Request("https://"+DOMAIN+"/?tariff_labels="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=35) as resp:
        if resp.status!=200:raise RuntimeError("Unexpected public status")
        return resp.read(3000000)
def main():
    source=pathlib.Path("index.html").read_bytes()
    if source.count(CSS_START)!=1 or source.count(END)!=1:raise RuntimeError("Source styles missing")
    style=CSS_START+source.split(CSS_START,1)[1].split(END,1)[0]
    if any(b.encode() not in source for _,b in UPDATES):raise RuntimeError("Updated labels absent")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    site=root+"/www/"+DOMAIN
    target=site+"/index.html";guard=site+"/.htaccess"
    def read(path):
        buffer=io.BytesIO();ftp.retrbinary("RETR "+path,buffer.write);return buffer.getvalue()
    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if hash_(read(path))!=hash_(data):raise RuntimeError("Remote checksum mismatch")
    try:
        old=read(target);protected=read(guard)
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in protected:
            raise RuntimeError("Paid guard absent")
        if old.count(END)!=1:raise RuntimeError("HTML style insertion anchor differs")
        if CSS_START in old:
            if style in old and all(new.encode() in old for _,new in UPDATES):
                log(success=True,already_published=True);return
            raise RuntimeError("Partial/conflicting labels update")
        updated=old
        for before,after in UPDATES:
            if updated.count(before.encode())!=1:
                raise RuntimeError("Tariff row unexpectedly changed: "+before[:35])
            updated=updated.replace(before.encode(),after.encode(),1)
        updated=updated.replace(END,style+END,1)
        folder=root+"/site-safeguard-backups"
        try:ftp.mkd(folder)
        except ftplib.error_perm:ftp.cwd(folder)
        backup=folder+"/tariff-labels-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup);write(backup+"/index.html.bak",old)
        changed=False
        try:
            changed=True;write(target,updated)
            if hash_(public())!=hash_(updated):raise RuntimeError("Live page verification failed")
            if read(guard)!=protected:raise RuntimeError("Access guard changed unexpectedly")
            log(success=True,live_verified=True,only_tariff_labels_changed=True)
        except BaseException:
            if changed:write(target,old)
            log(rollback_complete=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        log(success=False,reason=str(e)[:160] if isinstance(e,RuntimeError) else type(e).__name__)
        sys.exit(1)
