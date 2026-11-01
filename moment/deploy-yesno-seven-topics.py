"""Safely deploy only /moment/yes-no layout, catalog and scripts on REG.RU."""
import ftplib,hashlib,io,json,os,pathlib,re,ssl,subprocess,sys,time
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
FILES=("index.html","yes-no.css","yes-no.js","questions.json")
PREVIOUS={
"index.html":"f30f77525a25ef07418dc20a86be3b3814cbdf3a",
"yes-no.css":"95e70b4e7fd53a29cbf65a9aae6cd563fae8c798",
"yes-no.js":"8caf06e47dcaee653a2eacb4717aa5f8e0d638f1",
"questions.json":"7a85fa73f0107381abfc9e8f75084554d4558832"}
def sha(x):return hashlib.sha256(x).hexdigest()
def log(**d):print("NUMI_YESNO_DIRECTORY "+json.dumps(d,ensure_ascii=False,sort_keys=True),flush=True)
def replace_page(live,old,new):
    if live==new:return live
    a=b'    <section class="hero">'
    b=b'  </main>'
    if live.count(a)!=1 or live.count(b)!=1:raise RuntimeError("Live page structure differs")
    if old.count(a)!=1 or old.count(b)!=1:raise RuntimeError("Old page structure differs")
    oldsection=old[old.index(a):old.index(b)]
    if live.count(oldsection)!=1:raise RuntimeError("Live original hero/category markup differs")
    newsection=new[new.index(b'    <section class="yn-directory'):new.index(b)]
    updated=live.replace(oldsection,newsection,1)
    for before,after in ((b'./yes-no.css?v=1',b'./yes-no.css?v=2'),(b'./yes-no.js?v=1',b'./yes-no.js?v=2')):
        if updated.count(before)!=1:raise RuntimeError("Asset link changed independently")
        updated=updated.replace(before,after,1)
    return updated
def get_public(name):
    url="https://"+DOMAIN+"/moment/yes-no/"+name+"?yesno_directory_check="+str(time.time_ns())
    req=Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache"})
    with urlopen(req,timeout=50) as response:
        if response.status!=200:raise RuntimeError("Unexpected public status "+name)
        return response.read(3000000)
def main():
    root=pathlib.Path("moment/yes-no")
    new={name:(root/name).read_bytes() for name in FILES}
    old={name:subprocess.check_output(["git","show",blob]) for name,blob in PREVIOUS.items()}
    d=json.loads(new["questions.json"].decode("utf-8"))
    assert len(d["categories"])==7 and len(d["questions"])==100
    assert len({q["title"] for q in d["questions"]})==100
    assert len({q["id"] for q in d["questions"]})==100
    assert all(sum(q["category"]==c["id"] for q in d["questions"])==c["count"] for c in d["categories"])
    assert b'yn-category-list' in new["index.html"] and b'yn-topic' in new["yes-no.css"]
    assert b'./questions.json?v=2' in new["yes-no.js"]
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=50)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    path=home+"/www/"+DOMAIN+"/moment/yes-no"
    def read(p):
        b=io.BytesIO();ftp.retrbinary("RETR "+p,b.write);return b.getvalue()
    def write(p,b):
        ftp.storbinary("STOR "+p,io.BytesIO(b))
        if read(p)!=b:raise RuntimeError("FTPS checksum mismatch")
    try:
        before={name:read(path+"/"+name) for name in FILES}
        target={}
        for name in FILES:
            if name=="index.html":target[name]=replace_page(before[name],old[name],new[name])
            elif before[name] in (old[name],new[name]):target[name]=new[name]
            else:raise RuntimeError("Production "+name+" differs from verified baseline; STOP")
        backuproot=home+"/site-safeguard-backups"
        try:ftp.mkd(backuproot)
        except ftplib.error_perm:ftp.cwd(backuproot)
        bak=backuproot+"/yesno-seven-topics-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(bak)
        for name in FILES:write(bak+"/"+name+".bak",before[name])
        changed=[]
        try:
            # Upload dependencies before HTML; HTML last activates only complete release.
            for name in ("yes-no.css","yes-no.js","questions.json","index.html"):
                if before[name]!=target[name]:
                    write(path+"/"+name,target[name]);changed.append(name)
            for name in FILES:
                actual=get_public(name)
                if sha(actual)!=sha(target[name]):
                    raise RuntimeError("Public checksum differs: "+name)
            log(success=True,public_verified=True,files=changed,backup=bak.rsplit("/",1)[-1],categories=7,questions=100,other_sections_unchanged=True)
        except BaseException:
            for name in reversed(changed):
                try:write(path+"/"+name,before[name])
                except BaseException as exc:log(rollback_failed=name,reason=type(exc).__name__)
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
