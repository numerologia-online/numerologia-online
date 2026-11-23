#!/usr/bin/env python3
"""Guarded FTPS release: owner-only Family manual preview + module cache bump.
No customer generator, catalogue, payment or pre-existing model route changes.
No paid AI requests. Roll back on drift / failed health checks.
"""
import hashlib,io,os,pathlib,ftplib,ssl,subprocess,time,uuid,urllib.request,urllib.error
BASE="a83f6721279a523059da70be36262e22e2939150"
NEW_API="redflag-ai-lab/family-owner-preview-api.php"
EXISTING=["redflag-feature.js","app.js","index.html"]
PRIVATE="private/numi-account-20261031/"
PUBLIC_HOST="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
def old_git(path):
    return subprocess.check_output(["git","show",BASE+":"+path])
def local(path):
    return pathlib.Path(path).read_bytes()
for path in EXISTING:
    assert old_git(path)!=local(path),path
assert not subprocess.run(["git","cat-file","-e",BASE+":"+NEW_API],capture_output=True).returncode==0
code=local(NEW_API)
assert b"if(!naTestOwner(naCurrent(naDB())))" in code
assert b"'draft_only'=>true,'published'=>false" in code
assert b"google/gemini-3-flash-preview" in code
assert b"50/50" not in code
assert b"'household'=>['left','top','wellbeing','bottom','rightNear']" in code
assert b"'care'=>['left','top','loveHeart','wellbeing','rightNear']" in code
assert b"/redflag-ai-lab/family-owner-preview-api.php" in local("redflag-feature.js")
for f in [NEW_API,"account-service/private/family-live.php"]:
    p=subprocess.run(["php","-l",f],capture_output=True)
    if p.returncode:raise RuntimeError("PHP_LINT_"+f+" "+p.stderr.decode(errors="replace")[:240])
p=subprocess.run(["node","--check","redflag-feature.js"],capture_output=True)
if p.returncode:raise RuntimeError("JS_SYNTAX_INVALID")
assert b"return false;" in local("account-service/private/family-live.php")
def status(path):
    req=urllib.request.Request(PUBLIC_HOST+path+"?family_owner_guard="+str(time.time_ns()),headers={"Cache-Control":"no-store"})
    try:
        with urllib.request.urlopen(req,timeout=25) as response:return response.status
    except urllib.error.HTTPError as exc:return exc.code
def site_ok(new_api):
    codes=[status(""),status("redflag-ai-lab/style-test-api.php"),
           status("redflag-ai-lab/family-owner-preview-api.php")]
    print("SITE_HEALTH",codes,flush=True)
    return codes[0]==200 and codes[1]==403 and codes[2]==(403 if new_api else 404)
if not site_ok(False):raise RuntimeError("PUBLIC_SITE_NOT_HEALTHY_BEFORE_NO_WRITES")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=46)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip("/")
root=home+"/www/xn--c1adkkdfjbp1a4l.online/"
private=home+"/"+PRIVATE
backup=home+"/site-safeguard-backups/"
def get(path):
    f=io.BytesIO()
    try:ftp.retrbinary("RETR "+path,f.write)
    except ftplib.error_perm as e:
        if str(e).startswith("550"):return None
        raise
    return f.getvalue()
def put(path,data):
    ftp.storbinary("STOR "+path,io.BytesIO(data))
    if get(path)!=data:raise RuntimeError("FTP_READBACK_FAILED")
saved={};written=[]
try:
    targets=[NEW_API]+EXISTING
    for p in targets:
        remote=root+p;content=get(remote)
        allowed=(None,local(p)) if p==NEW_API else (old_git(p),local(p))
        if content not in allowed:raise RuntimeError("REMOTE_DRIFT_NO_WRITES_"+p)
        saved[remote]=content
    if saved[root+NEW_API] is not None:raise RuntimeError("FAMILY_OWNER_ROUTE_ALREADY_PRESENT")
    family=get(private+"family-live.php")
    if family is None or b"return false;" not in family or b"FAMILY_REBUILD_PENDING" not in family:
        raise RuntimeError("CUSTOMER_FAMILY_ENGINE_NOT_PAUSED_NO_WRITES")
    protected=[private+"family-live.php",private+"intimacy-live.php",private+"fulfillment.php",
       private+"family-live-questions.json",private+"family-live-followups.json",
       root+"redflag-ai-lab/style-test-api.php",root+"wallet-client.js",
       root+"redflag-public-catalog.js",root+"api/numi-owner-material.php"]
    hashes={}
    for p in protected:
        body=get(p)
        if body is None:raise RuntimeError("PROTECTED_FILE_MISSING")
        hashes[p]=hashlib.sha256(body).hexdigest()
    if not site_ok(False):raise RuntimeError("PUBLIC_SITE_CHANGED_NO_WRITES")
    try:ftp.mkd(backup.rstrip("/"))
    except ftplib.error_perm as e:
        if not str(e).startswith("550"):raise
    tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:8]
    for p in EXISTING:
        if saved[root+p]!=local(p):
            put(backup+"before-family-owner-preview-"+tag+"-"+p.replace("/","-")+".bak",saved[root+p])
    if any(get(p)!=saved[p] for p in saved):raise RuntimeError("REMOTE_CHANGED_PREWRITE")
    # New owner route becomes available before client UI points at it.
    for p in targets:
        remote=root+p;now=local(p)
        if saved[remote]!=now:
            written.append(remote)
            put(remote,now)
    if not site_ok(True):raise RuntimeError("PUBLIC_SITE_UNHEALTHY_AFTER")
    for p,digest in hashes.items():
        if hashlib.sha256(get(p)).hexdigest()!=digest:
            raise RuntimeError("PROTECTED_FILE_CHANGED")
    if any(get(root+p)!=local(p) for p in targets):
        raise RuntimeError("DEPLOY_READBACK_MISMATCH")
    print("FAMILY_OWNER_PREVIEW_PUBLISHED VERIFIED owner_only=true questions=9"
          " model=gemini-3-flash paid_ai_calls=0 rejected_bases_restored=false"
          " customer_engine_still_paused=true customer_payments_untouched=true",flush=True)
except BaseException:
    errors=[]
    for remote in reversed(written):
        old=saved[remote]
        try:
            if old is None:ftp.delete(remote)
            else:put(remote,old)
        except BaseException:errors.append(remote)
    print("ROLLBACK_"+("FAILED_"+",".join(errors) if errors else "SUCCESS"),flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
