"""Publish combined Yes-No UX: no search, compact HH:MM popup, automatic time acceptance.

Only changes /moment/yes-no/{index.html,yes-no.css,yes-no.js}.
Validates live baseline, backs it up outside the public site, verifies each upload and
public HTTPS, and restores the old version on any failure.
"""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time
from urllib.request import Request,urlopen

HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
DIR="moment/yes-no"
BASELINE={
    "index.html":"f27cb266afa9ae0ce404f09f699364f85d286d39",
    "yes-no.css":"3be50b86808b1c7d066f459e4bd86a253f36c44d",
    "yes-no.js":"3ac4e6973f6b3e98512fd0b2f38ae10b3ad33592"
}
FILES=("yes-no.css","yes-no.js","index.html")
def sha(x):return hashlib.sha256(x).hexdigest()
def blob(x):return subprocess.check_output(["git","show",x])
def log(**d):print("YESNO_COMPACT_NOSEARCH "+json.dumps(d,sort_keys=True,ensure_ascii=False),flush=True)
def public(name):
    req=Request("https://"+DOMAIN+"/"+DIR+"/"+name+"?yesno_one_screen="+str(time.time_ns()),
                headers={"Cache-Control":"no-cache","Pragma":"no-cache","User-Agent":"numi-yesno-one-screen/1.0"})
    with urlopen(req,timeout=40) as result:
        if result.status!=200:raise RuntimeError("Unexpected public HTTP response: "+name)
        return result.read(1_000_000)
def verify(new):
    html=new["index.html"].decode("utf-8")
    css=new["yes-no.css"].decode("utf-8")
    js=new["yes-no.js"].decode("utf-8")
    if (html.count('href="./yes-no.css?v=11"')!=1 or
        html.count('src="./yes-no.js?v=6"')!=1 or
        html.count('id="yn-time-input"')!=1 or
        html.count('placeholder="--:--"')!=1 or
        html.count('id="yn-now"')!=1 or
        html.count('id="yn-questions"')!=1 or
        'id="yn-confirm-time"' in html or
        'id="yn-search"' in html or 'id="yn-more"' in html or
        'Найти вопрос в теме' in html or 'Например, 14:31' in html):
        raise RuntimeError("Unexpected HTML question or clock interface")
    if (('if (validTime(cleaned)) {' not in js) or
        'confirmTime(cleaned);' not in js or
        'found.map((q, i) =>' not in js or
        '$("yn-search")' in js or '$("yn-more")' in js or
        'fetch("./questions.json?v=2", {cache:"default"})' not in js):
        raise RuntimeError("Auto-time or all-question JavaScript incomplete")
    if (css.count("{")!=css.count("}") or
        '/* One-screen Yes/No clock popup:' not in css or
        '#yn-dialog .dialog-content{position:relative;padding:14px 17px 17px}' not in css):
        raise RuntimeError("Compact styling failed validation")
    data=json.loads(pathlib.Path(DIR,"questions.json").read_text("utf-8"))
    if (len(data["categories"])!=7 or len(data["questions"])!=100 or
        len({q["title"] for q in data["questions"]})!=100 or
        any(sum(q["category"]==c["id"] for q in data["questions"])!=c["count"] for c in data["categories"])):
        raise RuntimeError("100-question catalog changed")
    log(preflight=True,topics=7,questions=100,clock=True,no_search=True,read_only_catalog=True)

def main():
    old={name:blob(git_sha) for name,git_sha in BASELINE.items()}
    new={name:pathlib.Path(DIR,name).read_bytes() for name in FILES}
    verify(new)
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    remote=home+"/www/"+DOMAIN+"/"+DIR
    backup_root=home+"/site-safeguard-backups"
    archive=backup_root+"/yesno-compact-no-search-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
    def read(path):
        b=io.BytesIO();ftp.retrbinary("RETR "+path,b.write);return b.getvalue()
    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if sha(read(path))!=sha(data):raise RuntimeError("FTPS integrity mismatch: "+path)
    changed=[]
    try:
        original={name:read(remote+"/"+name) for name in FILES}
        for name in FILES:
            if original[name] not in (old[name],new[name]):
                raise RuntimeError("Live "+name+" differs from reviewed baseline; release refused")
        try:ftp.mkd(backup_root)
        except ftplib.error_perm:pass
        ftp.mkd(archive)
        for name in FILES:write(archive+"/"+name+".bak",original[name])
        log(backup_ready=True,only_yesno_files=True)
        try:
            for name in FILES:
                if original[name]!=new[name]:
                    changed.append(name)
                    write(remote+"/"+name,new[name])
            for name in FILES:
                if sha(public(name))!=sha(new[name]):
                    raise RuntimeError("Public HTTPS checksum mismatch: "+name)
            log(success=True,public_verified=True,no_search=True,full_questions=100,
                no_confirmation_button=True,placeholder_dashes=True,changed=changed)
        except BaseException:
            for name in reversed(changed):
                try:write(remote+"/"+name,original[name])
                except BaseException as error:log(rollback_failed=name,exception=type(error).__name__)
            log(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as error:
        log(success=False,reason=str(error)[:230]);sys.exit(1)
