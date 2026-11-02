"""Publish approved offer.html and ONE new homepage footer link on REG.RU.

Preflight: validate the 25-section offer, exact homepage anchor and paid-content guard.
Release: back up affected files outside public root; only write offer.html/index.html;
verify bytes through HTTPS; roll back on failure.
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
ANCHOR = ('          <a href="/privacy.html" style="color:#195840;'
          'text-decoration:underline;text-underline-offset:4px;'
          'font-weight:650">Политика конфиденциальности</a>').encode("utf-8")
FOOTER_LINK = ('\n          <span aria-hidden="true" '
               'style="padding:0 9px;color:#96a497">·</span>\n'
               '          <a href="/offer.html" style="color:#195840;'
               'text-decoration:underline;text-underline-offset:4px;'
               'font-weight:650">Публичная оферта</a>').encode("utf-8")
PAID_GUARD = b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31"
PRIVACY_MARKER = b"NUMI PRIVACY FOOTER: standalone document"

def sha(data):
    return hashlib.sha256(data).digest()

def http_read(path):
    url = "https://" + DOMAIN + "/" + path
    url += ("&" if "?" in url else "?") + "offer_release=" + str(time.time_ns())
    req = Request(url, headers={"Cache-Control": "no-cache"})
    with urlopen(req, timeout=40) as res:
        if res.status != 200:
            raise RuntimeError("Public website returned unexpected HTTP status")
        return res.read(3_000_000)

def main():
    page = pathlib.Path("offer.html").read_bytes()
    home = pathlib.Path("index.html").read_bytes()
    if not 40000 < len(page) < 200000 or not page.startswith(b"<!doctype html>"):
        raise RuntimeError("Offer document unexpectedly empty or altered")
    if page.count(b'class="offer-section"') != 25:
        raise RuntimeError("Offer sections incomplete")
    for phrase in ("индивидуальный перерасчёт", "ЮKassa",
                   "online.numerology.info@yandex.ru", "633011166908",
                   "не превращаются автоматически в задолженность"):
        if phrase.encode("utf-8") not in page:
            raise RuntimeError("Approved offer content is missing")
    if home.count(ANCHOR) != 1 or home.count(FOOTER_LINK) != 1:
        raise RuntimeError("Approved homepage footer missing")
    if home.count(b'href="/offer.html"') != 1 or home.count(b'href="/privacy.html"') != 1:
        raise RuntimeError("Duplicate or missing legal link")

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=40)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    root = ftp.pwd().rstrip("/")
    site = root + "/www/" + DOMAIN
    files = {
        "offer": site + "/offer.html",
        "index": site + "/index.html",
        "guard": site + "/.htaccess",
        "privacy": site + "/privacy.html",
    }

    def get(path, optional=False):
        out = io.BytesIO()
        try:
            ftp.retrbinary("RETR " + path, out.write)
            return out.getvalue()
        except ftplib.error_perm as error:
            if optional and str(error).startswith("550"):
                return None
            raise

    def put(path, value):
        ftp.storbinary("STOR " + path, io.BytesIO(value))
        if sha(get(path)) != sha(value):
            raise RuntimeError("Uploaded file checksum mismatch")

    try:
        old_index = get(files["index"])
        old_offer = get(files["offer"], optional=True)
        old_guard = get(files["guard"])
        old_privacy = get(files["privacy"])
        if PAID_GUARD not in old_guard:
            raise RuntimeError("Existing paid-content protection not verified")
        if PRIVACY_MARKER not in old_index or old_index.count(ANCHOR) != 1:
            raise RuntimeError("Unknown live homepage: privacy footer missing")
        if old_offer is not None and sha(old_offer) != sha(page):
            if not (old_offer.lstrip().lower().startswith(b"<!doctype html>") and
                    "Публичная оферта".encode("utf-8") in old_offer):
                raise RuntimeError("Unrecognized live offer; no overwrite")
        if FOOTER_LINK in old_index:
            new_index = old_index
        else:
            if b'href="/offer.html"' in old_index:
                raise RuntimeError("Unknown existing offer link; refusing overwrite")
            new_index = old_index.replace(ANCHOR, ANCHOR + FOOTER_LINK, 1)
        if new_index.count(FOOTER_LINK) != 1 or new_index.count(b'href="/offer.html"') != 1:
            raise RuntimeError("Footer insertion failed")
        if old_index == new_index and old_offer == page:
            if sha(http_read("offer.html")) != sha(page):
                raise RuntimeError("Previously published offer not reachable")
            print("NUMI_OFFER_RELEASE success=true already_published=true", flush=True)
            return

        backup_root = root + "/site-safeguard-backups"
        try:
            ftp.mkd(backup_root)
        except ftplib.error_perm:
            ftp.cwd(backup_root)
        backup = backup_root + "/offer-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        ftp.mkd(backup)
        put(backup + "/index.html.bak", old_index)
        if old_offer is not None:
            put(backup + "/offer.html.bak", old_offer)
        print("NUMI_OFFER_RELEASE backup_complete=true", flush=True)

        changed = []
        try:
            if old_offer != page:
                changed.append("offer")
                put(files["offer"], page)
            if old_index != new_index:
                changed.append("index")
                put(files["index"], new_index)
            if sha(http_read("offer.html")) != sha(page):
                raise RuntimeError("Published offer does not match approved page")
            if sha(http_read("")) != sha(new_index):
                raise RuntimeError("Published homepage differs from patched version")
            if get(files["guard"]) != old_guard or get(files["privacy"]) != old_privacy:
                raise RuntimeError("Protected existing file unexpectedly changed")
            print("NUMI_OFFER_RELEASE success=true live_verified=true files=" + ",".join(changed), flush=True)
        except BaseException:
            for target in reversed(changed):
                try:
                    if target == "index":
                        put(files["index"], old_index)
                    elif old_offer is None:
                        ftp.delete(files["offer"])
                    else:
                        put(files["offer"], old_offer)
                    print("NUMI_OFFER_RELEASE rollback=" + target, flush=True)
                except BaseException:
                    print("NUMI_OFFER_RELEASE rollback_failed=" + target, flush=True)
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
        print("NUMI_OFFER_RELEASE success=false reason=" + type(error).__name__, flush=True)
        sys.exit(1)
