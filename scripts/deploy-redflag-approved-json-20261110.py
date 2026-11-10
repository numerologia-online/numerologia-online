"""Guarded release of the existing 366-date paid Red Flag question on REG.RU.

Changes only reviewed existing files. Never creates products or database tables.
Verifies the exact source diff, backs up each live file outside webroot, deploys
private material before enabling the public question, checks HTTPS and rolls
back every touched file if any verification fails. No payment is executed.
"""
import calendar
import copy
import ftplib
import hashlib
import io
import json
import os
from pathlib import Path
import re
import ssl
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

HOST = "server172.hosting.reg.ru"
NEW_DOMAIN = "xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD_DOMAIN = "xn--c1adkkdfjbp1a4l.online"
BASE_REF = "ed0e492039a3c51046ce92ae0fe6de8917296142"
BANK = "data/redflag/money/comic-verdict.json"
MANIFEST = "account-service/private/store-assets.json"
PRIVATE_CATALOG = "account-service/private/redflag-catalog.json"
BACKEND = "account-service/private/fulfillment.php"
PUBLIC_CATALOG = "redflag-public-catalog.js"
TAG_OLD = "redflag-catalog-refresh-20261109b"
TAG_NEW = "redflag-comic-ready-366-20261110"
OLD_SHA = "a914e1965c9a3d332859389704ed1453c35f87113d0e2a2a7b1b688d08dad524"
NEW_SHA = "31455bdb58687784b2887ebd1be98f3d5cd33966991777c396ed6ef04fd5050f"
PUBLIC = [
    PUBLIC_CATALOG, "redflag-text-bank.js", "redflag-categories.js",
    "redflag-feature.js", "app.js", "index.html",
]
FILES = [BANK, MANIFEST, PRIVATE_CATALOG, BACKEND, *PUBLIC]
LIMIT = 950_000


def git_base(path):
    return subprocess.check_output(
        ["git", "show", BASE_REF + ":" + path], timeout=40
    )


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def replace_once(raw, old, new, name):
    if raw.count(old) != 1:
        raise RuntimeError("UNEXPECTED_SOURCE_BASELINE:" + name)
    return raw.replace(old, new, 1)


