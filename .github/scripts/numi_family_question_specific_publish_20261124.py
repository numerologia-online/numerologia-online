#!/usr/bin/env python3
"""Only Family OWNER preview: question-specific synthesis + concise 22-arcana traits.
No Gemini calls. No changes to customer routes, payments, other prompt files, JSON.
"""
import os,ftplib,ssl,io,hashlib,time,subprocess,pathlib,urllib.request,urllib.error,uuid
API="redflag-ai-lab/family-owner-preview-api.php"
KB="account-service/private/family-owner-knowledge-v1.txt"
BEFORE_API="d7680d93f96f33fd1f3ecef88a150979c20a132b^"
BEFORE_KB="451fd6efed719932fd12ffdb40ded1e55d7bf95b^"
old_api=subprocess.check_output(["git","show",BEFORE_API+":"+API])
old_kb=subprocess.check_output(["git","show",BEFORE_KB+":"+KB])
new_api=pathlib.Path(API).read_bytes()
new_kb=pathlib.Path(KB).read_bytes()
src=new_api.decode("utf-8")
lines=new_kb.decode("utf-8").strip().splitlines()
assert len(lines)==22 and len(new_kb.decode("utf-8"))<=5000
for i,line in enumerate(lines,1):
  parts=line.split("|")
  assert len(parts)==4 and parts[0]==str(i) and all(x.strip() for x in parts[1:])
assert old_api!=new_api and old_kb!=new_kb
assert old_api.count(b"niCloudCall(")==new_api.count(b"niCloudCall(")==1
assert b"google/gemini-3-flash-preview" in new_api
assert b"naTestOwner(naCurrent(naDB()))" in new_api
assert b"function foThemePoint()" in new_api
assert "Тематическая опора".encode() in new_api
assert b"FAMILY_OWNER_KNOWLEDGE_UNAVAILABLE" in new_api
assert "ВТОРОЙ, примерно 600".encode() in new_api
assert b"file_put_contents(" not in new_api and b"fopen(" not in new_api
assert b"session_start(" not in new_api and b"WAIT_15_SECONDS" not in new_api
assert "Пиши с эффектом остроумного разоблачения" in src
lint=subprocess.run(["php","-l",API],capture_output=True)
if lint.returncode:raise RuntimeError("PHP_LINT_FAILED "+lint.stderr.decode(errors='replace')[-350:])
# Execute all 22 knowledge entries and all 10 question-specific mappings offline,
# using the EXACT matrix implementation used by the live endpoint.
helpers=src[src.index("function foMap(): array {"):src.index("function foPrompt(): string {")]
helpers=helpers.replace(
   "dirname(__DIR__,3).'/private/numi-account-20261031/family-owner-knowledge-v1.txt'",
   "'account-service/private/family-owner-knowledge-v1.txt'")
fixture=r"""
<?php
require 'account-service/private/intimacy-live.php';
$expected=['independent','household','vacation','plans','children','roles','home',
           'conflict','money-at-home','care'];
$kb=foKnowledge();
if(count($kb)!==22)throw new RuntimeException('BAD_BANK');
if(array_keys(foMap())!==$expected||array_keys(foFocus())!==$expected||
   array_keys(foThemePoint())!==$expected)
    throw new RuntimeException('BAD_QUESTION_INDEX');
$dates=[[15,7,1987],[31,10,1988],[9,9,1986],[12,5,1997],
        [4,4,1990],[21,6,1979],[2,12,2001]];
foreach($dates as $d){
    $matrix=ni31(...$d);
    if(count($matrix)!==31)throw new RuntimeException('MATRIX_NOT_31');
    $questionSignatures=[];
    foreach($expected as $question){
        $points=foMap()[$question];
        if(count($points)!==5||count(array_unique($points))!==5||
           $points[0]!=='left'||$points[1]!=='top')
            throw new RuntimeException('BAD_5_POINT_MAP');
        if(!in_array(foThemePoint()[$question],array_slice($points,2),true))
            throw new RuntimeException('THEME_NOT_SELECTED');
        $traits=foBrief($question,...$d);
        if(count($traits)!==5)throw new RuntimeException('NOT_5_TRAITS');
        if(count(array_filter($traits,fn($t)=>isset($t['для_вопроса'])))!==1)
            throw new RuntimeException('NO_EXACT_THEME_MARK');
        foreach($traits as $trait){
            if(!isset($trait['роль'],$trait['суть'],$trait['ресурс'],$trait['тень']))
                throw new RuntimeException('INCOMPLETE_TRAITS');
            if(isset($trait['аркан'],$trait['число']))throw new RuntimeException('NUMBER_LEAK');
        }
        $questionSignatures[$question]=implode(',',array_map(
            static fn($key)=>$matrix[$key],$points));
    }
    if(count(array_unique(array_values($questionSignatures)))<7)
        throw new RuntimeException('MAPPING_NOT_DISTINCT_ENOUGH');
}
echo "QUESTION_SPECIFIC_OFFLINE_OK 22_energies=22 10_questions=10 31_matrix_positions=true seven_dates=true no_ai_calls=true\n";
"""
test=subprocess.run(["php"],input=(fixture.replace("<?php", "<?php\n"+helpers,1)).encode(),capture_output=True)
if test.returncode or b"QUESTION_SPECIFIC_OFFLINE_OK" not in test.stdout:
  raise RuntimeError("OFFLINE_TEST_FAILED "+test.stderr.decode(errors='replace')[-650:])
