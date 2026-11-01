"""Publish identical one-step '← Назад' control across the Yes/No page and its question dialog.
Safeguarded against concurrent edits, with on-server backups and rollback.
Only moment/yes-no/{index.html,yes-no.css,yes-no.js} may change.
"""
import ftplib, hashlib, io, json, os, pathlib, ssl, subprocess, sys, time, urllib.request

SERVER = "server172.hosting.reg.ru"
DOMAIN = "xn--c1adkkdfjbp1a4l.online"
SECTION = "moment/yes-no"
OLD_CSS = "015b3b98fb5c8f2a193cc013c9900e3fdbd46c90"
OLD_JS = "789ea678ac7a51c4ae2fa9cb5bbca42307e96bed"

def log(**kv):
    print("YESNO_UNIFIED_BACK " + json.dumps(kv, ensure_ascii=False, sort_keys=True), flush=True)

def digest(b):
    return hashlib.sha256(b).hexdigest()

def git_blob(sha):
    return subprocess.check_output(["git", "show", sha])

def replace_once(blob, old, new):
    old, new = old.encode("utf-8"), new.encode("utf-8")
    if blob.count(old) != 1:
        raise RuntimeError("Unexpected HTML section: " + old.decode("utf-8")[:80])
    return blob.replace(old, new, 1)

def transform_html(original):
    if b'./yes-no.css?v=8' in original and b'./yes-no.js?v=3' in original:
        if original.count(b'id="yn-all"') == 1 and original.count(b'id="yn-back"') == 1:
            return original
        raise RuntimeError("New HTML version has unexpected Back control markup")
    html = original
    edits = [
        ('./yes-no.css?v=7', './yes-no.css?v=8'),
        ('./yes-no.js?v=2', './yes-no.js?v=3'),
        ('<section class="yn-directory shell" aria-label="100 вопросов Да или нет">\n      <p class="overline">',
         '<section class="yn-directory shell" aria-label="100 вопросов Да или нет">\n      <button id="yn-all" type="button" class="yn-back-top">← Назад</button>\n      <p class="overline">'),
        ('<div id="yn-panel" class="yn-results" hidden>\n        <button id="yn-all" type="button" class="yn-back-top">← Назад к темам</button>',
         '<div id="yn-panel" class="yn-results" hidden>'),
        ('<div class="dialog-content">\n      <div class="dialog-top">',
         '<div class="dialog-content">\n      <button id="yn-back" type="button" class="yn-back-top">← Назад</button>\n      <div class="dialog-top">'),
        ('      <button id="yn-back" class="secondary-button" type="button">Выбрать другой вопрос</button>\n', '')
    ]
    for before, after in edits:
        html = replace_once(html, before, after)
    if html.count(b'id="yn-all"') != 1 or html.count(b'id="yn-back"') != 1:
        raise RuntimeError("Duplicate or missing Back control")
    return html

def public_get(name):
    req = urllib.request.Request(
        "https://" + DOMAIN + "/" + SECTION + "/" + name + "?back_release=" + str(time.time_ns()),
        headers={"Cache-Control": "no-cache", "Pragma": "no-cache", "User-Agent": "numi-back-verifier/1.0"})
    with urllib.request.urlopen(req, timeout=35) as response:
        if response.status != 200: raise RuntimeError("Public content unavailable: " + name)
        return response.read(1000000)

def main():
    folder = pathlib.Path(SECTION)
    new_css = (folder / "yes-no.css").read_bytes()
    new_js = (folder / "yes-no.js").read_bytes()
    target_html_source = (folder / "index.html").read_bytes()
    assert b'.yn-directory>.yn-back-top' in new_css
    assert b'#yn-dialog .yn-back-top' in new_css
    assert b'if (active) showCategories()' in new_js
    assert b'window.location.assign("../")' in new_js
    assert target_html_source.count('← Назад'.encode("utf-8")) == 2
    assert b'./yes-no.css?v=8' in target_html_source and b'./yes-no.js?v=3' in target_html_source
    assert new_css.count(b'{') == new_css.count(b'}')

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=35)
    ftp.connect(SERVER, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p(); ftp.set_pasv(True)
    root = ftp.pwd().rstrip("/")
    live = root + "/www/" + DOMAIN + "/" + SECTION
    backup = root + "/site-safeguard-backups/yesno-unified-back-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    names = ("index.html", "yes-no.css", "yes-no.js")
    original = {}
    replaced = []
    def read(remote):
        buffer = io.BytesIO()
        ftp.retrbinary("RETR " + remote, buffer.write)
        return buffer.getvalue()
    def write(remote, data):
        ftp.storbinary("STOR " + remote, io.BytesIO(data))
        if digest(read(remote)) != digest(data):
            raise RuntimeError("FTPS verification failed: " + remote)

    try:
        for name in names: original[name] = read(live + "/" + name)
        if original["yes-no.css"] not in (git_blob(OLD_CSS), new_css):
            raise RuntimeError("Production stylesheet has independent edits")
        if original["yes-no.js"] not in (git_blob(OLD_JS), new_js):
            raise RuntimeError("Production question logic has independent edits")
        updated_html = transform_html(original["index.html"])
        expected = {"index.html": updated_html, "yes-no.css": new_css, "yes-no.js": new_js}
        if b'← Назад</button>' not in expected["index.html"]: raise RuntimeError("Back text mismatch")
        try: ftp.mkd(root + "/site-safeguard-backups")
        except ftplib.error_perm: pass
        ftp.mkd(backup)
        for name in names: write(backup + "/" + name + ".bak", original[name])
        log(backup_completed=True, files=names, unrelated_files_unchanged=True)
        try:
            # Deploy CSS and JS first, then atomically expose new versions through HTML.
            for name in ("yes-no.css", "yes-no.js", "index.html"):
                if original[name] != expected[name]:
                    write(live + "/" + name, expected[name])
                    replaced.append(name)
            for name in names:
                if digest(public_get(name)) != digest(expected[name]):
                    raise RuntimeError("Public checksum mismatch: " + name)
            log(success=True, verified=True, restored_navigation=True,
                levels=["answer-to-questions", "questions-to-topics", "topics-to-moment"],
                questions_unchanged=True, changed=replaced)
        except BaseException:
            for name in reversed(replaced):
                try: write(live + "/" + name, original[name])
                except BaseException as error: log(rollback_failed=name, error=type(error).__name__)
            log(rollback_attempted=True)
            raise
    finally:
        try: ftp.quit()
        except BaseException: ftp.close()

if __name__ == "__main__":
    try: main()
    except BaseException as error:
        log(success=False, error=type(error).__name__, message=str(error)[:250]); sys.exit(1)
