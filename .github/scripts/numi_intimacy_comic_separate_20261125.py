import ftplib,hashlib,io,os,pathlib,ssl,subprocess,urllib.request,urllib.error,time,json
base='c3f34e642fa9c6027adda1483c12c5a93355843c'
files=["account-service/private/intimacy-comic-verdict.php","account-service/private/intimacy-comic-verdict.json","account-service/private/intimacy-live.php","redflag-ai-lab/intimacy-practical-preview-api.php","redflag-ai-lab/keep.php","account-service/private/redflag-catalog.json","redflag-public-catalog.js","redflag-text-bank.js","redflag-categories.js","redflag-feature.js","app.js","index.html"]
fresh=["account-service/private/intimacy-comic-verdict.php","account-service/private/intimacy-comic-verdict.json"]
patches=json.loads("{\"account-service/private/intimacy-live.php\":[[\"return ['her-pleasure','pace','desire-talk','tenderness','boundaries','closeness','initiative','compatibility','after'];\",\"return ['her-pleasure','pace','desire-talk','tenderness','boundaries','closeness','initiative','compatibility','after','comic-verdict-intimacy'];\"],[\"        if($selected===null)throw new RuntimeException('INTIMACY_QUESTION_NOT_FOUND');\\n        $text=niGenerateText($selected,$d,$m,$y,$cat);\",\"        if($id==='comic-verdict-intimacy'){\\n            require_once __DIR__.'/intimacy-comic-verdict.php';\\n            $text=scvGenerate($d,$m,$y);\\n        }else{\\n            if($selected===null)throw new RuntimeException('INTIMACY_QUESTION_NOT_FOUND');\\n            $text=niGenerateText($selected,$d,$m,$y,$cat);\\n        }\"],[\"    $title='';\\n    foreach(niQuestions() as $q)\",\"    $title=$m[1]==='comic-verdict-intimacy'?'😂 Шуточный вердикт':'';\\n    foreach(niQuestions() as $q)\"]],\"redflag-ai-lab/intimacy-practical-preview-api.php\":[[\"!in_array($id,ipQuestionIds(),true)\",\"!in_array($id,array_merge(ipQuestionIds(),['comic-verdict-intimacy']),true)\"],[\"    if($question===null)ioReply(400,['ok'=>false,'error'=>'INTIMACY_QUESTION_NOT_FOUND']);\",\"    if($id==='comic-verdict-intimacy')$question=['id'=>$id,'title'=>'😂 Шуточный вердикт'];\\n    if($question===null)ioReply(400,['ok'=>false,'error'=>'INTIMACY_QUESTION_NOT_FOUND']);\"],[\"    $answer=ipGenerateText($question,$day,$month,$year);\",\"    if($id==='comic-verdict-intimacy'){\\n        require_once dirname(__DIR__,3).'/private/numi-account-20261031/intimacy-comic-verdict.php';\\n        $answer=scvGenerate($day,$month,$year);\\n    }else{\\n        $answer=ipGenerateText($question,$day,$month,$year);\\n    }\"]],\"redflag-ai-lab/keep.php\":[[\"    if (!$found)rfKeepReply(400,['ok'=>false,'error'=>'UNPUBLISHED_QUESTION_REQUIRED']);\",\"    if ($category==='intimacy'&&$id==='comic-verdict-intimacy')$found=true;\\n    if (!$found)rfKeepReply(400,['ok'=>false,'error'=>'UNPUBLISHED_QUESTION_REQUIRED']);\"]],\"redflag-public-catalog.js\":[[\"\\\"id\\\": \\\"comic-verdict-intimacy\\\",\\n      \\\"title\\\": \\\"😂 Шуточный вердикт\\\",\\n      \\\"status\\\": \\\"comic-pending\\\"\",\"\\\"id\\\": \\\"comic-verdict-intimacy\\\",\\n      \\\"title\\\": \\\"😂 Шуточный вердикт\\\",\\n      \\\"priceRub\\\": 49,\\n      \\\"status\\\": \\\"ready\\\"\"]],\"redflag-text-bank.js\":[[\"infidelity-comic-separate-20261125\",\"intimacy-comic-separate-20261125\"]],\"redflag-categories.js\":[[\"infidelity-comic-separate-20261125\",\"intimacy-comic-separate-20261125\"]],\"redflag-feature.js\":[[\"infidelity-comic-separate-20261125\",\"intimacy-comic-separate-20261125\"]],\"app.js\":[[\"infidelity-comic-separate-20261125\",\"intimacy-comic-separate-20261125\"]],\"index.html\":[[\"infidelity-comic-separate-20261125\",\"intimacy-comic-separate-20261125\"]]}")
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files if p not in fresh}
def public(b):return json.loads(b.decode().split('export const PUBLIC_QUESTIONS = ',1)[1].strip().removesuffix(';'))
a,b=public(old['redflag-public-catalog.js']),public(new['redflag-public-catalog.js'])
for k,v in a.items():assert b[k]==v if k!='intimacy' else b[k][:-1]==v[:-1]
assert b['intimacy'][-1]=={'id':'comic-verdict-intimacy','title':'😂 Шуточный вердикт','priceRub':49,'status':'ready'}
a,b=[json.loads(x)['questions'] for x in [old['account-service/private/redflag-catalog.json'],new['account-service/private/redflag-catalog.json']]]
assert b['intimacy'].pop('comic-verdict-intimacy')=={'tier':49,'free':False,'ready':True} and a==b
for p in files:
 if p.endswith('.php'):subprocess.run(['php','-l',p],check=True)
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
fixture=r"""<?php
require 'account-service/private/intimacy-comic-verdict.php';
if(!function_exists('naCatalogDate')){function naCatalogDate($date){return $date;}}
if(count(ipQuestionIds())!==10||count(ipQuestions())!==10||count(niQuestions())!==10||count(niMapIds())!==10)throw new RuntimeException('CATALOG');
foreach([[1,1,1986],[3,3,1990],[9,9,1986],[15,7,1988],[29,2,2000]] as [$d,$m,$y]){
 $msg=scvMessages($d,$m,$y);$p=json_decode($msg[1]['content'],true,30,JSON_THROW_ON_ERROR);
 $matrix=ni31($d,$m,$y);$keys=scvKeys();
 foreach(ipPointMap('fire') as $i=>$point)if($p['четыре_позиции'][$i]['подсказка']!==$keys[$matrix[$point]])throw new RuntimeException('KEYS');
 if(count($p['четыре_позиции'])!==4)throw new RuntimeException('POINTS');
}
if(!niSupportedPaidResource('redflag_question','redflag:intimacy:comic-verdict-intimacy:1986-09-09')||niSupportedPaidResource('redflag_question','redflag:intimacy:comic-verdict-intimacy:2020-09-09'))throw new RuntimeException('ROUTE_AGE');
try{scvMessages(9,9,2020);throw new RuntimeException('AGE_BYPASS');}catch(InvalidArgumentException $e){}
echo "INTIMACY_COMIC_OFFLINE_PASS 22 keys four points age restriction separate prompt; model calls 0\n";
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
protected=["account-service/private/intimacy-practical-engine.php","account-service/private/intimacy-practical-knowledge.txt","account-service/private/intimacy-live-questions.json","account-service/private/core.php","account-service/private/wallet-real-payment.php","account-service/private/love-comic-verdict.php","account-service/private/love-comic-verdict.json","account-service/private/flags-comic-verdict.php","account-service/private/flags-comic-verdict.json","account-service/private/infidelity-comic-verdict.php","account-service/private/infidelity-comic-verdict.json","account-service/public/numi-intimacy-free.php","redflag-ai-lab/catalog.json"]
for p in protected:assert pathlib.Path(p).read_bytes()==subprocess.check_output(['git','show',base+':'+p]),p
def get(p):
 req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p,headers={'Cache-Control':'no-cache'})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,b''
def health():
 codes=[get(x)[0] for x in ['', 'redflag-ai-lab/intimacy-practical-preview-api.php','redflag-ai-lab/keep.php','api/numi-intimacy-free.php']]
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
    expected=original['questions']['intimacy'].copy()
    expected['comic-verdict-intimacy']={'tier':49,'free':False,'ready':True}
    assert live['questions']['intimacy'] in (original['questions']['intimacy'],expected),'LIVE_INTIMACY_CATALOG_DIFFERS'
    live['questions']['intimacy']=expected
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
  if before[p] is not None:write(backup+'/before-intimacy-comic-'+tag+'-'+p.rsplit('/',1)[-1],before[p])
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
   if p=='redflag-public-catalog.js':assert public(body)['intimacy'][-1]['status']=='ready' and all(len(v)==11 for v in public(body).values())
   else:assert b'intimacy-comic-separate-20261125' in body,'HTTP_VERSION_'+p
 except BaseException:
  for p in reversed(changed):
   if before[p] is None:f.delete(remote(p))
   else:write(remote(p),before[p])
  raise
 print('INTIMACY_COMIC_LIVE isolated eleventh question; existing prompts and keys unchanged; no model calls',flush=True)
