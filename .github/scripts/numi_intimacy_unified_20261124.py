#!/usr/bin/env python3
import os,io,json,ssl,ftplib,hashlib,time,uuid,pathlib,subprocess,urllib.request,urllib.error
API="redflag-ai-lab/intimacy-practical-preview-api.php"
base_ref="296d8fc0b58654f506a4e2c62d89127f6fbf9383"
files=["account-service/private/intimacy-live.php","redflag-ai-lab/style-test-api.php","redflag-ai-lab/intimacy-pilot-api.php"]
old={p:subprocess.check_output(["git","show",base_ref+":"+p]) for p in files}
new={p:pathlib.Path(p).read_bytes() for p in files}
for p in files:subprocess.run(["php","-l",p],check=True)
live=new[files[0]].decode()
prev=old[files[0]].decode()
assert live.split("function niGenerateText(",1)[0]==prev.split("function niGenerateText(",1)[0]
assert "return ipGenerateText($question,$day,$month,$year);" in live
assert "трактовки_значимых_позиций_полной_матрицы" not in live
assert "-practical-v1.json" in live
assert "LEGACY_INTIMACY_PREVIEW_RETIRED" in new[files[2]].decode()
fixture=r"""<?php
require 'account-service/private/intimacy-live.php';
require 'account-service/private/intimacy-practical-engine.php';
if(count(ipKnowledge())!==22||count(ipQuestions())!==10)throw new RuntimeException('KB');
foreach(ipQuestions() as $q){
    $p=json_decode(ipMessages($q,15,7,1987)[1]['content'],true,30,JSON_THROW_ON_ERROR);
    if(count($p['четыре_значимые_позиции'])!==4)throw new RuntimeException('POSITIONS');
}
$today=new DateTimeImmutable('2026-11-24',new DateTimeZone('Europe/Moscow'));
if(!niAdultBirthDate('2008-11-24',$today)||niAdultBirthDate('2008-11-25',$today))throw new RuntimeException('AGE');
echo 'UNIFIED_OFFLINE_PASS';
"""
subprocess.run(["php"],input=fixture.encode(),check=True)
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
def status(p):
    req=urllib.request.Request(BASE+p+"?intimacy_practical="+str(time.time_ns()),headers={"Cache-Control":"no-store"})
    try:
        with urllib.request.urlopen(req,timeout=25) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def healthy(new=False):
    codes=[status(""),status("redflag-ai-lab/style-test-api.php"),status("redflag-ai-lab/family-owner-preview-api.php"),status("api/numi-owner-material.php"),status("api/numi-intimacy-free.php")]
    if new:codes.append(status(API))
    print("SITE_HEALTH",codes,flush=True)
    return codes[:4]==[200,403,403,403] and codes[4] in (400,403,405) and (not new or codes[5]==403)
if not healthy(True):raise RuntimeError("PRE_HEALTH")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45);ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip("/");private=home+"/private/numi-account-20261031/";web=home+"/www/xn--c1adkkdfjbp1a4l.online/"
def remote(p):
    if p.startswith('account-service/private/'):return private+p.rsplit('/',1)[-1]
    if p.startswith('account-service/public/'):return web+'api/'+p.rsplit('/',1)[-1]
    return web+p
def read(p,optional=False):
    out=io.BytesIO()
    try:ftp.retrbinary("RETR "+p,out.write)
    except ftplib.error_perm as e:
        if optional and str(e).startswith("550"):return None
        raise
    return out.getvalue()
def write(p,b):
    ftp.storbinary("STOR "+p,io.BytesIO(b))
    if read(p)!=b:raise RuntimeError("READBACK_FAIL")
protected=[private+x for x in ["intimacy-live.php","intimacy-live-knowledge.json","intimacy-live-questions.json","family-live.php","family-practical-engine.php","family-owner-knowledge-v1.txt","language-live.php","language-live-knowledge.txt","wallet-real-payment.php","fulfillment.php","core.php","redflag-catalog.json"]]+[web+x for x in ["redflag-feature.js","app.js","index.html","redflag-ai-lab/intimacy-practical-preview-api.php","redflag-public-catalog.js","api/numi-intimacy-free.php","api/numi-language-free.php","api/numi-owner-material.php","redflag-ai-lab/style-test-api.php","redflag-ai-lab/family-owner-preview-api.php","redflag-ai-lab/keep.php"]]
protected=[p for p in protected if p not in [remote(f) for f in files]]
saved={};changed=[]
try:
    for p in files:
        saved[p]=read(remote(p),False)
        if saved[p] not in (old[p],new[p]):raise RuntimeError("REMOTE_DRIFT_"+p)
    hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
    for n in ['intimacy-practical-engine.php','intimacy-practical-knowledge.txt']:
        assert read(private+n)==pathlib.Path('account-service/private/'+n).read_bytes()
    for n in ["intimacy-live-knowledge.json","intimacy-live-questions.json","family-practical-engine.php","family-owner-knowledge-v1.txt","language-live.php","language-live-knowledge.txt"]:
        assert read(private+n)==pathlib.Path("account-service/private/"+n).read_bytes()
    backup=home+"/site-safeguard-backups"
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith("550"):raise
    tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:6]
    for p in files:
        if saved[p] is not None and saved[p]!=new[p]:write(backup+"/before-intimacy-unified-"+tag+"-"+p.rsplit("/",1)[-1]+".bak",saved[p])
    for p in files:
        if read(remote(p),False)!=saved[p]:raise RuntimeError("REMOTE_CONCURRENT_EDIT")
        if saved[p]!=new[p]:
            changed.append(p);write(remote(p),new[p])
    if not healthy(True):raise RuntimeError("POST_HEALTH")
    for p in files:
        if read(remote(p))!=new[p]:raise RuntimeError("FINAL_BYTES")
    for p,h in hashes.items():
        if hashlib.sha256(read(p)).digest()!=h:raise RuntimeError("PROTECTED_CHANGED")
    print("INTIMACY_UNIFIED_LIVE same_generator=true new_cache=true old_paid_preserved=true age_gate=true model_calls=0",flush=True)
except BaseException:
    for p in reversed(changed):
        try:
            if saved[p] is None:ftp.delete(remote(p))
            else:write(remote(p),saved[p])
            print("ROLLBACK_OK",p,flush=True)
        except BaseException:print("ROLLBACK_FAILED",p,flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
