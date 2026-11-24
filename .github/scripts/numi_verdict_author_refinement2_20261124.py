import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib,json,tempfile
base='01f175198ff60782310bb6d55f526385e73f9d6f'
files=json.loads("[\"account-service/private/verdict-owner-knowledge-v1.txt\",\"account-service/private/verdict-live.php\"]")
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files}
def lint(p,b):
 if p.endswith('.php'):
  with tempfile.NamedTemporaryFile(suffix='.php') as f:
   f.write(b);f.flush();subprocess.run(['php','-l',f.name],check=True)
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=b,check=True)
 if p.endswith('.json'):json.loads(b)
for p,b in new.items():lint(p,b)
a=old['account-service/private/verdict-owner-knowledge-v1.txt'].decode().splitlines()
b=new['account-service/private/verdict-owner-knowledge-v1.txt'].decode().splitlines()
assert len(a)==len(b)==23
assert [i for i,(x,y) in enumerate(zip(a,b)) if x!=y]==[12,13,14,16,17,20,21,22],'UNRELATED_ENERGY_CHANGED'
assert all(a[i]==b[i] for i in range(23) if i not in (12,13,14,16,17,20,21,22))
assert len(set(v for row in b[1:] for v in row.split('|')[1:]))==220
assert all(len(b[i].split('|'))==11 for i in range(1,23))
assert len(new['account-service/private/verdict-owner-knowledge-v1.txt'].decode())<=16000

fixture=r"""<?php
require 'account-service/private/verdict-live.php';
function naCatalogDate($s){if(!is_string($s)||!preg_match('/^\d{4}-\d\d-\d\d$/D',$s))return null;[$y,$m,$d]=array_map('intval',explode('-',$s));return checkdate($m,$d,$y)?$s:null;}
$kb=vpKnowledge();$questions=vpQuestions();
if(count($kb)!==22||count($questions)!==10||count($kb[4])!==10)throw new RuntimeException('KB');
foreach($questions as $q){
 $id=$q['id'];
 foreach([[31,10,1988],[4,4,1986],[9,9,1986],[15,7,1987],[6,6,1996],[7,7,1997],[8,8,1988],[10,10,1990],[11,11,1999]] as [$d,$m,$y]){
  $matrix=ni31($d,$m,$y);$points=vpPointMap($id);
  $p=json_decode(vpMessages($q,$d,$m,$y)[1]['content'],true,30,JSON_THROW_ON_ERROR);
  foreach($points as $i=>$point)if($p['четыре_значимые_позиции'][$i]['смысловой_ключ']!==$kb[$matrix[$point]][$id])throw new RuntimeException('KEY');
 }
}
foreach(range(1,23) as $n)foreach($kb[$n] as $value)if(mb_strlen($value,'UTF-8')>100)throw new RuntimeException('LENGTH');
foreach([[31,10,1988],[4,4,1986],[9,9,1986],[15,7,1987],[6,6,1996],[7,7,1997],[8,8,1988],[10,10,1990],[11,11,1999]] as [$d,$m,$y]){
 $date=sprintf('%04d-%02d-%02d',$y,$m,$d);
 $matrix=ni31($d,$m,$y);$suffix='-verdict-v1.json';
 $points=array_map(static fn($point)=>$matrix[$point],vpPointMap('final'));
 if(array_intersect($points,[12,13,14,16,17,20,21,22]))$suffix='-verdict-author-refinement-v9.json';
 elseif(array_intersect($points,[9,10,11]))$suffix='-verdict-author-refinement-v8.json';
 elseif(array_intersect($points,[5,6,8,18,19]))$suffix='-verdict-author-refinement-v7.json';
 elseif(array_intersect($points,[1,2,3,5]))$suffix='-verdict-author-refinement-v6.json';
 elseif(array_intersect($points,[6,7,8,9,10]))$suffix='-verdict-distinct-questions-v5.json';
 elseif(in_array(4,$points,true))$suffix='-verdict-energy4-v2.json';
 if(!str_ends_with(nvCacheFile('final',$date),$suffix))throw new RuntimeException('CACHE');
 if(!str_ends_with(nvCacheFile('check',$date),'-verdict-v1.json'))throw new RuntimeException('PAID_CACHE');
}
echo 'VERDICT_AUTHOR_REFINEMENT4_OFFLINE_PASS';
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
  assert saved[p] in (old[p],new[p]), 'REMOTE_CONTENT_DIFFERS_'+p
  lint(p,new[p])
 protected=[private+x for x in ['core.php','wallet-real-payment.php','fulfillment.php','redflag-catalog.json','store-assets.json','verdict-practical-engine.php','verdict-owner-questions.json','love-practical-engine.php','love-practical-knowledge.txt','love-live.php','language-live.php','family-live.php','intimacy-live.php']]
 hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
 backup=home+'/site-safeguard-backups'
 try:ftp.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if saved[p]!=new[p]:write(backup+'/before-verdict-author-refinement4-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',saved[p])
 for p in files:
  assert read(remote(p))==saved[p],'CONCURRENT_EDIT'
  if saved[p]!=new[p]:changed.append(p);write(remote(p),new[p])
 assert healthy(),'POST_HEALTH'
 for p in files:assert read(remote(p))==new[p],'FINAL_READBACK'
 for p,h in hashes.items():assert hashlib.sha256(read(p)).digest()==h,'PROTECTED_CHANGED'
 print('VERDICT_AUTHOR_REFINEMENT4_LIVE eight_rows_only paid_cache_preserved model_calls=0',flush=True)
except BaseException:
 for p in reversed(changed):
  try:write(remote(p),saved[p]);print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
