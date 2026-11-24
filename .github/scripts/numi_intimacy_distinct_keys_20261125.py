import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib,tempfile
base='06a003673356abd469f66475d92d81b761a38591'
kb='account-service/private/intimacy-practical-knowledge.txt'
engine='account-service/private/intimacy-practical-engine.php'
files=[kb,engine]
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files}
def lint(p,b):
 if p==engine:
  assert b==old[p].decode().replace('в этом мужчине вне спальни','в этом мужчине за пределами интимных отношений').encode()
  assert 'спальн' not in b.decode().lower()
  with tempfile.NamedTemporaryFile(suffix='.php') as f:
   f.write(b);f.flush();subprocess.run(['php','-l',f.name],check=True)
  return
 rows=b.decode().splitlines()
 assert len(rows)==23 and rows[0]==old[p].decode().splitlines()[0]
 assert [int(r.split('|')[0]) for r in rows[1:]]==list(range(1,23))
 assert all(len(r.split('|'))==11 for r in rows[1:])
 vals=[v for r in rows[1:] for v in r.split('|')[1:]]
 assert len(vals)==len(set(vals))==220
 assert all(0<len(v)<=160 for v in vals) and len(b.decode())<=16000
for p,b in new.items():lint(p,b)
fixture=r"""<?php
require 'account-service/private/intimacy-practical-engine.php';
$kb=ipKnowledge();$questions=ipQuestions();
if(count($kb)!==22||count($questions)!==10)throw new RuntimeException('KB');
foreach($questions as $q)foreach([[31,10,1988],[4,4,1986],[9,9,1986],[15,7,1988],[6,6,1996],[7,7,1997],[8,8,1988],[10,10,1990],[11,11,1999]] as [$d,$m,$y]){
 $id=$q['id'];$matrix=ni31($d,$m,$y);$points=ipPointMap($id);
 $msgs=ipMessages($q,$d,$m,$y);
 $p=json_decode($msgs[1]['content'],true,30,JSON_THROW_ON_ERROR);
 if(mb_stripos($msgs[0]['content'],'спальн')!==false)throw new RuntimeException('PROMPT');
 foreach($points as $i=>$point)if($p['четыре_значимые_позиции'][$i]['смысловой_ключ']!==$kb[$matrix[$point]][$id])throw new RuntimeException('KEY');
}
echo 'INTIMACY_DISTINCT_KEYS_OFFLINE_PASS';
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
def status(p):
 try:
  with urllib.request.urlopen('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?intimacy='+str(time.time_ns()),timeout=25) as r:return r.status
 except urllib.error.HTTPError as e:return e.code
def healthy():
 c=[status(''),status('redflag-ai-lab/intimacy-practical-preview-api.php'),status('redflag-ai-lab/family-owner-preview-api.php')]
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
  assert saved[p] in (old[p],new[p]), 'REMOTE_CONTENT_DIFFERS_'+p
  lint(p,new[p])
 protected=[private+x for x in ['core.php','wallet-real-payment.php','fulfillment.php','redflag-catalog.json','store-assets.json','verdict-practical-engine.php','verdict-owner-knowledge-v1.txt','verdict-live.php','love-practical-engine.php','love-practical-knowledge.txt','love-live.php','language-live.php','language-live-knowledge.txt','family-live.php','family-practical-engine.php','family-live-questions.json','intimacy-live.php','intimacy-live-questions.json','family-owner-knowledge-v1.txt']]
 hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
 backup=home+'/site-safeguard-backups'
 try:ftp.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if saved[p]!=new[p]:write(backup+'/before-intimacy-distinct-keys-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',saved[p])
 for p in files:
  assert read(remote(p))==saved[p],'CONCURRENT_EDIT'
  if saved[p]!=new[p]:changed.append(p);write(remote(p),new[p])
 assert healthy(),'POST_HEALTH'
 for p in files:assert read(remote(p))==new[p],'FINAL_READBACK'
 for p,h in hashes.items():assert hashlib.sha256(read(p)).digest()==h,'PROTECTED_CHANGED'
 print('INTIMACY_DISTINCT_KEYS_LIVE 22x10=true prompt_one_phrase_only paid_cache_preserved model_calls=0',flush=True)
except BaseException:
 for p in reversed(changed):
  try:write(remote(p),saved[p]);print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
