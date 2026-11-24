import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,json
files=['account-service/private/appointment.php','appointment.js','appointment.html']
base='6789c8e3ec5d36dc068fc535c0c6d0340ffe0646'
for p in files:
 if p.endswith('.php'):subprocess.run(['php','-l',p],check=True)
 if p.endswith('.js'):subprocess.run(['node','--check',p],check=True)
fixture="""<?php
require 'account-service/private/core.php';
require 'account-service/private/appointment.php';
if(!apWeekend('2026-12-05')||!apWeekend('2026-12-06')||apWeekend('2026-12-08'))throw new RuntimeException('WEEKEND');
if(apEnabled([],[]))throw new RuntimeException('GATE');
echo 'CALENDAR_OFFLINE_PASS';
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/');web=home+'/www/xn--c1adkkdfjbp1a4l.online/';private=home+'/private/numi-account-20261031/'
def remote(p):return private+p.rsplit('/',1)[-1] if p.startswith('account-service/private/') else web+p
def read(p):
 b=io.BytesIO();ftp.retrbinary('RETR '+p,b.write);return b.getvalue()
def write(p,b):
 ftp.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b
def get(p):
 with urllib.request.urlopen('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+('&' if '?' in p else '?')+'v='+str(time.time_ns()),timeout=30) as r:return r.read()
saved={};changed=[]
try:
 for p in files:
  saved[p]=read(remote(p))
  old=subprocess.check_output(['git','show',base+':'+p]);new=pathlib.Path(p).read_bytes()
  assert saved[p] in (old,new),'REMOTE_DRIFT '+p
 tag=str(time.time_ns());backup=home+'/site-safeguard-backups'
 try:ftp.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 for p in files:write(backup+'/before-calendar-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',saved[p])
 for p in files:
  assert read(remote(p))==saved[p]
  new=pathlib.Path(p).read_bytes()
  if new!=saved[p]:changed.append(p);write(remote(p),new)
 assert 'предварительной личной договорённости'.encode() in get('appointment.html')
 assert 'Выходной'.encode() in get('appointment.js')
 cal=json.loads(get('api/numi-appointment.php?action=calendar'));assert cal['ok']
 print('CALENDAR_LIVE; PAYMENTS_ENABLED='+str(cal['enabled'])+'; NO_PAYMENT_CALLS',flush=True)
except BaseException:
 for p in reversed(changed):
  try:write(remote(p),saved[p]);print('ROLLBACK_OK',p)
  except BaseException:print('ROLLBACK_FAILED',p)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
