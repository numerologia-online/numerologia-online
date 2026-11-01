"""Safely publish only the 100-question directory readability CSS + cache-bust."""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import re
import ssl
import subprocess
import sys
import time
import urllib.request

HOST = "server172.hosting.reg.ru"
DOMAIN = "xn--c1adkkdfjbp1a4l.online"
PAGE = "moment/yes-no"
OLD_CSS_BLOB = "8e7abb0deeeb3bf80cac3a51c17f6fc8a2b04bfb"
CSS_VERSION = b'./yes-no.css?v=7'
OLD_CSS_VERSION = b'./yes-no.css?v=6'

def checksum(data):
    return hashlib.sha256(data).hexdigest()

def log(**kwargs):
    print("YESNO_READABILITY " + json.dumps(kwargs, ensure_ascii=False, sort_keys=True), flush=True)

def get_public(filename):
    url = "https://" + DOMAIN + "/" + PAGE + "/" + filename + "?readability_release=" + str(time.time_ns())
    request = urllib.request.Request(url, headers={"Cache-Control":"no-cache", "Pragma":"no-cache", "User-Agent":"numi-yesno-qa/1.0"})
    with urllib.request.urlopen(request, timeout=35) as response:
        if response.status != 200:
            raise RuntimeError("Unexpected public response: " + filename)
        return response.read(1000000)

def main():
    new_css = pathlib.Path(PAGE, "yes-no.css").read_bytes()
    expected_old_css = subprocess.check_output(["git", "show", OLD_CSS_BLOB])
    source_html = pathlib.Path(PAGE, "index.html").read_bytes()
    if source_html.count(CSS_VERSION) != 1 or source_html.count(b'yn-category-list') < 1:
        raise RuntimeError("New source HTML does not reference the compact-height card styling")
    if (b'background:#f6f5ef;color:#143d30' not in new_css or b'min-height:32px;border-right:0' not in new_css or b'.yn-topic{grid-template-columns:29px minmax(0,1fr) 14px;gap:9px;border-radius:12px;padding:8px 12px;min-height:56px}' not in new_css or b'min-height:51px' not in new_css or b'.yn-back-top{display:flex' not in new_css or b'width:60%;min-width:205px;max-width:300px' not in new_css or b'background:#f3e8d3;color:#143d30' not in new_css):
        raise RuntimeError("Expected compact mobile row styling is absent")
    if new_css.count(b'{') != new_css.count(b'}'):
        raise RuntimeError("CSS syntax braces differ")

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=35)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    root = ftp.pwd().rstrip("/")
    site = root + "/www/" + DOMAIN + "/" + PAGE
    backupdir = root + "/site-safeguard-backups/yesno-readability-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    changed = []
    original = {}

    def read(path):
        buffer = io.BytesIO()
        ftp.retrbinary("RETR " + path, buffer.write)
        return buffer.getvalue()

    def write(path, content):
        ftp.storbinary("STOR " + path, io.BytesIO(content))
        if checksum(read(path)) != checksum(content):
            raise RuntimeError("FTPS readback mismatch: " + path)

    try:
        original["index.html"] = read(site + "/index.html")
        original["yes-no.css"] = read(site + "/yes-no.css")
        live_html = original["index.html"]
        live_css = original["yes-no.css"]
        if live_css not in (expected_old_css, new_css):
            raise RuntimeError("Live stylesheet has independent edits; refusing to overwrite")
        if live_html.count(OLD_CSS_VERSION) == 1 and live_html.count(CSS_VERSION) == 0:
            target_html = live_html.replace(OLD_CSS_VERSION, CSS_VERSION, 1)
        elif live_html.count(CSS_VERSION) == 1 and live_html.count(OLD_CSS_VERSION) == 0:
            target_html = live_html
        else:
            raise RuntimeError("Unexpected live CSS version; refusing unrelated HTML edits")
        old_back = '<button id="yn-all" type="button" class="yn-back-top">← Назад к выбору темы</button>'.encode("utf-8")
        new_back = '<button id="yn-all" type="button" class="yn-back-top">← Назад к темам</button>'.encode("utf-8")
        if target_html.count(old_back) == 1 and target_html.count(new_back) == 0:
            target_html = target_html.replace(old_back, new_back, 1)
        elif target_html.count(new_back) != 1 or target_html.count(old_back) != 0:
            raise RuntimeError("Unexpected live Back button; refusing unrelated HTML edits")
        if source_html.count(new_back) != 1:
            raise RuntimeError("New source Back button not present")
        if live_html.count(b'yn-category-list') < 1:
            raise RuntimeError("Live page is not seven-topic directory")
        try:
            ftp.mkd(root + "/site-safeguard-backups")
        except ftplib.error_perm:
            pass
        ftp.mkd(backupdir)
        write(backupdir + "/index.html.bak", live_html)
        write(backupdir + "/yes-no.css.bak", live_css)
        log(backup_ok=True, only_yesno_files=True, backup=backupdir.rsplit("/", 1)[-1])

        targets = [("yes-no.css", new_css), ("index.html", target_html)]
        try:
            for name, data in targets:
                if original[name] != data:
                    write(site + "/" + name, data)
                    changed.append(name)
            for name, data in targets:
                if checksum(get_public(name)) != checksum(data):
                    raise RuntimeError("Public site differs from released " + name)
            log(success=True, public_verified=True, changed=changed, css_version=7,
                questions_unchanged=True, navigation_unchanged=True)
        except BaseException:
            for name in reversed(changed):
                try:
                    write(site + "/" + name, original[name])
                except BaseException as error:
                    log(rollback_failed=name, error=type(error).__name__)
            log(rollback_attempted=True)
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
        log(success=False, error=type(error).__name__, reason=str(error)[:300])
        sys.exit(1)
