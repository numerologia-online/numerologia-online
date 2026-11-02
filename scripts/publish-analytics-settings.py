"""Publish standalone analytics settings and consent guards into six REG.RU pages.
Exact in-place HTML string patches preserve any unrelated production changes.
FTPS backups are made outside public root. Any upload failure triggers rollback.
No analytics backend, MySQL, private account, payments, API or paid content edits.
"""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import ssl
import sys
import time
from urllib.request import Request, urlopen

HOST = "server172.hosting.reg.ru"
DOMAIN = "xn--c1adkkdfjbp1a4l.online"
GUARD = b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31"
FOOTER = b"NUMI PRIVACY FOOTER: standalone document"
LEGAL = ("privacy.html", "offer.html", "refunds.html",
         "terms.html", "disclaimer.html")

def checksum(data):
    return hashlib.sha256(data).digest()

def http_get(path):
    url = "https://" + DOMAIN + "/" + path
    url += "?analytics_preferences_release=" + str(time.time_ns())
    req = Request(url, headers={"Cache-Control": "no-cache"})
    with urlopen(req, timeout=40) as response:
        if response.status != 200:
            raise RuntimeError("HTTP verification failed for " + path)
        return response.read(3_000_000)

def main():
    manifest = json.loads(
        pathlib.Path("scripts/analytics-settings-patches.json").read_text("utf-8"))
    changes = manifest["changes"]
    expected = {"index.html", "year/index.html", "pro/index.html",
                "child/index.html", "moment/index.html",
                "moment/yes-no/index.html"}
    if set(changes) != expected:
        raise RuntimeError("Unexpected analytics preference manifest")
    settings_page = pathlib.Path("analytics-settings.html").read_bytes()
    if not settings_page.startswith(b"<!doctype html>"):
        raise RuntimeError("Invalid settings document")
    for phrase in ("numi_analytics_permission", "analytics-allow",
                   "analytics-deny", "online.numerology.info@yandex.ru"):
        if phrase.encode("utf-8") not in settings_page:
            raise RuntimeError("Missing settings page behavior")
    for path, rules in changes.items():
        if path.count("/") > 2 or ".." in pathlib.PurePosixPath(path).parts:
            raise RuntimeError("Unsafe manifest path")
        if len(rules) != (2 if path == "index.html" else 1):
            raise RuntimeError("Invalid patch count")
        src = pathlib.Path(path).read_bytes()
        for before, after in rules:
            if not before or before == after or src.count(after.encode("utf-8")) != 1:
                raise RuntimeError("Unrecognized source patch for " + path)
        if b"numi_analytics_permission" not in src:
            raise RuntimeError("Analytics guard missing in source " + path)
    if pathlib.Path("index.html").read_bytes().count(b'href="/analytics-settings.html"') != 1:
        raise RuntimeError("Settings footer link missing")

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=40)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    home = ftp.pwd().rstrip("/")
    site = home + "/www/" + DOMAIN

    def get(path, optional=False):
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
        if checksum(get(path)) != checksum(value):
            raise RuntimeError("FTPS checksum mismatch")

    try:
        protected = {n: get(site + "/" + n) for n in LEGAL + (".htaccess",)}
        if GUARD not in protected[".htaccess"]:
            raise RuntimeError("Existing paid-content guard not found")
        original = {n: get(site + "/" + n) for n in expected}
        old_settings = get(site + "/analytics-settings.html", optional=True)
        if FOOTER not in original["index.html"]:
            raise RuntimeError("Unexpected live homepage")
        if old_settings is not None and old_settings != settings_page:
            if not (old_settings.lstrip().lower().startswith(b"<!doctype html>") and
                    "Настройки аналитики".encode() in old_settings):
                raise RuntimeError("Unknown existing analytics settings; no overwrite")

        new = {}
        for name in expected:
            page = original[name]
            for before, after in changes[name]:
                before_b = before.encode("utf-8")
                after_b = after.encode("utf-8")
                if page.count(after_b) == 1:
                    continue
                if page.count(before_b) != 1 or page.count(after_b) != 0:
                    raise RuntimeError("Live HTML changed near approved patch: " + name)
                page = page.replace(before_b, after_b, 1)
            if page.count(b"numi_analytics_permission") != 1:
                raise RuntimeError("Guard missing or duplicated: " + name)
            new[name] = page
        if new["index.html"].count(b'href="/analytics-settings.html"') != 1:
            raise RuntimeError("Footer missing setting link")
        if new["index.html"].count(b'href="/disclaimer.html"') != 1:
            raise RuntimeError("Footer legal documents changed")
        planned = sorted(n for n in expected if new[n] != original[n])
        if old_settings != settings_page:
            planned.append("analytics-settings.html")
        if not planned:
            if checksum(http_get("analytics-settings.html")) != checksum(settings_page):
                raise RuntimeError("Existing setting document differs from public page")
            print("ANALYTICS_PREFERENCES success=true already_published=true")
            return

        backups = home + "/site-safeguard-backups"
        try:
            ftp.mkd(backups)
        except ftplib.error_perm:
            ftp.cwd(backups)
        target = backups + "/analytics-preferences-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        ftp.mkd(target)
        for index, name in enumerate(planned):
            before = old_settings if name == "analytics-settings.html" else original[name]
            if before is not None:
                put(target + "/" + str(index).zfill(2) + ".bak", before)
        print("ANALYTICS_PREFERENCES backups_complete=true count=" + str(len(planned)), flush=True)

        uploaded = []
        try:
            order = (["analytics-settings.html"] if "analytics-settings.html" in planned else [])
            order += [n for n in planned if n not in ("index.html","analytics-settings.html")]
            if "index.html" in planned: order.append("index.html")
            for name in order:
                target_path = site + "/" + name
                before = old_settings if name == "analytics-settings.html" else original[name]
                if get(target_path, optional=(before is None)) != before:
                    raise RuntimeError("Live file changed concurrently: " + name)
                uploaded.append(name)
                put(target_path, settings_page if name == "analytics-settings.html" else new[name])
            for name in order:
                wanted = settings_page if name == "analytics-settings.html" else new[name]
                public_path = "" if name == "index.html" else name
                if checksum(http_get(public_path)) != checksum(wanted):
                    raise RuntimeError("Public content differs from approved result: " + name)
            for name, value in protected.items():
                if get(site + "/" + name) != value:
                    raise RuntimeError("Protected legal/security file changed during publication")
            print("ANALYTICS_PREFERENCES success=true live_verified=true files=" + ",".join(order), flush=True)
        except BaseException:
            for name in reversed(uploaded):
                target_path = site + "/" + name
                before = old_settings if name == "analytics-settings.html" else original[name]
                try:
                    if before is None:
                        ftp.delete(target_path)
                    else:
                        put(target_path, before)
                    print("ANALYTICS_PREFERENCES rollback=" + name, flush=True)
                except BaseException:
                    print("ANALYTICS_PREFERENCES rollback_failed=" + name, flush=True)
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
        print("ANALYTICS_PREFERENCES success=false reason=" + str(error)[:250], flush=True)
        sys.exit(1)
