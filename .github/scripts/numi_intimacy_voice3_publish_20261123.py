#!/usr/bin/env python3
import ftplib, ssl, io, os, pathlib, subprocess, hashlib, time, uuid, urllib.request, urllib.error

path='account-service/private/intimacy-live.php'
oldrev='c85f412cfafb6ed191de567d53036c2b34d8f4ab'
previous=subprocess.check_output(['git','show',oldrev+':'+path])
desired=pathlib.Path(path).read_bytes()
def extract(data):
 start=data.index(b"   $system=<<<'PROMPT'\n",data.index(b'function niGenerateText('))
 end=data.index(b'\nPROMPT;',start)+len(b'\nPROMPT;')
 return data[:start],data[start:end],data[end:]
a,oldprompt,c=extract(previous)
d,newprompt,f=extract(desired)
oldCache=b"return niCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).($id==='fire'?'-voice2':'').'.json';"
newCache=b"return niCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).($id==='fire'?'-voice3':'').'.json';"
assert oldCache in previous and newCache in desired
assert a==d and f.replace(newCache,oldCache,1)==c,'UNRELATED_PRODUCTION_CODE_CHANGE'
assert newprompt.count(b"PROMPT;")==1 and b'gemini-3-flash-preview' in desired
assert b'intimacy-live-knowledge.json' in desired
assert b'niEnsurePaidResource' in desired

root='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'
def status(p):
 try:
  req=urllib.request.Request(root+p+'?private_voice3_check='+str(time.time_ns()),headers={'Cache-Control':'no-store'})
  with urllib.request.urlopen(req,timeout=24) as r:return r.status
 except urllib.error.HTTPError as e:return e.code
def health():
 codes=[status(''),status('redflag-ai-lab/style-test-api.php'),status('api/numi-account.php')]
 print('SITE_HEALTH',codes,flush=True)
 return codes[0]==200 and codes[1]==403 and codes[2] in (403,405)
if not health():raise RuntimeError('SITE_UNHEALTHY_BEFORE')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
remote=home+'/private/numi-account-20261031/intimacy-live.php'
backup_dir=home+'/site-safeguard-backups'
def read(p):
 out=io.BytesIO();ftp.retrbinary('RETR '+p,out.write);return out.getvalue()
def write(p,v):
 ftp.storbinary('STOR '+p,io.BytesIO(v))
 if read(p)!=v:raise RuntimeError('READBACK_MISMATCH')
old=None
written=False
try:
 old=read(remote)
 if old!=previous:raise RuntimeError('LIVE_ENGINE_DRIFT_ABORT_NO_WRITES')
 try:ftp.mkd(backup_dir)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]
 backup=backup_dir+'/before-native-intimacy-voice3-'+tag+'.bak'
 write(backup,old)
 if read(remote)!=old:raise RuntimeError('CONCURRENT_ENGINE_CHANGE')
 written=True
 write(remote,desired)
 if not health():raise RuntimeError('SITE_UNHEALTHY_AFTER')
 if read(remote)!=desired:raise RuntimeError('FINAL_ENGINE_MISMATCH')
 print('INTIMACY_DIRECT_LIVE_VOICE3_PUBLISHED_OK questions=10 model_unchanged=true paid_calls=0 wallet_unchanged=true KB_unchanged=true editor_unchanged=true',flush=True)
except BaseException:
 if written and old is not None:
  try:write(remote,old);print('ROLLBACK_SUCCESS',flush=True)
  except BaseException:print('ROLLBACK_FAILED',flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
