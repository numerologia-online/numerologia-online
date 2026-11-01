"""One-time guarded Red Flag repair on REG.RU. All existing files are backed up."""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import re
import ssl
import sys
import time
import urllib.request
import urllib.error

HOST = "server172.hosting.reg.ru"
DOMAIN = "xn--c1adkkdfjbp1a4l.online"
VERSION = "20261101fix1"
ROOT = pathlib.Path(__file__).resolve().parents[2]

def log(**values):
    print(json.dumps(values, ensure_ascii=False), flush=True)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def replace_once(data, pattern, replacement, label):
    text = data.decode("utf-8")
    updated, count = re.subn(pattern, replacement, text)
    if count != 1:
        raise RuntimeError(label + ": expected exactly one import, found " + str(count))
    return updated.encode("utf-8")

def http_get(path):
    req = urllib.request.Request("https://" + DOMAIN + "/" + path,
                                 headers={"User-Agent":"numi-redflag-release/1.0",
                                          "Cache-Control":"no-cache"})
    with urllib.request.urlopen(req, timeout=25) as response:
        if response.status != 200:
            raise RuntimeError(path + " HTTP " + str(response.status))
        return response.read(900000)

def check_api_denies_anonymous():
    data = json.dumps({"init_data":"","path":"data/redflag/banks/love.json"}).encode("utf-8")
    req = urllib.request.Request("https://" + DOMAIN + "/api/numi-redflag-content.php",
                                 data=data, headers={"Content-Type":"application/json",
                                 "Origin":"https://" + DOMAIN, "User-Agent":"numi-redflag-release/1.0"})
    try:
        response = urllib.request.urlopen(req, timeout=25)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = json.loads(response.read(2000))
        if response.status != 401 or body.get("ok") is not False:
            raise RuntimeError("Private answer endpoint does not deny anonymous requests")

def main():
    # First validate release files and ensure only the FIRST FREE question holds public answer variants.
    meta = (ROOT / "redflag-public-catalog.js").read_text("utf-8")
    if meta.count('"variants"') != 6 or "PUBLIC_QUESTIONS" not in meta:
        raise RuntimeError("Public metadata audit failed")
    text_bank = (ROOT / "redflag-text-bank.js").read_text("utf-8")
    if "/api/numi-redflag-content.php" not in text_bank or "privateQuestion" not in text_bank:
        raise RuntimeError("Private routing missing")
    new_content = {
        "redflag-public-catalog.js": (ROOT / "redflag-public-catalog.js").read_bytes(),
        "redflag-text-bank.js": (ROOT / "redflag-text-bank.js").read_bytes(),
        "redflag-categories.js": (ROOT / "redflag-categories.js").read_bytes(),
        "data/redflag/money/gift.json": (ROOT / "data/redflag/money/gift.json").read_bytes(),
        "data/redflag/love/first-step.json": (ROOT / "data/redflag/love/first-step.json").read_bytes(),
    }
    for name in ("data/redflag/money/gift.json", "data/redflag/love/first-step.json"):
        obj = json.loads(new_content[name])
        if obj.get("questionId") not in ("gift", "first-step") or not isinstance(obj.get("entries"), dict):
            raise RuntimeError("Unexpected free-answer payload: " + name)
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=25)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    home = ftp.pwd().rstrip("/")
    site = home + "/www/" + DOMAIN
    backup = home + "/site-safeguard-backups/redflag-fix-" + str(int(time.time()))
    originals = {}
    installed = []

    def mkdir(remote):
        current = ""
        for part in pathlib.PurePosixPath(remote).parts:
            if part == "/":
                continue
            current += "/" + part
            try:
                ftp.mkd(current)
            except ftplib.error_perm as error:
                if not str(error).startswith("550"):
                    raise

    def read(remote, limit=1500000):
        buff = io.BytesIO()
        def accumulate(chunk):
            if buff.tell() + len(chunk) > limit:
                raise RuntimeError("Unexpected file size " + remote)
            buff.write(chunk)
        ftp.retrbinary("RETR " + remote, accumulate)
        return buff.getvalue()

    def write(remote, payload):
        mkdir(str(pathlib.PurePosixPath(remote).parent))
        ftp.storbinary("STOR " + remote, io.BytesIO(payload))
        if digest(read(remote)) != digest(payload):
            raise RuntimeError("Upload verification failed " + remote)
        try:
            ftp.sendcmd("SITE CHMOD 644 " + remote)
        except ftplib.error_perm:
            pass

    def get_optional(remote):
        try:
            return read(remote)
        except ftplib.error_perm as error:
            if str(error).startswith("550"):
                return None
            raise

    try:
        # Fetch actual live source and change ONLY module version imports.
        current = {}
        for name in ("index.html", "app.js", "redflag-feature.js"):
            current[name] = read(site + "/" + name)
        new_content["redflag-feature.js"] = replace_once(
            current["redflag-feature.js"],
            r'(?P<a>["\x27]\./redflag-categories\.js\?v=)[^"\x27]+(?P<b>["\x27])',
            lambda m: m.group("a") + VERSION + m.group("b"),
            "Red Flag category import")
        new_content["app.js"] = replace_once(
            current["app.js"],
            r'(?P<a>["\x27]\./redflag-feature\.js\?v=)[^"\x27]+(?P<b>["\x27])',
            lambda m: m.group("a") + VERSION + m.group("b"),
            "Red Flag feature import")
        new_content["index.html"] = replace_once(
            current["index.html"],
            r'(?P<a>["\x27]app\.js\?v=)[^"\x27]+(?P<b>["\x27])',
            lambda m: m.group("a") + VERSION + m.group("b"),
            "main app import")

        # Verify protected endpoint before changing anything.
        check_api_denies_anonymous()
        # Back up every overwritten file before uploading.
        for name in new_content:
            old = get_optional(site + "/" + name)
            originals[name] = old
            if old is not None:
                write(backup + "/" + name, old)
        log(backup_completed=True, files=len(new_content),
            live_source_preserved=True, auth_boundary_verified=True)
        # Upload isolated code and explicit free first answers first, switch the
        # feature imports and home page last. Do not touch any other section.
        ordered = ["redflag-public-catalog.js", "redflag-text-bank.js",
                   "redflag-categories.js", "data/redflag/money/gift.json",
                   "data/redflag/love/first-step.json",
                   "redflag-feature.js", "app.js", "index.html"]
        for name in ordered:
            write(site + "/" + name, new_content[name])
            installed.append(name)
        if VERSION.encode() not in http_get("index.html"):
            raise RuntimeError("Live home page still points to old app version")
        for name in ("redflag-public-catalog.js", "redflag-text-bank.js", "redflag-categories.js"):
            if digest(http_get(name)) != digest(new_content[name]):
                raise RuntimeError("Live HTTP and FTPS release differ: " + name)
        for name in ("data/redflag/money/gift.json", "data/redflag/love/first-step.json"):
            data = json.loads(http_get(name))
            if not data.get("entries"):
                raise RuntimeError("Live free answer unavailable: " + name)
        check_api_denies_anonymous()
        log(published=True, live_verified=True, private_answers_protected=True,
            categories=8, questions=81, release=VERSION)
        ftp.quit()
    except Exception as error:
        log(deployment_error=type(error).__name__,
            reason=str(error) if isinstance(error,RuntimeError) else "")
        for name in reversed(installed):
            old = originals.get(name)
            try:
                if old is None:
                    ftp.delete(site + "/" + name)
                else:
                    write(site + "/" + name, old)
            except Exception:
                log(rollback_failed=name)
        raise
if __name__ == "__main__":
    main()
