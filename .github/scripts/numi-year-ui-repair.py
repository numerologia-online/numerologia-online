"""One-time publish of the three year UI files, with hash checks and rollback."""
import ftplib, hashlib, io, json, os, pathlib, re, ssl, subprocess, sys, time
from urllib.request import Request,urlopen
ROOT="xn--c1adkkdfjbp1a4l.online"
BASE="21705bf123fa96819cbd3ea8c2795e0668fa7c67"
FILES=("year-feature.js","app.js","index.html")
def sha(v):return hashlib.sha256(v).digest()
def log(*x):print("YEAR_FIX",*x,flush=True)
def main():
    pinned={p:subprocess.check_output(["git","show",BASE+":"+p]) for p in FILES}
    changed_year=pathlib.Path("year-feature.js").read_bytes()
    if changed_year==pinned["year-feature.js"]:raise RuntimeError("Year loader patch missing")
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=28)
    try:
        f.connect("server172.hosting.reg.ru",21)
        f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
        f.prot_p()
        home=f.pwd().rstrip("/")
        site=home+"/www/"+ROOT
        def read(path):
            b=io.BytesIO()
            f.retrbinary("RETR "+path,b.write)
            return b.getvalue()
        def put(path,data):
            f.storbinary("STOR "+path,io.BytesIO(data))
            if sha(read(path))!=sha(data):raise RuntimeError("Upload check failed")
        before={p:read(site+"/"+p) for p in FILES}
        if sha(before["year-feature.js"])!=sha(pinned["year-feature.js"]):
            raise RuntimeError("Live year loader differs from pinned original")
        appPattern=rb'import\("\./year-feature\.js\?v=[0-9]+"\)'
        nextApp,appMatches=re.subn(appPattern,b'import("./year-feature.js?v=38")',before["app.js"])
        if appMatches!=1 or nextApp==before["app.js"]:
            raise RuntimeError("Live app has no unique old year-loader import")
        indexPattern=rb'(<script type="module" src="app\.js\?v=)[0-9]+("></script>)'
        nextIndex,indexMatches=re.subn(indexPattern,rb'\g<1>263\g<2>',before["index.html"])
        if indexMatches!=1:
            raise RuntimeError("Live homepage has no unique app version marker")
        if b'auth-profile.js?v=19' not in nextIndex:
            raise RuntimeError("Live Telegram sign-in version changed")
        after={"year-feature.js":changed_year,"app.js":nextApp,"index.html":nextIndex}
        log("LIVE_PATCHED_IN_MEMORY",appMatches,indexMatches,
            "APP_ORIGINAL_DIFFERED_FROM_GITHUB",before["app.js"]!=pinned["app.js"])
        login=sha(read(site+"/auth-profile.js"))
        guard=sha(read(site+"/.htaccess"))
        backup=home+"/site-safeguard-backups/year-ui-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        f.mkd(backup)
        for p in FILES:put(backup+"/"+p,before[p])
        log("BACKUPS_VERIFIED",len(FILES))
        done=[]
        try:
            for p in FILES:
                done.append(p)
                put(site+"/"+p,after[p])
                log("PUBLISHED",p)
            for p in FILES:
                req=Request("https://"+ROOT+"/"+p+"?yfix="+str(int(time.time())),headers={"Cache-Control":"no-cache"})
                with urlopen(req,timeout=25)as resp:
                    if sha(resp.read())!=sha(after[p]):raise RuntimeError("HTTPS content mismatch "+p)
            if sha(read(site+"/auth-profile.js"))!=login or sha(read(site+"/.htaccess"))!=guard:
                raise RuntimeError("Unrelated site file changed")
            pathlib.Path("app.js").write_bytes(after["app.js"])
            pathlib.Path("index.html").write_bytes(after["index.html"])
            log("SUCCESS",len(FILES),"live_customizations_preserved","originals_not_modified")
        except BaseException:
            failed=[]
            for p in reversed(done):
                try:put(site+"/"+p,before[p])
                except BaseException:failed.append(p)
            log("ROLLBACK_FAILED",json.dumps(failed))
            raise
    finally:
        try:f.quit()
        except BaseException:f.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        log("STOP",type(e).__name__,str(e)[:180] if isinstance(e,RuntimeError) else "")
        sys.exit(1)
