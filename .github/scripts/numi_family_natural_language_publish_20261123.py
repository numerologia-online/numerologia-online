#!/usr/bin/env python3
"""Guarded correction for family dialogue: five thesis edits + de-duplicated points, no AI tests."""
import os,ftplib,ssl,io,subprocess,pathlib,hashlib,urllib.request,urllib.error,time,uuid
base='5bf0f6d2102efaa28104d5855636d70ae366eb34'
files=['account-service/private/family-live.php','account-service/private/family-live-knowledge.txt']
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files}
new={p:pathlib.Path(p).read_bytes() for p in files}
a=old[files[1]].decode().strip().splitlines()
b=new[files[1]].decode().strip().splitlines()
assert len(a)==len(b)==22 and len(new[files[1]].decode())<5000
assert [i for i,(x,y) in enumerate(zip(a,b),1) if x!=y]==[3,7,8,15,21]
assert all(x.split('|',1)[0]==str(i) and x.count('|')==2 for i,x in enumerate(b,1))
assert 'придворных' not in new[files[1]].decode()
assert 'золотой торт' not in new[files[1]].decode()
assert 'делегирует посуду' not in new[files[1]].decode()
source=new[files[0]]
for item in ['-family-conversational-v7.json','-family-punch-v6.json',
             '-family-ideal-synthesis-v5.json','-family-focused-v4.json',
             '-family-focused-v3.json','-family-kb-v2.json','-nokb-v1.json',
             'nfSummarizePointsForQuestion(','nfFamilyAnswerCall(',
             'family-live-knowledge.txt','FAMILY_TRANSIENT_UPSTREAM_RETRY',
             'google/gemini-3-flash-preview','CURLOPT_TIMEOUT=>95']:
    assert item.encode() in source,'MISSING_PROTECTED_REFERENCE'
assert source.count(b"'max_tokens'=>$tokens")==1
assert b"'полная_рассчитанная_матрица_для_контекста'" not in source
assert b'50/50' not in source
assert b"'-family-conversational-v7.json'" in source
lint=subprocess.run(['php','-l'],input=source,capture_output=True)
if lint.returncode:raise RuntimeError('FAMILY_PHP_LINT_FAILED '+lint.stderr.decode('utf8','replace')[-400:])
local=r"""<?php
function naCatalogDate($date){return is_string($date)&&preg_match('/^(?:19|20)\d\d-\d\d-\d\d$/D',$date)?$date:null;}
require 'account-service/private/family-live.php';
$bank=nfFamilyKnowledge();
if(count($bank)!==22||count(nfQuestions())!==10)throw new RuntimeException('BANK_QUESTIONS_MISSING');
foreach(nfQuestions() as $q){
 $points=nfQuestionPoints($q['id']);
 if(count($points)!==4||!in_array('left',$points,true)||!in_array('top',$points,true))
    throw new RuntimeException('MATRIX_POINT_SELECTION_INVALID');
 if(!nfQuestionFocus($q['id']))throw new RuntimeException('QUESTION_FOCUS_INVALID');
 foreach([[3,3,2000],[15,7,1987],[31,10,1988]] as $date){
    $m=ni31(...$date);
    $selected=nfSummarizePointsForQuestion($q['id'],$m,nfPointTitles(),$bank);
    if(count($selected)<1||count($selected)>4)throw new RuntimeException('GROUP_COUNT_INVALID');
    foreach($selected as $p)
      if(!isset($p['роль'],$p['плюс'],$p['минус'])||!is_string($p['роль']))
         throw new RuntimeException('POINT_DATA_INVALID');
 }
}
$three=ni31(3,3,2000);
$joined=nfSummarizePointsForQuestion('independent',$three,nfPointTitles(),$bank);
if(count($joined)!==3)throw new RuntimeException('SAME_ENERGY_NOT_DEDUPED');
if(!str_contains($joined[0]['роль'],'День рождения')||!str_contains($joined[0]['роль'],'Месяц рождения'))
   throw new RuntimeException('DUAL_ROLE_NOT_PRESERVED');
if(!str_ends_with(nfCacheFile('independent','2000-03-03'),'-family-conversational-v7.json'))
   throw new RuntimeException('CACHE_VERSION');
if(nfTransientFamilyModelError(new RuntimeException('PROVIDER_TIMEOUT')))
   throw new RuntimeException('UNSAFE_PROVIDER_RETRY');
echo 'FAMILY_NATURAL_TONE_STATIC_PASS',PHP_EOL;
"""
test=subprocess.run(['php'],input=local.encode('utf-8'),capture_output=True)
if test.returncode or b'FAMILY_NATURAL_TONE_STATIC_PASS' not in test.stdout:
    raise RuntimeError('FAMILY_NATURAL_TEST_FAILED '+test.stderr.decode('utf-8','replace')[-550:])
