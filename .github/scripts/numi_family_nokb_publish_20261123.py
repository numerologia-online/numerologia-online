#!/usr/bin/env python3
"""Guarded, backed-up REG.RU family publication. No paid AI calls in deployment."""
import ftplib,ssl,io,os,time,uuid,subprocess,pathlib,hashlib,urllib.request,urllib.error,difflib,json
home_root='www/xn--c1adkkdfjbp1a4l.online/'
private='private/numi-account-20261031/'
existing={
 'account-service/private/fulfillment.php':private+'fulfillment.php',
 'account-service/private/wallet-real-payment.php':private+'wallet-real-payment.php',
 'account-service/private/redflag-catalog.json':private+'redflag-catalog.json',
 'account-service/public/numi-owner-material.php':home_root+'api/numi-owner-material.php',
 'redflag-feature.js':home_root+'redflag-feature.js',
 'redflag-public-catalog.js':home_root+'redflag-public-catalog.js',
 'redflag-categories.js':home_root+'redflag-categories.js',
 'redflag-text-bank.js':home_root+'redflag-text-bank.js',
 'app.js':home_root+'app.js',
 'index.html':home_root+'index.html'
}
added={
 'account-service/private/family-live.php':private+'family-live.php',
 'account-service/private/family-live-questions.json':private+'family-live-questions.json',
 'account-service/private/family-live-followups.json':private+'family-live-followups.json',
 'account-service/public/numi-family-free.php':home_root+'api/numi-family-free.php'
}
paths={**added,**existing}
# Only the changes in this commit are ever deployed. Never overwrite unrelated live drift.
new={p:pathlib.Path(p).read_bytes() for p in paths}
old={p:subprocess.check_output(['git','show','698271621106775c0a7f19f937ed794e7c2518f7:'+p]) for p in existing}
for p in [p for p in paths if p.endswith('.php')]:
 proc=subprocess.run(['php','-l'],input=new[p],capture_output=True)
 if proc.returncode:raise RuntimeError('LOCAL_PHP_LINT_FAILED_'+p)
for p in [p for p in paths if p.endswith('.js')]:
 proc=subprocess.run(['node','--check','--input-type=module'],input=new[p],capture_output=True)
 if proc.returncode:raise RuntimeError('LOCAL_JS_CHECK_FAILED_'+p)
for p in [p for p in paths if p.endswith('.json')]:
 json.loads(new[p])
privateCat=json.loads(new['account-service/private/redflag-catalog.json'])
assert len(privateCat['questions']['family'])==10
assert sum(1 for v in privateCat['questions']['family'].values() if v['ready'])==10
assert 'intimacy-live-knowledge.json' not in new['account-service/private/family-live.php'].decode()
assert b'ni31(' in new['account-service/private/family-live.php']
def patch(live,baseline,desired,label):
 if live==desired:return live
 if live==baseline:return desired
 diff=difflib.SequenceMatcher(None,baseline,desired,autojunk=False)
 edits=[(i1,i2,j1,j2) for op,i1,i2,j1,j2 in diff.get_opcodes() if op!='equal']
 if not 1<=len(edits)<=22:raise RuntimeError('EDIT_SHAPE_DRIFT_'+label)
 result=live
 for i1,i2,j1,j2 in edits:
  left=baseline[max(0,i1-120):i1];right=baseline[i2:min(len(baseline),i2+120)]
  before=left+baseline[i1:i2]+right
  if result.count(before)!=1:raise RuntimeError('LIVE_ANCHOR_DRIFT_'+label)
  result=result.replace(before,left+desired[j1:j2]+right,1)
 return result
def code_status(path):
 req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+path+'?family_v='+str(time.time_ns()),headers={'Cache-Control':'no-store'})
 try:
  with urllib.request.urlopen(req,timeout=27) as res:return res.status
 except urllib.error.HTTPError as e:return e.code
def healthy():
 codes=[code_status(''),code_status('redflag-ai-lab/style-test-api.php'),code_status('api/numi-account.php')]
 print('SITE_HEALTH',codes,flush=True)
 return codes[0]==200 and codes[1]==403 and codes[2] in (403,405)
if not healthy():raise RuntimeError('SITE_UNHEALTHY_BEFORE_NO_WRITES')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
backups=home+'/site-safeguard-backups'
def read(path):
 out=io.BytesIO();ftp.retrbinary('RETR '+path,out.write);return out.getvalue()
