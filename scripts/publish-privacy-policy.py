"""Release only the privacy policy and its single homepage footer link to REG.RU.

The production homepage is patched in place to preserve unrelated live edits.
Every replacement is backed up outside the public web root and can be rolled back.
No payment, account, Telegram, paid-content or DNS files are touched.
"""
import ftplib
import hashlib
import io
import os
import pathlib
import ssl
import sys
import time
from urllib.request import Request, urlopen

HOST = "server172.hosting.reg.ru"
DOMAIN = "xn--c1adkkdfjbp1a4l.online"
START = b'        <!-- NUMI PRIVACY FOOTER: standalone document, no account or payment changes -->'
END = b'        </footer>\n'
GUIDE = ('        <p style="text-align:center;margin:20px auto 5px;font-size:13px;opacity:.75">'
         '<a style="color:inherit;text-underline-offset:4px" href="./guide/">'
         'Справочник по нумерологии</a></p>\n').encode("utf-8")
GUARD = b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31"

def digest(data):
    return hashlib.sha256(data).digest()

def public_get(name):
    url = "https://" + DOMAIN + "/" + name + "?privacy_release=" + str(time.time_ns())
    req = Request(url, headers={"Cache-Control": "no-cache"})
    with urlopen(req, timeout=35) as res:
        if res.status != 200:
            raise RuntimeError("Unexpected public HTTP status: " + name)
        return res.read(3_000_000)

def main():
    page = pathlib.Path("privacy.html").read_bytes()
    source = pathlib.Path("index.html").read_bytes()
    if not 10000 <= len(page) < 150000 or not page.startswith(b"<!doctype html>"):
        raise RuntimeError("Privacy page preflight failed")
    for token in ("ЮKassa", "633011166908", "325632700163022", "online.numerology.info@yandex.ru"):
        if token.encode() not in page:
            raise RuntimeError("Missing approved policy details")
    if source.count(START) != 1 or source.count(END) < 1 or source.count(GUIDE) != 1:
        raise RuntimeError("Approved footer missing from source homepage")
    tail = source.split(START, 1)[1]
    if END not in tail:
        raise RuntimeError("Footer closing marker missing")
    footer = START + tail.split(END, 1)[0] + END
    if footer.count(b'href="/privacy.html"') != 1:
        raise RuntimeError("Invalid policy footer link")

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=35)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    home = ftp.pwd().rstrip("/")
    site = home + "/www/" + DOMAIN
    index_path = site + "/index.html"
    privacy_path = site + "/privacy.html"
    guard_path = site + "/.htaccess"

    def read(path, optional=False):
        buf = io.BytesIO()
        try:
            ftp.retrbinary("RETR " + path, buf.write)
            return buf.getvalue()
        except ftplib.error_perm as e:
            if optional and str(e).startswith("550"):
                return None
            raise

    def write(path, value):
        ftp.storbinary("STOR " + path, io.BytesIO(value))
        if digest(read(path)) != digest(value):
            raise RuntimeError("Remote FTPS verification failed")

    try:
        old_index = read(index_path)
        old_privacy = read(privacy_path, optional=True)
        old_guard = read(guard_path)
        if GUARD not in old_guard:
            raise RuntimeError("Paid static guard changed; refusing release")
        if old_index.count(b'id="home"') != 1 or old_index.count(GUIDE) != 1:
            raise RuntimeError("Unknown production homepage layout")
        if old_privacy is not None and digest(old_privacy) != digest(page):
            if b"<html" not in old_privacy.lower() or "конфиденциальности".encode() not in old_privacy.lower():
                raise RuntimeError("Different existing privacy file; refusing overwrite")

        if footer in old_index:
            new_index = old_index
        else:
            if START in old_index or b'href="/privacy.html"' in old_index:
                raise RuntimeError("Privacy footer already differs from approved version")
            new_index = old_index.replace(GUIDE, GUIDE + footer, 1)
        if new_index.count(footer) != 1 or new_index.count(b'href="/privacy.html"') != 1:
            raise RuntimeError("Footer insertion failed")

        if old_privacy == page and old_index == new_index:
            if digest(public_get("privacy.html")) != digest(page):
                raise RuntimeError("Existing privacy page not reachable")
            print("PRIVACY_RELEASE already_published=true verified=true", flush=True)
            return

        backup_root = home + "/site-safeguard-backups"
        try:
            ftp.mkd(backup_root)
        except ftplib.error_perm:
            ftp.cwd(backup_root)
        backup_dir = backup_root + "/privacy-policy-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        ftp.mkd(backup_dir)
        write(backup_dir + "/index.html.bak", old_index)
        if old_privacy is not None:
            write(backup_dir + "/privacy.html.bak", old_privacy)
        print("PRIVACY_RELEASE backups_complete=true", flush=True)

        changed = []
        try:
            if old_privacy != page:
                changed.append("privacy")
                write(privacy_path, page)
            if old_index != new_index:
                changed.append("index")
                write(index_path, new_index)
            if digest(public_get("privacy.html")) != digest(page):
                raise RuntimeError("Public privacy page differs from approved version")
            if digest(public_get("")) != digest(new_index):
                raise RuntimeError("Public homepage differs from uploaded homepage")
            if read(guard_path) != old_guard:
                raise RuntimeError("Protected .htaccess changed unexpectedly")
            print("PRIVACY_RELEASE success=true verified=true changed=" + ",".join(changed), flush=True)
        except BaseException:
            for target in reversed(changed):
                try:
                    if target == "index":
                        write(index_path, old_index)
                    elif old_privacy is None:
                        ftp.delete(privacy_path)
                    else:
                        write(privacy_path, old_privacy)
                    print("PRIVACY_RELEASE rolled_back=" + target, flush=True)
                except BaseException:
                    print("PRIVACY_RELEASE rollback_failed=" + target, flush=True)
            raise
    finally:
        try:
            ftp.quit()
        except BaseException:
            ftp.close()

if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        print("PRIVACY_RELEASE success=false reason=" + type(error).__name__, flush=True)
        sys.exit(1)
