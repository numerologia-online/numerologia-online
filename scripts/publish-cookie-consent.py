"""Publish ONLY compact cookie consent on REG.RU, without replacing the live homepage.

Safety: exact source slice, compare live preconditions, backup, checksum,
verify public response, rollback on any failure; no auth/paid/API changes.
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
BEGIN = b"  <!-- Cookie notice: optional analytics only by explicit choice; essential storage remains available. -->"
END = b"  <!-- Numi Insights v2: independent background collector -->"
LIVE_INSERT = b"  <!-- Numi Insights v2: independent background collector -->"
PAID_GUARD = b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31"
FOOTER = b"NUMI PRIVACY FOOTER: standalone document"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def get_public():
    req = Request(
        "https://" + DOMAIN + "/?cookie_release=" + str(time.time_ns()),
        headers={"Cache-Control": "no-cache", "User-Agent": "NumiCookieRelease/1.0"},
    )
    with urlopen(req, timeout=40) as response:
        if response.status != 200:
            raise RuntimeError("Live homepage did not return HTTP 200")
        return response.read(3_000_000)


def main():
    source = pathlib.Path("index.html").read_bytes()
    if source.count(BEGIN) != 1 or source.count(END) != 1:
        raise RuntimeError("Cookie block source markers differ")
    cookie = source.split(BEGIN, 1)[1].split(END, 1)[0]
    cookie = BEGIN + cookie
    for phrase in (b'id="numi-cookie-notice"', b'id="numi-cookie-essential"',
                   b'id="numi-cookie-all"', b'numi_analytics_permission',
                   b'href="/privacy.html"'):
        if phrase not in cookie:
            raise RuntimeError("Missing approved cookie control")
    if b"<script" not in cookie or b"</script>" not in cookie:
        raise RuntimeError("Missing consent interaction")
    if b"numi-insights-v2.js" in cookie:
        raise RuntimeError("Analytics loader must not be duplicated")

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=45)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    root = ftp.pwd().rstrip("/")
    site = root + "/www/" + DOMAIN
    index_path = site + "/index.html"
    guard_path = site + "/.htaccess"

    def read(path):
        out = io.BytesIO()
        ftp.retrbinary("RETR " + path, out.write)
        return out.getvalue()

    def put(path, data):
        ftp.storbinary("STOR " + path, io.BytesIO(data))
        if sha(read(path)) != sha(data):
            raise RuntimeError("FTPS uploaded bytes mismatch")

    try:
        old = read(index_path)
        old_guard = read(guard_path)
        if PAID_GUARD not in old_guard:
            raise RuntimeError("Production paid static guard unknown: refusing change")
        if FOOTER not in old or b'auth-profile.js' not in old or b'app.js' not in old:
            raise RuntimeError("Production homepage differs from expected structure")
        if old.count(b"</body>") != 1 or old.count(b"</html>") != 1:
            raise RuntimeError("Production HTML malformed or unrecognized")
        if old.count(b'id="numi-cookie-notice"') == 1 and BEGIN in old:
            if cookie not in old:
                raise RuntimeError("Existing cookie notice differs: refusing overwrite")
            if get_public() != old:
                raise RuntimeError("Existing cookie notice not yet publicly visible")
            print("NUMI_COOKIE_RELEASE success=true already_present=true live_verified=true", flush=True)
            return
        if b'id="numi-cookie-notice"' in old or BEGIN in old:
            raise RuntimeError("Unknown existing cookie notice: refusing duplicate")
        if old.count(LIVE_INSERT) == 1:
            new = old.replace(LIVE_INSERT, cookie + LIVE_INSERT, 1)
        else:
            # The existing optional analytics loader may have a different marker.
            new = old.replace(b"</body>", cookie + b"</body>", 1)
        if new.count(BEGIN) != 1 or new.count(b'id="numi-cookie-notice"') != 1:
            raise RuntimeError("Cookie insertion not unique")
        if new.replace(cookie, b"", 1) != old:
            raise RuntimeError("Non-cookie homepage content changed unexpectedly")

        backup_root = root + "/site-safeguard-backups"
        try:
            ftp.mkd(backup_root)
        except ftplib.error_perm:
            ftp.cwd(backup_root)
        backup = backup_root + "/cookie-consent-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        ftp.mkd(backup)
        put(backup + "/index.html.bak", old)
        print("NUMI_COOKIE_RELEASE backup_complete=true", flush=True)

        try:
            put(index_path, new)
            public = get_public()
            if sha(public) != sha(new):
                raise RuntimeError("Live homepage does not match published cookie release")
            if read(guard_path) != old_guard:
                raise RuntimeError("Paid guard changed unexpectedly")
            print("NUMI_COOKIE_RELEASE success=true live_verified=true cookie_visible_in_html=true", flush=True)
        except BaseException:
            try:
                put(index_path, old)
                print("NUMI_COOKIE_RELEASE rollback=true", flush=True)
            except BaseException:
                print("NUMI_COOKIE_RELEASE rollback_failed=true", flush=True)
            raise
    finally:
        try:
            ftp.quit()
        except BaseException:
            ftp.close()


if __name__ == "__main__":
    try:
        main()
    except BaseException as exc:
        print("NUMI_COOKIE_RELEASE success=false reason=" + type(exc).__name__, flush=True)
        sys.exit(1)
