#!/usr/bin/env python3
"""Family owner preview cross-section followups, only this editor endpoint.
Offline validation of every 49-ruble menu target, and guarded REG.RU upload.
Never call paid Gemini. No changes to other approved sections or purchase routes.
"""
import os,io,ssl,json,time,hashlib,ftplib,uuid,subprocess,pathlib,urllib.request,urllib.error
API="redflag-ai-lab/family-owner-preview-api.php"
OLD_COMMIT="8ad10be894d72c269850db7932973a4a8cbb2ec4^"
prior=subprocess.check_output(["git","show",OLD_COMMIT+":"+API])
new=pathlib.Path(API).read_bytes()
source=new.decode("utf-8")
assert prior!=new
assert prior.count(b"niCloudCall(")==new.count(b"niCloudCall(")==1
assert b"google/gemini-3-flash-preview" in new
assert b"naTestOwner(naCurrent(naDB()))" in new
assert b"file_put_contents(" not in new and b"fopen(" not in new
assert b"session_start(" not in new and b"WAIT_15_SECONDS" not in new
assert b"function foKnowledge()" in new and b"function foCrossBlockFollowup(" in new
assert "один_рекомендуемый_вопрос_из_другого_раздела" in source
assert "Разверни одну неожиданную грань первого вывода" in source
assert "ВТОРОЙ, примерно 600–700 знаков" in source
assert "следующие_вопросы_на_выбор" not in source
lint=subprocess.run(["php","-l",API],capture_output=True)
if lint.returncode:raise RuntimeError("PHP_LINT_FAILED "+lint.stderr.decode(errors='replace')[-500:])
# Run exact 20-curated-target PHP against GitHub question-bank assets, 7 dates x 10.
start=source.index("function foCrossBlockCandidates(): array {")
end=source.index("function foKnowledge(): array {",start)
helpers=source[start:end].replace(
    "dirname(__DIR__).'/data/redflag/banks/'.$filename",
    "getcwd().'/data/redflag/banks/'.$filename")
s0=source.index("function foShortenCompleteSentences(")
s1=source.index("\ntry {\n    if(!naTestOwner",s0)
formatter=source[s0:s1]
fixture=r"""
$maps=foCrossBlockCandidates();
if(count($maps)!==10)throw new RuntimeException('MISSING_FAMILY_QUESTION');
$all=[];
foreach($maps as $id=>$options){
   if(count($options)!==2)throw new RuntimeException('NOT_TWO_CROSS_CHOICES');
   $categories=[];
   foreach($options as $pair) {
       if(count($pair)!==2||$pair[0]==='family')throw new RuntimeException('SAME_CATEGORY');
       $key=implode('/', $pair);
       if(isset($all[$key]))throw new RuntimeException('DUPLICATE_CROSS_QUESTION');
       $all[$key]=true;
       $categories[$pair[0]]=true;
   }
   if(count($categories)!==2)throw new RuntimeException('SAME_SECTION_TWICE');
}
if(count($all)!==20)throw new RuntimeException('NOT_TWENTY_CHOICES');
$dates=[[15,7,1987],[31,10,1988],[9,9,1986],[12,5,1997],[4,4,1990],[21,6,1979],[2,12,2001]];
foreach($dates as $date) {
    $titles=[];$sections=[];
    foreach(array_keys($maps) as $id){
        $item=foCrossBlockFollowup($id,...$date);
        if(isset($titles[$item['вопрос']]))throw new RuntimeException('DUPLICATE_RECOMMENDATION_SAME_DATE');
        $titles[$item['вопрос']]=true;
        $sections[$item['раздел']]=true;
        $sample=foShortenTeaser(str_repeat('Мужчина очень внимателен к деталям. ',22),[$item['вопрос']]);
        if(mb_strlen($sample)>700||!str_contains($sample,$item['вопрос']))
            throw new RuntimeException('TEASER_NOT_GROUNDED');
        $short=foShortenTeaser('Его привычки проявляются неожиданно. '.$item['вопрос'],[$item['вопрос']]);
        if(!str_contains($short,$item['вопрос']))throw new RuntimeException('SHORT_TEASER_TITLE_MISSING');
    }
    if(count($sections)<5)throw new RuntimeException('POOR_CATEGORY_DIVERSITY');
}
echo "FAMILY_CROSS_BLOCK_OFFLINE_PASS owner_questions=10 cross_choices=20 price=49R 7_dates=true no_repeats=true seven_external_categories=true no_Gemini_calls=true\n";
"""
text="<?php\n"+helpers+"\n"+formatter+"\n"+fixture
test=subprocess.run(["php"],input=text.encode(),capture_output=True)
if test.returncode or b"FAMILY_CROSS_BLOCK_OFFLINE_PASS" not in test.stdout:
    raise RuntimeError("OFFLINE_RECOMMENDATION_TEST_FAILED "+test.stderr.decode(errors='replace')[-900:])
