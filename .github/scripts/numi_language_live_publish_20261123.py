#!/usr/bin/env python3
"""Guarded REG.RU native Love Languages publication. No AI calls, no purchases."""
import os,io,ftplib,ssl,hashlib,pathlib,subprocess,json,time,uuid,urllib.request,urllib.error
base='4093e9d43a1f376a0bd526c3024a51eb605c0c28'
files=[
 'account-service/private/language-live-questions.json',
 'account-service/private/language-live-knowledge.txt',
 'account-service/private/language-live.php',
 'account-service/private/fulfillment.php',
 'account-service/private/wallet-real-payment.php',
 'account-service/public/numi-owner-material.php',
 'account-service/private/redflag-catalog.json',
 'account-service/public/numi-language-free.php',
 'redflag-public-catalog.js',
 'redflag-text-bank.js',
 'redflag-categories.js',
 'redflag-feature.js',
 'app.js',
 'index.html'
]
new_files={'account-service/private/language-live-questions.json',
           'account-service/private/language-live-knowledge.txt',
           'account-service/private/language-live.php',
           'account-service/public/numi-language-free.php'}
old={}
new={}
for path in files:
    new[path]=pathlib.Path(path).read_bytes()
    if path in new_files:old[path]=None
    else:old[path]=subprocess.check_output(['git','show',base+':'+path])
    if old[path] is not None and old[path]==new[path]:
        raise RuntimeError('EXPECTED_CHANGE_MISSING_'+path)
# Protect all other editorial sections and pricing.
catalog_old=json.loads(old['account-service/private/redflag-catalog.json'])
catalog_new=json.loads(new['account-service/private/redflag-catalog.json'])
assert catalog_old['questions'].keys()==catalog_new['questions'].keys()
for category in catalog_old['questions']:
    if category!='language' and catalog_old['questions'][category]!=catalog_new['questions'][category]:
        raise RuntimeError('UNRELATED_CATALOG_CHANGED')
for qid,previous in catalog_old['questions']['language'].items():
    updated=catalog_new['questions']['language'][qid]
    assert previous['tier']==updated['tier'] and previous['free']==updated['free']
    assert updated['ready'] is True
    if qid!='love-language': assert previous['ready'] is False
titles=json.loads(new['account-service/private/language-live-questions.json'])
assert titles['id']=='language' and len(titles['questions'])==10
assert list(catalog_new['questions']['language'])==[q['id'] for q in titles['questions']]
for i,q in enumerate(titles['questions']):
    meta=catalog_new['questions']['language'][q['id']]
    assert q['priceRub']==meta['tier'] and q['isFree'] is (i==0)
kb=new['account-service/private/language-live-knowledge.txt'].decode()
assert len(kb)<5000 and len(kb.strip().splitlines())==22
assert all(x.count('|')==2 and x.split('|',1)[0]==str(i)
           for i,x in enumerate(kb.strip().splitlines(),1))
for p in [x for x in files if x.endswith('.php')]:
    lint=subprocess.run(['php','-l'],input=new[p],capture_output=True)
    if lint.returncode: raise RuntimeError('PHP_LINT_'+p+' '+lint.stderr.decode(errors='replace')[:180])
for p in ['redflag-feature.js','redflag-categories.js','redflag-text-bank.js','redflag-public-catalog.js','app.js']:
    lint=subprocess.run(['node','--check',p],capture_output=True)
    if lint.returncode:raise RuntimeError('JS_SYNTAX_'+p+' '+lint.stderr.decode(errors='replace')[:180])
