import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,json,tempfile,hashlib
BASE='7e1b842801ec54092a7df02b7f1b14862335d17d'
FILES=["account-service/private/fulfillment.php","account-service/private/wallet-real-payment.php","account-service/public/numi-owner-material.php","redflag-feature.js","app.js","index.html","account-service/private/money-editor-followups.json","account-service/private/money-editor-live.php","account-service/public/numi-money-editor-free.php"]
FRESH=["account-service/private/money-editor-followups.json","account-service/private/money-editor-live.php","account-service/public/numi-money-editor-free.php"]
ORIGIN='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai'
def request(path,body=None):
    req=urllib.request.Request(ORIGIN+'/'+path+'?moneycheck='+str(time.time_ns()),data=None if body is None else json.dumps(body).encode(),headers={'Origin':ORIGIN,'Content-Type':'application/json','Cache-Control':'no-cache'})
    try:
        with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.read(500000)
    except urllib.error.HTTPError as e:return e.code,e.read(100000)
def health():
    assert request('')[0]==200,'SITE_HEALTH'
    assert request('api/numi-owner-material.php')[0] in (400,401,403,405),'OWNER_GUARD'
health()
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/');priv=home+'/private/numi-account-20261031/';web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
def remote(p):
    if p.startswith('account-service/private/'):return priv+p.rsplit('/',1)[-1]
    if p.startswith('account-service/public/'):return web+'api/'+p.rsplit('/',1)[-1]
    return web+p
def read(p,optional=False):
    b=io.BytesIO()
    try:ftp.retrbinary('RETR '+p,b.write)
    except ftplib.error_perm as e:
        if optional and str(e).startswith('550'):return None
        raise
    return b.getvalue()
def write(p,b):
    ftp.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b,'READBACK_'+p.rsplit('/',1)[-1]
saved={};applied=[]
try:
    assert read(priv+'intimacy-live-config.php'),'PROVIDER_CONFIG'
    manifest=json.loads(read(priv+'store-assets.json'))
    for id in ["gift","generosity","courtship","provider","words-or-deeds","family-load","resource","solve-or-create","responsibility","celebration"]:
        p='data/redflag/money/'+id+'.json';original=read(priv+'store-content/'+p)
        assert original==pathlib.Path(p).read_bytes() and hashlib.sha256(original).hexdigest()==manifest['files'][p],'AUTHOR_BANK_DRIFT_'+id
    final={}
    with tempfile.TemporaryDirectory() as d:
        for p in FILES:
            current=read(remote(p),p in FRESH);saved[p]=current;new=pathlib.Path(p).read_bytes()
            if p in FRESH:assert current in (None,new),'NEW_FILE_COLLISION_'+p
            elif current!=new and current!=subprocess.check_output(['git','show',BASE+':'+p]):
                target=pathlib.Path(d,p);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(current)
                patch=subprocess.check_output(['git','diff',BASE,'HEAD','--',p])
                subprocess.run(['git','apply','--check','--unsafe-paths','-'],input=patch,cwd=d,check=True)
                subprocess.run(['git','apply','--unsafe-paths','-'],input=patch,cwd=d,check=True);new=target.read_bytes()
            final[p]=new
            if p.endswith('.php'):
                with tempfile.NamedTemporaryFile(suffix='.php') as t:t.write(new);t.flush();subprocess.run(['php','-l',t.name],check=True)
            if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new,check=True)
    backup=home+'/site-safeguard-backups'
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    stamp=str(time.time_ns())
    for p in FILES:
        if saved[p] is not None and saved[p]!=final[p]:write(backup+'/before-money-editor-'+stamp+'-'+p.replace('/','_')+'.bak',saved[p])
    for p in FRESH+[p for p in FILES if p not in FRESH]:
        assert read(remote(p),p in FRESH)==saved[p],'CONCURRENT_EDIT_'+p
        if saved[p]!=final[p]:applied.append(p);write(remote(p),final[p])
    health()
    status,body=request('api/numi-money-editor-free.php',{'question_id':'provider','birth_date':'1986-09-09'})
    assert status==400 and json.loads(body).get('error')=='INVALID_FREE_QUESTION','PAID_FREE_GUARD'
    for p in FILES:assert read(remote(p))==final[p],'FINAL_READBACK_'+p
    print('MONEY_EDITOR_LIVE verified source integrity and guarded routes; zero paid calls',flush=True)
except BaseException:
    for p in reversed(applied):
        try:
            if saved[p] is None:ftp.delete(remote(p))
            else:write(remote(p),saved[p])
            print('ROLLBACK_OK',p,flush=True)
        except BaseException:print('ROLLBACK_FAILED',p,flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
