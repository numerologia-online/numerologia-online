#!/usr/bin/env python3
"""Publish rebuilt FAMILY dialogue + 22 meanings ONLY. No paid AI requests."""
import os,io,ftplib,ssl,hashlib,pathlib,subprocess,time,uuid,urllib.request,urllib.error
base="dba6f70ee501123acec2fc78e0a1a7e14ea6d5fe"
php='account-service/private/family-live.php'
bank='account-service/private/family-live-knowledge-v2.json'
prior=subprocess.check_output(['git','show',base+':'+php])
now=pathlib.Path(php).read_bytes()
kb=pathlib.Path(bank).read_bytes()
assert prior!=now and len(kb)>5000
assert b'function nfCloudRaw(' in now and b'function nfFamilyAnswerCall(' in now
assert b'family-live-knowledge-v2.json' in now
assert b'family-live-knowledge.txt' not in now
assert b'family-rebuilt-v9.json' in now and b'family-precise-v8.json' in now
assert b"google/gemini-3-flash-preview" in now
assert b"'model'=>$model" in now and b"'max_tokens'=>$tokens" in now
assert b'ni31($day,$month,$year)' in now
assert b"'-family-rebuilt-v9.json'" in now
assert b'family-live-questions.json' in now and b'family-live-followups.json' in now
assert b'function nfLegacyCachedAnswer(' in now
assert b'function nfEnsurePaidResource(' in now and b'function nfMaterialFromCache(' in now
assert b'function nfPermitFree(' in now
assert b'nfFitFamilyAnswerLength(' in now
assert b'nfTransientFamilyModelError(' in now
assert b"'independent'=>['left','top','right','bottom','tailSecond']" in now
assert b"'household'=>['left','top','wellbeing','bottom','rightNear']" in now
assert b"'в_семье'=>$a['family']" in now
assert b'50/50' not in now
assert 'Добавь ОДНУ короткую'.encode('utf-8') not in now
import json
data=json.loads(kb)
assert data['schema']=='numi-family-question-synthesis-v1'
assert len(data['arcana'])==22
assert sorted(map(int,data['arcana'].keys()))==list(range(1,23))
for i,a in data['arcana'].items():
    assert set(a)=={'core','plus','minus','family'}
    assert all(0<len(v)<=380 for v in a.values())
assert 'самостоятельн' not in data['arcana']['15']['plus']
assert 'сильные желания' in data['arcana']['15']['core'].lower()
assert 'порядок' in data['arcana']['4']['core'].lower()
assert 'родн' in data['arcana']['20']['minus']
lint=subprocess.run(['php','-l'],input=now,capture_output=True)
if lint.returncode:raise RuntimeError('FAMILY_PHP_LINT_FAILED '+lint.stderr.decode(errors='replace')[-500:])
static=r"""<?php
function naCatalogDate($d){return is_string($d)&&preg_match('/^(?:19|20)\d\d-\d\d-\d\d$/D',$d)?$d:null;}
require 'account-service/private/family-live.php';
$knowledge=nfFamilyKnowledge();
if(count($knowledge)!==22)throw new RuntimeException('KNOWLEDGE_COUNT');
if(count(nfQuestions())!==10)throw new RuntimeException('QUESTIONS_COUNT');
if(!str_ends_with(nfCacheFile('independent','1987-07-15'),'-family-rebuilt-v9.json'))
  throw new RuntimeException('CACHE_VERSION');
$dates=[[15,7,1987],[31,10,1988],[3,3,2000],[4,2,2001],[1,1,2000]];
foreach(nfQuestions() as $q){
  $roles=nfQuestionPoints($q['id']);
  if(count($roles)!==5 || $roles[0]!=='left' || $roles[1]!=='top')
    throw new RuntimeException('ROLE_SELECTION');
  foreach($dates as $dt){
    $matrix=ni31(...$dt);
    if(count($matrix)!==31)throw new RuntimeException('MATRIX_31');
    $summary=nfSummarizePointsForQuestion($q['id'],$matrix,nfPointTitles(),$knowledge);
    if(count($summary)<1||count($summary)>5)throw new RuntimeException('SYNTHESIS_SIZE');
    foreach($summary as $item){
      foreach(['роль_точки','ведущий_мотив','сильная_сторона','теневая_сторона','в_семье'] as $key)
        if(!isset($item[$key])||!is_string($item[$key])||trim($item[$key])==='')
          throw new RuntimeException('SYNTHESIS_FIELD');
    }
  }
}
$m=ni31(15,7,1987);
$values=array_map(fn($key)=>$m[$key],nfQuestionPoints('independent'));
if($values!==[15,7,7,11,8])throw new RuntimeException('15_7_QUESTION_MATH');
$dup=nfSummarizePointsForQuestion('independent',ni31(3,3,2000),nfPointTitles(),$knowledge);
$roles=$dup[0]['роль_точки']??'';
if(!str_contains($roles,'День рождения')||!str_contains($roles,'Месяц рождения'))
   throw new RuntimeException('REPEATED_ARCANA_ROLES');
if(nfTransientFamilyModelError(new RuntimeException('PROVIDER_TIMEOUT')))
    throw new RuntimeException('NO_SLOW_RETRY');
echo 'FAMILY_REBUILD_STATIC_TESTS_PASS',PHP_EOL;
"""
test=subprocess.run(['php'],input=static.encode(),capture_output=True)
if test.returncode or b'FAMILY_REBUILD_STATIC_TESTS_PASS' not in test.stdout:
    raise RuntimeError('FAMILY_REBUILD_STATIC_TEST_FAILED '+test.stderr.decode(errors='replace')[-700:])