def validate():
    old = {name: git_base(name) for name in FILES}
    new = {name: Path(name).read_bytes() for name in FILES}
    for name in FILES:
        if not old[name] or not new[name] or max(len(old[name]), len(new[name])) > LIMIT:
            raise RuntimeError("INVALID_SOURCE:" + name)
    before, after = json.loads(old[BANK]), json.loads(new[BANK])
    date_keys = {f"{d}-{m}" for m in range(1, 13)
                 for d in range(1, calendar.monthrange(2024, m)[1] + 1)}
    if (len(date_keys) != 366 or set(before["entries"]) != date_keys
            or before["entries"] != after["entries"]
            or len(set(after["entries"].values())) != 366
            or any(not isinstance(s, str) or len(s.strip()) <= 200
                   for s in after["entries"].values())):
        raise RuntimeError("APPROVED_366_ANSWERS_CHANGED_OR_INVALID")
    expected = dict(before)
    expected["section"] = "money"
    expected["question"] = "😂 Шуточный вердикт"
    expected["status"] = "ready"
    if before.get("status") is not None or after != expected:
        raise RuntimeError("UNEXPECTED_BANK_METADATA_EDIT")
    index = json.loads(Path("data/redflag/banks/money-questions.json").read_bytes())
    question = [q for q in index["questions"] if q["id"] == "comic-verdict-money"]
    if (len(question) != 1 or question[0]["title"] != expected["question"]
            or question[0]["priceRub"] != 49
            or question[0]["textFile"].split("?")[0] != "money/comic-verdict.json"):
        raise RuntimeError("EXISTING_PRICE_OR_QUESTION_INDEX_CHANGED")
    registry = json.loads(Path("store-catalog.json").read_bytes())
    if sum(q["id"] == "comic-verdict-money" and q["category"] == "money"
           for q in registry["redflag"]) != 1:
        raise RuntimeError("EXISTING_PRODUCT_NOT_REGISTERED")
    if sha(old[BANK]) != OLD_SHA or sha(new[BANK]) != NEW_SHA:
        raise RuntimeError("BANK_HASH_MISMATCH")

    old_manifest = json.loads(old[MANIFEST])
    new_manifest = json.loads(new[MANIFEST])
    if old_manifest["files"].get(BANK) != OLD_SHA or new_manifest["files"].get(BANK) != NEW_SHA:
        raise RuntimeError("BANK_MANIFEST_VERSION_MISMATCH")
    compare = copy.deepcopy(old_manifest)
    compare["files"][BANK] = NEW_SHA
    if compare != new_manifest:
        raise RuntimeError("UNRELATED_STORE_ASSET_CHANGED")

    old_private = json.loads(old[PRIVATE_CATALOG])
    new_private = json.loads(new[PRIVATE_CATALOG])
    compare = copy.deepcopy(old_private)
    meta = compare["questions"]["money"]["comic-verdict-money"]
    if meta != {"tier": 49, "free": False, "ready": False}:
        raise RuntimeError("UNEXPECTED_PRIVATE_CATALOG_BASELINE")
    meta["ready"] = True
    if compare != new_private:
        raise RuntimeError("UNRELATED_PRIVATE_CATALOG_CHANGE")
    old_read = "$data=naMaterialJson('data/redflag/'.$m[1].'/'.$m[2].'.json',$root);".encode()
    new_read = ("$bankFile=($m[1]==='money'&&$m[2]==='comic-verdict-money')?'comic-verdict':$m[2];\n"
                "        $data=naMaterialJson('data/redflag/'.$m[1].'/'.$bankFile.'.json',$root);").encode()
    if new[BACKEND] != replace_once(old[BACKEND], old_read, new_read, BACKEND):
        raise RuntimeError("UNRELATED_PHP_FULFILLMENT_CHANGE")

    segment = ('"id": "comic-verdict-money",\n'
               '      "title": "😂 Шуточный вердикт",\n'
               '      "priceRub": 49,\n'
               '      "status": "soon"').encode("utf-8")
    public_expected = replace_once(
        old[PUBLIC_CATALOG], segment,
        segment.replace(b'"status": "soon"', b'"status": "ready"'),
        PUBLIC_CATALOG,
    )
    if new[PUBLIC_CATALOG] != public_expected or b'"entries":' in new[PUBLIC_CATALOG]:
        raise RuntimeError("PUBLIC_CATALOG_UNEXPECTED_OR_PAID_TEXT_EXPOSED")

    for name in PUBLIC[1:]:
        original = replace_once(
            old[name], TAG_OLD.encode(), TAG_NEW.encode(), name
        )
        if name == "redflag-feature.js":
            needle = b"const paragraphs=(material.sections||[]).flatMap(section=>section.paragraphs||[]);"
            split = (
                b"const paragraphs=(material.sections||[]).flatMap(section=>(section.paragraphs||[])\n"
                b"          .flatMap(text=>String(text).split(/\\n\\s*\\n/).map(part=>part.trim()).filter(Boolean)));"
            )
            original = replace_once(original, needle, split, name + ":paragraphs")
        if new[name] != original:
            raise RuntimeError("UNRELATED_PUBLIC_FILE_CHANGE:" + name)
    print(
        "SOURCE_APPROVAL_VERIFIED 366 unique dates; 79 RUB regular, 39 RUB club;"
        " prior answers unchanged; no new product or DB files", flush=True
    )
    return old, new


def public_get(name):
    url = ("https://" + NEW_DOMAIN + "/" + name +
           "?comic_ready_check=" + str(time.time_ns()))
    request = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
    with urllib.request.urlopen(request, timeout=35) as response:
        if response.status != 200 or urllib.parse.urlsplit(response.geturl()).hostname != NEW_DOMAIN:
            raise RuntimeError("WRONG_LIVE_DOMAIN:" + name)
        data = response.read(LIMIT + 1)
        if len(data) > LIMIT:
            raise RuntimeError("PUBLIC_FILE_TOO_LARGE:" + name)
        return data


def anonymous_denied():
    url = ("https://" + NEW_DOMAIN + "/" + BANK +
           "?paid_check=" + str(time.time_ns()))
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, headers={"Cache-Control": "no-store"}),
            timeout=25,
        ) as response:
            if response.status == 200:
                raise RuntimeError("PAID_JSON_PUBLICLY_ACCESSIBLE")
            raise RuntimeError("UNEXPECTED_PUBLIC_RESPONSE:" + str(response.status))
    except urllib.error.HTTPError as error:
        if error.code not in (401, 403, 404):
            raise RuntimeError("UNEXPECTED_PUBLIC_RESPONSE:" + str(error.code)) from error
    print("PAID_JSON_NOT_PUBLICLY_ACCESSIBLE", flush=True)


