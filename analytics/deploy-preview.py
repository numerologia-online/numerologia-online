"""Publish visible analytics presentation, without exposing private statistics.

Only /analytics/index.html is replaced. Login API, database and all other
site routes are unchanged. Strict baseline, backup, checksum, rollback.
"""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time,urllib.error
from urllib.request import Request,urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
def digest(d):return hashlib.sha256(d).hexdigest()
def main():
    target=pathlib.Path("analytics/admin/index.html").read_bytes()
    if b"not real" in target:pass
    if b"DEMO" not in target and "ДЕМО".encode() not in target:raise RuntimeError("Demo label missing")
    if b"admin_login" in target or b'<form id="login"' in target:raise RuntimeError("Login still shown")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    site=root+"/www/"+DOMAIN
    path=site+"/analytics/index.html"
    def read(p):
        buf=io.BytesIO();ftp.retrbinary("RETR "+p,buf.write);return buf.getvalue()
    def write(p,blob):
        ftp.storbinary("STOR "+p,io.BytesIO(blob))
        if digest(read(p))!=digest(blob):raise RuntimeError("FTP verification failed")
    try:
        original=read(path)
        if b'<form id="login"' not in original and original!=target:
            raise RuntimeError("Unexpected live analytics page: refuse overwrite")
        backups=root+"/site-safeguard-backups"
        try:ftp.mkd(backups)
        except ftplib.error_perm:ftp.cwd(backups)
        name=backups+"/analytics-preview-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+".html.bak"
        write(name,original)
        try:
            if original!=target:write(path,target)
            req=Request("https://"+DOMAIN+"/analytics/index.html?preview_check="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
            with urlopen(req,timeout=45) as r:
                published=r.read(600000)
                if r.status!=200 or digest(published)!=digest(target):
                    raise RuntimeError("Public preview failed verification")
            print("ANALYTICS_PREVIEW "+json.dumps({"success":True,"public_verified":True,"login_form_removed":True,"data":"DEMO_ONLY"}),flush=True)
        except BaseException:
            write(path,original)
            print("ANALYTICS_PREVIEW "+json.dumps({"rollback":True}),flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        print("ANALYTICS_PREVIEW "+json.dumps({"success":False,"error":str(e)[:200]}),flush=True);sys.exit(1)
