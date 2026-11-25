import ftplib,hashlib,io,os,pathlib,ssl,subprocess,urllib.request,urllib.error,time,json
base='dfe4799095df033ddd0e4e7a73c0c35d1605d154'
files=["account-service/private/love-comic-verdict.json"]
fresh=[]
patches={}
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files if p not in fresh}
def public(b):return json.loads(b.decode().split('export const PUBLIC_QUESTIONS = ',1)[1].strip().removesuffix(';'))
a=json.loads(old["account-service/private/love-comic-verdict.json"]);b=json.loads(new["account-service/private/love-comic-verdict.json"]);assert set(a['keys'])==set(b['keys']) and len(b['keys'])==22
for key in ['9','16']:a['keys'][key]=b['keys'][key]
assert a==b
for p in files:
 if p.endswith('.php'):subprocess.run(['php','-l',p],check=True)
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
fixture=r"""<?php
require 'account-service/private/love-comic-verdict.php';
require 'account-service/private/love-live.php';
if(!function_exists('naCatalogDate')){function naCatalogDate($d){return $d;}}
$messages=lcvMessages(31,10,1987);
$p=json_decode($messages[1]['content'],true,20,JSON_THROW_ON_ERROR);
$matrix=ni31(31,10,1987);
if(count($p['три_юмористические_подсказки'])!==3)throw new RuntimeException('POINTS');
foreach(['left','top','right'] as $i=>$point)if($p['три_юмористические_подсказки'][$i]['подсказка']!==lcvKeys()[$matrix[$point]])throw new RuntimeException('KEYS');
$sample=str_repeat('Он любит конкретику — это смешной пример. ',7)."\n\n".'Вот и всё.';
$expected=lcvValidate($sample);
if(str_contains($expected,"\n")||preg_match('/[—–―]/u',$expected))throw new RuntimeException('FORMAT');
$body=json_encode(['choices'=>[['finish_reason'=>'stop','message'=>['content'=>$sample]]]],JSON_UNESCAPED_UNICODE);
if(niCloudAnswer($body,200,'test',null,'lcvValidate')!==$expected)throw new RuntimeException('TRANSPORT');
$normal=str_repeat('Обычный ответ для проверки. ',12)."\n\n".str_repeat('Обычный второй абзац. ',12);
if(niCloudAnswer(json_encode(['choices'=>[['finish_reason'=>'stop','message'=>['content'=>$normal]]]]),200,'test')!==niValidateGeneratedText($normal,'stop'))throw new RuntimeException('DEFAULT_CHANGED');
if(count(lvpQuestions())!==10||count(lcvKeys())!==22||!lvlSupportedPaidResource('redflag_question','redflag:love:comic-verdict-love:1987-10-31'))throw new RuntimeException('ROUTE');
$short=str_repeat('Он любит конкретику. ',8);
if(mb_strlen($short,'UTF-8')>=220||lcvValidate($short)!==trim($short))throw new RuntimeException('SHORT_USABLE_REJECTED');
$long=str_repeat('Он всё решает сам и даже согласия иногда не спрашивает. ',20);
$out=lcvValidate($long);
if(mb_strlen($out,'UTF-8')<300||mb_strlen($out,'UTF-8')>700||!str_ends_with($out,'.')||lcvValidate($out)!==$out)throw new RuntimeException('LONG_SENTENCE_TRIM');
if(lcvValidate($out)!==$out)throw new RuntimeException('CACHE_IDEMPOTENCE');
try{lcvValidate('Модель недоступна');throw new LogicException('SERVICE_NOTICE_ACCEPTED');}catch(RuntimeException $e){if($e->getMessage()!=='PROVIDER_MODEL_UNAVAILABLE')throw $e;}
echo "LOVE_COMIC_LENGTH_OFFLINE_PASS short accepted long shortened provider errors preserved no model calls\n";
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
protected=["account-service/private/love-comic-verdict.php","account-service/private/love-practical-engine.php","account-service/private/love-practical-knowledge.txt","account-service/private/love-live.php","account-service/private/intimacy-live.php","redflag-ai-lab/love-owner-preview-api.php","account-service/private/redflag-catalog.json","redflag-public-catalog.js","account-service/private/wallet-real-payment.php"]
for p in protected:assert pathlib.Path(p).read_bytes()==subprocess.check_output(['git','show',base+':'+p]),p
def get(p):
 req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p,headers={'Cache-Control':'no-cache'})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,b''
def health():
 codes=[get(x)[0] for x in ['', 'redflag-ai-lab/love-owner-preview-api.php','redflag-ai-lab/keep.php','api/numi-love-free.php']]
 assert codes[:3]==[200,403,403] and codes[3] in (400,401,403,405),codes
 print('SITE_HEALTH',codes,flush=True)
health()
with ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45) as f:
 f.connect('server172.hosting.reg.ru',21);f.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);f.prot_p()
 home=f.pwd().rstrip('/');private=home+'/private/numi-account-20261031/';web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
 def remote(p):
  if p.startswith('account-service/private/'):return private+p.rsplit('/',1)[-1]
  if p.startswith('account-service/public/'):return web+'api/'+p.rsplit('/',1)[-1]
  return web+p
 def read(p):
  buf=io.BytesIO();f.retrbinary('RETR '+p,buf.write);return buf.getvalue()
 def optional(p):
  try:return read(p)
  except ftplib.error_perm as e:
   if not str(e).startswith('550'):raise
   return None
 def write(p,b):
  f.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b
 before={p:optional(remote(p)) for p in files}
 hashes={p:hashlib.sha256(read(remote(p))).digest() for p in protected}
 for p in files:
  if p in fresh:assert before[p] in (None,new[p]),'UNEXPECTED_NEW_'+p
  elif before[p] not in (old[p],new[p]):
   raise RuntimeError('LIVE_DIFFERS_'+p)
  if p.endswith('.php'):subprocess.run(['php','-l'],input=new[p],check=True)
  if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
 backup=home+'/site-safeguard-backups'
 try:f.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if before[p] is not None:write(backup+'/before-love-comic-keys-'+tag+'-'+p.rsplit('/',1)[-1],before[p])
 changed=[]
 try:
  for p in files:
   assert optional(remote(p))==before[p],'CONCURRENT_CHANGE'
   if before[p]!=new[p]:changed.append(p);write(remote(p),new[p])
  for p in files:assert read(remote(p))==new[p]
  for p,v in hashes.items():assert hashlib.sha256(read(remote(p))).digest()==v,'PROTECTED_CHANGE'
  health()
  for p in files:
   if p.startswith(('account-service/','redflag-ai-lab/')):continue
   code,body=get(('' if p=='index.html' else p)+'?check='+tag)
   assert code==200,'HTTP_'+p
   if p=='redflag-public-catalog.js':assert all(len(v)==11 and all(q['status']=='ready' for q in v) for v in public(body).values())
   else:assert b'love-comic-short-20261125' in body,'HTTP_VERSION_'+p
 except BaseException:
  for p in reversed(changed):
   if before[p] is None:f.delete(remote(p))
   else:write(remote(p),before[p])
  raise
 print('LOVE_COMIC_KEYS_LIVE only keys 9 and 16 updated; no model calls',flush=True)
