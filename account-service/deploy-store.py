"""Exact-baseline FTPS publication. Default is read-only; any mismatch stops all writes.
Requires REG_FTP_USER, REG_FTP_PASSWORD, REG_SITE_ROOT (verified absolute webroot),
and PHP_BIN. Does not run Actions, migrations, CRON, Telegram or payment activation.
"""
import argparse,ftplib,hashlib,io,os,pathlib,ssl,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='749fe9b3729c8818d53abd29b9a96111afaf25b7'
FILES={
 'account-service/private/core.php':('private/numi-account-20261031/core.php',False),
 'account-service/private/store.php':('private/numi-account-20261031/store.php',True),
 'yesno-service/public/numi-yesno-answer.php':('api/numi-yesno-answer.php',False),
 'store-catalog.json':('store-catalog.json',True),
 'store-browser.js':('store-browser.js',True),
 'index.html':('index.html',False), # entry point last
}
def digest(blob):return hashlib.sha256(blob).hexdigest()
def run():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
 if subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip()!='main':raise RuntimeError('Only main is permitted')
 desired={p:(ROOT/p).read_bytes() for p in FILES}
 for path in desired:
  if path.endswith('.php'):subprocess.run([os.environ.get('PHP_BIN','php'),'-l',str(ROOT/path)],check=True)
  elif path.endswith('.js'):subprocess.run(['node','--check',str(ROOT/path)],check=True)
 site=os.environ['REG_SITE_ROOT'].rstrip('/')
 if not site.startswith('/') or '..' in site.split('/'):raise RuntimeError('Verified absolute REG_SITE_ROOT required')
 ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
 ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p()
 home=ftp.pwd().rstrip('/')
 remote={p:(home+'/'+target if target.startswith('private/') else site+'/'+target) for p,(target,_) in FILES.items()}
 def read(path):
  out=io.BytesIO();ftp.retrbinary('RETR '+path,out.write);return out.getvalue()
 def put(path,data):
  ftp.storbinary('STOR '+path,io.BytesIO(data))
  if read(path)!=data:raise RuntimeError('Remote verification failed: '+path)
 before={};mismatches=[]
 try:
  for path,(_,new) in FILES.items():
   if new:
    # Do not interpret a generic FTP 550 as proof of absence (it can mean no permission).
    names=list(ftp.nlst(remote[path].rsplit('/',1)[0]))
    if remote[path] in names or remote[path].rsplit('/',1)[1] in [n.rsplit('/',1)[-1] for n in names]:
     mismatches.append(path+' already exists')
    before[path]=None
   else:
    before[path]=read(remote[path]);base=subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT)
    if before[path]!=base:mismatches.append(path+' differs from reviewed baseline')
  if mismatches:raise RuntimeError('No files published: '+', '.join(mismatches))
  print('All remote baselines match; no payment settings or schema changes requested.')
  if not args.apply:return
  backup=home+'/private/numi-store-backup-'+str(time.time_ns());ftp.mkd(backup)
  for path,data in before.items():
   if data is not None:put(backup+'/'+path.replace('/','__'),data)
  changed=[]
  try:
   for path in FILES:
    if before[path] is not None and read(remote[path])!=before[path]:raise RuntimeError('Concurrent server change: '+path)
    if before[path] is None:
     names=ftp.nlst(remote[path].rsplit('/',1)[0])
     if remote[path].rsplit('/',1)[1] in [n.rsplit('/',1)[-1] for n in names]:raise RuntimeError('Concurrent new file: '+path)
    # Track before sending: an interrupted STOR can otherwise escape rollback.
    changed.append(path);put(remote[path],desired[path])
   print('Published and read-back verified '+str(len(changed))+' files; private backup retained.')
  except Exception:
   for path in reversed(changed):
    current=read(remote[path])
    if current!=desired[path]:
     print('Rollback stopped for changed/partial file; private backup retained: '+path);continue
    if before[path] is None:ftp.delete(remote[path])
    else:put(remote[path],before[path])
   raise
 finally:ftp.quit()
if __name__=='__main__':run()
