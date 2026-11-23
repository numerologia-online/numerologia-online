#!/usr/bin/env python3
"""Backed up upload only Family engine length safety and private error-code diagnostics, no Gemini calls."""
import os,ftplib,ssl,io,pathlib,subprocess,hashlib,time,uuid,urllib.request,urllib.error
file='account-service/private/family-live.php'
before=subprocess.check_output(['git','show','ee64b52494aa14b7916cb7728d0e828b4fbefef7:'+file])
after=pathlib.Path(file).read_bytes()
assert after!=before and b'FAMILY_RESULT_FAIL' in after
assert b'function nfFitFamilyAnswerLength' in after
assert b'-family-kb-v2.json' in after and b'family-live-knowledge.txt' in after
assert b'google/gemini-3-flash-preview' in after and b'CURLOPT_TIMEOUT=>95' in after
assert b"'max_tokens'=>$tokens" in after
assert b'FAMILY_TEXT_TOO_LONG' in after and b'niValidateGeneratedText' in after
php=subprocess.run(['php','-l'],input=after,capture_output=True)
if php.returncode:raise RuntimeError('PHP_SYNTAX_ERROR_'+php.stderr.decode('utf-8','replace')[:150])
tests=r"""<?php
function naCatalogDate($d){return is_string($d)&&preg_match('/^\d{4}-\d\d-\d\d$/',$d)?$d:null;}
require 'account-service/private/family-live.php';
$first=str_repeat('Он самостоятельный, но не любит чужих указаний. ',65);
$second='Своё мнение у него сильное. А будет партнёром или начальником в семье?';
$input=$first."\n\n".$second;
$out=nfFitFamilyAnswerLength($input);
if(mb_strlen($out,'UTF-8')>1650)throw new RuntimeException('LENGTH_NOT_REPAIRED');
if(!str_ends_with($out,$second))throw new RuntimeException('FOLLOWUP_DAMAGED');
if(!str_starts_with($out,'Он самостоятельный'))throw new RuntimeException('START_DAMAGED');
if(mb_strlen($out,'UTF-8')<450)throw new RuntimeException('TOO_SHORT');
niValidateGeneratedText($out,'stop');
$normal='Он самостоятельно всё решает. Он ещё умеет готовить и заботиться. '.str_repeat('Семья для него важна. ',35)."\n\n".'Интересно, а как он ведёт себя в отпуске?';
if(nfFitFamilyAnswerLength($normal)!==$normal)throw new RuntimeException('NORMAL_ANSWER_CHANGED');
foreach(nfQuestions() as $question){
  $p=nfQuestionPoints($question['id']);
  if(count($p)!==6||!in_array('left',$p,true)||!in_array('top',$p,true))throw new RuntimeException('MATRIX_POINT_INVALID');
}
if(count(nfFamilyKnowledge())!==22)throw new RuntimeException('KNOWLEDGE_INVALID');
echo 'FAMILY_LENGTH_GUARD_TESTS_PASS',PHP_EOL;
"""
p=subprocess.run(['php'],input=tests.encode(),capture_output=True)
if p.returncode or b'FAMILY_LENGTH_GUARD_TESTS_PASS' not in p.stdout:
    raise RuntimeError('LOCAL_FAMILY_TEST_FAILED_'+p.stderr.decode('utf-8','replace')[-350:])
print('FAMILY_LENGTH_GUARD_TESTS_PASS',flush=True)
def http(path):
    url='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+path+'?family_rel='+str(time.time_ns())
    req=urllib.request.Request(url,headers={'Cache-Control':'no-store'})
    try:
        with urllib.request.urlopen(req,timeout=27) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    a=[http(''),http('redflag-ai-lab/style-test-api.php'),http('api/numi-account.php')]
    print('SITE_HEALTH',a,flush=True)
    return a[0]==200 and a[1]==403 and a[2] in (403,405)
if not healthy():raise RuntimeError('SITE_UNHEALTHY_BEFORE_NO_WRITES')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=43)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
dest=home+'/private/numi-account-20261031/family-live.php'
backups=home+'/site-safeguard-backups'
def read(path):
    b=io.BytesIO();ftp.retrbinary('RETR '+path,b.write);return b.getvalue()
def write(path,data):
    ftp.storbinary('STOR '+path,io.BytesIO(data))
    if read(path)!=data:raise RuntimeError('FTP_READBACK_MISMATCH')
saved=None;uploaded=False
try:
    saved=read(dest)
    if saved not in (before,after):raise RuntimeError('REMOTE_FAMILY_DRIFT_NO_WRITES')
    protected=[
        home+'/private/numi-account-20261031/family-live-knowledge.txt',
        home+'/private/numi-account-20261031/intimacy-live.php',
        home+'/private/numi-account-20261031/fulfillment.php',
        home+'/private/numi-account-20261031/wallet-real-payment.php',
        home+'/www/xn--c1adkkdfjbp1a4l.online/api/numi-family-free.php',
        home+'/www/xn--c1adkkdfjbp1a4l.online/api/numi-owner-material.php',
        home+'/www/xn--c1adkkdfjbp1a4l.online/redflag-feature.js',
        home+'/www/xn--c1adkkdfjbp1a4l.online/index.html'
    ]
    checks={path:hashlib.sha256(read(path)).hexdigest() for path in protected}
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_PREFLIGHT')
    try:ftp.mkd(backups)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    if saved!=after:
        tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]
        write(backups+'/before-family-reliability-'+tag+'.php.bak',saved)
        if read(dest)!=saved:raise RuntimeError('REMOTE_CHANGED_BEFORE_WRITING')
        uploaded=True
        write(dest,after)
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_AFTER')
    for path,digest in checks.items():
        if hashlib.sha256(read(path)).hexdigest()!=digest:raise RuntimeError('PROTECTED_CHANGED')
    if read(dest)!=after:raise RuntimeError('FAMILY_READBACK_FAILED')
    print('FAMILY_RELIABILITY_PUBLISHED length_guard=true private_error_reason=true previous_sections_unchanged=true paid_ai_calls=0',flush=True)
except BaseException:
    if uploaded and saved is not None:
        try:write(dest,saved);print('ROLLBACK_SUCCESS',flush=True)
        except BaseException:print('ROLLBACK_FAILED',flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