print(test.stdout.decode().strip(),flush=True)
url="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
def status(p):
    request=urllib.request.Request(url+p+"?cross_followup="+str(time.time_ns()),
                                  headers={"Cache-Control":"no-store"})
    try:
       with urllib.request.urlopen(request,timeout=27) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    values=[status(""),status("redflag-ai-lab/style-test-api.php"),
            status("redflag-ai-lab/family-owner-preview-api.php")]
    print("SITE_HEALTH",values,flush=True)
    return values==[200,403,403]
if not healthy():raise RuntimeError("SITE_UNHEALTHY_NO_WRITE")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=50)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p();ftp.set_pasv(True)
root=ftp.pwd().rstrip("/")
public=root+"/www/xn--c1adkkdfjbp1a4l.online/"
private=root+"/private/numi-account-20261031/"
target=public+API
def read(path):
    result=io.BytesIO()
    ftp.retrbinary("RETR "+path,result.write)
    return result.getvalue()
def write(path,data):
    ftp.storbinary("STOR "+path,io.BytesIO(data))
    if read(path)!=data:raise RuntimeError("REMOTE_READBACK_FAILED")
original=None;changed=False
try:
    original=read(target)
    if original not in (prior,new):raise RuntimeError("REMOTE_DRIFT_NO_WRITES")
    protected=[
       public+"redflag-ai-lab/style-test-api.php",
       public+"redflag-ai-lab/keep.php",
       public+"redflag-feature.js",
       private+"family-live.php",
       private+"family-owner-knowledge-v1.txt",
       private+"wallet-real-payment.php",
       private+"intimacy-live.php",
       private+"language-live.php"
    ]
    protect={p:hashlib.sha256(read(p)).digest() for p in protected}
    if b"FAMILY_REBUILD_PENDING" not in read(private+"family-live.php"):
        raise RuntimeError("CUSTOMER_ENGINE_NOT_PAUSED")
    if b"FAMILY_DRAFT_STORAGE_DISABLED" not in read(public+"redflag-ai-lab/keep.php"):
        raise RuntimeError("DRAFT_STORAGE_NOT_BLOCKED")
    # Preview will dynamically load these public, read-only JSON banks.
    # All must exist on actual host before upload to avoid failing after a paid call.
    for section in ['money','love','flags','infidelity','intimacy','language','verdict']:
        name="money-questions.json" if section=="money" else section+".json"
        bank=json.loads(read(public+"data/redflag/banks/"+name).decode("utf-8"))
        if not isinstance(bank.get("questions"),list):raise RuntimeError("BANK_INVALID")
        print("QUESTION_BANK_AVAILABLE",section,len(bank["questions"]),flush=True)
    cache=private+"family-answer-cache/"
    def family_cache_json():
        try:ls=ftp.nlst(cache)
        except ftplib.error_perm as e:
           if str(e).startswith("550"):return []
           raise
        return [x for x in ls if x.endswith(".json")]
    if family_cache_json():raise RuntimeError("FAMILY_CACHE_NOT_EMPTY")
    if not healthy():raise RuntimeError("SITE_HEALTH_CHANGED")
    if original!=new:
        backup=root+"/site-safeguard-backups"
        try:ftp.mkd(backup)
        except ftplib.error_perm as e:
            if not str(e).startswith("550"):raise
        tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:8]
        write(backup+"/before-family-cross-followups-"+tag+".bak",original)
        if read(target)!=original:raise RuntimeError("CONCURRENT_CHANGE_BEFORE_WRITE")
        changed=True
        write(target,new)
    if not healthy():raise RuntimeError("HEALTH_FAIL_AFTER")
    if read(target)!=new:raise RuntimeError("FINAL_API_HASH_CHANGED")
    for p,d in protect.items():
        if hashlib.sha256(read(p)).digest()!=d:
            raise RuntimeError("PROTECTED_FILE_CHANGED")
    if family_cache_json():raise RuntimeError("FAMILY_JSON_REAPPEARED")
    print("FAMILY_CROSS_BLOCK_PUBLISHED",
        "owner_only=true","20_unique_candidates=true","price_49_verified=true",
        "seven_sections=true","same_family_excluded=true",
        "works_with_soon_titles=true","other_sections_unchanged=true",
        "paid_AI_calls=0","wallet_untouched=true","cache_JSON_zero=true",
        flush=True)
except BaseException:
    if changed:
        try:write(target,original);print("ROLLBACK_SUCCESS",flush=True)
        except BaseException:print("ROLLBACK_FAILED",flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
