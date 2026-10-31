"""Safely publish the explicit redacted-client manifest to REG.RU; never modify bot/API/MySQL."""
import ftplib, hashlib, io, json, os, pathlib, re, ssl, sys, time, urllib.request, urllib.error

DOMAIN = 'xn--c1adkkdfjbp1a4l.online'
HOST = 'server172.hosting.reg.ru'
MANIFEST = '.github/numi-frontend-release.json'
def note(**data):
    print(json.dumps(data, ensure_ascii=False, separators=(',', ':')), flush=True)

def git_blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\x00' + data).hexdigest()

def main():
    config = json.loads(pathlib.Path(MANIFEST).read_text('utf-8'))
    if config.get('intent') != 'APPROVED_PROTECTED_RELEASE':
        raise RuntimeError('Not an explicitly approved release: no files changed')
    if config.get('root') != 'www/' + DOMAIN or len(config.get('files', [])) > 400:
        raise RuntimeError('Invalid release inventory')
    files = {}
    for item in config['files']:
        p = item['path']
        if (not isinstance(p, str) or not re.fullmatch(r'[a-zA-Z0-9_./-]+', p)
            or p.startswith('/') or '..' in p.split('/')
            or p.startswith(('.github/', 'api/', 'server/', 'tests/', 'auth-free/', 'auth-server/'))
            or not p.endswith(('.json', '.js', '.txt', '.html', '.md'))):
            raise RuntimeError('Unsafe manifest path')
        if p in files: raise RuntimeError('Duplicate path')
        content = pathlib.Path(p).read_bytes() if item['new'] else None
        if content is not None and git_blob(content) != item['new']:
            raise RuntimeError('Source changed since release approval')
        files[p] = {'old': item['old'], 'new': item['new'], 'data': content}
    if len(files) < 200: raise RuntimeError('Unexpectedly small release')

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=25)
    prior = {}; changed = []
    def read(path, limit=4_200_000):
        buffer = io.BytesIO()
        def collect(piece):
            if buffer.tell()+len(piece) > limit: raise RuntimeError('Remote source exceeds limit')
            buffer.write(piece)
        try: ftp.retrbinary('RETR '+path, collect)
        except ftplib.error_perm as error:
            if str(error).startswith('550'): return None
            raise
        return buffer.getvalue()
    def ensure(path):
        current = ''
        for segment in pathlib.PurePosixPath(path).parts:
            if segment == '/': continue
            current += '/' + segment
            try: ftp.mkd(current)
            except ftplib.error_perm as e:
                if not str(e).startswith('550'): raise
                old = ftp.pwd()
                try: ftp.cwd(current)
                finally: ftp.cwd(old)
    def put(path, data):
        ensure(str(pathlib.PurePosixPath(path).parent))
        ftp.storbinary('STOR '+path, io.BytesIO(data))
        if read(path) != data: raise RuntimeError('Remote upload verification failed')
    def remove(path):
        try:ftp.delete(path)
        except ftplib.error_perm as e:
            if not str(e).startswith('550'):raise

    ftp.connect(HOST, 21)
    ftp.login(os.environ['REG_FTP_USER'], os.environ['REG_FTP_PASSWORD'])
    ftp.prot_p()
    home = ftp.pwd().rstrip('/')
    site = home + '/www/' + DOMAIN
    ftp.cwd(site)
    if read(site+'/index.html') is None: raise RuntimeError('Website root not verified')
    # Verify the entire current release BEFORE any write.
    conflicts=[]
    for path, entry in files.items():
        remote = read(site+'/'+path)
        prior[path] = remote
        if remote is not None and git_blob(remote) not in (entry['old'], entry['new']):
            conflicts.append(path)
    if conflicts:
        note(release_aborted='unexpected live changes', mismatch_count=len(conflicts), samples=conflicts[:12])
        raise RuntimeError('Live site has newer/different files; no production change')
    note(preflight='passed', files=len(files), previously_missing=sum(1 for v in prior.values() if v is None))

    stamp=time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
    release_root=home+'/site-safeguard-backups/numi-public-redacted-'+stamp
    original_root=release_root+'/before'
    staged_root=release_root+'/staged'
    # Store original remote files outside the public web root and verify copies.
    for path, original in prior.items():
        if original is not None and git_blob(original) != files[path]['new']:
            put(original_root+'/'+path, original)
    note(private_backups_verified=True)
    for path, entry in files.items():
        if entry['data'] is not None:
            put(staged_root+'/'+path, entry['data'])
    note(staged_files_verified=True)

    # Put loader dependencies first, entry point files second, content sanitization last.
    def rank(path):
        if path in ('paid-access.js','paid-content-paths.js'): return (0,path)
        if path.endswith('.js'):return (1,path)
        if path.endswith('.html'):return (2,path)
        if path.endswith('.json'):return (3,path)
        return (4,path)
    ordered=sorted(files,key=rank)
    try:
        for path in ordered:
            entry=files[path]
            if prior[path] is not None and git_blob(prior[path]) == entry['new']:continue
            changed.append(path)
            if entry['data'] is None:
                remove(site+'/'+path)
                if read(site+'/'+path) is not None:raise RuntimeError('Delete verification failed: '+path)
            else:
                put(site+'/'+path, entry['data'])
        note(published=True, changed=len(changed), backed_up_at=release_root)
    except Exception as error:
        note(publish_failed=type(error).__name__, restoring=True)
        failed=[]
        for path in reversed(changed):
            try:
                previous=prior[path]
                if previous is None:
                    remove(site+'/'+path)
                else:
                    put(site+'/'+path, previous)
            except Exception:
                failed.append(path)
        note(rollback_completed=len(failed)==0, unrestored_paths=failed[:15])
        raise

    # Check anonymous HTTP responses without signing in or revealing any private content.
    def get(path):
        url='https://'+DOMAIN+'/'+path+'?numi_check='+str(int(time.time()))
        req=urllib.request.Request(url,headers={'User-Agent':'numi-post-release-security-check','Cache-Control':'no-cache'})
        try:response=urllib.request.urlopen(req,timeout=25)
        except urllib.error.HTTPError as error:response=error
        with response:return response.status,response.read(200000)
    tests={}
    try:
        st,content=get('data/year/energy-1.txt')
        tests['annual_public_file_gone'] = st in (401,403,404,410)
        st,content=get('child/data/matrix/sections/energy-1.json')
        val=json.loads(content)
        tests['child_paid_source_scrubbed']=st==200 and val.get('privateContent')is True and 'sections'not in val
        st,content=get('data/redflag/love/published/1-2.json')
        val=json.loads(content)
        tests['redflag_paid_answers_scrubbed']=st==200 and set(val.get('entries',{})) <= {'first-step'}
        st,content=get('api/numi-content-health.php')
        val=json.loads(content)
        tests['backend_active']=st==200 and val.get('configured')is True
    except Exception as e:
        note(http_verification_error=type(e).__name__)
    note(anonymous_http_checks=tests, protected_public_site_verified=(len(tests)==4 and all(tests.values())))
    if len(tests)!=4 or not all(tests.values()):
        raise RuntimeError('Release uploaded, but external HTTP verification requires attention')
    ftp.quit()

if __name__=='__main__':
    try: main()
    except Exception as error:
        note(stopped=type(error).__name__, message=str(error) if isinstance(error, RuntimeError) else '')
        sys.exit(1)