def main():
    old, new = validate()
    if not os.environ.get("REG_FTP_USER") or not os.environ.get("REG_FTP_PASSWORD"):
        raise RuntimeError("REG_RU_FTPS_SECRETS_UNAVAILABLE")
    old_live_index = public_get("index.html")
    anonymous_denied()
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=35)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)

    def read(path):
        output = io.BytesIO()
        def collect(part):
            if output.tell() + len(part) > LIMIT:
                raise RuntimeError("REMOTE_FILE_TOO_LARGE")
            output.write(part)
        ftp.retrbinary("RETR " + path, collect)
        return output.getvalue()

    def put(path, data):
        ftp.storbinary("STOR " + path, io.BytesIO(data))
        if read(path) != data:
            raise RuntimeError("FTPS_READBACK_MISMATCH:" + path.rsplit("/", 1)[-1])

    changed = []
    try:
        home = ftp.pwd().rstrip("/")
        site = None
        for domain in (NEW_DOMAIN, OLD_DOMAIN):
            candidate = home + "/www/" + domain
            try:
                current = read(candidate + "/index.html")
            except ftplib.error_perm:
                continue
            if current == old_live_index:
                site = candidate
                break
        if not site:
            raise RuntimeError("CANNOT_IDENTIFY_ACTIVE_LIVE_WEBROOT")
        guard = read(site + "/.htaccess")
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("PAID_STATIC_ACCESS_GUARD_MISSING")
        protected = home + "/private/numi-account-20261031"
        ftp.cwd(protected)
        ftp.cwd(protected + "/store-content/data/redflag/money")
        targets = {
            BANK: protected + "/store-content/" + BANK,
            MANIFEST: protected + "/store-assets.json",
            PRIVATE_CATALOG: protected + "/redflag-catalog.json",
            BACKEND: protected + "/fulfillment.php",
        }
        targets.update({p: site + "/" + p for p in PUBLIC})
        if len(targets) != len(FILES):
            raise RuntimeError("DUPLICATE_DEPLOYMENT_PATH")
        remote = {p: read(targets[p]) for p in FILES}
        for p, content in remote.items():
            if content not in (old[p], new[p]):
                raise RuntimeError("UNKNOWN_SERVER_BASELINE:" + p)
        if all(remote[p] == new[p] for p in FILES):
            if any(public_get(p) != new[p] for p in PUBLIC):
                raise RuntimeError("ALREADY_LIVE_HTTP_MISMATCH")
            anonymous_denied()
            print("REDFLAG_COMIC_366_READY_ALREADY_LIVE_VERIFIED", flush=True)
            return
        if any(remote[p] != old[p] for p in FILES):
            raise RuntimeError("PARTIALLY_UPDATED_SERVER_REQUIRES_REVIEW")
        if sha(remote[BANK]) != OLD_SHA:
            raise RuntimeError("REMOTE_PROTECTED_BANK_HASH_MISMATCH")
        if json.loads(remote[MANIFEST])["files"].get(BANK) != OLD_SHA:
            raise RuntimeError("REMOTE_MANIFEST_BASELINE_MISMATCH")
        # A completed snapshot is required before any file on the live site is changed.
        backup_root = home + "/site-safeguard-backups"
        try:
            ftp.mkd(backup_root)
        except ftplib.error_perm:
            ftp.cwd(backup_root)
        backup = backup_root + "/redflag-comic-live-ready-" + os.environ.get("GITHUB_RUN_ID", str(time.time_ns()))
        ftp.mkd(backup)
        for p in FILES:
            filename = ("private-" if p not in PUBLIC else "public-") + p.rsplit("/", 1)[-1] + ".before"
            put(backup + "/" + filename, remote[p])
        print("BACKUPS_VERIFIED", len(FILES), "existing files", flush=True)
        try:
            for p in FILES:
                if read(targets[p]) != remote[p]:
                    raise RuntimeError("CONCURRENT_EDIT_BEFORE_WRITE:" + p)
                if new[p] != remote[p]:
                    changed.append(p)
                    put(targets[p], new[p])
                if p in PUBLIC and public_get(p) != new[p]:
                    raise RuntimeError("LIVE_PUBLIC_HTTP_MISMATCH:" + p)
                print("LIVE_READBACK_VERIFIED", p, flush=True)
            if sha(read(targets[BANK])) != NEW_SHA:
                raise RuntimeError("PROTECTED_BANK_NEW_HASH_MISMATCH")
            if json.loads(read(targets[MANIFEST]))["files"][BANK] != NEW_SHA:
                raise RuntimeError("PROTECTED_MANIFEST_NEW_HASH_MISMATCH")
            state = json.loads(read(targets[PRIVATE_CATALOG]))
            if state["questions"]["money"]["comic-verdict-money"] != {
                "tier": 49, "free": False, "ready": True
            }:
                raise RuntimeError("LIVE_PRIVATE_CATALOG_NOT_READY")
            if read(site + "/.htaccess") != guard:
                raise RuntimeError("PUBLIC_SECURITY_GUARD_CHANGED")
            anonymous_denied()
            print("REDFLAG_COMIC_366_READY_LIVE_VERIFIED", NEW_DOMAIN,
                  "price_regular=79", "price_club=39", flush=True)
        except BaseException:
            for p in reversed(changed):
                try:
                    put(targets[p], remote[p])
                    print("ROLLBACK_VERIFIED", p, flush=True)
                except BaseException:
                    print("ROLLBACK_FAILED", p, flush=True)
            raise
    finally:
        try:
            ftp.quit()
        except BaseException:
            ftp.close()


if __name__ == "__main__":
    main()
