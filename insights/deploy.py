"""Publish analytics v2 and append one nonblocking script to exact live snapshots.

No DNS, account-code, payment-status, bot or content-bank changes.
All replaced files are backed up outside www; restore on any failed check.
"""
import ftplib,ssl,os,io,pathlib,hashlib,json,time,re,urllib.request,urllib.error
DOMAIN='xn--c1adkkdfjbp1a4l.online'
ROOT=pathlib.Path(__file__).resolve().parent
SHA=lambda b:hashlib.sha256(b).hexdigest() if b is not None else None
def log(**v):print('INSIGHTS_RELEASE '+json.dumps(v,ensure_ascii=False),flush=True)
def request(path,data=None,origin=True):
 headers={'Cache-Control':'no-cache'}
 if data is not None:
  headers['Content-Type']='application/json'
  if origin:headers['Origin']='https://'+DOMAIN
  data=json.dumps(data).encode()
 req=urllib.request.Request('https://'+DOMAIN+'/'+path,headers=headers,data=data)
 try:
  with urllib.request.urlopen(req,timeout=30) as r:return r.status,r.read(1000000)
 except urllib.error.HTTPError as e:return e.code,e.read(100000)
def main():
 manifest=json.loads((ROOT/'live-manifest.json').read_text())
 desired={p:(ROOT/'public'/src).read_bytes() for p,src in {
  'insights/index.html':'index.html','insights/insights.css':'insights.css','insights/insights.js':'insights.js',
  'assets/numi-insights-v2.js':'tracker.js','api/numi-insights.php':'numi-insights.php',
  'analytics/index.html':'legacy-redirect.html'}.items()}
 bootstrap=(ROOT/'bootstrap.html').read_bytes()
 for p,expected in manifest.items():
  original=(ROOT/'baselines'/p).read_bytes()
  if SHA(original)!=expected:raise RuntimeError('Invalid packaged baseline '+p)
  if b'NumiAnalytics' in original or b'moment/analytics.js' in original:raise RuntimeError('Legacy hooks remain '+p)
  if original.lower().count(b'</body>')!=1:raise RuntimeError('Ambiguous body '+p)
  desired[p]=re.sub(b'</body>',lambda m:bootstrap+b'\n'+m.group(),original,count=1,flags=re.I)
 ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
 ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p()
 root=ftp.pwd().rstrip('/');base=root+'/www/'+DOMAIN
 def read(path):
  b=io.BytesIO()
  try:ftp.retrbinary('RETR '+path,b.write)
  except ftplib.error_perm as e:
   if str(e).startswith('550'):return None
   raise
  return b.getvalue()
 def mkdir(path):
  try:ftp.mkd(path)
  except ftplib.error_perm:ftp.cwd(path)
 def write(path,data):
  ftp.storbinary('STOR '+path,io.BytesIO(data))
  if read(path)!=data:raise RuntimeError('FTP verification '+path.rsplit('/',1)[-1])
 snapshots={};touched=[];removed={}
 try:
  mkdir(base+'/insights');mkdir(base+'/analytics');mkdir(root+'/site-safeguard-backups')
  directory=root+'/site-safeguard-backups/insights-v2-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime());mkdir(directory)
  for p,new in desired.items():
   old=read(base+'/'+p);snapshots[p]=old
   if p in manifest and SHA(old)!=manifest[p] and old!=new:raise RuntimeError('Live file changed; no overwrite: '+p)
   if old is not None:write(directory+'/'+p.replace('/','__')+'.bak',old)
  log(preflight=True,files=len(desired),backup=directory.rsplit('/',1)[-1])
  try:
   # Install the independent collector and dashboard BEFORE touching existing pages.
   for p in desired:
    if p in manifest:continue
    touched.append(p);write(base+'/'+p,desired[p])
   code,b=request('api/numi-insights.php?action=health');status=json.loads(b)
   if code!=200 or status.get('version')!='2.0.0' or not status.get('database'):raise RuntimeError('New API health failed')
   code,b=request('api/numi-insights.php');status=json.loads(b)
   if code!=401 or status.get('error')!='OWNER_LOGIN_REQUIRED':raise RuntimeError('Anonymous report was not protected')
   code,b=request('api/numi-insights.php',{'events':[]})
   if code!=400:raise RuntimeError('Collector invalid-event check failed')
   code,b=request('api/numi-insights.php',{'events':[]},origin=False)
   if code!=403:raise RuntimeError('Collector origin check failed')
   for p in desired:
    if p in manifest:continue
    if p.endswith('.php'):continue
    code,b=request(p+'?release_check='+str(time.time_ns()))
    if code!=200 or SHA(b)!=SHA(desired[p]):raise RuntimeError('Public asset mismatch '+p)
   for p in manifest:
    touched.append(p);write(base+'/'+p,desired[p])
   for p in manifest:
    code,b=request(p+'?release_check='+str(time.time_ns()))
    if code!=200 or SHA(b)!=SHA(desired[p]):raise RuntimeError('Published page mismatch '+p)
   # Retire known legacy runtime files without deleting their backups.
   for p,marker in [('moment/analytics.js',b'NumiAnalytics'),('api/numi-analytics.php',b'NUMI_AGG_ANALYTICS'),('analytics/dashboard.js',b'numi-analytics.php')]:
    old=read(base+'/'+p)
    if old is None:continue
    if marker not in old:raise RuntimeError('Unexpected legacy file; not removing '+p)
    write(directory+'/'+p.replace('/','__')+'.retired',old);removed[p]=old;ftp.delete(base+'/'+p)
   log(success=True,independent_api=True,owner_only=True,origin_checked=True,public_checks=True,pages=list(manifest),retired=list(removed))
  except BaseException:
   for p,old in removed.items():write(base+'/'+p,old)
   for p in reversed(touched):
    try:
     if snapshots[p] is None:ftp.delete(base+'/'+p)
     else:write(base+'/'+p,snapshots[p])
    except BaseException as e:log(rollback_failed=p,error=type(e).__name__)
   log(rollback_attempted=True);raise
 finally:
  try:ftp.quit()
  except BaseException:ftp.close()
if __name__=='__main__':
 try:main()
 except BaseException as e:log(success=False,error=str(e)[:200]);raise
