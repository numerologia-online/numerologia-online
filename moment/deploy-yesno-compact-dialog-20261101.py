"""Safely publish compact Yes/No dialog CSS + cache-busted HTML only to REG.RU."""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time
from urllib.request import Request,urlopen

HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
FOLDER="moment/yes-no"
BASELINE={"index.html":"6feb43ef1b0e0b5d2513f621c47210af57cbf6ae",
          "yes-no.css":"54c45c16d054ee938ba71e3ff79b3db04c40c0ca"}
FILES=("yes-no.css","index.html")

def sha(x):return hashlib.sha256(x).hexdigest()
def log(**kw):print("YESNO_COMPACT_DIALOG "+json.dumps(kw,ensure_ascii=False,sort_keys=True),flush=True)
def git_blob(blob):return subprocess.check_output(["git","show",blob])
def public(name):
    url="https://"+DOMAIN+"/"+FOLDER+"/"+name+"?dialog_compact="+str(time.time_ns())
    req=Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache","User-Agent":"numi-yesno-compact-dialog/1.0"})
    with urlopen(req,timeout=40) as response:
        if response.status!=200:raise RuntimeError("Unexpected HTTP response: "+name)
        return response.read(1000000)

def main():
    old={name:git_blob(blob) for name,blob in BASELINE.items()}
    new={name:pathlib.Path(FOLDER,name).read_bytes() for name in FILES}
    oldhtml=old["index.html"].decode("utf-8")
    updatedhtml=new["index.html"].decode("utf-8")
    original='href="./yes-no.css?v=9"'
    revised='href="./yes-no.css?v=10"'
    if oldhtml.count(original)!=1 or updatedhtml!=oldhtml.replace(original,revised,1):
        raise RuntimeError("Unrelated HTML changes detected")
    if not new["yes-no.css"].startswith(old["yes-no.css"]):
        raise RuntimeError("Existing Yes/No styling was modified")
    added=new["yes-no.css"][len(old["yes-no.css"]):]
    if (b"/* Compact time dialog only:" not in added or
        b"#yn-dialog .dialog-content{padding:19px 22px 24px}" not in added or
        b"#yn-dialog .yn-time-form{padding:13px 14px" not in added or
        new["yes-no.css"].count(b"{")!=new["yes-no.css"].count(b"}")):
        raise RuntimeError("Compact dialog CSS verification failed")
    data=json.loads(pathlib.Path(FOLDER,"questions.json").read_text("utf-8"))
    if len(data["questions"])!=100 or len(data["categories"])!=7:raise RuntimeError("Catalog integrity")
    log(preflight=True,question_count=100,only_dialog_styling=True)

    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    base=home+"/www/"+DOMAIN+"/"+FOLDER
    backups=home+"/site-safeguard-backups"
    archive=backups+"/yesno-compact-dialog-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
    def read(path):
        buffer=io.BytesIO();ftp.retrbinary("RETR "+path,buffer.write);return buffer.getvalue()
    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if sha(read(path))!=sha(data):raise RuntimeError("FTPS readback mismatch")
    changed=[]
    try:
        before={name:read(base+"/"+name) for name in FILES}
        for name in FILES:
            if before[name] not in (old[name],new[name]):
                raise RuntimeError("Live "+name+" has independent edits; refused overwrite")
        try:ftp.mkd(backups)
        except ftplib.error_perm:pass
        ftp.mkd(archive)
        for name in FILES:write(archive+"/"+name+".bak",before[name])
        log(backup_done=True,other_files_untouched=True)
        try:
            for name in FILES:
                if before[name]!=new[name]:
                    changed.append(name)
                    write(base+"/"+name,new[name])
            for name in FILES:
                if sha(public(name))!=sha(new[name]):raise RuntimeError("Live HTTP checksum mismatch "+name)
            log(success=True,live_verified=True,css_only=True,question_catalog_unchanged=True,changed=changed)
        except BaseException:
            for name in reversed(changed):
                try:write(base+"/"+name,before[name])
                except BaseException as e:log(rollback_failed=name,error=type(e).__name__)
            log(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:main()
    except BaseException as error:
        log(success=False,reason=str(error)[:200]);sys.exit(1)
