"""Deploy only confirmation-ready account JS and its versioned homepage script tag.
Requires REG_FTP_USER and REG_FTP_PASSWORD GitHub Actions secrets.
Never touches database, Telegram login, paywalls or backend PHP.
"""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import ssl
import subprocess
import sys
import time
from urllib.request import Request, urlopen

DOMAIN = "xn--c1adkkdfjbp1a4l.online"
HOST = "server172.hosting.reg.ru"
OLD_COMMIT = "8526946c219af9036231bdfb77a18503da550c6e"
SITE_SUFFIX = "/www/" + DOMAIN

def digest(data):
    return hashlib.sha256(data).digest()

def report(**values):
    print("NUMI_CONFIRMATION_UI", json.dumps(values, sort_keys=True), flush=True)

def http_get(path):
    request = Request("https://" + DOMAIN + "/" + path + "?confirmed_ui=" + str(time.time_ns()),
                      headers={"Cache-Control": "no-cache"})
    with urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError("Unexpected live response")
        return response.read(2000000)

def main():
    js = pathlib.Path("account-browser.js").read_bytes()
    old_js = subprocess.check_output(["git", "show", OLD_COMMIT + "^:account-browser.js"])
    old_script = b'account-browser.js?v=1'
    new_script = b'account-browser.js?v=2'
    if js == old_js or b'password_confirm' not in js or b'naSendVerify' in js:
        raise RuntimeError("Unexpected account frontend update")
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    home = ftp.pwd().rstrip("/")
    site = home + SITE_SUFFIX
    def read(path):
        buffer = io.BytesIO()
        ftp.retrbinary("RETR " + path, buffer.write)
        return buffer.getvalue()
    def write(path, data):
        ftp.storbinary("STOR " + path, io.BytesIO(data))
        if digest(read(path)) != digest(data):
            raise RuntimeError("Remote write integrity mismatch")
    try:
        remote_index = site + "/index.html"
        remote_js = site + "/account-browser.js"
        original_index = read(remote_index)
        original_js = read(remote_js)
        guard = read(site + "/.htaccess")
        telegram = read(site + "/auth-profile.js")
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("Paid material guard missing; refuse publishing")
        if original_index.count(old_script) != 1 or new_script in original_index:
            raise RuntimeError("Unexpected homepage revision; refuse overwriting")
        if digest(original_js) != digest(old_js):
            raise RuntimeError("Live account JS differs from expected baseline; refuse overwriting")
        new_index = original_index.replace(old_script, new_script, 1)
        backup_folder = home + "/site-safeguard-backups"
        try:
            ftp.mkd(backup_folder)
        except ftplib.error_perm:
            ftp.cwd(backup_folder)
        backup = backup_folder + "/account-confirmation-ui-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        ftp.mkd(backup)
        write(backup + "/index.html", original_index)
        write(backup + "/account-browser.js", original_js)
        report(backup_saved=True, scope="account JS and its script version only")
        modified = []
        try:
            write(remote_js, js)
            modified.append("js")
            write(remote_index, new_index)
            modified.append("index")
            if digest(http_get("account-browser.js")) != digest(js):
                raise RuntimeError("Published JS does not match current source")
            if digest(http_get("")) != digest(new_index):
                raise RuntimeError("Published homepage mismatch")
            if read(site + "/auth-profile.js") != telegram or read(site + "/.htaccess") != guard:
                raise RuntimeError("Protected site baseline changed")
            report(success=True, password_confirmation_live=True,
                   backend_modified=False, database_modified=False,
                   telegram_modified=False, paid_content_modified=False)
        except BaseException:
            if "index" in modified:
                write(remote_index, original_index)
            if "js" in modified:
                write(remote_js, original_js)
            report(rollback_completed=True)
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
        report(success=False, stopped=type(error).__name__,
               reason=str(error)[:160] if isinstance(error, RuntimeError) else "connection_or_host_error")
        sys.exit(1)
