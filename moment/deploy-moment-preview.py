"""Deploy isolated 300-question preview with backup, live verification and rollback.

Only adds /moment/* and changes the existing moment home tile. No PHP,
database, payment, account, bot, DNS or secrets are modified.
"""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import ssl
import subprocess
import sys
import time
from urllib.request import Request, urlopen

HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
OLD_TILE=('<button class="product-card horary" id="horary-section" type="button" data-coming-soon data-artwork="assets/horary.webp">'
          '<span class="product-title">100 вопросов обо всём</span>'
          '<span class="product-subtitle">Нумерология момента. Ответы на то, что волнует прямо сейчас</span>'
          '<span class="product-arrow" aria-hidden="true">→</span></button>').encode("utf-8")
NEW_TILE=('<a class="product-card horary" id="horary-section" href="./moment/" data-artwork="assets/horary.webp">'
          '<span class="product-title">300 вопросов обо всём</span>'
          '<span class="product-subtitle">Нумерология момента. Ответы на то, что волнует прямо сейчас</span>'
          '<span class="product-arrow" aria-hidden="true">→</span></a>').encode("utf-8")
FILES={
 "index.html":pathlib.Path("moment/index.html").read_bytes(),
 "moment.css":pathlib.Path("moment/moment.css").read_bytes(),
 "moment.js":pathlib.Path("moment/moment.js").read_bytes(),
 "questions.json":pathlib.Path("moment/questions.json").read_bytes(),
}
def sha(data):return hashlib.sha256(data).hexdigest()
def log(**kwargs):print("NUMI_MOMENT_PREVIEW",json.dumps(kwargs,sort_keys=True),flush=True)
def public(path):
    url="https://"+DOMAIN+"/"+path+"?moment_preview_check="+str(time.time_ns())
    req=Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache"})
    with urlopen(req,timeout=45) as r:
        if r.status!=200:raise RuntimeError("Public HTTP status differs")
        return r.read(3000000)
def validate():
    source=pathlib.Path("index.html").read_bytes()
    if source.count(NEW_TILE)!=1:raise RuntimeError("New homepage tile not present once")
    data=json.loads(FILES["questions.json"].decode("utf-8"))
    cats=data["categories"];questions=data["questions"]
    if len(cats)!=12 or len(questions)!=300:raise RuntimeError("Catalog count invalid")
    ids=set();categories={c["id"] for c in cats};names=set()
    for q in questions:
        if q["id"] in ids or q["title"] in names or q["category"] not in categories:
            raise RuntimeError("Duplicate or broken question")
        if q["mode"] not in ("self","partner","event"):raise RuntimeError("Unknown mode")
        ids.add(q["id"]);names.add(q["title"])
    with __import__("tempfile").TemporaryDirectory() as d:
        js=pathlib.Path(d)/"moment.js"
        js.write_bytes(FILES["moment.js"])
        result=subprocess.run(["node","--check",str(js)],capture_output=True,text=True)
        if result.returncode:raise RuntimeError("JS invalid: "+(result.stderr or result.stdout)[:240])
    if b'[hidden]{display:none!important}' not in FILES["moment.css"]:
        raise RuntimeError("Hidden field styles missing")
    log(preflight=True,categories=len(cats),questions=len(questions),unique_questions=len(names))
def main():
    validate()
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    site=root+"/www/"+DOMAIN
    moment=site+"/moment"
    def read(path):
        buf=io.BytesIO()
        try:ftp.retrbinary("RETR "+path,buf.write)
        except ftplib.error_perm as exc:
            if str(exc).startswith("550"):return None
            raise
        return buf.getvalue()
    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if sha(read(path) or b"")!=sha(data):raise RuntimeError("FTP verification failed: "+path.rsplit("/",1)[-1])
    def remove(path):ftp.delete(path)
    touched=[]
    backups={}
    try:
        original=read(site+"/index.html")
        if original is None:raise RuntimeError("Live homepage absent")
        if original.count(OLD_TILE)==1 and original.count(NEW_TILE)==0:
            updated=original.replace(OLD_TILE,NEW_TILE,1)
            update_tile=True
        elif original.count(NEW_TILE)==1:
            updated=original
            update_tile=False
        else:raise RuntimeError("Live moment tile differs; stop before publishing")
        try:ftp.mkd(moment)
        except ftplib.error_perm:
            ftp.cwd(moment)
        destination={key:moment+"/"+key for key in FILES}
        for key,location in destination.items():
            existing=read(location)
            if existing is not None and existing!=FILES[key]:
                raise RuntimeError("Existing /moment file differs; stop before touching site: "+key)
            backups[location]=existing
        backups[site+"/index.html"]=original
        backup_root=root+"/site-safeguard-backups"
        try:ftp.mkd(backup_root)
        except ftplib.error_perm:ftp.cwd(backup_root)
        bak=backup_root+"/moment-preview-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(bak)
        write(bak+"/index.html.bak",original)
        for key,value in backups.items():
            if key!=site+"/index.html" and value is not None:write(bak+"/"+key.rsplit("/",1)[-1]+".bak",value)
        try:
            for key,content in FILES.items():
                location=destination[key]
                if backups[location] is None:
                    touched.append(location)
                    write(location,content)
            if update_tile:
                touched.append(site+"/index.html")
                write(site+"/index.html",updated)
            for key,content in FILES.items():
                if sha(public("moment/"+key))!=sha(content):
                    raise RuntimeError("Public preview differs: "+key)
            if update_tile and sha(public(""))!=sha(updated):
                raise RuntimeError("Public homepage differs")
            log(success=True,public_verified=True,only_new_preview_files=True,homepage_tile_linked=True)
        except BaseException:
            for location in reversed(touched):
                previous=backups[location]
                try:
                    if previous is None:remove(location)
                    else:write(location,previous)
                except BaseException as exc:log(rollback_failed=location.rsplit("/",1)[-1],reason=type(exc).__name__)
            log(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as exc:
        log(success=False,reason=str(exc)[:250] if isinstance(exc,RuntimeError) else type(exc).__name__)
        sys.exit(1)
