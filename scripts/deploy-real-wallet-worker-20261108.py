"""Publish the private REAL-wallet automation and authorize additive schema only.

Never writes live YooKassa credentials and never enables customer charges.
Uses the existing GitHub FTPS secret as the secret root for a distinct
domain-separated automation token. No FTP password or token is printed.
"""
import ftplib
import hashlib
import hmac
import io
import json
import os
import pathlib
import ssl
import subprocess
import time
import urllib.error
import urllib.request

HOST = "server172.hosting.reg.ru"
WEBROOT = "xn--c1adkkdfjbp1a4l.online"
DOMAIN = "xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
LIMIT = 700000

def approved_version(path, data):
    if data is None:
        return True
    if data == pathlib.Path(path).read_bytes():
        return True
    revisions = subprocess.check_output(
        ["git", "log", "-60", "--format=%H", "--", path], text=True
    ).splitlines()
    for revision in revisions:
        old = subprocess.run(
            ["git", "show", revision + ":" + path], capture_output=True
        )
        if old.returncode == 0 and old.stdout == data:
            return True
    return False

def main():
    user, password = os.environ.get("REG_FTP_USER"), os.environ.get("REG_FTP_PASSWORD")
    if not user or not password:
        raise RuntimeError("REG_FTP_SECRETS_REQUIRED")
    token = hmac.new(password.encode(), b"numi-real-wallet-worker-v1@xn----8sbhhqijddjgdebdz2c2o.xn--p1ai", hashlib.sha256).hexdigest()
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    worker_cfg = (
        "<?php\n"
        "declare(strict_types=1);\n"
        "return [\n"
        "    'worker_token_hash' => '" + token_hash + "',\n"
        "    'allow_additive_migration' => true,\n"
        "];\n"
    ).encode()
    # Extend the established guarded publisher; do not introduce a second
    # deployment system, new branches or new production directories.
    source_paths = {
        "core.php": "account-service/private/core.php",
        "wallet-real.php": "account-service/private/wallet-real.php",
        "wallet-real-payment.php": "account-service/private/wallet-real-payment.php",
        "wallet-real-worker.php": "account-service/private/wallet-real-worker.php",
        "subscriptions.php": "account-service/private/subscriptions.php",
        "store.php": "account-service/private/store.php",
        "fulfillment.php": "account-service/private/fulfillment.php",
        "account-browser.js": "account-browser.js",
        # Existing site modules only; no new deployment engine or extra folder.
        "store-entry.js": "store-entry.js",
        "wallet-client.js": "wallet-client.js",
        "redflag-feature.js": "redflag-feature.js",
        "shared-offer.js": "shared-offer.js",
        "app.js": "app.js",
        "year-feature.js": "year-feature.js",
        "compatibility-feature.js": "compatibility-feature.js",
        "pro/pro.js": "pro/pro.js",
        "pro/index.html": "pro/index.html",
        "child/child.js": "child/child.js",
        "child/index.html": "child/index.html",
        "wallet-topup.html": "wallet-topup.html",
        "index.html": "index.html",
        "numi-real-worker.php": "account-service/public/numi-real-worker.php",
    }
    sources = {name: pathlib.Path(src).read_bytes()
               for name, src in source_paths.items()}
    sources["worker.local.php"] = worker_cfg
    public_files = ("account-browser.js","wallet-topup.html","index.html",
                    "store-entry.js","shared-offer.js","app.js",
                    "wallet-client.js","redflag-feature.js",
                    "year-feature.js","compatibility-feature.js",
                    "pro/pro.js","pro/index.html","child/child.js","child/index.html")
    for name, data in sources.items():
        if len(data)>LIMIT or (name not in public_files and not data.startswith(b"<?php")):
            raise RuntimeError("INVALID_RELEASE_SOURCE:"+name)
    if b"subscription_checkout" not in sources["core.php"] or (
        b"recurring_merchant_approved" not in sources["subscriptions.php"]
    ) or b"save_payment_method" not in sources["subscriptions.php"]:
        raise RuntimeError("RECURRING_GATE_OR_ROUTE_MISSING")
    if b"'save_payment_method'=>false" not in sources["wallet-real-payment.php"]:
        raise RuntimeError("TOPUP_CARD_MUST_NOT_BE_SAVED")
    if (b"modify('+1 year')" not in sources["store.php"]
        or b"INTERVAL 1 YEAR" not in sources["numi-real-worker.php"]
        or b"'expires_at'=>$expiresAt??null" not in sources["wallet-real-payment.php"]):
        raise RuntimeError("ANNUAL_REPORT_SERVER_GUARDS_MISSING")
    for name in ("store-entry.js","year-feature.js","compatibility-feature.js",
                 "pro/pro.js","child/child.js"):
        if b"recognizePurchasedReport" not in sources[name]:
            raise RuntimeError("ANNUAL_REPORT_CLIENT_GUARD_MISSING:"+name)
    if b"app.js?v=redflag-question-stable-20261109" not in sources["index.html"]:
        raise RuntimeError("PAID_ANSWER_HOMEPAGE_CACHE_TAG_MISSING")
    if (b"naRedFlagPaidStatus" not in sources["fulfillment.php"]
        or "Недостаточно средств на балансе. Для ответа нужно ".encode("utf-8") not in sources["wallet-client.js"]
        or b"./wallet-client.js?v=redflag-question-stable-20261109" not in sources["redflag-feature.js"]):
        raise RuntimeError("PAID_ANSWER_READY_AND_BALANCE_GUARDS_MISSING")
    if (b"openPaymentInThisWindow(prepared.href)" not in sources["wallet-topup.html"]
        or b"location.assign(href)" not in sources["wallet-topup.html"]
        or b"scheduleTelegramPreparation" not in sources["wallet-topup.html"]
        or b"completedFingerprint" not in sources["wallet-topup.html"]
        or b"openPaymentExternally(" in sources["wallet-topup.html"]
        or b"web_app_open_link" in sources["wallet-topup.html"]
        or "Если окно оплаты зависает, отключите VPN.".encode("utf-8") not in sources["wallet-topup.html"]):
        raise RuntimeError("TOPUP_SAME_WINDOW_VPN_GUARDS_MISSING")
    if (b"directOpenHere(directPrepared.href)" not in sources["account-browser.js"]
        or b"location.assign(url)" not in sources["account-browser.js"]
        or b"directExternalOpen(" in sources["account-browser.js"]
        or b"web_app_open_link" in sources["account-browser.js"]
        or "Если окно оплаты зависает, отключите VPN.".encode("utf-8") not in sources["account-browser.js"]):
        raise RuntimeError("CABINET_SAME_WINDOW_VPN_GUARDS_MISSING")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    ftp.connect(HOST,21)
    ftp.login(user,password)
    ftp.prot_p()
    ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    root=home+"/www/"+WEBROOT
    private=home+"/private/numi-account-20261031"
    live_dir=home+"/private/numi-wallet-live"
    dest={name: (root+"/"+name if name in public_files
                 else root+"/api/"+name if name=="numi-real-worker.php"
                 else live_dir+"/"+name if name=="worker.local.php"
                 else private+"/"+name)
          for name in sources}
    originals={}
    changed=[]

    def read(remote):
        stream=io.BytesIO()
        def add(chunk):
            if stream.tell()+len(chunk)>LIMIT:raise RuntimeError("REMOTE_TOO_LARGE")
            stream.write(chunk)
        try:ftp.retrbinary("RETR "+remote,add)
        except ftplib.error_perm as exc:
            if str(exc).startswith("550"):return None
            raise
        return stream.getvalue()

    def write(remote,payload):
        ftp.storbinary("STOR "+remote,io.BytesIO(payload))
        if read(remote)!=payload:
            raise RuntimeError("FTPS_READBACK_MISMATCH")

    try:
        ftp.cwd(private)
        ftp.cwd(root+"/api")
        if read(root+"/index.html") is None:
            raise RuntimeError("LIVE_SITE_NOT_FOUND")
        core=read(private+"/core.php")
        if not core or b"wallet" not in core:
            raise RuntimeError("EXISTING_ACCOUNT_WALLET_API_MISSING")
        # Prove the specifically reported paid answer is published and complete
        # before changing its server gate. No content leaves the protected site.
        report_path="data/redflag/money/words-or-deeds.json"
        existing_report=read(private+"/store-content/"+report_path)
        manifest=json.loads(pathlib.Path("account-service/private/store-assets.json").read_text())
        if (existing_report is None
            or hashlib.sha256(existing_report).hexdigest()!=manifest["files"].get(report_path)):
            raise RuntimeError("REDFLAG_COMPLETE_ANSWER_PRIVATE_HASH_MISMATCH")
        recorded=json.loads(existing_report)
        if (recorded.get("status")!="complete"
            or recorded.get("questionId")!="words-or-deeds"
            or recorded.get("section")!="money"
            or len(recorded.get("entries") or {})!=366
            or not (recorded.get("entries") or {}).get("9-9")):
            raise RuntimeError("REDFLAG_COMPLETE_ANSWER_NOT_VERIFIED")
        print("REDFLAG_COMPLETE_366_PRIVATE_ANSWERS_VERIFIED",flush=True)
        try:ftp.mkd(live_dir)
        except ftplib.error_perm:
            ftp.cwd(live_dir)  # Only treat as existing when actually accessible.
        for name in sources:
            originals[name]=read(dest[name])
            old=originals[name]
            if name in source_paths and name!="index.html" and not approved_version(source_paths[name],old):
                raise RuntimeError("UNKNOWN_SERVER_FILE_BASELINE:"+name)
            if name=="worker.local.php" and old is not None and old!=sources[name]:
                raise RuntimeError("EXISTING_WORKER_SECRET_DIFFERS_DO_NOT_OVERWRITE")
        stamp=os.getenv("GITHUB_RUN_ID") or str(int(time.time()))
        backup=home+"/private/numi-real-worker-backup-"+stamp
        ftp.mkd(backup)
        for name,original in originals.items():
            if original is not None:
                write(backup+"/"+name.replace("/","__")+".before",original)
                print("VERIFIED_PRIVATE_BACKUP",name,flush=True)
        try:
            # Private PHP before public API and public JS. Preserve the existing
            # secret derivation and never change the private live flags.
            for name in ("store.php","subscriptions.php","wallet-real.php",
                         "wallet-real-payment.php","fulfillment.php","core.php",
                         "wallet-real-worker.php","worker.local.php",
                         "numi-real-worker.php"):
                remote=dest[name]
                if read(remote)!=originals[name]:
                    raise RuntimeError("CONCURRENT_SERVER_EDIT:"+name)
                if originals[name]!=sources[name]:
                    changed.append(name)
                    write(remote,sources[name])
                print("REAL_SUBSCRIPTION_FILE_VERIFIED",name,flush=True)
            # Explicit, authenticated additive database schema migration.
            req=urllib.request.Request(
                "https://"+DOMAIN+"/api/numi-real-worker.php",
                data=b'{"action":"migrate"}',
                headers={"Content-Type":"application/json",
                         "X-Numi-Worker-Token":token,
                         "Cache-Control":"no-store"},
                method="POST")
            try:
                with urllib.request.urlopen(req,timeout=40) as response:
                    data=response.read(3000)
                    if response.status!=200 or json.loads(data).get("result")!="REAL_SCHEMA_READY":
                        raise RuntimeError("REAL_DB_ADDITIVE_SCHEMA_UNCONFIRMED")
            except urllib.error.HTTPError as exc:
                # Never print request headers, body, token or private credentials.
                raise RuntimeError("REAL_DB_MIGRATION_HTTP_"+str(exc.code)) from None
            print("REAL_WALLET_ADDITIVE_MYSQL_SCHEMA_CONFIRMED",flush=True)
            # Protected GET-like probe using POST to our server: no charges
            # and no customer or payment information in the response.
            probe=urllib.request.Request(
                "https://"+DOMAIN+"/api/numi-real-worker.php",
                data=b'{"action":"probe"}',
                headers={"Content-Type":"application/json",
                         "X-Numi-Worker-Token":token,
                         "Cache-Control":"no-store"},
                method="POST")
            try:
                with urllib.request.urlopen(probe,timeout=35) as response:
                    status=response.status
                    body=json.loads(response.read(6000))
                    if status!=200 or body.get("action")!="probe":
                        raise RuntimeError("LIVE_PROVIDER_PROBE_INVALID")
            except urllib.error.HTTPError as exc:
                raise RuntimeError("LIVE_PROVIDER_PROBE_HTTP_"+str(exc.code)) from None
            print("LIVE_PROVIDER_SAFE_PROBE",json.dumps(body,ensure_ascii=False),flush=True)
            # Publish existing report pages and modules ONLY after private
            # expiry migration and the read-only provider probe succeed.
            # Verify each served HTTP file, not just the private FTP copy.
            for name in ("store-entry.js","shared-offer.js","app.js",
                         "wallet-client.js","redflag-feature.js",
                         "year-feature.js","compatibility-feature.js",
                         "pro/pro.js","pro/index.html","child/child.js","child/index.html"):
                if read(dest[name])!=originals[name]:
                    raise RuntimeError("CONCURRENT_SERVER_EDIT:"+name)
                if originals[name]!=sources[name]:
                    changed.append(name)
                    write(dest[name],sources[name])
                print("REG_RU_ANNUAL_REPORT_SOURCE_VERIFIED",name,flush=True)
                url="https://"+DOMAIN+"/"+name+"?code_check="+stamp
                with urllib.request.urlopen(urllib.request.Request(
                        url,headers={"Cache-Control":"no-cache"}),timeout=30) as response:
                    served=response.read(LIMIT+1)
                    if response.status!=200 or served!=sources[name]:
                        raise RuntimeError("ANNUAL_REPORT_HTTP_MISMATCH:"+name)
                print("REG_RU_ANNUAL_REPORT_HTTP_VERIFIED",name,flush=True)
            # Publish the new cabinet UI only after backend, schema and
            # private-provider diagnostics have all succeeded.
            name="account-browser.js"
            if read(dest[name])!=originals[name]:
                raise RuntimeError("CONCURRENT_SERVER_EDIT:"+name)
            if originals[name]!=sources[name]:
                changed.append(name)
                write(dest[name],sources[name])
            print("REG_RU_SUBSCRIPTION_UI_SOURCE_VERIFIED",flush=True)
            # Patch only the reviewed mobile-subscription block and four
            # exact texts. Do NOT overwrite unrelated live homepage changes.
            previous=b"account-browser.js?v=wallet-direct-external-20261109"
            updated=b"account-browser.js?v=wallet-same-tab-vpn-20261109"
            sourcehtml=sources["index.html"]
            if sourcehtml.count(updated)!=1:
                raise RuntimeError("REVIEWED_INDEX_CACHE_TAG_MISSING")
            css_anchor=b"#account-dialog .account-birth-section .account-actions{flex-wrap:wrap}"
            css_marker=b"/* Mobile-first subscriptions: never lay consent beside giant flex buttons. */"
            if sourcehtml.count(css_anchor)!=1 or sourcehtml.count(css_marker)!=1:
                raise RuntimeError("REVIEWED_SUBSCRIPTION_CSS_MISSING")
            css_tail=sourcehtml.split(css_anchor,1)[1].split(b"</style>",1)[0]
            previous_html=subprocess.check_output([
                "git","show","0e60080a8e60e14fdbbd0cc5b0e475ff8c1a119c:index.html"
            ])
            if previous_html.count(css_anchor)!=1:
                raise RuntimeError("REVIEWED_PREVIOUS_CSS_MISSING")
            previous_tail=previous_html.split(css_anchor,1)[1].split(b"</style>",1)[0]
            if previous_tail==css_tail or len(css_tail)>12000:
                raise RuntimeError("REVIEWED_COMPACT_CSS_INVALID")
            oldhtml=originals["index.html"]
            if oldhtml is None or oldhtml.count(css_anchor)!=1:
                raise RuntimeError("LIVE_HOMEPAGE_BASELINE_UNKNOWN")
            changedhtml=oldhtml
            live_tail=oldhtml.split(css_anchor,1)[1].split(b"</style>",1)[0]
            if live_tail==previous_tail:
                before=css_anchor+previous_tail+b"</style>"
                after=css_anchor+css_tail+b"</style>"
                if changedhtml.count(before)!=1:
                    raise RuntimeError("LIVE_SUBSCRIPTION_STYLE_AMBIGUOUS")
                changedhtml=changedhtml.replace(before,after,1)
            elif live_tail!=css_tail:
                raise RuntimeError("UNKNOWN_LIVE_SUBSCRIPTION_CSS_DO_NOT_OVERWRITE")
            html_patches=[
                ("Клуб — 490 ₽ / месяц","Клуб · 490 ₽/мес."),
                ("Школа — 149 ₽ / неделю","Самоучитель · 149 ₽/нед."),
                ('style="margin-top:18px"',''),
                ("Клуб · 490 ₽/мес.","Клуб — 490 рублей в месяц"),
                ("Самоучитель · 149 ₽/нед.","Самоучитель — 149 рублей в неделю"),
                ("Пока продление оплачивается с баланса вручную. Автосписания заработают после отдельного подключения в ЮKassa и согласия покупателя.",
                 "Автосписания станут доступны после одобрения ЮKassa."),
            ]
            # All previous subscription labels may already be published:
            # avoid interpreting the completed two-step rename as a conflict.
            final_labels=(
                "Клуб — 490 рублей в месяц".encode("utf-8"),
                "Самоучитель — 149 рублей в неделю".encode("utf-8"),
                "Автосписания станут доступны после одобрения ЮKassa.".encode("utf-8"),
            )
            already_final=all(changedhtml.count(label)==1 for label in final_labels)
            if not already_final:
                for before,after in html_patches:
                    before,after=before.encode("utf-8"),after.encode("utf-8")
                    if after==b"" and changedhtml.count(before)==0:
                        continue
                    if after and changedhtml.count(after)==1:
                        continue
                    if changedhtml.count(before)!=1:
                        raise RuntimeError("LIVE_SUBSCRIPTION_HTML_CONFLICT")
                    changedhtml=changedhtml.replace(before,after,1)
            if changedhtml.count(updated)==0 and changedhtml.count(previous)==1:
                changedhtml=changedhtml.replace(previous,updated,1)
            if changedhtml.count(updated)!=1:
                raise RuntimeError("UNKNOWN_LIVE_ACCOUNT_SCRIPT_VERSION_DO_NOT_OVERWRITE")
            original_app=b"app.js?v=club-prices1"
            prior_app=b"app.js?v=report-annual-20261109"
            last_app=b"app.js?v=redflag-status-fix-20261109"
            new_app=b"app.js?v=redflag-question-stable-20261109"
            if changedhtml.count(new_app)==0:
                old_app=(last_app if changedhtml.count(last_app)==1 else
                         prior_app if changedhtml.count(prior_app)==1 else original_app)
                if changedhtml.count(old_app)!=1:
                    raise RuntimeError("UNKNOWN_LIVE_APP_SCRIPT_VERSION_DO_NOT_OVERWRITE")
                changedhtml=changedhtml.replace(old_app,new_app,1)
            if changedhtml.count(new_app)!=1:
                raise RuntimeError("UNKNOWN_LIVE_APP_SCRIPT_VERSION_DO_NOT_OVERWRITE")
            if changedhtml!=oldhtml:
                if read(dest["index.html"])!=oldhtml:
                    raise RuntimeError("CONCURRENT_SERVER_EDIT:index.html")
                changed.append("index.html")
                write(dest["index.html"],changedhtml)
                print("REG_RU_COMPACT_SUBSCRIPTIONS_VIEW_UPDATED",flush=True)
            else:
                print("REG_RU_COMPACT_SUBSCRIPTIONS_VIEW_ALREADY_CURRENT",flush=True)
            # Safely publish ONLY the existing live top-up page.
            # This is client-side navigation; no merchant keys or money logic change.
            name="wallet-topup.html"
            remote=dest[name]
            if originals[name] is None:
                raise RuntimeError("EXISTING_TOPUP_PAGE_MISSING")
            if read(remote)!=originals[name]:
                raise RuntimeError("CONCURRENT_SERVER_EDIT:wallet-topup.html")
            if originals[name]!=sources[name]:
                changed.append(name)
                write(remote,sources[name])
            print("REG_RU_TOPUP_EXTERNAL_ONE_TAP_FILE_VERIFIED",flush=True)
            topup_url="https://"+DOMAIN+"/wallet-topup.html?code_check="+stamp
            with urllib.request.urlopen(urllib.request.Request(topup_url,
                headers={"Cache-Control":"no-cache"}),timeout=30) as response:
                published=response.read(LIMIT+1)
                if response.status!=200 or published!=sources[name]:
                    raise RuntimeError("REG_RU_TOPUP_EXTERNAL_ONE_TAP_HTTP_MISMATCH")
            print("REG_RU_TOPUP_EXTERNAL_ONE_TAP_HTTP_VERIFIED",flush=True)
            # Public HTTP verification of the *actual* cabinet JS and live
            # index tag. FTP readback alone does not prove clients get it.
            cabinet_url="https://"+DOMAIN+"/account-browser.js?code_check="+stamp
            with urllib.request.urlopen(urllib.request.Request(cabinet_url,
                headers={"Cache-Control":"no-cache"}),timeout=30) as response:
                served_js=response.read(LIMIT+1)
                if response.status!=200 or served_js!=sources["account-browser.js"]:
                    raise RuntimeError("CABINET_DIRECT_EXTERNAL_JS_NOT_PUBLIC")
            with urllib.request.urlopen(urllib.request.Request(
                "https://"+DOMAIN+"/index.html?code_check="+stamp,
                headers={"Cache-Control":"no-cache"}),timeout=30) as response:
                served_index=response.read(LIMIT+1)
                if response.status!=200 or served_index.count(updated)!=1:
                    raise RuntimeError("CABINET_DIRECT_EXTERNAL_CACHE_TAG_NOT_PUBLIC")
                if served_index.count(new_app)!=1:
                    raise RuntimeError("ANNUAL_REPORT_HOMEPAGE_TAG_NOT_PUBLIC")
            print("REG_RU_CABINET_SAME_WINDOW_VPN_HTTP_VERIFIED",flush=True)
            # No cookies or customer data: only an anonymous API check.
            account_url="https://"+DOMAIN+"/api/numi-account.php"
            anonymous=urllib.request.Request(account_url,
                data=b'{"action":"subscription_checkout","auto_renew_consent":true}',
                headers={"Content-Type":"application/json",
                         "Origin":"https://"+DOMAIN,
                         "Cache-Control":"no-store"},method="POST")
            try:
                with urllib.request.urlopen(anonymous,timeout=25) as response:
                    status=response.status
            except urllib.error.HTTPError as exc:
                status=exc.code
            if status!=401:
                raise RuntimeError("ANONYMOUS_SUBSCRIPTION_NOT_DENIED:"+str(status))
            print("REG_RU_ANONYMOUS_SUBSCRIPTION_FORBIDDEN",flush=True)
            print("REAL_SUBSCRIPTION_DEPLOYED_APPROVAL_GATE_STILL_REQUIRED",flush=True)
        except BaseException:
            print("REAL_SUBSCRIPTION_ROLLBACK_STARTED",flush=True)
            for name in reversed(changed):
                try:
                    if originals[name] is None:ftp.delete(dest[name])
                    else:write(dest[name],originals[name])
                    print("REAL_SUBSCRIPTION_ROLLBACK_VERIFIED",name,flush=True)
                except BaseException:
                    print("REAL_SUBSCRIPTION_ROLLBACK_NEEDS_MANUAL_ATTENTION",name,flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    main()
