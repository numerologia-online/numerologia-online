"""Deploy JS-only account error fix; refuse any unrecognized live revision."""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
def digest(b):return hashlib.sha256(b).digest()
def gitfile(rev,path):return subprocess.check_output(["git","show",rev+":"+path])
def report(**x):print("NUMI_MERGE_CLEAR",json.dumps(x,sort_keys=True),flush=True)
def public(path):
    with urlopen(Request("https://"+DOMAIN+"/"+path+("?" if "?" not in path else "&")+"merge_clear="+str(time.time_ns()),headers={"Cache-Control":"no-cache"}),timeout=30) as response:
        if response.status!=200:raise RuntimeError("Unexpected HTTP status")
        return response.read(2000000)
def main():
    js=pathlib.Path("account-browser.js").read_bytes()
    if b"const merged=await perform" not in js or b"if(merged && current?.email_verified)" not in js or b"clearMessage();" not in js:
        raise RuntimeError("Fix is absent from local JS")
    revisions=[
      (b"account-browser.js?v=11",gitfile("ae841b38e4c4e067da5755fe9d492ce125c85f9c","account-browser.js")),
      (b"account-browser.js?v=12",gitfile("a7ddf5eff679e7175b9bc536de934e86cddd7458","account-browser.js"))
    ]
    dest=b"account-browser.js?v=13"
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    base=ftp.pwd().rstrip("/")
    site=base+"/www/"+DOMAIN
    paths={"index":site+"/index.html","js":site+"/account-browser.js","guard":site+"/.htaccess","auth":site+"/auth-profile.js"}
    def read(p):
        out=io.BytesIO();ftp.retrbinary("RETR "+p,out.write);return out.getvalue()
    def write(p,b):
        ftp.storbinary("STOR "+p,io.BytesIO(b))
        if digest(read(p))!=digest(b):raise RuntimeError("Remote checksum mismatch")
    try:
        before={name:read(path) for name,path in paths.items()}
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in before["guard"]:
            raise RuntimeError("Access protection missing")
        matches=[tag for tag,old in revisions if before["index"].count(tag)==1 and digest(before["js"])==digest(old)]
        if len(matches)!=1 or dest in before["index"]:
            raise RuntimeError("Unrecognized live frontend; no modification")
        new_index=before["index"].replace(matches[0],dest,1)
        root=base+"/site-safeguard-backups"
        try:ftp.mkd(root)
        except ftplib.error_perm:ftp.cwd(root)
        folder=root+"/merge-error-clear-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(folder)
        for name in ("index","js"):write(folder+"/"+name+".bak",before[name])
        touched=[]
        try:
            for name,data in (("js",js),("index",new_index)):
                touched.append(name);write(paths[name],data)
            if digest(public("account-browser.js"))!=digest(js) or digest(public(""))!=digest(new_index):
                raise RuntimeError("Live verification failed")
            if read(paths["guard"])!=before["guard"] or read(paths["auth"])!=before["auth"]:
                raise RuntimeError("Protected files changed")
            report(success=True,stale_errors_fixed=True,backend_unchanged=True)
        except BaseException:
            for name in reversed(touched):
                try:write(paths[name],before[name])
                except BaseException:report(rollback_failed=name)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as exc:
        report(success=False,reason=str(exc)[:160] if isinstance(exc,RuntimeError) else type(exc).__name__)
        sys.exit(1)
