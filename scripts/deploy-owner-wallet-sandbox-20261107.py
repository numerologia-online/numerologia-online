"""Guarded owner-only TEST wallet release for the existing REG.RU store.

No production payment keys, existing bot, CRON, or customer data are changed.
The release refuses unknown live changes, backs up every replaced file outside
the public webroot, and rolls back any partial publication.
"""
import ftplib
import hashlib
import io
import json
import os
import pathlib
import re
import ssl
import time
import urllib.error
import urllib.request

HOST = "server172.hosting.reg.ru"
WEBROOT = "xn--c1adkkdfjbp1a4l.online"
NEW_DOMAIN = "xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
VERSION = "wallet20261107owner1"
LIMIT = 300000

EXPECTED = {
    "core.php": "dae1a86c20f4978763fe31b2e35757bc4b6f56784e65a7c80551ca44f15b0649",
    "account-browser.js": "2f9e3b46203290ad2409db07763ea5fe73fa550bef3bf80dc281657f23670ca5",
    "store-browser.js": "da9c41e0be4073f91c4753f2133444b0a9812ff4897b63449fa58bfe015410a2",
    "store-entry.js": "35a177159b5cfd5063bf2340cf7c2fc68a3bb68eafebd59532615d8af5ef72c8",
    "index.html": "56c0dc8ba04dc30c9aa05848988a810a34954c736e713a20b2a56c3480507462",
    "store.php": "e633abbc6e6e167c61dc22cd92877b206401e6f5b90136dd7d0205008b754c76",
}
SOURCE = {
    "core.php": "account-service/private/core.php",
    "wallet.php": "account-service/private/wallet.php",
    "account-browser.js": "account-browser.js",
    "store-browser.js": "store-browser.js",
    "store-entry.js": "store-entry.js",
}
ORDER = ["wallet.php", "core.php", "account-browser.js", "store-browser.js", "store-entry.js", "index.html", "config.local.php"]

def digest(b):
    return hashlib.sha256(b).hexdigest()

def replace_once(s, before, after, label):
    if s.count(before) != 1 or after in s:
        raise RuntimeError("GUARDED_PATCH_MISMATCH:" + label)
    return s.replace(before, after, 1)

def request(route, body, origin):
    url = "https://" + NEW_DOMAIN + "/api/numi-account.php"
    req = urllib.request.Request(
        url, data=json.dumps({"action": body}).encode("utf-8"),
        headers={
            "Origin": origin,
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "User-Agent": "numi-owner-wallet-release/1",
        }, method="POST"
    )
    try:
        res = urllib.request.urlopen(req, timeout=20)
    except urllib.error.HTTPError as exc:
        res = exc
    with res:
        status = res.status
        payload = res.read(16000)
    try:
        data = json.loads(payload)
    except (ValueError, UnicodeError):
        data = {}
    return status, data