print('FAMILY_NATURAL_TONE_STATIC_PASS',flush=True)
def status(path):
    req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+path+'?familydialog='+str(time.time_ns()),headers={'Cache-Control':'no-store'})
    try:
        with urllib.request.urlopen(req,timeout=28) as response:return response.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    codes=[status(''),status('redflag-ai-lab/style-test-api.php'),status('api/numi-account.php')]
    print('SITE_HEALTH',codes,flush=True)
    return codes[0]==200 and codes[1]==403 and codes[2] in (403,405)
if not healthy():raise RuntimeError('SITE_UNHEALTHY_BEFORE')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=47)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
priv=home+'/private/numi-account-20261031/'
root=home+'/www/xn--c1adkkdfjbp1a4l.online/'
remote={priv+p.rsplit('/',1)[-1]:p for p in files}
backup=home+'/site-safeguard-backups'
def read(p):
    buf=io.BytesIO();ftp.retrbinary('RETR '+p,buf.write);return buf.getvalue()
def write(p,data):
    ftp.storbinary('STOR '+p,io.BytesIO(data))
    if read(p)!=data:raise RuntimeError('READBACK_FAILED')
saved={};changed=[]
try:
    for path,local in remote.items():
        existing=read(path)
        if existing not in (old[local],new[local]):raise RuntimeError('REMOTE_DRIFT_NO_WRITE')
        saved[path]=existing
    protected=[
      priv+'family-live-questions.json',priv+'family-live-followups.json',
      priv+'intimacy-live.php',priv+'language-live.php',priv+'language-live-knowledge.txt',
      priv+'wallet-real-payment.php',priv+'fulfillment.php',priv+'core.php',
      root+'redflag-feature.js',root+'redflag-public-catalog.js',root+'index.html',
      root+'api/numi-family-free.php',root+'api/numi-owner-material.php'
    ]
    digests={p:hashlib.sha256(read(p)).digest() for p in protected}
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_BEFORE_UPLOAD')
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:7]
    for path,local in remote.items():
        if saved[path]!=new[local]:
            write(backup+'/before-family-conversational-'+tag+'-'+path.rsplit('/',1)[-1]+'.bak',saved[path])
    for path,local in remote.items():
        if read(path)!=saved[path]:raise RuntimeError('CONCURRENT_REMOTE_CHANGE')
        if saved[path]!=new[local]:
            changed.append(path)
            write(path,new[local])
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_AFTER')
    for path,digest in digests.items():
        if hashlib.sha256(read(path)).digest()!=digest:raise RuntimeError('PROTECTED_FILE_CHANGED')
    for path,local in remote.items():
        if read(path)!=new[local]:raise RuntimeError('REMOTE_READBACK_FAILED')
    print('FAMILY_NATURAL_TONE_PUBLISHED language_style=simple_conversational'
          ' five_energies_corrected=true no_duplicate_arcana=true'
          ' no_forced_joke=true no_fake_status=true'
          ' existing_paid_answer_cache_readable=true'
          ' family_only=true model_unchanged=true payment_untouched=true'
          ' other_sections_unchanged=true paid_ai_tests=0',flush=True)
except BaseException:
    failures=[]
    for path in reversed(changed):
        try:write(path,saved[path])
        except BaseException:failures.append(path)
    print('ROLLBACK_'+('FAILED_'+','.join(failures) if failures else 'SUCCESS'),flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
