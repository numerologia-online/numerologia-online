"""Narrow SEO homepage patch on live REG.RU. No changes to APIs, bot or payments."""
import ftplib, hashlib, io, json, os, pathlib, re, ssl, time, urllib.request, urllib.error

DOMAIN="xn--c1adkkdfjbp1a4l.online"
ROOT=pathlib.Path(__file__).resolve().parents[2]
PAIRS=json.loads("[[\"<title>Нумерология по дате рождения онлайн | Нумерология.online</title>\",\"<title>Нумерология Онлайн — бесплатный личный день | Татьяна</title>\"],[\"<meta name=\\\"description\\\" content=\\\"Нумерология по дате рождения. Личный день, совместимость, матрица судьбы, разбор года и характер мужчины. Бесплатные расчёты и авторские разборы.\\\" />\",\"<meta name=\\\"description\\\" content=\\\"Нумерология Онлайн — авторский сайт нумеролога Татьяны. Бесплатный расчёт личного дня, статьи без регистрации, совместимость, матрица судьбы и разборы.\\\" />\"],[\"<p class=\\\"hero-copy\\\">Без эзотерической чуши и сладкой лжи.</p>\",\"<p class=\\\"hero-copy\\\">Бесплатный расчёт личного дня и статьи без регистрации. Авторские разборы нумеролога Татьяны.</p>\"]]")

def digest(b):return hashlib.sha256(b).hexdigest()

def transform(text):
    for old,new in PAIRS:
        if text.count(old)!=1:
            raise RuntimeError("Live homepage drift: expected exactly one old SEO marker")
        text=text.replace(old,new,1)
    dlg=re.compile(r"<dialog\\b[^>]*>[\\s\\S]*?</dialog>")
    parts=dlg.findall(text)
    if len(parts)!=5 or "<!--noindex-->" in text:
        raise RuntimeError("Live dialog structure changed; refusing patch")
    text=dlg.sub(lambda m:"<!--noindex-->"+m.group(0)+"<!--/noindex-->",text)
    return text

def check_http_redirect():
    class NoFollow(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,req,fp,code,msg,headers,url):return None
    op=urllib.request.build_opener(NoFollow())
    req=urllib.request.Request("http://"+DOMAIN+"/",headers={"User-Agent":"Mozilla/5.0"})
    try:
        with op.open(req,timeout=18) as r:
            print("SEO_HTTP_OLD_URL_STATUS",r.status,"LOCATION",r.headers.get("Location",""),flush=True)
    except urllib.error.HTTPError as e:
        print("SEO_HTTP_OLD_URL_STATUS",e.code,"LOCATION",e.headers.get("Location",""),flush=True)
    except Exception as e:
        print("SEO_HTTP_OLD_URL_CHECK_ERROR",type(e).__name__,flush=True)

def main():
    src=(ROOT/"index.html").read_text("utf-8")
    if not all(src.count(new)==1 for old,new in PAIRS):
        raise RuntimeError("GitHub homepage is not the expected SEO revision")
    if src.count("<!--noindex-->")!=5 or src.count("<!--/noindex-->")!=5:
        raise RuntimeError("GitHub source has unexpected noindex annotations")
    check_http_redirect()
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    ftp.connect("server172.hosting.reg.ru",21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    home=ftp.pwd().rstrip("/")
    live=home+"/www/"+DOMAIN+"/index.html"
    def read(path):
        out=io.BytesIO()
        ftp.retrbinary("RETR "+path,out.write)
        if out.tell()>2000000:raise RuntimeError("Unexpectedly large remote homepage")
        return out.getvalue()
    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if read(path)!=data:raise RuntimeError("FTPS upload readback mismatch")
    try:
        original=read(live)
        if not (50000<len(original)<2000000):raise RuntimeError("Unexpected homepage length")
        text=original.decode("utf-8")
        if all(new in text for old,new in PAIRS) and text.count("<!--noindex-->")==5:
            updated=original;print("SEO_ALREADY_PUBLISHED",flush=True)
        else:
            updated=transform(text).encode("utf-8")
            backup_root=home+"/site-safeguard-backups"
            try:ftp.mkd(backup_root)
            except ftplib.error_perm:ftp.cwd(backup_root)
            backup=backup_root+"/home-seo-"+str(int(time.time()))
            ftp.mkd(backup)
            write(backup+"/index.html",original)
            write(backup+"/manifest.json",json.dumps({"path":"index.html","original_sha256":digest(original),"new_sha256":digest(updated)}).encode())
            print("SEO_HOME_BACKUP_OK",flush=True)
            if read(live)!=original:raise RuntimeError("Concurrent homepage edit; abort")
            try:
                write(live,updated)
                req=urllib.request.Request("https://"+DOMAIN+"/?seo_home_fix="+str(int(time.time())),headers={"Cache-Control":"no-cache","User-Agent":"Mozilla/5.0"})
                with urllib.request.urlopen(req,timeout=28) as r:
                    got=r.read(2000000);status=r.status
                if status!=200 or got!=updated:raise RuntimeError("Live HTTPS page did not match")
                print("SEO_HOME_LIVE_VERIFIED",flush=True)
            except BaseException:
                write(live,original)
                print("SEO_HOME_ROLLED_BACK",flush=True)
                raise
        print("SEO_HOME_RESULT title="+PAIRS[0][1]+" description="+PAIRS[1][1],flush=True)
    finally:
        try:ftp.quit()
        except Exception:ftp.close()

if __name__=="__main__":main()
