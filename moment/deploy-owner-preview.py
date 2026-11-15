"""Release only two NEW owner-only files under /moment and private Groq key. Never edit paid content."""
import ftplib, hashlib, io, json, os, pathlib, re, ssl, sys, time, urllib.request, urllib.error
HOST='server172.hosting.reg.ru'
BASE='xn--c1adkkdfjbp1a4l.online'
PRIMARY='xn----8sbhhqijddjgdebdz2c2o.xn--p1ai'
FILES=['moment/owner-ai.php','moment/owner-preview.html']
def sha(b):return hashlib.sha256(b).hexdigest()
def log(stage,**fields):print('OWNER_MOMENT_RELEASE '+json.dumps({'stage':stage,**fields},ensure_ascii=False),flush=True)
def main():
    key=os.environ.get('GROQ_API_KEY','')
    if not re.fullmatch(r'gsk_[A-Za-z0-9_-]{15,500}',key):raise RuntimeError('GROQ_KEY_MISSING_OR_INVALID')
    contents={p:pathlib.Path(p).read_bytes() for p in FILES}
    code=contents[FILES[0]]
    if b'naTestOwner($account)' not in code or b'count($catalog' not in code:raise RuntimeError('OWNER_GATE_INVALID')
    if b'numi-wallet' in code:raise RuntimeError('PAYMENT_DEPENDENCY_UNEXPECTED')
    cfg=("<?php\nreturn ['groq_api_key' => "+json.dumps(key)+"];\n").encode()
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    ftp.connect(HOST,21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip('/')
    root=home+'/www/'+BASE
    configDir=home+'/private/numi-moment-groq'
    configPath=configDir+'/config.local.php'
    def read(path):
        b=io.BytesIO()
        try:ftp.retrbinary('RETR '+path,b.write)
        except ftplib.error_perm as e:
            if str(e).startswith('550'):return None
            raise
        return b.getvalue()
    def write(path,blob):
        ftp.storbinary('STOR '+path,io.BytesIO(blob))
        if sha(read(path) or b'')!=sha(blob):raise RuntimeError('FTP_READBACK_FAILURE')
    def public(path):
        req=urllib.request.Request('https://'+PRIMARY+'/'+path+'?owner_preview_check='+str(time.time_ns()),headers={'User-Agent':'NumiMomentOwnerPreview/1.0','Cache-Control':'no-cache'})
        try:
            with urllib.request.urlopen(req,timeout=30) as r:return r.status,r.read(250000)
        except urllib.error.HTTPError as e:return e.code,e.read(5000)
    touched=[]
    try:
        auth=read(home+'/private/numi-account-20261031/core.php')
        if not auth or b'function naTestOwner' not in auth:raise RuntimeError('PRIVATE_OWNER_AUTH_NOT_FOUND')
        status,raw=public('moment/questions.json')
        if status!=200 or len(json.loads(raw).get('questions',[]))!=300:raise RuntimeError('LIVE_300_CATALOG_MISSING')
        if any(read(root+'/'+p) is not None for p in FILES):raise RuntimeError('OWNER_PREVIEW_FILE_EXISTS_REFUSE_OVERWRITE')
        if read(configPath) is not None:raise RuntimeError('PRIVATE_CONFIG_EXISTS_REFUSE_OVERWRITE')
        try:ftp.mkd(configDir)
        except ftplib.error_perm:ftp.cwd(configDir)
        stage=configDir+'/.config.stage'
        if read(stage) is not None:raise RuntimeError('PRIVATE_STAGE_EXISTS')
        touched.append(stage);write(stage,cfg)
        ftp.sendcmd('SITE CHMOD 600 '+stage)
        ftp.rename(stage,configPath);touched[-1]=configPath
        for p,b in contents.items():
            target=root+'/'+p
            if read(target) is not None:raise RuntimeError('CONCURRENT_FILE_EXISTS')
            touched.append(target);write(target,b)
        status_html,html=public('moment/owner-preview.html')
        if status_html!=200 or b'id="generate"' not in html:raise RuntimeError('PUBLIC_OWNER_HTML_FAILED')
        status_api,body_api=public('moment/owner-ai.php')
        if status_api!=403:raise RuntimeError('ANONYMOUS_OWNER_GATE_FAILED_'+str(status_api))
        if json.loads(body_api).get('error')!='OWNER_LOGIN_REQUIRED':raise RuntimeError('ANONYMOUS_OWNER_GATE_BAD_BODY')
        log('deployed',success=True,files=FILES,private_key_outside_webroot=True,live_owner_gate_403=True,payments_modified=False)
    except BaseException:
        for item in reversed(touched):
            try:ftp.delete(item)
            except Exception:log('rollback_problem',name=item.rsplit('/',1)[-1])
        log('rollback',attempted=True)
        raise
    finally:
        try:ftp.quit()
        except Exception:ftp.close()
if __name__=='__main__':
    try:main()
    except BaseException as e:
        log('failed',reason=str(e)[:150] if isinstance(e,RuntimeError) else type(e).__name__)
        sys.exit(1)
