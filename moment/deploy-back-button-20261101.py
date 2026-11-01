"""Safely publish ONLY Moment-page Back-button markup on REG.RU."""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time,urllib.request
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
BASELINE="8bbcb0fc023b3a470b9b63a6a16e02fd6d41906b"
def checksum(data): return hashlib.sha256(data).hexdigest()
def log(**data): print("MOMENT_BACK "+json.dumps(data,ensure_ascii=False,sort_keys=True),flush=True)
def get_live():
    url="https://"+DOMAIN+"/moment/index.html?moment_back_verify="+str(time.time_ns())
    request=urllib.request.Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache","User-Agent":"numi-moment-back-release/1.0"})
    with urllib.request.urlopen(request,timeout=35) as response:
        if response.status!=200: raise RuntimeError("Public site HTTP not 200")
        return response.read(1000000)
def main():
    source=pathlib.Path("moment/index.html").read_bytes()
    old=subprocess.check_output(["git","show",BASELINE])
    oldlink='<a class="header-back" href="../" aria-label="Вернуться на главную">← На главную</a>'.encode("utf-8")
    newlabel='<a href="../" class="moment-back-button"'.encode("utf-8")
    if (old.count(oldlink)!=1 or old.count(newlabel)!=0
        or source.count(newlabel)!=1 or source.count(oldlink)!=0
        or source.count('← Назад</a>'.encode("utf-8"))!=1
        or source.count(b'href="./yes-no/"')!=1):
        raise RuntimeError("Expected one Back button and one yes/no card")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    page=root+"/www/"+DOMAIN+"/moment/index.html"
    backuproot=root+"/site-safeguard-backups"
    bak=backuproot+"/moment-back-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
    def read(path):
        buffer=io.BytesIO();ftp.retrbinary("RETR "+path,buffer.write);return buffer.getvalue()
    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if checksum(read(path))!=checksum(data):raise RuntimeError("FTPS readback mismatch")
    changed=False
    try:
        before=read(page)
        if before not in (old,source):
            raise RuntimeError("Live Moment page has independent edits; refused to overwrite")
        try:ftp.mkd(backuproot)
        except ftplib.error_perm:pass
        ftp.mkd(bak)
        write(bak+"/index.html.bak",before)
        log(backup=True,only_moment_page=True,previous_sha=checksum(before))
        try:
            if before!=source:
                write(page,source);changed=True
            if checksum(get_live())!=checksum(source):
                raise RuntimeError("Live HTTP checksum mismatch")
            log(success=True,verified=True,one_step_back=True,only_moment_page=True,
                yes_no_preserved=True,old_top_link_removed=True)
        except BaseException:
            if changed:
                try:write(page,before);log(rollback=True)
                except BaseException as err:log(rollback_failed=type(err).__name__)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as error:
        log(success=False,reason=str(error)[:200]);sys.exit(1)
