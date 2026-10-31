"""Publish compact account prompt and support-tile spacing without touching protected files."""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time
from urllib.request import Request,urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
def h(x):return hashlib.sha256(x).digest()
def old(rev):return subprocess.check_output(["git","show",rev+":account-browser.js"])
def report(**x):print("NUMI_COMPACT_CABINET",json.dumps(x,sort_keys=True),flush=True)
def live(path):
    with urlopen(Request("https://"+DOMAIN+"/"+path+("?" if "?" not in path else "&")+"cabinet_check="+str(time.time_ns()),headers={"Cache-Control":"no-cache"}),timeout=35) as res:
        if res.status!=200:raise RuntimeError("HTTP response unexpected")
        return res.read(2000000)
def main():
    js=pathlib.Path("account-browser.js").read_bytes()
    index=pathlib.Path("index.html").read_bytes()
    first=b'    <style id="numi-compact-cabinet-20261031">'
    last=b'    <!-- Reversible experiment: subtitles on the eight homepage catalog cards only. -->'
    if index.count(first)!=1 or index.count(last)!=1 or index.count(b"account-browser.js?v=12")!=1:
        raise RuntimeError("New source HTML not recognized")
    block=index.split(first,1)[1].split(last,1)[0]
    styling=first+block
    if b"numi-telegram-link-prompt" not in styling or b"account-support-tile" not in styling:
        raise RuntimeError("Targeted CSS missing")
    baselines=[
        (b"account-browser.js?v=7",old("50669740bd062e7e46223c16d6ea4b88568a9dbb")),
        (b"account-browser.js?v=8",old("44bb7d1be1ecfbea6295412724bed0de22befc82")),
        (b"account-browser.js?v=9",old("2c4ef35cdcdce166b08a45c657d3d6a449b488be")),
        (b"account-browser.js?v=10",old("1f6c2dbbbca81446da84771de9fead396440be95")),
        (b"account-browser.js?v=11",old("ae841b38e4c4e067da5755fe9d492ce125c85f9c"))
    ]
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    site=root+"/www/"+DOMAIN
    paths={"index":site+"/index.html","js":site+"/account-browser.js","guard":site+"/.htaccess","auth":site+"/auth-profile.js"}
    def get(p):
        out=io.BytesIO();ftp.retrbinary("RETR "+p,out.write);return out.getvalue()
    def put(p,b):
        ftp.storbinary("STOR "+p,io.BytesIO(b))
        if h(get(p))!=h(b):raise RuntimeError("FTPS write mismatch")
    try:
        original={k:get(v) for k,v in paths.items()}
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in original["guard"]:
            raise RuntimeError("Protected access guard missing")
        possible=[tag for tag,blob in baselines if original["index"].count(tag)==1 and h(original["js"])==h(blob)]
        if len(possible)!=1 or first in original["index"] or b"account-browser.js?v=12" in original["index"]:
            raise RuntimeError("Unexpected live revision, no changes made")
        if original["index"].count(last)!=1:raise RuntimeError("HTML insertion point changed")
        new_index=original["index"].replace(last,styling+last,1).replace(possible[0],b"account-browser.js?v=12",1)
        backroot=root+"/site-safeguard-backups"
        try:ftp.mkd(backroot)
        except ftplib.error_perm:ftp.cwd(backroot)
        backup=backroot+"/compact-cabinet-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        for key in ("js","index"):put(backup+"/"+key+".bak",original[key])
        changed=[]
        try:
            for key,payload in (("js",js),("index",new_index)):
                changed.append(key);put(paths[key],payload)
            if h(live("account-browser.js"))!=h(js) or h(live(""))!=h(new_index):
                raise RuntimeError("Public HTTP verification did not match")
            if get(paths["guard"])!=original["guard"] or get(paths["auth"])!=original["auth"]:
                raise RuntimeError("Protected files unexpectedly changed")
            report(success=True,ui_live=True,protected_files_untouched=True)
        except BaseException:
            for key in reversed(changed):
                try:put(paths[key],original[key])
                except BaseException:report(rollback_failed=key)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        report(success=False,reason=str(e)[:180] if isinstance(e,RuntimeError) else type(e).__name__)
        sys.exit(1)
