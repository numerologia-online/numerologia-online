"""Guarded HTML-only publication of detailed subscription tariff comparison."""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
START=b'        <section class="account-panel" data-account-content="prices" hidden>'
END=b'        <section class="account-panel" data-account-content="learning" hidden>'
CSS_START=b'    <style id="numi-account-tariffs-20261031">'
CSS_END=b'    <!-- Reversible experiment: subtitles on the eight homepage catalog cards only. -->'
def digest(data):return hashlib.sha256(data).digest()
def report(**kw):print("NUMI_TARIFFS",json.dumps(kw,sort_keys=True),flush=True)
def http_index():
    request=Request("https://"+DOMAIN+"/?tariff_release="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(request,timeout=35) as response:
        if response.status!=200:raise RuntimeError("Unexpected HTTP response")
        return response.read(2000000)
def main():
    src=pathlib.Path("index.html").read_bytes()
    if any(src.count(k)!=1 for k in (START,END,CSS_START,CSS_END)):
        raise RuntimeError("Local tariff markers absent or duplicated")
    replacement=src.split(START,1)[1].split(END,1)[0]
    section=START+replacement
    css=CSS_START+src.split(CSS_START,1)[1].split(CSS_END,1)[0]
    if '19–49 ₽'.encode() not in section or '490 ₽ / мес.'.encode() not in section:
        raise RuntimeError("Tariff source missing essential price labels")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    site=root+"/www/"+DOMAIN
    targets={"index":site+"/index.html","guard":site+"/.htaccess","auth":site+"/auth-profile.js"}
    def get(path):
        buf=io.BytesIO();ftp.retrbinary("RETR "+path,buf.write);return buf.getvalue()
    def put(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if digest(get(path))!=digest(data):raise RuntimeError("File checksum mismatch")
    try:
        original={name:get(path) for name,path in targets.items()}
        index=original["index"]
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in original["guard"]:
            raise RuntimeError("Protected paid-content guard missing")
        if index.count(START)!=1 or index.count(END)!=1 or index.count(CSS_END)!=1:
            raise RuntimeError("Live account layout differs; refuse")
        if CSS_START in index:
            if section in index and css in index:report(success=True,already_present=True);return
            raise RuntimeError("Different tariff patch exists; refuse")
        old_section=START+index.split(START,1)[1].split(END,1)[0]
        if b'id="account-show-offer"' not in old_section or b'class="account-price-options"' not in old_section:
            raise RuntimeError("Unrecognized current tariff section")
        updated=index.replace(old_section,section,1).replace(CSS_END,css+CSS_END,1)
        backup_root=root+"/site-safeguard-backups"
        try:ftp.mkd(backup_root)
        except ftplib.error_perm:ftp.cwd(backup_root)
        backup=backup_root+"/tariff-comparison-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        put(backup+"/index.html.bak",index)
        attempted=False
        try:
            attempted=True;put(targets["index"],updated)
            if digest(http_index())!=digest(updated):raise RuntimeError("Live homepage verification failed")
            if get(targets["guard"])!=original["guard"] or get(targets["auth"])!=original["auth"]:
                raise RuntimeError("Protected files changed")
            report(success=True,tariffs_published=True,backend_unchanged=True)
        except BaseException:
            if attempted:put(targets["index"],index)
            report(rollback_completed=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        report(success=False,reason=str(e)[:160] if isinstance(e,RuntimeError) else type(e).__name__)
        sys.exit(1)
