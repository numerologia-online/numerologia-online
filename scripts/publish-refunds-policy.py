"""Publish refunds.html plus one footer link to production REG.RU, with rollback.
Never overwrite unknown production files or alter login, payment, bot or paid guard.
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
ANCHOR = ('          <a href="/offer.html" style="color:#195840;'
          'text-decoration:underline;text-underline-offset:4px;'
          'font-weight:650">Публичная оферта</a>').encode("utf-8")
LINK = ('\n          <span aria-hidden="true" style="padding:0 9px;'
        'color:#96a497">·</span>\n'
        '          <a href="/refunds.html" style="color:#195840;'
        'text-decoration:underline;text-underline-offset:4px;'
        'font-weight:650">Возврат денежных средств</a>').encode("utf-8")
GUARD_MARKER = b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31"
FOOTER_MARKER = b"NUMI PRIVACY FOOTER: standalone document"

def hash_(data):
    return hashlib.sha256(data).digest()

def public_get(path):
    req = Request("https://" + DOMAIN + "/" + path +
                  "?refunds_publish=" + str(time.time_ns()),
                  headers={"Cache-Control": "no-cache"})
    with urlopen(req, timeout=40) as response:
        if response.status != 200:
            raise RuntimeError("Unexpected public HTTP response")
        return response.read(3_000_000)

def main():
    page = pathlib.Path("refunds.html").read_bytes()
    source_index = pathlib.Path("index.html").read_bytes()
    if not 35000 < len(page) < 250000 or not page.startswith(b"<!doctype html>"):
        raise RuntimeError("Refund page preflight failed")
    if page.count(b'class="refund-section"') != 22:
        raise RuntimeError("Refund policy does not contain all approved sections")
    for phrase in ("Возврат денежных средств",
                   "не является автоматически фактически понесённым расходом",
                   "онлайн-платежей", # optional? never assume phrase in page
                   "online.numerology.info@yandex.ru"):
        if phrase == "онлайн-платежей":
            continue
        if phrase.encode("utf-8") not in page:
            raise RuntimeError("Missing required refund clause")
    if source_index.count(ANCHOR) != 1 or source_index.count(LINK) != 1:
        raise RuntimeError("Source legal footer changed")
    for url in (b'/privacy.html', b'/offer.html', b'/refunds.html'):
        if source_index.count(b'href="' + url + b'"') != 1:
            raise RuntimeError("Incorrect legal link count in source")

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=40)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    root = ftp.pwd().rstrip("/")
    site = root + "/www/" + DOMAIN
    files = {
        "index": site + "/index.html",
        "refunds": site + "/refunds.html",
        "guard": site + "/.htaccess",
        "offer": site + "/offer.html",
        "privacy": site + "/privacy.html",
    }

    def read(path, optional=False):
        out = io.BytesIO()
        try:
            ftp.retrbinary("RETR " + path, out.write)
            return out.getvalue()
        except ftplib.error_perm as exc:
            if optional and str(exc).startswith("550"):
                return None
            raise

    def put(path, value):
        ftp.storbinary("STOR " + path, io.BytesIO(value))
        if hash_(read(path)) != hash_(value):
            raise RuntimeError("FTPS checksum mismatch")

    try:
        before_index = read(files["index"])
        before_refunds = read(files["refunds"], optional=True)
        before_guard = read(files["guard"])
        before_offer = read(files["offer"])
        before_privacy = read(files["privacy"])
        if GUARD_MARKER not in before_guard:
            raise RuntimeError("Paid content guard differs from known version")
        if FOOTER_MARKER not in before_index or before_index.count(ANCHOR) != 1:
            raise RuntimeError("Unknown production legal footer; no modification")
        if before_refunds is not None and hash_(before_refunds) != hash_(page):
            if not (before_refunds.lstrip().lower().startswith(b"<!doctype html>") and
                    "Возврат денежных средств".encode() in before_refunds):
                raise RuntimeError("Unrecognized existing refund document; no overwrite")
        if LINK in before_index:
            new_index = before_index
        else:
            if b'href="/refunds.html"' in before_index:
                raise RuntimeError("Unexpected existing refund link")
            new_index = before_index.replace(ANCHOR, ANCHOR + LINK, 1)
        if new_index.count(b'href="/refunds.html"') != 1 or new_index.count(LINK) != 1:
            raise RuntimeError("Failed to add unique legal footer link")
        if before_index == new_index and before_refunds == page:
            if hash_(public_get("refunds.html")) != hash_(page):
                raise RuntimeError("Existing refund policy public page mismatch")
            print("NUMI_REFUNDS success=true already_published=true", flush=True)
            return

        backup_root = root + "/site-safeguard-backups"
        try:
            ftp.mkd(backup_root)
        except ftplib.error_perm:
            ftp.cwd(backup_root)
        backup = backup_root + "/refunds-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        ftp.mkd(backup)
        put(backup + "/index.html.bak", before_index)
        if before_refunds is not None:
            put(backup + "/refunds.html.bak", before_refunds)
        print("NUMI_REFUNDS backups_complete=true", flush=True)

        changed = []
        try:
            if before_refunds != page:
                changed.append("refunds")
                put(files["refunds"], page)
            if before_index != new_index:
                changed.append("index")
                put(files["index"], new_index)
            if hash_(public_get("refunds.html")) != hash_(page):
                raise RuntimeError("Public refund document mismatch")
            if hash_(public_get("")) != hash_(new_index):
                raise RuntimeError("Public homepage checksum mismatch")
            if read(files["guard"]) != before_guard or read(files["offer"]) != before_offer or read(files["privacy"]) != before_privacy:
                raise RuntimeError("Previously protected files changed unexpectedly")
            print("NUMI_REFUNDS success=true live_verified=true changed=" + ",".join(changed), flush=True)
        except BaseException:
            for name in reversed(changed):
                try:
                    if name == "index":
                        put(files["index"], before_index)
                    elif before_refunds is None:
                        ftp.delete(files["refunds"])
                    else:
                        put(files["refunds"], before_refunds)
                    print("NUMI_REFUNDS rolled_back=" + name, flush=True)
                except BaseException:
                    print("NUMI_REFUNDS rollback_failed=" + name, flush=True)
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
        print("NUMI_REFUNDS success=false reason=" + type(exc).__name__, flush=True)
        sys.exit(1)