def main():
    key = os.environ.get("NUMI_YOOKASSA_TEST_SECRET_KEY_1521071", "")
    if not re.fullmatch(r"test_[A-Za-z0-9_-]{12,480}", key):
        raise RuntimeError("YOO_TEST_SECRET_NOT_AVAILABLE")
    username = os.environ.get("REG_FTP_USER", "")
    password = os.environ.get("REG_FTP_PASSWORD", "")
    if not username or not password:
        raise RuntimeError("FTPS_SECRET_NOT_AVAILABLE")

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=28)
    originals, uploaded, dest, after = {}, [], {}, {}
    ftp.connect(HOST, 21)
    ftp.login(username, password)
    ftp.prot_p()
    ftp.set_pasv(True)
    home = ftp.pwd().rstrip("/")
    root = home + "/www/" + WEBROOT
    private = home + "/private/numi-account-20261031"
    config_path = home + "/private/numi-wallet-test-20261106/config.local.php"

    def read(path):
        out = io.BytesIO()
        def add(chunk):
            if out.tell() + len(chunk) > LIMIT:
                raise RuntimeError("REMOTE_FILE_TOO_LARGE")
            out.write(chunk)
        try:
            ftp.retrbinary("RETR " + path, add)
        except ftplib.error_perm as exc:
            if str(exc).startswith("550"):
                return None
            raise
        return out.getvalue()

    def put(path, content):
        ftp.storbinary("STOR " + path, io.BytesIO(content))
        if read(path) != content:
            raise RuntimeError("UPLOAD_READBACK_MISMATCH")

    try:
        ftp.cwd(root)
        if read(root + "/index.html") is None:
            raise RuntimeError("LIVE_WEBROOT_NOT_VERIFIED")
        ftp.cwd(home)
        dest.update({
            "wallet.php": private + "/wallet.php",
            "core.php": private + "/core.php",
            "store.php": private + "/store.php",
            "account-browser.js": root + "/account-browser.js",
            "store-browser.js": root + "/store-browser.js",
            "store-entry.js": root + "/store-entry.js",
            "index.html": root + "/index.html",
            "config.local.php": config_path,
        })
        for name in list(EXPECTED) + ["wallet.php", "config.local.php"]:
            originals[name] = read(dest[name])

        if originals["wallet.php"] is not None:
            raise RuntimeError("WALLET_ALREADY_EXISTS_RECONCILE_BEFORE_CHANGE")
        for name, expected in EXPECTED.items():
            old = originals[name]
            if old is None or digest(old) != expected:
                raise RuntimeError("LIVE_BASELINE_CHANGED_NO_FILES_WRITTEN:" + name)
        print("WALLET_PREFLIGHT_ALL_LIVE_BASELINES_MATCH", flush=True)

        core = pathlib.Path(SOURCE["core.php"]).read_bytes()
        route = b"""        if (in_array($action,['wallet_status','wallet_topup','wallet_sync','wallet_buy'],true)) {
            require_once __DIR__.'/wallet.php';
            naWalletServe($db,$action,$body);
        }
"""
        if core.count(route) != 1 or core.replace(route, b"") != originals["core.php"]:
            raise RuntimeError("CORE_WALLET_INSERT_NOT_ONLY_CHANGE")
        wallet = pathlib.Path(SOURCE["wallet.php"]).read_bytes()
        if b"&& naTestOwner($account);" not in wallet:
            raise RuntimeError("WALLET_IS_NOT_OWNER_ONLY")
        if b"store_wallet_test_enabled" not in wallet or b"naStoreEnabled($config)" not in wallet:
            raise RuntimeError("WALLET_SANDBOX_GUARDS_MISSING")
        if b"'sandbox_wallet'" not in wallet or b"naWalletVerifyPayment" not in wallet:
            raise RuntimeError("WALLET_PAYMENT_VALIDATION_GUARD_MISSING")

        after["wallet.php"] = wallet
        after["core.php"] = core
        for name in ("account-browser.js", "store-browser.js", "store-entry.js"):
            after[name] = pathlib.Path(SOURCE[name]).read_bytes()
        if b"numi-wallet-request-" not in after["store-browser.js"]:
            raise RuntimeError("WALLET_RETRY_KEY_GUARD_MISSING")

        # Preserve the exact Red Flag cache fix currently installed on the live homepage.
        html = originals["index.html"].decode("utf-8")
        if html.count("app.js?v=20261107rftext1") != 1:
            raise RuntimeError("REDFLAG_CACHED_PAGE_CHANGED")
        html = replace_once(html, 'src="account-browser.js?v=store2"',
                            'src="account-browser.js?v=' + VERSION + '"', "ACCOUNT_CACHE")
        html = replace_once(html, 'src="store-browser.js?v=store2"',
                            'src="store-browser.js?v=' + VERSION + '"', "STORE_CACHE")
        after["index.html"] = html.encode("utf-8")

        # Existing TEST shop config is retained; add only one sandbox-wallet flag.
        old_config = originals["config.local.php"]
        if not old_config:
            raise RuntimeError("EXISTING_TEST_CONFIG_MISSING")
        cfg = old_config.decode("utf-8")
        if not cfg.lstrip().startswith("<?php") or len(cfg) > 10000:
            raise RuntimeError("TEST_CONFIG_LAYOUT_NOT_VERIFIED")
        if not re.search(r"""['"]shop_id['"]\s*=>\s*['"]1521071['"]""", cfg):
            raise RuntimeError("TEST_SHOP_MISMATCH")
        if not re.search(r"""['"]store_test_enabled['"]\s*=>\s*true\b""", cfg):
            raise RuntimeError("STORE_TEST_MODE_OFF")
        m = re.search(r"""['"]secret_key['"]\s*=>\s*['"](test_[A-Za-z0-9_-]{12,480})['"]""", cfg)
        if not m or m.group(1) != key:
            raise RuntimeError("EXISTING_TEST_SECRET_MISMATCH")
        if "store_wallet_test_enabled" in cfg:
            raise RuntimeError("WALLET_TEST_FLAG_ALREADY_PRESENT_REVIEW_REQUIRED")
        cfg_new = replace_once(cfg, "return [", "return [\n    'store_wallet_test_enabled' => true,", "TEST_CONFIG_FLAG")
        after["config.local.php"] = cfg_new.encode("utf-8")
        print("WALLET_PREFLIGHT_ONLY_OWNER_TEST_AND_EXISTING_YOOKASSA_KEY", flush=True)

        # No change is made until every guard above has passed.
        stamp = str(os.environ.get("GITHUB_RUN_ID", int(time.time()))) + "-" + str(os.environ.get("GITHUB_RUN_ATTEMPT", "1"))
        backup = home + "/private/numi-wallet-owner-backup-" + stamp
        ftp.mkd(backup)
        for name in ORDER:
            if originals[name] is not None:
                put(backup + "/" + name + ".before", originals[name])
                print("WALLET_BACKUP_VERIFIED", name, flush=True)

        try:
            for name in ORDER:
                current = read(dest[name])
                if current != originals[name]:
                    raise RuntimeError("CONCURRENT_LIVE_EDIT_STOP:" + name)
                uploaded.append(name)
                put(dest[name], after[name])
                print("WALLET_WRITTEN_AND_VERIFIED", name, flush=True)

            # Both publicly accessible JS and HTML must match, via the actual storefront domain.
            for name in ("account-browser.js", "store-browser.js", "store-entry.js", "index.html"):
                url = "https://" + NEW_DOMAIN + "/" + name + "?numi_wallet_release=" + stamp
                req = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "numi-wallet-release-verify/1"})
                with urllib.request.urlopen(req, timeout=25) as res:
                    actual = res.read(LIMIT + 1)
                    if res.status != 200 or actual != after[name]:
                        raise RuntimeError("LIVE_HTTP_FILE_MISMATCH:" + name)
                print("WALLET_PUBLIC_HTTPS_VERIFIED", name, flush=True)

            origin = "https://" + NEW_DOMAIN
            status, response = request("health", "health", origin)
            if status != 200 or response.get("database") is not True:
                raise RuntimeError("STORE_HEALTH_REGRESSION")
            status, response = request("wallet_status", "wallet_status", origin)
            if status != 401 or response.get("error") != "LOGIN_REQUIRED":
                raise RuntimeError("ANONYMOUS_WALLET_ACCESS_NOT_REJECTED")
            status, response = request("wallet_status", "wallet_status", "https://attacker.invalid")
            if status != 403 or response.get("error") != "ORIGIN_DENIED":
                raise RuntimeError("CROSS_ORIGIN_WALLET_REQUEST_NOT_REJECTED")
            print("WALLET_HEALTH_GUEST_ORIGIN_GUARDS_VERIFIED", flush=True)
            print("WALLET_TEST_OWNER_RELEASE_SUCCESS_NO_REAL_PAYMENTS", flush=True)
        except BaseException:
            print("WALLET_RELEASE_FAILED_RESTORING_PRIOR_FILES", flush=True)
            for name in reversed(uploaded):
                try:
                    if originals[name] is None:
                        ftp.delete(dest[name])
                    else:
                        put(dest[name], originals[name])
                    print("WALLET_ROLLBACK_OK", name, flush=True)
                except BaseException:
                    print("WALLET_ROLLBACK_FAILURE_MANUAL_RECOVERY_REQUIRED", name, flush=True)
            raise
    finally:
        try:
            ftp.quit()
        except BaseException:
            ftp.close()

if __name__ == "__main__":
    main()
