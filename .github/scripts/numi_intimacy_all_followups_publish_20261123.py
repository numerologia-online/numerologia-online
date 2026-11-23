#!/usr/bin/env python3
"""Publish ONLY the live intimacy follow-up menu/prompt to guarded REG.RU private path."""
import ftplib, ssl, io, os, pathlib, subprocess, time, uuid, urllib.request, urllib.error
path='account-service/private/intimacy-live.php'
oldrev='4629c91b39c6fca85b318e18e0b195606a61e506'
previous=subprocess.check_output(['git','show',oldrev+':'+path])
desired=pathlib.Path(path).read_bytes()
def split_parts(raw):
    start=raw.index(b'function niGenerateText(')
    labels=(b'   // Give Gemini only real catalogue items, not invented or unavailable upsells.',
            b'   // Full storefront catalogue, including questions scheduled to become available.')
    pos=next((raw.index(label,start) for label in labels if label in raw[start:]),None)
    if pos is None:raise RuntimeError('FOLLOWUP_SCOPE_NOT_FOUND')
    sys=raw.index(b"   $system=<<<'PROMPT'\n",pos)
    end=raw.index(b'\nPROMPT;',sys)+len(b'\nPROMPT;')
    return raw[:pos],raw[pos:sys],raw[sys:end],raw[end:]
old_prefix,old_follow,old_prompt,old_suffix=split_parts(previous)
new_prefix,new_follow,new_prompt,new_suffix=split_parts(desired)
assert old_prefix==new_prefix and old_suffix==new_suffix,'UNRELATED_PRODUCTION_CODE_CHANGE'
assert old_follow!=new_follow and old_prompt!=new_prompt
assert b'FOLLOWUP_CATALOG' in new_follow and b'INTIMACY_FOLLOWUPS_NOT_READY' in new_follow
assert new_follow.count(b'"\xd1\x80\xd0\xb0\xd0\xb7\xd0\xb4\xd0\xb5\xd0\xbb"')>=60
assert b'\xd0\x98\xd0\xb7\xd0\xbc\xd0\xb5\xd0\xbd\xd1\x8b' in new_follow
assert b'\xd0\x9f\xd1\x80\xd0\xb8\xd0\xbe\xd1\x80\xd0\xb8\xd1\x82\xd0\xb5\xd1\x82' in new_prompt
assert b'google/gemini-3-flash-preview' in desired and b'niEnsurePaidResource' in desired
assert b'intimacy-live-knowledge.json' in desired and b'max_tokens' in desired
print('ALL_QUESTION_FOLLOWUPS_SCOPE_OK unchanged_core=true unchanged_KB=true unchanged_model=true paid_AI_calls=0',flush=True)
root='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'
def status(p):
    try:
        req=urllib.request.Request(root+p+'?intimacy_crosssell_check='+str(time.time_ns()),
                                   headers={'Cache-Control':'no-store'})
        with urllib.request.urlopen(req,timeout=24) as response:return response.status
    except urllib.error.HTTPError as exc:return exc.code
def healthy():
    codes=[status(''),status('redflag-ai-lab/style-test-api.php'),status('api/numi-account.php')]
    print('SITE_HEALTH',codes,flush=True)
    return codes[0]==200 and codes[1]==403 and codes[2] in (403,405)
if not healthy():raise RuntimeError('SITE_UNHEALTHY_BEFORE')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
remote=home+'/private/numi-account-20261031/intimacy-live.php'
backup_dir=home+'/site-safeguard-backups'
def read(remote_path):
    buf=io.BytesIO();ftp.retrbinary('RETR '+remote_path,buf.write);return buf.getvalue()
def write(remote_path,content):
    ftp.storbinary('STOR '+remote_path,io.BytesIO(content))
    if read(remote_path)!=content:raise RuntimeError('FTP_READBACK_MISMATCH')
old=None
written=False
try:
    old=read(remote)
    if old!=previous:raise RuntimeError('LIVE_ENGINE_DRIFT_ABORT_NO_WRITES')
    try:ftp.mkd(backup_dir)
    except ftplib.error_perm as exc:
        if not str(exc).startswith('550'):raise
    tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]
    backup=backup_dir+'/before-all-catalog-intimacy-followups-'+tag+'.bak'
    write(backup,old)
    if read(remote)!=old:raise RuntimeError('CONCURRENT_ENGINE_CHANGE')
    written=True
    write(remote,desired)
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_AFTER')
    if read(remote)!=desired:raise RuntimeError('FINAL_ENGINE_MISMATCH')
    print('INTIMACY_ALL_CATALOG_FOLLOWUPS_PUBLISHED_OK paid_ai_calls=0 other_files_untouched=true model_unchanged=true billing_unchanged=true',flush=True)
except BaseException:
    if written and old is not None:
        try:write(remote,old);print('ROLLBACK_SUCCESS',flush=True)
        except BaseException:print('ROLLBACK_FAILED',flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
