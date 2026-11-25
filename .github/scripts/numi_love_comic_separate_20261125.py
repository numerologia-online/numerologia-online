import ftplib,hashlib,io,os,pathlib,ssl,subprocess,urllib.request,urllib.error,time,json
base='ccf57f9a5a79658394391b2dec08e1c6dc19e4d9'
pre_slots='ee691fccf24e861d8f8afc3b5a022ec1d63bcfe5'
files=["account-service/private/love-comic-verdict.php","account-service/private/love-comic-verdict.json","account-service/private/love-live.php","redflag-ai-lab/love-owner-preview-api.php","account-service/private/redflag-catalog.json","redflag-public-catalog.js","redflag-text-bank.js","redflag-categories.js","redflag-feature.js","app.js","index.html"]
fresh=["account-service/private/love-comic-verdict.php","account-service/private/love-comic-verdict.json"]
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files if p not in fresh}
for p in files:
 if p.endswith('.php'):subprocess.run(['php','-l',p],check=True)
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
def public(b):return json.loads(b.decode().split('export const PUBLIC_QUESTIONS = ',1)[1].strip().removesuffix(';'))
a,b=public(old['redflag-public-catalog.js']),public(new['redflag-public-catalog.js'])
for k,v in a.items():
 assert b[k]==v if k!='love' else b[k][:-1]==v[:-1]
assert b['love'][-1]=={'id':'comic-verdict-love','title':'😂 Шуточный вердикт','priceRub':49,'status':'ready'}
a,b=[json.loads(x)['questions'] for x in [old['account-service/private/redflag-catalog.json'],new['account-service/private/redflag-catalog.json']]]
assert b['love'].pop('comic-verdict-love')=={'tier':49,'free':False,'ready':True} and a==b
assert json.loads(new[fresh[1]])['keys']==json.loads(pathlib.Path('account-service/private/love-first-step-humor.json').read_bytes())['keys']
fixture=r"""<?php
require 'account-service/private/love-comic-verdict.php';
require 'account-service/private/love-live.php';
if(!function_exists('naCatalogDate')){function naCatalogDate($date){return $date;}}
$ids=lvpQuestionIds();
if(count($ids)!==10||count(lvpQuestions())!==10||count(lvlQuestions())!==11||count(lvlMapIds())!==10)throw new RuntimeException('CATALOG');
foreach([[1,1,1986],[3,3,1990],[9,9,1986],[15,7,1988],[29,2,2000]] as [$d,$m,$y]){
 $msg=lcvMessages($d,$m,$y);$p=json_decode($msg[1]['content'],true,30,JSON_THROW_ON_ERROR);
 $matrix=ni31($d,$m,$y);$keys=lcvKeys();
 foreach(lvpPointMap('first-step') as $i=>$point)if($p['четыре_юмористические_подсказки'][$i]['подсказка']!==$keys[$matrix[$point]])throw new RuntimeException('KEYS');
 if(count($p['четыре_юмористические_подсказки'])!==4)throw new RuntimeException('POINTS');
}
if(!lvlSupportedPaidResource('redflag_question','redflag:love:comic-verdict-love:1986-09-09'))throw new RuntimeException('ROUTE');
echo "COMIC_OFFLINE_PASS 22 keys four points separate system prompt; model calls 0\n";
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
protected=['account-service/private/love-practical-engine.php','account-service/private/love-practical-knowledge.txt','account-service/private/love-live-questions.json','account-service/private/core.php','account-service/private/wallet-real-payment.php','account-service/private/intimacy-live.php','account-service/public/numi-love-free.php']
for p in protected:assert pathlib.Path(p).read_bytes()==subprocess.check_output(['git','show',base+':'+p]),p
def get(p):
 req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p,headers={'Cache-Control':'no-cache'})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,b''
def health():
 codes=[get(x)[0] for x in ['', 'redflag-ai-lab/style-test-api.php','redflag-ai-lab/love-owner-preview-api.php','api/numi-love-free.php']]
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
  elif p=='account-service/private/redflag-catalog.json' and before[p] not in (old[p],new[p]):
   live=json.loads(before[p]);original=json.loads(old[p])
   assert live['questions'].get('love')==original['questions']['love'],'LIVE_LOVE_CATALOG_DIFFERS'
   live['questions']['love']['comic-verdict-love']={'tier':49,'free':False,'ready':True}
   new[p]=(json.dumps(live,ensure_ascii=False,separators=(',',':'))+'\n').encode()
  else:
   fallback=subprocess.check_output(['git','show',pre_slots+':'+p]) if not p.startswith(('account-service/','redflag-ai-lab/')) else old[p]
   assert before[p] in (old[p],new[p],fallback),'LIVE_DIFFERS_'+p
 backup=home+'/site-safeguard-backups'
 try:f.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if before[p] is not None:write(backup+'/before-separate-love-comic-'+tag+'-'+p.rsplit('/',1)[-1],before[p])
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
   if p=='redflag-public-catalog.js':assert public(body)['love'][-1]['status']=='ready' and all(len(v)==11 for v in public(body).values())
   else:assert b'love-comic-separate-20261125' in body,'HTTP_VERSION_'+p
 except BaseException:
  for p in reversed(changed):
   if before[p] is None:f.delete(remote(p))
   else:write(remote(p),before[p])
  raise
 print('LOVE_COMIC_LIVE isolated eleventh question; original ten prompts and keys untouched; existing payment engine untouched; model calls 0',flush=True)