# Ensure native free routing, owner auth, quote without inference and buyer generation before debit.
front=new['redflag-feature.js'].decode()
assert front.index('if(question.isFree&&id==="love-language"')<front.index('if(ownerDraftInScope(question,state))')
assert 'const paragraphs=data.answer.split(/\\n\\s*\\n/)' in front
assert 'if(category==="family"||category==="language")' in front
wallet=new['account-service/private/wallet-real-payment.php'].decode()
assert wallet.count("nlSupportedPaidResource('redflag_question'")==3
assert wallet.count('nlEnsurePaidResource(')==1
assert wallet.index('nlEnsurePaidResource(')<wallet.index('naRealWalletBuy($db,$account,$config,$input,$key,$ready)')
fulfill=new['account-service/private/fulfillment.php'].decode()
assert "return nlMaterialFromCache($resource);" in fulfill
assert 'nlEnsurePaidResource(' not in fulfill
owner=new['account-service/public/numi-owner-material.php'].decode()
assert owner.index('naTestOwner($account)') < owner.index('nlEnsurePaidResource(')
assert 'nlEnsurePaidResource(' in owner
api=new['account-service/public/numi-language-free.php'].decode()
assert 'nlPermitFree' in api and "question_id'=>'love-language'" in api
assert 'GENERATION_UNAVAILABLE' in api
# No model request, paid quote or debit in synthetic local check.
local_test=r"""<?php
function naCatalogDate($value){return is_string($value)&&preg_match('/^(?:19|20)\d\d-\d\d-\d\d$/D',$value)?$value:null;}
require 'account-service/private/language-live.php';
$questions=nlQuestions();
$kb=nlKnowledge();
if(count($questions)!==10||count($kb)!==22)throw new RuntimeException('INVALID_LANGUAGE_CONTENT');
foreach($questions as $i=>$q){
  if($q['isFree']!==($i===0))throw new RuntimeException('FREE_WRONG');
  $focus=nlQuestionFocus($q['id']);
  $points=nlPointMap($q['id']);
  if(mb_strlen($focus,'UTF-8')<60||count($points)!==6
     ||!in_array('left',$points,true)||!in_array('top',$points,true))
    throw new RuntimeException('QUESTION_FOCUS_INVALID');
  foreach(range(1,31) as $day)foreach(range(1,12) as $month){
    if(!checkdate($month,$day,2000))continue;
    $calc=ni31($day,$month,2000);
    foreach($points as $point){
      if(!isset($calc[$point],$kb[$calc[$point]]))throw new RuntimeException('MATRIX_INVALID');
    }
  }
  $resource='redflag:language:'.$q['id'].':1997-05-12';
  if(nlSupportedPaidResource('redflag_question',$resource)!==($i!==0))
    throw new RuntimeException('ACCESS_INVALID');
}
$provider='Прямой ответ. '.str_repeat('Поступки заметны в обычных ситуациях. ',30)
    ."\n\n".'Но важно понять, какой способ поддержки действительно подходит ему. Какая поддержка для него правда работает?';
$normalized=nfFitFamilyAnswerLength(nfRestoreTwoParagraphs($provider));
niValidateGeneratedText($normalized,'stop');
if(mb_strlen($normalized,'UTF-8')>1800)throw new RuntimeException('FORMAT_OVERLONG');
echo 'LANGUAGE_22_10_MATRIX_VALIDATION_PASS',PHP_EOL;
"""
tested=subprocess.run(['php'],input=local_test.encode(),capture_output=True)
if tested.returncode or b'LANGUAGE_22_10_MATRIX_VALIDATION_PASS' not in tested.stdout:
    raise RuntimeError('LANGUAGE_STATIC_TEST_FAILED '+tested.stderr.decode(errors='replace')[-450:])
print('LANGUAGE_22_10_MATRIX_VALIDATION_PASS',flush=True)
def status(path):
    url='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+path+'?language_release='+str(time.time_ns())
    request=urllib.request.Request(url,headers={'Cache-Control':'no-store'})
    try:
        with urllib.request.urlopen(request,timeout=27) as response:return response.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    codes=[status(''),status('redflag-ai-lab/style-test-api.php'),status('api/numi-account.php')]
    print('SITE_HEALTH',codes,flush=True)
    return codes[0]==200 and codes[1]==403 and codes[2] in (403,405)
