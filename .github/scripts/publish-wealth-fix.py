import ftplib,ssl,os,io,json,hashlib,pathlib,time,concurrent.futures,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE='https://xn--c1adkkdfjbp1a4l.online/'
def digest(b):return hashlib.sha256(b).hexdigest()
def main():
 release=json.loads((ROOT/'seo/wealth-release.json').read_text());prepared={}
 for p,e in release.items():
  if p not in ('index.html','app.js','destiny-code-feature.js') and not (p.startswith('guide/') and p.endswith('/index.html')):raise RuntimeError('Disallowed release path')
  b=(ROOT/p).read_bytes()
  if digest(b)!=e['after']:raise RuntimeError('Source checksum mismatch')
  if e['before']!=e['after']:prepared[p]=b
 ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
 ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p()
 home=ftp.pwd().rstrip('/');site=home+'/www/xn--c1adkkdfjbp1a4l.online'
 def read(p):
  out=io.BytesIO()
  def sink(b):
   if out.tell()+len(b)>3000000:raise RuntimeError('File exceeds limit')
   out.write(b)
  ftp.retrbinary('RETR '+p,sink);return out.getvalue()
 def put(p,b):
  ftp.storbinary('STOR '+p,io.BytesIO(b))
  if read(p)!=b:raise RuntimeError('FTPS readback mismatch')
 originals={};applied=[]
 try:
  for p in prepared:
   try:originals[p]=read(site+'/'+p)
   except ftplib.error_perm as e:
    if release[p]['before'] is None and str(e).startswith('550'):originals[p]=None
    else:raise
   original=originals[p]
   if original==prepared[p]:continue
   if release[p]['before'] is None:
    if original is not None:raise RuntimeError('New page already exists: '+p)
   elif original is None or (digest(original)!=release[p]['before'] and digest(original+b'\n')!=release[p]['before']):raise RuntimeError('Live page changed; release stopped without writes: '+p)
  print('Preflight passed for '+str(len(prepared))+' files',flush=True)
  backup=home+'/site-safeguard-backups/articles-'+str(int(time.time()));ftp.mkd(backup)
  for p,b in originals.items():
   if b is not None:put(backup+'/'+hashlib.sha256(p.encode()).hexdigest()[:12]+'-'+pathlib.PurePosixPath(p).name,b)
  put(backup+'/paths.json',json.dumps({p:digest(b) if b else None for p,b in originals.items()}).encode())
  print('All originals backed up outside public website',flush=True)
  try:
   for i,(p,b) in enumerate(sorted(prepared.items(),key=lambda item: (0 if item[0] in ('guide/guide.css','guide/articles.js') else 3 if item[0]=='index.html' else 2 if item[0]=='guide/index.html' else 1)),1):
    if originals[p] is not None and read(site+'/'+p)!=originals[p]:raise RuntimeError('Concurrent edit: '+p)
    applied.append(p);put(site+'/'+p,b)
    if i%10==0:print('Published and read back '+str(i)+' files',flush=True)
   def verify(item):
    p,b=item;url=BASE+('' if p=='index.html' else p.removesuffix('index.html'))+'?ai_seo_verify='+os.environ.get('GITHUB_SHA','check')[:12]
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)','Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=35) as r:
     actual=r.read(3000001)
     if r.status!=200 or 'noindex' in r.headers.get('X-Robots-Tag','').lower():raise RuntimeError('HTTP indexability check failed: '+p)
    if actual!=b:raise RuntimeError('HTTP content differs: '+p)
    return p
   with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:verified=list(pool.map(verify,prepared.items()))
   print('WEALTH FIX SUCCESS: '+str(len(verified))+' HTTP files verified',flush=True)
  except BaseException:
   for p in reversed(applied):
    if originals[p] is None:ftp.delete(site+'/'+p)
    else:put(site+'/'+p,originals[p])
   print('ROLLBACK completed',flush=True);raise
 finally:
  try:ftp.quit()
  except BaseException:ftp.close()
if __name__=='__main__':main()
