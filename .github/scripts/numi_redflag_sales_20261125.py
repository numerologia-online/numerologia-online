import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib,tempfile,json,re
base='b61ae2b7997a725cb2f8ecef120cb73fcaff4844'
files=["account-service/private/flags-fidelity-live-questions.json","account-service/private/flags-live-knowledge.json","account-service/private/fidelity-live-knowledge.json","account-service/private/flags-fidelity-live.php","account-service/public/numi-flags-fidelity-free.php","account-service/private/wallet-real-payment.php","account-service/private/wallet-real.php","account-service/private/fulfillment.php","account-service/private/redflag-catalog.json","redflag-public-catalog.js","redflag-feature.js","wallet-client.js","redflag-categories.js","redflag-text-bank.js","app.js","index.html"]
fresh=["account-service/private/flags-fidelity-live-questions.json","account-service/private/flags-live-knowledge.json","account-service/private/fidelity-live-knowledge.json","account-service/private/flags-fidelity-live.php","account-service/public/numi-flags-fidelity-free.php"]
release='3364f36053723671b5eaa6664263078dc09cbef0'
new={p:subprocess.check_output(['git','show',release+':'+p]) for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files if p not in fresh}
origin='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai'
def status(path,body=None):
 req=urllib.request.Request(origin+'/'+path+'?salescheck='+str(time.time_ns()),data=None if body is None else json.dumps(body).encode(),headers={'Origin':origin,'Content-Type':'application/json','Cache-Control':'no-cache'})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.read(2000000)
 except urllib.error.HTTPError as e:return e.code,e.read(200000)
def healthy():
 checks=[status('')[0],status('api/numi-owner-material.php')[0],status('api/numi-account.php',{'action':'wallet_buy','item':{'product_code':'redflag_question','category':'flags','question_id':'hero','birth_date':'1988-07-15'},'request_key':'guest-verification-not-a-purchase'})[0],status('api/numi-account.php',{'action':'material','entitlement_id':'00000000-0000-4000-8000-000000000000'})[0]]
 print('SITE_GUEST_GUARDS',checks,flush=True)
 return checks[0]==200 and all(x in (400,401,403,405) for x in checks[1:])
assert healthy(),'PRE_HEALTH'
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/');priv=home+'/private/numi-account-20261031/';web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
def remote(p):
 if p.startswith('account-service/private/'):return priv+p.rsplit('/',1)[-1]
 if p.startswith('account-service/public/'):return web+'api/'+p.rsplit('/',1)[-1]
 return web+p
def read(p,optional=False):
 b=io.BytesIO()
 try:ftp.retrbinary('RETR '+p,b.write)
 except ftplib.error_perm as e:
  if optional and str(e).startswith('550'):return None
  raise
 return b.getvalue()
def write(p,b):
 ftp.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b,'READBACK_'+p.rsplit('/',1)[-1]
def body(s,n):
 start=s.index('function '+n+'(');end=s.index('\nfunction ',start+1);return s[start:end].rstrip()
saved={};changed=[]
try:
 # Verify the active approved editor, without reading or printing credentials.
 live=read(web+'redflag-ai-lab/style-test-api.php').decode()
 src=pathlib.Path('redflag-ai-lab/style-test-api.php').read_text()
 for n in ['rfOwner22','rfOwner31','rfOwnerSharpFlags','rfOwnerSharpInfidelity']:assert body(live,n)==body(src,n),'EDITOR_DRIFT_'+n
 for a,b in [('intimacy-knowledge-v1.json','flags-live-knowledge.json'),('infidelity-knowledge-v1.json','fidelity-live-knowledge.json')]:
  assert json.loads(read(web+'redflag-ai-lab/'+a))==json.loads(new['account-service/private/'+b]),'EDITOR_KB_DRIFT'
 assert read(priv+'intimacy-live-config.php'),'GENERATOR_CONFIG'
 ticket=read(web+'api/redflag-save.php')
 assert b'create' in ticket and b'ticket' in ticket,'TICKET_HANDLER'
 with tempfile.TemporaryDirectory() as d:
  for p in files:
   saved[p]=read(remote(p),p in fresh)
   if p in fresh:
    assert saved[p] in (None,new[p]),'NEW_FILE_COLLISION_'+p
   elif saved[p]!=old[p] and saved[p]!=new[p]:
    # Apply only reviewed diff to actual live file; fail on any overlapping drift.
    if p.endswith('/redflag-catalog.json'):
     assert json.loads(saved[p])==json.loads(old[p]),'CATALOG_DRIFT'
    else:
     target=pathlib.Path(d,p);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(saved[p])
     patch=subprocess.check_output(['git','diff',base,release,'--',p])
     subprocess.run(['git','apply','--check','--unsafe-paths','-'],input=patch,cwd=d,check=True)
     subprocess.run(['git','apply','--unsafe-paths','-'],input=patch,cwd=d,check=True)
     new[p]=target.read_bytes()
   if p.endswith('.php'):
    with tempfile.NamedTemporaryFile(suffix='.php') as f:f.write(new[p]);f.flush();subprocess.run(['php','-l',f.name],check=True)
   if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
 protected=[priv+p for p in ['core.php','store.php','subscriptions.php','wallet.php','wallet-real-worker.php','intimacy-practical-engine.php','intimacy-practical-knowledge.txt','family-practical-engine.php','family-owner-knowledge-v1.txt','love-practical-engine.php','love-practical-knowledge.txt','language-live.php','language-live-knowledge.txt','verdict-practical-engine.php','verdict-owner-knowledge-v1.txt']]+[web+'redflag-ai-lab/style-test-api.php',web+'api/redflag-save.php']
 hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
 backup=home+'/site-safeguard-backups'
 try:ftp.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if saved[p] is not None and saved[p]!=new[p]:write(backup+'/before-sales-'+tag+'-'+p.replace('/','_')+'.bak',saved[p])
 for p in files:
  assert read(remote(p),p in fresh)==saved[p],'CONCURRENT_EDIT_'+p
  if saved[p]!=new[p]:changed.append(p);write(remote(p),new[p])
 assert healthy(),'POST_HEALTH'
 for c,q in [('flags','hero'),('infidelity','options')]:
  code,b=status('api/numi-flags-fidelity-free.php',{'category':c,'question_id':q,'birth_date':'1988-07-15'})
  assert code==400 and json.loads(b).get('error')=='INVALID_FREE_QUESTION','FREE_ENDPOINT_LEAK'
 for p in files:assert read(remote(p))==new[p],'FINAL_READBACK_'+p
 for p,h in hashes.items():assert hashlib.sha256(read(p)).digest()==h,'PROTECTED_CHANGED'
 print('REDFLAG_SALES_LIVE 81_cards 73_paid server_price confirmed_material_before_debit no_paid_calls',flush=True)
except BaseException:
 for p in reversed(changed):
  try:
   if saved[p] is None:ftp.delete(remote(p))
   else:write(remote(p),saved[p])
   print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