if not healthy():raise RuntimeError('SITE_UNHEALTHY_BEFORE_NO_WRITES')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
private=home+'/private/numi-account-20261031/'
webroot=home+'/www/xn--c1adkkdfjbp1a4l.online/'
backup=home+'/site-safeguard-backups'
def remote_path(local):
    if local.startswith('account-service/private/'):return private+local.rsplit('/',1)[-1]
    if local.startswith('account-service/public/'):return webroot+'api/'+local.rsplit('/',1)[-1]
    return webroot+local
remote={remote_path(p):p for p in files}
if len(remote)!=len(files):raise RuntimeError('REMOTE_COLLISION')
def read(path):
    target=io.BytesIO();ftp.retrbinary('RETR '+path,target.write)
    return target.getvalue()
def maybe_read(path):
    try:return read(path)
    except ftplib.error_perm as e:
        if str(e).startswith('550'):return None
        raise
def write(path,data):
    ftp.storbinary('STOR '+path,io.BytesIO(data))
    if read(path)!=data:raise RuntimeError('FTP_READBACK_MISMATCH')
saved={}
changed=[]
try:
    for dest,local in remote.items():
        existing=maybe_read(dest)
        if existing!=old[local] and existing!=new[local]:
            raise RuntimeError('REMOTE_DRIFT_NO_WRITES_'+local)
        saved[dest]=existing
    # These files and existing families/sex are explicitly off-limits.
    protected=[
      private+'family-live.php',private+'family-live-knowledge.txt',
      private+'family-live-questions.json',private+'intimacy-live.php',
      private+'intimacy-live-knowledge.json',private+'core.php',
      webroot+'wallet-client.js',webroot+'api/numi-family-free.php',
      webroot+'api/numi-intimacy-free.php',
      webroot+'redflag-ai-lab/style-test-api.php'
    ]
    digest={p:hashlib.sha256(read(p)).digest() for p in protected}
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_PREFLIGHT')
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    tag=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]
    for dest,local in remote.items():
        if saved[dest] is not None and saved[dest]!=new[local]:
            write(backup+'/before-language-live-'+tag+'-'+dest.rsplit('/',1)[-1]+'.bak',saved[dest])
    for dest,local in remote.items():
        if maybe_read(dest)!=saved[dest]:raise RuntimeError('CONCURRENT_REMOTE_EDIT')
        if saved[dest]!=new[local]:
            changed.append(dest)
            write(dest,new[local])
    if not healthy():raise RuntimeError('SITE_UNHEALTHY_AFTER')
    # Read-only GET to the new true production endpoint does not generate AI.
    endpoint_status=status('api/numi-language-free.php')
    print('LANGUAGE_FREE_GET_STATUS',endpoint_status,flush=True)
    if endpoint_status not in (400,405):
        raise RuntimeError('FREE_API_NOT_READY_OR_UNEXPECTED_STATUS_'+str(endpoint_status))
    for p,h in digest.items():
        if hashlib.sha256(read(p)).digest()!=h:raise RuntimeError('PROTECTED_REMOTE_CHANGED')
    for dest,local in remote.items():
        if read(dest)!=new[local]:raise RuntimeError('FINAL_READBACK_FAILED')
    print('LANGUAGE_LIVE_PUBLISHED 10_questions=true free_personal_ai=true paid=9'
          ' language_kb_22=true owner_preview=true customer_generated_before_debit=true'
          ' api_live=true all_unchanged_sections_preserved=true paid_ai_calls=0',flush=True)
except BaseException:
    failed=[]
    for dest in reversed(changed):
        try:
            if saved[dest] is None:ftp.delete(dest)
            else:write(dest,saved[dest])
        except BaseException:failed.append(dest)
    print('ROLLBACK_'+('FAILED_'+','.join(failed) if failed else 'SUCCESS'),flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
