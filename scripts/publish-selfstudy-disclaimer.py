"""Surgically publish revised self-study labels and disclaimer to REG.RU.
Each existing HTML file is patched in place, preserving unrelated production edits.
Back up every affected original outside web root; rollback all on any failure.
No PHP, database, auth, payments, paid content, DNS or Telegram changes.
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
GUARD_MARKER = b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31"
FOOTER_MARKER = b"NUMI PRIVACY FOOTER: standalone document"
PROTECTED = [".htaccess", "privacy.html", "offer.html", "refunds.html", "terms.html"]

def digest(data):
    return hashlib.sha256(data).digest()

def public_read(path):
    req = Request(
        "https://" + DOMAIN + "/" + path + "?selfstudy_release=" + str(time.time_ns()),
        headers={"Cache-Control": "no-cache"}
    )
    with urlopen(req, timeout=40) as resp:
        if resp.status != 200:
            raise RuntimeError("HTTP error verifying " + path)
        return resp.read(3_000_000)

def main():
    manifest = json.loads(pathlib.Path("scripts/selfstudy-disclaimer-patches.json").read_text("utf-8"))
    changes = manifest["changes"]
    assert len(changes) == 7 and "index.html" in changes
    desired_page = pathlib.Path("disclaimer.html").read_bytes()
    if not (desired_page.startswith(b"<!doctype html>") and
            desired_page.count(b'class="disc-section"') == 14 and
            b'href="/terms.html"' in desired_page):
        raise RuntimeError("Disclaimer source has changed")
    for value in ("Классическая нумерология", "квадрату Пифагора", "Матрица судьбы",
                  "Нумерология с нуля", "online.numerology.info@yandex.ru"):
        if value.encode("utf-8") not in desired_page:
            raise RuntimeError("Disclaimer required detail missing: " + value)
    for path, patches in changes.items():
        if not path.endswith(".html") or ".." in pathlib.PurePosixPath(path).parts:
            raise RuntimeError("Unsafe path in approved manifest")
        source = pathlib.Path(path).read_bytes()
        for before, after in patches:
            if not before or not after or before == after:
                raise RuntimeError("Malformed patch")
            if source.count(after.encode("utf-8")) != 1:
                raise RuntimeError("Expected approved text missing in repository: " + path)

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=40)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    root = ftp.pwd().rstrip("/")
    site = root + "/www/" + DOMAIN

    def read(path, optional=False):
        out = io.BytesIO()
        try:
            ftp.retrbinary("RETR " + path, out.write)
            return out.getvalue()
        except ftplib.error_perm as exc:
            if optional and str(exc).startswith("550"):
                return None
            raise

    def write(path, data):
        ftp.storbinary("STOR " + path, io.BytesIO(data))
        if digest(read(path)) != digest(data):
            raise RuntimeError("Remote file checksum mismatch: " + path)

    files = {name: site + "/" + name for name in changes}
    files["disclaimer.html"] = site + "/disclaimer.html"
    try:
        known = {name: read(site + "/" + name) for name in PROTECTED}
        if GUARD_MARKER not in known[".htaccess"]:
            raise RuntimeError("Paid-content guard marker missing; no changes made")
        current = {name: read(remote) for name, remote in files.items()
                   if name != "disclaimer.html"}
        existing_disclaimer = read(files["disclaimer.html"], optional=True)
        if existing_disclaimer is not None and existing_disclaimer != desired_page:
            if not (existing_disclaimer.lstrip().lower().startswith(b"<!doctype html>") and
                    "Дисклеймер".encode("utf-8") in existing_disclaimer):
                raise RuntimeError("Unrecognized preexisting disclaimer; no changes")
        if FOOTER_MARKER not in current["index.html"]:
            raise RuntimeError("Unknown production homepage; no changes")
        updated = {}
        for name, content in current.items():
            patched = content
            for before, after in changes[name]:
                old, new = before.encode("utf-8"), after.encode("utf-8")
                if patched.count(new) == 1:
                    continue
                if patched.count(old) != 1 or patched.count(new) != 0:
                    raise RuntimeError("Different live HTML label in " + name +
                                       " near " + before[:45])
                patched = patched.replace(old, new, 1)
            updated[name] = patched

        homepage = updated["index.html"]
        if not all(homepage.count(b'href="/' + n + b'.html"') == 1
                   for n in [b"privacy", b"offer", b"refunds", b"terms", b"disclaimer"]):
            raise RuntimeError("Homepage footer legal links are not unique")
        if not all(token.encode("utf-8") in homepage for token in
                   ["Нумерология с нуля", "Открыть самоучитель"]):
            raise RuntimeError("Homepage school rename missing")
        if not all(token.encode("utf-8") in updated["pro/schools/index.html"]
                   for token in ["Нумерология с нуля", "Самоучитель по нумерологии"]):
            raise RuntimeError("Self-study catalog missing")

        changed = [name for name in changes if current[name] != updated[name]]
        if existing_disclaimer != desired_page:
            changed.append("disclaimer.html")
        if not changed:
            if digest(public_read("disclaimer.html")) != digest(desired_page):
                raise RuntimeError("Previously deployed disclaimer is unreachable")
            print("NUMI_SELFSTUDY success=true already_published=true", flush=True)
            return

        backup_root = root + "/site-safeguard-backups"
        try:
            ftp.mkd(backup_root)
        except ftplib.error_perm:
            ftp.cwd(backup_root)
        backup = backup_root + "/selfstudy-disclaimer-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        ftp.mkd(backup)
        for index, name in enumerate(changed):
            old = existing_disclaimer if name == "disclaimer.html" else current[name]
            if old is not None:
                write(backup + "/" + str(index).zfill(2) + ".bak", old)
        print("NUMI_SELFSTUDY backups_complete=true count=" + str(len(changed)), flush=True)

        uploaded = []
        try:
            order = [x for x in changed if x != "index.html"] + (["index.html"] if "index.html" in changed else [])
            for name in order:
                expected = existing_disclaimer if name == "disclaimer.html" else current[name]
                if read(files[name], optional=(expected is None)) != expected:
                    raise RuntimeError("Production file changed concurrently: " + name)
                uploaded.append(name)
                write(files[name], desired_page if name == "disclaimer.html" else updated[name])
            for name in order:
                expected = desired_page if name == "disclaimer.html" else updated[name]
                if digest(public_read(name if name != "index.html" else "")) != digest(expected):
                    raise RuntimeError("Public page differs from release: " + name)
            for name, old in known.items():
                if read(site + "/" + name) != old:
                    raise RuntimeError("Existing legal/security document changed: " + name)
            print("NUMI_SELFSTUDY success=true verified=true updated=" + ",".join(order), flush=True)
        except BaseException:
            for name in reversed(uploaded):
                try:
                    if name == "disclaimer.html":
                        if existing_disclaimer is None:
                            ftp.delete(files[name])
                        else:
                            write(files[name], existing_disclaimer)
                    else:
                        write(files[name], current[name])
                    print("NUMI_SELFSTUDY rollback=" + name, flush=True)
                except BaseException:
                    print("NUMI_SELFSTUDY rollback_failed=" + name, flush=True)
            raise
    finally:
        try:
            ftp.quit()
        except BaseException:
            ftp.close()

if __name__ == "__main__":
    try:
        main()
    except BaseException as exc:
        print("NUMI_SELFSTUDY success=false reason=" + str(exc)[:250], flush=True)
        sys.exit(1)
