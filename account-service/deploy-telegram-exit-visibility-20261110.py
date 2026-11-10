"""Publish only the VPN notice typography tweak, with guarded backup and rollback."""
import ftplib, io, os, pathlib, ssl, subprocess, time, urllib.request, urllib.parse

HOST = "server172.hosting.reg.ru"
NEW = "xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD = "xn--c1adkkdfjbp1a4l.online"
NAMES = ("account-browser.js", "index.html")
BASE = {
 "account-browser.js": "ec0da87cb9f39e44530e30d01dad47fd8474c17f^",
 "index.html": "07199d5c04814d5f900e7af12f358bf5d32c889b^",
}
expected = {n: subprocess.check_output(["git","show",BASE[n]+":"+n]) for n in NAMES}
desired = {n: pathlib.Path(n).read_bytes() for n in NAMES}

def public(name):
    req=urllib.request.Request("https://"+NEW+"/"+name+"?vpn_notice_ui="+str(time.time_ns()),
                               headers={"Cache-Control":"no-cache"})
    with urllib.request.urlopen(req,timeout=30) as r:
        if r.status!=200 or urllib.parse.urlsplit(r.geturl()).hostname!=NEW:
            raise RuntimeError("PUBLIC_HOST_MISMATCH")
        data=r.read(1_900_001)
        if len(data)>1_900_000:raise RuntimeError("FILE_OVERSIZE")
        return data

def main():
    if not os.environ.get("REG_FTP_USER") or not os.environ.get("REG_FTP_PASSWORD"):
        raise RuntimeError("MISSING_FTP_CREDENTIALS")
    live_index=public("index.html")
    live_js=public("account-browser.js")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    def read(path):
        out=io.BytesIO()
        ftp.retrbinary("RETR "+path,out.write)
        if out.tell()>1_900_000:raise RuntimeError("REMOTE_FILE_OVERSIZE")
        return out.getvalue()
    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if read(path)!=data:raise RuntimeError("WRITE_MISMATCH")
    changed=[]
    try:
        root=ftp.pwd().rstrip("/")
        site=None
        for domain in (NEW,OLD):
            candidate=root+"/www/"+domain
            try: data=read(candidate+"/index.html")
            except ftplib.error_perm:continue
            if data==live_index:
                site=candidate
                break
        if not site:raise RuntimeError("ACTIVE_WEBROOT_NOT_VERIFIED")
        live={n:read(site+"/"+n) for n in NAMES}
        if live["account-browser.js"]!=live_js:
            raise RuntimeError("PUBLIC_JS_BASELINE_MISMATCH")
        for n in NAMES:
            if live[n]!=expected[n] and live[n]!=desired[n]:
                raise RuntimeError("UNREVIEWED_LIVE_EDIT:"+n)
        guard=read(site+"/.htaccess")
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("PAID_ACCESS_GUARD_MISSING")
        to_write=[n for n in NAMES if live[n]!=desired[n]]
        if not to_write:
            print("VPN_NOTICE_ALREADY_LIVE",flush=True)
            return
        backup_root=root+"/site-safeguard-backups"
        try:ftp.mkd(backup_root)
        except ftplib.error_perm:ftp.cwd(backup_root)
        backup=backup_root+"/vpn-notice-style-"+str(os.environ.get("GITHUB_RUN_ID",time.time_ns()))
        ftp.mkd(backup)
        for n in to_write:
            write(backup+"/"+n+".bak",live[n])
            print("BACKUP_VERIFIED",n,flush=True)
        try:
            for n in to_write:
                if read(site+"/"+n)!=live[n]:
                    raise RuntimeError("CONCURRENT_EDIT:"+n)
                changed.append(n)
                write(site+"/"+n,desired[n])
            for n in NAMES:
                if public(n)!=desired[n]:
                    raise RuntimeError("PUBLIC_VERIFY_FAILED:"+n)
            if read(site+"/.htaccess")!=guard:
                raise RuntimeError("GUARD_CHANGED")
            print("VPN_NOTICE_LIVE_VERIFIED",NEW,flush=True)
        except BaseException:
            for n in reversed(changed):
                try:
                    write(site+"/"+n,live[n])
                    print("ROLLBACK_VERIFIED",n,flush=True)
                except Exception:
                    print("ROLLBACK_FAILED",n,flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    main()
