import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib
P='redflag-ai-lab/intimacy-practical-preview-api.php'
E='account-service/private/intimacy-practical-engine.php'
old=subprocess.check_output(['git','show','2010f3cd656025bdcc835cedd28c7a26c7774777:'+P])
new=pathlib.Path(P).read_bytes()
engine=pathlib.Path(E).read_bytes()
assert hashlib.sha1(b'blob '+str(len(engine)).encode()+b'\x00'+engine).hexdigest()=='e3f9e609c59db32bf8d056cf02b003b5eb614a3b'
assert new.count(b'INTIMACY_PREVIEW_ENGINE_VERSION_MISMATCH')==1
subprocess.run(['php','-l',P],check=True)
def status(p):
    try:
        with urllib.request.urlopen('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?marker='+str(time.time_ns()),timeout=20) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    return status('')==200 and status(P)==403
assert healthy(),'PRE_HEALTH'
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
remote=home+'/www/xn--c1adkkdfjbp1a4l.online/'+P
remote_engine=home+'/private/numi-account-20261031/intimacy-practical-engine.php'
def read(p):
    b=io.BytesIO();ftp.retrbinary('RETR '+p,b.write);return b.getvalue()
def write(p,b):
    ftp.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b,'READBACK_FAIL'
changed=False
try:
    saved=read(remote)
    assert saved in (old,new),'REMOTE_PREVIEW_DRIFT'
    assert read(remote_engine)==engine,'REMOTE_ENGINE_VERSION_MISMATCH'
    if saved!=new:
        backup=home+'/site-safeguard-backups'
        try:ftp.mkd(backup)
        except ftplib.error_perm as e:
            if not str(e).startswith('550'):raise
        write(backup+'/before-intimacy-owner-dot-'+str(time.time_ns())+'.bak',saved)
        assert read(remote)==saved,'CONCURRENT_EDIT'
        changed=True;write(remote,new)
    assert healthy(),'POST_HEALTH'
    assert read(remote)==new and read(remote_engine)==engine,'FINAL_READBACK'
    print('OWNER_DOT_LIVE engine_verified=true owner_only=true model_calls=0',flush=True)
except BaseException:
    if changed:write(remote,saved)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
