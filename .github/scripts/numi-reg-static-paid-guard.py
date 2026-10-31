"""One-time, guarded Apache HTTP fence for 184 exclusively paid legacy static paths.

Never deletes an author file or writes a paid text. Existing private backend
remains separate. Every public-free file path is deliberately excluded.
"""
import concurrent.futures
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
from urllib.parse import quote

DOMAIN = "xn--c1adkkdfjbp1a4l.online"
HOST = "server172.hosting.reg.ru"
PROTECTED_SOURCE = "f67c2ce48928e97a8471d07608b6c722985b7267"
BEGIN = "# NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31"
END = "# NUMI PAID STATIC ACCESS GUARD END 2026-10-31"
LIVE_AUTH_SHA256 = "c9bbfeef5d85d66b6e119357734fabb74bdf2301c279ff6b060063428c918dbe"

def log(**kwargs):
    print(json.dumps(kwargs, ensure_ascii=False, sort_keys=True), flush=True)

def run_git(path):
    return subprocess.check_output(["git", "show", PROTECTED_SOURCE + ":" + path], timeout=20).decode("utf-8")

def validated_policy():
    text = run_git("paid-content-paths.js")
    match = re.search(r"export const protectedFiles\s*=\s*(\{[^;]+\})\s*;", text, re.S)
    if match is None:
        raise RuntimeError("Pinned protected-file policy unavailable")
    policy = json.loads(match.group(1))
    if len(policy) != 321:
        raise RuntimeError("Expected exactly 321 inventoried sources")
    private = sorted(p for p, meta in policy.items() if meta["public"] is False)
    public = sorted(p for p, meta in policy.items() if meta["public"] is True)
    if len(private) != 184 or len(public) != 137:
        raise RuntimeError("Protected file counts changed")
    for p in policy:
        if not re.fullmatch(r"[a-zA-Z0-9_./-]{1,220}", p) or ".." in pathlib.PurePosixPath(p).parts:
            raise RuntimeError("Unsafe path in policy")
    must_private = ("data/year/energy-1.txt", "child/data/matrix/sections/energy-1.json",
                    "data/redflag/money/generosity.json", "pro/purpose/general.json")
    must_public = ("data/redflag/money/gift.json", "data/redflag/love/published/1-2.json",
                   "pro/point-previews.json")
    if not set(must_private).issubset(private) or not set(must_public).issubset(public):
        raise RuntimeError("Expected paid/free boundary is not respected")
    return private, public

def guard_bytes(paths):
    lines = [BEGIN, "<IfModule mod_rewrite.c>", "RewriteEngine On"]
    for i in range(0, len(paths), 12):
        pattern = "|".join(re.escape(p) for p in paths[i:i + 12])
        lines.append("RewriteRule ^(?:" + pattern + ")$ - [F,L,NC]")
    lines += ["</IfModule>", END, ""]
    return "\n".join(lines).encode("ascii")

def http_status(path):
    url = "https://" + DOMAIN + "/" + path + "?numi_access_audit=" + str(int(time.time()))
    r = subprocess.run(["curl", "-4", "-sS", "-L", "--max-time", "16", "-o", "/dev/null",
                        "-w", "%{http_code}", "-H", "Cache-Control: no-cache", url],
                       capture_output=True, text=True, timeout=21)
    return int(r.stdout) if r.returncode == 0 and r.stdout.isdigit() else 0

def public_sanity():
    public = ("", "child/", "pro/", "data/redflag/money/gift.json",
              "data/redflag/love/published/1-2.json",
              "child/data/matrix/free/character-1.json",
              "api/numi-content-health.php")
    result = {p or "home": http_status(p) for p in public}
    log(public_endpoint_checks=result)
    return all(s == 200 for s in result.values())

