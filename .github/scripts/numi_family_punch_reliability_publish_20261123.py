#!/usr/bin/env python3
"""Family-only punchier voice + bounded SAME Gemini retry. Zero provider test calls."""
import os,io,ftplib,ssl,subprocess,pathlib,hashlib,urllib.request,urllib.error,time,uuid
path='account-service/private/family-live.php'
base='af49e4c19d42feba26239804d2c9ad918a23a45a'
before=subprocess.check_output(['git','show',base+':'+path])
after=pathlib.Path(path).read_bytes()
assert before!=after
for needle in [b'family-live-knowledge.txt',b'nfFamilyKnowledge()',b'-family-punch-v6.json',
               b'-family-ideal-synthesis-v5.json',b'-family-focused-v4.json',
               b'-family-focused-v3.json',b'-family-kb-v2.json',b'-nokb-v1.json',
               b'function nfTransientFamilyModelError(',b'function nfFamilyAnswerCall(',
               b'FAMILY_TRANSIENT_UPSTREAM_RETRY',b'nfFamilyAnswerCall(',
               b'nfCloudRaw(',b'CURLOPT_TIMEOUT=>95',
               b"google/gemini-3-flash-preview",b'FAMILY_RESULT_FAIL']:
    assert needle in after,'MISSING_PROTECTED_LOGIC'
assert after.count(b"'max_tokens'=>$tokens")==1
assert after.count(b'function nfFamilyAnswerCall(')==1
assert after.count(b'return nfCloudRaw($messages,$tokens);')==2
assert after.count(b'$text=nfFamilyAnswerCall(')==1
assert b"'полная_рассчитанная_матрица_для_контекста'" not in after
assert b'50/50' not in after
lint=subprocess.run(['php','-l'],input=after,capture_output=True)
if lint.returncode:raise RuntimeError('PHP_LINT_FAILED_'+lint.stderr.decode(errors='replace')[-300:])
test=r"""<?php
function naCatalogDate($value){return is_string($value)&&preg_match('/^(?:19|20)\d\d-\d\d-\d\d$/D',$value)?$value:null;}
require 'account-service/private/family-live.php';
if(count(nfFamilyKnowledge())!==22||count(nfQuestions())!==10)throw new RuntimeException('CONTENT_UNAVAILABLE');
$allowed=['PROVIDER_MODEL_UNAVAILABLE','PROVIDER_HTTP_429','PROVIDER_HTTP_502','PROVIDER_HTTP_503','PROVIDER_HTTP_504'];
foreach($allowed as $err)if(!nfTransientFamilyModelError(new RuntimeException($err)))throw new RuntimeException('RETRY_FAIL');
$denied=['PROVIDER_TIMEOUT','PROVIDER_NETWORK_ERROR','EMPTY_ANSWER','PROVIDER_OUTPUT_LIMIT',
    'PROVIDER_REFUSAL','INTIMACY_TEXT_PARAGRAPHS_INVALID','FAMILY_TEXT_TOO_LONG'];
foreach($denied as $err)if(nfTransientFamilyModelError(new RuntimeException($err)))throw new RuntimeException('UNSAFE_RETRY');
foreach(nfQuestions() as $item){
 $points=nfQuestionPoints($item['id']);
 if(count($points)!==4||!in_array('left',$points,true)||!in_array('top',$points,true))throw new RuntimeException('MATRIX_CHANGED');
 if(!nfQuestionFocus($item['id']))throw new RuntimeException('FOCUS_MISSING');
}
if(!str_ends_with(nfCacheFile('household','1988-10-31'),'-family-punch-v6.json'))
  throw new RuntimeException('CACHE_VERSION_WRONG');
$sample=str_repeat('Мужчина сам разберётся со своими вещами и спокойно организует быт. ',23)
 ."\n\n".'Но сможет ли он поддержать тебя в других делах? Обещает и делает или просто король планов?';
$out=nfFitFamilyAnswerLength(nfRestoreTwoParagraphs($sample));
niValidateGeneratedText($out,'stop');
if(mb_strlen($out,'UTF-8')>1350)throw new RuntimeException('LONG_GUARD');
echo 'FAMILY_PUNCH_RELIABILITY_STATIC_PASS',PHP_EOL;
"""
res=subprocess.run(['php'],input=test.encode(),capture_output=True)
if res.returncode or b'FAMILY_PUNCH_RELIABILITY_STATIC_PASS' not in res.stdout:
    raise RuntimeError('STATIC_TEST_FAILED_'+res.stderr.decode(errors='replace')[-500:])
print('FAMILY_PUNCH_RELIABILITY_STATIC_PASS',flush=True)
def status(path):
    req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+path+'?check='+str(time.time_ns()),headers={'Cache-Control':'no-store'})
    try:
        with urllib.request.urlopen(req,timeout=27) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    statuses=[status(''),status('redflag-ai-lab/style-test-api.php'),status('api/numi-account.php')]
    print('SITE_HEALTH',statuses,flush=True)
    return statuses[0]==200 and statuses[1]==403 and statuses[2] in (403,405)
if not healthy():raise RuntimeError('SITE_UNHEALTHY_BEFORE_NO_WRITE')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=47)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
live=home+'/private/numi-account-20261031/family-live.php'
backup=home+'/site-safeguard-backups'
def read(p):
    out=io.BytesIO();ftp.retrbinary('RETR '+p,out.write);return out.getvalue()
def write(p,content):
    ftp.storbinary('STOR '+p,io.BytesIO(content))
    if read(p)!=content:raise RuntimeError('READBACK_ERROR')
saved=None;changed=False
try:
    saved=read(live)
    if saved not in (before,after):raise RuntimeError('FAMILY_REMOTE_DRIFT_NO_WRITE')
    priv=home+'/private/numi-account-20261031/'
    root=home+'/www/xn--c1adkkdfjbp1a4l.online/'
    protected=[priv+'family-live-knowledge.txt',priv+'family-live-questions.json',
        priv+'intimacy-live.php',priv+'language-live.php',priv+'language-live-knowledge.txt',
        priv+'wallet-real-payment.php',priv+'fulfillment.php',priv+'core.php',
        root+'redflag-feature.js',root+'redflag-public-catalog.js',root+'index.html',
        root+'api/numi-family-free.php',root+'api/numi-owner-material.php']
    protected_hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_PREFLIGHT')
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    if saved!=after:
        dest=backup+'/before-family-punch-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:7]+'.php.bak'
        write(dest,saved)
        if read(live)!=saved:raise RuntimeError('FAMILY_CHANGED_BEFORE_WRITE')
        changed=True;write(live,after)
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_AFTER')
    for p,digest in protected_hashes.items():
        if hashlib.sha256(read(p)).digest()!=digest:raise RuntimeError('PROTECTED_SECTION_CHANGED')
    if read(live)!=after:raise RuntimeError('FINAL_REMOTE_DRIFT')
    print('FAMILY_PUNCH_RELIABILITY_PUBLISHED family_only=true'
          ' one_quick_same_model_retry=true no_fallback_model=true'
          ' no_repeat_on_timeout=true family_kb22_unchanged=true'
          ' old_paid_caches_readable=true no_payment_changes=true'
          ' other_sections_unchanged=true paid_test_calls=0',flush=True)
except BaseException:
    if changed and saved is not None:
        try:write(live,saved);print('ROLLBACK_SUCCESS',flush=True)
        except BaseException:print('ROLLBACK_FAILED',flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
