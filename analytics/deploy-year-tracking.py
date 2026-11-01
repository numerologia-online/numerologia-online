"""Deploy only homepage and year page analytics hooks, with backups and rollback."""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time,urllib.error
from urllib.request import Request,urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
BASE={"index.html":"734d8abf6810fd2da6a965adcc513bc450b1ffa2","year/index.html":"642b785f6a266d0c92694719528a868db405b5bf"}
FILES=list(BASE)
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    desired={p:pathlib.Path(p).read_bytes() for p in FILES}
    for p,blob in desired.items():
        if b"moment/analytics.js?v=3" not in blob:raise RuntimeError("Analytics hook missing "+p)
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=50)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    base=root+"/www/"+DOMAIN
    def read(p):
        buf=io.BytesIO();ftp.retrbinary("RETR "+p,buf.write);return buf.getvalue()
    def write(p,blob):
        ftp.storbinary("STOR "+p,io.BytesIO(blob))
        if sha(read(p))!=sha(blob):raise RuntimeError("FTP checksum "+p)
    try:
        original={}
        for path in FILES:
            original[path]=read(base+"/"+path)
            old=subprocess.check_output(["git","cat-file","blob",BASE[path]])
            if original[path]!=old and original[path]!=desired[path]:
                raise RuntimeError("Live "+path+" has other edits; no overwrite")
        backupdir=root+"/site-safeguard-backups"
        try:ftp.mkd(backupdir)
        except ftplib.error_perm:ftp.cwd(backupdir)
        stamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        for path,blob in original.items():
            write(backupdir+"/year-analytics-"+stamp+"-"+path.replace("/","_")+".bak",blob)
        touched=[]
        try:
            for path in FILES:
                if desired[path]!=original[path]:
                    touched.append(path);write(base+"/"+path,desired[path])
            for path in FILES:
                url="https://"+DOMAIN+"/"+path+"?year_analytics_check="+str(time.time_ns())
                with urlopen(Request(url,headers={"Cache-Control":"no-cache"}),timeout=45) as response:
                    data=response.read(250000)
                    if response.status!=200 or sha(data)!=sha(desired[path]):
                        raise RuntimeError("Public checksum mismatch "+path)
            print("NUMI_YEAR_ANALYTICS "+json.dumps({"success":True,"verified":FILES}),flush=True)
        except BaseException:
            for path in reversed(touched):
                try:write(base+"/"+path,original[path])
                except BaseException as e:print("NUMI_YEAR_ANALYTICS "+json.dumps({"rollback_failed":path,"error":str(e)[:100]}),flush=True)
            print("NUMI_YEAR_ANALYTICS "+json.dumps({"rollback_attempted":True}),flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        print("NUMI_YEAR_ANALYTICS "+json.dumps({"success":False,"reason":str(e)[:240]}),flush=True);sys.exit(1)
