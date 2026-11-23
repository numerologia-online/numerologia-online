#!/usr/bin/env python3
"""Disable Family generation, delete its two rejected KBs on REG.RU; keep paid history."""
import os,io,ftplib,ssl,hashlib,subprocess,pathlib,time,urllib.request,urllib.error
base="ce9c5e1cec4a5a19d9109dfca35e35dc3be57df7"
php="account-service/private/family-live.php"
bases=["account-service/private/family-live-knowledge-v2.json",
       "account-service/private/family-live-knowledge.txt"]
old={p:subprocess.check_output(["git","show",base+":"+p]) for p in [php]+bases}
new=pathlib.Path(php).read_bytes()
assert b"function nfEngineInstalled(): bool {\n    // No new paid quote or generation until the user approves the rebuilt engine.\n    return false;\n}" in new
assert b"FAMILY_REBUILD_PENDING" in new
assert b"function nfMaterialFromCache" in new and b"function nfLegacyCachedAnswer" in new
assert b"nfFamilyKnowledge" not in new and b"nfGenerateText" not in new
assert all(not pathlib.Path(p).exists() for p in bases)
lint=subprocess.run(["php","-l"],input=new,capture_output=True)
if lint.returncode:raise RuntimeError("FAMILY_PHP_SYNTAX "+lint.stderr.decode(errors="replace")[-200:])
test=r"""<?php
function naCatalogDate($d){return is_string($d)&&preg_match('/^(?:19|20)\d\d-\d\d-\d\d$/D',$d)?$d:null;}
require 'account-service/private/family-live.php';
if(nfEngineInstalled()!==false||count(nfQuestions())!==10)throw new RuntimeException('UNSAFE');
try{nfEnsureAnswer('household','1987-07-15');throw new RuntimeException('UNSAFE_NEW_ANSWER');}
catch(RuntimeException $e){if($e->getMessage()!=='FAMILY_REBUILD_PENDING')throw $e;}
if(!nfSupportedPaidResource('redflag_question','redflag:family:household:1987-07-15'))throw new RuntimeException('PAID_RESOURCE_LOST');
echo 'FAMILY_KB_SAFE_HOLD_TEST_PASS',PHP_EOL;
"""
t=subprocess.run(["php"],input=test.encode(),capture_output=True)
if t.returncode or b"FAMILY_KB_SAFE_HOLD_TEST_PASS" not in t.stdout:
    raise RuntimeError("FAMILY_STATIC_TEST "+t.stderr.decode(errors="replace")[-320:])
print("FAMILY_KB_SAFE_HOLD_TEST_PASS",flush=True)
def status(p):
    req=urllib.request.Request("https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"+p+"?kbdelete="+str(time.time_ns()),headers={"Cache-Control":"no-store"})
    try:
        with urllib.request.urlopen(req,timeout=27) as a:return a.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    codes=[status(""),status("redflag-ai-lab/style-test-api.php"),status("api/numi-account.php")]
    print("SITE_HEALTH",codes,flush=True)
    return codes[0]==200 and codes[1]==403 and codes[2] in (403,405)
if not healthy():raise RuntimeError("SITE_UNHEALTHY_BEFORE")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=48)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p()
home=ftp.pwd().rstrip("/")
priv=home+"/private/numi-account-20261031/"
web=home+"/www/xn--c1adkkdfjbp1a4l.online/"
dst={priv+p.rsplit("/",1)[-1]:p for p in bases}
live=priv+"family-live.php"
def read(p):
    f=io.BytesIO()
    try:ftp.retrbinary("RETR "+p,f.write)
    except ftplib.error_perm as e:
        if str(e).startswith("550"):return None
        raise
    return f.getvalue()
def write(p,data):
    ftp.storbinary("STOR "+p,io.BytesIO(data))
    if read(p)!=data:raise RuntimeError("READBACK_FAILURE")
saved={}
modified=[]
try:
    for remote,path in {live:php,**dst}.items():
        val=read(remote)
        if val not in ((old[path],new) if path==php else (old[path],None)):
            raise RuntimeError("REMOTE_DRIFT_NO_WRITES")
        saved[remote]=val
    protected=[priv+"intimacy-live.php",priv+"language-live.php",priv+"wallet-real-payment.php",
      priv+"family-live-questions.json",priv+"family-live-followups.json",priv+"fulfillment.php",
      web+"redflag-feature.js",web+"index.html",web+"api/numi-family-free.php"]
    checks={p:hashlib.sha256(read(p)).hexdigest() for p in protected}
    if not healthy():raise RuntimeError("SITE_UNHEALTHY_PREFLIGHT")
    if saved[live]!=new:
        modified.append(live)
        write(live,new)
    # Disable all Family generation BEFORE deleting KBs, rollback reverse.
    for remote in dst:
        if saved[remote] is not None:
            modified.append(remote)
            ftp.delete(remote)
            if read(remote) is not None:raise RuntimeError("KB_DELETE_FAILED")
    if not healthy():raise RuntimeError("SITE_UNHEALTHY_AFTER")
    if read(live)!=new or any(read(p) is not None for p in dst):
        raise RuntimeError("FINAL_REMOTE_VERIFICATION_FAILED")
    if any(hashlib.sha256(read(p)).hexdigest()!=h for p,h in checks.items()):
        raise RuntimeError("PROTECTED_FILE_CHANGED")
    print("FAMILY_BASES_REMOVED_FROM_REG_RU true; new_generation_disabled=true; existing_answers_preserved=true; no_paid_AI_calls=true",flush=True)
except BaseException:
    errors=[]
    for remote in reversed(modified):
        try:write(remote,saved[remote])
        except BaseException:errors.append(remote)
    print("ROLLBACK_"+("FAILED" if errors else "SUCCESS"),flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
