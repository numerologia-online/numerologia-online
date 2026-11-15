import ftplib
import hashlib
import io
import json
import os
import pathlib
import ssl
import subprocess

IDS = ['first-step','romance','relationship-or-comfort','adult-partner','near-him','hard-moment','relationship-format','family-or-triangle','honest-or-disappear']
DATES = ['19-8']
PATHS = ['data/redflag/love/'+name+'.json' for name in IDS]
MANIFEST = 'account-service/private/store-assets.json'

def jsonbytes(obj):
    return (json.dumps(obj, ensure_ascii=False, indent=2)+'\n').encode('utf-8')

def sha(b):
    return hashlib.sha256(b).hexdigest()

def git(*cmd):
    subprocess.run(['git',*cmd], check=True, timeout=120)

local = {}
for name, p in zip(IDS, PATHS):
    b = pathlib.Path(p).read_bytes()
    j = json.loads(b)
    assert j.get('section') == 'love' and j.get('questionId') == name and j.get('keyRule') == 'day-month', p
    assert j['status'] == ('active' if name == 'first-step' else 'draft'), p
    for date in DATES:
        s = j['entries'].get(date)
        assert isinstance(s, str) and len(s) >= 650 and s.count('\n\n') == 1 and '—' not in s, (p, date)
    local[p] = j
print('APPROVED_45_TEXTS_VALIDATED',flush=True)

manifest = json.loads(pathlib.Path(MANIFEST).read_bytes())
assert manifest['version'] == 2
for p in PATHS:
    manifest['files'][p] = sha(pathlib.Path(p).read_bytes())
pathlib.Path(MANIFEST).write_bytes(jsonbytes(manifest))
git('config','user.name','github-actions[bot]')
git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
git('add',MANIFEST)
check = subprocess.run(['git','diff','--cached','--quiet'])
if check.returncode:
    git('commit','-m','Refresh manifest for approved Love August 19')
    git('push','origin','HEAD:main')
print('APPROVED_GITHUB_MANIFEST_UPDATED',flush=True)

user = os.environ.get('REG_FTP_USER')
password = os.environ.get('REG_FTP_PASSWORD')
if not user or not password:
    raise RuntimeError('REG_RU_SECRETS_MISSING')
ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=40)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(user,password)
ftp.prot_p()
ftp.set_pasv(True)
home = ftp.pwd().rstrip('/')
root = home+'/private/numi-account-20261031'
remote = {p:root+'/store-content/'+p for p in PATHS}
remote[MANIFEST] = root+'/store-assets.json'
def read(path):
    buf = io.BytesIO()
    def take(chunk):
        if buf.tell()+len(chunk) > 1800000:
            raise RuntimeError('REMOTE_OVERSIZED:'+path)
        buf.write(chunk)
    ftp.retrbinary('RETR '+path,take)
    return buf.getvalue()
def write(path,b):
    ftp.storbinary('STOR '+path,io.BytesIO(b))
    if read(path) != b:
        raise RuntimeError('REMOTE_READBACK_DIFFERENT:'+path)

try:
    existing = {p:read(remote[p]) for p in [*PATHS,MANIFEST]}
    live_manifest = json.loads(existing[MANIFEST])
    assert live_manifest['version'] == 2 and isinstance(live_manifest['files'],dict)
    output={}
    for id,p in zip(IDS,PATHS):
        current = json.loads(existing[p])
        target = local[p]
        for field in ['schemaVersion','section','questionId','keyRule','status']:
            if current.get(field) != target.get(field):
                raise RuntimeError('LIVE_METADATA_CONFLICT:'+p+':'+field)
        if id != 'first-step':
            if live_manifest['files'].get(p) != sha(existing[p]):
                raise RuntimeError('LIVE_PAID_MANIFEST_DRIFT:'+p)
        for date in DATES:
            if id != 'first-step' and date in current['entries'] and current['entries'][date] != target['entries'][date]:
                raise RuntimeError('LIVE_PAID_DATE_CONFLICT:'+p+':'+date)
            current['entries'][date] = target['entries'][date]
        output[p] = jsonbytes(current)
        for date in DATES:
            assert json.loads(output[p])['entries'][date] == target['entries'][date]
    for p in PATHS:
        live_manifest['files'][p] = sha(output[p])
    output[MANIFEST] = jsonbytes(live_manifest)
    backup_root = home+'/site-safeguard-backups'
    ftp.cwd(backup_root)
    backup = backup_root+'/redflag-love-aug19-'+os.environ['GITHUB_RUN_ID']
    ftp.mkd(backup)
    for i,p in enumerate([*PATHS,MANIFEST]):
        write(backup+'/'+str(i).zfill(2)+'-'+p.rsplit('/',1)[-1]+'.before',existing[p])
    print('REG_RU_BACKUP_10_FILES_VERIFIED',flush=True)
    touched=[]
    try:
        for p in [*PATHS,MANIFEST]:
            if read(remote[p]) != existing[p]:
                raise RuntimeError('CONCURRENT_LIVE_CHANGE:'+p)
            if existing[p] != output[p]:
                touched.append(p)
                write(remote[p],output[p])
        for p in [*PATHS,MANIFEST]:
            if read(remote[p]) != output[p]:
                raise RuntimeError('FINAL_LIVE_VERIFICATION_FAILED:'+p)
        print('REG_RU_LOVE_AUG19_9_ANSWERS_VERIFIED',flush=True)
    except BaseException:
        for p in reversed(touched):
            try:
                write(remote[p],existing[p])
                print('ROLLBACK_OK:'+p,flush=True)
            except BaseException:
                print('ROLLBACK_FAILED:'+p,flush=True)
        raise
finally:
    try: ftp.quit()
    except BaseException: ftp.close()

git('commit','--allow-empty','-m','REG.RU verified Love August 19: 9 approved answers')
git('push','origin','HEAD:main')
print('LOVE_AUG19_RELEASE_COMPLETE',flush=True)
