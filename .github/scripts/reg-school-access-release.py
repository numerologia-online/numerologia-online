"""Scoped manual owner-only school release; no credentials or author content in logs."""
import concurrent.futures,ftplib,hashlib,io,json,os,pathlib,ssl,sys,time,urllib.error,urllib.request

HOST='server172.hosting.reg.ru'
DOMAIN='xn--c1adkkdfjbp1a4l.online'
MARKER=pathlib.Path('.github/numi-school-access-release.json')
BEGIN=b'# NUMI SCHOOL OWNER ACCESS BEGIN 2026-11-03'
HOME_OLD='<a class="school-home-button" href="./pro/schools/">Открыть самоучитель <span aria-hidden="true">→</span></a>'.encode()
HOME_NEW='<a class="school-home-button" href="./pro/schools/">8 школ нумерологии <span aria-hidden="true">→</span></a>'.encode()
SOURCES={
 '@private/gate.php':'server/school-access/private/gate.php',
 '@private/allowlist.json':'server/school-access/private/allowlist.json',
 '@private/offer.html':'server/school-access/private/offer.html',
 'assets/numi-school-access-20261103.css':'assets/numi-school-access-20261103.css',
 'assets/numi-school-access-20261103.js':'assets/numi-school-access-20261103.js',
 'api/numi-school.php':'server/school-access/public/numi-school.php',
 'pro/school/lesson/lesson.js':'pro/school/lesson/lesson.js',
 'pro/schools/index.html':'pro/schools/index.html',
 'index.html':None,
 'pro/school/.htaccess':'server/school-access/apache/matrix.htaccess',
 'pro/schools/.htaccess':'server/school-access/apache/catalog.htaccess',
}
def log(**data):print('NUMI_SCHOOL_RELEASE '+json.dumps(data,ensure_ascii=False,sort_keys=True),flush=True)
def sha(data):return hashlib.sha256(data).hexdigest() if data is not None else None
def http(path,body=None):
 headers={'Cache-Control':'no-cache','User-Agent':'numi-school-release/1.0','Origin':'https://'+DOMAIN}
 if body is not None:headers['Content-Type']='application/json'
 request=urllib.request.Request('https://'+DOMAIN+'/'+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
 try:response=urllib.request.urlopen(request,timeout=30)
 except urllib.error.HTTPError as error:response=error
 with response:return response.status,response.read(2_100_000),dict(response.headers)
def verify():
 for body in ({'action':'session'},{'action':'session','init_data':'owner=true'},{'action':'session','owner':True}):
  status,data,_=http('api/numi-school.php',body)
  if status!=200 or json.loads(data).get('owner') is not False:raise RuntimeError('Anonymous or forged owner status accepted')
 status,data,_=http('api/numi-school.php',{'action':'content','path':'pro/school/lessons/start.json','owner':True})
 if status!=403:raise RuntimeError('Anonymous lesson API access accepted')
 html=['pro/school/','pro/school/lesson/?id=start','pro/school/lesson/?id=base','pro/schools/classic/','pro/schools/classic/lesson/?id=hello','pro/schools/angel/']
 assets=['pro/school/school.js','pro/school/construction-model.js','pro/school/lessons/start.json','pro/school/lessons/base.json','pro/schools/classic/lessons/hello.json','pro/schools/classic/manifest.json','pro/schools/angel/index.html?owner=true']
 def check(path):
  status,data,headers=http(path)
  if path in html or path.endswith('owner=true'):
   if status!=200 or '150 ₽'.encode() not in data or 'school-subscription-offer'.encode() not in data:raise RuntimeError('Direct school page did not show subscription offer: '+path)
   if b'private, no-store' not in headers.get('Cache-Control','').encode():raise RuntimeError('School page may be publicly cached')
  elif status!=403:raise RuntimeError('Direct school source remains public: '+path)
  return True
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(check,html+assets))
 status,data,_=http('pro/schools/')
 if status!=200 or data.count('В разработке — пока недоступно'.encode())!=6:raise RuntimeError('Catalog readiness labels missing')
 status,data,_=http('')
 if status!=200 or HOME_NEW not in data:raise RuntimeError('Home school button missing')
 for path in ['pro/','child/','moment/','assets/numi-school-access-20261103.js','shared-offer.css']:
  if http(path)[0]!=200:raise RuntimeError('Unrelated public route changed: '+path)
 status,data,_=http('api/numi-paid-content.php',{'init_data':'','path':'pro/school/lessons/base.json'})
 if status!=401:raise RuntimeError('Existing paid API boundary changed')
 log(verified=True,anonymous_direct_routes=len(html)+len(assets),other_site_routes_preserved=True)
