"""Read-only REG.RU release drift diagnostic; prints filenames and hashes only.
Never writes to FTP or calls a mutating API.
"""
import ftplib, hashlib, io, os, pathlib, ssl, sys
HOST = "server172.hosting.reg.ru"
DOMAIN = "xn--c1adkkdfjbp1a4l.online"
FILES = [
    "index.html", "app.js", "auth-profile.js", "account-browser.js",
    "year-feature.js", "matrix-feature.js", "redflag-feature.js",
    "redflag-categories.js", "compatibility-feature.js",
    "personal-day-feature.js", "destiny-code-feature.js",
    "year-polish.css", "matrix-polish.css", "redflag-polish.css",
    "compatibility-polish.css", "destiny-code.css",
    "contacts.html", "analytics-settings.html"
]
def sha(data):
    return hashlib.sha256(data).hexdigest()[:16]
def main():
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=25)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    base=ftp.pwd().rstrip("/") + "/www/" + DOMAIN
    try:
        for name in FILES:
            path=base + "/" + name
            local=pathlib.Path(name)
            if not local.is_file():
                print("FILE",name,"LOCAL_MISSING",flush=True);continue
            buf=io.BytesIO()
            try:
                ftp.retrbinary("RETR " + path,buf.write)
            except ftplib.error_perm as e:
                print("FILE",name,"REMOTE_MISSING" if str(e).startswith("550") else "REMOTE_READ_ERROR",flush=True)
                continue
            remote=buf.getvalue()
            source=local.read_bytes()
            print("FILE",name,"MATCH" if remote==source else "DIFF",
                  "remote_bytes="+str(len(remote)),"local_bytes="+str(len(source)),
                  "remote_sha="+sha(remote),"local_sha="+sha(source),flush=True)
            if name == "index.html":
                for tag in [b"auth-profile.js?v=20",b"app.js?v=20261101fix1",
                            b"numi-cookie-notice",b"href=\"/contacts.html\""]:
                    print("INDEX_CHECK",tag.decode(),"remote="+str(tag in remote),"github="+str(tag in source),flush=True)
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try: main()
    except BaseException as e:
        print("DIAGNOSTIC_FAILED",type(e).__name__,str(e)[:130],flush=True)
        sys.exit(1)
