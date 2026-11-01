import pathlib,json,hashlib,ftplib,ssl,os,io,urllib.request,urllib.error,re,time
R=pathlib.Path(__file__).resolve().parent;c=json.loads((R/'private-source.json').read_text());m=json.loads((R/'manifest.json').read_text())
f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40);f.connect('server172.hosting.reg.ru',21);f.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);f.prot_p();home=f.pwd().rstrip('/');site=home+'/www/xn--c1adkkdfjbp1a4l.online/'
def read(p,missing=False):
 b=io.BytesIO()
 try:f.retrbinary('RETR '+p,b.write)
 except ftplib.error_perm as e:
  if missing and str(e).startswith('550'):return None
  raise
 return b.getvalue()
def put(p,b):
 f.storbinary('STOR '+p,io.BytesIO(b))
 if read(p)!=b:raise RuntimeError('Checksum mismatch')
def digest(b):return hashlib.sha256(b).hexdigest()
try:
 token=re.search(rb'(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}',read(home+'/private/numi-secure-access/config.local.php'))
 if not token:raise RuntimeError('Private access unavailable')
 req=urllib.request.Request('https://api.github.com/repos/numerologia-online/numi-numi-on-private/contents/moment/yes-no/answers/man/yn-man-002.json?ref='+c['commit'],headers={'Authorization':'Bearer '+token[0].decode(),'Accept':'application/vnd.github.raw+json','User-Agent':'numi-second-approved-answer'})
 with urllib.request.urlopen(req,timeout=30) as r:answer=r.read(20000)
 if digest(answer)!=c['sha256']:raise RuntimeError('Private source checksum')
 data=json.loads(answer);assert data['question_id']=='yn-man-002' and set(data['answers'])==set(map(str,range(1,10)))
 private=home+'/private/numi-yesno-v1/answers/man/yn-man-002.json'
 new={private:answer,site+'api/numi-yesno-answer.php':(R/'numi-yesno-answer.php').read_bytes(),site+'moment/yes-no/yes-no.js':(R/'yes-no.js').read_bytes(),site+'moment/yes-no/index.html':(R/'index.html').read_bytes()}
 old={p:read(p,True) for p in new}
 for p,b in old.items():
  if p==private:
   if b is not None and b!=answer:raise RuntimeError('Second answer already exists')
  elif b!=new[p] and (b is None or digest(b)!=m[p.removeprefix(site)]):raise RuntimeError('Live code changed')
 backup=home+'/site-safeguard-backups/yesno-second-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime());f.mkd(backup)
 for i,(p,b) in enumerate(old.items()):
  if b is not None:put(backup+'/'+str(i)+'.bak',b)
 touched=[]
 try:
  for p,b in new.items():touched.append(p);put(p,b)
  f.sendcmd('SITE CHMOD 600 '+private)
  def api(q,t):
   try:
    with urllib.request.urlopen('https://xn--c1adkkdfjbp1a4l.online/api/numi-yesno-answer.php?question='+q+'&time='+t+'&verify='+str(time.time_ns()),timeout=25) as r:return r.status,json.load(r)
   except urllib.error.HTTPError as e:return e.code,json.load(e)
  for i in range(1,10):
   code,result=api('yn-man-002','00:0'+str(i));assert code==200 and result.get('answer')==data['answers'][str(i)]
  first=json.loads(read(home+'/private/numi-yesno-v1/answers/man/yn-man-001.json'))
  for i in range(1,10):
   code,result=api('yn-man-001','00:0'+str(i));assert code==200 and result.get('answer')==first['answers'][str(i)]
  assert api('yn-man-003','00:01')[0]==404
  assert api('yn-man-002','00:00')[0]==422
  assert api('yn-man-002','25:99')[0]==400
  assert api('../yn-man-002','00:01')[0]==404
  for name,path in [('yes-no.js','moment/yes-no/yes-no.js'),('index.html','moment/yes-no/index.html')]:
   with urllib.request.urlopen('https://xn--c1adkkdfjbp1a4l.online/'+path+'?verify='+str(time.time_ns()),timeout=25) as r:assert r.read()==(R/name).read_bytes()
  print('SECOND_ANSWER_RELEASE_SUCCESS 18 live answers and invalid inputs verified',flush=True)
 except BaseException:
  for p in reversed(touched):
   if old[p] is None:f.delete(p)
   else:put(p,old[p])
  raise
finally:f.quit()
