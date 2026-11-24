import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib,json,tempfile
base='9999162200852019e96259c7e8e1a71f42c88d44'
files=json.loads("[\"account-service/private/verdict-owner-knowledge-v1.txt\",\"account-service/private/verdict-live.php\"]")
rules=json.loads("{\"account-service/private/verdict-owner-knowledge-v1.txt\":[[\"4|Практичный, любит порядок, навязывает правила|При уважении разных привычек|Надёжность соседствует с придирками|Реакция на иной порядок и мнение|Не сдавать собственные решения|Признание ума, конкретные договорённости|Контроль, доказывает чужую неправоту|Решает практические задачи|Устойчивый союз с разделённой ответственностью|Если его правила важнее твоих потребностей\",\"4|Материальная опора, авторитет, стремление всё рассчитать за всех и установить свои правила|Создаёт стабильность, но трудно уступает и предпочитает жить по своим правилам|Достоинство в реальных поступках и достижениях, а не в статусе и показухе|Воплощает свои планы и держит слово или только убедительно рассуждает|Отличать ответственность от стремления распоряжаться твоей жизнью|Восхищение и гибкость; в тени — послушание без собственного мнения и границ|Страх нищеты, показная состоятельность, лишение женщины права решать самой|Щедрость, материальная поддержка, определённость, готовность брать решения на себя|Общие цели, взаимные уступки, уважение желаний и правил обоих|Решает за женщину даже то, что касается исключительно её собственной жизни\"]],\"account-service/private/verdict-live.php\":[[\"    // New generation never reads the former engine's cache.\\n    return nvCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).($id==='beauty-and-flag'?'-verdict-dignity-v2.json':'-verdict-v1.json');\",\"    // Refresh only free answers whose selected matrix positions include energy 4.\\n    // Already purchased paid answers retain their existing cache keys.\\n    $suffix=$id==='beauty-and-flag'?'-verdict-dignity-v2.json':'-verdict-v1.json';\\n    if($id==='final'){\\n        [$y,$m,$d]=array_map('intval',explode('-',$date));\\n        $matrix=ni31($d,$m,$y);\\n        foreach(vpPointMap($id) as $point)if($matrix[$point]===4){$suffix='-verdict-energy4-v2.json';break;}\\n    }\\n    return nvCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).$suffix;\"]]}")
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
assert [i for i,(x,y) in enumerate(zip(a,b)) if x!=y]==[4],'UNRELATED_ENERGY_CHANGED'
assert b[4].startswith('4|') and len(b[4].split('|'))==11

fixture=r"""<?php
require 'account-service/private/verdict-live.php';
function naCatalogDate($s){if(!is_string($s)||!preg_match('/^\d{4}-\d\d-\d\d$/D',$s))return null;[$y,$m,$d]=array_map('intval',explode('-',$s));return checkdate($m,$d,$y)?$s:null;}
$kb=vpKnowledge();$questions=vpQuestions();
if(count($kb)!==22||count($questions)!==10||count($kb[4])!==10)throw new RuntimeException('KB');
foreach($questions as $q){
 $id=$q['id'];
 foreach([[31,10,1988],[4,4,1986],[9,9,1986],[15,7,1987]] as [$d,$m,$y]){
  $matrix=ni31($d,$m,$y);$points=vpPointMap($id);
  $p=json_decode(vpMessages($q,$d,$m,$y)[1]['content'],true,30,JSON_THROW_ON_ERROR);
  foreach($points as $i=>$point)if($p['четыре_значимые_позиции'][$i]['смысловой_ключ']!==$kb[$matrix[$point]][$id])throw new RuntimeException('KEY');
 }
}
foreach($kb[4] as $value)if(mb_strlen($value,'UTF-8')>100)throw new RuntimeException('LENGTH');
foreach([[31,10,1988],[4,4,1986],[9,9,1986],[15,7,1987]] as [$d,$m,$y]){
 $date=sprintf('%04d-%02d-%02d',$y,$m,$d);
 $matrix=ni31($d,$m,$y);$has=false;
 foreach(vpPointMap('final') as $point)if($matrix[$point]===4)$has=true;
 if(str_ends_with(nvCacheFile('final',$date),'-verdict-energy4-v2.json')!==$has)throw new RuntimeException('CACHE');
 if(!str_ends_with(nvCacheFile('check',$date),'-verdict-v1.json'))throw new RuntimeException('PAID_CACHE');
}
echo 'VERDICT_ENERGY4_OFFLINE_PASS';
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
 protected=[private+x for x in ['core.php','wallet-real-payment.php','fulfillment.php','redflag-catalog.json','store-assets.json','love-practical-engine.php','love-practical-knowledge.txt','love-live.php','language-live.php','family-live.php','intimacy-live.php']]
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
 print('VERDICT_ENERGY4_LIVE ten_keys_only paid_cache_preserved model_calls=0',flush=True)
except BaseException:
 for p in reversed(changed):
  try:write(remote(p),saved[p]);print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
