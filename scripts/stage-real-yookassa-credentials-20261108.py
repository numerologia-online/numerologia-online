"""Stage REAL YooKassa secrets privately on REG.RU, without activating charges.

Only uses GitHub Actions encrypted secrets. Never uploads a secret under www,
writes to repo, displays any value, or changes an existing live configuration.
Fiscal approval flags stay FALSE until merchant-specific tax and refund review.
"""
import ftplib
import io
import os
import re
import ssl

HOST="server172.hosting.reg.ru"

def main():
    shop=os.environ.get("NUMI_YOOKASSA_LIVE_SHOP_ID","").strip()
    key=os.environ.get("NUMI_YOOKASSA_LIVE_SECRET_KEY","").strip()
    if not shop or not key:
        print("LIVE_CREDENTIALS_NOT_PROVIDED_IN_GITHUB_SECRETS",flush=True)
        print("REAL_PAYMENT_ACTIVATION_REMAINS_DISABLED",flush=True)
        return
    if not re.fullmatch(r"[0-9]{3,20}",shop):
        raise RuntimeError("INVALID_LIVE_SHOP_ID")
    if not re.fullmatch(r"live_[A-Za-z0-9_-]{12,480}",key):
        raise RuntimeError("INVALID_LIVE_SECRET_FORMAT")
    user,password=os.environ.get("REG_FTP_USER"),os.environ.get("REG_FTP_PASSWORD")
    if not user or not password:
        raise RuntimeError("MISSING_REG_FTP_SECRETS")
    content=(
        "<?php\n"
        "declare(strict_types=1);\n"
        "// Private staged credentials. LIVE PAYMENTS DISABLED by default.\n"
        "return [\n"
        "  'wallet_mode' => 'disabled',\n"
        "  'real_wallet_enabled' => false,\n"
        "  'provider_test_mode' => false,\n"
        "  'fiscalization_verified' => false,\n"
        "  'refunds_verified' => false,\n"
        "  'advance_offset_receipts_verified' => false,\n"
        "  'offset_receipt_worker_verified' => false,\n"
        "  'refund_worker_verified' => false,\n"
        "  'advance_receipt_reviewed' => false,\n"
        "  'offset_receipt_reviewed' => false,\n"
        "  'launch_approved' => false,\n"
        "  'shop_id' => '" + shop + "',\n"
        "  'secret_key' => '" + key + "',\n"
        "];\n"
    ).encode("utf-8")
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    ftp.connect(HOST,21)
    ftp.login(user,password)
    ftp.prot_p()
    ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    private=home+"/private/numi-wallet-live"
    remote=private+"/config.local.php"
    def read():
        stream=io.BytesIO()
        try:ftp.retrbinary("RETR "+remote,stream.write)
        except ftplib.error_perm as exc:
            if str(exc).startswith("550"):return None
            raise
        return stream.getvalue()
    try:
        ftp.cwd(private)
        existing=read()
        if existing is not None:
            print("LIVE_PRIVATE_CONFIG_ALREADY_EXISTS_NO_OVERWRITE",flush=True)
            return
        ftp.storbinary("STOR "+remote,io.BytesIO(content))
        if read()!=content:
            try:ftp.delete(remote)
            except Exception:pass
            raise RuntimeError("LIVE_PRIVATE_CONFIG_READBACK_FAILED")
        print("LIVE_YOOKASSA_KEYS_STAGED_PRIVATELY_CHARGES_STILL_DISABLED",flush=True)
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    main()
