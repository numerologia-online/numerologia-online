"""Safely publish the public price list and one homepage footer link to REG.RU.
Only /prices.html and the new footer link in /index.html may change.
The existing index is patched in place and backed up outside public root.
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
MARKER = b"NUMI PUBLIC PRICE LIST 2026-11-03"
GUARD = b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31"
FOOTER_MARKER = b"NUMI PRIVACY FOOTER: standalone document"
ANCHOR = ('<a href="/offer.html" style="color:#195840;text-decoration:underline;'
          'text-underline-offset:4px;font-weight:650">Публичная оферта</a>').encode()
INSERT = ('\n          <span aria-hidden="true" style="padding:0 9px;color:#96a497">·</span>'
          '\n          <a href="/prices.html" style="color:#195840;text-decoration:underline;'
          'text-underline-offset:4px;font-weight:650">Стоимость и тарифы</a>').encode()
LINK = b'href="/prices.html"'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def http_read(path):
    url = "https://" + DOMAIN + "/" + path
    url += ("&" if "?" in url else "?") + "numi_prices=" + str(time.time_ns())
    request = Request(url, headers={"Cache-Control": "no-cache"})
    with urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError("HTTP status is not 200")
        return response.read(3_000_000)

def main():
    prices = pathlib.Path("prices.html").read_bytes()
    source_home = pathlib.Path("index.html").read_bytes()
    if MARKER not in prices or len(prices) < 6000:
        raise RuntimeError("Public prices source not recognized")
    if prices.count(b'<h1>') != 1 or prices.count(b'href="/contacts.html"') != 1:
        raise RuntimeError("Incomplete public prices page")
    for phrase in ("990 ₽", "490 ₽", "50 ₽", "25 ₽", "19 ₽", "79 ₽",
                   "ИП Чалынина Татьяна Олеговна", "633011166908"):
        if phrase.encode() not in prices:
            raise RuntimeError("A verified price or business detail is absent")
    if source_home.count(ANCHOR) != 1 or source_home.count(LINK) != 1:
        raise RuntimeError("Local homepage footer incomplete")
    if (ANCHOR + INSERT) not in source_home:
        raise RuntimeError("Source footer link is not the approved patch")
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=45)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    root = ftp.pwd().rstrip("/")
    site = root + "/www/" + DOMAIN
    paths = {
        "index": site + "/index.html",
        "prices": site + "/prices.html",
        "guard": site + "/.htaccess",
        "offer": site + "/offer.html",
    }

    def read(path, optional=False):
        buffer = io.BytesIO()
        try:
            ftp.retrbinary("RETR " + path, buffer.write)
            return buffer.getvalue()
        except ftplib.error_perm as error:
            if optional and str(error).startswith("550"):
                return None
            raise

    def write(path, content):
        ftp.storbinary("STOR " + path, io.BytesIO(content))
        if sha(read(path)) != sha(content):
            raise RuntimeError("FTP upload verification mismatch")

    try:
        before = {
            "index": read(paths["index"]),
            "prices": read(paths["prices"], optional=True),
            "guard": read(paths["guard"]),
            "offer": read(paths["offer"]),
        }
        if GUARD not in before["guard"] or FOOTER_MARKER not in before["index"]:
            raise RuntimeError("Paid guard or known footer marker missing; refuse to change")
        if before["index"].count(ANCHOR) != 1:
            raise RuntimeError("Live footer does not match known anchor")
        if before["prices"] is not None and MARKER not in before["prices"]:
            raise RuntimeError("Unknown existing prices page; refuse to overwrite")
        if before["index"].count(LINK) > 1:
            raise RuntimeError("Duplicate price footer links")

        if LINK in before["index"]:
            if before["index"].count(ANCHOR + INSERT) != 1:
                raise RuntimeError("Unknown existing price link; refuse to overwrite")
            new_index = before["index"]
        else:
            new_index = before["index"].replace(ANCHOR, ANCHOR + INSERT, 1)
        if new_index.count(LINK) != 1:
            raise RuntimeError("Failed to add a single price link")

        if before["prices"] == prices and before["index"] == new_index:
            if sha(http_read("prices.html")) != sha(prices):
                raise RuntimeError("Price page exists on FTP but public HTTP differs")
            print("NUMI_PUBLIC_PRICES success=true already_published=true live_verified=true", flush=True)
            return

        backup_root = root + "/site-safeguard-backups"
        try:
            ftp.mkd(backup_root)
        except ftplib.error_perm:
            ftp.cwd(backup_root)
        folder = backup_root + "/public-price-list-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        ftp.mkd(folder)
        write(folder + "/index.html.bak", before["index"])
        if before["prices"] is not None:
            write(folder + "/prices.html.bak", before["prices"])
        print("NUMI_PUBLIC_PRICES backup=true", flush=True)

        changed = []
        try:
            if before["prices"] != prices:
                changed.append("prices")
                write(paths["prices"], prices)
            if before["index"] != new_index:
                changed.append("index")
                write(paths["index"], new_index)
            if sha(http_read("prices.html")) != sha(prices):
                raise RuntimeError("Public price page HTTP mismatch")
            if sha(http_read("")) != sha(new_index):
                raise RuntimeError("Public homepage HTTP mismatch")
            if read(paths["guard"]) != before["guard"] or read(paths["offer"]) != before["offer"]:
                raise RuntimeError("Protected file changed during publication")
            print("NUMI_PUBLIC_PRICES success=true live_verified=true changed=" + ",".join(changed), flush=True)
        except BaseException:
            for name in reversed(changed):
                try:
                    if name == "prices" and before["prices"] is None:
                        ftp.delete(paths["prices"])
                    else:
                        write(paths[name], before[name])
                    print("NUMI_PUBLIC_PRICES rollback=" + name, flush=True)
                except BaseException:
                    print("NUMI_PUBLIC_PRICES rollback_failed=" + name, flush=True)
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
        print("NUMI_PUBLIC_PRICES success=false reason=" + type(error).__name__ + ":" + str(error)[:150], flush=True)
        sys.exit(1)
