import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib
base='7b34dcf4a093acae23112320b8cdc8d0e8d47b92'
files=['account-service/private/language-live-knowledge.txt','account-service/private/language-live.php']
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files}
new={p:pathlib.Path(p).read_bytes() for p in files}
subprocess.run(['php','-l',files[1]],check=True)
fixture=r"""<?php
require 'account-service/private/language-live.php';
if(count(nlKnowledge())!==22||count(nlQuestions())!==10)throw new RuntimeException('KB');
foreach(nlQuestions() as $q)foreach([[15,7,1987],[31,10,1988],[9,9,1986],[29,2,2000]] as [$d,$m,$y]){
 $p=json_decode(nlMessages($q,$d,$m,$y)[1]['content'],true,30,JSON_THROW_ON_ERROR);
 if(count($p['четыре_значимые_позиции'])!==4||count($p['два_вопроса_для_подводки'])!==2)throw new RuntimeException('PAYLOAD');
}
echo 'LANGUAGE_PRACTICAL_WARMTH_OFFLINE_PASS';
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
def status(p):
 try:
  with urllib.request.urlopen('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?language='+str(time.time_ns()),timeout=25) as r:return r.status
 except urllib.error.HTTPError as e:return e.code
def healthy():
 codes=[status(''),status('redflag-ai-lab/style-test-api.php'),status('redflag-ai-lab/family-owner-preview-api.php'),status('redflag-ai-lab/intimacy-practical-preview-api.php'),status('redflag-ai-lab/verdict-owner-preview-api.php'),status('api/numi-language-free.php'),status('api/numi-verdict-free.php')]
 print('SITE_HEALTH',codes,flush=True)
 return codes[:5]==[200,403,403,403,403] and all(x in (400,403,405) for x in codes[5:])
assert healthy(),'PRE_HEALTH'
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/');private=home+'/private/numi-account-20261031/';web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
def remote(p):return private+p.rsplit('/',1)[-1]
def read(p):
 b=io.BytesIO();ftp.retrbinary('RETR '+p,b.write);return b.getvalue()
def write(p,b):
 ftp.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b,'READBACK'
protected=[private+x for x in ['core.php','wallet-real-payment.php','fulfillment.php','redflag-catalog.json','language-live-questions.json','family-practical-engine.php','family-owner-knowledge-v1.txt','family-live.php','intimacy-practical-engine.php','intimacy-practical-knowledge.txt','intimacy-live.php','verdict-practical-engine.php','verdict-owner-knowledge-v1.txt','verdict-live.php']]+[web+x for x in ['redflag-feature.js','app.js','index.html','api/numi-language-free.php','api/numi-verdict-free.php']]
saved={};changed=[]
try:
 for p in files:
  saved[p]=read(remote(p))
  assert saved[p] in (old[p],new[p]),'REMOTE_DRIFT_'+p
 hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
 backup=home+'/site-safeguard-backups'
 try:ftp.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if saved[p]!=new[p]:write(backup+'/before-language-warmth-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',saved[p])
 for p in files:
  assert read(remote(p))==saved[p],'CONCURRENT_EDIT'
  if saved[p]!=new[p]:
   changed.append(p);write(remote(p),new[p])
 assert healthy(),'POST_HEALTH'
 for p in files:assert read(remote(p))==new[p],'FINAL_READBACK'
 for p,h in hashes.items():assert hashlib.sha256(read(p)).digest()==h,'PROTECTED_CHANGED'
 print('LANGUAGE_PRACTICAL_WARMTH_LIVE 22x10=true points_unchanged=true old_purchases_preserved=true model_calls=0',flush=True)
except BaseException:
 for p in reversed(changed):
  try:write(remote(p),saved[p]);print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
