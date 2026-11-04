"""Guarded, atomic-in-purpose yes/no daily access publication.
Never touches Telegram, daily mailing, payment tables, or answer JSON.
If live files have changed independently, stop without publishing.
"""
import ftplib, hashlib, io, json, os, pathlib, ssl, subprocess, time, urllib.error, urllib.request

BASE=pathlib.Path(__file__).resolve().parents[2]
SITE="https://xn--c1adkkdfjbp1a4l.online"
BASELINE="913bd878d9bff059ab9751c4478b12fc6484fdc6"
TARGETS={
  "api/numi-yesno-answer.php":"yesno-service/public/numi-yesno-answer.php",
  "moment/yes-no/yes-no.js":"moment/yes-no/yes-no.js",
  "moment/yes-no/index.html":"moment/yes-no/index.html",
}

def old_source(path):
    return subprocess.run(["git","show",BASELINE+":"+path],cwd=BASE,check=True,
                          capture_output=True).stdout

def http(path, data=None, method=None):
    h={"Cache-Control":"no-cache","User-Agent":"numi-daily-free-release"}
    if data is not None:
        h["Content-Type"]="application/json"
        h["Origin"]=SITE
    req=urllib.request.Request(SITE+path,data=json.dumps(data).encode() if data is not None else None,
                               headers=h,method=method)
    try:
        with urllib.request.urlopen(req,timeout=25) as r:
            return r.status,json.loads(r.read(30000))
    except urllib.error.HTTPError as exc:
        return exc.code,json.loads(exc.read(30000))

def run():
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect("server172.hosting.reg.ru",21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    base=ftp.pwd().rstrip("/")+"/www/xn--c1adkkdfjbp1a4l.online/"
    def get(p):
        buf=io.BytesIO()
        ftp.retrbinary("RETR "+base+p,buf.write)
        return buf.getvalue()
    def write(p,b):
        ftp.storbinary("STOR "+p,io.BytesIO(b))
        result=io.BytesIO()
        ftp.retrbinary("RETR "+p,result.write)
        if result.getvalue()!=b:raise RuntimeError("FTP readback mismatch")
    try:
        # Strict preflight: all three production targets must match the previous
        # approved repo revision. No replacing drifted files with older code.
        fresh={p:(BASE/local).read_bytes() for p,local in TARGETS.items()}
        before={p:get(p) for p in TARGETS}
        for p,local in TARGETS.items():
            if before[p] not in (old_source(local),fresh[p]):
                raise RuntimeError("Production drift detected: "+p)
        if all(before[p]==fresh[p] for p in TARGETS):
            print("YESNO_DAILY_FREE_ALREADY_CURRENT",flush=True)
            return
        home=base.split("/www/",1)[0]
        backup=home+"/site-safeguard-backups/yesno-daily-free-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+os.environ.get("GITHUB_RUN_ID","local")
        ftp.mkd(backup)
        for i,p in enumerate(TARGETS):
            write(backup+"/"+str(i)+".bak",before[p])
        touched=[]
        try:
            # Publish the gate before the new UI and activate last via HTML.
            for p in TARGETS:
                if before[p]!=fresh[p]:
                    touched.append(p)
                    write(base+p,fresh[p])
            for p in TARGETS:
                if get(p)!=fresh[p]:raise RuntimeError("Production readback mismatch: "+p)
            code,status=http("/api/numi-yesno-answer.php?status=1")
            if code!=200 or status.get("authenticated") is not False or status.get("remaining")!=0:
                raise RuntimeError("Anonymous status check failed")
            code,answer=http("/api/numi-yesno-answer.php",{"question":"yn-man-001","time":"12:34"},method="POST")
            if code!=401 or answer.get("error")!="LOGIN_REQUIRED":
                raise RuntimeError("Anonymous paid-answer protection failed")
            code,_=http("/api/numi-yesno-answer.php?question=yn-man-001&time=12:34")
            if code!=405:raise RuntimeError("Legacy GET answer still available")
            print("YESNO_DAILY_FREE_RELEASE "+json.dumps({
                "success":True,"files":list(TARGETS),"anonymous_protection":True,
                "old_get_blocked":True,"backup":backup.rsplit("/",1)[-1]
            }),flush=True)
        except BaseException:
            for p in reversed(touched):
                write(base+p,before[p])
            raise
    finally:
        try:ftp.quit()
        except Exception:ftp.close()

if __name__=="__main__":
    run()
