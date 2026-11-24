import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib,json
BASE='0d87953694050d9b92a495207d3039a3eae93415'
files=['account-service/private/intimacy-practical-engine.php','account-service/private/intimacy-live.php','redflag-ai-lab/intimacy-practical-preview-api.php']
old={p:subprocess.check_output(['git','show',BASE+':'+p]) for p in files}
new={p:pathlib.Path(p).read_bytes() for p in files}
for p in files:subprocess.run(['php','-l',p],check=True)
assert old[files[0]].split(b'function ipFollowups(',1)[0]==new[files[0]].split(b'function ipFollowups(',1)[0]
assert old[files[1]].split(b'function niCacheFile(',1)[0]==new[files[1]].split(b'function niCacheFile(',1)[0]
assert b'ipGenerateText($question,$day,$month,$year)' in new[files[2]]
assert b'OWNER_VOICE' not in new[files[2]]
assert b"'-practical-v3.json'" in new[files[1]]
fixture=r"""<?php
require 'account-service/private/intimacy-practical-engine.php';
if(count(ipKnowledge())!==22||count(ipQuestions())!==10)throw new RuntimeException('KB');
$pub=file_get_contents('redflag-public-catalog.js');
foreach(ipQuestions() as $q){
    $msg=ipMessages($q,15,7,1987);
    $p=json_decode($msg[1]['content'],true,30,JSON_THROW_ON_ERROR);
    if(count($p['четыре_значимые_позиции'])!==4||count($p['вопросы_для_подводки'])!==3||isset($p['приоритетная_подводка']))throw new RuntimeException('PAYLOAD');
    $f=$p['вопросы_для_подводки'];
    foreach($f as $v)if(!str_contains($pub,json_encode($v['вопрос'],JSON_UNESCAPED_UNICODE)))throw new RuntimeException('CATALOG');
    $title=$f[0]['вопрос'];
    $sample=str_repeat('Это проверка формата без реальной трактовки. ',13)."\n\n".'Есть ещё одна тема, которую стоит рассмотреть. '.$title;
    if(substr_count(ipFormatAnswer($sample,$q['id'],$f),$title)!==1)throw new RuntimeException('FOLLOWUP');
}
echo 'OFFLINE_SHARED_VOICE_PASS';
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
def status(p):
    try:
        with urllib.request.urlopen('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?voice='+str(time.time_ns()),timeout=25) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    codes=[status(''),status(files[2]),status('redflag-ai-lab/style-test-api.php'),status('redflag-ai-lab/family-owner-preview-api.php'),status('api/numi-owner-material.php'),status('api/numi-intimacy-free.php')]
    print('SITE_HEALTH',codes,flush=True)
    return codes[:5]==[200,403,403,403,403] and codes[5] in (400,403,405)
assert healthy(),'PRE_HEALTH'
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
private=home+'/private/numi-account-20261031/'
web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
def remote(p):return private+p.rsplit('/',1)[-1] if p.startswith('account-service/private/') else web+p
def read(p):
    b=io.BytesIO();ftp.retrbinary('RETR '+p,b.write);return b.getvalue()
def write(p,b):
    ftp.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b,'READBACK_FAIL'
protected=[private+p for p in ['intimacy-practical-knowledge.txt','intimacy-live-questions.json','family-live.php','family-practical-engine.php','family-owner-knowledge-v1.txt','language-live.php','language-live-knowledge.txt','wallet-real-payment.php','fulfillment.php','core.php','redflag-catalog.json']]+[web+p for p in ['redflag-feature.js','app.js','index.html','redflag-public-catalog.js','api/numi-intimacy-free.php','redflag-ai-lab/style-test-api.php','redflag-ai-lab/family-owner-preview-api.php']]
saved={};changed=[]
try:
    for p in files:
        saved[p]=read(remote(p))
        assert saved[p] in (old[p],new[p]),'REMOTE_DRIFT_'+p
    hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
    for n in ['intimacy-practical-knowledge.txt','intimacy-live-questions.json']:
        assert read(private+n)==pathlib.Path('account-service/private/'+n).read_bytes(),'KB_DRIFT'
    backup=home+'/site-safeguard-backups'
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    tag=str(time.time_ns())
    for p in files:
        if saved[p]!=new[p]:write(backup+'/before-approved-intimacy-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',saved[p])
    for p in files:
        assert read(remote(p))==saved[p],'CONCURRENT_EDIT'
        if saved[p]!=new[p]:
            changed.append(p);write(remote(p),new[p])
    assert healthy(),'POST_HEALTH'
    for p in files:assert read(remote(p))==new[p],'FINAL_READBACK'
    for p,h in hashes.items():assert hashlib.sha256(read(p)).digest()==h,'PROTECTED_CHANGED'
    print('APPROVED_INTIMACY_LIVE shared_engine=true buyer_and_owner=true old_cache_preserved=true model_calls=0',flush=True)
except BaseException:
    for p in reversed(changed):
        try:write(remote(p),saved[p]);print('ROLLBACK_OK',p,flush=True)
        except BaseException:print('ROLLBACK_FAILED',p,flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
