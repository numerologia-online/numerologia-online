#!/usr/bin/env python3
"""Guarded publication: one 22-energy Family owner KB and owner-only Gemini prompt.
No AI calls, no wallet/purchase changes, no cache writes, no customer generator.
"""
import os,subprocess,pathlib,ftplib,ssl,io,hashlib,urllib.request,urllib.error,time,uuid,re
API="redflag-ai-lab/family-owner-preview-api.php"
KB="account-service/private/family-owner-knowledge-v1.txt"
OLD="c3b5a3227dbd1985b39674a562dc31c9e5fc5f3b"
old=subprocess.check_output(["git","show",OLD+":"+API])
new=pathlib.Path(API).read_bytes()
bank=pathlib.Path(KB).read_bytes()
source=new.decode("utf-8")
lines=bank.decode("utf-8").strip().splitlines()
assert len(bank.decode("utf-8"))<=5000 and len(lines)==22
for n,line in enumerate(lines,1):
    parts=line.split("|")
    assert len(parts)==4 and parts[0]==str(n) and all(parts[1:])
assert old!=new
assert source.count("niCloudCall(")==1
assert source.count("foBrief(")==2
assert "function foKnowledge(): array" in source
assert "if(count($five)!==5||$matrix['left']!==ni22($day)||$matrix['top']!==$month)" in source
assert "'энергия'=>$n" not in source
assert "family-owner-knowledge-v1.txt" in source
assert "ВТОРОЙ: примерно 600–700 знаков" in source
assert "Пиши с эффектом остроумного разоблачения" in source
assert "Если день 15" not in source and "Если день 4" not in source and "Если встречается 7" not in source
assert "'аркан'=>$names" not in source
assert "FAMILY_DRAFT_STORAGE_DISABLED" not in source
assert "file_put_contents(" not in source
assert "fopen(" not in source
assert "rename(" not in source
assert "naTestOwner(naCurrent(naDB()))" in source
assert "'model'=>'google/gemini-3-flash-preview'" in source
assert "['role'=>'user','content'=>$payload]" in source
proc=subprocess.run(["php","-l",API],capture_output=True)
if proc.returncode:raise RuntimeError("PHP_SYNTAX_INVALID "+proc.stderr.decode()[-350:])
# Offline-only structure test. Fake matrix values, no requests, no secrets.
begin=source.index("function foMap(): array")
end=source.index("function foPrompt(): string")
helpers=source[begin:end].replace(
    "dirname(__DIR__,3).'/private/numi-account-20261031/family-owner-knowledge-v1.txt'",
    "'account-service/private/family-owner-knowledge-v1.txt'")
start=source.index("function foShortenCompleteSentences(")
end2=source.index("\ntry {\n    if(!naTestOwner",start)
formatter=source[start:end2]
fixture=r"""
function ni22(int $value): int {
    while($value>22)$value=array_sum(array_map('intval',str_split((string)$value)));
    return $value?:22;
}
function ni31(int $d,int $m,int $y):array {
    $all=[];
    $keys=['left','top','right','bottom','tailSecond','wellbeing','rightNear','topLeft','bottomLeft','loveHeart','tailFirst','center','bottomRight','moneyPoint'];
    foreach($keys as $i=>$key)$all[$key]=($i%22)+1;
    $all['left']=ni22($d);$all['top']=$m;
    return $all;
}
$bank=foKnowledge();
if(count($bank)!==22)throw new RuntimeException('NOT_22');
if(count(foMap())!==10)throw new RuntimeException('NOT_10_QUESTIONS');
foreach(foMap() as $id=>$keys) {
    if(count($keys)!==5||$keys[0]!=='left'||$keys[1]!=='top')
        throw new RuntimeException('BAD_POINT_MAP_'.$id);
    foreach([[9,9,1986],[15,7,1987],[31,10,1988],[4,4,1990]] as $date) {
        $brief=foBrief($id,...$date);
        if(count($brief)!==5)throw new RuntimeException('BAD_BRIEF_SIZE');
        foreach($brief as $item) {
            foreach(['роль','суть','ресурс','тень'] as $field)
                if(!is_string($item[$field]??null)||$item[$field]==='')
                    throw new RuntimeException('MISSING_TRAIT');
            if(isset($item['аркан'])||isset($item['энергия']))
                throw new RuntimeException('ARCHETYPE_LABEL_IN_MODEL_INPUT');
        }
    }
}
$follow='Обещает и делает или просто король планов?';
$first=str_repeat('Он может обещать помощь, но предпочитает поручать её другому. ',20);
$second=str_repeat('И вот тут обнаруживается интересное противоречие в его подходе к общей ответственности. ',13).' '.$follow;
$answer=foFormatOwnerAnswer($first."\n\n".$second,[$follow]);
$paragraphs=explode("\n\n",$answer);
if(count($paragraphs)!==2)throw new RuntimeException('PARAGRAPHS_NOT_TWO');
if(mb_strlen($paragraphs[0])>850||mb_strlen($paragraphs[1])>700)
    throw new RuntimeException('PARAGRAPH_OVERLONG');
if(!str_contains($paragraphs[1],$follow))throw new RuntimeException('NEXT_QUESTION_LOST');
if(preg_match('/[—–―]/u',$answer))throw new RuntimeException('DASHES_REMAIN');
echo "FAMILY_KB_22_10_OFFLINE_PASS KB_CHARS=".mb_strlen(file_get_contents('account-service/private/family-owner-knowledge-v1.txt'))." TEASER=".mb_strlen($paragraphs[1])."\n";
"""
runner="<?php\n"+helpers+"\n"+formatter+"\n"+fixture
test=subprocess.run(["php"],input=runner.encode("utf-8"),capture_output=True)
if test.returncode or b"FAMILY_KB_22_10_OFFLINE_PASS" not in test.stdout:
    raise RuntimeError("OFFLINE_TEST_FAILED "+test.stderr.decode(errors="replace")[-650:])
