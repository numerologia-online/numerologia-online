"""Publish isolated /moment/yes-no catalog with backup, verification and rollback.

Only replaces /moment/index.html after a strict previous-version match, and
creates the four new /moment/yes-no/ files. Never touches site homepage,
accounts, payment, authorization, bot, API, DNS or other paid libraries.
"""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
BASE_COMMIT="9998d918c0127e484d77498be52a0b80fedca103"
ADDED=("index.html","yes-no.css","yes-no.js","questions.json")
def sha(x):return hashlib.sha256(x).hexdigest()
def log(**x):print("NUMI_YES_NO",json.dumps(x,sort_keys=True),flush=True)
def http_get(path):
    uri="https://"+DOMAIN+"/"+path+("?" if "?" not in path else "&")+"yes_no_check="+str(time.time_ns())
    with urlopen(Request(uri,headers={"Cache-Control":"no-cache"}),timeout=40) as response:
        if response.status!=200:raise RuntimeError("Unexpected HTTP status")
        return response.read(2000000)
def validate():
    folder=pathlib.Path("moment/yes-no")
    parts={name:(folder/name).read_bytes() for name in ADDED}
    data=json.loads(parts["questions.json"])
    cats=data["categories"];questions=data["questions"]
    if len(cats)!=7 or len(questions)!=100:raise RuntimeError("Question/category count mismatch")
    if len({q["id"] for q in questions})!=100 or len({q["title"] for q in questions})!=100:
        raise RuntimeError("Question titles or IDs not unique")
    ids={c["id"] for c in cats}
    if len(ids)!=7:raise RuntimeError("Categories duplicated")
    for cat in cats:
        if sum(q["category"]==cat["id"] for q in questions)!=cat["count"]:
            raise RuntimeError("Category question count mismatch")
    if any(q["category"] not in ids for q in questions):raise RuntimeError("Unknown category")
    if b'../moment.css?v=1' not in parts["index.html"] or b'./yes-no.js?v=1' not in parts["index.html"]:
        raise RuntimeError("Page assets invalid")
    moment=pathlib.Path("moment/index.html").read_bytes()
    if moment.count(b'href="./yes-no/"')!=1:raise RuntimeError("Moment navigation missing")
    original=subprocess.check_output(["git","show",BASE_COMMIT+":moment/index.html"])
    if b'href="./yes-no/"' in original:raise RuntimeError("Wrong previous page baseline")
    for tool,args in (("node",["--check",str(folder/"yes-no.js")]),):
        result=subprocess.run([tool]+args,capture_output=True,text=True)
        if result.returncode:raise RuntimeError("JavaScript syntax error: "+result.stderr[:240])
    log(validated=True,questions=100,categories=7)
    return parts,moment,original
def main():
    parts,moment,original=validate()
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/");site=root+"/www/"+DOMAIN
    folder=site+"/moment/yes-no"
    def read(path):
        buf=io.BytesIO()
        try:ftp.retrbinary("RETR "+path,buf.write)
        except ftplib.error_perm as e:
            if str(e).startswith("550"):return None
            raise
        return buf.getvalue()
    def write(path,content):
        ftp.storbinary("STOR "+path,io.BytesIO(content))
        if sha(read(path) or b"")!=sha(content):
            raise RuntimeError("FTP checksum mismatch")
    try:
        live=read(site+"/moment/index.html")
        if live is None:raise RuntimeError("Moment root page missing")
        if live!=original and live!=moment:
            raise RuntimeError("Live moment page changed independently: refuse overwrite")
        try:ftp.mkd(folder)
        except ftplib.error_perm:ftp.cwd(folder)
        destinations={key:folder+"/"+key for key in ADDED}
        before={key:read(path) for key,path in destinations.items()}
        for key,existing in before.items():
            if existing is not None and existing!=parts[key]:
                raise RuntimeError("Existing yes-no file unexpectedly differs: "+key)
        backuproot=root+"/site-safeguard-backups"
        try:ftp.mkd(backuproot)
        except ftplib.error_perm:ftp.cwd(backuproot)
        backup=backuproot+"/moment-yes-no-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        write(backup+"/moment-index.html.bak",live)
        for name,blob in before.items():
            if blob is not None:write(backup+"/"+name+".bak",blob)
        touched=[]
        try:
            for name,dest in destinations.items():
                if before[name] is None:
                    touched.append(dest);write(dest,parts[name])
            if live!=moment:
                touched.append(site+"/moment/index.html")
                write(site+"/moment/index.html",moment)
            for name,blob in parts.items():
                if sha(http_get("moment/yes-no/"+name))!=sha(blob):
                    raise RuntimeError("Public page mismatch: "+name)
            if sha(http_get("moment/index.html"))!=sha(moment):
                raise RuntimeError("Live catalog link mismatch")
            log(success=True,public_verified=True,files=4,existing_other_sections_unchanged=True)
        except BaseException:
            for location in reversed(touched):
                try:
                    old=live if location.endswith("/moment/index.html") else before[location.rsplit("/",1)[-1]]
                    if old is None:ftp.delete(location)
                    else:write(location,old)
                except BaseException as e:log(rollback_failed=location.rsplit("/",1)[-1],error=type(e).__name__)
            log(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        log(success=False,reason=str(e)[:240] if isinstance(e,RuntimeError) else type(e).__name__)
        sys.exit(1)
