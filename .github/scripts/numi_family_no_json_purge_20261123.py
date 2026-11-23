#!/usr/bin/env python3
"""Disable Family saved drafts, enable uncached owner previews, DELETE 42 old Family answer JSONs.
Only these old Family cache files and their .lock companions are erased.
No model calls, customer payments, other product data or other editorial drafts changed.
"""
import os,ftplib,ssl,io,posixpath,re,hashlib,subprocess,pathlib,urllib.request,urllib.error,time,uuid
BASE="f72f282a9688ea98db23487500d753f162a4cd8a"
FILES=["redflag-ai-lab/family-owner-preview-api.php","redflag-ai-lab/keep.php","redflag-feature.js","app.js","index.html"]
HOST="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
QIDS=("independent","household","vacation","plans","children","roles","home","conflict","money-at-home","care")
def git_before(path):return subprocess.check_output(["git","show",BASE+":"+path])
def local(path):return pathlib.Path(path).read_bytes()
for path in FILES:
    new=local(path)
    if path!="redflag-ai-lab/family-owner-preview-api.php":
        old=git_before(path)
        # An already updated file may match the baseline; still verify remote bytes.
    syntax=subprocess.run(["php","-l",path],capture_output=True) if path.endswith(".php") else None
    if syntax is not None and syntax.returncode:raise RuntimeError("PHP_SYNTAX_"+path)
for path in ["redflag-feature.js","app.js"]:
    check=subprocess.run(["node","--check",path],capture_output=True)
    if check.returncode:raise RuntimeError("JS_SYNTAX_"+path)
owner_api=local(FILES[0]);keeper=local(FILES[1]);ui=local(FILES[2])
assert b"if(!naTestOwner(naCurrent(naDB())))" in owner_api
assert b"'independent'=>['left','top','right','bottom','tailSecond']" in owner_api
assert b"'household'=>['left','top','wellbeing','bottom','rightNear']" in owner_api
assert b"FAMILY_DRAFT_STORAGE_DISABLED" in keeper
assert b"familyEphemeral" in ui
assert b'question.isFree&&id==="independent"&&!ownerDraftInScope' in ui
assert b'section==="family"' in ui
assert b'family-owner-preview-api.php' in ui
assert b'family-no-json-20261123' in local("app.js")
assert b'family-no-json-20261123' in local("index.html")
def status(path):
    req=urllib.request.Request(HOST+path+"?family_nocache="+str(time.time_ns()),
       headers={"Cache-Control":"no-store"})
    try:
       with urllib.request.urlopen(req,timeout=30) as response:return response.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    codes=[status(''),status('redflag-ai-lab/style-test-api.php'),
           status('redflag-ai-lab/family-owner-preview-api.php')]
    print("SITE_HEALTH",codes,flush=True)
    return codes==[200,403,403]
if not healthy():raise RuntimeError("SITE_NOT_HEALTHY_BEFORE_NO_WRITE")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=55)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
root=home+"/www/xn--c1adkkdfjbp1a4l.online/"
priv=home+"/private/numi-account-20261031/"
cache=priv+"family-answer-cache/"
backup=home+"/site-safeguard-backups/"
def read(remote):
    out=io.BytesIO()
    try:ftp.retrbinary("RETR "+remote,out.write)
    except ftplib.error_perm as e:
        if str(e).startswith("550"):return None
        raise
    return out.getvalue()
def write(remote,data):
    ftp.storbinary("STOR "+remote,io.BytesIO(data))
    if read(remote)!=data:raise RuntimeError("FTP_READBACK_MISMATCH")
def listing():
    result=[posixpath.basename(x.rstrip('/')) for x in ftp.nlst(cache)]
    return sorted(n for n in result if n not in ('.','..','family-answer-cache'))
