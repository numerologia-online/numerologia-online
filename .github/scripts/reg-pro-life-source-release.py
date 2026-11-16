import ftplib
import hashlib
import io
import json
import os
from pathlib import Path
import secrets
import ssl
import subprocess
import time
import urllib.error
import urllib.request


ORIGIN = "https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
API = "api/numi-life-content.php"
PUBLIC = {
    API: "account-service/public/numi-life-content.php",
    "pro/secure-reader.js": "pro/secure-reader.js",
    "pro/karmic-programs-secure.js": "pro/karmic-programs-secure.js",
    "pro/full-report-pdf-secure.js": "pro/full-report-pdf-secure.js",
    "pro/purpose-readings.js": "pro/purpose-readings.js",
    "pro/pro-pdf-content.js": "pro/pro-pdf-content.js",
    "pro/pro.js": "pro/pro.js",
    "pro/index.html": "pro/index.html",
}
BEFORE = {
    "pro/purpose-readings.js": "33411e06678e^",
    "pro/pro-pdf-content.js": "f2512d49d620^",
    "pro/pro.js": "b9bcfd24ef3d",
    "pro/index.html": "5587e029dc6a",
}
SUPPLEMENTS = {
    **{p.name: p for p in Path("pro/purpose").glob("*.json")},
    **{f"guidance-{p.name}": p for p in Path("pro/guidance").glob("energy-*.json")},
    **{name: Path("pro") / name for name in
       ("karmic-programs.json", "karmic-tail-deepening-a.json", "karmic-tail-deepening-b.json")},
    "karmic-tails.md": Path("karmic-tails.md"),
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def request(path, body=None):
    headers = {"Cache-Control": "no-cache"}
    if body is not None:
        headers.update({"Origin": ORIGIN, "Content-Type": "application/json"})
        body = json.dumps(body).encode()
    separator = "&" if "?" in path else "?"
    url = f"{ORIGIN}/{path}{separator}life_check={time.time_ns()}"
    try:
        response = urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers), timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.headers.get_content_type(), response.read(2_000_000)


