"""Two-file REG.RU fix: insert day/month dots automatically on iOS numeric keyboard.
Only publish expected reviewed source versions; back up and roll back on any error.
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

DOMAIN = "xn--c1adkkdfjbp1a4l.online"
HOST = "server172.hosting.reg.ru"
MANIFEST = pathlib.Path(".github/numi-pro-date-dots-release.json")
FILES = ("pro/pro.js", "pro/index.html")

def sha256(raw):
    return hashlib.sha256(raw).hexdigest()

def gitsha(raw):
    return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()

def http(path):
    request = urllib.request.Request(
        "https://" + DOMAIN + path,
        headers={"Cache-Control": "no-cache", "Pragma": "no-cache",
                 "User-Agent": "numi-pro-date-dots-release/1"})
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()

def main():
    release = json.loads(MANIFEST.read_text("utf-8"))
    baseline = release.get("baseline")
    expected = release.get("desired")
    if release.get("version") != 1 or not isinstance(baseline, dict) or not isinstance(expected, dict):
        raise RuntimeError("Malformed date dots release")
    if set(baseline) != set(FILES) or set(expected) != set(FILES):
        raise RuntimeError("Date dots release limited to exactly two public files")
    desired = {name: pathlib.Path(name).read_bytes() for name in FILES}
    for name in FILES:
        if gitsha(desired[name]) != expected[name]:
            raise RuntimeError("Reviewed Git source changed: " + name)
        if len(baseline[name]) != 40:
            raise RuntimeError("Missing source baseline: " + name)
    source = desired["pro/pro.js"]
    page = desired["pro/index.html"]
    if not (b"function formatProBirthDate(value, deleting = false)" in source
            and b'input.value=formatProBirthDate(input.value,deleting)' in source
            and b"verifiedSchoolClientOwner" in source
            and b"createFullReportPdfButton" in source
            and b"pro/pro.js?v=20261103dots1" in page
            and b'id="pro-birth-date" type="text" inputmode="numeric"' in page):
        raise RuntimeError("Input fix or owner/PDF safeguards missing")

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    home = ftp.pwd().rstrip("/")
    site = home + "/www/" + DOMAIN

    def read(path):
        contents = io.BytesIO()
        def collect(chunk):
            if contents.tell() + len(chunk) > 2_000_000:
                raise RuntimeError("Unexpected source size")
            contents.write(chunk)
        ftp.retrbinary("RETR " + path, collect)
        return contents.getvalue()

    def write(path, data):
        ftp.storbinary("STOR " + path, io.BytesIO(data))
        if sha256(read(path)) != sha256(data):
            raise RuntimeError("FTP write verification failed")

    originals = {}
    planned = {}
    updated = []
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    try:
        ftp.cwd(site)
        if "index.html" not in [name.rsplit("/", 1)[-1] for name in ftp.nlst()]:
            raise RuntimeError("REG.RU site root not verified")
        # Only the JS must match its exact source baseline. The live HTML has
        # unrelated updates: preserve every byte except the uniquely matched
        # version query on the module script. Refuse any unexpected markup.
        old_tag = b'<script type="module" src="pro/pro.js?v=20261103schoolpdf1"></script>'
        new_tag = b'<script type="module" src="pro/pro.js?v=20261103dots1"></script>'
        for name in FILES:
            current = read(site + "/" + name)
            current_sha = gitsha(current)
            if name == "pro/index.html":
                if current.count(old_tag) == 1 and current.count(new_tag) == 0:
                    new_data = current.replace(old_tag, new_tag, 1)
                elif current.count(new_tag) == 1 and current.count(old_tag) == 0:
                    new_data = current
                else:
                    raise RuntimeError("Unable to identify the current script tag on live HTML")
                if b'id="pro-birth-date" type="text" inputmode="numeric"' not in new_data:
                    raise RuntimeError("Date field changed on the live page, aborting")
            else:
                if current_sha not in (baseline[name], expected[name]):
                    raise RuntimeError("Live JS has unrelated changes, refusing overwrite: " + name)
                new_data = desired[name]
            originals[name] = current
            planned[name] = new_data
            print("PREFLIGHT", name, "current", current_sha,
                  "new", gitsha(new_data), "changed", current != new_data, flush=True)

        backup = home + "/site-safeguard-backups/pro-date-dots-" + stamp
        ftp.mkd(backup)
        for name, current in originals.items():
            write(backup + "/" + sha256(name.encode()) + ".original", current)
        write(backup + "/manifest.json", json.dumps({
            "files": list(FILES),
            "original_sha256": {name: sha256(data) for name, data in originals.items()},
            "updated_sha256": {name: sha256(data) for name, data in planned.items()}
        }, sort_keys=True).encode())
        print("BACKUP_VERIFIED", backup, flush=True)

        try:
            for name in FILES:
                if originals[name] == planned[name]:
                    continue
                updated.append(name)
                write(site + "/" + name, planned[name])
                print("PUBLISHED", name, sha256(planned[name]), flush=True)

            status, live_js = http("/pro/pro.js?date-dots-release=" + stamp)
            if status != 200 or b"function formatProBirthDate(value, deleting = false)" not in live_js:
                raise RuntimeError("Published date formatter not accessible")
            status, live_html = http("/pro/?date-dots-release=" + stamp)
            if status != 200 or b"pro/pro.js?v=20261103dots1" not in live_html:
                raise RuntimeError("Updated date input script not referenced on live page")
            if b'id="pro-birth-date" type="text" inputmode="numeric"' not in live_html:
                raise RuntimeError("Date field unexpectedly changed")
            status, protected = http("/pro/school/client-pdf.js?date-dots-release=" + stamp)
            if status not in (403, 404) or b"createSchoolClientPdf" in protected:
                raise RuntimeError("Client PDF private module access regressed")
            print("PRO_DATE_DOTS_SUCCESS", len(updated), "files published, date input live, client PDF protected", flush=True)
        except Exception:
            print("ROLLING_BACK_PRO_DATE_DOTS", updated, flush=True)
            for name in reversed(updated):
                try:
                    write(site + "/" + name, originals[name])
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