json_pat=re.compile(r"^("+ "|".join(re.escape(q) for q in QIDS) +r")-\d{8}-(?:family-[a-z0-9-]+|nokb-v\d+)\.json$")
lock_pat=re.compile(r"^("+ "|".join(re.escape(q) for q in QIDS) +r")-\d{8}-(?:family-[a-z0-9-]+|nokb-v\d+)\.json\.lock$")
saved={};written=[];deleted=[]
try:
    for p in FILES:
        remote=root+p
        curr=read(remote)
        allowed=(git_before(p),local(p))
        if curr not in allowed:raise RuntimeError("REMOTE_FILE_DRIFT_"+p)
        saved[remote]=curr
    family=read(priv+"family-live.php")
    if family is None or b"FAMILY_REBUILD_PENDING" not in family or b"return false;" not in family:
        raise RuntimeError("FAMILY_PAUSE_MISSING")
    protected=[priv+"family-live.php",priv+"wallet-real-payment.php",
       priv+"fulfillment.php",priv+"family-live-questions.json",root+"redflag-public-catalog.js",
       root+"redflag-ai-lab/style-test-api.php"]
    digests={}
    for p in protected:
        val=read(p)
        if val is None:raise RuntimeError("PROTECTED_FILE_MISSING")
        digests[p]=hashlib.sha256(val).hexdigest()
    names=listing()
    jsons=[n for n in names if json_pat.fullmatch(n)]
    locks=[n for n in names if lock_pat.fullmatch(n)]
    others=[n for n in names if n not in jsons and n not in locks]
    # The previous read-only audit saw 42 JSON and 45 lock files.
    # Any drift aborts; no broad deletion or directory recursion.
    print("BEFORE_PURGE","family_json",len(jsons),"family_lock",len(locks),"unrelated_entries",len(others),flush=True)
    if len(jsons)!=42 or len(locks)!=45 or others:
        raise RuntimeError("CACHE_COUNT_DRIFT_NO_DELETION")
    if not healthy():raise RuntimeError("SITE_CHANGED_PREFLIGHT")
    try:ftp.mkd(backup.rstrip("/"))
    except ftplib.error_perm as e:
        if not str(e).startswith("550"):raise
    tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+"-"+uuid.uuid4().hex[:8]
    for p in FILES:
        remote=root+p
        if saved[remote]!=local(p):
            write(backup+"before-family-ephemeral-"+tag+"-"+p.replace('/','-')+".bak",saved[remote])
    for p in FILES:
        remote=root+p
        new=local(p)
        if read(remote)!=saved[remote]:raise RuntimeError("REMOTE_CODE_CONCURRENT_EDIT")
        if saved[remote]!=new:
            written.append(remote)
            write(remote,new)
    if not healthy():raise RuntimeError("SITE_FAILED_AFTER_CODE")
    for p,h in digests.items():
        if hashlib.sha256(read(p)).hexdigest()!=h:raise RuntimeError("PROTECTED_FILE_CHANGED")
    if listing()!=names:raise RuntimeError("CACHE_CHANGED_DURING_CODE_DEPLOY")
    print("FAMILY_CACHE_SAVE_DISABLED VERIFIED owner_drafts_save_blocked=true owner_no_cache=true customers_generation_still_disabled=true",flush=True)
    # Stop before deletion if any unexpected name, user asked for exactly Family answer cache.
    # Old JSONs are intentionally deleted, NOT backed up (explicit user request).
    for n in jsons+locks:
        remote=cache+n
        ftp.delete(remote)
        deleted.append(n)
    remaining=listing()
    still_json=[n for n in remaining if json_pat.fullmatch(n)]
    still_lock=[n for n in remaining if lock_pat.fullmatch(n)]
    if still_json or still_lock:raise RuntimeError("FAMILY_CACHE_PURGE_INCOMPLETE")
    if any(read(root+p)!=local(p) for p in FILES):
        raise RuntimeError("REMOTE_CODE_READBACK_FAIL")
    if not healthy():raise RuntimeError("POST_PURGE_SITE_HEALTH_FAIL")
    print("FAMILY_PURGE_DONE deleted_json",len(jsons),
        "deleted_lock",len(locks),"remaining_family_json",len(still_json),
        "remaining_family_lock",len(still_lock),
        "new_json_writes_disabled=true",
        "owner_preview_uncached=true",
        "old_customer_engine_off=true",
        "gemini_calls=0",flush=True)
except BaseException:
    print("FAMILY_PURGE_STATUS deleted_entries",len(deleted),flush=True)
    if not deleted:
       errors=[]
       for remote in reversed(written):
          try:write(remote,saved[remote])
          except BaseException:errors.append(remote)
       print("CODE_ROLLBACK_"+("FAILED_"+",".join(errors) if errors else "SUCCESS"),flush=True)
    else:
       print("CODE_LEFT_IN_SAFE_NO_SAVING_STATE; USER_REQUESTED_DELETIONS_NOT_ROLLED_BACK",flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
