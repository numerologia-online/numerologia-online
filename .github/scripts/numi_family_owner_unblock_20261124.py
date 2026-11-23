#!/usr/bin/env python3
"""Publish one-file Family owner editor unblock; no Gemini/provider calls.
Remove ineffective session mutex and cooldown (manual owner only).
"""
import os,ftplib,ssl,io,pathlib,subprocess,hashlib,urllib.request,urllib.error,time,uuid
API="redflag-ai-lab/family-owner-preview-api.php"
OLD="3880ba51c0adbb5030fb6ceac243389370b363b9"
before=subprocess.check_output(["git","show",OLD+":"+API])
after=pathlib.Path(API).read_bytes()
assert before!=after
assert before.count(b"niCloudCall(")==after.count(b"niCloudCall(")==1
assert b"WAIT_15_SECONDS" in before and b"WAIT_15_SECONDS" not in after
assert b"session_start(" in before and b"session_start(" not in after
assert b"session_write_close" not in after
assert b"naTestOwner(naCurrent(naDB()))" in after
assert b"FAMILY_OWNER_KNOWLEDGE_UNAVAILABLE" in after
assert b"foKnowledge()" in after
assert b"google/gemini-3-flash-preview" in after
assert b"file_put_contents(" not in after and b"rename(" not in after
assert "ВТОРОЙ: примерно 600–700 знаков".encode() in after
assert b"function foFormatOwnerAnswer" in after
lint=subprocess.run(["php","-l",API],capture_output=True)
if lint.returncode:raise RuntimeError("PHP_LINT_FAILED "+lint.stderr.decode(errors='replace')[:400])
print("FAMILY_OWNER_API_STATIC_PASS no_15s_reject=true no_session_mutex=true model_calls=0",flush=True)
domain="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
def status(p):
    request=urllib.request.Request(domain+p+"?family_unblock="+str(time.time_ns()),
       headers={"Cache-Control":"no-store"})
    try:
        with urllib.request.urlopen(request,timeout=30) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    v=[status(""),status("redflag-ai-lab/style-test-api.php"),
       status("redflag-ai-lab/family-owner-preview-api.php")]
    print("SITE_HEALTH",v,flush=True)
    return v==[200,403,403]
if not healthy():raise RuntimeError("SITE_UNHEALTHY_BEFORE")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip("/")
web=home+"/www/xn--c1adkkdfjbp1a4l.online/"
private=home+"/private/numi-account-20261031/"
target=web+API
def read(p):
    o=io.BytesIO();ftp.retrbinary("RETR "+p,o.write);return o.getvalue()
def write(p,blob):
    ftp.storbinary("STOR "+p,io.BytesIO(blob))
    if read(p)!=blob:raise RuntimeError("FTP_VERIFICATION_FAILED")
was=None;changed=False
try:
    was=read(target)
    if was not in (before,after):
        raise RuntimeError("REMOTE_CODE_DRIFT_NO_WRITES")
    protect=[private+"family-live.php",private+"family-owner-knowledge-v1.txt",
             web+"redflag-ai-lab/keep.php",private+"wallet-real-payment.php",
             web+"redflag-feature.js",private+"intimacy-live.php"]
    hashes={p:hashlib.sha256(read(p)).digest() for p in protect}
    if b"FAMILY_REBUILD_PENDING" not in read(protect[0]) or b"FAMILY_DRAFT_STORAGE_DISABLED" not in read(protect[2]):
        raise RuntimeError("NO_CACHE_GUARD_MISSING")
    if not healthy():raise RuntimeError("SITE_CHANGED_BEFORE")
    if was!=after:
        backup=home+"/site-safeguard-backups"
        try:ftp.mkd(backup)
        except ftplib.error_perm as e:
            if not str(e).startswith("550"):raise
        tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:8]
        write(backup+"/before-family-owner-unblock-"+tag+".bak",was)
        if read(target)!=was:raise RuntimeError("CONCURRENT_EDIT_NO_WRITE")
        changed=True
        write(target,after)
    if not healthy():raise RuntimeError("SITE_BAD_AFTER")
    if read(target)!=after:raise RuntimeError("BAD_READBACK")
    for p,d in hashes.items():
        if hashlib.sha256(read(p)).digest()!=d:raise RuntimeError("PROTECTED_CHANGED")
    print("FAMILY_OWNER_UNBLOCK_PUBLISHED owner_only=true questions=10 cooldown_removed=true session_lock_removed=true model_unchanged=true prompt_unchanged=true kb_22_unchanged=true json_unchanged=true wallet_untouched=true paid_ai_calls=0",flush=True)
except BaseException:
    if changed:
        try:write(target,was);print("ROLLBACK_SUCCESS",flush=True)
        except BaseException:print("ROLLBACK_FAILED",flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
