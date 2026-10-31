"""Publish only brighter club comparison prices and scoped CSS, preserving all other HTML."""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time
from urllib.request import Request,urlopen

DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
MARKER=b'    <style id="numi-bright-club-column-20261031">'
END=b'    <!-- Reversible experiment: subtitles on the eight homepage catalog cards only. -->'
REPLACEMENTS=[
 ('<strong role="cell">Полный разбор года</strong><span role="cell">990 ₽</span><span role="cell">490 ₽</span>',
  '<strong role="cell">Полный разбор года</strong><span role="cell">990 ₽</span><span role="cell" class="numi-club-discount">−50%</span>'),
 ('<strong role="cell">Полный разбор жизни</strong><span role="cell">990 ₽</span><span role="cell">490 ₽</span>',
  '<strong role="cell">Полный разбор жизни</strong><span role="cell">990 ₽</span><span role="cell" class="numi-club-discount">−50%</span>'),
 ('<strong role="cell">Вопросы «Да или нет?»</strong><span role="cell">19 ₽</span><span role="cell">0 ₽</span>',
  '<strong role="cell">Вопросы «Да или нет?»</strong><span role="cell">19 ₽</span><span role="cell" class="numi-club-free">БЕСПЛАТНО</span>'),
 ('<span role="cell">−50%<small>на вопросы</small></span>',
  '<span role="cell" class="numi-club-discount">−50%<small>на вопросы</small></span>'),
 ('<strong role="cell">Нумерология момента</strong><span role="cell">100 ₽</span><span role="cell">−50%</span>',
  '<strong role="cell">Нумерология момента</strong><span role="cell">100 ₽</span><span role="cell" class="numi-club-discount">−50%</span>')
]
def digest(b):return hashlib.sha256(b).digest()
def report(**x):print("NUMI_BRIGHT_CLUB",json.dumps(x,sort_keys=True),flush=True)
def fetch_live():
    url="https://"+DOMAIN+"/?club_column="+str(time.time_ns())
    with urlopen(Request(url,headers={"Cache-Control":"no-cache"}),timeout=35) as res:
        if res.status!=200:raise RuntimeError("Unexpected live HTTP status")
        return res.read(3000000)
def main():
    source=pathlib.Path("index.html").read_bytes()
    if source.count(MARKER)!=1 or source.count(END)!=1:raise RuntimeError("Local CSS missing")
    css=MARKER+source.split(MARKER,1)[1].split(END,1)[0]
    if b"numi-club-free" not in css or b"numi-tariff-row--feature" not in css:
        raise RuntimeError("Incomplete styling")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    site=home+"/www/"+DOMAIN
    indexpath=site+"/index.html"
    guardpath=site+"/.htaccess"
    def get(p):
        output=io.BytesIO();ftp.retrbinary("RETR "+p,output.write);return output.getvalue()
    def put(p,data):
        ftp.storbinary("STOR "+p,io.BytesIO(data))
        if digest(get(p))!=digest(data):raise RuntimeError("Remote integrity mismatch")
    try:
        old=get(indexpath)
        guard=get(guardpath)
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("Paid access guard absent")
        if MARKER in old:
            if css in old and all(b.encode() in old for _,b in REPLACEMENTS):
                report(success=True,already_present=True);return
            raise RuntimeError("Conflicting club style exists")
        if old.count(END)!=1 or b'    <style id="numi-premium-tariffs-20261031">' not in old:
            raise RuntimeError("Premium tariff baseline missing; no write")
        updated=old
        for a,b in REPLACEMENTS:
            before=a.encode();after=b.encode()
            if updated.count(before)!=1:raise RuntimeError("Live price row differs: "+a[:32])
            updated=updated.replace(before,after,1)
        updated=updated.replace(END,css+END,1)
        backup_root=home+"/site-safeguard-backups"
        try:ftp.mkd(backup_root)
        except ftplib.error_perm:ftp.cwd(backup_root)
        folder=backup_root+"/club-bright-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(folder);put(folder+"/index.html.bak",old)
        tried=False
        try:
            tried=True;put(indexpath,updated)
            if digest(fetch_live())!=digest(updated):raise RuntimeError("Live HTML differs")
            if get(guardpath)!=guard:raise RuntimeError("Protected access changed")
            report(success=True,verified=True,only_club_comparison_changed=True)
        except BaseException:
            if tried:put(indexpath,old)
            report(rollback_complete=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        report(success=False,reason=str(e)[:140] if isinstance(e,RuntimeError) else type(e).__name__)
        sys.exit(1)
