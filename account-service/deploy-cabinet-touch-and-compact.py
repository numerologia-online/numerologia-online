"""Guarded release: Telegram cabinet touch safety and smaller price layout only."""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
CSS_BEGIN=b'    <style id="numi-cabinet-full-height-compact-prices-20261031">'
CSS_END=b'    <!-- Reversible experiment: subtitles on the eight homepage catalog cards only. -->'
OLD_TOPICS="Знакомство и инициатива · Подарки и щедрость · Деньги и ответственность · Верность и измены · Семья и отношения · Язык любви".encode()
NEW_TOPICS="Знакомство · Подарки · Деньги · Верность · Семья · Язык любви".encode()
def hash_bytes(data):return hashlib.sha256(data).digest()
def git_content(rev,path):return subprocess.check_output(["git","show",rev+":"+path])
def notice(**kwargs):print("NUMI_CABINET_TOUCH_COMPACT",json.dumps(kwargs,sort_keys=True),flush=True)
def site_get(path):
    req=Request("https://"+DOMAIN+"/"+path+("?" if "?" not in path else "&")+"touch_check="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=35) as response:
        if response.status!=200:raise RuntimeError("Unexpected HTTP status")
        return response.read(3000000)
def main():
    src=pathlib.Path("index.html").read_bytes()
    if src.count(CSS_BEGIN)!=1 or src.count(CSS_END)!=1:
        raise RuntimeError("New stylesheet markers not found")
    css=CSS_BEGIN+src.split(CSS_BEGIN,1)[1].split(CSS_END,1)[0]
    if b"100dvh - 22px" not in css or b"overscroll-behavior:contain" not in css:
        raise RuntimeError("Incomplete touch-safety styles")
    live_js=pathlib.Path("auth-profile.js").read_bytes()
    old_js=git_content("f770b4dc13ccdccaec8be3da951947b592bf7ee8^","auth-profile.js")
    if b"disableVerticalSwipes" not in live_js:
        raise RuntimeError("Telegram safety logic not present")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    site=root+"/www/"+DOMAIN
    paths={"index":site+"/index.html","auth":site+"/auth-profile.js","guard":site+"/.htaccess"}
    def read(path):
        buffer=io.BytesIO();ftp.retrbinary("RETR "+path,buffer.write);return buffer.getvalue()
    def write(path,blob):
        ftp.storbinary("STOR "+path,io.BytesIO(blob))
        if hash_bytes(read(path))!=hash_bytes(blob):
            raise RuntimeError("Remote integrity mismatch")
    try:
        before={k:read(v) for k,v in paths.items()}
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in before["guard"]:
            raise RuntimeError("Protected paid content guard absent")
        if hash_bytes(before["auth"])!=hash_bytes(old_js):
            raise RuntimeError("Unexpected live profile JS: no change")
        index=before["index"]
        if CSS_BEGIN in index or index.count(CSS_END)!=1 or index.count(b"auth-profile.js?v=19")!=1 or index.count(OLD_TOPICS)!=1:
            raise RuntimeError("Unknown live homepage version: no change")
        updated=index.replace(OLD_TOPICS,NEW_TOPICS,1).replace(b"auth-profile.js?v=19",b"auth-profile.js?v=20",1)
        updated=updated.replace(CSS_END,css+CSS_END,1)
        parent=root+"/site-safeguard-backups"
        try:ftp.mkd(parent)
        except ftplib.error_perm:ftp.cwd(parent)
        backup=parent+"/cabinet-touch-compact-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        for k in ("index","auth"):write(backup+"/"+k+".bak",before[k])
        attempted=[]
        try:
            for k,blob in (("auth",live_js),("index",updated)):
                attempted.append(k);write(paths[k],blob)
            if hash_bytes(site_get("auth-profile.js"))!=hash_bytes(live_js):
                raise RuntimeError("Published profile script did not match")
            if hash_bytes(site_get(""))!=hash_bytes(updated):
                raise RuntimeError("Published homepage did not match")
            if read(paths["guard"])!=before["guard"]:
                raise RuntimeError("Paid content guard changed")
            notice(success=True,live_verified=True,accidental_close_disabled=True,tariffs_compacted=True,backend_unchanged=True)
        except BaseException:
            for k in reversed(attempted):
                try:write(paths[k],before[k])
                except BaseException:notice(rollback_failed=k)
            notice(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as exc:
        notice(success=False,reason=str(exc)[:160] if isinstance(exc,RuntimeError) else type(exc).__name__)
        sys.exit(1)
