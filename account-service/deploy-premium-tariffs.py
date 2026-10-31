"""Publish only the pricing pane and its new scoped CSS. Refuse unrelated changes."""
import ftplib, hashlib, io, json, os, pathlib, ssl, sys, time
from urllib.request import Request, urlopen

HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
PANE_START=b'        <section class="account-panel" data-account-content="prices" hidden>'
PANE_END=b'        <section class="account-panel" data-account-content="learning" hidden>'
CSS_START=b'    <style id="numi-premium-tariffs-20261031">'
CSS_END=b'    <!-- Reversible experiment: subtitles on the eight homepage catalog cards only. -->'
def sha(b):return hashlib.sha256(b).digest()
def say(**x):print("NUMI_PREMIUM_TARIFFS",json.dumps(x,sort_keys=True),flush=True)
def public(path):
    req=Request("https://"+DOMAIN+"/"+path+"?premium_tariffs="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
    with urlopen(req,timeout=35) as resp:
        if resp.status!=200:raise RuntimeError("Unexpected public status")
        return resp.read(3000000)
def main():
    original_source=pathlib.Path("index.html").read_bytes()
    if any(original_source.count(marker)!=1 for marker in (PANE_START,PANE_END,CSS_START,CSS_END)):
        raise RuntimeError("Source pricing markers are not unique")
    pane=PANE_START+original_source.split(PANE_START,1)[1].split(PANE_END,1)[0]
    css=CSS_START+original_source.split(CSS_START,1)[1].split(CSS_END,1)[0]
    if b"numi-tariff-club-price" not in pane or b"numi-tariff-back" not in pane:
        raise RuntimeError("Missing intended pricing UI")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    site=home+"/www/"+DOMAIN
    paths={"index":site+"/index.html","guard":site+"/.htaccess","auth":site+"/auth-profile.js"}
    def read(p):
        buf=io.BytesIO();ftp.retrbinary("RETR "+p,buf.write);return buf.getvalue()
    def write(p,data):
        ftp.storbinary("STOR "+p,io.BytesIO(data))
        if sha(read(p))!=sha(data):raise RuntimeError("Remote hash mismatch")
    try:
        old={k:read(v) for k,v in paths.items()}
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in old["guard"]:
            raise RuntimeError("Paid-content access guard missing")
        current=old["index"]
        if current.count(PANE_START)!=1 or current.count(PANE_END)!=1 or current.count(CSS_END)!=1:
            raise RuntimeError("Unexpected live document structure")
        if CSS_START in current:
            if pane in current and css in current:
                say(success=True,already_published=True)
                return
            raise RuntimeError("Conflicting premium design already published")
        old_pane=PANE_START+current.split(PANE_START,1)[1].split(PANE_END,1)[0]
        if b"numi-tariff-table" not in old_pane or b'id="account-show-offer"' not in old_pane:
            raise RuntimeError("Old pricing UI baseline not recognized")
        updated=current.replace(old_pane,pane,1).replace(CSS_END,css+CSS_END,1)
        backup_parent=home+"/site-safeguard-backups"
        try:ftp.mkd(backup_parent)
        except ftplib.error_perm:ftp.cwd(backup_parent)
        backup=backup_parent+"/premium-tariffs-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        write(backup+"/index.html.bak",current)
        attempted=False
        try:
            attempted=True
            write(paths["index"],updated)
            if sha(public(""))!=sha(updated):raise RuntimeError("Live HTML verification failed")
            if read(paths["guard"])!=old["guard"] or read(paths["auth"])!=old["auth"]:
                raise RuntimeError("Protected files changed")
            say(success=True,published=True,only_pricing_ui_changed=True)
        except BaseException:
            if attempted:write(paths["index"],current)
            say(rollback_complete=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        say(success=False,reason=str(e)[:180] if isinstance(e,RuntimeError) else type(e).__name__)
        sys.exit(1)
