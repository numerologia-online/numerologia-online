"""Deploy only club status/price labels on REG.RU, with exact baseline, backups, rollback.
No payment-mode change, schema migration, Telegram webhook or paid material updates.
"""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import re
import ssl
import subprocess
import time
import urllib.error
import urllib.request

HOST="server172.hosting.reg.ru"
WEBROOT="xn--c1adkkdfjbp1a4l.online"
DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
DEPLOYED_BASE="8c7bd81af24357679de6ff5503ff8aee965dd878"
LIMIT=950000
PRIVATE={"account-service/private/wallet.php":"wallet.php"}
PUBLIC=["wallet-client.js","redflag-feature.js","store-entry.js","account-browser.js","app.js","index.html"]
PATHS=list(PRIVATE)+PUBLIC

def checksum(data):
    return hashlib.sha256(data).hexdigest()

def github_original(path):
    return subprocess.check_output(["git","show",DEPLOYED_BASE+":"+path],stderr=subprocess.DEVNULL)

def request_api(action,origin):
    req=urllib.request.Request(
        "https://"+DOMAIN+"/api/numi-account.php",
        data=json.dumps({"action":action}).encode("utf-8"),
        headers={"Origin":origin,"Content-Type":"application/json","Cache-Control":"no-store"},
        method="POST")
    try:r=urllib.request.urlopen(req,timeout=22)
    except urllib.error.HTTPError as exc:r=exc
    with r:return r.status,json.loads(r.read(16000))

