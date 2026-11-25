import ftplib,hashlib,io,os,pathlib,ssl,subprocess,urllib.request,urllib.error,time
base='938547d6929249054add6f940b4161331ad6cecb'
endpoint='redflag-ai-lab/love-owner-preview-api.php'
files=['account-service/private/love-live.php']
new={p:pathlib.Path(p).read_bytes() for p in files}
old=subprocess.check_output(['git','show',base+':'+files[0]])
protected=['account-service/private/love-practical-engine.php','account-service/private/love-practical-knowledge.txt','account-service/private/love-live-questions.json','account-service/private/love-first-step-humor.php','account-service/private/love-first-step-humor.json','account-service/private/intimacy-live.php',endpoint,'account-service/public/numi-love-free.php']
for p in protected:
 assert pathlib.Path(p).read_bytes()==subprocess.check_output(['git','show',base+':'+p]),p
for p in [files[0],endpoint,'account-service/private/love-first-step-humor.php']:subprocess.run(['php','-l',p],check=True)
fixture=r"""<?php
require 'account-service/private/love-first-step-humor.php';
require 'account-service/private/love-live.php';
if(!function_exists('naCatalogDate')){function naCatalogDate($date){return $date;}}
if(!str_ends_with(lvlCacheFile('first-step','1986-09-09'),'-love-humor-v1.json'))throw new RuntimeException('FIRST_STEP_CACHE');
foreach(lvlMapIds() as $paid)if(!str_ends_with(lvlCacheFile($paid,'1986-09-09'),'-love-v1.json'))throw new RuntimeException('PAID_CACHE_CHANGED');
$src=file_get_contents('account-service/private/love-live.php');
if(!str_contains($src,'$text=lvhGenerate($selected,$d,$m,$y);'))throw new RuntimeException('PUBLIC_ROUTING');
$keys=lvhKeys();$qs=lvpQuestions();
foreach($qs as $q)foreach([[1,1,1986],[3,3,1990],[9,9,1986],[15,7,1988],[29,2,2000]] as [$d,$m,$y]){
 $a=lvpMessages($q,$d,$m,$y);$b=lvhMessages($q,$d,$m,$y);
 if($q['id']!=='first-step'){if($a!==$b)throw new RuntimeException('OTHER_QUESTION_CHANGED');continue;}
 if($a[0]!==$b[0])throw new RuntimeException('PROMPT_CHANGED');
 $p=json_decode($b[1]['content'],true,30,JSON_THROW_ON_ERROR);
 $orig=json_decode($a[1]['content'],true,30,JSON_THROW_ON_ERROR);
 $matrix=ni31($d,$m,$y);
 foreach(lvpPointMap($q['id']) as $i=>$point)if($p['четыре_юмористические_подсказки'][$i]['подсказка']!==$keys[$matrix[$point]])throw new RuntimeException('WRONG_KEY');
 unset($p['четыре_юмористические_подсказки'],$p['отдельная_задача_только_для_шуточного_вердикта']);
 if($p!==$orig)throw new RuntimeException('ORIGINAL_PAYLOAD_CHANGED');
}
$first=str_repeat('Он может первым пригласить на встречу и продолжить общение. ',10);
$second='Ещё я бы посмотрела «'.lvpFollowups('first-step')[0]['вопрос'].'».';
$formatted=lvhFormat($first."\nШуточный вердикт: Романтика на связи!\n\n".$second);
if(count(explode("\n\n",$formatted))!==2||!str_contains($formatted,'Шуточный вердикт: Романтика на связи!'))throw new RuntimeException('FORMAT');
echo "LOVE_HUMOR_OFFLINE_PASS 22 keys; first-step only; system prompt unchanged; 2 paragraphs; model calls 0\n";
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
def status(path):
 try:
  with urllib.request.urlopen('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+path,timeout=25) as r:return r.status
 except urllib.error.HTTPError as e:return e.code
def health():
 out=[status(''),status(endpoint),status('api/numi-love-free.php')]
 print('HEALTH',out,flush=True)
 assert out[0]==200 and out[1]==403 and out[2] in (400,401,403,405)
health()
with ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45) as f:
 f.connect('server172.hosting.reg.ru',21);f.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);f.prot_p()
 home=f.pwd().rstrip('/');private=home+'/private/numi-account-20261031/';web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
 def remote(p):return private+p.rsplit('/',1)[-1] if p.startswith('account-service/private/') else web+p
 def read(p):
  b=io.BytesIO();f.retrbinary('RETR '+p,b.write);return b.getvalue()
 def optional(p):
  try:return read(p)
  except ftplib.error_perm as e:
   if not str(e).startswith('550'):raise
   return None
 def write(p,b):
  f.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b
 before={p:optional(remote(p)) for p in files}
 assert before[files[0]] in (old,new[files[0]]),'LIVE_ENGINE_DIFFERS'
 hashes={p:hashlib.sha256(read(remote(p))).digest() for p in protected if p!='account-service/public/numi-love-free.php'}
 for p in ['account-service/private/love-first-step-humor.php','account-service/private/love-first-step-humor.json',endpoint]:assert read(remote(p))==pathlib.Path(p).read_bytes(),'HUMOR_DEPENDENCY_DIFFERS'
 backup=home+'/site-safeguard-backups'
 try:f.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p,b in before.items():
  if b is not None:write(backup+'/before-love-humor-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',b)
 changed=[]
 try:
  for p in files:
   assert optional(remote(p))==before[p],'CONCURRENT_CHANGE'
   if before[p]!=new[p]:
    changed.append(p);write(remote(p),new[p])
  for p in files:assert read(remote(p))==new[p]
  for p,v in hashes.items():assert hashlib.sha256(read(remote(p))).digest()==v,'PROTECTED_CHANGE'
  health()
 except BaseException:
  for p in reversed(changed):
   if before[p] is None:f.delete(remote(p))
   else:write(remote(p),before[p])
  raise
 print('LOVE_HUMOR_PUBLIC_LIVE first-step only; owner and visitor; paid cache preserved; model calls 0',flush=True)
