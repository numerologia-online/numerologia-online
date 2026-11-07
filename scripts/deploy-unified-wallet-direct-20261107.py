"""Guarded TEST-only unified wallet release. Never enables real YooKassa payments.
Compares exact live baselines, saves private backups, verifies FTP+HTTPS,
and rolls back all changed code on failure. No database destructive changes.
"""
import ftplib
import hashlib
import io
import os
import pathlib
import re
import ssl
import subprocess
import time
import urllib.error
import urllib.request
import json

HOST="server172.hosting.reg.ru"
WEBROOT="xn--c1adkkdfjbp1a4l.online"
DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
BASE_SHA="f84f4bc36eb099e24288aa9775a2b1b76add72ff"
LIMIT=950000

# Deliberate allowlist: no bot, CRON, public material or unreviewed files.
PRIVATE={
  "account-service/private/wallet.php":"wallet.php",
  "account-service/private/subscriptions.php":"subscriptions.php",
  "account-service/private/core.php":"core.php",
}
PUBLIC=[
  "wallet-client.js",
  "store-entry.js",
  "shared-offer.js",
  "redflag-feature.js",
  "year-feature.js",
  "compatibility-feature.js",
  "destiny-code-feature.js",
  "child/child.js",
  "pro/pro.js",
  "moment/yes-no/yes-no.js",
  "app.js",
  "account-browser.js",
  "child/index.html",
  "pro/index.html",
  "moment/yes-no/index.html",
  "index.html",
]
PATHS=list(PRIVATE)+PUBLIC
ORIG={}
DEST={}
NEW={}
WRITTEN=[]

def h(x):
    return hashlib.sha256(x).hexdigest()

