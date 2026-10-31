"""Safe, reversible CSS bundling release on REG.RU: no backend, accounts, or paid files."""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import ssl
import sys
import time
from urllib.request import Request, urlopen

DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
NAMES=[
"styles.css?v=214","year-paywall.css?v=2","day-share.css?v=2",
"theme.css","artwork.css?v=6","hero-polish.css?v=5",
"site-support.css?v=3","pro-home.css?v=3","install.css?v=3",
"auth-profile.css?v=11","account-browser.css?v=1"
]
OLD=b"\n".join(('    <link rel="stylesheet" href="'+x+'" />').encode() for x in NAMES)
NEW=b'    <link rel="stylesheet" href="assets/numi-startup-20261031.css?v=1" />'
def digest(value):return hashlib.sha256(value).digest()
def report(**x):print("NUMI_STARTUP_CSS",json.dumps(x,sort_keys=True),flush=True)
def http_get(path):
    req=Request("https://"+DOMAIN+"/"+path+("&" if "?" in path else "?")+"verify_css="+str(time.time_ns()),
                headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=35) as r:
        if r.status!=200:raise RuntimeError("Live HTTP status unexpected")
        return r.read(2000000)
def main():
    bundle=pathlib.Path("assets/numi-startup-20261031.css").read_bytes()
    if any(("Bundled source: "+name.split("?")[0]).encode() not in bundle for name in NAMES):
        raise RuntimeError("Incomplete stylesheet bundle")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    site=home+"/www/"+DOMAIN
    paths={"index":site+"/index.html","bundle":site+"/assets/numi-startup-20261031.css",
           "guard":site+"/.htaccess","auth":site+"/auth-profile.js"}
    def read(path):
        out=io.BytesIO();ftp.retrbinary("RETR "+path,out.write);return out.getvalue()
    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if digest(read(path))!=digest(data):raise RuntimeError("Remote write checksum mismatch")
    try:
        original_index=read(paths["index"])
        guard=read(paths["guard"])
        auth=read(paths["auth"])
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("Paid-content access guard missing; no deployment")
        if original_index.count(OLD)!=1 or NEW in original_index:
            raise RuntimeError("Live CSS links differ from baseline; no deployment")
        new_index=original_index.replace(OLD,NEW,1)
        try:
            prior_bundle=read(paths["bundle"])
            raise RuntimeError("Bundle already exists; do not overwrite")
        except ftplib.error_perm as error:
            if not str(error).startswith("550"):
                raise
        backup_root=home+"/site-safeguard-backups"
        try:ftp.mkd(backup_root)
        except ftplib.error_perm:ftp.cwd(backup_root)
        backup=backup_root+"/startup-css-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        write(backup+"/index.html.bak",original_index)
        report(backup_saved=True,original_index_sha256=hashlib.sha256(original_index).hexdigest())
        bundle_uploaded=False
        index_modified=False
        try:
            write(paths["bundle"],bundle)
            bundle_uploaded=True
            write(paths["index"],new_index)
            index_modified=True
            if digest(http_get("assets/numi-startup-20261031.css"))!=digest(bundle):
                raise RuntimeError("Live stylesheet does not match source")
            if digest(http_get(""))!=digest(new_index):
                raise RuntimeError("Live homepage does not match planned change")
            if read(paths["guard"])!=guard or read(paths["auth"])!=auth:
                raise RuntimeError("Protected site state changed during deployment")
            report(success=True,css_requests_before=11,css_requests_after=1,
                   paid_content_changed=False,accounts_changed=False)
        except BaseException:
            if index_modified:
                write(paths["index"],original_index)
            if bundle_uploaded:
                ftp.delete(paths["bundle"])
            report(rollback_complete=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as exc:
        report(success=False,reason=str(exc)[:180] if isinstance(exc,RuntimeError) else type(exc).__name__)
        sys.exit(1)
