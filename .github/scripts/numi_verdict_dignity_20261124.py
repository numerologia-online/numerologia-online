import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib,json,tempfile
base='f1c12c9187412ff2159628aeb9909f4caf7746c7'
files=json.loads("[\"account-service/private/verdict-live.php\",\"account-service/private/verdict-practical-engine.php\",\"account-service/private/verdict-owner-questions.json\",\"redflag-public-catalog.js\",\"store-catalog.json\",\"redflag-feature.js\",\"redflag-text-bank.js\",\"redflag-categories.js\",\"app.js\",\"index.html\"]")
rules=json.loads("{\"account-service/private/verdict-owner-questions.json\":[[\"Красивый мужчина или Red Flag с красивыми глазами?\",\"Достойный мужчина или Red Flag, который хорошо себя преподносит?\"]],\"data/redflag/banks/verdict.json\":[[\"Красивый мужчина или Red Flag с красивыми глазами?\",\"Достойный мужчина или Red Flag, который хорошо себя преподносит?\"]],\"redflag-public-catalog.js\":[[\"Красивый мужчина или Red Flag с красивыми глазами?\",\"Достойный мужчина или Red Flag, который хорошо себя преподносит?\"]],\"store-catalog.json\":[[\"Красивый мужчина или Red Flag с красивыми глазами?\",\"Достойный мужчина или Red Flag, который хорошо себя преподносит?\"]],\"account-service/private/verdict-practical-engine.php\":[[\"Отдели привлекательность от возможного неприятного поведения. Назови наблюдаемый сигнал, не объявляй человека опасным по дате.\",\"Отличи реальные достоинства, уважение, ответственность и честность от умения произвести хорошее впечатление. Внешность не оценивай. Назови конкретный наблюдаемый поступок, не объявляй человека опасным по дате.\"]],\"account-service/private/verdict-live.php\":[[\"return nvCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).'-verdict-v1.json';\",\"return nvCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).($id==='beauty-and-flag'?'-verdict-dignity-v2.json':'-verdict-v1.json');\"],[\"    $answer=nvCachedAnswer($m[1],$m[2]);\\n    if($answer===null)throw new RuntimeException('MATERIAL_NOT_READY');\",\"    $answer=nvCachedAnswer($m[1],$m[2]);\\n    if($answer===null&&$m[1]==='beauty-and-flag')$answer=nvReadCachedAnswer(nvCacheDirectory().'/'.$m[1].'-'.str_replace('-','',$m[2]).'-verdict-v1.json',$m[1],$m[2]);\\n    if($answer===null)throw new RuntimeException('MATERIAL_NOT_READY');\"]],\"redflag-feature.js\":[[\"love-live-20261124\",\"verdict-dignity-20261124\"]],\"redflag-text-bank.js\":[[\"love-live-20261124\",\"verdict-dignity-20261124\"]],\"redflag-categories.js\":[[\"love-live-20261124\",\"verdict-dignity-20261124\"]],\"app.js\":[[\"love-live-20261124\",\"verdict-dignity-20261124\"]],\"index.html\":[[\"love-live-20261124\",\"verdict-dignity-20261124\"]]}")

new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files}
def lint(p,b):
 if p.endswith('.php'):
  with tempfile.NamedTemporaryFile(suffix='.php') as f:
   f.write(b);f.flush();subprocess.run(['php','-l',f.name],check=True)
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=b,check=True)
 if p.endswith('.json'):json.loads(b)
for p,b in new.items():lint(p,b)
fixture=r"""<?php
require 'account-service/private/verdict-practical-engine.php';
$q=vpQuestions();
$target='Достойный мужчина или Red Flag, который хорошо себя преподносит?';
if(count($q)!==10||$q[2]['id']!=='beauty-and-flag'||$q[2]['title']!==$target)throw new RuntimeException('TITLE');
$m=json_decode(vpMessages($q[2],15,7,1987)[1]['content'],true,30,JSON_THROW_ON_ERROR);
if($m['вопрос']!==$target||count($m['четыре_значимые_позиции'])!==4||!str_contains($m['точная_задача'],'Внешность не оценивай'))throw new RuntimeException('FOCUS');
echo 'VERDICT_DIGNITY_OFFLINE_PASS';
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
def status(p):
 try:
  with urllib.request.urlopen('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?dignity='+str(time.time_ns()),timeout=25) as r:return r.status
 except urllib.error.HTTPError as e:return e.code
def healthy():
 c=[status(''),status('redflag-ai-lab/verdict-owner-preview-api.php'),status('redflag-ai-lab/love-owner-preview-api.php')]
 print('SITE_HEALTH',c,flush=True)
 return c==[200,403,403]
assert healthy(),'PRE_HEALTH'
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/');private=home+'/private/numi-account-20261031/';web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
def remote(p):return private+p.rsplit('/',1)[-1] if p.startswith('account-service/private/') else web+p
def read(p):
 b=io.BytesIO();ftp.retrbinary('RETR '+p,b.write);return b.getvalue()
def write(p,b):
 ftp.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b,'READBACK'
saved={};changed=[]
try:
 for p in files:
  saved[p]=read(remote(p))
  if saved[p] not in (old[p],new[p]):
   a=saved[p].decode()
   for x,y in rules[p]:
    if a.count(y)==1:continue
    assert a.count(x)==1,'REMOTE_ANCHOR_'+p
    a=a.replace(x,y)
   new[p]=a.encode()
  lint(p,new[p])
 protected=[private+x for x in ['core.php','wallet-real-payment.php','fulfillment.php','redflag-catalog.json','store-assets.json','verdict-owner-knowledge-v1.txt','love-practical-engine.php','love-practical-knowledge.txt','love-live.php','language-live.php','family-live.php','intimacy-live.php']]
 hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
 backup=home+'/site-safeguard-backups'
 try:ftp.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if saved[p]!=new[p]:write(backup+'/before-verdict-dignity-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',saved[p])
 for p in files:
  assert read(remote(p))==saved[p],'CONCURRENT_EDIT'
  if saved[p]!=new[p]:changed.append(p);write(remote(p),new[p])
 assert healthy(),'POST_HEALTH'
 for p in files:assert read(remote(p))==new[p],'FINAL_READBACK'
 for p,h in hashes.items():assert hashlib.sha256(read(p)).digest()==h,'PROTECTED_CHANGED'
 print('VERDICT_DIGNITY_LIVE title_and_focus_only model_calls=0',flush=True)
except BaseException:
 for p in reversed(changed):
  try:write(remote(p),saved[p]);print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