def maybe(path):
 try:return read(path)
 except ftplib.error_perm as e:
  if str(e).startswith('550'):return None
  raise
def write(path,v):
 ftp.storbinary('STOR '+path,io.BytesIO(v))
 if read(path)!=v:raise RuntimeError('UPLOAD_READBACK_MISMATCH')
protected=[
 home_root+'redflag-ai-lab/style-test-api.php',
 home_root+'redflag-ai-lab/sexuality-knowledge-v1.json',
 home_root+'redflag-ai-lab/infidelity-knowledge-v1.json',
 home_root+'data/redflag/banks/intimacy.json',
 home_root+'data/redflag/banks/family.json',
 private+'intimacy-live.php',
 private+'intimacy-live-knowledge.json',
 private+'intimacy-live-config.php',
 private+'core.php',
 private+'wallet-real.php'
]
saved={};expected={};changed=[]
try:
 before={p:hashlib.sha256(read(home+'/'+p)).hexdigest() for p in protected}
 for p,remote in existing.items():
  actual=read(home+'/'+remote)
  saved[p]=actual
  expected[p]=patch(actual,old[p],new[p],p)
 for p,remote in added.items():
  actual=maybe(home+'/'+remote)
  if actual is not None and actual!=new[p]:raise RuntimeError('NEW_FILE_ALREADY_DIFFERENT_'+p)
  saved[p]=actual
  expected[p]=new[p]
 for p in [x for x in paths if x.endswith('.php')]:
  proc=subprocess.run(['php','-l'],input=expected[p],capture_output=True)
  if proc.returncode:raise RuntimeError('DEPLOY_PHP_LINT_FAILED_'+p)
 for p in [x for x in paths if x.endswith('.js')]:
  proc=subprocess.run(['node','--check','--input-type=module'],input=expected[p],capture_output=True)
  if proc.returncode:raise RuntimeError('DEPLOY_JS_CHECK_FAILED_'+p)
 if not healthy():raise RuntimeError('SITE_UNHEALTHY_PREFLIGHT')
 try:ftp.mkd(backups)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]
 for p,remote in paths.items():
  if saved[p] is not None and saved[p]!=expected[p]:
   write(backups+'/before-family-nokb-'+tag+'-'+p.replace('/','-')+'.bak',saved[p])
 for p,remote in paths.items():
  if maybe(home+'/'+remote)!=saved[p]:raise RuntimeError('CONCURRENT_CHANGE_'+p)
 ordered=list(added)+[
 'account-service/private/fulfillment.php',
 'account-service/private/wallet-real-payment.php',
 'account-service/public/numi-owner-material.php',
 'account-service/private/redflag-catalog.json',
 'redflag-public-catalog.js','redflag-text-bank.js','redflag-categories.js',
 'redflag-feature.js','app.js','index.html']
 for p in ordered:
  if saved[p]==expected[p]:continue
  changed.append(p);write(home+'/'+paths[p],expected[p])
 if not healthy():raise RuntimeError('SITE_UNHEALTHY_AFTER')
 for p,digest in before.items():
  if hashlib.sha256(read(home+'/'+p)).hexdigest()!=digest:raise RuntimeError('PROTECTED_CHANGED_'+p)
 for p,remote in paths.items():
  if read(home+'/'+remote)!=expected[p]:raise RuntimeError('FILE_DRIFT_AFTER_'+p)
 if code_status('api/numi-family-free.php') not in (405,403):
  raise RuntimeError('FAMILY_FREE_ROUTE_NOT_READY')
 page=urllib.request.urlopen(urllib.request.Request(
  'https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/?family_v='+str(time.time_ns()),
  headers={'Cache-Control':'no-store'}),timeout=27).read()
 if b'app.js?v=family-nokb-live-20261123' not in page:
  raise RuntimeError('OLD_MAIN_SCRIPT_AFTER')
 print('FAMILY_NOKB_PUBLISHED_VERIFIED questions=10 free=1 paid=9 paid_ai_calls=0 existing_sections_unchanged=true')
except BaseException:
 errors=[]
 for p in reversed(changed):
  try:
   if saved[p] is None:ftp.delete(home+'/'+paths[p])
   else:write(home+'/'+paths[p],saved[p])
  except BaseException:errors.append(p)
 print('ROLLBACK_'+('FAILED_'+','.join(errors) if errors else 'SUCCESS'),flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
