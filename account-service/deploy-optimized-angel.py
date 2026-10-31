"""Replace only the Saved empty-state SVG with a lazily loaded 3.4KB WebP.

Publishes one new asset and one narrowly patched HTML section, with an HTML
backup and rollback on failure. Does not touch APIs, payments, DB or bot.
"""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time
from urllib.request import Request,urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
OLD_TAG=b'<svg class="numi-angel"'
SVG_END=b'</svg>'
NEW_TAG=b'<img class="numi-angel" src="assets/numi-angel-soft-20261031.webp"'
CSS_OLD=b'#account-dialog .numi-angel {display:block;width:min(100%,155px);height:auto;margin:0 auto 2px}'
CSS_NEW=b'#account-dialog .numi-angel {display:block;width:min(100%,190px);height:auto;margin:0 auto 2px;object-fit:contain}'
def digest(blob):return hashlib.sha256(blob).digest()
def report(**details):print("NUMI_OPTIMIZED_ANGEL",json.dumps(details,sort_keys=True),flush=True)
def public(path):
    req=Request("https://"+DOMAIN+"/"+path+("?" if "?" not in path else "&")+"angel_asset="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=40) as resp:
        if resp.status!=200:raise RuntimeError("Unexpected public HTTP status")
        return resp.read(3000000)
def main():
    source=pathlib.Path("index.html").read_bytes()
    asset=pathlib.Path("assets/numi-angel-soft-20261031.webp").read_bytes()
    if len(asset)>18000 or len(asset)<500 or not asset.startswith(b'RIFF') or asset[8:12]!=b'WEBP':
        raise RuntimeError("Invalid or unexpectedly heavy WebP")
    if source.count(NEW_TAG)!=1 or source.count(CSS_NEW)!=1:
        raise RuntimeError("New Saved illustration missing from source")
    img=NEW_TAG+source.split(NEW_TAG,1)[1].split(b'>',1)[0]+b'>'
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    site=root+"/www/"+DOMAIN
    paths={"index":site+"/index.html","image":site+"/assets/numi-angel-soft-20261031.webp","guard":site+"/.htaccess"}
    def read(p):
        out=io.BytesIO();ftp.retrbinary("RETR "+p,out.write);return out.getvalue()
    def maybe_read(p):
        try:return read(p)
        except ftplib.error_perm as error:
            if str(error).startswith("550"):return None
            raise
    def write(p,b):
        ftp.storbinary("STOR "+p,io.BytesIO(b))
        if digest(read(p))!=digest(b):raise RuntimeError("Remote checksum mismatch")
    try:
        before=read(paths["index"])
        guard=read(paths["guard"])
        old_asset=maybe_read(paths["image"])
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("Protected paid access baseline absent")
        if old_asset is not None and digest(old_asset)!=digest(asset):
            raise RuntimeError("Different image asset exists; refusing overwrite")
        if NEW_TAG in before:
            if img in before and CSS_NEW in before and old_asset is not None and digest(old_asset)==digest(asset):
                report(success=True,already_published=True)
                return
            raise RuntimeError("Partial/conflicting image deployment")
        if before.count(OLD_TAG)!=1 or before.count(SVG_END)<1 or before.count(CSS_OLD)!=1:
            raise RuntimeError("Unexpected live Saved illustration baseline")
        svg=OLD_TAG+before.split(OLD_TAG,1)[1].split(SVG_END,1)[0]+SVG_END
        if b'numi-angel' not in svg or not (b'viewBox="0 0 320 300"' in svg or b'viewBox="0 0 320 285"' in svg):
            raise RuntimeError("Unrecognized previous SVG")
        updated=before.replace(svg,img,1).replace(CSS_OLD,CSS_NEW,1)
        backup_parent=root+"/site-safeguard-backups"
        try:ftp.mkd(backup_parent)
        except ftplib.error_perm:ftp.cwd(backup_parent)
        backup=backup_parent+"/optimized-angel-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        write(backup+"/index.html.bak",before)
        touched=[]
        try:
            if old_asset is None:
                touched.append("image")
                write(paths["image"],asset)
            if digest(public("assets/numi-angel-soft-20261031.webp"))!=digest(asset):
                raise RuntimeError("Public image verification failed")
            touched.append("index")
            write(paths["index"],updated)
            if digest(public(""))!=digest(updated):
                raise RuntimeError("Public HTML verification failed")
            if read(paths["guard"])!=guard:raise RuntimeError("Access guard changed")
            report(success=True,live_verified=True,image_bytes=len(asset),homepage_asset_lazy=True,only_illustration_changed=True)
        except BaseException:
            if "index" in touched:
                try:write(paths["index"],before)
                except BaseException:report(rollback_failed="index")
            if "image" in touched:
                try:ftp.delete(paths["image"])
                except BaseException:report(rollback_failed="image")
            report(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as exc:
        report(success=False,reason=str(exc)[:170] if isinstance(exc,RuntimeError) else type(exc).__name__)
        sys.exit(1)