def run():
 release=json.loads(MARKER.read_text())
 if release.get('mode') not in ('preflight','publish'):raise RuntimeError('Invalid explicit school release mode')
 ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
 ftp.connect(HOST,21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
 home=ftp.pwd().rstrip('/');site=home+'/www/'+DOMAIN;private=home+'/private/numi-school-owner-20261103'
 def target(name):return private+'/'+name[len('@private/'):] if name.startswith('@private/') else site+'/'+name
 def read(path):
  out=io.BytesIO()
  def collect(chunk):
   if out.tell()+len(chunk)>2_100_000:raise RuntimeError('Remote file exceeds scope limit')
   out.write(chunk)
  try:ftp.retrbinary('RETR '+path,collect)
  except ftplib.error_perm as error:
   if str(error).startswith('550'):return None
   raise
  return out.getvalue()
 def mkdir(path):
  current=''
  for part in pathlib.PurePosixPath(path).parts:
   if part=='/':continue
   current+='/'+part
   try:ftp.mkd(current)
   except ftplib.error_perm as error:
    if not str(error).startswith('550'):raise
 def write(path,data):
  mkdir(str(pathlib.PurePosixPath(path).parent));ftp.storbinary('STOR '+path,io.BytesIO(data))
  if read(path)!=data:raise RuntimeError('Upload integrity mismatch')
 def install(path,data):
  staged=private+'/incoming/'+hashlib.sha256(path.encode()).hexdigest()+'.tmp'
  write(staged,data);mkdir(str(pathlib.PurePosixPath(path).parent));ftp.rename(staged,path)
  ftp.sendcmd('SITE CHMOD '+('600 ' if path.startswith(private+'/') else '644 ')+path)
  if read(path)!=data:raise RuntimeError('Installed file integrity mismatch')
 try:
  core=read(home+'/private/numi-content-reg-20261031/core.php') or b''
  account=read(home+'/private/numi-account-20261031/core.php') or b''
  if not all(s in core for s in (b'function numiTelegramUser',b'function numiPrivateRead',b'function numiIsOwner')):raise RuntimeError('Existing content owner verifier unavailable')
  account_functions={s.decode():s in account for s in (b'function naCurrent',b'function naTestOwner',b'function naDB')}
  if not all(account_functions.values()):
   log(account_core_present=bool(account),account_core_sha256=sha(account),account_functions=account_functions)
   raise RuntimeError('Existing management account verifier unavailable')
  originals={name:read(target(name)) for name in SOURCES}
  actual={name:sha(data) for name,data in originals.items()}
  expected=release.get('expected',{})
  if not isinstance(expected,dict) or set(expected)-set(SOURCES):raise RuntimeError('Invalid expected file scope')
  if any(actual[name]!=value for name,value in expected.items()):raise RuntimeError('Live reviewed source changed; nothing modified')
  if release['mode']=='preflight':
   log(preflight=True,expected=actual,owner_verifiers_available=True,files_modified=0);return
  if set(expected)!=set(SOURCES):raise RuntimeError('Every school release target requires a reviewed live version')
  prepared={}
  for name,source in SOURCES.items():
   old=originals[name]
   if name=='index.html':
    if old is None or old.count(HOME_OLD)!=1:raise RuntimeError('Exact home button not found')
    prepared[name]=old.replace(HOME_OLD,HOME_NEW,1)
   else:
    data=pathlib.Path(source).read_bytes()
    if len(data)>300000:raise RuntimeError('Source exceeds scope limit')
    if name.endswith('/.htaccess'):
     if old and (BEGIN in old or b'\x00' in old):raise RuntimeError('Existing school guard must be reviewed separately')
     data=data+b'\n'+(old or b'')
    prepared[name]=data
  backup=home+'/site-safeguard-backups/school-owner-'+str(int(time.time()))
  for name,data in originals.items():
   if data is not None:write(backup+'/'+hashlib.sha256(name.encode()).hexdigest()+'.original',data)
  write(backup+'/scope.json',json.dumps({'paths':list(SOURCES),'sha256':actual},sort_keys=True).encode())
  touched=[]
  try:
   for name,data in prepared.items():
    touched.append(name);install(target(name),data)
   verify()
  except Exception:
   rollback=[]
   for name in reversed(touched):
    try:
     if originals[name] is None:ftp.delete(target(name))
     else:install(target(name),originals[name])
    except Exception:rollback.append(name)
   log(rolled_back=not rollback,rollback_failures=rollback)
   raise
  log(published=True,files=len(prepared),owner_only=True,school_monthly_price=150,author_texts_modified=0,central_login_modified=False)
 finally:
  try:ftp.quit()
  except Exception:pass
if __name__=='__main__':
 try:run()
 except Exception as error:
  log(stopped=type(error).__name__,reason=str(error) if isinstance(error,RuntimeError) else '')
  sys.exit(1)
