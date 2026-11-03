"""Safely restore only four Matrix self-study screens on REG.RU.

Uses the existing private owner gate; never touches .htaccess, account systems,
premium data, ordinary pages, lesson JSON or the white-label client PDF code.
"""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import ssl
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(".")
MANIFEST = ROOT / ".github/numi-school-legacy-restore.json"
HOST = "server172.hosting.reg.ru"
DOMAIN = "xn--c1adkkdfjbp1a4l.online"
FILES = (
    "pro/school/index.html",
    "pro/school/school.js",
    "pro/school/lesson/index.html",
    "pro/school/lesson/lesson.js",
)

def sha256(data):
    return hashlib.sha256(data).hexdigest()

def git_blob_sha(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()

def check_live(path):
    url = "https://" + DOMAIN + path + ("&" if "?" in path else "?") + "restore=" + str(int(time.time()))
    request = urllib.request.Request(
        url,
        headers={"Cache-Control": "no-cache", "User-Agent": "numi-legacy-school-owner-check/1"})
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()

def main():
    manifest = json.loads(MANIFEST.read_text("utf-8"))
    base = manifest.get("base_git_blob_sha")
    if manifest.get("version") != 1 or not isinstance(base, dict) or set(base) != set(FILES):
        raise RuntimeError("Release manifest must contain exactly four protected school files")
    if not all(isinstance(value, str) and len(value) == 40
               and all(c in "0123456789abcdef" for c in value) for value in base.values()):
        raise RuntimeError("Invalid baseline source SHA")

    desired = {name: (ROOT / name).read_bytes() for name in FILES}
    page = desired["pro/school/index.html"]
    lesson_page = desired["pro/school/lesson/index.html"]
    reader = desired["pro/school/lesson/lesson.js"]
    main = desired["pro/school/school.js"]
    if not (b"school-train-point" in page and b"school-train-answer" in page
            and b"pro/?from=school" in page
            and b"20261103legacy1" in page and b"school-client-service" in page
            and b"20261103legacy1" in lesson_page
            and b"lesson-step-next" in lesson_page
            and b"drawFirstLessonOutline" in reader
            and b'action:"content"' in reader
            and b'"/api/numi-school.php"' in reader
            and b"renderTrainer()" in main
            and b"mountConstruction" not in main):
        raise RuntimeError("Missing essential old-school interface, access or client PDF safeguards")

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    home = ftp.pwd().rstrip("/")
    site = home + "/www/" + DOMAIN
    private = home + "/private/numi-school-owner-20261103/sources"

    def remote(name):
        return private + "/" + sha256(name.encode())

    def read(path):
        contents = io.BytesIO()
        def collect(chunk):
            if contents.tell() + len(chunk) > 2_000_000:
                raise RuntimeError("Remote school source unexpectedly large")
            contents.write(chunk)
        ftp.retrbinary("RETR " + path, collect)
        return contents.getvalue()

    def write(path, value):
        ftp.storbinary("STOR " + path, io.BytesIO(value))
        if sha256(read(path)) != sha256(value):
            raise RuntimeError("FTP file integrity verification failed")

    original = {}
    changed = []
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())

    try:
        ftp.cwd(site)
        if "index.html" not in [p.rsplit("/", 1)[-1] for p in ftp.nlst()]:
            raise RuntimeError("REG.RU website root cannot be verified")

        # No writes until every live file is verified. Unknown edits abort, never overwrite.
        for name in FILES:
            raw = read(remote(name))
            previous_git_sha = git_blob_sha(raw)
            next_git_sha = git_blob_sha(desired[name])
            if previous_git_sha not in (base[name], next_git_sha):
                raise RuntimeError("Live protected school source differs from reviewed baseline: " + name)
            original[name] = raw
            print("PREFLIGHT", name, "git_blob_sha", previous_git_sha,
                  "new_git_blob_sha", next_git_sha,
                  "changed", raw != desired[name], flush=True)

        backup = home + "/site-safeguard-backups/school-legacy-" + stamp
        ftp.mkd(backup)
        for name, data in original.items():
            write(backup + "/" + sha256(name.encode()) + ".original", data)
        write(backup + "/manifest.json", json.dumps({
            "paths": list(FILES),
            "original_sha256": {n: sha256(data) for n, data in original.items()},
            "new_sha256": {n: sha256(data) for n, data in desired.items()},
            "version": manifest["version"]
        }, sort_keys=True).encode())
        print("BACKUP_VERIFIED", backup, flush=True)

        try:
            for name in FILES:
                if original[name] == desired[name]:
                    continue
                changed.append(name)
                write(remote(name), desired[name])
                ftp.sendcmd("SITE CHMOD 600 " + remote(name))
                print("RESTORED", name, sha256(desired[name]), flush=True)

            for name in FILES:
                if read(remote(name)) != desired[name]:
                    raise RuntimeError("Protected school verification failed: " + name)

            status, body = check_live("/pro/school/school.js")
            if status not in (403, 404) or b"renderTrainer()" in body:
                raise RuntimeError("School JavaScript exposed without owner authorization")
            status, body = check_live("/pro/school/lesson/lesson.js")
            if status not in (403, 404) or b"drawFirstLessonOutline" in body:
                raise RuntimeError("School lesson JavaScript exposed without owner authorization")
            status, body = check_live("/pro/school/")
            if status != 200 or b"school-subscription-offer" not in body:
                raise RuntimeError("Owner access gate or subscription offer is not working")
            status, body = check_live("/pro/pro.js")
            if status != 200 or b"verifiedSchoolClientOwner" not in body:
                raise RuntimeError("Separate owner-verified client PDF no longer present")
            print("SCHOOL_LEGACY_RESTORE_SUCCESS", len(changed),
                  "protected school assets restored, owner gate and client PDF preserved", flush=True)
        except Exception:
            print("RESTORE_FAILED_ROLLING_BACK", changed, flush=True)
            for name in reversed(changed):
                try:
                    write(remote(name), original[name])
                    ftp.sendcmd("SITE CHMOD 600 " + remote(name))
                    print("ROLLED_BACK", name, flush=True)
                except Exception as error:
                    print("ROLLBACK_FAILED", name, repr(error), flush=True)
            raise
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()

if __name__ == "__main__":
    main()
