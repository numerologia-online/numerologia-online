"""Safe narrow patch: replace SVG illustration only in the published Saved empty state."""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru";DOMAIN="xn--c1adkkdfjbp1a4l.online"
PREFIX=b'<svg class="numi-angel"'
END=b'</svg>'
OLD_STYLE=b'#account-dialog .numi-angel {display:block;width:min(100%,260px);height:auto;margin:0 auto 6px}'
NEW_STYLE=b'#account-dialog .numi-angel {display:block;width:min(100%,285px);height:auto;margin:0 auto 6px}'
def digest(b):return hashlib.sha256(b).digest()
def log(**v):print("NUMI_FAIRY_ANGEL",json.dumps(v,sort_keys=True),flush=True)
def live():
    req=Request("https://"+DOMAIN+"/?angel_release="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=35) as r:
        if r.status!=200:raise RuntimeError("HTTP status unexpected")
        return r.read(3000000)
def main():
    source=pathlib.Path("index.html").read_bytes()
    if source.count(PREFIX)!=1 or NEW_STYLE not in source:raise RuntimeError("New SVG source invalid")
    angel=PREFIX+source.split(PREFIX,1)[1].split(END,1)[0]+END
    if b"numi-angel-hair" not in angel or 'Ответы на твои'.encode() not in angel:
        raise RuntimeError("Illustration integrity check failed")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    path=root+"/www/"+DOMAIN+"/index.html"
    guard=root+"/www/"+DOMAIN+"/.htaccess"
    def read(p):
        o=io.BytesIO();ftp.retrbinary("RETR "+p,o.write);return o.getvalue()
    def write(p,b):
        ftp.storbinary("STOR "+p,io.BytesIO(b))
        if digest(read(p))!=digest(b):raise RuntimeError("Remote data mismatch")
    try:
        original=read(path);protected=read(guard)
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in protected:
            raise RuntimeError("Paid access guard absent")
        if original.count(PREFIX)!=1 or original.count(END)<1:
            raise RuntimeError("Saved-page angel markup absent")
        old=PREFIX+original.split(PREFIX,1)[1].split(END,1)[0]+END
        if b'viewBox="0 0 280 218"' not in old:
            if angel==old and NEW_STYLE in original:log(success=True,already_live=True);return
            raise RuntimeError("Unknown old illustration, refusing write")
        if original.count(OLD_STYLE)!=1:raise RuntimeError("Old CSS anchor mismatch")
        updated=original.replace(old,angel,1).replace(OLD_STYLE,NEW_STYLE,1)
        rootbackup=root+"/site-safeguard-backups"
        try:ftp.mkd(rootbackup)
        except ftplib.error_perm:ftp.cwd(rootbackup)
        folder=rootbackup+"/angel-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(folder);write(folder+"/index.html.bak",original)
        changed=False
        try:
            changed=True;write(path,updated)
            if digest(live())!=digest(updated):raise RuntimeError("Live homepage verification failed")
            if read(guard)!=protected:raise RuntimeError("Protected rules changed")
            log(success=True,live_verified=True,only_angel_replaced=True)
        except BaseException:
            if changed:write(path,original)
            log(rollback_complete=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        log(success=False,reason=str(e)[:150] if isinstance(e,RuntimeError) else type(e).__name__)
        sys.exit(1)
