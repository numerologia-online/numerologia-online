import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request
p='appointment.html'
base='e191a13ba63e7578837991313a7186a3981adaf0'
old=subprocess.check_output(['git','show',base+':'+p])
new=pathlib.Path(p).read_bytes()
assert b'id="calendar"' in new and new.index(b'id="calendar"')<new.index(b'id="services"') and 'от 1 до 1,5 часа'.encode() in new and '—'.encode() not in new
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/');remote=home+'/www/xn--c1adkkdfjbp1a4l.online/'+p
def read(path):
 b=io.BytesIO();ftp.retrbinary('RETR '+path,b.write);return b.getvalue()
def write(path,b):
 ftp.storbinary('STOR '+path,io.BytesIO(b));assert read(path)==b
changed=False
try:
 saved=read(remote)
 assert saved in (old,new),'REMOTE_DRIFT'
 backup=home+'/site-safeguard-backups'
 try:ftp.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 if saved!=new:
  write(backup+'/before-appointment-copy-'+str(time.time_ns())+'.bak',saved)
  assert read(remote)==saved
  changed=True;write(remote,new)
 with urllib.request.urlopen('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/appointment.html?v='+str(time.time_ns()),timeout=30) as resp:
  actual=resp.read()
 assert actual.index(b'id="calendar"')<actual.index(b'id="services"') and b'Compact mobile-first booking layout' in actual and 'от 1 до 1,5 часа'.encode() in actual
 assert 'Если в течение суток после оплаты'.encode() in actual and 'Написать Татьяне в Telegram'.encode() in actual and b'https://t.me/Kod_9966' in actual
 print('APPOINTMENT_FOLLOWUP_LIVE; ONLY_HTML_CHANGED; NO_PAYMENT_CALLS',flush=True)
except BaseException:
 if changed:write(remote,saved)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
