import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib
base='17dda87df4596f00792ec45d6402edad743d10bc'
fresh=['account-service/private/verdict-practical-engine.php','account-service/private/verdict-owner-knowledge-v1.txt','account-service/private/verdict-owner-questions.json','redflag-ai-lab/verdict-owner-preview-api.php']
shared=['redflag-feature.js','app.js','index.html']
files=fresh+shared
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in shared}
for p in ['account-service/private/verdict-practical-engine.php','redflag-ai-lab/verdict-owner-preview-api.php']:subprocess.run(['php','-l',p],check=True)
subprocess.run(['node','--input-type=module','--check'],input=new['redflag-feature.js'],check=True)
fixture=r"""<?php
require 'account-service/private/verdict-practical-engine.php';
if(count(vpKnowledge())!==22||count(vpQuestions())!==10)throw new RuntimeException('KB');
foreach(vpQuestions() as $q)foreach([[15,7,1987],[31,10,1988],[9,9,1986],[29,2,2000]] as [$d,$m,$y]){
 $p=json_decode(vpMessages($q,$d,$m,$y)[1]['content'],true,30,JSON_THROW_ON_ERROR);
 if(count($p['четыре_значимые_позиции'])!==4||count($p['два_вопроса_для_подводки'])!==2)throw new RuntimeException('PAYLOAD');
}
echo 'VERDICT_OFFLINE_PASS';
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
def status(p):
 try:
  with urllib.request.urlopen('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?verdict='+str(time.time_ns()),timeout=25) as r:return r.status
 except urllib.error.HTTPError as e:return e.code
def healthy(after=False):
 codes=[status(''),status('redflag-ai-lab/style-test-api.php'),status('redflag-ai-lab/family-owner-preview-api.php'),status('redflag-ai-lab/intimacy-practical-preview-api.php')]
 if after:codes.append(status('redflag-ai-lab/verdict-owner-preview-api.php'))
 print('SITE_HEALTH',codes,flush=True)
 return codes==([200,403,403,403,403] if after else [200,403,403,403])
assert healthy(),'PRE_HEALTH'
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/');private=home+'/private/numi-account-20261031/';web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
def remote(p):return private+p.rsplit('/',1)[-1] if p.startswith('account-service/private/') else web+p
def read(p,optional=False):
 b=io.BytesIO()
 try:ftp.retrbinary('RETR '+p,b.write)
 except ftplib.error_perm as e:
  if optional and str(e).startswith('550'):return None
  raise
 return b.getvalue()
def write(p,b):
 ftp.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b,'READBACK'
anchors={
 'redflag-feature.js':[(b'section==="family"||section==="intimacy"',b'section==="family"||section==="intimacy"||section==="verdict"'),(b':category==="intimacy"?"/redflag-ai-lab/intimacy-practical-preview-api.php"',b':category==="intimacy"?"/redflag-ai-lab/intimacy-practical-preview-api.php"\n         :category==="verdict"?"/redflag-ai-lab/verdict-owner-preview-api.php"')],
 'app.js':[(b'./redflag-feature.js?v=intimacy-owner-routing-20261124',b'./redflag-feature.js?v=verdict-owner-routing-20261124')],
 'index.html':[(b'app.js?v=intimacy-owner-routing-20261124',b'app.js?v=verdict-owner-routing-20261124')]
}
protected=[private+x for x in ['family-practical-engine.php','family-owner-knowledge-v1.txt','family-live.php','intimacy-practical-engine.php','intimacy-practical-knowledge.txt','intimacy-live.php','language-live.php','language-live-knowledge.txt','wallet-real-payment.php','fulfillment.php','core.php','redflag-catalog.json']]+[web+x for x in ['redflag-ai-lab/style-test-api.php','redflag-ai-lab/family-owner-preview-api.php','redflag-ai-lab/intimacy-practical-preview-api.php','redflag-public-catalog.js']]
saved={};changed=[]
try:
 for p in files:
  saved[p]=read(remote(p),p in fresh)
  if p in fresh:
   assert saved[p] in (None,new[p]),'UNEXPECTED_EXISTING_'+p
  elif saved[p] not in (old[p],new[p]):
   patched=saved[p]
   for a,b in anchors[p]:
    if patched.count(b)==1:continue
    assert patched.count(a)==1,'REMOTE_ANCHOR_'+p
    patched=patched.replace(a,b,1)
   new[p]=patched
 subprocess.run(['node','--input-type=module','--check'],input=new['redflag-feature.js'],check=True)
 hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
 backup=home+'/site-safeguard-backups'
 try:ftp.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if saved[p] is not None and saved[p]!=new[p]:write(backup+'/before-verdict-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',saved[p])
 for p in files:
  assert read(remote(p),p in fresh)==saved[p],'CONCURRENT_EDIT'
  if saved[p]!=new[p]:
   changed.append(p);write(remote(p),new[p])
 assert healthy(True),'POST_HEALTH'
 for p in files:assert read(remote(p))==new[p],'FINAL_READBACK'
 for p,h in hashes.items():assert hashlib.sha256(read(p)).digest()==h,'PROTECTED_CHANGED'
 print('VERDICT_OWNER_LIVE ten_questions=true family_architecture=true model_calls=0',flush=True)
except BaseException:
 for p in reversed(changed):
  try:
   if saved[p] is None:ftp.delete(remote(p))
   else:write(remote(p),saved[p])
   print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
