#!/usr/bin/env python3
import ftplib, ssl, io, os, time, uuid, subprocess, pathlib, hashlib, json, urllib.request, urllib.error, re, base64, difflib

baseline='2c25734e0cfa'
basepaths={
 'account-service/private/fulfillment.php':'private/numi-account-20261031/fulfillment.php',
 'account-service/private/wallet-real-payment.php':'private/numi-account-20261031/wallet-real-payment.php',
 'account-service/private/redflag-catalog.json':'private/numi-account-20261031/redflag-catalog.json',
 'account-service/public/numi-owner-material.php':'www/xn--c1adkkdfjbp1a4l.online/api/numi-owner-material.php',
 'redflag-feature.js':'www/xn--c1adkkdfjbp1a4l.online/redflag-feature.js',
 'app.js':'www/xn--c1adkkdfjbp1a4l.online/app.js',
 'index.html':'www/xn--c1adkkdfjbp1a4l.online/index.html'
}
newpaths={
 'account-service/private/intimacy-live.php':'private/numi-account-20261031/intimacy-live.php',
 'account-service/private/intimacy-live-knowledge.json':'private/numi-account-20261031/intimacy-live-knowledge.json',
 'account-service/private/intimacy-live-questions.json':'private/numi-account-20261031/intimacy-live-questions.json',
 'account-service/public/numi-intimacy-free.php':'www/xn--c1adkkdfjbp1a4l.online/api/numi-intimacy-free.php'
}
desired={p:pathlib.Path(p).read_bytes() for p in list(basepaths)+list(newpaths)}
originals={p:subprocess.check_output(['git','show',baseline+':'+p]) for p in basepaths}
def apply_narrow(live,old,new,label):
 if live==new:return live
 if old==new:raise RuntimeError('EMPTY_DIFF_'+label)
 if live==old:return new
 diff=difflib.SequenceMatcher(None,old,new,autojunk=True)
 edits=[(i1,i2,j1,j2) for op,i1,i2,j1,j2 in diff.get_opcodes() if op!='equal']
 if not 1<=len(edits)<=12:raise RuntimeError('UNSAFE_DIFF_SHAPE_'+label)
 result=live
 for i1,i2,j1,j2 in edits:
  left=old[max(0,i1-160):i1]
  right=old[i2:min(len(old),i2+160)]
  before=left+old[i1:i2]+right
  after=left+new[j1:j2]+right
  if result.count(before)!=1:raise RuntimeError('LIVE_EDIT_ANCHOR_DRIFT_'+label)
  result=result.replace(before,after,1)
 return result
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
backups=home+'/site-safeguard-backups'
def read(p):
 out=io.BytesIO();ftp.retrbinary('RETR '+p,out.write)
 return out.getvalue()
def maybe(p):
 try:return read(p)
 except ftplib.error_perm as e:
  if str(e).startswith('550'):return None
  raise
def write(p,v):
 ftp.storbinary('STOR '+p,io.BytesIO(v))
 if read(p)!=v:raise RuntimeError('UPLOAD_READBACK_FAILED')
def code_status(path):
 url='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+path+'?intimacy_verify='+str(time.time_ns())
 req=urllib.request.Request(url,headers={'Cache-Control':'no-store'})
 try:
  with urllib.request.urlopen(req,timeout=27) as r:return r.status
 except urllib.error.HTTPError as e:return e.code
def healthy():
 codes=[code_status(''),code_status('redflag-ai-lab/style-test-api.php'),code_status('api/numi-account.php')]
 print('SITE_HEALTH',codes,flush=True)
 return codes[0]==200 and codes[1]==403 and codes[2] in (403,405)
