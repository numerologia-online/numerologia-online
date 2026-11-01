"""Guarded Moment navigation release: 12 stacked beige topic rows and questions on selection."""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time
from urllib.request import Request,urlopen

HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
OLD_BLOBS={
  "index.html":"215321f14ddcc2f80b4d8b25415b36adf598888c",
  "moment.css":"0de7fd202f07853b7e2fa394eb49bfe22a88456d",
  "moment.js":"aba353e95b075f1a3392a07a797f9fa97e75d5a5"}
FILES=("moment.css","moment.js","index.html")

def sha(data):return hashlib.sha256(data).hexdigest()
def log(**data):print("MOMENT_COMPACT_LIST "+json.dumps(data,ensure_ascii=False,sort_keys=True),flush=True)
def git_blob(blob):return subprocess.check_output(["git","show",blob])
def public(name):
    url="https://"+DOMAIN+"/moment/"+name+"?topic_list_release="+str(time.time_ns())
    req=Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache","User-Agent":"numi-moment-topic-release/1.0"})
    with urlopen(req,timeout=40) as response:
        if response.status!=200:raise RuntimeError("Unexpected public HTTP response for "+name)
        return response.read(1000000)

def validate(new):
    html=new["index.html"]
    css=new["moment.css"]
    js=new["moment.js"]
    if (html.count(b'moment.css?v=3')!=1 or html.count(b'moment.js?v=2')!=1
        or html.count(b'id="questions-panel" class="questions-panel" hidden')!=1
        or html.count(b'id="show-all"')!=1
        or html.count(b'href="./yes-no/"')!=1
        or html.count(b'class="moment-back-button"')!=1):
        raise RuntimeError("Unexpected HTML references or navigation")
    if (b'.explore .category-grid{display:grid;grid-template-columns:minmax(0,1fr)' not in css
        or b'.explore .category{display:grid;grid-template-columns:37px minmax(0,1fr) 24px' not in css
        or css.count(b'{')!=css.count(b'}')):
        raise RuntimeError("One-column CSS list missing or invalid")
    if (b'catalog.categories.forEach(cat=>' not in js
        or b'title:"' + 'Все темы'.encode("utf-8") + b'"' in js
        or b'$("questions-panel").hidden=false' not in js
        or b'$("questions-panel").hidden=true' not in js):
        raise RuntimeError("Question-list JS navigation invalid")
    data=json.loads(pathlib.Path("moment/questions.json").read_text("utf-8"))
    if(len(data["categories"])!=12 or len(data["questions"])!=300 or
       len({q["id"] for q in data["questions"]})!=300):
        raise RuntimeError("300-question catalog integrity failed")
    log(validation=True,topics=12,questions=300,yesno_preserved=True)

def main():
    old={name:git_blob(blob) for name,blob in OLD_BLOBS.items()}
    new={name:pathlib.Path("moment",name).read_bytes() for name in OLD_BLOBS}
    validate(new)
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    base=ftp.pwd().rstrip("/")
    site=base+"/www/"+DOMAIN+"/moment"
    backups=base+"/site-safeguard-backups"
    archive=backups+"/moment-compact-topics-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
    def read(remote):
        buff=io.BytesIO();ftp.retrbinary("RETR "+remote,buff.write);return buff.getvalue()
    def write(remote,data):
        ftp.storbinary("STOR "+remote,io.BytesIO(data))
        if sha(read(remote))!=sha(data):raise RuntimeError("FTPS verification mismatch")
    changed=[]
    try:
        previous={name:read(site+"/"+name) for name in FILES}
        for name in FILES:
            if previous[name] not in (old[name],new[name]):
                raise RuntimeError("Live "+name+" has independent changes: refusing overwrite")
        try:ftp.mkd(backups)
        except ftplib.error_perm:pass
        ftp.mkd(archive)
        for name in FILES:
            write(archive+"/"+name+".bak",previous[name])
        log(backup_completed=True,files=list(FILES),payment_auth_bot_untouched=True)
        try:
            for name in FILES:
                if previous[name]!=new[name]:
                    write(site+"/"+name,new[name]);changed.append(name)
            for name in FILES:
                if sha(public(name))!=sha(new[name]):
                    raise RuntimeError("Public site checksum mismatch: "+name)
            log(success=True,public_verified=True,topics=12,questions=300,
                no_all_topics_tile=True,compact_vertical_list=True,changed=changed)
        except BaseException:
            for name in reversed(changed):
                try:write(site+"/"+name,previous[name])
                except BaseException as error:log(rollback_failed=name,reason=type(error).__name__)
            log(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:main()
    except BaseException as error:
        log(success=False,reason=str(error)[:210]);sys.exit(1)