def main():
    payloads = {name: Path(source).read_bytes() for name, source in PUBLIC.items()}
    expected = {
        name: subprocess.check_output(["git", "show", BEFORE[name] + ":" + name]) if name in BEFORE else None
        for name in PUBLIC
    }
    old_layout = subprocess.check_output(["git", "show", "a6adaf2ff517:pro/index.html"])
    repaired_layout = payloads["pro/index.html"].replace(
        b"pro.js?v=life-content-20261116", b"pro.js?v=report-annual-20261109"
    ).replace(b"pro.css?v=original-recovered-20261116", b"pro.css?v=65")
    if repaired_layout != old_layout or len(SUPPLEMENTS) != 23:
        raise RuntimeError("Full Life input files or original page layout differ")

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30)
    ftp.connect("server172.hosting.reg.ru", 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    home = ftp.pwd().rstrip("/")
    web = home + "/www/xn--c1adkkdfjbp1a4l.online/"
    private = home + "/private/numi-account-20261031/"
    supplements = home + "/private/numi-life-sources-20261116/"
    backups = home + "/site-safeguard-backups/"
    suffix = secrets.token_hex(8)

    def read(path):
        buffer = io.BytesIO()
        try:
            ftp.retrbinary("RETR " + path, buffer.write)
        except ftplib.error_perm as error:
            if str(error).startswith("550"):
                return None
            raise
        return buffer.getvalue()

    def write(path, data):
        ftp.storbinary("STOR " + path, io.BytesIO(data))
        if read(path) != data:
            raise RuntimeError("FTPS readback mismatch at " + path.rsplit("/", 1)[-1])

    def replace(path, data):
        staging = backups + "full-life-stage-" + suffix
        try:
            write(staging, data)
            ftp.rename(staging, path)
        finally:
            try:
                ftp.delete(staging)
            except ftplib.error_perm:
                pass

    previous = {}
    changed = []
    copies_created = []
    try:
        manifest = json.loads(read(private + "store-assets.json"))["files"]
        for energy in range(1, 23):
            name = f"knowledge/full-report/sections/energy-{energy}.json"
            original = Path(name).read_bytes()
            deployed = read(private + "store-content/" + name)
            bank = json.loads(original)
            if original != deployed or digest(original) != manifest.get(name):
                raise RuntimeError("Live original reading differs or is missing: " + name)
            if bank["id"] != energy or len(bank["sections"]) != 14 or any(
                not row["paragraphs"] for row in bank["sections"].values()
            ):
                raise RuntimeError("Original Full Life bank is incomplete: " + name)
        print("Verified all 22 original live banks, with 14 readings each, against Git and the server manifest.")

        if read(web + "pro/pro.css") != Path("pro/pro.css").read_bytes():
            raise RuntimeError("Live Full Life stylesheet differs")
        for name, data in payloads.items():
            previous[name] = read(web + name)
            if previous[name] not in (expected[name], data):
                raise RuntimeError("Unexpected live version of " + name)

        try:
            ftp.mkd(supplements.rstrip("/"))
        except ftplib.error_perm as error:
            if not str(error).startswith("550"):
                raise
        for name, source in SUPPLEMENTS.items():
            data = source.read_bytes()
            path = supplements + name
            old = read(path)
            if old is None:
                copies_created.append(path)
                write(path, data)
            elif old != data:
                raise RuntimeError("Private original copy differs: " + name)
        print("Verified original purpose, guidance and karmic files in private storage.")

        for name, data in payloads.items():
            old = previous[name]
            if old is not None and old != data:
                write(backups + "full-life-" + suffix + "-" + name.replace("/", "-") + ".bak", old)
        for name, data in payloads.items():
            if previous[name] != data:
                changed.append(name)
                replace(web + name, data)

        for name, expected_bytes in payloads.items():
            if name == API:
                if read(web + name) != expected_bytes:
                    raise RuntimeError("Server PHP does not match the released file")
                continue
            status, _, public_bytes = request("pro/" if name == "pro/index.html" else name)
            if status != 200 or public_bytes != expected_bytes:
                raise RuntimeError(f"Live Full Life file mismatch: {name}, HTTP {status}")
        status, mimetype, body = request(API, {"kind": "access", "birth_date": "1986-09-09"})
        access = json.loads(body) if mimetype == "application/json" else {}
        if status != 200 or access != {"ok": True, "owner": False, "purchased": False, "authenticated": False}:
            raise RuntimeError(f"Unexpected anonymous access response: HTTP {status}, {mimetype}")
        for energy, chapter in [(3, "trueSelf"), (6, "familyError")]:
            status, mimetype, body = request(API, {
                "kind": "section", "birth_date": "1986-09-09", "energy": energy, "chapter": chapter
            })
            if status != 403 or mimetype != "application/json" or json.loads(body).get("error") != "FULL_LIFE_ACCESS_REQUIRED":
                raise RuntimeError(f"Protected Full Life reading was not denied: HTTP {status}, {mimetype}")
        status, mimetype, body = request(API, {"kind": "karma_preview", "birth_date": "1986-09-09"})
        if status != 200 or mimetype != "application/json" or not isinstance(json.loads(body).get("count"), int):
            raise RuntimeError(f"Production PHP could not read the original karmic bank: HTTP {status}, {mimetype}")
        name = "knowledge/full-report/free/impression/energy-9.json"
        status, _, body = request(name)
        if status != 200 or body != Path(name).read_bytes():
            raise RuntimeError(f"Original free reading is unavailable: HTTP {status}")
        print("FULL_LIFE_LIVE_VERIFIED: assets, protected API, free chapter, guest paywall.")
    except BaseException:
        for name in reversed(changed):
            try:
                old = previous[name]
                deployed = read(web + name)
                if deployed == old:
                    continue
                if old is None:
                    ftp.delete(web + name)
                else:
                    replace(web + name, old)
                print("Restored previous file:", name)
            except Exception as error:
                print("Rollback failed for", name, type(error).__name__)
        for path in copies_created:
            try:
                ftp.delete(path)
            except ftplib.error_perm:
                pass
        raise
    finally:
        ftp.close()


if __name__ == "__main__":
    main()