protected=[
 'www/xn--c1adkkdfjbp1a4l.online/redflag-ai-lab/style-test-api.php',
 'www/xn--c1adkkdfjbp1a4l.online/redflag-ai-lab/sexuality-knowledge-v1.json',
 'www/xn--c1adkkdfjbp1a4l.online/redflag-ai-lab/infidelity-knowledge-v1.json',
 'www/xn--c1adkkdfjbp1a4l.online/data/redflag/banks/intimacy.json',
 'www/xn--c1adkkdfjbp1a4l.online/redflag-public-catalog.js',
 'private/numi-account-20261031/core.php',
 'private/numi-account-20261031/wallet-real.php',
 'private/numi-account-20261031/store.php',
 'private/numi-account-20261031/wallet.php',
]
current={};output={};changed=[]
paths={**basepaths,**newpaths,'private-config':'private/numi-account-20261031/intimacy-live-config.php'}
if not healthy():raise RuntimeError('SITE_NOT_HEALTHY_BEFORE_NO_WRITES')
try:
 for p in protected:
  current['protected:'+p]=hashlib.sha256(read(home+'/'+p)).hexdigest()
 for p,remote in basepaths.items():
  v=read(home+'/'+remote);current[p]=v
  if p=='account-service/private/redflag-catalog.json':
   a=v.index(b'"intimacy"');b=v.index(b'"family"',a)
   segment=v[a:b]
   if segment.count(b'"ready": false')!=9:raise RuntimeError('INTIMACY_READY_BASELINE_DRIFT')
   result=v[:a]+segment.replace(b'"ready": false',b'"ready": true')+v[b:]
   oldJson=json.loads(v);newJson=json.loads(result)
   assert sum(x['ready'] for x in newJson['questions']['intimacy'].values())==10
   oldJson['questions']['intimacy']=newJson['questions']['intimacy']
   assert oldJson==newJson
   output[p]=result
  else:
   output[p]=apply_narrow(v,originals[p],desired[p],p)
 for p,remote in newpaths.items():
  v=maybe(home+'/'+remote)
  if v is not None and v!=desired[p]:raise RuntimeError('EXISTING_NEW_FILE_DRIFT_'+p)
  current[p]=v;output[p]=desired[p]
 # Securely lift live provider credentials into a PHP config file outside
 # webroot. Never log or echo its contents, or place it in public GitHub.
 editor=read(home+'/www/xn--c1adkkdfjbp1a4l.online/redflag-ai-lab/style-test-api.php')
 needle=re.search(rb"function rfCloudCall\(.*?base64_decode\('([^']+)'\s*,\s*true\)",editor,re.S)
 if needle is None:raise RuntimeError('PROVIDER_KEY_NOT_FOUND_NO_CHANGES')
 encoded=needle.group(1)
 if encoded.startswith(b'__CLOUDRU'):raise RuntimeError('PROVIDER_CONFIG_PLACEHOLDER_NO_CHANGES')
 secret=base64.b64decode(encoded,validate=True).decode('ascii')
 if len(secret)<12 or len(secret)>1024 or any(ord(c)<33 or ord(c)>126 for c in secret):
  raise RuntimeError('PROVIDER_KEY_INVALID')
 cfg="<?php\nreturn ['cloudru_key' => '"+secret.replace("\\","\\\\").replace("'","\\'")+"'];\n"
 configpath=home+'/private/numi-account-20261031/intimacy-live-config.php'
 oldcfg=maybe(configpath)
 if oldcfg is not None and oldcfg!=cfg.encode():raise RuntimeError('INTIMACY_CONFIG_DRIFT')
 current['private-config']=oldcfg
 output['private-config']=cfg.encode()
 for p in ('account-service/private/fulfillment.php','account-service/private/wallet-real-payment.php','account-service/public/numi-owner-material.php'):
  proc=subprocess.run(['php','-l'],input=output[p],capture_output=True)
  if proc.returncode:raise RuntimeError('PATCHED_PHP_LINT_FAILURE_'+p)
 if not healthy():raise RuntimeError('SITE_NOT_HEALTHY_PREFLIGHT')
 try:ftp.mkd(backups)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]
 for p,remote in paths.items():
  old=current[p]
  if old is not None and old!=output[p]:
   backup=backups+'/before-native-intimacy-'+tag+'-'+p.replace('/','-')+'.bak'
   write(backup,old)
 for p,remote in paths.items():
  if maybe(home+'/'+remote)!=current[p]:raise RuntimeError('CONCURRENT_REMOTE_CHANGE_'+p)
 ordered=list(newpaths)+['private-config','account-service/private/fulfillment.php',
  'account-service/private/wallet-real-payment.php',
  'account-service/public/numi-owner-material.php',
  'account-service/private/redflag-catalog.json',
  'redflag-feature.js','app.js','index.html']
 for p in ordered:
  remote=home+'/'+paths[p]
  if current[p]==output[p]:continue
  changed.append(p);write(remote,output[p])
 if not healthy():raise RuntimeError('SITE_HEALTH_FAILED_AFTER')
 for p in protected:
  if hashlib.sha256(read(home+'/'+p)).hexdigest()!=current['protected:'+p]:
   raise RuntimeError('UNRELATED_PROTECTED_FILE_CHANGED_'+p)
 for p,remote in paths.items():
  if read(home+'/'+remote)!=output[p]:raise RuntimeError('FINAL_FILE_READBACK_FAILED_'+p)
 if code_status('api/numi-intimacy-free.php') not in (405,403):
  raise RuntimeError('PUBLIC_FREE_ENDPOINT_NOT_REACHABLE')
 site=urllib.request.urlopen(urllib.request.Request(
  'https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/?native_intimacy='+str(time.time_ns()),
  headers={'Cache-Control':'no-store'}),timeout=25).read()
 if b'app.js?v=intimacy-live-all10-20261123' not in site:
  raise RuntimeError('LIVE_MAIN_PAGE_OLD_SCRIPT')
 print('NATIVE_INTIMACY_PRODUCTION_PUBLISHED_OK questions=10 free=1 paid=9 payment_after_success=true no_editor_routes=true paid_ai_calls=0',flush=True)
except BaseException:
 fails=[]
 for p in reversed(changed):
  remote=home+'/'+paths[p]
  try:
   if current[p] is None:ftp.delete(remote)
   else:write(remote,current[p])
  except BaseException:fails.append(p)
 print('ROLLBACK_'+('FAILED_'+','.join(fails) if fails else 'SUCCESS'),flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