def main():
    private, public = validated_policy()
    if not public_sanity():
        raise RuntimeError("Public previews or application baseline unhealthy BEFORE guard; nothing modified")
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=28)
    try:
        ftp.connect(HOST, 21)
        ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
        ftp.prot_p()
        ftp.set_pasv(True)
        home = ftp.pwd().rstrip("/")
        site = home + "/www/" + DOMAIN
        def read(path, limit=2_500_000):
            out = io.BytesIO()
            def recv(part):
                if out.tell() + len(part) > limit:
                    raise RuntimeError("Unexpectedly large remote file")
                out.write(part)
            try:
                ftp.retrbinary("RETR " + path, recv)
            except ftplib.error_perm as ex:
                if str(ex).startswith("550"):
                    return None
                raise
            return out.getvalue()
        def put(path, content):
            ftp.storbinary("STOR " + path, io.BytesIO(content))
            if read(path) != content:
                raise RuntimeError("FTPS upload integrity failed")
        original_index = read(site + "/index.html")
        original_auth = read(site + "/auth-profile.js")
        if original_index is None or original_auth is None:
            raise RuntimeError("Production site verification failed")
        if hashlib.sha256(original_auth).hexdigest() != LIVE_AUTH_SHA256:
            raise RuntimeError("Live Telegram login differs from verified version; no modification")
        old = read(site + "/.htaccess")
        if old is None:
            old = b""
            was_missing = True
        else:
            was_missing = False
        if BEGIN.encode() in old or END.encode() in old:
            raise RuntimeError("Access guard already exists or is partially installed; refusing overwrite")
        if old and b"\x00" in old:
            raise RuntimeError("Unrecognized existing .htaccess format")
        guard = guard_bytes(private)
        new = guard + b"\n" + old
        if len(new) > 200000:
            raise RuntimeError("Refusing oversized Apache configuration")
        backup_root = home + "/site-safeguard-backups"
        try:
            ftp.mkd(backup_root)
        except ftplib.error_perm:
            ftp.cwd(backup_root)
        stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        backup = backup_root + "/paid-static-guard-before-" + stamp + ".htaccess"
        put(backup, old)
        log(backup_outside_public_webroot=backup, private_denials=len(private),
            free_and_mixed_exemptions=len(public), old_htaccess_existed=not was_missing)
        wrote = False
        try:
            wrote = True
            put(site + "/.htaccess", new)
            if not public_sanity():
                raise RuntimeError("Public site or free entry became unavailable; reverting guard")
            statuses = {}
            def check(p):
                return p, http_status(p)
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
                for path, status in executor.map(check, private):
                    statuses[path] = status
            bad = {p: s for p, s in statuses.items() if s not in (401, 403, 404, 410)}
            codes = {str(code): sum(1 for s in statuses.values() if s == code)
                     for code in sorted(set(statuses.values()))}
            log(private_http_status_counts=codes, bad_paid_urls=bad, audited=len(statuses))
            if bad:
                raise RuntimeError("At least one paid original still publicly available; reverting guard")
            if read(site + "/index.html") != original_index or read(site + "/auth-profile.js") != original_auth:
                raise RuntimeError("Unexpected concurrent site or login change; reverting guard")
            if read(site + "/.htaccess") != new:
                raise RuntimeError("Protected Apache configuration changed during audit")
            log(success=True, anonymous_static_paid_files_denied=len(statuses),
                public_free_still_available=True, author_text_bytes_modified=0,
                private_api_unchanged=True, telegram_login_unchanged=True)
        except BaseException:
            log(verification_failed=True, restoring_existing_htaccess=True)
            if wrote:
                try:
                    if was_missing:
                        ftp.delete(site + "/.htaccess")
                        if read(site + "/.htaccess") is not None:
                            raise RuntimeError("Could not remove new Apache guard after failed test")
                    else:
                        put(site + "/.htaccess", old)
                    log(rollback_htaccess_restored=True)
                except BaseException as ex:
                    log(rollback_htaccess_restored=False, reason=type(ex).__name__)
            raise
    finally:
        try:
            ftp.quit()
        except BaseException:
            ftp.close()

if __name__ == "__main__":
    try:
        main()
    except BaseException as ex:
        log(stopped=type(ex).__name__, detail=str(ex)[:150] if isinstance(ex, RuntimeError) else "")
        sys.exit(1)
