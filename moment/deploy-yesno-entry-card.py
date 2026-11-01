"""Publish only the centered Yes/No entry card to existing REG.RU moment page."""
import ftplib,hashlib,io,json,os,pathlib,re,ssl,subprocess,sys,time
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
OLD_BLOB="be9d6aa95a6e243e6ec9df2709bf40a5423424cd"
PATTERN='    <section class="shell" aria-label="Да или нет" style="padding-top:34px">.*?    </section>'.encode('utf-8')
def section(source):
    matches=re.findall(PATTERN,source,re.S)
    if len(matches)!=1:raise RuntimeError("Expected one exact Yes/No entry card, found "+str(len(matches)))
    return matches[0]
def digest(x):return hashlib.sha256(x).hexdigest()
def main():
    before=section(subprocess.check_output(["git","show",OLD_BLOB]))
    after=section(pathlib.Path("moment/index.html").read_bytes())
    if before==after or b"100 \xd0\xb2\xd0\xbe\xd0\xbf\xd1\x80\xd0\xbe\xd1\x81\xd0\xbe\xd0\xb2" not in after or b'href="./yes-no/"' not in after:raise RuntimeError("New card source validation failed")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    target=root+"/www/"+DOMAIN+"/moment/index.html"
    def read(p):
        b=io.BytesIO();ftp.retrbinary("RETR "+p,b.write);return b.getvalue()
    def write(p,b):
        ftp.storbinary("STOR "+p,io.BytesIO(b))
        if read(p)!=b:raise RuntimeError("FTPS verification failed")
    try:
        live=read(target)
        found=section(live)
        if found==after:
            print(json.dumps({"success":True,"already_published":True}))
            return
        if found!=before:raise RuntimeError("Live card differs from known old layout; no changes made")
        updated=live.replace(before,after,1)
        backups=root+"/site-safeguard-backups"
        try:ftp.mkd(backups)
        except ftplib.error_perm:ftp.cwd(backups)
        backup=backups+"/yesno-entry-card-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+".bak"
        write(backup,live)
        try:
            write(target,updated)
            url="https://"+DOMAIN+"/moment/?yesno_card_check="+str(time.time_ns())
            req=Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache"})
            with urlopen(req,timeout=45) as response:
                observed=response.read(3000000)
            if digest(observed)!=digest(updated):raise RuntimeError("Public page differs from published version")
            print(json.dumps({"success":True,"public_verified":True,"only_card_modified":True,"backup":backup.rsplit("/",1)[-1]},ensure_ascii=False),flush=True)
        except BaseException:
            write(target,live)
            print(json.dumps({"rollback":True}),flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        print(json.dumps({"success":False,"reason":str(e)[:240]}),flush=True)
        sys.exit(1)
