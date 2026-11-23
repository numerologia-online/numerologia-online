#!/usr/bin/env python3
"""Guarded single-file Family-only prompt rewrite, no provider generations."""
import os,io,ftplib,ssl,subprocess,pathlib,hashlib,urllib.request,urllib.error,time,uuid
path='account-service/private/family-live.php'
before=subprocess.check_output(['git','show','beea2feea8fc4c576c20c162115331f7a333b2cd:'+path])
after=pathlib.Path(path).read_bytes()
assert before!=after
assert b'family-live-knowledge.txt' in after and b'nfFamilyKnowledge()' in after
for needle in [b'-family-ideal-synthesis-v5.json',b'-family-focused-v4.json',b'-family-focused-v3.json',
               b'-family-kb-v2.json',b'-nokb-v1.json',b'nfCloudRaw(',b'ni31(',
               b'google/gemini-3-flash-preview',b'FAMILY_RESULT_FAIL',
               b'CURLOPT_TIMEOUT=>95',b'nfQuestionFocus(']:
    assert needle in after, 'MISSING_FAMILY_PROTECTION'
assert b"'max_tokens'=>$tokens" in after
# No new model, no numeric payload, no day/month weighting directive, no other source files.
assert b"'full_matrix'" not in after
assert "'число_аркана'=>$matrix[$key]" not in after.decode()
assert "'полная_рассчитанная_матрица_для_контекста'=>$matrix" not in after.decode()
assert '50/50' not in after.decode()
assert 'равной доле' not in after.decode()
lint=subprocess.run(['php','-l'],input=after,capture_output=True)
if lint.returncode:raise RuntimeError('PHP_SYNTAX_INVALID_'+lint.stderr.decode(errors='replace')[:250])
checks=r"""<?php
function naCatalogDate($date){return is_string($date)&&preg_match('/^(?:19|20)\d\d-\d\d-\d\d$/D',$date)?$date:null;}
require 'account-service/private/family-live.php';
if(count(nfFamilyKnowledge())!==22)throw new RuntimeException('KB_INCOMPLETE');
if(count(nfQuestions())!==10)throw new RuntimeException('QUESTIONS_INCOMPLETE');
foreach(nfQuestions() as $q){
  $pts=nfQuestionPoints($q['id']);
  if(count($pts)!==4||count(array_unique($pts))!==4
     ||!in_array('left',$pts,true)||!in_array('top',$pts,true))
    throw new RuntimeException('MATRIX_SELECTED_INVALID');
  if(!nfQuestionFocus($q['id']))throw new RuntimeException('QUESTION_FOCUS_MISSING');
  $m=ni31(31,10,1988);
  foreach($pts as $pt)if(!isset($m[$pt],nfFamilyKnowledge()[(string)$m[$pt]]))
    throw new RuntimeException('ARCANA_MISSING');
}
if(!str_ends_with(nfCacheFile('household','1988-10-31'),'-family-ideal-synthesis-v5.json'))
   throw new RuntimeException('WRONG_CACHE_VERSION');
$input=str_repeat('Он отвечает за свои дела и доводит начатое до конца. ',28).
 "\n\n".'Но сможет ли он поддержать тебя в конфликте? Будет партнёром или начальником в семье?';
$out=nfFitFamilyAnswerLength(nfRestoreTwoParagraphs($input));
if(mb_strlen($out,'UTF-8')>1350)throw new RuntimeException('TEXT_NOT_BOUNDED');
niValidateGeneratedText($out,'stop');
if(!str_ends_with($out,'Будет партнёром или начальником в семье?'))
   throw new RuntimeException('FOLLOWUP_LOST');
echo 'FAMILY_IDEAL_SYNTHESIS_STATIC_PASS',PHP_EOL;
"""
tested=subprocess.run(['php'],input=checks.encode(),capture_output=True)
if tested.returncode or b'FAMILY_IDEAL_SYNTHESIS_STATIC_PASS' not in tested.stdout:
    raise RuntimeError('STATIC_TESTS_FAILED_'+tested.stderr.decode(errors='replace')[-500:])
print('FAMILY_IDEAL_SYNTHESIS_STATIC_PASS',flush=True)
def get(p):
    req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?familysynth='+str(time.time_ns()),headers={'Cache-Control':'no-store'})
    try:
        with urllib.request.urlopen(req,timeout=29) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def health():
    statuses=[get(''),get('redflag-ai-lab/style-test-api.php'),get('api/numi-account.php')]
    print('SITE_HEALTH',statuses,flush=True)
    return statuses[0]==200 and statuses[1]==403 and statuses[2] in (403,405)
if not health():raise RuntimeError('PREEXISTING_SITE_UNHEALTHY')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=48)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
live=home+'/private/numi-account-20261031/family-live.php'
backups=home+'/site-safeguard-backups'
def read(remote):
    buf=io.BytesIO();ftp.retrbinary('RETR '+remote,buf.write)
    return buf.getvalue()
def write(remote,value):
    ftp.storbinary('STOR '+remote,io.BytesIO(value))
    if read(remote)!=value:raise RuntimeError('FTP_READBACK_MISMATCH')
saved=None;changed=False
try:
    saved=read(live)
    if saved not in (before,after):raise RuntimeError('REMOTE_DRIFT_NO_WRITES')
    private=home+'/private/numi-account-20261031/'
    root=home+'/www/xn--c1adkkdfjbp1a4l.online/'
    protected=[private+'family-live-knowledge.txt',private+'family-live-questions.json',
        private+'intimacy-live.php',private+'language-live.php',private+'language-live-knowledge.txt',
        private+'wallet-real-payment.php',private+'fulfillment.php',private+'core.php',
        root+'redflag-feature.js',root+'redflag-public-catalog.js',root+'index.html',
        root+'api/numi-family-free.php',root+'api/numi-owner-material.php']
    original_hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
    if not health():raise RuntimeError('SITE_PREUPLOAD_UNHEALTHY')
    try:ftp.mkd(backups)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    if saved!=after:
        name=backups+'/before-family-ideal-synthesis-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:7]+'.php.bak'
        write(name,saved)
        if read(live)!=saved:raise RuntimeError('CONCURRENT_LIVE_CHANGE')
        changed=True;write(live,after)
    if not health():raise RuntimeError('SITE_AFTER_UPLOAD_UNHEALTHY')
    for p,h in original_hashes.items():
        if hashlib.sha256(read(p)).digest()!=h:raise RuntimeError('PROTECTED_SECTION_CHANGED')
    if read(live)!=after:raise RuntimeError('FAMILY_REMOTE_CONTENT_MISMATCH')
    print('FAMILY_IDEAL_SYNTHESIS_PUBLISHED family_only=true original_bank22_unchanged=true'
          ' no_forced_50_50=true no_raw_arcana_numbers=true'
          ' selected_context_four=true paid_old_answers_readable=true'
          ' model_unchanged=true other_sections_unchanged=true paid_ai_calls=0',flush=True)
except BaseException:
    if changed and saved is not None:
        try:write(live,saved);print('ROLLBACK_SUCCESS',flush=True)
        except BaseException:print('ROLLBACK_FAILED',flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
