import ftplib,hashlib,io,os,pathlib,ssl,subprocess,urllib.request,urllib.error,time,json
base='cd8f72e73d2e9a4ad0d2e5080f337ed753484756'
files=["account-service/private/flags-comic-verdict.php","account-service/private/flags-comic-verdict.json","account-service/private/flags-fidelity-live.php","redflag-ai-lab/style-test-api.php","redflag-ai-lab/keep.php","account-service/private/redflag-catalog.json","redflag-public-catalog.js","redflag-text-bank.js","redflag-categories.js","redflag-feature.js","app.js","index.html"]
fresh=["account-service/private/flags-comic-verdict.php","account-service/private/flags-comic-verdict.json"]
patches=json.loads("{\"account-service/private/flags-fidelity-live.php\":[[\"function rfsQuestion(string $category,string $id): ?array {\",\"function rfsQuestion(string $category,string $id): ?array {\\n    if($category==='flags'&&$id==='comic-verdict-flags')return ['id'=>$id,'title'=>'😂 Шуточный вердикт'];\"],[\"    return $category==='flags'?rfsFlagsMessages($q,$d,$m,$y,$c):rfsFidelityMessages($q,$d,$m,$y,$c);\",\"    if($category==='flags'&&$id==='comic-verdict-flags'){\\n        require_once __DIR__.'/flags-comic-verdict.php';\\n        return fcvMessages($d,$m,$y);\\n    }\\n    return $category==='flags'?rfsFlagsMessages($q,$d,$m,$y,$c):rfsFidelityMessages($q,$d,$m,$y,$c);\"]],\"redflag-ai-lab/style-test-api.php\":[[\"    if($question===null)rfPreviewReply(400,['ok'=>false,'error'=>'QUESTION_NOT_AVAILABLE']);\",\"    if(($category['id']??null)==='flags'&&($input['question_id']??null)==='comic-verdict-flags')$question=['id'=>'comic-verdict-flags','title'=>'😂 Шуточный вердикт'];\\n    if($question===null)rfPreviewReply(400,['ok'=>false,'error'=>'QUESTION_NOT_AVAILABLE']);\"],[\"        $answer=rfOwnerSharpFlags($question,$day,$month,$y,$catalog);\",\"        if($question['id']==='comic-verdict-flags'){\\n            require_once dirname(__DIR__,3).'/private/numi-account-20261031/flags-comic-verdict.php';\\n            $answer=fcvGenerate($day,$month,$y);\\n        }else{\\n            $answer=rfOwnerSharpFlags($question,$day,$month,$y,$catalog);\\n        }\"]],\"redflag-ai-lab/keep.php\":[[\"if ($category==='flags'&&$id==='say-no')$found=true;\",\"if ($category==='flags'&&in_array($id,['say-no','comic-verdict-flags'],true))$found=true;\"]],\"redflag-public-catalog.js\":[[\"\\\"id\\\": \\\"comic-verdict-flags\\\",\\n      \\\"title\\\": \\\"😂 Шуточный вердикт\\\",\\n      \\\"status\\\": \\\"comic-pending\\\"\",\"\\\"id\\\": \\\"comic-verdict-flags\\\",\\n      \\\"title\\\": \\\"😂 Шуточный вердикт\\\",\\n      \\\"priceRub\\\": 49,\\n      \\\"status\\\": \\\"ready\\\"\"]],\"redflag-text-bank.js\":[[\"love-comic-separate-20261125\",\"flags-comic-separate-20261125\"]],\"redflag-categories.js\":[[\"love-comic-separate-20261125\",\"flags-comic-separate-20261125\"]],\"redflag-feature.js\":[[\"love-comic-separate-20261125\",\"flags-comic-separate-20261125\"]],\"app.js\":[[\"love-comic-separate-20261125\",\"flags-comic-separate-20261125\"]],\"index.html\":[[\"love-comic-separate-20261125\",\"flags-comic-separate-20261125\"]]}")
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files if p not in fresh}
def public(b):return json.loads(b.decode().split('export const PUBLIC_QUESTIONS = ',1)[1].strip().removesuffix(';'))
a,b=public(old['redflag-public-catalog.js']),public(new['redflag-public-catalog.js'])
for k,v in a.items():assert b[k]==v if k!='flags' else b[k][:-1]==v[:-1]
assert b['flags'][-1]=={'id':'comic-verdict-flags','title':'😂 Шуточный вердикт','priceRub':49,'status':'ready'}
a,b=[json.loads(x)['questions'] for x in [old['account-service/private/redflag-catalog.json'],new['account-service/private/redflag-catalog.json']]]
assert b['flags'].pop('comic-verdict-flags')=={'tier':49,'free':False,'ready':True} and a==b
for p in files:
 if p.endswith('.php'):subprocess.run(['php','-l',p],check=True)
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
fixture=r"""<?php
require 'account-service/private/flags-comic-verdict.php';
if(!function_exists('naCatalogDate')){function naCatalogDate($date){return $date;}}
$c=rfsCatalog();if(count($c['categories'][0]['questions'])!==10||count($c['categories'][1]['questions'])!==10)throw new RuntimeException('CATALOG');
foreach([[1,1,1986],[3,3,1990],[9,9,1986],[15,7,1988],[29,2,2000]] as [$d,$m,$y]){
 $msg=fcvMessages($d,$m,$y);$p=json_decode($msg[1]['content'],true,30,JSON_THROW_ON_ERROR);
 $matrix=rfs31($d,$m,$y);$keys=fcvKeys();
 foreach(['left','top','right','center','loveHeart'] as $i=>$point)if($p['пять_позиций'][$i]['подсказка']!==$keys[$matrix[$point]])throw new RuntimeException('KEYS');
 if(count($p['пять_позиций'])!==5)throw new RuntimeException('POINTS');
}
if(!rfsSupportedPaidResource('redflag_question','redflag:flags:comic-verdict-flags:1986-09-09')||rfsSupportedPaidResource('redflag_question','redflag:infidelity:comic-verdict-flags:1986-09-09'))throw new RuntimeException('ROUTE');
if(rfsMessages('flags','comic-verdict-flags','1986-09-09')!==fcvMessages(9,9,1986))throw new RuntimeException('MESSAGES');
echo "FLAGS_COMIC_OFFLINE_PASS 22 keys five points separate prompt; model calls 0\n";
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
protected=['account-service/private/flags-live-knowledge.json','account-service/private/fidelity-live-knowledge.json','account-service/private/flags-fidelity-live-questions.json','account-service/private/core.php','account-service/private/wallet-real-payment.php','account-service/private/intimacy-live.php','account-service/private/love-comic-verdict.php','account-service/private/love-comic-verdict.json','account-service/public/numi-flags-fidelity-free.php','redflag-ai-lab/catalog.json']
for p in protected:assert pathlib.Path(p).read_bytes()==subprocess.check_output(['git','show',base+':'+p]),p
def get(p):
 req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p,headers={'Cache-Control':'no-cache'})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,b''
def health():
 codes=[get(x)[0] for x in ['', 'redflag-ai-lab/style-test-api.php','redflag-ai-lab/keep.php','api/numi-flags-fidelity-free.php']]
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
   if p=='account-service/private/redflag-catalog.json':
    live=json.loads(before[p]);original=json.loads(old[p])
    assert live['questions']['flags']==original['questions']['flags'],'LIVE_FLAGS_CATALOG_DIFFERS'
    live['questions']['flags']['comic-verdict-flags']={'tier':49,'free':False,'ready':True}
    new[p]=(json.dumps(live,ensure_ascii=False,separators=(',',':'))+'\n').encode()
   else:
    actual=before[p].decode()
    for a,b in patches[p]:
     if actual.count(b)==1:continue
     assert actual.count(a)==1,'LIVE_ANCHOR_'+p
     actual=actual.replace(a,b,1)
    new[p]=actual.encode()
  if p.endswith('.php'):subprocess.run(['php','-l'],input=new[p],check=True)
  if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
 backup=home+'/site-safeguard-backups'
 try:f.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if before[p] is not None:write(backup+'/before-flags-comic-'+tag+'-'+p.rsplit('/',1)[-1],before[p])
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
   if p=='redflag-public-catalog.js':assert public(body)['flags'][-1]['status']=='ready' and all(len(v)==11 for v in public(body).values())
   else:assert b'flags-comic-separate-20261125' in body,'HTTP_VERSION_'+p
 except BaseException:
  for p in reversed(changed):
   if before[p] is None:f.delete(remote(p))
   else:write(remote(p),before[p])
  raise
 print('FLAGS_COMIC_LIVE isolated eleventh question; existing prompts and keys unchanged; no model calls',flush=True)