print(test.stdout.decode().strip(),flush=True)
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
def status(path):
   req=urllib.request.Request(BASE+path+"?family_specific="+str(time.time_ns()),
                              headers={"Cache-Control":"no-store"})
   try:
      with urllib.request.urlopen(req,timeout=26) as r:return r.status
   except urllib.error.HTTPError as e:return e.code
def healthy():
   codes=[status(""),status("redflag-ai-lab/style-test-api.php"),
          status("redflag-ai-lab/family-owner-preview-api.php")]
   print("SITE_HEALTH",codes,flush=True)
   return codes==[200,403,403]
if not healthy():raise RuntimeError("HEALTH_PRECHECK_FAILED")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip("/")
web=home+"/www/xn--c1adkkdfjbp1a4l.online/"
private=home+"/private/numi-account-20261031/"
targets={private+"family-owner-knowledge-v1.txt":(old_kb,new_kb),
         web+"redflag-ai-lab/family-owner-preview-api.php":(old_api,new_api)}
def read(p):
   buf=io.BytesIO();ftp.retrbinary("RETR "+p,buf.write);return buf.getvalue()
def write(p,b):
   ftp.storbinary("STOR "+p,io.BytesIO(b))
   if read(p)!=b:raise RuntimeError("FTP_READBACK_MISMATCH")
original={};modified=[]
try:
   # Validate all expected remote preimages before writing either file.
   for p,(prior,after) in targets.items():
      value=read(p)
      if value not in (prior,after):raise RuntimeError("REMOTE_DRIFT_NO_WRITES")
      original[p]=value
   protected=[
      private+"family-live.php",private+"wallet-real-payment.php",
      private+"intimacy-live.php",private+"language-live.php",
      web+"redflag-ai-lab/style-test-api.php",
      web+"redflag-ai-lab/keep.php",web+"redflag-feature.js",
      web+"app.js",web+"index.html",
   ]
   protectedHashes={p:hashlib.sha256(read(p)).digest() for p in protected}
   if b"FAMILY_REBUILD_PENDING" not in read(private+"family-live.php"):
      raise RuntimeError("DISABLED_CUSTOMER_ENGINE_CHANGED")
   if b"FAMILY_DRAFT_STORAGE_DISABLED" not in read(web+"redflag-ai-lab/keep.php"):
      raise RuntimeError("OWNER_JSON_STORAGE_DISABLED_CHECK_FAILED")
   def family_cache():
      try:ls=ftp.nlst(private+"family-answer-cache/")
      except ftplib.error_perm as e:
         if str(e).startswith("550"):return []
         raise
      return [x for x in ls if x.endswith(".json")]
   if family_cache():raise RuntimeError("CACHE_NOT_EMPTY_NO_WRITE")
   if not healthy():raise RuntimeError("HEALTH_BEFORE_WRITES_FAILED")
   backup=home+"/site-safeguard-backups"
   try:ftp.mkd(backup)
   except ftplib.error_perm as e:
      if not str(e).startswith("550"):raise
   tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:8]
   for p,(old,new) in targets.items():
      if original[p]!=new:
         write(backup+"/before-family-question-specific-"+tag+"-"+p.rsplit("/",1)[-1]+".bak",original[p])
   for p,(old,new) in targets.items():
      if read(p)!=original[p]:raise RuntimeError("REMOTE_CONCURRENT_CHANGE")
      if original[p]!=new:
         modified.append(p)
         write(p,new)
   if not healthy():raise RuntimeError("HEALTH_POST_DEPLOY_FAILED")
   for p,(old,new) in targets.items():
      if read(p)!=new:raise RuntimeError("FINAL_BYTES_MISMATCH")
   for p,sha in protectedHashes.items():
      if hashlib.sha256(read(p)).digest()!=sha:raise RuntimeError("PROTECTED_FILE_CHANGED")
   if family_cache():raise RuntimeError("NEW_JSON_CREATED_UNEXPECTEDLY")
   print("FAMILY_QUESTION_SPECIFIC_PUBLISHED",
      "only_owner_api_and_private_KB=true",
      "day_month_lead=true",
      "question_theme_10=true",
      "22_balanced_energies=true",
      "model_unchanged=true",
      "no_PHP_15s_lock=true",
      "other_sections_unchanged=true",
      "customer_generation_still_disabled=true",
      "family_JSON_cache_zero=true",
      "paid_AI_calls=0",flush=True)
except BaseException:
   failed=False
   for p in reversed(modified):
      try:write(p,original[p])
      except BaseException:failed=True
   print("ROLLBACK_"+("FAILED" if failed else "SUCCESS"),flush=True)
   raise
finally:
   try:ftp.quit()
   except BaseException:ftp.close()
