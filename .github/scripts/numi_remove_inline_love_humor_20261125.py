import ftplib,hashlib,io,os,pathlib,ssl,subprocess,urllib.request,urllib.error,time
base='6efc933cb9bc8b83e9de4e40d03301346bbe596b'
original='f431bd7711b3994af7ea8a5dedee9f4562966bc9'
files=["account-service/private/love-live.php","redflag-ai-lab/love-owner-preview-api.php","redflag-feature.js","app.js","index.html"]
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files}
for p in files[:3]:
 assert new[p]==subprocess.check_output(['git','show',original+':'+p]),p
for p in files[:2]:subprocess.run(['php','-l',p],check=True)
for p in files[2:4]:subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
assert b'love-original-20261125' in new['app.js'] and b'love-original-20261125' in new['index.html']
protected=['account-service/private/love-practical-engine.php','account-service/private/love-practical-knowledge.txt','account-service/private/love-live-questions.json','account-service/private/core.php','account-service/private/wallet-real-payment.php','redflag-public-catalog.js','account-service/public/numi-love-free.php']
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
  b=io.BytesIO();f.retrbinary('RETR '+p,b.write);return b.getvalue()
 def write(p,b):
  f.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b
 before={p:read(remote(p)) for p in files}
 hashes={p:hashlib.sha256(read(remote(p))).digest() for p in protected}
 for p in files:
  if before[p] not in (old[p],new[p]):
   # The preceding deploy can preserve unrelated server-only text. Reverse only the exact diff.
   import difflib
   a=old[p].decode().splitlines(keepends=True);b=new[p].decode().splitlines(keepends=True);actual=before[p].decode()
   for tag,i,j,k,l in reversed(difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes()):
    if tag=='equal':continue
    # Insertions need context; reject rather than guessing.
    lo=max(0,i-2);hi=min(len(a),j+2)
    source=''.join(a[lo:hi]);target=''.join(a[lo:i]+b[k:l]+a[j:hi])
    if actual.count(target)==1:continue
    assert actual.count(source)==1,'LIVE_ANCHOR_'+p
    actual=actual.replace(source,target,1)
   new[p]=actual.encode()
  if p.endswith('.php'):subprocess.run(['php','-l'],input=new[p],check=True)
  if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
 backup=home+'/site-safeguard-backups'
 try:f.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:write(backup+'/before-remove-inline-love-humor-'+tag+'-'+p.rsplit('/',1)[-1],before[p])
 changed=[]
 try:
  for p in files:
   assert read(remote(p))==before[p],'CONCURRENT_CHANGE'
   if before[p]!=new[p]:changed.append(p);write(remote(p),new[p])
  for p in files:assert read(remote(p))==new[p]
  for p,v in hashes.items():assert hashlib.sha256(read(remote(p))).digest()==v,'PROTECTED_CHANGE'
  health()
  for p,marker in [('index.html','app.js?v=love-original-20261125'),('app.js','redflag-feature.js?v=love-original-20261125')]:
   code,data=get(('' if p=='index.html' else p)+'?check='+tag)
   assert code==200 and marker.encode() in data,'LIVE_HTTP_'+p
 except BaseException:
  for p in reversed(changed):write(remote(p),before[p])
  raise
 print('LOVE_ORIGINAL_LIVE original first question restored; catalog and payments unchanged; model calls 0',flush=True)
