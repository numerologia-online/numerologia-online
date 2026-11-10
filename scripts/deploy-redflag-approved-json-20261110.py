"""Protected REG.RU upload for an approved batch of Red Flag JSON answers.

Strict two-file transaction: one private JSON bank and its checksum manifest.
Verifies the GitHub diff, encrypted FTPS baselines, private backups, live
private readback and unauthenticated denial. Never changes publication status.
"""
import ftplib
import hashlib
import io
import json
import os
from pathlib import Path
import ssl
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

HOST = "server172.hosting.reg.ru"
NEW_DOMAIN = "xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD_DOMAIN = "xn--c1adkkdfjbp1a4l.online"
BANK = "data/redflag/money/comic-verdict.json"
MANIFEST = "account-service/private/store-assets.json"
BANK_BASE = "369f0d8ef49da0e1a7ecb00ab122f4d09cf94a54"
MANIFEST_BASE = "4b702556026faf8d358234ccd98a59ba4867b95f"
OLD_SHA = "673755044bdf885a18f12c439941f5dad9f8f5317124b77a15cfc0e667a91653"
NEW_SHA = "1cb9bed5e750adc8e6ddc7d157e26b7a87a6edea308aeb48d61320142b180234"
LIMIT = 950_000
ADDED_DATES = {*(f"{d}-7" for d in range(21, 32)), *(f"{d}-8" for d in range(1, 32)), *(f"{d}-9" for d in range(1, 9))}


def git_base(ref, name):
    return subprocess.check_output(["git", "show", f"{ref}:{name}"], timeout=30)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def validate():
    prev = git_base(BANK_BASE, BANK)
    desired = Path(BANK).read_bytes()
    old_m = git_base(MANIFEST_BASE, MANIFEST)
    new_m = Path(MANIFEST).read_bytes()
    if sha(prev) != OLD_SHA or sha(desired) != NEW_SHA:
        raise RuntimeError("GITHUB_SOURCE_HASH_MISMATCH")
    before = json.loads(prev)
    after = json.loads(desired)
    if before.get("questionId") != "comic-verdict-money" or after.get("questionId") != "comic-verdict-money":
        raise RuntimeError("WRONG_BANK_ID")
    if before.get("keyRule") != "day-month" or after.get("keyRule") != "day-month":
        raise RuntimeError("WRONG_DATE_KEY_RULE")
    if {k: v for k, v in before.items() if k != "entries"} != {k: v for k, v in after.items() if k != "entries"}:
        raise RuntimeError("BANK_METADATA_CHANGED")
    old_entries = before["entries"]
    new_entries = after["entries"]
    if len(old_entries) != 202 or len(new_entries) != 252:
        raise RuntimeError("UNEXPECTED_ANSWER_COUNTS")
    if set(new_entries) - set(old_entries) != ADDED_DATES or set(old_entries) - set(new_entries):
        raise RuntimeError("UNEXPECTED_DATES_CHANGED")
    if any(new_entries[k] != v for k, v in old_entries.items()):
        raise RuntimeError("PREVIOUS_202_ANSWERS_CHANGED")
    if any(not isinstance(new_entries[k], str) or len(new_entries[k].strip()) < 450 for k in ADDED_DATES):
        raise RuntimeError("EMPTY_OR_SHORT_NEW_ANSWER")
    old_meta, new_meta = json.loads(old_m), json.loads(new_m)
    if old_meta["files"].get(BANK) != OLD_SHA or new_meta["files"].get(BANK) != NEW_SHA:
        raise RuntimeError("INCORRECT_MANIFEST_HASH")
    old_meta["files"][BANK] = NEW_SHA
    if old_meta != new_meta:
        raise RuntimeError("UNRELATED_MANIFEST_CHANGE")
    if len(prev) > LIMIT or len(desired) > LIMIT or len(old_m) > LIMIT or len(new_m) > LIMIT:
        raise RuntimeError("SOURCE_TOO_LARGE")
    print("APPROVED_BATCH_VERIFIED 50 unique July-September dates; previous 202 unchanged", flush=True)
    return prev, desired, old_m, new_m


def public_index():
    request = urllib.request.Request(
        f"https://{NEW_DOMAIN}/index.html?redflag_private_sync={time.time_ns()}",
        headers={"Cache-Control": "no-cache"},
    )
    with urllib.request.urlopen(request, timeout=35) as r:
        if r.status != 200 or urllib.parse.urlsplit(r.geturl()).hostname != NEW_DOMAIN:
            raise RuntimeError("ACTIVE_PUBLIC_DOMAIN_MISMATCH")
        b = r.read(LIMIT + 1)
        if len(b) > LIMIT:
            raise RuntimeError("PUBLIC_INDEX_TOO_LARGE")
        return b