def base_file(path):
    try:return subprocess.check_output(["git","show",BASE_SHA+":"+path],stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:return None

def private_config_ok(raw):
    if not raw or len(raw)>10000:return False
    text=raw.decode("utf-8")
    if not text.lstrip().startswith("<?php"):return False
    if not re.search(r"""['"]shop_id['"]\s*=>\s*['"]1521071['"]""",text):return False
    if not re.search(r"""['"]store_test_enabled['"]\s*=>\s*true\b""",text):return False
    if not re.search(r"""['"]store_wallet_test_enabled['"]\s*=>\s*true\b""",text):return False
    if not re.search(r"""['"]secret_key['"]\s*=>\s*['"]test_[A-Za-z0-9_-]{12,480}['"]""",text):return False
    return True

def reply(action,origin):
    req=urllib.request.Request("https://"+DOMAIN+"/api/numi-account.php",
      data=json.dumps({"action":action}).encode(),method="POST",
      headers={"Content-Type":"application/json","Origin":origin,"Cache-Control":"no-store"})
    try:response=urllib.request.urlopen(req,timeout=20)
    except urllib.error.HTTPError as e:response=e
    with response:return response.status,json.loads(response.read(16000))

def main():
    user=os.environ.get("REG_FTP_USER","")
    passwd=os.environ.get("REG_FTP_PASSWORD","")
    if not user or not passwd:raise RuntimeError("FTPS_CREDENTIALS_MISSING")
    assert subprocess.check_output(["git","rev-parse","HEAD"]).decode().strip()==os.environ.get("APPROVED_SOURCE_SHA"),"UNAPPROVED_SOURCE_HEAD"
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    ftp.connect(HOST,21)
    ftp.login(user,passwd)
    ftp.prot_p()
    ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    pub=home+"/www/"+WEBROOT
    priv=home+"/private/numi-account-20261031"
    cfg_path=home+"/private/numi-wallet-test-20261106/config.local.php"

    def read(path):
        out=io.BytesIO()
        def append(block):
            if out.tell()+len(block)>LIMIT:raise RuntimeError("REMOTE_FILE_TOO_BIG")
            out.write(block)
        try:ftp.retrbinary("RETR "+path,append)
        except ftplib.error_perm as exc:
            if str(exc).startswith("550"):return None
            raise
        return out.getvalue()

    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if read(path)!=data:raise RuntimeError("REMOTE_WRITE_MISMATCH")

    try:
        pub_index=read(pub+"/index.html")
        if pub_index is None:raise RuntimeError("WEBROOT_NOT_FOUND")
        req=urllib.request.Request("https://"+DOMAIN+"/index.html?direct_wallet_check=1",
          headers={"Cache-Control":"no-cache"})
        with urllib.request.urlopen(req,timeout=30) as response:
            if response.status!=200 or response.read(LIMIT+1)!=pub_index:
                raise RuntimeError("PUBLIC_WEBROOT_NOT_VERIFIED")

        if not private_config_ok(read(cfg_path)):
            raise RuntimeError("EXISTING_YOOKASSA_TEST_ONLY_CONFIG_NOT_VERIFIED")
        print("TEST_ONLY_PROVIDER_AND_LIVE_ROOT_VERIFIED",flush=True)

        for path in PATHS:
            live_path=priv+"/"+PRIVATE[path] if path in PRIVATE else pub+"/"+path
            DEST[path]=live_path
            original=read(live_path)
            ORIG[path]=original
            base=base_file(path)
            desired=pathlib.Path(path).read_bytes()
            NEW[path]=desired
            if path=="wallet-client.js":
                if original is not None or base is not None:raise RuntimeError("NEW_WALLET_CLIENT_COLLISION")
            elif path=="index.html":
                if base is None:raise RuntimeError("MAIN_INDEX_MISSING")
                expected=base.decode("utf-8")
                for old,new in [
                    ('account-browser.js?v=wallet-test1','account-browser.js?v=wallet20261107owner1'),
                    ('store-browser.js?v=wallet-test1','store-browser.js?v=wallet20261107owner1')
                ]:
                    if expected.count(old)!=1:raise RuntimeError("UNKNOWN_MAIN_CACHE_LAYOUT")
                    expected=expected.replace(old,new)
                if original!=expected.encode("utf-8"):
                    raise RuntimeError("LIVE_INDEX_CHANGED_REFUSING_OVERWRITE")
            else:
                if base is None or original!=base:raise RuntimeError("LIVE_BASELINE_CHANGED:"+path)
            if original==desired:raise RuntimeError("NO_SOURCE_DIFFERENCE:"+path)
            print("PREFLIGHT_MATCH",path,flush=True)

        # Original protected author material must remain intact.
        manifest=json.loads(pathlib.Path("account-service/private/store-assets.json").read_text())
        sample="data/redflag/money/generosity.json"
        data=read(priv+"/store-content/"+sample)
        if not data or h(data)!=manifest["files"].get(sample):
            raise RuntimeError("PRIVATE_MATERIAL_MISSING_OR_MODIFIED")
        print("PRIVATE_AUTHOR_MATERIAL_CHECKED",flush=True)

        # No private key, test configuration, real payment or bot files are edited.
        if b"test_" not in pathlib.Path("account-service/private/store.php").read_bytes():
            raise RuntimeError("STORE_IS_NOT_TEST_GATED")
        wallet=NEW["account-service/private/wallet.php"]
        if b"store_wallet_test_enabled" not in wallet or b"naStoreEnabled($config)" not in wallet:
            raise RuntimeError("WALLET_TEST_GATES_MISSING")
        if b"naWalletVerifyPayment" not in wallet or b"naWalletMergeAccounts" not in wallet:
            raise RuntimeError("WALLET_SAFETY_MISSING")
        if b"store-browser.js" in NEW["index.html"] or b"store-browser.js" in NEW["store-entry.js"]:
            raise RuntimeError("CART_STILL_LOADED")

        backup=home+"/private/numi-wallet-direct-backup-"+str(os.environ.get("GITHUB_RUN_ID",int(time.time())))
        ftp.mkd(backup)
        for path in PATHS:
            if ORIG[path] is not None:
                name=path.replace("/","__")
                write(backup+"/"+name+".before",ORIG[path])
                print("BACKUP_VERIFIED",path,flush=True)
        print("ALL_BACKUPS_VERIFIED_BEFORE_PUBLICATION",flush=True)

        try:
            for path in PATHS:
                if read(DEST[path])!=ORIG[path]:raise RuntimeError("CONCURRENT_SERVER_EDIT:"+path)
                WRITTEN.append(path)
                write(DEST[path],NEW[path])
                print("INSTALLED_AND_VERIFIED",path,flush=True)

            # Verify each frontend byte through actual domain with no caching.
            for path in PUBLIC:
                req=urllib.request.Request("https://"+DOMAIN+"/"+path+"?wallet_direct="+str(os.environ.get("GITHUB_RUN_ID","1")),
                    headers={"Cache-Control":"no-cache"})
                with urllib.request.urlopen(req,timeout=25) as response:
                    if response.status!=200 or response.read(LIMIT+1)!=NEW[path]:
                        raise RuntimeError("PUBLIC_HTTP_MISMATCH:"+path)
                print("HTTPS_VERIFIED",path,flush=True)

            origin="https://"+DOMAIN
            status,data=reply("health",origin)
            if status!=200 or data.get("database") is not True:
                raise RuntimeError("DATABASE_HEALTH_REGRESSION")
            for action in ("wallet_status","wallet_quote","wallet_buy"):
                status,data=reply(action,origin)
                if status!=401 or data.get("error")!="LOGIN_REQUIRED":
                    raise RuntimeError("UNAUTHENTICATED_ACCESS_NOT_REJECTED:"+action)
            status,data=reply("wallet_quote","https://attacker.invalid")
            if status!=403 or data.get("error")!="ORIGIN_DENIED":
                raise RuntimeError("FOREIGN_ORIGIN_NOT_BLOCKED")
            print("DIRECT_WALLET_TEST_RELEASE_SUCCESS_NO_REAL_PAYMENTS",flush=True)
        except BaseException:
            print("RELEASE_FAILED_ROLLBACK_START",flush=True)
            for path in reversed(WRITTEN):
                try:
                    if ORIG[path] is None:ftp.delete(DEST[path])
                    else:write(DEST[path],ORIG[path])
                    print("ROLLBACK_VERIFIED",path,flush=True)
                except BaseException:
                    print("ROLLBACK_FAILED_MANUAL_RECOVERY_REQUIRED",path,flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    main()
