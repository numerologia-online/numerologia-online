"""Guarded publication of OWNER-ONLY synthetic purchases.

NEVER writes to numi_orders or numi_entitlements.
Reuses an existing verified account and separates tests in numi_test_purchases.
Replaces just public test UI, account JS and account core, with backups/rollback.
"""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time,tempfile
from urllib.request import Request,urlopen
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
STYLE=b'    <style id="numi-owner-test-checkout-20261031">'
MARKER=b'    <!-- Reversible experiment: subtitles on the eight homepage catalog cards only. -->'
FORM=b'          <div id="numi-test-checkout"'
LIST='          <div id="numi-confirmed-purchases" aria-label="Список сохранённых разборов и ответов"></div>'.encode('utf-8')
TARIFF='          <button type="button" class="account-primary" id="account-show-offer">Подробнее о преимуществах клуба</button>'.encode('utf-8')
PRICE_TEST=b'          <button type="button" id="numi-open-test-from-prices"'
def sha(blob):return hashlib.sha256(blob).digest()
def previous(revision,path):return subprocess.check_output(['git','show',revision+':'+path])
def log(**values):print("NUMI_OWNER_TEST_CHECKOUT",json.dumps(values,sort_keys=True),flush=True)

def safe_merge_live(live,base,ours,kind):
    """Three-way merge: live changes are kept, expected product delta added.
    Stop BEFORE publishing if any conflict or syntax failure occurs.
    """
    if sha(live)==sha(ours):return ours
    if sha(live)==sha(base):return ours
    with tempfile.TemporaryDirectory(prefix='numi-merge-') as d:
        paths=[pathlib.Path(d)/part for part in ('live','baseline','desired')]
        for path,payload in zip(paths,(live,base,ours)):path.write_bytes(payload)
        cmd=['git','merge-file','-p',*(str(p) for p in paths)]
        result=subprocess.run(cmd,capture_output=True)
        if result.returncode!=0 or b'<<<<<<< ' in result.stdout or b'>>>>>>> ' in result.stdout:
            log(merge_conflict=kind,live_hash=sha(live).hex()[:12],base_hash=sha(base).hex()[:12],
                merge_exit=result.returncode)
            raise RuntimeError('Safe '+kind+' patch could not be merged; original retained')
        output=result.stdout
        if kind=='core':
            check=pathlib.Path(d)/'validated.php'
            check.write_bytes(output)
            lint=subprocess.run(['php','-l',str(check)],capture_output=True)
        else:
            check=pathlib.Path(d)/'validated.js'
            check.write_bytes(output)
            lint=subprocess.run(['node','--check',str(check)],capture_output=True)
        if lint.returncode!=0:raise RuntimeError('Merged '+kind+' source failed syntax check')
        return output

def http_get(path):
    q='&' if '?' in path else '?'
    request=Request('https://'+DOMAIN+'/'+path+q+'test_checkout='+str(time.time_ns()),headers={'Cache-Control':'no-cache'})
    with urlopen(request,timeout=40) as result:
        if result.status!=200:raise RuntimeError('Unexpected public HTTP response')
        return result.read(3000000)
def health():
    req=Request('https://'+DOMAIN+'/api/numi-account.php',data=b'{"action":"health"}',
                headers={'Content-Type':'application/json'},method='POST')
    with urlopen(req,timeout=40) as resp:
        data=json.loads(resp.read(10000))
        if resp.status!=200 or data.get('ok') is not True or data.get('database') is not True:
            raise RuntimeError('DB/account health not healthy')
