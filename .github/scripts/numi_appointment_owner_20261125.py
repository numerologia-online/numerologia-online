import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,json
files=['account-service/private/appointment.php','appointment.js','appointment.html']
base='68fc843b5020497b928a5c05115f803091f2965d'
for p in files:
 if p.endswith('.php'):subprocess.run(['php','-l',p],check=True)
 if p.endswith('.js'):subprocess.run(['node','--check',p],check=True)
fixture="""<?php
require 'account-service/private/core.php';
require 'account-service/private/appointment.php';
if(!apWeekend('2026-12-05')||!apWeekend('2026-12-06')||apWeekend('2026-12-08'))throw new RuntimeException('WEEKEND');
if(apEnabled([],[]))throw new RuntimeException('GATE');
if(apTelegram('@Example_1')!=='@example_1'||apTelegram('Example_1')!=='@example_1'||apTelegram('123')!==null||apTelegram('https://t.me/example')!==null)throw new RuntimeException('TELEGRAM_VALIDATION');
$year=[['slot_no'=>1,'service'=>'year','status'=>'paid']];
$life=[['slot_no'=>1,'service'=>'life','status'=>'paid']];
if(apNextSlot([],'life')!==1||apNextSlot($year,'year')!==2||apNextSlot($year,'life')!==null||apNextSlot($life,'year')!==null||apNextSlot(array_merge($year,[['slot_no'=>2,'service'=>'year','status'=>'pending']]),'year')!==null)throw new RuntimeException('CAPACITY');
if(apNextSlot([['slot_no'=>2,'service'=>'year','status'=>'pending']],'year')!==1||!apCalendarDay($year)['year_only']||apCalendarDay($life)['year_only'])throw new RuntimeException('CALENDAR_CAPACITY');
if(apNextForDate('2026-12-08',[],'year')!==1||apNextForDate('2026-12-08',[],'life')!==null||apNextForDate('2026-12-08',$year,'year')!==null||apNextForDate('2026-12-01',[],'year')!==null)throw new RuntimeException('AUTHOR_CAPACITY');
if(!apCalendarDay([],'2026-12-08')['year_only']||apCalendarDay([],'2026-12-01')['paid']!==[]||apCalendarDay([],'2026-12-01')['planned']!==['life'])throw new RuntimeException('AUTHOR_PLAN');
if(!array_key_exists('free',apPlanModes())||apNextForDate('2026-12-08',[],'life',[])!==1||apNextForDate('2026-12-09',[],'life',['closed'])!==null||apNextForDate('2026-12-09',[],'year',['year'])!==1)throw new RuntimeException('OWNER_PLAN_OVERRIDE');
if(naTestOwner(null)||naTestOwner(['email'=>'guest@example.invalid','email_verified_at'=>'2026-11-25'])||naTestOwner(['email'=>'guest@example.invalid','email_verified_at'=>null]))throw new RuntimeException('OWNER_AUTH');
echo 'OWNER_PLAN_OFFLINE_PASS';
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
 page=get('appointment.html');assert 'Ваш ник в Telegram'.encode() in page and b'https://t.me/Kod_9966' in page and b'#c0f3d4' in page and b'20261125-owner' in page
 assert b'telegram:' in get('appointment.js')
 cal=json.loads(get('api/numi-appointment.php?action=calendar'));assert cal['ok'] and cal['owner'] is False and cal['slots']['2026-12-08']['year_only']
 assert b'id="owner-area"' not in page
 import urllib.error
 for action,method in [('owner','GET'),('owner_plan','POST')]:
  url='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/api/numi-appointment.php?action='+action
  req=urllib.request.Request(url,data=b'{}' if method=='POST' else None,method=method,headers={'Content-Type':'application/json','Origin':'https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai'})
  try:
   with urllib.request.urlopen(req,timeout=25):raise RuntimeError('UNAUTHORIZED_OWNER_ACCESS')
  except urllib.error.HTTPError as e:assert e.code==403 and json.loads(e.read())['error']=='OWNER_ONLY','OWNER_DENIAL_FAILED'
 print('ANONYMOUS_OWNER_READ_WRITE_DENIED',flush=True)
 print('OWNER_CALENDAR_LIVE; PAYMENTS_ENABLED='+str(cal['enabled'])+'; NO_PAYMENT_CALLS',flush=True)
except BaseException:
 for p in reversed(changed):
  try:write(remote(p),saved[p]);print('ROLLBACK_OK',p)
  except BaseException:print('ROLLBACK_FAILED',p)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
