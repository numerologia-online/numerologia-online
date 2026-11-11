"""One-time guarded REG.RU publication of the Club-only Yes/No backend.
Only three existing PHP files: account catalog, wallet gate and Yes/No answer API.
No orders, ledger, subscriptions, data tables or answer JSON are modified.
"""
import ftplib
import hashlib
import io
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import ssl
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
BASELINE = "1f496bde450d4e2d8b006adcdd5df602bb9a5bc9"
DOMAIN = "xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
# REG.RU serves the current .рф domain from this existing website directory.
SITE_DIR = "www/xn--c1adkkdfjbp1a4l.online"
ORIGIN = "https://" + DOMAIN
TARGETS = [
    ("account-service/private/core.php", "private/numi-account-20261031/core.php"),
    ("account-service/private/wallet.php", "private/numi-account-20261031/wallet.php"),
    ("yesno-service/public/numi-yesno-answer.php", SITE_DIR + "/api/numi-yesno-answer.php"),
]

def old_bytes(path):
    return subprocess.run(
        ["git", "show", BASELINE + ":" + path],
        cwd=ROOT, check=True, capture_output=True,
    ).stdout

def digest(data):
    return hashlib.sha256(data).hexdigest()

def api(path, body=None):
    headers = {"Origin": ORIGIN, "Cache-Control": "no-cache", "User-Agent": "numi-yesno-club-only-verifier"}
    payload = None
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(ORIGIN + path, data=payload, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return response.status, json.loads(response.read(30000))
    except urllib.error.HTTPError as err:
        try:
            content = json.loads(err.read(30000))
        except ValueError:
            content = {}
        return err.code, content

def run():
    host = os.environ["REG_FTP_HOST"].strip()
    user = os.environ["REG_FTP_USER"]
    password = os.environ["REG_FTP_PASSWORD"]
    ipaddress.ip_address(host)
    ptr = socket.gethostbyaddr(host)[0].rstrip(".").lower()
    if not re.fullmatch(r"[a-z0-9.-]+\.hosting\.reg\.ru", ptr):
        raise RuntimeError("Hosting reverse DNS rejected")
    resolved = {item[4][0] for item in socket.getaddrinfo(ptr, 21, type=socket.SOCK_STREAM)}
    if host not in resolved:
        raise RuntimeError("Hosting DNS mismatch")
    fresh = {name: (ROOT / name).read_bytes() for name, _ in TARGETS}
    previous = {name: old_bytes(name) for name, _ in TARGETS}
    php = fresh["yesno-service/public/numi-yesno-answer.php"]
    core = fresh["account-service/private/core.php"]
    wallet = fresh["account-service/private/wallet.php"]
    if (b"$paidAnswer=" in php or b"if (!$member)" not in php
        or b"INSERT IGNORE INTO numi_yesno_daily_uses" not in php
        or b"naCatalogHasAccess($db,['id'=>$accountId],'club_month','club')" not in php
        or b"$price=$club?0:1900" in core
        or b"$price=0;" not in core or b"'CLUB_REQUIRED'" not in core
        or b"YESNO_CLUB_ONLY" not in wallet):
        raise RuntimeError("Club-only access source verification failed")
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=40)
    # TLS certificate is issued to the verified REG.RU hostname, not its IP.
    ftp.connect(ptr, 21)
    ftp.login(user, password)
    ftp.prot_p()
    ftp.set_pasv(True)
    try:
        home = ftp.pwd().rstrip("/")
        def remote(relative):
            return home + "/" + relative
        def read(target):
            buf = io.BytesIO()
            ftp.retrbinary("RETR " + target, buf.write)
            return buf.getvalue()
        def write(target, value):
            ftp.storbinary("STOR " + target, io.BytesIO(value))
            if digest(read(target)) != digest(value):
                raise RuntimeError("Readback mismatch")
        website = remote(SITE_DIR + "/index.html")
        home_page = read(website)
        if b"numi-account" not in home_page or b"account-browser.js" not in home_page:
            raise RuntimeError("Website root identity not confirmed")
        paths = {name: remote(dest) for name, dest in TARGETS}
        current = {name: read(paths[name]) for name, _ in TARGETS}
        # All source versions must be known BEFORE any modification.
        for name, _ in TARGETS:
            if current[name] not in (previous[name], fresh[name]):
                print("DRIFT_BLOCKED " + name + " sha256=" + digest(current[name]), flush=True)
                raise RuntimeError("Unreviewed production code; no files touched")
        changed = [name for name, _ in TARGETS if current[name] != fresh[name]]
        if changed:
            backup = remote("site-safeguard-backups/yesno-club-only-" +
                            time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()) + "-" +
                            os.environ.get("GITHUB_RUN_ID", "manual"))
            ftp.mkd(backup)
            for i, name in enumerate(changed):
                write(backup + "/" + str(i) + ".bak", current[name])
            uploaded = []
            try:
                for name in changed:
                    uploaded.append(name)
                    write(paths[name], fresh[name])
                for name, _ in TARGETS:
                    if digest(read(paths[name])) != digest(fresh[name]):
                        raise RuntimeError("Production PHP verification failed")
                status, session = api("/api/numi-yesno-answer.php?status=1")
                if status != 200 or session.get("authenticated") is not False or session.get("remaining") != 0:
                    raise RuntimeError("Anonymous Yes/No status regression")
                status, denied = api("/api/numi-yesno-answer.php", {"question":"yn-man-001","time":"12:34"})
                if status != 401 or denied.get("error") != "LOGIN_REQUIRED":
                    raise RuntimeError("Anonymous answer not protected")
                status, quote = api("/api/numi-account.php", {
                    "action":"product_quote","product_code":"yesno_question",
                    "question_id":"yn-man-001","question_time":"12:34"
                })
                if (status != 200 or quote.get("ok") is not True
                    or quote.get("price_kopeks") != 0
                    or quote.get("availability") != "CLUB_REQUIRED"
                    or quote.get("member_included") is not False
                    or quote.get("checkout_enabled") is not False):
                    raise RuntimeError("Public Yes/No purchase was not disabled")
                print("YESNO_CLUB_ONLY_VERIFIED " + json.dumps({
                    "changed":changed,"backup":backup.rsplit("/",1)[-1],
                    "guest_daily_free":1,"individual_price_kopeks":0,
                    "subscription_only_after_free":True,"anonymous_protected":True,
                }),flush=True)
            except BaseException:
                for name in reversed(uploaded):
                    write(paths[name], current[name])
                raise
        else:
            print("YESNO_CLUB_ONLY_ALREADY_CURRENT",flush=True)

        # A live independent edit makes the complete GitHub prices.html unsafe to
        # overwrite. Change ONLY the exact obsolete Yes/No row in-place.
        price_path=remote(SITE_DIR + "/prices.html")
        old_prices=read(price_path)
        if len(old_prices)>200000:
            raise RuntimeError("Public prices file unexpectedly large")
        before=('<div class="item"><div class="name"><a href="/moment/yes-no/">'
                'Вопрос «Да или нет?»</a><span class="desc">Один ответ на выбранный вопрос'
                '</span></div><div class="price">19 ₽</div><div class="member">'
                'Бесплатно<small>В составе клуба</small></div></div>').encode("utf-8")
        after=('<div class="item"><div class="name"><a href="/moment/yes-no/">'
               'Вопросы «Да или нет?»</a><span class="desc">Без подписки один бесплатный '
               'ответ в день, дополнительные ответы только в Клубе</span></div>'
               '<div class="price">1 в день бесплатно</div>'
               '<div class="member">Все 100 без доплаты'
               '<small>С подпиской Клуба 490 ₽/мес.</small></div></div>').encode("utf-8")
        if old_prices.count(before)==0 and old_prices.count(after)==1:
            print("YESNO_PUBLIC_PRICES_ALREADY_CORRECT",flush=True)
        elif old_prices.count(before)!=1 or old_prices.count(after)!=0:
            needle="Да или нет".encode("utf-8")
            start=old_prices.find(needle)
            excerpt=old_prices[max(0,start-330):start+440].decode("utf-8",errors="replace") if start>=0 else "NO_ROW"
            body=old_prices.decode("utf-8",errors="replace")
            markers=["Да или нет","да или нет","yesno","yes-no","19 ₽","Вопрос","вопрос","Цена"]
            positions={key:body.find(key) for key in markers}
            print("PUBLIC_PRICES_READONLY_DIAGNOSTIC " + json.dumps({
                "bytes":len(old_prices),"sha256":digest(old_prices),
                "heading":body[:850],"positions":positions,
                "match":excerpt[:470]
            },ensure_ascii=False),flush=True)
            raise RuntimeError("Price row changed independently; refused unsafe replacement")
        else:
            price_backup=remote("site-safeguard-backups/yesno-price-only-" +
                                time.strftime("%Y%m%dT%H%M%SZ",time.gmtime()) + "-" +
                                os.environ.get("GITHUB_RUN_ID","manual"))
            ftp.mkd(price_backup)
            write(price_backup+"/prices.html.bak",old_prices)
            try:
                revised=old_prices.replace(before,after)
                write(price_path,revised)
                if read(price_path)!=revised:
                    raise RuntimeError("Exact price-row patch not verified")
                print("YESNO_PUBLIC_PRICES_PATCHED_VERIFIED " +
                      json.dumps({"backup":price_backup.rsplit("/",1)[-1],
                                  "changed_rows":1,"unrelated_bytes_preserved":True}),flush=True)
            except BaseException:
                write(price_path,old_prices)
                raise
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()

if __name__ == "__main__":
    run()
