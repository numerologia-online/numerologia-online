"""Publish the existing aggregate analytics only; preserve current live page contents."""
import ftplib,ssl,os,io,pathlib,json,hashlib,time,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parent
DOMAIN='xn--c1adkkdfjbp1a4l.online'
EXPECTED={'assets/numi-insights-v2.js':'8d00887a8e76adddd74f4230c6cbbc8b8fe8943941f6dab1f805610462ba170b','api/numi-insights.php':'eaaa4c221b94811d5e6848d8df7b58aca22f6aff68beed7cedc8ba6e42e0c14e','insights/insights.js':'befe63140f6d037551b6023be97a93c9e3fcd3ca7643c13a7f1f8c1336877096','insights/index.html':'aa4a473060ddbb49008702927eb539bf630f8c05176635f8e22faca4d5530ecc'}
PAGES=['index.html','year/index.html','pro/index.html','child/index.html','moment/index.html','moment/yes-no/index.html']
OLD=b"if(localStorage.getItem('numi_analytics_permission')!=='allow'||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return;"
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 desired={p:(ROOT/'public'/name).read_bytes() for p,name in {'api/numi-insights.php':'numi-insights.php','assets/numi-insights-v2.js':'tracker.js','insights/insights.js':'insights.js','insights/index.html':'index.html'}.items()}
 f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=25);f.connect('server172.hosting.reg.ru',21);f.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);f.prot_p()
 root=f.pwd().rstrip('/');base=root+'/www/'+DOMAIN
 def read(p):
  b=io.BytesIO();f.retrbinary('RETR '+p,b.write);return b.getvalue()
 def write(p,b):
  f.storbinary('STOR '+p,io.BytesIO(b))
  if read(p)!=b:raise RuntimeError('FTP verification failed '+p.rsplit('/',1)[-1])
 old={};touched=[]
 try:
  # Finish all checks before writing any live file.
  for p in [*desired,*PAGES]:old[p]=read(base+'/'+p)
  for p,expected in EXPECTED.items():
   if sha(old[p])!=expected and old[p]!=desired[p]:raise RuntimeError('Live file changed; refusing overwrite '+p)
  for p in PAGES:
   b=old[p]
   if b.count(OLD)!=1:raise RuntimeError('Expected single existing bootstrap '+p)
   if b.count(b'/assets/numi-insights-v2.js?v=2.0.0')!=1:raise RuntimeError('Unexpected tracker version '+p)
   desired[p]=b.replace(OLD,b'').replace(b'/assets/numi-insights-v2.js?v=2.0.0',b'/assets/numi-insights-v2.js?v=2.1.0')
  backup=root+'/site-safeguard-backups/insights-aggregate-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime());f.mkd(backup)
  for p,b in old.items():write(backup+'/'+p.replace('/','__')+'.bak',b)
  try:
   for p,b in desired.items():touched.append(p);write(base+'/'+p,b)
   req=urllib.request.Request('https://'+DOMAIN+'/api/numi-insights.php?action=health',headers={'Cache-Control':'no-cache'})
   with urllib.request.urlopen(req,timeout=20) as r:
    data=json.load(r)
    if not data.get('database') or data.get('version')!='2.1.0':raise RuntimeError('Analytics health failed')
   try:
    urllib.request.urlopen('https://'+DOMAIN+'/api/numi-insights.php',timeout=20)
    raise RuntimeError('Report unexpectedly public')
   except urllib.error.HTTPError as e:
    if e.code!=401:raise
   for p,b in desired.items():
    if p.endswith('.php'):continue
    req=urllib.request.Request('https://'+DOMAIN+'/'+p+'?aggregate_release='+str(time.time_ns()),headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=20) as r:
     if r.status!=200 or sha(r.read())!=sha(b):raise RuntimeError('Live verification '+p)
   print('INSIGHTS_AGGREGATE '+json.dumps({'success':True,'files':list(desired),'accounts_unchanged':True,'database_schema_unchanged':True,'backup':backup.rsplit('/',1)[-1]}),flush=True)
  except BaseException:
   for p in reversed(touched):write(base+'/'+p,old[p])
   print('INSIGHTS_AGGREGATE rollback complete',flush=True);raise
 finally:f.quit()
if __name__=='__main__':main()
