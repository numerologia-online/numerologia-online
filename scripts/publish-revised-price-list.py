"""Publish reviewed tariff changes to REG.RU while preserving all unrelated live code.
Only explicit, one-occurrence, reviewed price labels are changed in index/pro/child;
the public price-list document is replaced only when identified by its own marker.
Backups stored outside public directory, verified via FTP + live HTTPS, rollback on error.
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
GUARD = b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31"
MARKER = b"NUMI PUBLIC PRICE LIST 2026-11-03"
PATCHES = json.loads(r'''[{"path":"index.html","replacements":[["<div class=\"numi-tariff-head\" role=\"row\"><span role=\"columnheader\">Раздел</span><span role=\"columnheader\">Разово</span><span role=\"columnheader\">♕ В клубе</span></div>","<div class=\"numi-tariff-head\" role=\"row\"><span role=\"columnheader\">Раздел</span><span role=\"columnheader\">Без подписки</span><span role=\"columnheader\">По подписке</span></div>"],["<div class=\"numi-tariff-row\" role=\"row\"><strong role=\"cell\">Полный разбор жизни</strong><span role=\"cell\">990 ₽</span><span role=\"cell\" class=\"numi-club-discount\">−50%</span></div>","<div class=\"numi-tariff-row\" role=\"row\"><strong role=\"cell\">Полный разбор жизни</strong><span role=\"cell\">990 ₽</span><span role=\"cell\" class=\"numi-club-discount\">−50%</span></div>\n            <div class=\"numi-tariff-row\" role=\"row\"><strong role=\"cell\">Детский разбор</strong><span role=\"cell\">990 ₽</span><span role=\"cell\" class=\"numi-club-discount\">490 ₽</span></div>"],["<span role=\"cell\">19–49 ₽<small>за вопрос</small></span>\n              <span role=\"cell\" class=\"numi-club-discount\">−50%<small>на вопросы</small></span>","<span role=\"cell\">20 / 39 / 79 ₽<small>за вопрос</small></span>\n              <span role=\"cell\" class=\"numi-club-discount\">10 / 19 / 39 ₽<small>по подписке</small></span>"],["<div class=\"numi-tariff-row\" role=\"row\"><strong role=\"cell\">Нумерология момента</strong><span role=\"cell\">100 ₽</span><span role=\"cell\" class=\"numi-club-discount\">−50%</span></div>","<div class=\"numi-tariff-row\" role=\"row\"><strong role=\"cell\">Нумерология момента</strong><span role=\"cell\">50 ₽</span><span role=\"cell\" class=\"numi-club-discount\">25 ₽</span></div>"]]},{"path":"child/index.html","replacements":[["Открыть полный разбор и PDF · 490 ₽","Открыть полный разбор и PDF · 990 ₽"],["<p><strong>Первая глава - бесплатно.</strong> Остальные 20 глав и PDF откроются после покупки для одного ребёнка.</p>","<p><strong>Первая глава - бесплатно.</strong> Остальные 20 глав и PDF откроются после покупки для одного ребёнка. Без подписки — 990 ₽, по подписке — 490 ₽.</p>"],["<span>Полный PDF · разовая покупка</span>\n      <strong>490 ₽</strong>","<span>Полный PDF · без подписки</span>\n      <strong>990 ₽</strong>"],["    <button id=\"child-pdf-save\" class=\"child-pdf-save\" type=\"button\" disabled>","<p class=\"child-pdf-save-help\">По подписке — 490 ₽. Подписка оплачивается отдельно.</p>\n    <button id=\"child-pdf-save\" class=\"child-pdf-save\" type=\"button\" disabled>"]]},{"path":"pro/index.html","replacements":[["<td><strong>19–59 ₽</strong><small>За один вопрос</small></td>","<td><strong>20 / 39 / 79 ₽</strong><small>За один вопрос</small></td>"],["<td class=\"pro-paywall-matrix-in pro-paywall-matrix-discount\"><strong>✓ −50%</strong><small>На каждый вопрос</small></td>","<td class=\"pro-paywall-matrix-in pro-paywall-matrix-discount\"><strong>✓ 10 / 19 / 39 ₽</strong><small>За один вопрос</small></td>"],["<td><strong>100 ₽*</strong><small>За вопрос</small></td>","<td><strong>50 ₽*</strong><small>За вопрос</small></td>"],["<td class=\"pro-paywall-matrix-in pro-paywall-matrix-discount\"><strong>✓ −50%</strong><small>На важные вопросы</small></td>","<td class=\"pro-paywall-matrix-in pro-paywall-matrix-discount\"><strong>✓ 25 ₽*</strong><small>За вопрос</small></td>"]]}]''')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def get_http(path):
    request = Request(
        "https://" + DOMAIN + "/" + path +
        ("&" if "?" in path else "?") + "tariff_sync=" + str(time.time_ns()),
        headers={"Cache-Control": "no-cache"}
    )
    with urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError("Unexpected public response status for " + path)
        return response.read(3_000_000)

def apply_changes(live, source, patches, path):
    changed = live
    for i, (old_str, new_str) in enumerate(patches, start=1):
        old = old_str.encode("utf-8")
        new = new_str.encode("utf-8")
        if source.count(new) != 1:
            raise RuntimeError("Approved source marker invalid at " + path + "/" + str(i))
        if changed.count(new) == 1:
            continue
        if changed.count(old) != 1:
            raise RuntimeError("Unknown live layout, refusing " + path + "/" + str(i))
        changed = changed.replace(old, new, 1)
    return changed

def main():
    approved = pathlib.Path("prices.html").read_bytes()
    if MARKER not in approved or len(approved) < 7000:
        raise RuntimeError("Unrecognized public price source")
    for phrase in ("Детский разбор", "990 ₽", "490 ₽", "50 ₽", "25 ₽",
                   "20 ₽", "10 ₽", "39 ₽", "19 ₽", "79 ₽",
                   "Без подписки", "По подписке"):
        if phrase.encode("utf-8") not in approved:
            raise RuntimeError("Missing approved price or label: " + phrase)
    if "100 ₽".encode() in approved or "Отдельная цена не установлена".encode() in approved:
        raise RuntimeError("Old price remains in approved price source")

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=45)
    ftp.connect(HOST, 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    root = ftp.pwd().rstrip("/")
    site = root + "/www/" + DOMAIN

    def download(filename):
        output = io.BytesIO()
        ftp.retrbinary("RETR " + site + "/" + filename, output.write)
        return output.getvalue()

    def upload(path, body):
        ftp.storbinary("STOR " + path, io.BytesIO(body))
        output = io.BytesIO()
        ftp.retrbinary("RETR " + path, output.write)
        if sha(output.getvalue()) != sha(body):
            raise RuntimeError("Uploaded content differs: " + path.split("/")[-1])

    try:
        guard = download(".htaccess")
        offer = download("offer.html")
        if GUARD not in guard:
            raise RuntimeError("Paid-content protection missing")
        filenames = [entry["path"] for entry in PATCHES] + ["prices.html"]
        before = {name: download(name) for name in filenames}
        if MARKER not in before["prices.html"]:
            raise RuntimeError("Existing price page unrecognized")

        after = {}
        for entry in PATCHES:
            name = entry["path"]
            source = pathlib.Path(name).read_bytes()
            after[name] = apply_changes(before[name], source, entry["replacements"], name)
        after["prices.html"] = approved

        changed_names = [name for name in filenames if before[name] != after[name]]
        if not changed_names:
            if sha(get_http("prices.html")) != sha(approved):
                raise RuntimeError("Live price page not verified")
            print("NUMI_PRICE_SYNC success=true already_published=true live_verified=true", flush=True)
            return

        backup_root = root + "/site-safeguard-backups"
        try:
            ftp.mkd(backup_root)
        except ftplib.error_perm:
            ftp.cwd(backup_root)
        backup_folder = backup_root + "/tariff-revision-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        ftp.mkd(backup_folder)
        for name in changed_names:
            # Preserve nested original paths in filenames, not in public document root.
            upload(backup_folder + "/" + name.replace("/", "__") + ".bak", before[name])
        print("NUMI_PRICE_SYNC backup=true files=" + ",".join(changed_names), flush=True)

        attempted = []
        try:
            for name in changed_names:
                attempted.append(name)
                upload(site + "/" + name, after[name])
            for name in changed_names:
                if sha(get_http(name)) != sha(after[name]):
                    raise RuntimeError("Live HTTPS mismatch: " + name)
            if download(".htaccess") != guard or download("offer.html") != offer:
                raise RuntimeError("Protected files unexpectedly changed")
            print("NUMI_PRICE_SYNC success=true live_verified=true files=" + ",".join(changed_names), flush=True)
        except BaseException:
            for name in reversed(attempted):
                try:
                    upload(site + "/" + name, before[name])
                    print("NUMI_PRICE_SYNC rollback=" + name, flush=True)
                except BaseException:
                    print("NUMI_PRICE_SYNC rollback_failed=" + name, flush=True)
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
        print("NUMI_PRICE_SYNC success=false reason=" + type(exc).__name__ + ":" + str(exc)[:200], flush=True)
        sys.exit(1)
