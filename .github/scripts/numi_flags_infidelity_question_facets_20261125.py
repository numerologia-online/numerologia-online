import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib,tempfile,json
base='bf928369f2ed42ed6cfdd621045a23720a6f7f3c'
fp='redflag-ai-lab/intimacy-knowledge-v1.json'
ip='redflag-ai-lab/infidelity-knowledge-v1.json'
ap='redflag-ai-lab/style-test-api.php'
files=[fp,ip,ap]
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files}
ids={fp:["say-no","care-or-control","hero","jealousy","argument","abuse-signal","support-or-cause","apology","weak-place","calm-or-swings"],ip:["faithful","options","flirt","trust","ex","temptation","physical-or-emotional","secrecy","return","after-mistake"]}
def lint(p,b):
 if p==ap:
  a=old[p].decode()
  anchor="'в_отношениях'=>$a['love']"
  replacement="'в_отношениях'=>$a['question_traits'][$id]??$a['love']"
  for name in ['rfOwnerSharpFlags','rfOwnerSharpInfidelity']:
   start=a.index('function '+name+'(')
   end=a.index('\nfunction ',start+1)
   body=a[start:end]
   assert body.count(anchor)==1
   a=a[:start]+body.replace(anchor,replacement)+a[end:]
  assert b==a.encode(),'UNRELATED_API_CHANGE'
  with tempfile.NamedTemporaryFile(suffix='.php') as f:
   f.write(b);f.flush();subprocess.run(['php','-l',f.name],check=True)
  return
 data=json.loads(b)
 values=[]
 assert list(data['arcana'])==[str(n) for n in range(1,23)]
 for row in data['arcana'].values():
  q=row.pop('question_traits')
  assert list(q)==ids[p]
  values.extend(q.values())
 assert data==json.loads(old[p]),'UNRELATED_DATA_CHANGE'
 assert len(values)==len(set(values))==220
 assert all(isinstance(v,str) and 0<len(v)<=160 for v in values)
for p,b in new.items():lint(p,b)
print('FLAGS_INFidelity_QUESTION_FACETS_OFFLINE_PASS 440_keys',flush=True)
def function_body(source,name):
 start=source.index('function '+name+'(')
 end=source.index('\nfunction ',start+1)
 return start,end,source[start:end]
def scoped_api(live):
 # Compare the two relevant functions byte-for-byte to the audited old/new code.
 # Do not overwrite unrelated server changes or modify routing.
 source=live.decode()
 baseline=old[ap].decode()
 desired=new[ap].decode()
 for name in ['rfOwnerSharpFlags','rfOwnerSharpInfidelity']:
  start,end,body=function_body(source,name)
  _,_,before=function_body(baseline,name)
  _,_,after=function_body(desired,name)
  assert body in (before,after),'LIVE_FUNCTION_DRIFT_'+name
  source=source[:start]+after+source[end:]
 for name in ['rfOwnerSharpFlags','rfOwnerSharpInfidelity']:
  assert function_body(source,name)[2]==function_body(desired,name)[2]
  # The active request path must still invoke the same generator.
  assert source.count('$answer='+name+'(')==1,'LIVE_ROUTE_DIFF_'+name
 with tempfile.NamedTemporaryFile(suffix='.php') as f:
  f.write(source.encode());f.flush();subprocess.run(['php','-l',f.name],check=True)
 print('LIVE_SCOPE_VERIFIED unrelated_server_bytes_preserved=true',flush=True)
 return source.encode()
def status(p):
 try:
  with urllib.request.urlopen('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?question_facets='+str(time.time_ns()),timeout=25) as r:return r.status
 except urllib.error.HTTPError as e:return e.code
def healthy():
 c=[status(''),status('redflag-ai-lab/style-test-api.php'),status('redflag-ai-lab/love-owner-preview-api.php')]
 print('SITE_HEALTH',c,flush=True)
 return c==[200,403,403]
assert healthy(),'PRE_HEALTH'
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/');private=home+'/private/numi-account-20261031/';web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
def remote(p):return private+p.rsplit('/',1)[-1] if p.startswith('account-service/private/') else web+p
def read(p):
 b=io.BytesIO();ftp.retrbinary('RETR '+p,b.write);return b.getvalue()
def write(p,b):
 ftp.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b,'READBACK'
saved={};changed=[]
try:
 for p in files:
  saved[p]=read(remote(p))
  if p==ap:
   new[p]=scoped_api(saved[p])
  else:
   assert saved[p] in (old[p],new[p]), 'REMOTE_CONTENT_DIFFERS_'+p
   lint(p,new[p])
 protected=[private+x for x in ['core.php','wallet-real-payment.php','fulfillment.php','redflag-catalog.json','store-assets.json','verdict-practical-engine.php','verdict-owner-knowledge-v1.txt','verdict-live.php','love-practical-engine.php','love-practical-knowledge.txt','love-live.php','language-live.php','language-live-knowledge.txt','family-live.php','family-practical-engine.php','family-live-questions.json','intimacy-live.php','intimacy-practical-knowledge.txt','family-owner-knowledge-v1.txt','intimacy-practical-engine.php','intimacy-live-questions.json','love-live-questions.json']]
 hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
 backup=home+'/site-safeguard-backups'
 try:ftp.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if saved[p]!=new[p]:write(backup+'/before-flags-infidelity-question-facets-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',saved[p])
 for p in files:
  assert read(remote(p))==saved[p],'CONCURRENT_EDIT'
  if saved[p]!=new[p]:changed.append(p);write(remote(p),new[p])
 assert healthy(),'POST_HEALTH'
 for p in files:assert read(remote(p))==new[p],'FINAL_READBACK'
 for p,h in hashes.items():assert hashlib.sha256(read(p)).digest()==h,'PROTECTED_CHANGED'
 print('FLAGS_INFidelity_QUESTION_FACETS_LIVE 440_keys prompt_unchanged matrix_unchanged owner_only model_calls=0',flush=True)
except BaseException:
 for p in reversed(changed):
  try:write(remote(p),saved[p]);print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
