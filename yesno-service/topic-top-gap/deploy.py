import ftplib,ssl,os,io,pathlib,json,hashlib,time,urllib.request
R=pathlib.Path(__file__).resolve().parent
f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35);f.connect('server172.hosting.reg.ru',21);f.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);f.prot_p();home=f.pwd().rstrip('/');base=home+'/www/xn--c1adkkdfjbp1a4l.online/moment/yes-no/'
def read(p):
 b=io.BytesIO();f.retrbinary('RETR '+p,b.write);return b.getvalue()
def put(p,b):
 f.storbinary('STOR '+p,io.BytesIO(b))
 if read(p)!=b:raise RuntimeError('Checksum failed')
try:
 m=json.loads((R/'manifest.json').read_text());new={n:(R/n).read_bytes() for n in m};old={n:read(base+n) for n in m}
 for n in m:
  if hashlib.sha256(old[n]).hexdigest()!=m[n] and old[n]!=new[n]:raise RuntimeError('Live file changed '+n)
 backup=home+'/site-safeguard-backups/yesno-topic-top-gap-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime());f.mkd(backup)
 for n,b in old.items():put(backup+'/'+n+'.bak',b)
 touched=[]
 try:
  for n in ['yes-no.css','index.html']:touched.append(n);put(base+n,new[n])
  for n,b in new.items():
   with urllib.request.urlopen('https://xn--c1adkkdfjbp1a4l.online/moment/yes-no/'+n+'?style_release='+str(time.time_ns()),timeout=25) as r:
    if r.read()!=b:raise RuntimeError('Public checksum '+n)
  print('TOPIC_TOP_GAP_RELEASE_SUCCESS',flush=True)
 except BaseException:
  for n in touched:put(base+n,old[n])
  raise
finally:f.quit()
