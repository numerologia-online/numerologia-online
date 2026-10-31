"""Narrow two-cell tariff fix. Preserves all unrelated production HTML."""
import ftplib,hashlib,io,json,os,ssl,sys,time
from urllib.request import Request,urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
OLD='<span role="cell" class="numi-tariff-unavailable">—</span>'.encode("utf-8")
NEW='<span role="cell" class="numi-tariff-unavailable">Недоступно</span>'.encode("utf-8")
STYLE_OLD=b'color:#acada5;font-size:24px;font-weight:400;'
STYLE_NEW=b'color:#748479;font:700 clamp(9px,2.6vw,12px)/1.2 system-ui,sans-serif;\n        letter-spacing:-.035em;overflow-wrap:normal;word-break:normal;'
def sha(b):return hashlib.sha256(b).hexdigest()
def log(**kw):print("NUMI_TARIFF_UNAVAILABLE",json.dumps(kw,sort_keys=True),flush=True)
def public():
    req=Request("https://"+DOMAIN+"/?tariff_unavailable="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=40) as r:
        if r.status!=200:raise RuntimeError("Unexpected public status")
        return r.read(3000000)
def main():
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    path=root+"/www/"+DOMAIN+"/index.html"
    def read(file):
        out=io.BytesIO();ftp.retrbinary("RETR "+file,out.write);return out.getvalue()
    def write(file,data):
        ftp.storbinary("STOR "+file,io.BytesIO(data))
        if sha(read(file))!=sha(data):raise RuntimeError("FTP verification mismatch")
    try:
        before=read(path)
        if before.count(NEW)==2 and STYLE_NEW in before:
            log(success=True,already_published=True);return
        if before.count(OLD)!=2 or before.count(STYLE_OLD)!=1 or before.count(NEW)!=0:
            raise RuntimeError("Live tariff anchors differ, no files changed")
        revised=before.replace(OLD,NEW).replace(STYLE_OLD,STYLE_NEW,1)
        if revised.count(NEW)!=2 or revised.count(STYLE_NEW)!=1:
            raise RuntimeError("New tariff markup validation failed")
        parent=root+"/site-safeguard-backups"
        try:ftp.mkd(parent)
        except ftplib.error_perm:ftp.cwd(parent)
        backup=parent+"/tariff-unavailable-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        write(backup+"/index.html.bak",before)
        try:
            write(path,revised)
            if sha(public())!=sha(revised):raise RuntimeError("Public page verification failed")
            log(success=True,live_verified=True,only_two_labels_and_css=True)
        except BaseException:
            write(path,before)
            log(rolled_back=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        log(success=False,reason=str(e)[:160] if isinstance(e,RuntimeError) else type(e).__name__)
        sys.exit(1)
