"""Release only reviewed client-PDF school changes with FTP backup and rollback."""
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

REPO = pathlib.Path(".")
DOMAIN = "xn--c1adkkdfjbp1a4l.online"
HOST = "server172.hosting.reg.ru"
MANIFEST = REPO / ".github/numi-school-client-pdf-release.json"
ALLOWED = {"pro/pro.js", "pro/index.html", "pro/school/index.html"}

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def http(path):
    req = urllib.request.Request("https://" + DOMAIN + path,
        headers={"Cache-Control": "no-cache", "Pragma": "no-cache",
                 "User-Agent": "numi-school-client-release/1"})
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()

def main():
    release = json.loads(MANIFEST.read_text("utf-8"))
    patches = release.get("changes")
    if release.get("version") != 1 or not isinstance(patches, dict) or set(patches) != ALLOWED:
        raise RuntimeError("Scope must be exactly three reviewed client-PDF sources")
    for name, hunks in patches.items():
        if not isinstance(hunks, list) or not 1 <= len(hunks) <= 10:
            raise RuntimeError("Invalid patch count: " + name)
        for change in hunks:
            if not isinstance(change, dict) or set(change) != {"before", "after"}:
                raise RuntimeError("Invalid patch format: " + name)
            if (not isinstance(change["before"], str) or not change["before"] or
                not isinstance(change["after"], str) or not change["after"] or
                change["before"] == change["after"]):
                raise RuntimeError("Empty or equal patch: " + name)

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    home = ftp.pwd().rstrip("/")
    site = home + "/www/" + DOMAIN
    private = home + "/private/numi-school-owner-20261103/sources"

    def read(path):
        result = io.BytesIO()
        def collect(chunk):
            if result.tell() + len(chunk) > 2_000_000:
                raise RuntimeError("Remote file exceeds safe limit")
            result.write(chunk)
        ftp.retrbinary("RETR " + path, collect)
        return result.getvalue()

    def write(path, raw):
        ftp.storbinary("STOR " + path, io.BytesIO(raw))
        if digest(read(path)) != digest(raw):
            raise RuntimeError("FTP write verification failed")

    def target(name):
        if name == "pro/school/index.html":
            return private + "/" + digest(name.encode())
        return site + "/" + name

    original = {}
    updated = {}
    paths = {}
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    changed = []
    try:
        ftp.cwd(site)
        if "index.html" not in [name.rsplit("/", 1)[-1] for name in ftp.nlst()]:
            raise RuntimeError("REG.RU site root is not verified")
        for name, changes in patches.items():
            path = target(name)
            old = read(path)
            new = old
            for change in changes:
                before = change["before"].encode("utf-8")
                after = change["after"].encode("utf-8")
                if new.count(before) == 1:
                    new = new.replace(before, after, 1)
                elif new.count(after) == 1:
                    # Repeating the release is harmless. A different live version aborts.
                    pass
                else:
                    raise RuntimeError("Reviewed patch does not uniquely match live source: " + name)
            original[name] = old
            updated[name] = new
            paths[name] = path
            print("PREFLIGHT", name, "old_sha256", digest(old),
                  "new_sha256", digest(new), "changed", new != old, flush=True)

        if b"verifiedSchoolClientOwner" not in updated["pro/pro.js"]:
            raise RuntimeError("School-owner verification missing from new public JS")
        if b"pro/pro.js?v=20261103schoolpdf1" not in updated["pro/index.html"]:
            raise RuntimeError("Client PDF module cache refresh missing")
        if b"pro/?from=school" not in updated["pro/school/index.html"]:
            raise RuntimeError("School link no longer opens client mode")

        backup_root = home + "/site-safeguard-backups/school-client-pdf-" + stamp
        ftp.mkd(backup_root)
        for name, raw in original.items():
            write(backup_root + "/" + digest(name.encode()) + ".original", raw)
        write(backup_root + "/manifest.json",
              json.dumps({"paths": sorted(ALLOWED),
                          "original_sha256": {k: digest(v) for k, v in original.items()}},
                         sort_keys=True).encode())
        print("BACKUP_VERIFIED", backup_root, flush=True)

        try:
            for name, raw in updated.items():
                if raw == original[name]:
                    continue
                changed.append(name)
                write(paths[name], raw)
                if name == "pro/school/index.html":
                    ftp.sendcmd("SITE CHMOD 600 " + paths[name])
                print("PUBLISHED", name, digest(raw), flush=True)

            status, source = http("/pro/pro.js?school-client-release=" + stamp)
            if status != 200 or b"verifySchoolClientOwner" not in source:
                raise RuntimeError("Live public client generator script did not update")
            status, page = http("/pro/?school-client-release=" + stamp)
            if status != 200 or b"pro/pro.js?v=20261103schoolpdf1" not in page:
                raise RuntimeError("Live report page still references stale script")
            status, protected = http("/pro/school/client-pdf.js?school-client-release=" + stamp)
            if status not in (403, 404) or b"createSchoolClientPdf" in protected:
                raise RuntimeError("Client PDF source is accessible without owner credentials")
            status, offer = http("/pro/school/?school-client-release=" + stamp)
            if status != 200 or b"school-subscription-offer" not in offer:
                raise RuntimeError("Protected school entry unexpectedly changed")
            print("SCHOOL_CLIENT_PDF_RELEASE_SUCCESS", len(changed),
                  "files; owner gate and anonymous school protection verified", flush=True)
        except Exception:
            print("RELEASE_FAILED_ROLLING_BACK", changed, flush=True)
            for name in reversed(changed):
                try:
                    write(paths[name], original[name])
                    if name == "pro/school/index.html":
                        ftp.sendcmd("SITE CHMOD 600 " + paths[name])
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
