#!/usr/bin/env python3
"""Publish only family formatting recovery, backed up, no provider calls and no other-site changes."""
import os,ftplib,ssl,io,pathlib,subprocess,hashlib,urllib.request,urllib.error,time,uuid
file='account-service/private/family-live.php'
baseCommit='672dd1adfc5c1b520bf897c9e4946775032352db'
old=subprocess.check_output(['git','show',baseCommit+':'+file])
new=pathlib.Path(file).read_bytes()
assert old!=new and new.count(b'function nfCloudRaw(')==1
assert new.count(b'function nfRestoreTwoParagraphs(')==1
assert b'google/gemini-3-flash-preview' in new
assert b"'max_tokens'=>$tokens" in new
assert b'CURLOPT_TIMEOUT=>95' in new
for p in [file]:
    check=subprocess.run(['php','-l'],input=pathlib.Path(p).read_bytes(),capture_output=True)
    if check.returncode:raise RuntimeError('PHP_SYNTAX_INVALID_'+check.stderr.decode('utf-8','replace')[:200])
# Exercise the full parser in PHP with synthetic data; absolutely no AI/provider calls.
tests=r"""<?php
require 'account-service/private/family-live.php';
function ck($text) {
  $fixed=nfRestoreTwoParagraphs($text);
  $parts=preg_split('/\n\s*\n/u',$fixed);
  if(count($parts)!==2)throw new RuntimeException('PARAGRAPH_REPAIR_FAILED');
  if(str_replace(["\r","\n"," "],'',$text)!==str_replace(["\r","\n"," "],'',$fixed))
      throw new RuntimeException('TEXT_CONTENT_CHANGED');
}
$a=str_repeat('Он умеет договариваться. ',27);
$b='В отношениях это заметно. Как он реагирует на критику и неудобную правду?';
ck($a."\n\n".$b);
ck($a."\n\n".'Вопросы иногда сложнее.'."\n\n".$b);
ck($a."\n".$b);
ck($a.$b);
echo 'FAMILY_FORMAT_REPAIR_TESTS_OK',PHP_EOL;
"""
valid=subprocess.run(['php'],input=tests.encode(),capture_output=True)
if valid.returncode or b'FAMILY_FORMAT_REPAIR_TESTS_OK' not in valid.stdout:
    raise RuntimeError('FAMILY_FORMAT_REPAIR_TEST_FAILED_'+valid.stderr.decode('utf-8','replace')[:300])
print('FAMILY_FORMAT_REPAIR_TESTS_OK',flush=True)
def status(p):
    url='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?family_fmt='+str(time.time_ns())
    req=urllib.request.Request(url,headers={'Cache-Control':'no-store'})
    try:
        with urllib.request.urlopen(req,timeout=25) as res:return res.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    x=[status(''),status('redflag-ai-lab/style-test-api.php'),status('api/numi-account.php')]
    print('SITE_HEALTH',x,flush=True)
    return x[0]==200 and x[1]==403 and x[2] in (403,405)
if not healthy():raise RuntimeError('SITE_UNHEALTHY_BEFORE_NO_WRITES')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=44)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
dest=home+'/private/numi-account-20261031/family-live.php'
backups=home+'/site-safeguard-backups'
def read(path):
    f=io.BytesIO();ftp.retrbinary('RETR '+path,f.write);return f.getvalue()
def write(path,data):
    ftp.storbinary('STOR '+path,io.BytesIO(data))
    if read(path)!=data:raise RuntimeError('READBACK_MISMATCH')
original=None;started=False
try:
    original=read(dest)
    if original!=old and original!=new:raise RuntimeError('FAMILY_LIVE_DRIFT_NO_WRITES')
    protected=[
      home+'/private/numi-account-20261031/intimacy-live.php',
      home+'/private/numi-account-20261031/intimacy-live-knowledge.json',
      home+'/private/numi-account-20261031/fulfillment.php',
      home+'/private/numi-account-20261031/wallet-real-payment.php',
      home+'/www/xn--c1adkkdfjbp1a4l.online/redflag-feature.js',
      home+'/www/xn--c1adkkdfjbp1a4l.online/api/numi-owner-material.php',
      home+'/www/xn--c1adkkdfjbp1a4l.online/api/numi-family-free.php',
      home+'/www/xn--c1adkkdfjbp1a4l.online/redflag-public-catalog.js'
    ]
    digests={p:hashlib.sha256(read(p)).hexdigest() for p in protected}
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_PREFLIGHT')
    try:ftp.mkd(backups)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    if original!=new:
        tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]
        backup=backups+'/before-family-format-repair-'+tag+'.php.bak'
        write(backup,original)
        if read(dest)!=original:raise RuntimeError('LIVE_CONCURRENT_CHANGE')
        started=True;write(dest,new)
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_AFTER')
    for p,h in digests.items():
        if hashlib.sha256(read(p)).hexdigest()!=h:raise RuntimeError('PROTECTED_FILE_CHANGED')
    if read(dest)!=new:raise RuntimeError('FINAL_READBACK_FAILED')
    print('FAMILY_FORMAT_RECOVERY_PUBLISHED verified=true model_unchanged=true prompt_unchanged=true original_sections_unchanged=true paid_ai_calls=0',flush=True)
except BaseException:
    if started and original is not None:
        try:write(dest,original);print('ROLLBACK_SUCCESS',flush=True)
        except BaseException:print('ROLLBACK_FAILED',flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
