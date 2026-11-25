import ftplib,hashlib,io,os,pathlib,ssl,subprocess,urllib.request,urllib.error,time,json
base='0fd9ff0d2269552ef5811c988603a9f48cac95ea'
files=["account-service/private/redflag-catalog.json","redflag-public-catalog.js","redflag-text-bank.js","redflag-categories.js","redflag-feature.js","app.js","index.html"]
fresh=[]
patches={}
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files if p not in fresh}
def public(b):return json.loads(b.decode().split('export const PUBLIC_QUESTIONS = ',1)[1].strip().removesuffix(';'))
for p in files:
 if p.endswith('.php'):subprocess.run(['php','-l',p],check=True)
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
a,b=public(old['redflag-public-catalog.js']),public(new['redflag-public-catalog.js'])
assert len(a)==len(b)==8 and a['money']==b['money']
for k in a:
 if k!='money':assert a[k][-1]['id']=='comic-verdict-'+k and b[k]==a[k][:-1] and len(b[k])==10
a,b=[json.loads(x)['questions'] for x in (old[files[0]],new[files[0]])]
assert a['money']==b['money']
for k in a:
 if k!='money':
  a[k]['comic-verdict-'+k]['ready']=False
assert a==b
fixture=r"""<?php
require 'account-service/private/core.php';
require_once 'account-service/private/store.php';
$catalog=json_decode(file_get_contents('account-service/private/redflag-catalog.json'),true)['questions'];
foreach($catalog as $section=>$qs){
 foreach($qs as $id=>$meta){
  $input=['product_code'=>'redflag_question','category'=>$section,'question_id'=>$id,'birth_date'=>'1986-09-09'];
  $q=naCatalogResolve($input,false);
  $expected=$meta['free']?'FREE_PREVIEW':($meta['ready']?'FULFILLMENT_NOT_CONNECTED':'AUTHOR_TEXT_NOT_CONFIRMED');
  if($q['availability']!==$expected)throw new RuntimeException('AVAILABILITY_'.$section.'_'.$id);
  if(!$meta['free']){
   $cart=naCartResolve([$input],false,fn($c,$r)=>false,[],fn($item)=>true);
   if($cart['items'][0]['sale_ready']!==$meta['ready'])throw new RuntimeException('SALE_GATE');
  }
 }
}
echo "HIDE_SEVEN_OFFLINE_PASS 81 visible 7 new purchases blocked; no model calls\n";
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
protected=["account-service/private/core.php","account-service/private/store.php","account-service/private/wallet-real-payment.php","account-service/private/wallet-real.php","account-service/private/fulfillment.php","account-service/private/love-comic-verdict.php","account-service/private/love-comic-verdict.json","account-service/private/flags-comic-verdict.php","account-service/private/infidelity-comic-verdict.php","account-service/private/intimacy-comic-verdict.php","account-service/private/family-comic-verdict.php","account-service/private/language-comic-verdict.php","account-service/private/verdict-comic-verdict.php","account-service/private/family-live.php"]
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
   if p==files[0]:assert json.loads(before[p]) in (json.loads(old[p]),json.loads(new[p])),'LIVE_CATALOG_DIFFERS'
   else:raise RuntimeError('LIVE_DIFFERS_'+p)
  if p.endswith('.php'):subprocess.run(['php','-l'],input=new[p],check=True)
  if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
 backup=home+'/site-safeguard-backups'
 try:f.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if before[p] is not None:write(backup+'/before-redflag-hide-seven-comic-'+tag+'-'+p.rsplit('/',1)[-1],before[p])
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
   if p=='redflag-public-catalog.js':
    c=public(body)
    assert c==public(new[p]) and len(c['money'])==11 and c['money'][-1]['id']=='comic-verdict-money' and all(len(v)==10 for k,v in c.items() if k!='money')
   else:assert b'redflag-hide-seven-comic-20261125' in body,'HTTP_VERSION_'+p
 except BaseException:
  for p in reversed(changed):
   if before[p] is None:f.delete(remote(p))
   else:write(remote(p),before[p])
  raise
 print('HIDE_SEVEN_LIVE 81 visible cards; money retained; no model calls',flush=True)
