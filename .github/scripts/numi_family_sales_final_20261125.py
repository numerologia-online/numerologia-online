import ftplib,hashlib,io,os,pathlib,ssl,subprocess,urllib.request,urllib.error,time,json
base='882fefc2f213ab6781e5dee0f1569571b0d04e89'
files=["account-service/private/family-live.php","account-service/private/redflag-catalog.json","redflag-public-catalog.js","redflag-text-bank.js","redflag-categories.js","redflag-feature.js","app.js","index.html"]
fresh=[]
patches={}
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files if p not in fresh}
def public(b):return json.loads(b.decode().split('export const PUBLIC_QUESTIONS = ',1)[1].strip().removesuffix(';'))
a,b=public(old['redflag-public-catalog.js']),public(new['redflag-public-catalog.js'])
for k,v in a.items():assert b[k]==v if k!='family' else b[k][:-1]==v[:-1]
assert b['family'][-1]=={'id':'comic-verdict-family','title':'😂 Шуточный вердикт','priceRub':49,'status':'ready'}
a,b=[json.loads(x)['questions'] for x in [old['account-service/private/redflag-catalog.json'],new['account-service/private/redflag-catalog.json']]]
assert b['family'].pop('comic-verdict-family')=={'tier':49,'free':False,'ready':True} and a==b
for p in files:
 if p.endswith('.php'):subprocess.run(['php','-l',p],check=True)
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
fixture=r"""<?php
require 'account-service/private/family-live.php';
require 'account-service/private/family-comic-verdict.php';
require 'account-service/private/flags-fidelity-live.php';
require 'account-service/private/love-live.php';
require 'account-service/private/language-live.php';
require 'account-service/private/verdict-live.php';
if(!function_exists('naCatalogDate')){function naCatalogDate($date){return $date;}}
if(count(fpQuestionIds())!==10||count(fpQuestions())!==10||count(nfQuestions())!==10)throw new RuntimeException('CATALOG');
$cat=json_decode(file_get_contents('account-service/private/redflag-catalog.json'),true,30,JSON_THROW_ON_ERROR)['questions'];
$paid=0;$free=0;
foreach($cat as $section=>$qs){
 if(count($qs)!==11)throw new RuntimeException('CATALOG_COUNT_'.$section);
 foreach($qs as $id=>$q){
  if($q['ready']!==true)throw new RuntimeException('NOT_READY_'.$section.'_'.$id);
  if($q['free']){$free++;continue;}
  $res='redflag:'.$section.':'.$id.':1986-09-09';
  $ok=match($section){
    'family'=>nfSupportedPaidResource('redflag_question',$res),
    'language'=>nlSupportedPaidResource('redflag_question',$res),
    'flags','infidelity'=>rfsSupportedPaidResource('redflag_question',$res),
    'love'=>lvlSupportedPaidResource('redflag_question',$res),
    'intimacy'=>niSupportedPaidResource('redflag_question',$res),
    'verdict'=>nvSupportedPaidResource('redflag_question',$res),
    'money'=>true,
    default=>false
  };
  if(!$ok)throw new RuntimeException('ROUTE_'.$section.'_'.$id);
  $paid++;
 }
}
if($paid!==80||$free!==8)throw new RuntimeException('COUNTS');
foreach(fpQuestions() as $q){
 $msg=fpMessages($q,9,9,1986);
 if(count($msg)!==2)throw new RuntimeException('FAMILY_MESSAGES');
}
$msg=hcvMessages(9,9,1986);
if(count($msg)!==2||count(hcvKeys())!==22)throw new RuntimeException('COMIC_MESSAGES');
echo "ALL_88_CARDS 80_paid 8_free native_routes_checked no_model_calls\n";
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
protected=["account-service/private/family-practical-engine.php","account-service/private/family-owner-knowledge-v1.txt","account-service/private/family-live-questions.json","account-service/private/family-comic-verdict.php","account-service/private/family-comic-verdict.json","account-service/private/core.php","account-service/private/wallet-real-payment.php","account-service/private/fulfillment.php","account-service/public/numi-family-free.php","redflag-ai-lab/family-owner-preview-api.php"]
for p in protected:assert pathlib.Path(p).read_bytes()==subprocess.check_output(['git','show',base+':'+p]),p
def get(p):
 req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p,headers={'Cache-Control':'no-cache'})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,b''
def health():
 codes=[get(x)[0] for x in ['', 'redflag-ai-lab/family-owner-preview-api.php','redflag-ai-lab/keep.php','api/numi-family-free.php']]
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
 assert public(before['redflag-public-catalog.js'])['verdict'][-1]['status']=='ready','PREVIOUS_VERDICT_NOT_LIVE'
 hashes={p:hashlib.sha256(read(remote(p))).digest() for p in protected}
 for p in protected[:5]:assert hashes[p]==hashlib.sha256(pathlib.Path(p).read_bytes()).digest(),'APPROVED_FAMILY_DRIFT_'+p
 for p in files:
  if p in fresh:assert before[p] in (None,new[p]),'UNEXPECTED_NEW_'+p
  elif before[p] not in (old[p],new[p]):
   if p=='account-service/private/redflag-catalog.json':
    live=json.loads(before[p]);original=json.loads(old[p])
    expected=original['questions']['family'].copy()
    expected['comic-verdict-family']={'tier':49,'free':False,'ready':True}
    assert live['questions']['family'] in (original['questions']['family'],expected),'LIVE_FAMILY_CATALOG_DIFFERS'
    live['questions']['family']=expected
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
  if before[p] is not None:write(backup+'/before-family-sales-'+tag+'-'+p.rsplit('/',1)[-1],before[p])
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
   else:assert b'family-sales-final-20261125' in body,'HTTP_VERSION_'+p
 except BaseException:
  for p in reversed(changed):
   if before[p] is None:f.delete(remote(p))
   else:write(remote(p),before[p])
  raise
 print('FAMILY_SALES_LIVE all 88 public cards ready; existing prompts and keys unchanged; no model calls',flush=True)
