#!/usr/bin/env python3
"""Targeted cleanup of bad Red Flag copies, not account data or published banks."""
import ftplib,ssl,io,os,re,json,hashlib,subprocess,time
from pathlib import Path

ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=50)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
site=home+'/www/xn--c1adkkdfjbp1a4l.online'
relative='api/redflag-free-ai.php'
remote=site+'/'+relative
local=Path(relative).read_bytes()
sha=lambda b:hashlib.sha256(b).hexdigest()
def read(remote_path):
    b=io.BytesIO()
    ftp.retrbinary('RETR '+remote_path,b.write)
    return b.getvalue()
def put(remote_path,payload):
    ftp.storbinary('STOR '+remote_path,io.BytesIO(payload))
    if read(remote_path)!=payload:raise RuntimeError('READBACK_MISMATCH')
def safe_list(directory):
    try:
        return ftp.nlst(directory)
    except ftplib.error_perm as e:
        if str(e).startswith('550'):return []
        raise
try:
    # Never silently overwrite a file that someone edited outside GitHub.
    previous=read(remote)
    revs=subprocess.check_output(['git','log','--format=%H','-n','300','--',relative],text=True).splitlines()
    approved={sha(subprocess.check_output(['git','show',rev+':'+relative])) for rev in revs}
    if sha(previous) not in approved:raise RuntimeError('UNRECOGNIZED_LIVE_FREE_AI_PHP')
    backup=home+'/site-safeguard-backups'
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    dest=backup+'/redflag-free-ai-before-silence-filter-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'.bak'
    ftp.storbinary('STOR '+dest,io.BytesIO(previous))
    if read(dest)!=previous:raise RuntimeError('BACKUP_FAILED')
    if previous!=local:
        if read(remote)!=previous:raise RuntimeError('CONCURRENT_PHP_EDIT')
        put(remote,local)
    print('LIVE_FREE_ANSWER_FILTER_INSTALLED_AND_FTP_VERIFIED',flush=True)

    # Only the private draft and free cache directories, only known JSON names,
    # only actual answers matching the abandoned icy-silence storyline.
    dirs=[
      (home+'/private/numi-redflag-owner-kept-v1',
       re.compile(r'^[a-z0-9-]+__[a-z0-9-]+__[0-9]{1,2}-[0-9]{1,2}\.json$')),
      (home+'/private/numi-redflag-free-ai-v1',
       re.compile(r'^day-[0-9]{1,2}-month-[0-9]{1,2}\.json$'))
    ]
    ban=re.compile(r'ледян\w*|наказ\w*\W{0,18}молчан\w*|внезапн\w*\W{0,18}исчезновен\w*',re.I|re.U)
    totals=[]
    for directory,pattern in dirs:
        found=deleted=0
        for entry in safe_list(directory):
            filename=entry.rsplit('/',1)[-1]
            if not pattern.fullmatch(filename):continue
            target=directory+'/'+filename
            try:
                data=read(target)
                obj=json.loads(data.decode('utf-8'))
            except (ftplib.error_perm,UnicodeDecodeError,json.JSONDecodeError):
                continue
            answer=obj.get('answer') if isinstance(obj,dict) else None
            if not isinstance(answer,str) or not ban.search(answer):continue
            found+=1
            # No unrelated file changed. Confirm text still matches the filter.
            if ban.search((json.loads(read(target).decode('utf-8'))).get('answer','')):
                ftp.delete(target);deleted+=1
        totals.append({'store':'private_owner_drafts' if 'owner-kept' in directory else 'public_free_cache','matching':found,'deleted':deleted})
    print('TARGETED_RED_FLAG_BAD_TEXT_PURGE',json.dumps(totals,ensure_ascii=False),flush=True)
finally:
    try:ftp.quit()
    except Exception:ftp.close()
