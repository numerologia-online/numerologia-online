"""Surgically hide redundant email onboarding; preserve all live account features.
FTP baseline checked, backup and rollback, no PHP or database writes.
"""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,tempfile,time
from urllib.request import Request,urlopen
HOST='server172.hosting.reg.ru';DOMAIN='xn--c1adkkdfjbp1a4l.online'
BEFORE_REF=b'  const signed = document.getElementById("numi-account-signed");'
RENDER_OLD=b'    signed.hidden=tg||!current;\n    tgBox.hidden=!tg||!current;'
RENDER_NEW=b'    signed.hidden=true;\n    // Once the user is signed in by email, the identity card above is enough.\n    // Do not repeat the email/Telegram onboarding box on every visit.\n    root.style.display=(!tg && !!current)?"none":"";\n    if(logoutButton) logoutButton.hidden=tg||!current;\n    tgBox.hidden=!tg||!current;'
VER=b'account-browser.js?v='
def digest(v):return hashlib.sha256(v).hexdigest()
def report(**vals):print('NUMI_HIDE_CONFIRMED_EMAIL_PROMPT',json.dumps(vals,sort_keys=True),flush=True)
def fetch(path):
    req=Request('https://'+DOMAIN+'/'+path+'?verified_email_cleanup='+str(time.time_ns()),headers={'Cache-Control':'no-cache'})
    with urlopen(req,timeout=40) as resp:
        if resp.status!=200:raise RuntimeError('Unexpected HTTP status')
        return resp.read(3000000)
def main():
    desired=pathlib.Path('account-browser.js').read_bytes()
    if desired.count(RENDER_NEW)!=1:raise RuntimeError('Desired JS patch incomplete')
    addition=desired.split(BEFORE_REF,1)[1].split(b'  const tgBox =',1)[0]
    if b'logoutRow.append(logoutButton)' not in addition:raise RuntimeError('Logout relocation absent')
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip('/')
    site=root+'/www/'+DOMAIN+'/'
    paths={'js':site+'account-browser.js','index':site+'index.html'}
    def read(path):
        out=io.BytesIO();ftp.retrbinary('RETR '+path,out.write);return out.getvalue()
    def write(path,data):
        ftp.storbinary('STOR '+path,io.BytesIO(data))
        if digest(read(path))!=digest(data):raise RuntimeError('FTP checksum differs')
    try:
        old={k:read(p) for k,p in paths.items()}
        oldjs=old['js'];oldhtml=old['index']
        if b'root.style.display=(!tg && !!current)' in oldjs:
            report(success=True,already_published=True);return
        if oldjs.count(BEFORE_REF)!=1 or oldjs.count(RENDER_OLD)!=1:
            raise RuntimeError('Live account JS differs from expected narrow patch anchors')
        newjs=oldjs.replace(BEFORE_REF,BEFORE_REF+addition,1).replace(RENDER_OLD,RENDER_NEW,1)
        if newjs.count(b'logoutRow.append(logoutButton)')!=1:
            raise RuntimeError('Logout relocation is incomplete')
        # Update only the script version on the live index page.
        import re
        versions=re.findall(rb'account-browser\.js\?v=([0-9]+)',oldhtml)
        if len(versions)!=1:raise RuntimeError('Live homepage account script version absent or duplicated')
        newversion=str(int(versions[0])+1).encode('ascii')
        newhtml=oldhtml.replace(VER+versions[0],VER+newversion,1)
        with tempfile.TemporaryDirectory() as folder:
            code=pathlib.Path(folder)/'account-browser.js'
            code.write_bytes(newjs)
            check=subprocess.run(['node','--check',str(code)],capture_output=True,text=True)
            if check.returncode!=0:raise RuntimeError('New account JS syntax invalid')
        backupdir=root+'/site-safeguard-backups'
        try:ftp.mkd(backupdir)
        except ftplib.error_perm:ftp.cwd(backupdir)
        backup=backupdir+'/confirmed-email-cleanup-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())
        ftp.mkd(backup)
        for k in paths:write(backup+'/'+k+'.bak',old[k])
        touched=[]
        try:
            touched.append('js');write(paths['js'],newjs)
            touched.append('index');write(paths['index'],newhtml)
            if digest(fetch('account-browser.js'))!=digest(newjs):
                raise RuntimeError('Public JS not refreshed')
            if digest(fetch(''))!=digest(newhtml):
                raise RuntimeError('Public homepage not refreshed')
            report(success=True,live_verified=True,removed_redundant_prompt=True,version=int(newversion),only_account_ui_changed=True)
        except BaseException:
            for k in reversed(touched):
                try:write(paths[k],old[k])
                except BaseException:report(rollback_failed=k)
            report(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=='__main__':
    try:main()
    except BaseException as exc:
        report(success=False,reason=str(exc)[:200] if isinstance(exc,RuntimeError) else type(exc).__name__)
        sys.exit(1)