def main():
    approved=os.environ.get("APPROVED_SOURCE_SHA")
    if not approved or approved!=subprocess.check_output(["git","rev-parse","HEAD"]).decode().strip():
        raise RuntimeError("SOURCE_COMMIT_NOT_APPROVED")
    if not os.environ.get("REG_FTP_USER") or not os.environ.get("REG_FTP_PASSWORD"):
        raise RuntimeError("FTPS_SECRETS_UNAVAILABLE")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    public_root=home+"/www/"+WEBROOT
    private_root=home+"/private/numi-account-20261031"
    config_path=home+"/private/numi-wallet-test-20261106/config.local.php"
    originals,targets,changed,written={},{},{},[]

    def read(path):
        buf=io.BytesIO()
        def on_chunk(part):
            if buf.tell()+len(part)>LIMIT:raise RuntimeError("REMOTE_FILE_TOO_LARGE")
            buf.write(part)
        try:ftp.retrbinary("RETR "+path,on_chunk)
        except ftplib.error_perm as exc:
            if str(exc).startswith("550"):return None
            raise
        return buf.getvalue()

    def put(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if read(path)!=data:raise RuntimeError("FTPS_READBACK_MISMATCH")

    try:
        index=read(public_root+"/index.html")
        if index is None:raise RuntimeError("LIVE_WEBROOT_MISSING")
        req=urllib.request.Request(
            "https://"+DOMAIN+"/index.html?club_price_preflight="+approved[:10],
            headers={"Cache-Control":"no-cache"})
        with urllib.request.urlopen(req,timeout=25) as response:
            if response.status!=200 or response.read(LIMIT+1)!=index:
                raise RuntimeError("DOMAIN_AND_FTPS_WEBROOT_MISMATCH")
        cfg=read(config_path)
        if not cfg or len(cfg)>10000:raise RuntimeError("TEST_CONFIG_MISSING")
        text=cfg.decode("utf-8")
        if not all((
            text.lstrip().startswith("<?php"),
            re.search(r"""['"]shop_id['"]\s*=>\s*['"]1521071['"]""",text),
            re.search(r"""['"]store_test_enabled['"]\s*=>\s*true\b""",text),
            re.search(r"""['"]store_wallet_test_enabled['"]\s*=>\s*true\b""",text),
            re.search(r"""['"]secret_key['"]\s*=>\s*['"]test_[A-Za-z0-9_-]{12,480}['"]""",text)
        )):raise RuntimeError("ONLY_TEST_YOOKASSA_VERIFICATION_FAILED")
        print("CLUB_RELEASE_TEST_ONLY_AND_CORRECT_LIVE_DOMAIN",flush=True)
        for path in PATHS:
            target=(private_root+"/"+PRIVATE[path]) if path in PRIVATE else (public_root+"/"+path)
            old=read(target)
            base=github_original(path)
            new=pathlib.Path(path).read_bytes()
            if old is None or old!=base:
                raise RuntimeError("REFUSE_LIVE_FILE_DRIFT:"+path)
            if old==new:
                raise RuntimeError("NO_CHANGE_TO_PUBLISH:"+path)
            originals[path]=old
            targets[path]=target
            changed[path]=new
            print("BASELINE_VERIFIED",path,flush=True)
        if b"naWalletClubStatus" not in changed["account-service/private/wallet.php"]:
            raise RuntimeError("CLUB_STATUS_BACKEND_NOT_PRESENT")
        if b"naWalletBuy" not in changed["account-service/private/wallet.php"]:
            raise RuntimeError("PURCHASE_SERVER_LOGIC_MISSING")
        if b"numi-cart" in changed["wallet-client.js"] or b"store-browser.js" in changed["index.html"]:
            raise RuntimeError("CART_REGRESSION")
        if "Ваша цена".encode("utf-8") not in changed["redflag-feature.js"] or "Вступить в клуб".encode("utf-8") not in changed["wallet-client.js"]:
            raise RuntimeError("MEMBERSHIP_UI_NOT_PRESENT")
        manifest=json.loads(pathlib.Path("account-service/private/store-assets.json").read_text())
        sample="data/redflag/money/generosity.json"
        protected=read(private_root+"/store-content/"+sample)
        if protected is None or checksum(protected)!=manifest["files"][sample]:
            raise RuntimeError("PROTECTED_ANSWER_INTEGRITY_CHECK_FAILED")
        print("PRIVATE_ANSWER_UNCHANGED",flush=True)

        stamp=os.environ.get("GITHUB_RUN_ID",str(int(time.time())))
        backup=home+"/private/numi-club-prices-backup-"+stamp
        ftp.mkd(backup)
        for path in PATHS:
            name=path.replace("/","__")+".before"
            put(backup+"/"+name,originals[path])
            print("BACKUP_VERIFIED",path,flush=True)
        print("ALL_BACKUPS_VERIFIED",flush=True)
        try:
            for path in PATHS:
                if read(targets[path])!=originals[path]:
                    raise RuntimeError("CONCURRENT_LIVE_EDIT:"+path)
                written.append(path)
                put(targets[path],changed[path])
                print("INSTALLED",path,flush=True)
            for path in PUBLIC:
                req=urllib.request.Request("https://"+DOMAIN+"/"+path+"?club_release="+stamp,
                    headers={"Cache-Control":"no-cache"})
                with urllib.request.urlopen(req,timeout=25) as response:
                    if response.status!=200 or response.read(LIMIT+1)!=changed[path]:
                        raise RuntimeError("PUBLIC_HTTPS_MISMATCH:"+path)
                print("HTTPS_VERIFIED",path,flush=True)
            status,body=request_api("health","https://"+DOMAIN)
            if status!=200 or body.get("database") is not True:
                raise RuntimeError("LIVE_DATABASE_HEALTH_FAILED")
            for action in ("wallet_status","wallet_quote","wallet_buy"):
                status,body=request_api(action,"https://"+DOMAIN)
                if status!=401 or body.get("error")!="LOGIN_REQUIRED":
                    raise RuntimeError("GUEST_WALLET_GUARD_FAILED:"+action)
            status,body=request_api("wallet_status","https://attacker.invalid")
            if status!=403 or body.get("error")!="ORIGIN_DENIED":
                raise RuntimeError("FOREIGN_ORIGIN_NOT_REJECTED")
            print("CLUB_PRICE_RELEASE_SUCCESS_TEST_ONLY_NO_CART",flush=True)
        except BaseException:
            print("PUBLISH_FAILED_ROLLING_BACK",flush=True)
            for path in reversed(written):
                try:
                    put(targets[path],originals[path])
                    print("ROLLBACK_VERIFIED",path,flush=True)
                except BaseException:
                    print("ROLLBACK_FAILED_REQUIRES_MANUAL_RECOVERY",path,flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    main()
