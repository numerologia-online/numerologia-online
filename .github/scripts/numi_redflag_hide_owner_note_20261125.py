import ftplib,hashlib,io,os,pathlib,ssl,subprocess,urllib.request,urllib.error,time,json
base='d18805361e2b37a2a4b1d391645bcd380120da49'
files=["redflag-feature.js","app.js","index.html"]
fresh=[]
patches={}
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files if p not in fresh}
def public(b):return json.loads(b.decode().split('export const PUBLIC_QUESTIONS = ',1)[1].strip().removesuffix(';'))
for p in files:
 if p.endswith('.php'):subprocess.run(['php','-l',p],check=True)
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
s=new['redflag-feature.js'].decode()
assert 'Новый ИИ-ответ для проверки' not in s and 'redflag-owner-ai-label' not in s and 'Сохранённый черновик. Не новый ответ ИИ' not in s and 'Новый ИИ. Только для тебя' not in s
assert 'answer.append(text);' in s and 'panel.append(go,output);' in s
before=old['redflag-feature.js'].decode()
for start,end in [('const ownerDraftInScope=', 'async function verifyOwnerDraftAccess'),('async function verifyOwnerDraftAccess','window.addEventListener("numi:account-session-changed"')]:
 assert before.split(start,1)[1].split(end,1)[0]==s.split(start,1)[1].split(end,1)[0]
assert 'if(!response.ok)return;' in s
print('OWNER_NOTE_OFFLINE_PASS authorization unchanged; no model calls',flush=True)
protected=["account-service/private/love-comic-verdict.php","account-service/private/love-comic-verdict.json","account-service/private/love-practical-engine.php","account-service/private/family-live.php","account-service/private/redflag-catalog.json","redflag-public-catalog.js","account-service/private/wallet-real-payment.php","account-service/private/fulfillment.php","redflag-ai-lab/love-owner-preview-api.php","redflag-ai-lab/style-test-api.php","redflag-ai-lab/keep.php"]
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
  if before[p] is not None:write(backup+'/before-redflag-hide-owner-note-'+tag+'-'+p.rsplit('/',1)[-1],before[p])
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
   elif p=='redflag-feature.js':assert 'Новый ИИ-ответ для проверки'.encode() not in body and b'redflag-owner-ai-label' not in body and b'answer.append(text);' in body,'HTTP_OWNER_NOTE'
   else:assert b'redflag-hide-owner-note-20261125' in body,'HTTP_VERSION_'+p
 except BaseException:
  for p in reversed(changed):
   if before[p] is None:f.delete(remote(p))
   else:write(remote(p),before[p])
  raise
 print('OWNER_NOTE_REMOVED_LIVE frontend only; no model calls',flush=True)
