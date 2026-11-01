"""Safely publish per-question time input in the 100 Yes/No questions on REG.RU.

Changes limited to moment/yes-no/index.html, yes-no.js and yes-no.css.
Backs up exact live files, checks deployed checksums and rolls back on errors.
"""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time
from urllib.request import Request,urlopen

SERVER="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
ROOT="moment/yes-no"
OLD_BLOBS={
    "index.html":"9eaddd08d3641eb7a93a50c60e64c6df119645f1",
    "yes-no.css":"cd2781ef472c91bef3d9ee689901abf8160b9843",
    "yes-no.js":"021837235d1942d033e1b6f9addc7f53f0363669"
}
FILES=("yes-no.css","yes-no.js","index.html")

def digest(blob):return hashlib.sha256(blob).hexdigest()
def git_blob(sha):return subprocess.check_output(["git","show",sha])
def log(**data):print("YESNO_TIME_UI "+json.dumps(data,ensure_ascii=False,sort_keys=True),flush=True)
def public(name):
    url="https://"+DOMAIN+"/"+ROOT+"/"+name+"?yesno_time_check="+str(time.time_ns())
    req=Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache","User-Agent":"numi-yesno-time-release/1.0"})
    with urlopen(req,timeout=35) as resp:
        if resp.status!=200:raise RuntimeError("Public site unavailable: "+name)
        return resp.read(1_000_000)

def verify_source(old,new):
    h=new["index.html"].decode("utf-8")
    j=new["yes-no.js"].decode("utf-8")
    c=new["yes-no.css"].decode("utf-8")
    oldh=old["index.html"].decode("utf-8")
    if (oldh.count("./yes-no.css?v=8")!=1 or oldh.count("./yes-no.js?v=3")!=1
        or h.count("./yes-no.css?v=9")!=1 or h.count("./yes-no.js?v=4")!=1):
        raise RuntimeError("Missing versioned asset references")
    if (not oldh.count('id="yn-dialog"')==h.count('id="yn-dialog"')==1
        or h.count('id="yn-time-input"')!=1
        or h.count('id="yn-now"')!=1
        or h.count('id="yn-confirm-time"')!=1
        or 'type="text" inputmode="numeric"' not in h
        or h.count('id="yn-time-result"')!=1
        or 'выдерживайте хотя бы сутки' not in h):
        raise RuntimeError("Expected time UI or repeat disclaimer missing")
    if ('timeForm.addEventListener("submit"' not in j
        or '$("yn-now").addEventListener("click"' not in j
        or 'validTime' not in j or 'cache:"default"' not in j
        or 'dialog.showModal()' not in j):
        raise RuntimeError("Required no-calendar time controller missing")
    if '#yn-dialog .yn-time-form' not in c or c.count("{")!=c.count("}"):
        raise RuntimeError("New time styles missing or malformed")
    # Release is not allowed to alter the question catalog.
    data=json.loads(pathlib.Path(ROOT,"questions.json").read_text(encoding="utf-8"))
    if (len(data.get("categories",[]))!=7 or len(data.get("questions",[]))!=100
        or len({q["id"] for q in data["questions"]})!=100
        or len({q["title"] for q in data["questions"]})!=100):
        raise RuntimeError("The original 100-question catalog changed")
    log(preflight_ok=True,questions=100,sections=7,read_only_catalog=True)

def main():
    folder=pathlib.Path(ROOT)
    old={name:git_blob(sha) for name,sha in OLD_BLOBS.items()}
    new={name:(folder/name).read_bytes() for name in FILES}
    verify_source(old,new)
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(SERVER,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    site=home+"/www/"+DOMAIN+"/"+ROOT
    backupdir=home+"/site-safeguard-backups"
    archive=backupdir+"/yesno-time-ui-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
    def read(remote):
        buff=io.BytesIO()
        ftp.retrbinary("RETR "+remote,buff.write)
        return buff.getvalue()
    def write(remote,data):
        ftp.storbinary("STOR "+remote,io.BytesIO(data))
        if digest(read(remote))!=digest(data):raise RuntimeError("FTPS readback mismatch for "+remote)
    changed=[]
    try:
        originals={name:read(site+"/"+name) for name in FILES}
        for name in FILES:
            if originals[name] not in (old[name],new[name]):
                raise RuntimeError("Live "+name+" has independent changes: refused to overwrite")
        try:ftp.mkd(backupdir)
        except ftplib.error_perm:pass
        ftp.mkd(archive)
        for name in FILES:write(archive+"/"+name+".bak",originals[name])
        log(backup_ready=True,scope=list(FILES),other_pages_untouched=True)
        try:
            for name in FILES:
                if originals[name]!=new[name]:
                    # Add to rollback list before writing, even if upload/readback fails.
                    changed.append(name)
                    write(site+"/"+name,new[name])
            for name in FILES:
                if digest(public(name))!=digest(new[name]):
                    raise RuntimeError("Public HTTPS checksum mismatch: "+name)
            log(success=True,live_verified=True,question_count=100,
                manual_time=True,now_button=True,day_warning=True,
                payments_untouched=True,changed=changed)
        except BaseException:
            for name in reversed(changed):
                try:write(site+"/"+name,originals[name])
                except BaseException as ex:log(rollback_failed=name,error=type(ex).__name__)
            log(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as ex:
        log(success=False,error=str(ex)[:230]);sys.exit(1)
