"""Guarded one-time deployment: centered Moment heading + beige category cards only."""
import ftplib, hashlib, io, json, os, pathlib, ssl, subprocess, sys, time
from urllib.request import Request, urlopen

HOST = "server172.hosting.reg.ru"
DOMAIN = "xn--c1adkkdfjbp1a4l.online"
OLD_INDEX = "46b0ed110458f53d7646767df1433fd99c4f4612"
OLD_CSS = "926a803746effe1e4be2e050027c7b68ecdd2d9d"
FILES = ("index.html", "moment.css")

def sha(payload): return hashlib.sha256(payload).hexdigest()
def log(**data): print("MOMENT_BEIGE_CATEGORIES " + json.dumps(data, ensure_ascii=False, sort_keys=True), flush=True)
def git_blob(blob): return subprocess.check_output(["git", "show", blob])

def public(name):
    url = "https://" + DOMAIN + "/moment/" + name + "?beige_qa=" + str(time.time_ns())
    req = Request(url, headers={"Cache-Control":"no-cache","Pragma":"no-cache","User-Agent":"numi-beige-categories-release/1.0"})
    with urlopen(req, timeout=40) as response:
        if response.status != 200: raise RuntimeError("Unexpected HTTP status for " + name)
        return response.read(1000000)

def validate(old_html, old_css, new_html, new_css):
    previous_heading = ('''      <div class="section-heading">
        <div><p class="overline">ВАША БИБЛИОТЕКА ВОПРОСОВ</p><h2>Выберите, что сейчас важно</h2></div>
        <p class="section-note">Без бесконечных списков — по темам, с поиском и удобным выбором.</p>
      </div>''').encode("utf-8")
    new_heading = ('''      <div class="section-heading">
        <h2>Выберите, что сейчас важно</h2>
      </div>''').encode("utf-8")
    if old_html.count(previous_heading) != 1: raise RuntimeError("Baseline heading differs")
    if old_html.count(b'./moment.css?v=1') != 1: raise RuntimeError("Old CSS version missing")
    expected_html = old_html.replace(previous_heading, new_heading, 1).replace(
        b'./moment.css?v=1', b'./moment.css?v=2', 1)
    if expected_html != new_html: raise RuntimeError("Unrelated HTML changes detected")
    if not new_css.startswith(old_css): raise RuntimeError("Existing CSS rules modified")
    added = new_css[len(old_css):]
    if (b'.explore .section-heading{display:flex;justify-content:center' not in added
        or b'.explore .category{background:#f3f0e7' not in added
        or b'.explore .category.active{background:#eee7d8' not in added
        or b'.explore .category-grid{gap:13px' not in added
        or new_css.count(b'{') != new_css.count(b'}')):
        raise RuntimeError("Beige styles incomplete")
    if new_html.count(b'href="./yes-no/"') != 1: raise RuntimeError("Yes/No card missing")
    data = json.loads(pathlib.Path("moment/questions.json").read_text("utf-8"))
    cats = data["categories"]
    questions = data["questions"]
    if len(cats) != 12 or len(questions) != 300: raise RuntimeError("Question catalog changed")
    if len({q["id"] for q in questions}) != 300: raise RuntimeError("Duplicate questions")
    log(checked=True, categories=12, questions=300, original_yesno_card=True)

def main():
    old = {"index.html": git_blob(OLD_INDEX), "moment.css": git_blob(OLD_CSS)}
    new = {name: pathlib.Path("moment", name).read_bytes() for name in FILES}
    validate(old["index.html"],old["moment.css"],new["index.html"],new["moment.css"])
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    base = ftp.pwd().rstrip("/")
    site = base + "/www/" + DOMAIN + "/moment"
    backups = base + "/site-safeguard-backups"
    archive = backups + "/moment-beige-categories-" + time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())

    def read(remote):
        buff = io.BytesIO()
        ftp.retrbinary("RETR " + remote,buff.write)
        return buff.getvalue()
    def write(remote,data):
        ftp.storbinary("STOR " + remote,io.BytesIO(data))
        if sha(read(remote)) != sha(data): raise RuntimeError("FTP readback mismatch")

    changed = []
    try:
        before = {name:read(site+"/"+name) for name in FILES}
        for name in FILES:
            if before[name] not in (old[name], new[name]):
                raise RuntimeError("Live " + name + " contains independent changes, refusing overwrite")
        try:ftp.mkd(backups)
        except ftplib.error_perm:pass
        ftp.mkd(archive)
        for name in FILES:write(archive+"/"+name+".bak",before[name])
        log(backup_completed=True,files=list(FILES),other_site_files_untouched=True)
        try:
            for name in ("moment.css","index.html"):
                if before[name] != new[name]:
                    write(site+"/"+name,new[name])
                    changed.append(name)
            for name in FILES:
                if sha(public(name)) != sha(new[name]):
                    raise RuntimeError("Public HTTP checksum mismatch for " + name)
            log(success=True,public_verified=True,centered_heading=True,beige_cards=True,
                questions_untouched=True,yes_no_untouched=True,changed=changed)
        except BaseException:
            for name in reversed(changed):
                try:write(site+"/"+name,before[name])
                except BaseException as error:log(rollback_failed=name,error=type(error).__name__)
            log(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:main()
    except BaseException as error:
        log(success=False,reason=str(error)[:230]);sys.exit(1)
