"""Publish public, real aggregate-only analytics with checks and rollback.

Exactly two allowlisted paths; no account, bot, payment or site home changes.
"""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time,urllib.error
from urllib.request import Request,urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
ASSETS={
    "analytics/index.html":pathlib.Path("analytics/admin/index.html").read_bytes(),
    "api/numi-analytics.php":pathlib.Path("analytics/public/numi-analytics.php").read_bytes(),
}
def digest(d):return hashlib.sha256(d).hexdigest()
def get(path):
    url="https://"+DOMAIN+"/"+path+("&" if "?" in path else "?")+"live_check="+str(time.time_ns())
    try:
        with urlopen(Request(url,headers={"Cache-Control":"no-cache"}),timeout=35) as r:return r.status,r.read(600000)
    except urllib.error.HTTPError as err:return err.code,err.read(4096)
def main():
    html=ASSETS["analytics/index.html"]
    php=ASSETS["api/numi-analytics.php"]
    if any(x in html for x in [b"DEMO",b"sample=",b'<form id="login"']):raise RuntimeError("Demo or login remains")
    if b"fetch(" not in html or b"numi-analytics.php" not in html:raise RuntimeError("Live data fetch missing")
    if b"axAdmin($db)" in php or b"admin_login" in php:raise RuntimeError("Password required")
    if b"axEnsureTable($db)" not in php:raise RuntimeError("Counter initialization missing")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    base=root+"/www/"+DOMAIN
    def read(p):
        buf=io.BytesIO();ftp.retrbinary("RETR "+p,buf.write);return buf.getvalue()
    def write(p,blob):
        ftp.storbinary("STOR "+p,io.BytesIO(blob))
        if digest(read(p))!=digest(blob):raise RuntimeError("FTP mismatch: "+p.rsplit("/",1)[-1])
    try:
        current={}
        for path in ASSETS:
            current[path]=read(base+"/"+path)
        # Refuse to replace unrelated or unknown live code.
        if b"numi-analytics.php" not in current["api/numi-analytics.php"]: 
            # Existing analytics PHP from this project has the unique header below.
            if b"NUMI_AGG_ANALYTICS" not in current["api/numi-analytics.php"] or b"axOriginAllowed" not in current["api/numi-analytics.php"]:
                raise RuntimeError("Unexpected API file; not replacing")
        if "Что интересно посетителям".encode("utf-8") not in current["analytics/index.html"]:
            raise RuntimeError("Unexpected live HTML; not replacing")
        backups=root+"/site-safeguard-backups"
        try:ftp.mkd(backups)
        except ftplib.error_perm:ftp.cwd(backups)
        suffix=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        for path,original in current.items():
            write(backups+"/analytics-live-"+suffix+"-"+path.replace("/","_")+".bak",original)
        touched=[]
        try:
            # Update API first so old demo never displays invented live data.
            for path in ["api/numi-analytics.php","analytics/index.html"]:
                data=ASSETS[path]
                if data!=current[path]:
                    touched.append(path)
                    write(base+"/"+path,data)
            for path,expected in ASSETS.items():
                if path.endswith(".php"):continue
                code,body=get(path)
                if code!=200 or digest(body)!=digest(expected):raise RuntimeError("Public page did not match published source")
            code,body=get("api/numi-analytics.php?days=7")
            if code!=200:raise RuntimeError("Real analytics API returned HTTP "+str(code))
            try:status=json.loads(body)
            except ValueError:raise RuntimeError("API response not JSON")
            if status.get("ok") is not True or not isinstance(status.get("rows"),list):
                raise RuntimeError("API did not return live aggregate rows")
            print("NUMI_ANALYTICS_LIVE "+json.dumps({"success":True,"html_verified":True,"api_verified":True,"real_rows":len(status["rows"]),"password_required":False}),flush=True)
        except BaseException:
            for path in reversed(touched):
                try:write(base+"/"+path,current[path])
                except BaseException as e:print("NUMI_ANALYTICS_LIVE "+json.dumps({"rollback_failed":path,"type":type(e).__name__}),flush=True)
            print("NUMI_ANALYTICS_LIVE "+json.dumps({"rollback_attempted":True}),flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        print("NUMI_ANALYTICS_LIVE "+json.dumps({"success":False,"error":str(e)[:240]}),flush=True);sys.exit(1)
