"""Safely attach separate account UI after verified MySQL API setup.
This script only adds two new assets and two tags to the live homepage.
All legacy Telegram code, paid-content guard, API and author text are unchanged.
"""
import ftplib,hashlib,io,json,os,pathlib,re,ssl,sys,time
from urllib.request import urlopen,Request
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
ASSETS={"account-browser.js":"application/javascript","account-browser.css":"text/css"}
def log(**d):print("ACCOUNT_UI_RELEASE",json.dumps(d,sort_keys=True),flush=True)
def digest(x):return hashlib.sha256(x).digest()
def https_get(path):
    req=Request("https://"+DOMAIN+"/"+path+"?account_release="+str(int(time.time())),
                headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=30)as r:
        if r.status!=200:raise RuntimeError("HTTP unavailable: "+path)
        return r.read(1800000)
def main():
    js=pathlib.Path("account-browser.js").read_bytes()
    css=pathlib.Path("account-browser.css").read_bytes()
    if b"numi-account.php" not in js:raise RuntimeError("Account UI lacks backend endpoint")
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    f.connect(HOST,21);f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);f.prot_p();f.set_pasv(True)
    try:
        home=f.pwd().rstrip("/")
        site=home+"/www/"+DOMAIN
        def read(path):
            buf=io.BytesIO()
            try:f.retrbinary("RETR "+path,buf.write)
            except ftplib.error_perm as e:
                if str(e).startswith("550"):return None
                raise
            return buf.getvalue()
        def put(path,bytes_):
            f.storbinary("STOR "+path,io.BytesIO(bytes_))
            if digest(read(path)or b"")!=digest(bytes_):raise RuntimeError("Bad remote file check")
        index=read(site+"/index.html")
        auth=read(site+"/auth-profile.js")
        guard=read(site+"/.htaccess")
        if not index or not auth or not guard:raise RuntimeError("Site baseline missing")
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("Paid content guard changed")
        if b"account-browser.js" in index or b"account-browser.css" in index:
            raise RuntimeError("Account script was already added, refusing duplicate")
        for key in (b'id="account-overview"',b'id="account-profile"',b'id="account-browser-note"',b'auth-profile.js'):
            if key not in index:raise RuntimeError("Live cabinet DOM differs from current account UI")
        html=index.decode("utf-8")
        style_match=list(re.finditer(r'<link[^>]+href="auth-profile\.css\?v=[0-9]+"[^>]*>',html))
        script_match=list(re.finditer(r'<script[^>]+src="auth-profile\.js\?v=[0-9]+"[^>]*></script>',html))
        if len(style_match)!=1 or len(script_match)!=1:raise RuntimeError("Auth tags not unique")
        style=style_match[0].group()
        script=script_match[0].group()
        html=html.replace(style,style+'\n    <link rel="stylesheet" href="account-browser.css?v=1" />',1)
        html=html.replace(script,script+'\n  <script src="account-browser.js?v=1" defer></script>',1)
        modified=html.encode("utf-8")
        if modified.count(b"account-browser.js")!=1 or modified.count(b"account-browser.css")!=1:
            raise RuntimeError("Failed to insert a single account UI import")
        for name in ASSETS:
            present=read(site+"/"+name)
            desired=js if name.endswith(".js") else css
            if present is not None and digest(present)!=digest(desired):
                raise RuntimeError("Unexpected existing registration asset: "+name)
        backupdir=home+"/site-safeguard-backups"
        try:f.mkd(backupdir)
        except ftplib.error_perm:f.cwd(backupdir)
        backup=backupdir+"/account-ui-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        f.mkd(backup)
        put(backup+"/index.html",index)
        log(homepage_backup_verified=True,private_location=True)
        deployed=[]
        try:
            for name in ASSETS:
                data=js if name.endswith(".js") else css
                if read(site+"/"+name) is None:
                    deployed.append(name)
                    put(site+"/"+name,data)
            put(site+"/index.html",modified)
            for name in ASSETS:
                expected=js if name.endswith(".js") else css
                if digest(https_get(name))!=digest(expected):
                    raise RuntimeError("HTTP returned outdated/new UI asset "+name)
            if digest(https_get(""))!=digest(modified):
                raise RuntimeError("Live homepage did not update as expected")
            if read(site+"/auth-profile.js")!=auth or read(site+"/.htaccess")!=guard:
                raise RuntimeError("Existing Telegram access or paid source guard changed")
            for page in ("child/","pro/"):
                if not https_get(page):raise RuntimeError("Existing page empty: "+page)
            log(success=True,account_js_live=True,account_css_live=True,
                existing_telegram_login_unchanged=True,author_texts_modified=0,
                paid_guard_unchanged=True,homepage_only_two_new_tags=True)
        except BaseException:
            try:put(site+"/index.html",index)
            except BaseException:log(homepage_rollback_failed=True)
            for name in deployed:
                try:f.delete(site+"/"+name)
                except ftplib.error_perm:log(asset_rollback_failed=name)
            raise
        # Sync the byte-identical live HTML to main only after publishing safely.
        pathlib.Path("index.html").write_bytes(modified)
    finally:
        try:f.quit()
        except BaseException:f.close()
if __name__=="__main__":
    try:main()
    except BaseException as error:
        log(stopped=type(error).__name__,detail=str(error)[:150] if isinstance(error,RuntimeError) else "")
        sys.exit(1)
