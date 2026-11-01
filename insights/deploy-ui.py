"""Update only the analytics dashboard HTML, JS and CSS with guarded rollback."""
import ftplib,ssl,os,io,pathlib,json,hashlib,time,urllib.request
ROOT=pathlib.Path(__file__).resolve().parent
DOMAIN='xn--c1adkkdfjbp1a4l.online'
def sha(b):return hashlib.sha256(b).hexdigest() if b is not None else None
def main():
 manifest=json.loads((ROOT/'ui-manifest.json').read_text())
 desired={p:(ROOT/'public'/p.rsplit('/',1)[-1]).read_bytes() for p in manifest}
 f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40);f.connect('server172.hosting.reg.ru',21);f.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);f.prot_p()
 root=f.pwd().rstrip('/');base=root+'/www/'+DOMAIN
 def read(p):
  b=io.BytesIO();f.retrbinary('RETR '+p,b.write);return b.getvalue()
 def write(p,b):
  f.storbinary('STOR '+p,io.BytesIO(b))
  if read(p)!=b:raise RuntimeError('FTP checksum failed')
 old={};touched=[]
 try:
  for p in manifest:
   old[p]=read(base+'/'+p)
   if sha(old[p])!=manifest[p] and old[p]!=desired[p]:raise RuntimeError('Live dashboard changed; no overwrite '+p)
  backup=root+'/site-safeguard-backups/insights-ui-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime());f.mkd(backup)
  for p,b in old.items():write(backup+'/'+p.replace('/','__')+'.bak',b)
  try:
   for p in ['insights/insights.js','insights/insights.css','insights/index.html']:
    touched.append(p);write(base+'/'+p,desired[p])
   for p,b in desired.items():
    req=urllib.request.Request('https://'+DOMAIN+'/'+p+'?ui_release='+str(time.time_ns()),headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=30) as r:
     if r.status!=200 or r.read()!=b:raise RuntimeError('Public verification '+p)
   print('INSIGHTS_UI '+json.dumps({'success':True,'files':list(desired),'backup':backup.rsplit('/',1)[-1]}),flush=True)
  except BaseException:
   for p in reversed(touched):write(base+'/'+p,old[p])
   raise
 finally:f.quit()
if __name__=='__main__':main()
