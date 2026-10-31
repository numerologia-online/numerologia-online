"""Guarded HTML-only release for moving club management to My Data."""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
def digest(b):return hashlib.sha256(b).digest()
def report(**k):print("NUMI_SETTINGS_SUBSCRIPTION",json.dumps(k,sort_keys=True),flush=True)
def http_index():
    req=Request("https://"+DOMAIN+"/?subscription_settings="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=35) as r:
        if r.status!=200:raise RuntimeError("Unexpected live homepage status")
        return r.read(2000000)
def main():
    reference=pathlib.Path("index.html").read_bytes()
    old_tile=b'            <button type="button" class="account-tile" data-account-panel="club"><span class="account-tile-icon" aria-hidden="true">\xe2\x99\x95</span><strong>\xd0\x9c\xd0\xbe\xd0\xb9 \xd0\xba\xd0\xbb\xd1\x83\xd0\xb1</strong><small>\xd0\x9f\xd0\xbe\xd0\xb4\xd0\xbf\xd0\xb8\xd1\x81\xd0\xba\xd0\xb0 \xd0\xb8 \xd0\xbf\xd1\x80\xd0\xb5\xd0\xb8\xd0\xbc\xd1\x83\xd1\x89\xd0\xb5\xd1\x81\xd1\x82\xd0\xb2\xd0\xb0</small></button>\n'
    old_settings=b'class="account-tile account-tile--wide" data-account-panel="settings"'
    new_settings=b'class="account-tile" data-account-panel="settings"'
    anchor=b'            <p id="account-birth-note" class="account-muted" role="status" aria-live="polite"></p>\n          </div>'
    end=b'\n        </section>'
    needle=b'          <div class="account-birth-section" id="numi-subscription-settings">'
    if reference.count(needle)!=1 or reference.count(new_settings)!=1:
        raise RuntimeError("Unexpected source version")
    new_block=needle+reference.split(needle,1)[1].split(end,1)[0]
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    site=root+"/www/"+DOMAIN
    paths={"index":site+"/index.html","guard":site+"/.htaccess","auth":site+"/auth-profile.js"}
    def get(path):
        buf=io.BytesIO();ftp.retrbinary("RETR "+path,buf.write);return buf.getvalue()
    def put(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if digest(get(path))!=digest(data):raise RuntimeError("Remote checksum mismatch")
    try:
        original={k:get(p) for k,p in paths.items()}
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in original["guard"]:
            raise RuntimeError("Paid content guard missing")
        if needle in original["index"]:
            if old_tile not in original["index"]:report(success=True,already_present=True);return
            raise RuntimeError("Inconsistent subscription layout")
        if original["index"].count(old_tile)!=1 or original["index"].count(old_settings)!=1 or original["index"].count(anchor)!=1:
            raise RuntimeError("Unknown homepage account structure; no publication")
        newer=original["index"].replace(old_tile,b"",1).replace(old_settings,new_settings,1)
        newer=newer.replace(anchor,anchor+b"\n"+new_block,1)
        folder=root+"/site-safeguard-backups"
        try:ftp.mkd(folder)
        except ftplib.error_perm:ftp.cwd(folder)
        backup=folder+"/subscription-settings-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup);put(backup+"/index.html.bak",original["index"])
        attempted=False
        try:
            attempted=True;put(paths["index"],newer)
            if digest(http_index())!=digest(newer):raise RuntimeError("Live HTTP verification failed")
            if get(paths["guard"])!=original["guard"] or get(paths["auth"])!=original["auth"]:
                raise RuntimeError("Protected files unexpectedly changed")
            report(success=True,published=True,payments_changed=False,account_logic_changed=False)
        except BaseException:
            if attempted:put(paths["index"],original["index"])
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
