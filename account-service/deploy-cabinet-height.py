"""Install one CSS-only height fix into the existing live homepage, guarded and reversible."""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
BEGIN=b'    <style id="numi-stable-cabinet-height-20261031">'
END=b'    <!-- Reversible experiment: subtitles on the eight homepage catalog cards only. -->'
def hashit(data):return hashlib.sha256(data).digest()
def report(**v):print("NUMI_CABINET_HEIGHT",json.dumps(v,sort_keys=True),flush=True)
def http():
    req=Request("https://"+DOMAIN+"/?height_verify="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=30) as resp:
        if resp.status!=200:raise RuntimeError("Unexpected site status")
        return resp.read(2000000)
def main():
    source=pathlib.Path("index.html").read_bytes()
    if source.count(BEGIN)!=1 or source.count(END)!=1:raise RuntimeError("Source HTML markers missing")
    fix=BEGIN+source.split(BEGIN,1)[1].split(END,1)[0]
    if b"78dvh" not in fix or b"input:focus" not in fix:raise RuntimeError("CSS safety check failed")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    site=home+"/www/"+DOMAIN
    index=site+"/index.html"
    def read(path):
        buf=io.BytesIO();ftp.retrbinary("RETR "+path,buf.write);return buf.getvalue()
    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if hashit(read(path))!=hashit(data):raise RuntimeError("Remote file checksum mismatch")
    try:
        previous=read(index)
        guard=read(site+"/.htaccess")
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("Protected paid access baseline missing")
        if BEGIN in previous:
            if fix in previous:report(success=True,already_present=True);return
            raise RuntimeError("Different height patch already exists; refuse overwrite")
        if previous.count(END)!=1 or b"account-dialog" not in previous:
            raise RuntimeError("Unknown live homepage; no change")
        updated=previous.replace(END,fix+END,1)
        backroot=home+"/site-safeguard-backups"
        try:ftp.mkd(backroot)
        except ftplib.error_perm:ftp.cwd(backroot)
        folder=backroot+"/cabinet-height-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(folder)
        write(folder+"/index.html.bak",previous)
        attempted=False
        try:
            attempted=True
            write(index,updated)
            if hashit(http())!=hashit(updated):raise RuntimeError("Live index verification failed")
            if read(site+"/.htaccess")!=guard:raise RuntimeError("Paid access guard changed")
            report(success=True,live_verified=True,only_index_changed=True)
        except BaseException:
            if attempted:write(index,previous)
            report(rollback_completed=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        report(success=False,reason=str(e)[:180] if isinstance(e,RuntimeError) else type(e).__name__)
        sys.exit(1)
