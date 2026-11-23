#!/usr/bin/env python3
"""Strict owner-approved update: only Family arcana 4/10 plus terse variety instruction."""
import os,ftplib,ssl,io,subprocess,pathlib,hashlib,urllib.request,urllib.error,time,uuid
base='8500af80774134311757d9b5ee83e8d6c8edd293';folder='account-service/private/'
paths=[folder+'family-live-knowledge.txt',folder+'family-live.php']
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in paths}
new={p:pathlib.Path(p).read_bytes() for p in paths}
before=old[paths[0]].decode().strip().splitlines()
after=new[paths[0]].decode().strip().splitlines()
assert len(before)==len(after)==22 and len(new[paths[0]].decode())<5000
assert [idx for idx,(x,y) in enumerate(zip(before,after),1) if x!=y]==[4,10]
assert all(line.split('|')[0]==str(i) and line.count('|')==2 for i,line in enumerate(after,1))
source=new[paths[1]]
for s in [b'-family-focused-v4.json',b'-family-focused-v3.json',b'-family-kb-v2.json',b'-nokb-v1.json',
          b'google/gemini-3-flash-preview',b'nfQuestionFocus(',b'nfQuestionPoints(',b'nfFitFamilyAnswerLength(',b'FAMILY_RESULT_FAIL']:
    assert s in source
assert b"'max_tokens'=>$tokens" in source and b'CURLOPT_TIMEOUT=>95' in source
check=subprocess.run(['php','-l'],input=source,capture_output=True)
if check.returncode:raise RuntimeError('PHP_INVALID_'+check.stderr.decode('utf8','replace')[:250])
php=r"""<?php
function naCatalogDate($d){return is_string($d)&&preg_match('/^\d{4}-\d\d-\d\d$/',$d)?$d:null;}
require 'account-service/private/family-live.php';
$bank=nfFamilyKnowledge();if(count($bank)!==22)throw new RuntimeException('COUNT');
if(!str_contains($bank['4']['minus'],'знает за других'))throw new RuntimeException('FOUR');
if(!str_contains($bank['10']['plus'],'гибкость'))throw new RuntimeException('TEN');
foreach(nfQuestions() as $row){
 $p=nfQuestionPoints($row['id']);
 if(count($p)!==6||!in_array('left',$p,true)||!in_array('top',$p,true))throw new RuntimeException('POINTS');
 if(!nfQuestionFocus($row['id']))throw new RuntimeException('FOCUS');
}
if(!str_ends_with(nfCacheFile('household','1987-10-31'),'-family-focused-v4.json'))throw new RuntimeException('CACHE');
echo 'FAMILY_4_10_TESTS_OK',PHP_EOL;
"""
result=subprocess.run(['php'],input=php.encode(),capture_output=True)
if result.returncode or b'FAMILY_4_10_TESTS_OK' not in result.stdout:
    raise RuntimeError('FAMILY_TEST_FAILED_'+result.stderr.decode('utf8','replace')[-300:])
print('FAMILY_4_10_TESTS_OK',flush=True)
def site(p):
    req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?check='+str(time.time_ns()),headers={'Cache-Control':'no-store'})
    try:
        with urllib.request.urlopen(req,timeout=25) as v:return v.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    x=[site(''),site('redflag-ai-lab/style-test-api.php'),site('api/numi-account.php')]
    print('SITE_HEALTH',x,flush=True)
    return x[0]==200 and x[1]==403 and x[2] in (403,405)
if not healthy():raise RuntimeError('UNHEALTHY_BEFORE')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
remote={home+'/private/numi-account-20261031/'+p.rsplit('/',1)[-1]:p for p in paths}
def read(p):
    f=io.BytesIO();ftp.retrbinary('RETR '+p,f.write);return f.getvalue()
def write(p,data):
    ftp.storbinary('STOR '+p,io.BytesIO(data))
    if read(p)!=data:raise RuntimeError('READBACK_FAILED')
saved={};done=[]
try:
    for target,p in remote.items():
        b=read(target)
        if b not in [old[p],new[p]]:raise RuntimeError('LIVE_FAMILY_DRIFT_NO_WRITES')
        saved[target]=b
    prefix=home+'/private/numi-account-20261031/'
    webroot=home+'/www/xn--c1adkkdfjbp1a4l.online/'
    protected=[prefix+'intimacy-live.php',prefix+'intimacy-live-knowledge.json',prefix+'fulfillment.php',
              prefix+'wallet-real-payment.php',webroot+'api/numi-family-free.php',
              webroot+'api/numi-owner-material.php',webroot+'redflag-feature.js',webroot+'index.html']
    hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
    if not healthy():raise RuntimeError('UNHEALTHY_PREFLIGHT')
    backup=home+'/site-safeguard-backups'
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:6]
    for target,p in remote.items():
        if saved[target]!=new[p]:
            write(backup+'/family-before-4-10-'+tag+'-'+target.rsplit('/',1)[-1]+'.bak',saved[target])
    for target,p in remote.items():
        if read(target)!=saved[target]:raise RuntimeError('CONCURRENT_UPDATE')
        if saved[target]!=new[p]:
            done.append(target);write(target,new[p])
    if not healthy():raise RuntimeError('UNHEALTHY_AFTER')
    if any(hashlib.sha256(read(p)).digest()!=v for p,v in hashes.items()):raise RuntimeError('PROTECTED_CHANGED')
    if any(read(target)!=new[p] for target,p in remote.items()):raise RuntimeError('FINAL_DRIFT')
    print('FAMILY_4_10_PUBLISHED only_two_energies=true original_20_unchanged=true month_variation_prompt=true'
          ' model_unchanged=true old_paid_cache_accessible=true site_healthy=true paid_generations=0',flush=True)
except BaseException:
    failures=[]
    for target in reversed(done):
        try:write(target,saved[target])
        except BaseException:failures.append(target)
    print('ROLLBACK_'+('FAILED' if failures else 'SUCCESS'),flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