def main():
    core=pathlib.Path('account-service/private/core.php').read_bytes()
    js=pathlib.Path('account-browser.js').read_bytes()
    src=pathlib.Path('index.html').read_bytes()
    if any(src.count(x)!=1 for x in (STYLE,MARKER,FORM,LIST,TARIFF,PRICE_TEST)):
        raise RuntimeError('Test checkout source markers missing/duplicated')
    if b'function naTestPurchase' not in core or b'function naTestOwner' not in core or b'test_purchase' not in js:
        raise RuntimeError('Owner-only test checkout implementation incomplete')
    style=STYLE+src.split(STYLE,1)[1].split(MARKER,1)[0]
    form=FORM+src.split(FORM,1)[1].split(LIST,1)[0]
    # The source's tariff test button immediately follows the existing original button.
    price_line=PRICE_TEST+src.split(PRICE_TEST,1)[1].split(b'</button>',1)[0]+b'</button>'
    expected_core=previous('054289023a7615cebb09b16822807f302d8c224c^','account-service/private/core.php')
    expected_js=previous('cfe1a1696e490f0a9982d116d3af95843b9adaaf^','account-browser.js')
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21)
    ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
    ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip('/')
    site=home+'/www/'+DOMAIN
    paths={'core':home+'/private/numi-account-20261031/core.php',
           'js':site+'/account-browser.js',
           'index':site+'/index.html',
           'guard':site+'/.htaccess'}
    def read(path):
        out=io.BytesIO();ftp.retrbinary('RETR '+path,out.write);return out.getvalue()
    def write(path,blob):
        ftp.storbinary('STOR '+path,io.BytesIO(blob))
        if sha(read(path))!=sha(blob):raise RuntimeError('Remote checksum mismatch')
    try:
        before={k:read(v) for k,v in paths.items()}
        if b'NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31' not in before['guard']:
            raise RuntimeError('Paid content guard is missing')
        # Preserve live changes that were published independently after our known base.
        # Safe three-way merge refuses conflicts and validates syntax before any write.
        merged_core=safe_merge_live(before['core'],expected_core,core,'core')
        merged_js=safe_merge_live(before['js'],expected_js,js,'js')
        if (merged_core.count(b'function naTestPurchase(')!=1
            or merged_core.count(b'function naTestOwner(')!=1
            or b"if ($action==='test_purchase') naTestPurchase($db,$body);" not in merged_core):
            raise RuntimeError('Test backend merge incomplete; refusing publication')
        if merged_js.count(b'request("test_purchase"')!=1:
            raise RuntimeError('Test browser script merge incomplete; refusing publication')
        html=before['index']
        if html.count(LIST)!=1 or html.count(MARKER)!=1 or html.count(TARIFF)!=1:
            raise RuntimeError('Unexpected live Saved/tariff layout')
        if any(x in html for x in (STYLE,FORM,PRICE_TEST)):
            raise RuntimeError('Test checkout already partially published; refusing overwrite')
        if html.count(b'account-browser.js?v=14')!=1:
            raise RuntimeError('Live account JS cache version differs')
        updated=html.replace(LIST,form+LIST,1)
        updated=updated.replace(TARIFF,TARIFF+b'\n'+price_line,1)
        updated=updated.replace(MARKER,style+MARKER,1)
        updated=updated.replace(b'account-browser.js?v=14',b'account-browser.js?v=15',1)
        parent=home+'/site-safeguard-backups'
        try:ftp.mkd(parent)
        except ftplib.error_perm:ftp.cwd(parent)
        backup=parent+'/test-checkout-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())
        ftp.mkd(backup)
        for k in ('core','js','index'):write(backup+'/'+k+'.bak',before[k])
        log(backup_complete=True)
        changed=[]
        try:
            for k,payload in (('core',merged_core),('js',merged_js),('index',updated)):
                changed.append(k);write(paths[k],payload)
            if sha(http_get('account-browser.js'))!=sha(merged_js):
                raise RuntimeError('Live JS validation failed')
            if sha(http_get(''))!=sha(updated):
                raise RuntimeError('Live homepage validation failed')
            health()
            if read(paths['guard'])!=before['guard']:
                raise RuntimeError('Protected access guard modified')
            log(success=True,live_verified=True,owner_only=True,real_payment_tables_untouched=True)
        except BaseException:
            for k in reversed(changed):
                try:write(paths[k],before[k])
                except BaseException:log(rollback_failed=k)
            log(rollback_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=='__main__':
    try:main()
    except BaseException as e:
        log(success=False,reason=str(e)[:180] if isinstance(e,RuntimeError) else type(e).__name__)
        sys.exit(1)
