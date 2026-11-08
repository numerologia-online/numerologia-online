"""Publish the existing REAL wallet PHP backend on REG.RU via FTPS.

This deploys production-capable CODE, NOT live charging. Never touch DB,
fiscal credentials, customer records, bots, subscriptions, or storefront HTML.
Abort on unrecognized existing server files; back up and roll back on failure.
"""
import ftplib
import hashlib
import io
import os
import pathlib
import ssl
import subprocess
import time

HOST = "server172.hosting.reg.ru"
WEBROOT = "xn--c1adkkdfjbp1a4l.online"
FILES = {
    "wallet-real.php": "account-service/private/wallet-real.php",
    "wallet-real-payment.php": "account-service/private/wallet-real-payment.php",
    "wallet.php": "account-service/private/wallet.php",
}
LIMIT = 1000000


def sha(data):
    return hashlib.sha256(data).hexdigest()


def known_git_version(path, data):
    if data is None:
        return False
    if data == pathlib.Path(path).read_bytes():
        return True
    # Only replace files that match a prior committed version of THAT file.
    commits = subprocess.check_output(
        ["git", "log", "-60", "--format=%H", "--", path], text=True
    ).splitlines()
    for commit in commits:
        old = subprocess.run(
            ["git", "show", f"{commit}:{path}"], capture_output=True
        )
        if old.returncode == 0 and old.stdout == data:
            return True
    return False


def main():
    user, password = os.getenv("REG_FTP_USER"), os.getenv("REG_FTP_PASSWORD")
    if not user or not password:
        raise RuntimeError("REG_RU_FTPS_SECRETS_NOT_SET")
    for name, path in FILES.items():
        source = pathlib.Path(path).read_bytes()
        if not source.startswith(b"<?php") or len(source) > LIMIT:
            raise RuntimeError("INVALID_REVIEWED_SOURCE:" + name)
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30)
    ftp.connect(HOST, 21)
    ftp.login(user, password)
    ftp.prot_p()
    ftp.set_pasv(True)
    home = ftp.pwd().rstrip("/")
    public = home + "/www/" + WEBROOT
    private = home + "/private/numi-account-20261031"
    originals, locations, changed = {}, {}, []

    def read(remote):
        output = io.BytesIO()
        def collect(chunk):
            if output.tell() + len(chunk) > LIMIT:
                raise RuntimeError("REMOTE_TOO_LARGE")
            output.write(chunk)
        try:
            ftp.retrbinary("RETR " + remote, collect)
        except ftplib.error_perm as err:
            if str(err).startswith("550"):
                return None
            raise
        return output.getvalue()

    def write(remote, value):
        ftp.storbinary("STOR " + remote, io.BytesIO(value))
        if read(remote) != value:
            raise RuntimeError("FTPS_READBACK_MISMATCH")

    try:
        ftp.cwd(private)
        if read(public + "/index.html") is None:
            raise RuntimeError("SITE_ROOT_NOT_VERIFIED")
        existing_core = read(private + "/core.php")
        if not existing_core or b"wallet" not in existing_core:
            raise RuntimeError("ACCOUNT_API_WALLET_ROUTE_MISSING")
        live_config = read(home + "/private/numi-wallet-live/config.local.php")
        if live_config is not None:
            # No existing live config is edited, but refuse to hot-replace an
            # active payment implementation in use.
            if (b"'wallet_mode'=>'live'" in live_config
                or b"'wallet_mode' => 'live'" in live_config
                or b'"wallet_mode" => "live"' in live_config):
                raise RuntimeError("LIVE_PAYMENTS_ALREADY_ACTIVE_NO_HOT_REPLACEMENT")
        for name, source_path in FILES.items():
            remote = private + "/" + name
            old = read(remote)
            if old is not None and not known_git_version(source_path, old):
                raise RuntimeError("UNRECOGNIZED_REMOTE_EDIT_STOP:" + name)
            originals[name], locations[name] = old, remote
            print("SOURCE_BASELINE_RECOGNIZED", name, flush=True)

        stamp = os.getenv("GITHUB_RUN_ID") or str(int(time.time()))
        backup_dir = home + "/private/numi-real-wallet-backup-" + stamp
        ftp.mkd(backup_dir)
        for name, old in originals.items():
            if old is not None:
                write(backup_dir + "/" + name + ".before", old)
                print("PRIVATE_BACKUP_VERIFIED", name, flush=True)
        try:
            for name, source_path in FILES.items():
                new = pathlib.Path(source_path).read_bytes()
                old = originals[name]
                remote = locations[name]
                if read(remote) != old:
                    raise RuntimeError("CONCURRENT_REG_RU_CHANGE:" + name)
                if old == new:
                    print("ALREADY_CURRENT", name, flush=True)
                    continue
                changed.append(name)
                write(remote, new)
                print("REAL_WALLET_PHP_PUBLISHED", name, sha(new), flush=True)
            print("REAL_WALLET_PHP_DEPLOYED_ON_REG_RU", flush=True)
            print("LIVE_PAYMENT_GATE_AND_DATABASE_UNCHANGED", flush=True)
        except BaseException:
            print("ROLLBACK_STARTED", flush=True)
            for name in reversed(changed):
                try:
                    old = originals[name]
                    if old is None:
                        ftp.delete(locations[name])
                    else:
                        write(locations[name], old)
                    print("ROLLBACK_VERIFIED", name, flush=True)
                except BaseException:
                    print("ROLLBACK_FAILED_MANUAL_RECOVERY_REQUIRED", name, flush=True)
            raise
    finally:
        try:
            ftp.quit()
        except BaseException:
            ftp.close()


if __name__ == "__main__":
    main()
