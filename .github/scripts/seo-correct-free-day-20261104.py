"""Correct inaccurate free-day claim on live REG.RU home only."""
import ftplib,hashlib,io,json,os,pathlib,ssl,time,urllib.request
DOMAIN="xn--c1adkkdfjbp1a4l.online"
PAIRS=json.loads("[[\"Нумерология Онлайн — бесплатный личный день | Татьяна\",\"Нумерология Онлайн — расчёты по дате рождения | Татьяна\"],[\"Нумерология Онлайн — авторский сайт нумеролога Татьяны. Бесплатный расчёт личного дня, статьи без регистрации, совместимость, матрица судьбы и разборы.\",\"Нумерология Онлайн — авторский проект нумеролога Татьяны. Личный день, совместимость, матрица судьбы, разбор года и статьи о нумерологии без регистрации.\"],[\"Бесплатный расчёт личного дня и статьи без регистрации. Авторские разборы нумеролога Татьяны.\",\"Личный день, совместимость и авторские разборы. Статьи о нумерологии доступны без регистрации.\"]]")
def read(f,p):
    out=io.BytesIO();f.retrbinary("RETR "+p,out.write)
    if len(out.getvalue())>2000000:raise RuntimeError("unexpected live file length")
    return out.getvalue()
def put(f,p,data):
    f.storbinary("STOR "+p,io.BytesIO(data))
    if read(f,p)!=data:raise RuntimeError("FTP readback failed")
def main():
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    f.connect("server172.hosting.reg.ru",21)
    f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);f.prot_p()
    home=f.pwd().rstrip("/")
    target=home+"/www/"+DOMAIN+"/index.html"
    try:
        original=read(f,target)
        text=original.decode("utf-8")
        if not all(text.count(a)==1 for a,b in PAIRS):
            if all(text.count(b)==1 for a,b in PAIRS):
                print("SEO_CORRECTED_ALREADY_LIVE",flush=True);return
            raise RuntimeError("Live homepage differs from published SEO text; no writes")
        updated=text
        for a,b in PAIRS:updated=updated.replace(a,b,1)
        new=updated.encode("utf-8")
        expected=pathlib.Path("index.html").read_bytes()
        if expected!=new:raise RuntimeError("Live result would differ from reviewed GitHub index.html")
        if text.count("<!--noindex-->")!=5 or updated.count("<!--noindex-->")!=5:raise RuntimeError("Modal noindex protection mismatch")
        root=home+"/site-safeguard-backups"
        try:f.mkd(root)
        except ftplib.error_perm:f.cwd(root)
        backup=root+"/seo-correction-"+str(int(time.time()))
        f.mkd(backup)
        put(f,backup+"/index.html",original)
        print("SEO_CORRECTION_BACKUP_OK",flush=True)
        if read(f,target)!=original:raise RuntimeError("Concurrent homepage edit")
        try:
            put(f,target,new)
            req=urllib.request.Request("https://"+DOMAIN+"/?seo_correct="+str(int(time.time())),headers={"Cache-Control":"no-cache","User-Agent":"Mozilla/5.0"})
            with urllib.request.urlopen(req,timeout=28) as r:
                response=r.read(2000000)
                if r.status!=200 or response!=new:raise RuntimeError("Live HTTP not matching corrected homepage")
            print("SEO_CORRECTION_HTTP_VERIFIED",flush=True)
        except BaseException:
            put(f,target,original)
            print("SEO_CORRECTION_ROLLED_BACK",flush=True)
            raise
    finally:
        try:f.quit()
        except Exception:f.close()
if __name__=="__main__":main()
