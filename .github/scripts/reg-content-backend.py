"""Install the private PHP backend and test anonymous boundaries. No author files are removed."""
import base64, concurrent.futures, ftplib, hashlib, io, json, os, pathlib, re, secrets, ssl, sys, time, urllib.request, urllib.error, zipfile

DOMAIN='xn--c1adkkdfjbp1a4l.online'
SERVER='server172.hosting.reg.ru'
PRIVATE='private/numi-content-reg-20261031'
def log(**data): print(json.dumps(data),flush=True)
def main():
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=20)
    ftp.connect(SERVER,21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p()
    home=ftp.pwd().rstrip('/');site=home+'/www/'+DOMAIN
    def read(path,limit=6000000):
        out=io.BytesIO()
        def collect(chunk):
            if out.tell()+len(chunk)>limit:raise RuntimeError('File exceeds release limit')
            out.write(chunk)
        ftp.retrbinary('RETR '+path,collect);return out.getvalue()
    def mkdir(path):
        current=''
        for part in pathlib.PurePosixPath(path).parts:
            if part=='/':continue
            current+='/'+part
            try:ftp.mkd(current)
            except ftplib.error_perm as error:
                if not str(error).startswith('550'):raise
    def write(path,data,private=False):
        mkdir(str(pathlib.PurePosixPath(path).parent));ftp.storbinary('STOR '+path,io.BytesIO(data))
        if hashlib.sha256(read(path)).digest()!=hashlib.sha256(data).digest():raise RuntimeError('Upload verification failed')
        if private:
            try:ftp.sendcmd('SITE CHMOD 600 '+path)
            except ftplib.error_perm:pass
    before_homepage=read(site+'/index.html')
    github_configuration=read(home+'/private/numi-secure-access/config.local.php',100000)
    found=re.search(rb'(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}',github_configuration)
    if not found:raise RuntimeError('Existing private GitHub credential is not configured')
    github_token=found[0].decode()
    control=json.loads(pathlib.Path('.github/numi-content-release.json').read_text())
    revision=control['private_commit']
    if not re.fullmatch(r'[a-f0-9]{40}',revision):raise RuntimeError('Invalid private release')
    url='https://api.github.com/repos/numerologia-online/numi-numi-on-private/contents/infrastructure/reg-protection/2026-10-31/backend.zip?ref='+revision
    request=urllib.request.Request(url,headers={'Authorization':'Bearer '+github_token,'Accept':'application/vnd.github.raw+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'numi-reg-backend-release/1.0'})
    with urllib.request.urlopen(request,timeout=25)as response:archive=response.read(2000000)
    if hashlib.sha256(archive).hexdigest()!=control['backend_sha256']:raise RuntimeError('Private release failed integrity validation')
    with zipfile.ZipFile(io.BytesIO(archive))as bundle:
        entries={}
        for name in bundle.namelist():
            p=pathlib.PurePosixPath(name)
            if p.is_absolute()or'..'in p.parts or len(p.parts)!=2 or p.parts[0]not in('api','server')or p.suffix not in('.php','.json'):raise RuntimeError('Invalid release member')
            entries[name]=bundle.read(name)
    release=str(int(time.time()));private_root=home+'/'+PRIVATE
    backup=home+'/site-safeguard-backups/content-backend-'+release
    for name,data in entries.items():
        if name.startswith('server/'):
            write(private_root+'/'+name.split('/',1)[1],data,True)
    mkdir(private_root+'/cache')
    try:ftp.sendcmd('SITE CHMOD 700 '+private_root+'/cache')
    except ftplib.error_perm:pass
    check_token=secrets.token_urlsafe(32)
    write(private_root+'/deployment-check.sha256',hashlib.sha256(check_token.encode()).hexdigest().encode(),True)
    for name,data in entries.items():
        if not name.startswith('api/'):continue
        target=site+'/'+name
        try:old=read(target);write(backup+'/'+name,old,True)
        except ftplib.error_perm:pass
        staged=private_root+'/incoming/'+name.split('/',1)[1]
        write(staged,data,True);mkdir(site+'/api');ftp.rename(staged,target)
        try:ftp.sendcmd('SITE CHMOD 644 '+target)
        except ftplib.error_perm:pass
    if read(site+'/index.html')!=before_homepage:raise RuntimeError('Unexpected concurrent homepage change')
    log(backend_installed=True,author_files_modified=0,homepage_modified=False)
    def http(name,body=None,headers=None):
        request_headers={'User-Agent':'numi-content-verification/1.0','Origin':'https://'+DOMAIN,'Cache-Control':'no-cache',**(headers or{})}
        data=None if body is None else json.dumps(body).encode()
        if data is not None:request_headers['Content-Type']='application/json'
        request=urllib.request.Request('https://'+DOMAIN+'/api/numi-'+name+'.php',data=data,headers=request_headers)
        try:r=urllib.request.urlopen(request,timeout=30)
        except urllib.error.HTTPError as error:r=error
        with r:return r.status,json.loads(r.read(100000))
    status,health=http('content-health')
    if status!=200 or health.get('configured')is not True:raise RuntimeError('Private backend configuration check failed')
    for route in('miniapp','paid-content','redflag-content'):
        status,result=http(route,{'init_data':'','path':'data/year/energy-1.txt'})
        if status!=401 or result.get('ok')is not False:raise RuntimeError('Anonymous API boundary failed')
    manifest=json.loads(entries['server/manifest.json'])['files']
    chunks=[list(manifest)[i:i+8]for i in range(0,len(manifest),8)]
    def check_paths(paths):
        status,result=http('content-verify',{'paths':paths},{'X-Numi-Deployment-Check':check_token})
        if status!=200 or result.get('ok')is not True:raise RuntimeError('Live private source verification failed')
        if result.get('sha1')!={p:manifest[p]['sha']for p in paths}:raise RuntimeError('Live private original mismatch')
        return len(paths)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:verified=sum(pool.map(check_paths,chunks))
    log(live_private_originals_verified=verified,total_private_sources=len(manifest),anonymous_access='denied',payments_enabled=False)
    ftp.quit()
if __name__=='__main__':
    try:main()
    except Exception as error:
        log(deployment_stopped=type(error).__name__,reason=str(error) if isinstance(error,RuntimeError) else '')
        sys.exit(1)
