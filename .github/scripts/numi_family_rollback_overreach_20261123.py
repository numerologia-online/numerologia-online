#!/usr/bin/env python3
"""Only unwind unwanted family KB/style changes; no AI/paid tests or other-site writes."""
import os,io,ftplib,ssl,hashlib,pathlib,subprocess,urllib.request,urllib.error,time,uuid
head='1a1e52340e060c81d81bd6ec1b528f73917af5ec';prior='5bf0f6d2102efaa28104d5855636d70ae366eb34'
php='account-service/private/family-live.php'
kb='account-service/private/family-live-knowledge.txt'
paths=[php,kb]
old={p:subprocess.check_output(['git','show',head+':'+p]) for p in paths}
new={p:pathlib.Path(p).read_bytes() for p in paths}
original=old[kb].decode().strip().splitlines()
corrected=new[kb].decode().strip().splitlines()
expected=subprocess.check_output(['git','show',prior+':'+kb]).decode().strip().splitlines()
assert len(original)==len(corrected)==len(expected)==22
assert len(new[kb].decode())<5000
assert [i for i,(a,b) in enumerate(zip(original,corrected),1) if a!=b]==[3,7,8,15,21]
assert all(corrected[i-1]==expected[i-1] for i in [3,7,8,21])
assert 'придворных' in corrected[2] and 'золотой торт' in corrected[7]
assert 'самостоятельн' not in corrected[14]
assert 'манипуляц' in corrected[14]
assert all(line.count('|')==2 and line.split('|',1)[0]==str(i) for i,line in enumerate(corrected,1))
source=new[php]
for needed in ['-family-precise-v8.json','-family-conversational-v7.json',
  '-family-punch-v6.json','-family-ideal-synthesis-v5.json',
  '-family-focused-v4.json','-family-focused-v3.json',
  '-family-kb-v2.json','-nokb-v1.json',
  'nfSummarizePointsForQuestion(', 'nfFamilyAnswerCall(',
  'nfFitFamilyAnswerLength(', 'google/gemini-3-flash-preview',
  'FAMILY_TRANSIENT_UPSTREAM_RETRY','family-live-knowledge.txt']:
    assert needed.encode() in source,needed
assert b'50/50' not in source
assert source.count(b"'max_tokens'=>$tokens")==1
assert b"'полная_рассчитанная_матрица_для_контекста'" not in source
assert b"'-family-precise-v8.json'" in source
assert b"'independent'=>['left','top','center','bottom']" in source
assert b"'household'=>['left','top','center','rightNear']" in source
assert 'Добавь ОДНУ короткую' in source.decode()
for p in [php]:
    result=subprocess.run(['php','-l'],input=new[p],capture_output=True)
    if result.returncode:raise RuntimeError('PHP_LINT_FAILED '+result.stderr.decode(errors='replace')[-250:])
static=r"""<?php
function naCatalogDate($d){return is_string($d)&&preg_match('/^(?:19|20)\d\d-\d\d-\d\d$/D',$d)?$d:null;}
require 'account-service/private/family-live.php';
$bank=nfFamilyKnowledge();
if(count($bank)!==22||count(nfQuestions())!==10)throw new RuntimeException('BANK_OR_QUESTIONS');
foreach(nfQuestions() as $q){
    $pts=nfQuestionPoints($q['id']);
    if(count($pts)!==4||!in_array('left',$pts,true)||!in_array('top',$pts,true))
        throw new RuntimeException('POINTS');
    $matrix=ni31(15,7,1987);
    $summary=nfSummarizePointsForQuestion($q['id'],$matrix,nfPointTitles(),$bank);
    if(count($summary)<1||count($summary)>4)throw new RuntimeException('SUMMARY');
}
$points=nfQuestionPoints('independent');
if($points!==['left','top','center','bottom'])throw new RuntimeException('POINTS_15_7');
$m=ni31(15,7,1987);
if([$m['left'],$m['top'],$m['center'],$m['bottom']]!==[15,7,4,11])
    throw new RuntimeException('NUMERIC_CALC_DRIFT');
if(str_contains($bank['15']['plus'],'самостоятельн'))throw new RuntimeException('FIFTEEN_BAD');
if(!str_ends_with(nfCacheFile('independent','1987-07-15'),'-family-precise-v8.json'))
    throw new RuntimeException('CACHE_BAD');
if(!str_contains(nfQuestionFocus('independent'),'Не делай вывода'))
    throw new RuntimeException('INDEPENDENCE_FOCUS');
$pointsSame=nfSummarizePointsForQuestion('independent',ni31(3,3,2000),nfPointTitles(),$bank);
if(count($pointsSame)!==3)throw new RuntimeException('SAME_ARCANA_DOUBLE');
if(nfTransientFamilyModelError(new RuntimeException('PROVIDER_TIMEOUT')))
    throw new RuntimeException('WRONG_MODEL_RETRY');
echo 'FAMILY_ROLLBACK_TARGETED_STATIC_PASS',PHP_EOL;
"""
test=subprocess.run(['php'],input=static.encode(),capture_output=True)
if test.returncode or b'FAMILY_ROLLBACK_TARGETED_STATIC_PASS' not in test.stdout:
    raise RuntimeError('PHP_STATIC_FAILED '+test.stderr.decode(errors='replace')[-550:])
