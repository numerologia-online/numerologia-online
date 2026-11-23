#!/usr/bin/env python3
"""Narrow REG.RU family-only owner error handling; zero AI requests, zero purchase actions."""
import ftplib,ssl,io,os,time,uuid,pathlib,hashlib,subprocess,urllib.request,urllib.error
root='www/xn--c1adkkdfjbp1a4l.online/'
paths=['redflag-feature.js','app.js','index.html']
original={p:subprocess.check_output(['git','show','HEAD^:'+p]) for p in paths}
desired={p:pathlib.Path(p).read_bytes() for p in paths}
assert desired['redflag-feature.js'].count(b'if(category==="family")')>=1
assert b'walletOwnerMaterial(item)' in desired['redflag-feature.js']
assert b'reportLoadError("not-charged")' in desired['redflag-feature.js']
assert b'family-owner-no-paywall-20261123' in desired['app.js']
assert b'family-owner-no-paywall-20261123' in desired['index.html']
for p in ['redflag-feature.js','app.js']:
 test=subprocess.run(['node','--check','--input-type=module'],input=desired[p],capture_output=True)
 if test.returncode:raise RuntimeError('SYNTAX_INVALID_'+p)
def status(p):
 req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?owner_fix='+str(time.time_ns()),headers={'Cache-Control':'no-store'})
 try:
  with urllib.request.urlopen(req,timeout=24) as response:return response.status
 except urllib.error.HTTPError as e:return e.code
def healthy():
 x=[status(''),status('redflag-ai-lab/style-test-api.php'),status('api/numi-account.php')]
 print('SITE_HEALTH',x,flush=True)
 return x[0]==200 and x[1]==403 and x[2] in (403,405)
if not healthy():raise RuntimeError('SITE_UNHEALTHY_BEFORE_NO_WRITES')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
backups=home+'/site-safeguard-backups'
def read(path):
 v=io.BytesIO();ftp.retrbinary('RETR '+home+'/'+path,v.write);return v.getvalue()
def write(path,data):
 full=home+'/'+path
 ftp.storbinary('STOR '+full,io.BytesIO(data))
 if read(path)!=data:raise RuntimeError('READBACK_MISMATCH_'+path)
protected=[
 root+'wallet-client.js',
 root+'redflag-public-catalog.js',
 root+'redflag-text-bank.js',
 root+'redflag-categories.js',
 root+'redflag-ai-lab/style-test-api.php',
 'private/numi-account-20261031/family-live.php',
 'private/numi-account-20261031/intimacy-live.php',
 'private/numi-account-20261031/fulfillment.php',
 'private/numi-account-20261031/redflag-catalog.json',
 'private/numi-account-20261031/wallet-real-payment.php',
 root+'api/numi-owner-material.php'
]
saved={};changed=[]
try:
 hashes={p:hashlib.sha256(read(p)).hexdigest() for p in protected}
 for p in paths:
  live=read(root+p)
  if live!=original[p] and live!=desired[p]:
   raise RuntimeError('LIVE_FILE_DRIFT_NO_WRITES_'+p)
  saved[p]=live
 try:ftp.mkd(backups)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]
 for p in paths:
  if saved[p]!=desired[p]:
   write(backups+'/before-family-owner-fix-'+tag+'-'+p,saved[p])
 for p in paths:
  if read(root+p)!=saved[p]:raise RuntimeError('CONCURRENT_REMOTE_EDIT_'+p)
 for p in paths:
  if saved[p]!=desired[p]:
   changed.append(p);write(root+p,desired[p])
 if not healthy():raise RuntimeError('SITE_UNHEALTHY_AFTER')
 for p,h in hashes.items():
  if hashlib.sha256(read(p)).hexdigest()!=h:raise RuntimeError('PROTECTED_FILE_CHANGED_'+p)
 for p in paths:
  if read(root+p)!=desired[p]:raise RuntimeError('READBACK_MISMATCH_'+p)
 page=urllib.request.urlopen(urllib.request.Request(
  'https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/?owner_fix='+str(time.time_ns()),
  headers={'Cache-Control':'no-store'}),timeout=26).read()
 if b'app.js?v=family-owner-no-paywall-20261123' not in page:
  raise RuntimeError('STALE_ENTRYPOINT_SCRIPT')
 print('FAMILY_OWNER_FALLBACK_FIXED_PUBLISHED owner_failed_generation_no_paywall=true paid_calls=0 protected_unchanged=true',flush=True)
except BaseException:
 failed=[]
 for p in reversed(changed):
  try:write(root+p,saved[p])
  except BaseException:failed.append(p)
 print('ROLLBACK_'+('FAILED_'+','.join(failed) if failed else 'SUCCESS'),flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
