import pathlib,json,hashlib,ftplib,ssl,os,io,urllib.request,urllib.error,re,time,subprocess
R=pathlib.Path(__file__).resolve().parent;DOMAIN='xn--c1adkkdfjbp1a4l.online'
def digest(b):return hashlib.sha256(b).hexdigest() if b is not None else None
def main():
 control=json.loads((R/'private-source.json').read_text());manifest=json.loads((R/'live-manifest.json').read_text())
 ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40);ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();home=ftp.pwd().rstrip('/');site=home+'/www/'+DOMAIN
 def read(p):
  b=io.BytesIO()
  try:ftp.retrbinary('RETR '+p,b.write)
  except ftplib.error_perm as e:
   if str(e).startswith('550'):return None
   raise
  return b.getvalue()
 def mkdir(p):
  current=''
  for part in pathlib.PurePosixPath(p).parts:
   if part=='/':continue
   current+='/'+part
   try:ftp.mkd(current)
   except ftplib.error_perm as e:
    if not str(e).startswith('550'):raise
 def write(p,b):
  mkdir(str(pathlib.PurePosixPath(p).parent));ftp.storbinary('STOR '+p,io.BytesIO(b))
  if read(p)!=b:raise RuntimeError('Upload verification '+p.rsplit('/',1)[-1])
 try:
  config=read(home+'/private/numi-secure-access/config.local.php') or b''
  token=re.search(rb'(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}',config)
  if not token:raise RuntimeError('Private repository access unavailable')
  url='https://api.github.com/repos/numerologia-online/numi-numi-on-private/contents/moment/yes-no/answers/man/yn-man-001.json?ref='+control['commit']
  req=urllib.request.Request(url,headers={'Authorization':'Bearer '+token[0].decode(),'Accept':'application/vnd.github.raw+json','User-Agent':'numi-approved-answer-release'})
  with urllib.request.urlopen(req,timeout=30) as response:answer=response.read(20000)
  if digest(answer)!=control['sha256']:raise RuntimeError('Private answer checksum mismatch')
  (R/'yn-man-001.json').write_bytes(answer);subprocess.run(['python3',str(R/'tests/verify.py')],check=True)
  private=home+'/private/numi-yesno-v1/answers/man/yn-man-001.json'
  desired={private:answer,site+'/api/numi-yesno-answer.php':(R/'public/numi-yesno-answer.php').read_bytes(),site+'/moment/yes-no/yes-no.js':(R/'public/yes-no.js').read_bytes(),site+'/moment/yes-no/index.html':(R/'public/index.html').read_bytes()}
  old={p:read(p) for p in desired}
  for p in desired:
   rel=p.removeprefix(site+'/')
   if rel in manifest and digest(old[p])!=manifest[rel] and old[p]!=desired[p]:raise RuntimeError('Live file changed '+rel)
   if rel not in manifest and old[p] is not None and old[p]!=desired[p]:raise RuntimeError('New target already exists')
  backup=home+'/site-safeguard-backups/yesno-first-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime());mkdir(backup)
  for i,(p,b) in enumerate(old.items()):
   if b is not None:write(backup+'/'+str(i)+'.bak',b)
  touched=[]
  try:
   for p,b in desired.items():touched.append(p);write(p,b)
   ftp.sendcmd('SITE CHMOD 600 '+private)
   for rel in ['moment/yes-no/yes-no.js','moment/yes-no/index.html']:
    with urllib.request.urlopen('https://'+DOMAIN+'/'+rel+'?approved_answer='+str(time.time_ns()),timeout=25) as x:
     if x.read()!=desired[site+'/'+rel]:raise RuntimeError('Public checksum '+rel)
   for number in range(1,10):
    with urllib.request.urlopen('https://'+DOMAIN+'/api/numi-yesno-answer.php?question=yn-man-001&time=00:0'+str(number),timeout=25) as x:result=json.load(x)
    if result.get('answer')!=json.loads(answer)['answers'][str(number)]:raise RuntimeError('Live answer mismatch')
   try:urllib.request.urlopen('https://'+DOMAIN+'/private/numi-yesno-v1/answers/man/yn-man-001.json',timeout=20);raise RuntimeError('Private file exposed')
   except urllib.error.HTTPError as e:
    if e.code not in (403,404):raise
   print('APPROVED_ANSWER_RELEASE '+json.dumps({'success':True,'answers_verified':9,'private_storage':True,'backup':backup.rsplit('/',1)[-1]}),flush=True)
  except BaseException:
   for p in reversed(touched):
    if old[p] is None:ftp.delete(p)
    else:write(p,old[p])
   raise
 finally:ftp.quit()
if __name__=='__main__':main()