print('FAMILY_ROLLBACK_TARGETED_STATIC_PASS',flush=True)
def code(path):
    req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+path+'?targetfix='+str(time.time_ns()),headers={'Cache-Control':'no-store'})
    try:
        with urllib.request.urlopen(req,timeout=26) as response:return response.status
    except urllib.error.HTTPError as e:return e.code
def health():
    result=[code(''),code('redflag-ai-lab/style-test-api.php'),code('api/numi-account.php')]
    print('SITE_HEALTH',result,flush=True)
    return result[0]==200 and result[1]==403 and result[2] in (403,405)
if not health():raise RuntimeError('SITE_UNHEALTHY_BEFORE')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=48)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
prefix=home+'/private/numi-account-20261031/'
root=home+'/www/xn--c1adkkdfjbp1a4l.online/'
remotes={prefix+'family-live.php':php,prefix+'family-live-knowledge.txt':kb}
backup=home+'/site-safeguard-backups'
def read(p):
    b=io.BytesIO();ftp.retrbinary('RETR '+p,b.write);return b.getvalue()
def write(p,v):
    ftp.storbinary('STOR '+p,io.BytesIO(v))
    if read(p)!=v:raise RuntimeError('FTP_READBACK_ERROR')
saved={};modified=[]
try:
    for rp,p in remotes.items():
        content=read(rp)
        if content not in (old[p],new[p]):raise RuntimeError('REMOTE_DRIFT_ABORT_NO_WRITES')
        saved[rp]=content
    protected=[prefix+'family-live-questions.json',prefix+'family-live-followups.json',
        prefix+'intimacy-live.php',prefix+'language-live.php',prefix+'language-live-knowledge.txt',
        prefix+'wallet-real-payment.php',prefix+'fulfillment.php',prefix+'core.php',
        root+'redflag-feature.js',root+'redflag-public-catalog.js',root+'index.html',
        root+'api/numi-family-free.php',root+'api/numi-owner-material.php']
    digests={p:hashlib.sha256(read(p)).digest() for p in protected}
    if not health():raise RuntimeError('SITE_UNHEALTHY_PREFLIGHT')
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:7]
    for rp,p in remotes.items():
        if saved[rp]!=new[p]:
            write(backup+'/before-family-targeted-fix-'+tag+'-'+rp.rsplit('/',1)[-1]+'.bak',saved[rp])
    for rp,p in remotes.items():
        if read(rp)!=saved[rp]:raise RuntimeError('CONCURRENT_REMOTE_CHANGE')
        if saved[rp]!=new[p]:
            modified.append(rp);write(rp,new[p])
    if not health():raise RuntimeError('SITE_UNHEALTHY_AFTER')
    for p,h in digests.items():
        if hashlib.sha256(read(p)).digest()!=h:raise RuntimeError('PROTECTED_CHANGED')
    for rp,p in remotes.items():
        if read(rp)!=new[p]:raise RuntimeError('FINAL_READBACK_ERROR')
    print('FAMILY_TARGETED_FIX_PUBLISHED restored_v6_humor=true'
          ' restored_luxury_imagery=true clarified_arcana15=true'
          ' restored_four_point_selection=true same_energy_dedup_kept=true'
          ' v1_to_v7_purchased_readable=true model_unchanged=true'
          ' payments_untouched=true other_sections_unchanged=true paid_ai_calls=0',flush=True)
except BaseException:
    errors=[]
    for rp in reversed(modified):
        try:write(rp,saved[rp])
        except BaseException:errors.append(rp)
    print('ROLLBACK_'+('FAILED_'+','.join(errors) if errors else 'SUCCESS'),flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
