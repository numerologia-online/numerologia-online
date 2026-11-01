"""Publish a strictly scoped spacing reduction for the Moment landing page."""
import ftplib, hashlib, io, json, os, pathlib, ssl, subprocess, sys, time
from urllib.request import Request, urlopen

HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
OLD={"index.html":"f13acdd803b834bf773e6d680177e890945bab3b",
     "moment.css":"9e4eebf7d15e6a495d8913a82eb0ec5ee0231ae2"}
FILES=("moment.css","index.html")
HTML_EDITS=[
 ('./moment.css?v=3','./moment.css?v=4'),
 ('padding-top:clamp(20px,4vw,34px);text-align:center','padding-top:clamp(14px,3vw,24px);text-align:center'),
 ('margin:0 auto 33px;border:2px solid #b98b44','margin:0 auto 20px;border:2px solid #b98b44'),
 ('aria-label="Да или нет" style="padding-top:34px"','aria-label="Да или нет" style="padding-top:18px"'),
 ('gap:10px;padding:clamp(28px,6vw,44px) 18px','gap:7px;padding:clamp(17px,4vw,26px) 18px'),
 ('font-size:clamp(36px,9vw,54px);line-height:1.13','font-size:clamp(31px,7.7vw,46px);line-height:1.13'),
 ('font-size:clamp(17px,4.5vw,22px);font-weight:700','font-size:clamp(16px,4vw,20px);font-weight:700'),
 ('gap:9px;margin-top:12px;padding:11px 20px;border-radius:30px','gap:8px;margin-top:5px;padding:9px 17px;border-radius:30px'),
 ('background:#143d30;color:#fff;font-size:15px;font-weight:700','background:#143d30;color:#fff;font-size:14px;font-weight:700'),
]
CSS_EDITS=[
 ('.explore{padding-top:clamp(36px,6vw,55px)}','.explore{padding-top:clamp(19px,3vw,29px)}'),
 ('.explore .section-heading{display:flex;justify-content:center;align-items:center;gap:0;margin-bottom:28px;text-align:center}',
  '.explore .section-heading{display:flex;justify-content:center;align-items:center;gap:0;margin-bottom:18px;text-align:center}'),
 ('  .explore{padding:42px 0 65px}','  .explore{padding:25px 0 65px}'),
 ('  .explore .section-heading{margin-bottom:23px}','  .explore .section-heading{margin-bottom:15px}')
]

def digest(data): return hashlib.sha256(data).hexdigest()
def log(**data): print("MOMENT_COMPACT_SPACING "+json.dumps(data,ensure_ascii=False,sort_keys=True),flush=True)
def get_blob(sha): return subprocess.check_output(["git","show",sha])
def edit_exact(content,edits):
    for before,after in edits:
        before=before.encode("utf-8");after=after.encode("utf-8")
        if content.count(before)!=1:
            raise RuntimeError("Unexpected source occurrence for "+before.decode("utf-8")[:58])
        content=content.replace(before,after,1)
    return content
def public(name):
    url="https://"+DOMAIN+"/moment/"+name+"?spacing_qa="+str(time.time_ns())
    req=Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache",
                             "User-Agent":"numi-moment-compact-spacing/1.0"})
    with urlopen(req,timeout=40) as response:
        if response.status!=200:raise RuntimeError("Public HTTP status error")
        return response.read(1000000)

def main():
    old={name:get_blob(sha) for name,sha in OLD.items()}
    new={name:pathlib.Path("moment",name).read_bytes() for name in FILES}
    if (edit_exact(old["index.html"],HTML_EDITS)!=new["index.html"] or
        edit_exact(old["moment.css"],CSS_EDITS)!=new["moment.css"]):
        raise RuntimeError("Unrelated changes detected in Moment HTML or CSS")
    if new["moment.css"].count(b"{")!=new["moment.css"].count(b"}"):
        raise RuntimeError("CSS braces are unbalanced")
    if (new["index.html"].count(b'href="./yes-no/"')!=1 or
        new["index.html"].count(b'id="category-grid"')!=1 or
        new["index.html"].count(b'id="questions-panel"')!=1):
        raise RuntimeError("Question navigation unexpectedly changed")
    data=json.loads(pathlib.Path("moment/questions.json").read_text("utf-8"))
    if len(data["categories"])!=12 or len(data["questions"])!=300:
        raise RuntimeError("Catalog no longer has 12 topics and 300 questions")
    log(preflight=True,scoped_files=list(FILES),questions=300)

    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    site=root+"/www/"+DOMAIN+"/moment"
    backupdir=root+"/site-safeguard-backups"
    backup=backupdir+"/moment-spacing-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
    def read(remote):
        buf=io.BytesIO();ftp.retrbinary("RETR "+remote,buf.write);return buf.getvalue()
    def write(remote,payload):
        ftp.storbinary("STOR "+remote,io.BytesIO(payload))
        if digest(read(remote))!=digest(payload):
            raise RuntimeError("FTP readback differs")
    changed=[]
    try:
        originals={name:read(site+"/"+name) for name in FILES}
        for name in FILES:
            if originals[name] not in (old[name],new[name]):
                raise RuntimeError("Live "+name+" was independently edited; refusing overwrite")
        try:ftp.mkd(backupdir)
        except ftplib.error_perm:pass
        ftp.mkd(backup)
        for name in FILES:write(backup+"/"+name+".bak",originals[name])
        log(backup_completed=True,only_moment_html_css=True)
        try:
            for name in FILES:
                if originals[name]!=new[name]:
                    write(site+"/"+name,new[name])
                    changed.append(name)
            for name in FILES:
                if digest(public(name))!=digest(new[name]):
                    raise RuntimeError("Public file checksum mismatch: "+name)
            log(success=True,live_verified=True,compact_yesno_card=True,
                reduced_vertical_spacing=True,questions_untouched=True,changed=changed)
        except BaseException:
            for name in reversed(changed):
                try:write(site+"/"+name,originals[name])
                except BaseException as error:log(rollback_failed=name,reason=type(error).__name__)
            log(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as error:
        log(success=False,reason=str(error)[:230]);sys.exit(1)
