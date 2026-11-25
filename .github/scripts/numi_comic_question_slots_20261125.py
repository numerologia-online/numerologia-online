import ftplib,hashlib,io,os,pathlib,ssl,subprocess,urllib.request,urllib.error,time,json
base='ee691fccf24e861d8f8afc3b5a022ec1d63bcfe5'
files=["redflag-public-catalog.js","redflag-text-bank.js","redflag-categories.js","redflag-feature.js","app.js","index.html"]
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files}
def catalog(b):
 return json.loads(b.decode().split('export const PUBLIC_QUESTIONS = ',1)[1].strip().removesuffix(';'))
a,b=catalog(old[files[0]]),catalog(new[files[0]])
assert len(a)==len(b)==8 and a['money']==b['money']
for k,v in a.items():
 assert len(b[k])==11
 if k!='money':
  assert len(v)==10 and b[k][:-1]==v
  assert b[k][-1]=={'id':'comic-verdict-'+k,'title':'😂 Шуточный вердикт','status':'comic-pending'}
assert old[files[0]].split(b'export const PUBLIC_QUESTIONS = ')[0]==new[files[0]].split(b'export const PUBLIC_QUESTIONS = ')[0]
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
assert b'if(question.status==="comic-pending")return false;' in new['redflag-feature.js']
assert b'isComingSoon: question.status==="comic-pending" ||' in new['redflag-feature.js']
protected=['account-service/private/love-practical-engine.php','account-service/private/love-practical-knowledge.txt','account-service/private/love-live.php','redflag-ai-lab/love-owner-preview-api.php','account-service/private/core.php','account-service/private/wallet-real-payment.php','account-service/public/numi-love-free.php']
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
 def write(p,b):
  f.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b
 before={p:read(remote(p)) for p in files}
 hashes={p:hashlib.sha256(read(remote(p))).digest() for p in protected}
 for p in files:
  assert before[p] in (old[p],new[p]),'LIVE_DIFFERS_'+p
 backup=home+'/site-safeguard-backups'
 try:f.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:write(backup+'/before-comic-questions-'+tag+'-'+p,before[p])
 changed=[]
 try:
  for p in files:
   assert read(remote(p))==before[p],'CONCURRENT_CHANGE'
   if before[p]!=new[p]:changed.append(p);write(remote(p),new[p])
  for p in files:assert read(remote(p))==new[p]
  for p,v in hashes.items():assert hashlib.sha256(read(remote(p))).digest()==v,'PROTECTED_CHANGE'
  health()
  for p in files:
   code,body=get(('' if p=='index.html' else p)+'?check='+tag)
   assert code==200,'HTTP_'+p
   if p==files[0]:assert all(len(v)==11 for v in catalog(body).values())
   else:assert b'comic-questions-20261125' in body,'HTTP_VERSION_'+p
 except BaseException:
  for p in reversed(changed):write(remote(p),before[p])
  raise
 print('COMIC_QUESTIONS_LIVE eight sections eleven questions; existing eighty plus money comic untouched; seven pending; no payments or model calls',flush=True)