print(test.stdout.decode().strip(),flush=True)
PUBLIC="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
def status(path):
    req=urllib.request.Request(PUBLIC+path+"?family_kb="+str(time.time_ns()),headers={"Cache-Control":"no-store"})
    try:
        with urllib.request.urlopen(req,timeout=25) as response:return response.status
    except urllib.error.HTTPError as ex:return ex.code
def healthy():
    values=[status(""),status("redflag-ai-lab/style-test-api.php"),
            status("redflag-ai-lab/family-owner-preview-api.php")]
    print("SITE_HEALTH",values,flush=True)
    return values==[200,403,403]
if not healthy():raise RuntimeError("SITE_UNHEALTHY_NO_WRITES")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=50)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip("/")
web=home+"/www/xn--c1adkkdfjbp1a4l.online/"
private=home+"/private/numi-account-20261031/"
remote_api=web+API
remote_kb=private+"family-owner-knowledge-v1.txt"
backup=home+"/site-safeguard-backups"
def read_maybe(path):
    result=io.BytesIO()
    try:ftp.retrbinary("RETR "+path,result.write)
    except ftplib.error_perm as e:
        if str(e).startswith("550"):return None
        raise
    return result.getvalue()
def write(path,bytes_):
    ftp.storbinary("STOR "+path,io.BytesIO(bytes_))
    if read_maybe(path)!=bytes_:raise RuntimeError("FTP_READBACK_FAILED")
def cached_files():
    path=private+"family-answer-cache"
    try:items=ftp.nlst(path)
    except ftplib.error_perm as e:
        if str(e).startswith("550"):return []
        raise
    return [item.rsplit("/",1)[-1] for item in items if item.endswith(".json")]
modified=[]
original={}
try:
    for target,expected in [(remote_api,old),(remote_kb,None)]:
        actual=read_maybe(target)
        if actual not in (expected,new if target==remote_api else bank):
            raise RuntimeError("REMOTE_DRIFT_NO_WRITES")
        original[target]=actual
    safety={
       private+"family-live.php":b"FAMILY_REBUILD_PENDING",
       web+"redflag-ai-lab/keep.php":b"FAMILY_DRAFT_STORAGE_DISABLED",
       private+"wallet-real-payment.php":b"",
       private+"intimacy-live.php":b"",
       web+"redflag-feature.js":b"family-owner-preview-api.php",
       private+"language-live.php":b""
    }
    hashes={}
    for path,marker in safety.items():
        value=read_maybe(path)
        if value is None or marker not in value:
            raise RuntimeError("PROTECTED_FILE_UNAVAILABLE")
        hashes[path]=hashlib.sha256(value).digest()
    if cached_files():raise RuntimeError("FAMILY_CACHE_JSON_EXISTS_BEFORE")
    if not healthy():raise RuntimeError("HEALTH_CHANGED_BEFORE")
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith("550"):raise
    tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:8]
    if original[remote_api]!=new:
        write(backup+"/before-family-kb-"+tag+"-owner-api.bak",original[remote_api])
    if original[remote_api]!=new:
        modified.append(remote_api);write(remote_api,new)
    if original[remote_kb]!=bank:
        modified.append(remote_kb);write(remote_kb,bank)
    if not healthy():raise RuntimeError("SITE_UNHEALTHY_AFTER")
    if read_maybe(remote_api)!=new or read_maybe(remote_kb)!=bank:
        raise RuntimeError("PUBLISHED_BYTES_MISMATCH")
    for path,digest in hashes.items():
        if hashlib.sha256(read_maybe(path)).digest()!=digest:
            raise RuntimeError("PROTECTED_FILE_CHANGED")
    if cached_files():raise RuntimeError("FAMILY_CACHE_JSON_NEWLY_CREATED")
    print("FAMILY_KB_22_PUBLISHED chars",len(bank.decode("utf-8")),
          "questions=10","no_ready_answers=true","model=gemini_3_flash_unchanged",
          "owner_only=true","family_cache_json=0","client_engine_paused=true",
          "payment_untouched=true","ai_calls=0","second_para_target=600_700",
          flush=True)
except BaseException:
    failures=[]
    for target in reversed(modified):
        try:
            if original[target] is None:ftp.delete(target)
            else:write(target,original[target])
        except BaseException:failures.append(target)
    print("ROLLBACK_"+("FAILED" if failures else "SUCCESS"),flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
