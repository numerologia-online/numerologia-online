import pathlib,json,hashlib,ftplib,ssl,os,io,urllib.request,re,time
R=pathlib.Path(__file__).resolve().parent
c=json.loads((R/'private-source.json').read_text())
f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
f.connect('server172.hosting.reg.ru',21);f.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);f.prot_p();home=f.pwd().rstrip('/')
def read(p):
 b=io.BytesIO();f.retrbinary('RETR '+p,b.write);return b.getvalue()
def put(p,b):
 f.storbinary('STOR '+p,io.BytesIO(b))
 if read(p)!=b:raise RuntimeError('Upload checksum mismatch')
def digest(b):return hashlib.sha256(b).hexdigest()
try:
 config=read(home+'/private/numi-secure-access/config.local.php')
 token=re.search(rb'(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}',config)
 if not token:raise RuntimeError('Private access unavailable')
 req=urllib.request.Request('https://api.github.com/repos/numerologia-online/numi-numi-on-private/contents/moment/yes-no/answers/man/yn-man-001.json?ref='+c['commit'],headers={'Authorization':'Bearer '+token[0].decode(),'Accept':'application/vnd.github.raw+json','User-Agent':'numi-approved-answer-revision'})
 with urllib.request.urlopen(req,timeout=30) as r:new=r.read(20000)
 if digest(new)!=c['sha256']:raise RuntimeError('Source checksum mismatch')
 data=json.loads(new)
 assert data['question_id']=='yn-man-001' and set(data['answers'])==set(map(str,range(1,10)))
 assert all(not re.search(r'[^А-Яа-яЁё .,]',s) for s in data['answers'].values())
 p=home+'/private/numi-yesno-v1/answers/man/yn-man-001.json';old=read(p)
 if digest(old) not in (c['old_sha256'],c['sha256']):raise RuntimeError('Live answers changed')
 backup=home+'/site-safeguard-backups/yesno-answer-revision-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime());f.mkd(backup);put(backup+'/yn-man-001.json.bak',old)
 try:
  put(p,new);f.sendcmd('SITE CHMOD 600 '+p)
  for i in range(1,10):
   with urllib.request.urlopen('https://xn--c1adkkdfjbp1a4l.online/api/numi-yesno-answer.php?question=yn-man-001&time=00:0'+str(i)+'&verify='+str(time.time_ns()),timeout=25) as r:result=json.load(r)
   if result.get('answer')!=data['answers'][str(i)]:raise RuntimeError('Live answer mismatch '+str(i))
  print('ANSWER_REVISION_SUCCESS all nine live answers verified',flush=True)
 except BaseException:
  put(p,old);raise
finally:f.quit()
