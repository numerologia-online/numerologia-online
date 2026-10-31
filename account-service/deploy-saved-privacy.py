"""Safely add per-item Saved removal without altering orders, paid rights, or bot.
Fail closed on unknown live backend / JS and back up every replaced file.
"""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
def digest(value):return hashlib.sha256(value).digest()
def from_git(rev,path):return subprocess.check_output(["git","show",rev+":"+path])
def log(**values):print("NUMI_SAVED_PRIVACY",json.dumps(values,sort_keys=True),flush=True)
def http_get(path):
    with urlopen(Request("https://"+DOMAIN+"/"+path+("?" if "?" not in path else "&")+"saved_check="+str(time.time_ns()),headers={"Cache-Control":"no-cache"}),timeout=35) as resp:
        if resp.status!=200:raise RuntimeError("Unexpected public HTTP status")
        return resp.read(2000000)
def health():
    req=Request("https://"+DOMAIN+"/api/numi-account.php",
        headers={"Content-Type":"application/json","Origin":"https://"+DOMAIN},
        data=b'{"action":"health"}',method="POST")
    with urlopen(req,timeout=35) as resp:
        answer=json.loads(resp.read(10000))
        if resp.status!=200 or answer.get("ok") is not True or answer.get("database") is not True:
            raise RuntimeError("Account backend health check failed")
def main():
    source_core=pathlib.Path("account-service/private/core.php").read_bytes()
    source_js=pathlib.Path("account-browser.js").read_bytes()
    template=pathlib.Path("index.html").read_bytes()
    begin=b'    <style id="numi-saved-list-20261031">'
    marker=b'    <!-- Reversible experiment: subtitles on the eight homepage catalog cards only. -->'
    if template.count(begin)!=1 or template.count(marker)!=1:
        raise RuntimeError("New UI markers are missing")
    css=begin+template.split(begin,1)[1].split(marker,1)[0]
    old_back=b'<button class="account-back" type="button" data-account-back>\xe2\x86\x90 \xd0\x92 \xd0\xba\xd0\xb0\xd0\xb1\xd0\xb8\xd0\xbd\xd0\xb5\xd1\x82</button>'
    new_back='<button class="account-back" type="button" data-account-back>← Назад в личный кабинет</button>'.encode()
    old_empty='<p class="account-empty-state">История оплаченных материалов появится здесь после подключения покупок к аккаунту. Пока ничего не списываем и не выдаём незавершённую оплату за покупку.</p>'.encode()
    new_empty='<p class="account-empty-state">♡ Здесь пока пусто. Ваши сохранённые разборы и ответы появятся здесь.</p>'.encode()
    if b"function naHideSaved" not in source_core or b"hide_saved" not in source_js:
        raise RuntimeError("Saved hiding logic missing")
    js_known=[
        (b"account-browser.js?v=12",from_git("a7ddf5eff679e7175b9bc536de934e86cddd7458","account-browser.js")),
        (b"account-browser.js?v=13",from_git("b973b5d03e46cc073d45252b777ff729a924da46","account-browser.js"))
    ]
    expected_core=from_git("d22289137b8fc695a7bc87e5512e63777ea1f2aa^","account-service/private/core.php")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    site=home+"/www/"+DOMAIN
    paths={"index":site+"/index.html","js":site+"/account-browser.js",
           "core":home+"/private/numi-account-20261031/core.php",
           "guard":site+"/.htaccess","telegram":site+"/auth-profile.js"}
    def read(path):
        buf=io.BytesIO();ftp.retrbinary("RETR "+path,buf.write);return buf.getvalue()
    def write(path,value):
        ftp.storbinary("STOR "+path,io.BytesIO(value))
        if digest(read(path))!=digest(value):raise RuntimeError("FTPS checksum mismatch")
    try:
        before={key:read(path) for key,path in paths.items()}
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in before["guard"]:
            raise RuntimeError("Paid access protection missing")
        if digest(before["core"])!=digest(expected_core):
            raise RuntimeError("Unrecognized live account backend; no files changed")
        match=[tag for tag,js in js_known if before["index"].count(tag)==1 and digest(before["js"])==digest(js)]
        if len(match)!=1 or begin in before["index"] or b"account-browser.js?v=14" in before["index"]:
            raise RuntimeError("Unrecognized live account UI version; no files changed")
        for old_value in (marker,old_back,old_empty):
            if before["index"].count(old_value)!=1:
                raise RuntimeError("Live homepage saved section unexpectedly changed")
        new_index=before["index"].replace(marker,css+marker,1).replace(old_back,new_back,1)
        new_index=new_index.replace(old_empty,new_empty,1).replace(match[0],b"account-browser.js?v=14",1)
        backuproot=home+"/site-safeguard-backups"
        try:ftp.mkd(backuproot)
        except ftplib.error_perm:ftp.cwd(backuproot)
        backup=backuproot+"/saved-privacy-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        for key in ("core","js","index"):write(backup+"/"+key+".bak",before[key])
        log(backup_complete=True)
        changed=[]
        try:
            for key,payload in (("core",source_core),("js",source_js),("index",new_index)):
                changed.append(key);write(paths[key],payload)
            if digest(http_get("account-browser.js"))!=digest(source_js):
                raise RuntimeError("Live account JS does not match release")
            if digest(http_get(""))!=digest(new_index):
                raise RuntimeError("Live homepage does not match release")
            health()
            if read(paths["guard"])!=before["guard"] or read(paths["telegram"])!=before["telegram"]:
                raise RuntimeError("Protected files changed unexpectedly")
            log(success=True,live_verified=True,paid_rights_unmodified=True,bot_unchanged=True)
        except BaseException:
            for key in reversed(changed):
                try:write(paths[key],before[key])
                except BaseException:log(rollback_failed=key)
            log(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as exc:
        log(success=False,reason=str(exc)[:160] if isinstance(exc,RuntimeError) else type(exc).__name__)
        sys.exit(1)
