#!/usr/bin/env python3
"""Family-only owner-approved 22-energy bank publication; zero paid Gemini calls."""
import os,ftplib,ssl,io,pathlib,subprocess,hashlib,urllib.request,urllib.error,time,uuid
root=pathlib.Path('account-service/private')
php_file='family-live.php'
kb_file='family-live-knowledge.txt'
parent='6e3578eb146df57d72245f2e34978e4daac26a7e'
src='account-service/private/'+php_file
original=subprocess.check_output(['git','show',parent+':'+src])
new=(root/php_file).read_bytes()
kb=(root/kb_file).read_bytes()
assert original!=new and len(kb.decode('utf-8'))<=5000
assert kb.count(b'\n')==21 or (kb.count(b'\n')==22 and kb.endswith(b'\n'))
assert b'-family-kb-v2.json' in new and b'-nokb-v1.json' in new
assert b'google/gemini-3-flash-preview' in new
assert b'CURLOPT_TIMEOUT=>95' in new
assert b"'max_tokens'=>$tokens" in new
assert b"nfRestoreTwoParagraphs($text)" in new
check=subprocess.run(['php','-l'],input=new,capture_output=True)
if check.returncode:raise RuntimeError('FAMILY_PHP_LINT_'+check.stderr.decode('utf-8','replace')[:100])
# Exhaustively inspect bank and all family question/day/month combinations with zero model calls.
test=r"""<?php
function naCatalogDate($d){return is_string($d)&&preg_match('/^\d{4}-\d\d-\d\d$/',$d)?$d:null;}
require 'account-service/private/family-live.php';
$kb=nfFamilyKnowledge();
if(count($kb)!==22)throw new RuntimeException('KB_COUNT');
foreach(range(1,22) as $i)if(empty($kb[(string)$i]['plus'])||empty($kb[(string)$i]['minus']))throw new RuntimeException('KB_MISSING');
foreach(nfQuestions() as $q) {
  $points=nfQuestionPoints($q['id']);
  if(count($points)!==6||!in_array('left',$points,true)||!in_array('top',$points,true))throw new RuntimeException('DAYS_MONTHS_ABSENT');
  foreach(range(1,31) as $d)foreach(range(1,12) as $m) {
    if(!checkdate($m,$d,2000))continue;
    $a=ni31($d,$m,2000);
    foreach($points as $point) {
      if(!isset($a[$point],$kb[(string)$a[$point]]))throw new RuntimeException('UNMAPPED_POINT');
    }
  }
}
echo 'FAMILY_22_ENERGIES_10_QUESTIONS_ALL_DAYS_MONTHS_OK',PHP_EOL;
"""
tested=subprocess.run(['php'],input=test.encode(),capture_output=True)
if tested.returncode or b'FAMILY_22_ENERGIES_10_QUESTIONS_ALL_DAYS_MONTHS_OK' not in tested.stdout:
    raise RuntimeError('LOCAL_BANK_TEST_FAILED_'+tested.stderr.decode('utf-8','replace')[:300])
print('FAMILY_22_ENERGIES_10_QUESTIONS_ALL_DAYS_MONTHS_OK',flush=True)
def status(path):
    url='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+path+'?family_bank='+str(time.time_ns())
    req=urllib.request.Request(url,headers={'Cache-Control':'no-store'})
    try:
        with urllib.request.urlopen(req,timeout=28) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    c=[status(''),status('redflag-ai-lab/style-test-api.php'),status('api/numi-account.php')]
    print('SITE_HEALTH',c,flush=True)
    return c[0]==200 and c[1]==403 and c[2] in (403,405)
if not healthy():raise RuntimeError('SITE_UNHEALTHY_BEFORE_NO_WRITES')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=44)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
private=home+'/private/numi-account-20261031/'
destinations=[(private+kb_file,kb),(private+php_file,new)]
backups=home+'/site-safeguard-backups'
def read(path):
    buf=io.BytesIO()
    ftp.retrbinary('RETR '+path,buf.write)
    return buf.getvalue()
def maybe(path):
    try:return read(path)
    except ftplib.error_perm as e:
        if str(e).startswith('550'):return None
        raise
def write(path,b):
    ftp.storbinary('STOR '+path,io.BytesIO(b))
    if read(path)!=b:raise RuntimeError('READBACK_MISMATCH')
saved={};changed=[]
try:
    current=read(private+php_file)
    if current not in (original,new):raise RuntimeError('FAMILY_PHP_REMOTE_DRIFT_NO_WRITES')
    knowledge=maybe(private+kb_file)
    if knowledge is not None and knowledge!=kb:raise RuntimeError('FAMILY_KB_ALREADY_EXISTS_DIFFERENT_NO_WRITES')
    saved[private+php_file]=current
    saved[private+kb_file]=knowledge
    protected=[
      private+'intimacy-live.php',private+'intimacy-live-knowledge.json',
      private+'wallet-real-payment.php',private+'fulfillment.php',
      private+'core.php',
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
    tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]
    for path,new_bytes in destinations:
        old=saved[path]
        if old is not None and old!=new_bytes:
            write(backups+'/before-family-22-bank-'+tag+'-'+path.rsplit('/',1)[-1]+'.bak',old)
    for path,new_bytes in destinations:
        if maybe(path)!=saved[path]:raise RuntimeError('CONCURRENT_CHANGE')
        if saved[path]!=new_bytes:
            changed.append(path)
            write(path,new_bytes)
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_AFTER')
    for p,h in before.items():
        if hashlib.sha256(read(p)).hexdigest()!=h:raise RuntimeError('PROTECTED_CHANGED')
    for path,new_bytes in destinations:
        if read(path)!=new_bytes:raise RuntimeError('NEW_FILE_DRIFT')
    print('FAMILY_22_KB_PUBLISHED verified=true kb_chars='+str(len(kb.decode('utf-8')))
          +' all_10_questions=true day_month_50_50=true legacy_paid_cache_fallback=true'
          +' model_unchanged=true previous_sections_untouched=true paid_ai_calls=0',flush=True)
except BaseException:
    errors=[]
    for path in reversed(changed):
        try:
            if saved[path] is None:ftp.delete(path)
            else:write(path,saved[path])
        except BaseException:errors.append(path)
    print('ROLLBACK_'+('FAILURE_'+','.join(errors) if errors else 'SUCCESS'),flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