print('FAMILY_REBUILD_STATIC_TESTS_PASS',flush=True)
def site_status(path):
    url='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+path+'?familyrebuild='+str(time.time_ns())
    req=urllib.request.Request(url,headers={'Cache-Control':'no-store'})
    try:
        with urllib.request.urlopen(req,timeout=25) as response:return response.status
    except urllib.error.HTTPError as exc:return exc.code
def site_ok():
    states=[site_status(''),site_status('redflag-ai-lab/style-test-api.php'),site_status('api/numi-account.php')]
    print('SITE_HEALTH',states,flush=True)
    return states[0]==200 and states[1]==403 and states[2] in (403,405)
if not site_ok():raise RuntimeError('PUBLIC_SITE_UNHEALTHY_BEFORE_NO_WRITE')
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=48)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
directory=home+'/private/numi-account-20261031/'
www=home+'/www/xn--c1adkkdfjbp1a4l.online/'
dest_php=directory+'family-live.php'
dest_kb=directory+'family-live-knowledge-v2.json'
backup=home+'/site-safeguard-backups'
def retrieve(path):
    data=io.BytesIO()
    ftp.retrbinary('RETR '+path,data.write)
    return data.getvalue()
def put(path,data):
    ftp.storbinary('STOR '+path,io.BytesIO(data))
    if retrieve(path)!=data:raise RuntimeError('FTP_VERIFY_FAILED')
def optional_retrieve(path):
    try:return retrieve(path)
    except ftplib.error_perm as e:
        if str(e).startswith('550'):return None
        raise
saved_php=None;saved_kb=None;php_written=False;kb_written=False
try:
    saved_php=retrieve(dest_php)
    if saved_php not in (prior,now):raise RuntimeError('FAMILY_PHP_REMOTE_DRIFT')
    saved_kb=optional_retrieve(dest_kb)
    if saved_kb not in (None,kb):raise RuntimeError('FAMILY_NEW_KB_REMOTE_DRIFT')
    protected=[
      directory+'family-live-knowledge.txt',directory+'family-live-questions.json',
      directory+'family-live-followups.json',directory+'intimacy-live.php',
      directory+'intimacy-live-knowledge.json',directory+'language-live.php',
      directory+'language-live-knowledge.txt',directory+'wallet-real-payment.php',
      directory+'fulfillment.php',directory+'core.php',
      www+'index.html',www+'redflag-feature.js',www+'redflag-public-catalog.js',
      www+'api/numi-family-free.php',www+'api/numi-owner-material.php'
    ]
    protected_hashes={p:hashlib.sha256(retrieve(p)).digest() for p in protected}
    if not site_ok():raise RuntimeError('SITE_CHANGED_PREFLIGHT')
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith('550'):raise
    key=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]
    if saved_php!=now:
        put(backup+'/before-family-rebuilt-'+key+'.php.bak',saved_php)
    if saved_kb is not None and saved_kb!=kb:
        raise RuntimeError('NEW_BANK_CONCURRENT_EDIT')
    if retrieve(dest_php)!=saved_php or optional_retrieve(dest_kb)!=saved_kb:
        raise RuntimeError('PREWRITE_REMOTE_CONCURRENT_EDIT')
    # Upload knowledge FIRST, then php. New answer generation must never see a missing bank.
    if saved_kb!=kb:
        kb_written=True;put(dest_kb,kb)
    if saved_php!=now:
        php_written=True;put(dest_php,now)
    if not site_ok():raise RuntimeError('SITE_UNHEALTHY_AFTER')
    for protected_path,digest in protected_hashes.items():
        if hashlib.sha256(retrieve(protected_path)).digest()!=digest:
            raise RuntimeError('PROTECTED_FILE_CHANGED')
    if retrieve(dest_php)!=now or retrieve(dest_kb)!=kb:
        raise RuntimeError('FAMILY_REMOTE_READBACK_CHANGED')
    print('FAMILY_REBUILT_PUBLISHED only_family=true new_bank_22=true five_points=true'
      ' intimacy_style_adapted=true generic_family_bank_retired=true'
      ' all_10_questions_unchanged=true legacy_paid_caches_readable=true'
      ' owner_wallet_untouched=true Gemini_3_Flash_only=true'
      ' other_sections_unchanged=true paid_model_tests=0',flush=True)
except BaseException:
    failures=[]
    if php_written and saved_php is not None:
        try:put(dest_php,saved_php)
        except BaseException:failures.append('PHP')
    if kb_written and not failures:
        try:
            if saved_kb is None:ftp.delete(dest_kb)
            else:put(dest_kb,saved_kb)
        except BaseException:failures.append('KB')
    print('ROLLBACK_'+('FAILED_'+','.join(failures) if failures else 'SUCCESS'),flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
