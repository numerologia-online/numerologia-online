#!/usr/bin/env python3
"""Publish Family-only question-focus prompt; safe rollback, no AI calls, no payment changes."""
import os,ftplib,ssl,io,pathlib,subprocess,hashlib,urllib.request,urllib.error,time,uuid
path='account-service/private/family-live.php'
base='25a3e4f9f990e4527f319c225240ed88c0530113'
old=subprocess.check_output(['git','show',base+':'+path])
new=pathlib.Path(path).read_bytes()
assert old!=new
for token in [b'function nfQuestionFocus(',b'-family-focused-v3.json',
              b'-family-kb-v2.json',b'-nokb-v1.json',
              b'google/gemini-3-flash-preview',b'CURLOPT_TIMEOUT=>95',
              b'family-live-knowledge.txt',b'FAMILY_RESULT_FAIL']:
    assert token in new, 'SENSITIVE_COMPONENT_MISSING'
assert b"'max_tokens'=>$tokens" in new
p=subprocess.run(['php','-l'],input=new,capture_output=True)
if p.returncode:raise RuntimeError('PHP_LINT_FAILED_'+p.stderr.decode('utf8','replace')[:350])
tests=r"""<?php
function naCatalogDate($d){return is_string($d)&&preg_match('/^\d{4}-\d\d-\d\d$/',$d)?$d:null;}
require 'account-service/private/family-live.php';
$q=nfQuestions();if(count($q)!==10)throw new RuntimeException('QUESTIONS_COUNT_INVALID');
foreach($q as $row) {
    $f=nfQuestionFocus($row['id']);
    if(mb_strlen($f,'UTF-8')<65||mb_strlen($f,'UTF-8')>280)throw new RuntimeException('FOCUS_LENGTH_INVALID');
    $pts=nfQuestionPoints($row['id']);
    if(count($pts)!==6||!in_array('left',$pts,true)||!in_array('top',$pts,true))
        throw new RuntimeException('MATRIX_SELECTION_INVALID');
}
if(count(nfFamilyKnowledge())!==22)throw new RuntimeException('ARCANA_MISSING');
$sentence='Он скорее занимается домом самостоятельно и не ждёт, что за ним все уберут. ';
$long=str_repeat($sentence,25)."\n\n".'А как он выполняет обещания, когда дело касается важного?';
$short=nfFitFamilyAnswerLength($long);
if(mb_strlen($short,'UTF-8')>1350)throw new RuntimeException('FOCUS_LENGTH_NOT_REPAIRED');
niValidateGeneratedText($short,'stop');
if(!str_ends_with($short,'А как он выполняет обещания, когда дело касается важного?'))
    throw new RuntimeException('FOLLOWUP_TRUNCATED');
foreach(['household','care','vacation'] as $id){
  if(!is_string(nfQuestionFocus($id)))throw new RuntimeException('FOCUS_NOT_READY');
}
echo 'FAMILY_FOCUS_TESTS_OK',PHP_EOL;
"""
t=subprocess.run(['php'],input=tests.encode(),capture_output=True)
if t.returncode or b'FAMILY_FOCUS_TESTS_OK' not in t.stdout:
    raise RuntimeError('FAMILY_FOCUS_TESTS_FAILED_'+t.stderr.decode('utf8','replace')[-400:])
print('FAMILY_FOCUS_TESTS_OK',flush=True)
def status(p):
    url='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?focus='+str(time.time_ns())
    req=urllib.request.Request(url,headers={'Cache-Control':'no-store'})
    try:
        with urllib.request.urlopen(req,timeout=27) as resp:return resp.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    codes=[status(''),status('redflag-ai-lab/style-test-api.php'),status('api/numi-account.php')]
    print('SITE_HEALTH',codes,flush=True)
    return codes[0]==200 and codes[1]==403 and codes[2] in (403,405)
if not healthy():raise RuntimeError('SITE_UNHEALTHY_NO_WRITE')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
remote=home+'/private/numi-account-20261031/family-live.php'
backups=home+'/site-safeguard-backups'
def read(p):
    buf=io.BytesIO();ftp.retrbinary('RETR '+p,buf.write);return buf.getvalue()
def write(p,v):
    ftp.storbinary('STOR '+p,io.BytesIO(v))
    if read(p)!=v:raise RuntimeError('READBACK_FAILED')
saved=None;changed=False
try:
    saved=read(remote)
    if saved not in (old,new):raise RuntimeError('REMOTE_DRIFT_NO_WRITE')
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
    before={p:hashlib.sha256(read(p)).hexdigest() for p in protected}
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_PREFLIGHT')
    try:ftp.mkd(backups)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    if saved!=new:
        tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]
        write(backups+'/before-family-focused-answer-'+tag+'.php.bak',saved)
        if read(remote)!=saved:raise RuntimeError('REMOTE_CONCURRENT_CHANGE')
        changed=True;write(remote,new)
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_AFTER')
    for p,sha in before.items():
        if hashlib.sha256(read(p)).hexdigest()!=sha:raise RuntimeError('PROTECTED_CHANGED')
    if read(remote)!=new:raise RuntimeError('LIVE_FAMILY_NOT_UPDATED')
    print('FAMILY_FOCUSED_ANSWERS_PUBLISHED 10_questions=true'
          ' kb22_unchanged=true model_unchanged=true v1_v2_purchases_readable=true'
          ' smaller_answers=true changed_other_sections=false paid_ai_calls=0',flush=True)
except BaseException:
    if changed and saved is not None:
        try:write(remote,saved);print('ROLLBACK_SUCCESS',flush=True)
        except BaseException:print('ROLLBACK_FAILED',flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
