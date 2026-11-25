import ftplib,hashlib,io,os,pathlib,ssl,subprocess,urllib.request,urllib.error,time,json
base='b49baeaebdc00c3ac3bc27c30947bcd2185a5dc8'
files=["account-service/private/language-comic-verdict.php","account-service/private/language-comic-verdict.json","account-service/private/language-live.php","account-service/private/redflag-catalog.json","redflag-public-catalog.js","redflag-text-bank.js","redflag-categories.js","redflag-feature.js","app.js","index.html"]
fresh=["account-service/private/language-comic-verdict.php","account-service/private/language-comic-verdict.json"]
patches={}
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files if p not in fresh}
def public(b):return json.loads(b.decode().split('export const PUBLIC_QUESTIONS = ',1)[1].strip().removesuffix(';'))
a,b=public(old['redflag-public-catalog.js']),public(new['redflag-public-catalog.js'])
for k,v in a.items():assert b[k]==v if k!='language' else b[k][:-1]==v[:-1]
assert b['language'][-1]=={'id':'comic-verdict-language','title':'😂 Шуточный вердикт','priceRub':49,'status':'ready'}
a,b=[json.loads(x)['questions'] for x in [old['account-service/private/redflag-catalog.json'],new['account-service/private/redflag-catalog.json']]]
assert b['language'].pop('comic-verdict-language')=={'tier':49,'free':False,'ready':True} and a==b
for p in files:
 if p.endswith('.php'):subprocess.run(['php','-l',p],check=True)
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
fixture=r"""<?php
require 'account-service/private/language-comic-verdict.php';
if(!function_exists('naCatalogDate')){function naCatalogDate($date){return $date;}}
if(count(nlQuestionIds())!==10||count(nlQuestions())!==10)throw new RuntimeException('CATALOG');
foreach([[1,1,1986],[3,3,1990],[9,9,1986],[15,7,1988],[29,2,2000]] as [$d,$m,$y]){
 $msg=wcvMessages($d,$m,$y);$p=json_decode($msg[1]['content'],true,30,JSON_THROW_ON_ERROR);
 $matrix=ni31($d,$m,$y);$keys=wcvKeys();
 foreach(nlPointMap('love-language') as $i=>$point)if($p['четыре_позиции'][$i]['подсказка']!==$keys[$matrix[$point]])throw new RuntimeException('KEYS');
 if(count($p['четыре_позиции'])!==4)throw new RuntimeException('POINTS');
}
if(!nlSupportedPaidResource('redflag_question','redflag:language:comic-verdict-language:1986-09-09'))throw new RuntimeException('ROUTE');
echo "LANGUAGE_COMIC_OFFLINE_PASS 22 keys four points separate prompt; model calls 0\n";
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
protected=["account-service/private/language-live-knowledge.txt","account-service/private/language-live-questions.json","account-service/private/core.php","account-service/private/wallet-real-payment.php","account-service/private/family-live.php","account-service/private/family-comic-verdict.php","account-service/private/family-comic-verdict.json","account-service/private/intimacy-comic-verdict.php","account-service/private/intimacy-comic-verdict.json","account-service/public/numi-owner-material.php","account-service/public/numi-language-free.php"]
for p in protected:assert pathlib.Path(p).read_bytes()==subprocess.check_output(['git','show',base+':'+p]),p
def get(p):
 req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p,headers={'Cache-Control':'no-cache'})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,b''
def health():
 codes=[get(x)[0] for x in ['', 'api/numi-owner-material.php','redflag-ai-lab/keep.php','api/numi-language-free.php']]
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
 assert public(before['redflag-public-catalog.js'])['family'][-1]['status']=='in-progress','PREVIOUS_FAMILY_NOT_LIVE'
 hashes={p:hashlib.sha256(read(remote(p))).digest() for p in protected}
 for p in files:
  if p in fresh:assert before[p] in (None,new[p]),'UNEXPECTED_NEW_'+p
  elif before[p] not in (old[p],new[p]):
   if p=='account-service/private/redflag-catalog.json':
    live=json.loads(before[p]);original=json.loads(old[p])
    expected=original['questions']['language'].copy()
    expected['comic-verdict-language']={'tier':49,'free':False,'ready':True}
    assert live['questions']['language'] in (original['questions']['language'],expected),'LIVE_LANGUAGE_CATALOG_DIFFERS'
    live['questions']['language']=expected
    new[p]=(json.dumps(live,ensure_ascii=False,separators=(',',':'))+'\n').encode()
   else:raise RuntimeError('LIVE_DIFFERS_'+p)
  if p.endswith('.php'):subprocess.run(['php','-l'],input=new[p],check=True)
  if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
 backup=home+'/site-safeguard-backups'
 try:f.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if before[p] is not None:write(backup+'/before-language-comic-'+tag+'-'+p.rsplit('/',1)[-1],before[p])
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
   if p=='redflag-public-catalog.js':assert public(body)['language'][-1]['status']=='ready' and all(len(v)==11 for v in public(body).values())
   else:assert b'language-comic-separate-20261125' in body,'HTTP_VERSION_'+p
 except BaseException:
  for p in reversed(changed):
   if before[p] is None:f.delete(remote(p))
   else:write(remote(p),before[p])
  raise
 print('LANGUAGE_COMIC_LIVE isolated eleventh question; existing prompts and keys unchanged; no model calls',flush=True)
