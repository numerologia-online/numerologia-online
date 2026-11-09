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
        "numi-real-worker.php": "account-service/public/numi-real-worker.php",
    }
    sources = {name: pathlib.Path(src).read_bytes()
               for name, src in source_paths.items()}
    sources["worker.local.php"] = worker_cfg
    for name, data in sources.items():
        if len(data)>LIMIT or (name!="account-browser.js" and not data.startswith(b"<?php")):
            raise RuntimeError("INVALID_RELEASE_SOURCE:"+name)
    if b"subscription_checkout" not in sources["core.php"] or (
        b"recurring_merchant_approved" not in sources["subscriptions.php"]
    ) or b"save_payment_method" not in sources["subscriptions.php"]:
        raise RuntimeError("RECURRING_GATE_OR_ROUTE_MISSING")
    if b"'save_payment_method'=>false" not in sources["wallet-real-payment.php"]:
        raise RuntimeError("TOPUP_CARD_MUST_NOT_BE_SAVED")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    ftp.connect(HOST,21)
    ftp.login(user,password)
    ftp.prot_p()
    ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    root=home+"/www/"+WEBROOT
    private=home+"/private/numi-account-20261031"
    live_dir=home+"/private/numi-wallet-live"
    dest={name: (root+"/"+name if name=="account-browser.js"
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
        try:ftp.mkd(live_dir)
        except ftplib.error_perm:
            ftp.cwd(live_dir)  # Only treat as existing when actually accessible.
        for name in sources:
            originals[name]=read(dest[name])
            old=originals[name]
            if name in source_paths and not approved_version(source_paths[name],old):
                raise RuntimeError("UNKNOWN_SERVER_FILE_BASELINE:"+name)
            if name=="worker.local.php" and old is not None and old!=sources[name]:
                raise RuntimeError("EXISTING_WORKER_SECRET_DIFFERS_DO_NOT_OVERWRITE")
        stamp=os.getenv("GITHUB_RUN_ID") or str(int(time.time()))
        backup=home+"/private/numi-real-worker-backup-"+stamp
        ftp.mkd(backup)
        for name,original in originals.items():
            if original is not None:
                write(backup+"/"+name+".before",original)
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
            # Publish the new cabinet UI only after backend, schema and
            # private-provider diagnostics have all succeeded.
            name="account-browser.js"
            if read(dest[name])!=originals[name]:
                raise RuntimeError("CONCURRENT_SERVER_EDIT:"+name)
            if originals[name]!=sources[name]:
                changed.append(name)
                write(dest[name],sources[name])
            print("REG_RU_SUBSCRIPTION_UI_SOURCE_VERIFIED",flush=True)
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
