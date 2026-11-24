import ftplib,ssl,os,io,pathlib,subprocess,time,json,urllib.request,urllib.error
root=pathlib.Path('.')
old='<button class="product-card appointment" id="appointment-section" type="button" data-coming-soon data-artwork="assets/appointment.jpg"><span class="product-title">Записаться на личный расчёт</span><span class="product-arrow" aria-hidden="true">→</span></button>'.encode()
new='<a class="product-card appointment" id="appointment-section" href="./appointment.html" data-artwork="assets/appointment.jpg"><span class="product-title">Записаться на личный расчёт</span><span class="product-arrow" aria-hidden="true">→</span></a>'.encode()
for p in ['api/numi-appointment.php','account-service/private/appointment.php','account-service/config-appointment.example.php']:
 subprocess.run(['php','-l',p],check=True)
subprocess.run(['node','--check','appointment.js'],check=True)
test=r"""<?php
require 'account-service/private/core.php';
require 'account-service/private/appointment.php';
$s=apServices();
if(count($s)!==4||$s['year'][1]!==300000||$s['life'][1]!==1000000||$s['couple'][1]!==1000000||$s['child'][1]!==1000000)throw new Exception('PRICES');
if(apWindow(new DateTimeImmutable('2026-11-24T12:00:00+04:00'))[0]!=='2026-12-08')throw new Exception('WINDOW');
if(apEnabled([],[])||apAmount(1000000)!=='10000.00')throw new Exception('GATE');
$r=['service'=>'year','kopeks'=>300000,'email'=>'test@example.invalid','vat_code'=>1,'id'=>'00000000-0000-4000-8000-000000000000','provider_payment_id'=>null];
$p=apPayload($r);
if($p['amount']['value']!=='3000.00'||$p['receipt']['items'][0]['payment_mode']!=='full_prepayment'||$p['receipt']['items'][0]['payment_subject']!=='service')throw new Exception('PAYLOAD');
if(apVerified($r,['test'=>true]))throw new Exception('VERIFY');
echo "OFFLINE_TESTS_PASS (no payment calls)\n";
"""
subprocess.run(['php'],input=test.encode(),check=True)
origin='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'
def get(path):
 url=origin+path+('&' if '?' in path else '?')+'appointment_check='+str(time.time_ns())
 try:
  with urllib.request.urlopen(url,timeout=25) as r:return r.status,r.read(1024*1024)
 except urllib.error.HTTPError as e:return e.code,b''
assert get('')[0]==200,'PRE_SITE_HEALTH'
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/');web=home+'/www/xn--c1adkkdfjbp1a4l.online/';private=home+'/private/numi-account-20261031/'
def read(p):
 b=io.BytesIO()
 try:ftp.retrbinary('RETR '+p,b.write)
 except ftplib.error_perm as e:
  if str(e).startswith('550'):return None
  raise
 return b.getvalue()
def write(p,b):
 ftp.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b,'READBACK '+p
paths={private+'appointment.php':root/'account-service/private/appointment.php',web+'api/numi-appointment.php':root/'api/numi-appointment.php',web+'appointment.js':root/'appointment.js',web+'appointment.html':root/'appointment.html'}
before={};changed=[]
try:
 # Confirm the remote account API location and existing live wallet module.
 assert read(private+'core.php') and read(private+'wallet-real-payment.php'),'PRIVATE_BASELINE'
 home_html=read(web+'index.html');assert home_html,'MISSING_HOME'
 if home_html.count(old)==1:target_home=home_html.replace(old,new)
 elif home_html.count(new)==1:target_home=home_html
 else:raise RuntimeError('HOME_ANCHOR_CHANGED')
 targets={p:f.read_bytes() for p,f in paths.items()};targets[web+'index.html']=target_home
 for p,b in targets.items():
  before[p]=read(p)
  if p!=web+'index.html' and before[p] not in (None,b):raise RuntimeError('UNRECOGNIZED_EXISTING_FILE '+p)
 assert before[web+'index.html']==home_html,'CONCURRENT_HOME'
 backup=home+'/site-safeguard-backups'
 try:ftp.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p,b in before.items():
  if b is not None and targets[p]!=b:write(backup+'/before-appointment-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',b)
 for p,b in targets.items():
  assert read(p)==before[p],'CONCURRENT_EDIT '+p
  if b!=before[p]:changed.append(p);write(p,b)
 assert get('')[0]==200,'POST_SITE_HEALTH'
 status,page=get('appointment.html');assert status==200 and 'Персональный разбор года'.encode() in page,'PAGE_HEALTH'
 status,body=get('api/numi-appointment.php?action=calendar');assert status==200,'CALENDAR_HEALTH'
 result=json.loads(body);assert result['ok'] and result['enabled'] is False,'GATE_MUST_REMAIN_CLOSED'
 assert new in get('')[1],'HOME_LINK_HEALTH'
 print('APPOINTMENT_PAGE_LIVE; PAYMENT_GATE_CLOSED; NO_PAYMENT_CALLS; EXISTING_WALLET_UNCHANGED',flush=True)
except BaseException:
 for p in reversed(changed):
  try:
   if before[p] is None:ftp.delete(p)
   else:write(p,before[p])
   print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