def anonymous_denied():
    # The protected answer file must NEVER become a public static asset.
    request = urllib.request.Request(
        f"https://{NEW_DOMAIN}/{BANK}?private_check={time.time_ns()}",
        headers={"Cache-Control": "no-store"},
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as resp:
            if resp.status == 200:
                raise RuntimeError("PAID_JSON_PUBLICLY_ACCESSIBLE")
            return
    except urllib.error.HTTPError as e:
        if e.code not in (401, 403, 404):
            raise RuntimeError(f"UNEXPECTED_PUBLIC_RESPONSE:{e.code}") from e
    print("PAID_JSON_NOT_PUBLICLY_ACCESSIBLE", flush=True)


def main():
    prev, desired, old_m, new_m = validate()
    if not os.environ.get("REG_FTP_USER") or not os.environ.get("REG_FTP_PASSWORD"):
        raise RuntimeError("REG_RU_FTPS_SECRETS_UNAVAILABLE")
    index = public_index()
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
            raise RuntimeError("FTPS_READBACK_MISMATCH")

    changed = []
    try:
        root = ftp.pwd().rstrip("/")
        site = None
        for domain in (NEW_DOMAIN, OLD_DOMAIN):
            candidate = root + "/www/" + domain
            try:
                actual = read(candidate + "/index.html")
            except ftplib.error_perm:
                continue
            if actual == index:
                site = candidate
                break
        if not site:
            raise RuntimeError("CANNOT_IDENTIFY_ACTIVE_SITE_ROOT")
        guard = read(site + "/.htaccess")
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("PAID_STATIC_ACCESS_GUARD_MISSING")
        protected = root + "/private/numi-account-20261031"
        ftp.cwd(protected)
        ftp.cwd(protected + "/store-content/data/redflag/money")
        target_bank = protected + "/store-content/" + BANK
        target_manifest = protected + "/store-assets.json"
        actual_bank = read(target_bank)
        actual_manifest = read(target_manifest)
        if actual_bank not in (prev, desired):
            raise RuntimeError("UNREVIEWED_SERVER_JSON_BASELINE")
        if actual_manifest not in (old_m, new_m):
            raise RuntimeError("UNREVIEWED_SERVER_MANIFEST_BASELINE")
        if actual_bank == desired and actual_manifest == new_m:
            anonymous_denied()
            print("REDFLAG_COMIC_SEPT_8_ALREADY_LIVE_VERIFIED", flush=True)
            return
        if actual_bank != prev or actual_manifest != old_m:
            raise RuntimeError("SERVER_JSON_MANIFEST_OUT_OF_SYNC")
        backup_root = root + "/site-safeguard-backups"
        try:
            ftp.mkd(backup_root)
        except ftplib.error_perm:
            ftp.cwd(backup_root)
        backup = backup_root + "/redflag-comic-sept-8-" + os.environ.get("GITHUB_RUN_ID", str(time.time_ns()))
        ftp.mkd(backup)
        put(backup + "/comic-verdict.json.before", actual_bank)
        put(backup + "/store-assets.json.before", actual_manifest)
        print("BACKUP_VERIFIED comic-verdict.json", flush=True)
        print("BACKUP_VERIFIED store-assets.json", flush=True)
        try:
            if read(target_bank) != actual_bank or read(target_manifest) != actual_manifest:
                raise RuntimeError("CONCURRENT_EDIT_BEFORE_UPDATE")
            changed.append((target_bank, actual_bank))
            put(target_bank, desired)
            changed.append((target_manifest, actual_manifest))
            put(target_manifest, new_m)
            if read(target_bank) != desired or read(target_manifest) != new_m:
                raise RuntimeError("POST_PUBLICATION_FTPS_MISMATCH")
            if sha(read(target_bank)) != json.loads(read(target_manifest))["files"][BANK]:
                raise RuntimeError("ACTIVE_PROTECTED_HASH_MISMATCH")
            if read(site + "/.htaccess") != guard or read(site + "/index.html") != index:
                raise RuntimeError("PUBLIC_FILES_CHANGED")
            anonymous_denied()
            print("REDFLAG_COMIC_SEPT_8_PRIVATE_LIVE_VERIFIED", NEW_DOMAIN, flush=True)
        except BaseException:
            for target, original in reversed(changed):
                try:
                    put(target, original)
                    print("ROLLBACK_VERIFIED", target.rsplit("/", 1)[-1], flush=True)
                except BaseException:
                    print("ROLLBACK_FAILED", target.rsplit("/", 1)[-1], flush=True)
            raise
    finally:
        try:
            ftp.quit()
        except BaseException:
            ftp.close()


if __name__ == "__main__":
    main()
