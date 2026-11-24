#!/usr/bin/env python3
"""Guarded Language-only practical-instruction release. No provider calls or purchases."""
import os,io,json,ssl,ftplib,hashlib,time,uuid,pathlib,subprocess,urllib.request,urllib.error
ENGINE="account-service/private/language-live.php"
KB="account-service/private/language-live-knowledge.txt"
FREE="account-service/public/numi-language-free.php"
OWNER="account-service/public/numi-owner-material.php"
files=[KB,ENGINE,FREE,OWNER]
base={ENGINE:"40b86cdd1c2cff4491ee8ed6ca0f7695564ce20f^",
      KB:"d1ad7501e109ed97fb46da7cf8e276d9116f77bf^",
      FREE:"fc5ba5ceb5949cf8985d69f794cf23ca229ac20a^",
      OWNER:"051d98661ae336d83e3f96112f6e076bb64278eb^"}
old={p:subprocess.check_output(["git","show",base[p]+":"+p]) for p in files}
new={p:pathlib.Path(p).read_bytes() for p in files}
assert all(old[p]!=new[p] for p in files)
published_engine=subprocess.check_output(["git","show","40b86cdd1c2cff4491ee8ed6ca0f7695564ce20f:"+ENGINE])
def without_prompt(b):
    t=b.decode("utf-8")
    start=t.index("function nlPrompt(): string {")
    end=t.index("function nlMessages(",start)
    return t[:start]+t[end:]
assert without_prompt(published_engine)==without_prompt(new[ENGINE]), "ONLY_LANGUAGE_PROMPT_MAY_CHANGE"
assert published_engine!=new[ENGINE]
engine=new[ENGINE].decode("utf-8")
assert "require_once __DIR__.'/intimacy-live.php';" in engine
assert "family-live.php" not in engine and "nfCloudRaw(" not in engine and "nfPointTitles(" not in engine
assert engine.count("niCloudCall(")==1 and "'google/gemini-3-flash-preview'" in engine
assert "'полная_рассчитанная_матрица_для_контекста'" not in engine
assert "'число_аркана'" not in engine
assert "return ['left','top','right',$themes[$id]];" in engine
assert "-language-instruction-v2.json" in engine and "-language-kb-v1.json" in engine
assert "niValidateGeneratedText" in engine
kb=new[KB].decode("utf-8")
assert len(kb)<=5000 and len(kb.strip().splitlines())==22
assert all(len(row.split("|"))==4 and row.split("|")[0]==str(i) for i,row in enumerate(kb.strip().splitlines(),1))
assert old[FREE].decode().replace(
    "$answer=nlPermitFree($date,$account,static fn():string=>nlEnsureAnswer('love-language',$date));",
    "$answer=$account!==null&&naTestOwner($account)\n        ?nlFreshAnswer('love-language',$date)\n        :nlPermitFree($date,$account,static fn():string=>nlEnsureAnswer('love-language',$date));")==new[FREE].decode()
assert old[OWNER].decode().replace(
    "        nlEnsurePaidResource((string)$quote['resource_id']);",
    "        $document=nlOwnerMaterial((string)$quote['resource_id']);\n        naReply(200,['ok'=>true,'owner_preview'=>true,'charged'=>false,\n            'product_code'=>$code,'material'=>$document]);")==new[OWNER].decode()
assert new[OWNER].index(b"naTestOwner($account)")<new[OWNER].index(b"nlOwnerMaterial(")
for p in [ENGINE,FREE,OWNER]:
    r=subprocess.run(["php","-l",p],capture_output=True)
    if r.returncode:raise RuntimeError("PHP_LINT_FAILED "+p+" "+r.stderr.decode(errors="replace")[-400:])
# Exercise the real 31-point calculation and exact language message builder.
# The fixture deliberately NEVER calls nlGenerateText, nlFreshAnswer or niCloudCall.
fixture=r"""
<?php
function naCatalogDate($v){if(!is_string($v)||!preg_match('/^\d{4}-\d\d-\d\d$/D',$v))return null;[$y,$m,$d]=array_map('intval',explode('-',$v));return checkdate($m,$d,$y)?$v:null;}
require 'account-service/private/language-live.php';
$qs=nlQuestions();$kb=nlKnowledge();
if(count($qs)!==10||count($kb)!==22)throw new RuntimeException('LANGUAGE_CONTENT_INVALID');
$themes=[];$follow=[];
foreach($qs as $i=>$q){
 $id=$q['id'];$points=nlPointMap($id);
 if(count($points)!==4||array_slice($points,0,3)!==['left','top','right']||count(array_unique($points))!==4)
   throw new RuntimeException('FOUR_POINT_MAP_INVALID');
 $themes[]=$points[3];
 if(($q['isFree']??null)!==($i===0))throw new RuntimeException('FREE_FLAG_CHANGED');
 if(nlSupportedPaidResource('redflag_question','redflag:language:'.$id.':1987-07-15')!==($i!==0))
   throw new RuntimeException('PAID_RESOURCE_INVALID');
 $follow[$id]=nlFollowups($id);
 if(count($follow[$id])!==2)throw new RuntimeException('FOLLOWUP_COUNT');
 foreach([[15,7,1987],[31,10,1988],[9,9,1986],[12,5,1997],[4,4,1990],[21,6,1979],[29,2,2000]] as $date){
   $matrix=ni31(...$date);
   $messages=nlMessages($q,...$date);
   if(count($messages)!==2||$messages[0]['role']!=='system'||$messages[1]['role']!=='user')
     throw new RuntimeException('MESSAGE_SHAPE');
   $p=json_decode($messages[1]['content'],true,30,JSON_THROW_ON_ERROR);
   if(count($p['четыре_значимые_позиции'])!==4||$p['вопрос']!==$q['title']||$p['точная_задача']!==nlQuestionFocus($id))
     throw new RuntimeException('PAYLOAD_INVALID');
   foreach($points as $j=>$key){
     $v=$p['четыре_значимые_позиции'][$j];
     $a=$kb[$matrix[$key]];
     if($v['значение']!==$a['core']||$v['ресурс']!==$a['plus']||$v['тень']!==$a['minus'])
       throw new RuntimeException('MATRIX_TRAITS_INCORRECT');
   }
 }
 $sample=str_repeat('Это пример проверки формата, а не готовая трактовка. ',12)."\n\n".'Ещё один ракурс. '.$follow[$id][1]['вопрос'];
 $out=nlFormatAnswer($sample,$id);
 if(count(explode("\n\n",$out))!==2||!str_contains($out,$follow[$id][1]['вопрос']))
   throw new RuntimeException('FORMATTER_INVALID');
}
if(count(array_unique($themes))!==10)throw new RuntimeException('TOPICS_NOT_DISTINCT');
echo json_encode($follow,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
"""
test=subprocess.run(["php"],input=fixture.encode(),capture_output=True)
if test.returncode:raise RuntimeError("LANGUAGE_OFFLINE_FAILED "+test.stderr.decode(errors="replace")[-900:])
follow=json.loads(test.stdout)
public=pathlib.Path("redflag-public-catalog.js").read_text()
dec=json.JSONDecoder()
cat=dec.raw_decode(public.split("export const PUBLIC_CATEGORIES =",1)[1].lstrip())[0]
qs=dec.raw_decode(public.split("export const PUBLIC_QUESTIONS =",1)[1].lstrip())[0]
title_to_id={c["title"]:c["id"] for c in cat}
seen=set()
for candidates in follow.values():
    for q in candidates:
        catid=title_to_id[q["раздел"]]
        assert catid!="language"
        match=[x for x in qs[catid] if x["title"]==q["вопрос"]]
        assert len(match)==1 and match[0]["priceRub"]==49
        assert q["вопрос"] not in seen
        seen.add(q["вопрос"])
assert len(seen)==20
private_catalog=json.loads(pathlib.Path("account-service/private/redflag-catalog.json").read_text())
language=private_catalog["questions"]["language"]
assert len(language)==10 and all(q["ready"] is True for q in language.values())
assert len(qs["language"])==10 and all(q["status"]=="ready" for q in qs["language"])
wallet=pathlib.Path("account-service/private/wallet-real-payment.php").read_text()
assert "nlEnsurePaidResource(" in wallet and "nlEngineInstalled()" in wallet
assert wallet.index("nlEnsurePaidResource(")<wallet.index("naRealWalletBuy($db,$account,$config,$input,$key,$ready)")
assert "return nlMaterialFromCache($resource);" in pathlib.Path("account-service/private/fulfillment.php").read_text()
print("LANGUAGE_OFFLINE_PASS questions=10 dates=7 points=4 kb_22=true exact_cross_followups_20=true paid_prices_preserved=true model_calls=0",flush=True)
BASE_URL="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
def status(path):
    req=urllib.request.Request(BASE_URL+path+"?language_practical="+str(time.time_ns()),headers={"Cache-Control":"no-store"})
    try:
        with urllib.request.urlopen(req,timeout=27) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    codes=[status(""),status("redflag-ai-lab/style-test-api.php"),status("redflag-ai-lab/family-owner-preview-api.php"),status("api/numi-language-free.php"),status("api/numi-owner-material.php")]
    print("SITE_HEALTH",codes,flush=True)
    return codes[0:3]==[200,403,403] and codes[3] in (400,403,405) and codes[4]==403
if not healthy():raise RuntimeError("SITE_UNHEALTHY_BEFORE")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=50)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip("/")
private=home+"/private/numi-account-20261031/"
web=home+"/www/xn--c1adkkdfjbp1a4l.online/"
def remote(p):
    return (private if p.startswith("account-service/private/") else web+"api/")+p.rsplit("/",1)[-1]
def read(p):
    out=io.BytesIO();ftp.retrbinary("RETR "+p,out.write);return out.getvalue()
def write(p,b):
    ftp.storbinary("STOR "+p,io.BytesIO(b))
    if read(p)!=b:raise RuntimeError("REMOTE_READBACK_FAILED")
def ls(p):
    try:return ftp.nlst(p)
    except ftplib.error_perm as e:
        if str(e).startswith("550"):return []
        raise
saved={};modified=[]
try:
    for p in files:
        b=read(remote(p))
        print("LANGUAGE_PREIMAGE",p.rsplit("/",1)[-1],"old",b==old[p],"new",b==new[p],flush=True)
        allowed=(published_engine,new[p]) if p==ENGINE else (new[p],)
        if b not in allowed:raise RuntimeError("REMOTE_DRIFT_NO_WRITE_"+p)
        saved[p]=b
    protected=[
        private+"family-live.php",private+"family-owner-knowledge-v1.txt",
        private+"wallet-real-payment.php",private+"fulfillment.php",private+"core.php",
        private+"intimacy-live.php",private+"intimacy-live-knowledge.json",
        private+"language-live-questions.json",private+"redflag-catalog.json",
        web+"redflag-ai-lab/style-test-api.php",web+"redflag-ai-lab/family-owner-preview-api.php",
        web+"redflag-feature.js",web+"redflag-public-catalog.js",web+"app.js",web+"index.html",
        web+"api/numi-family-free.php",web+"api/numi-intimacy-free.php"
    ]
    hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
    live_catalog=json.loads(read(private+"redflag-catalog.json"))
    assert live_catalog["questions"]["language"]==language
    live_public=read(web+"redflag-public-catalog.js").decode("utf-8")
    live_qs=dec.raw_decode(live_public.split("export const PUBLIC_QUESTIONS =",1)[1].lstrip())[0]
    assert len(live_qs["language"])==10 and all(q["status"]=="ready" for q in live_qs["language"])
    for candidates in follow.values():
        for q in candidates:
            category=title_to_id[q["раздел"]]
            assert any(v["title"]==q["вопрос"] and v["priceRub"]==49 for v in live_qs[category])
    # Read metadata only; preserve historical customer content and quotas.
    cache=private+"language-answer-cache"
    names=ls(cache)
    count_paid=sum(x.endswith(".json") and not x.rsplit("/",1)[-1].startswith("love-language-") for x in names)
    count_free=sum(x.endswith(".json") and x.rsplit("/",1)[-1].startswith("love-language-") for x in names)
    print("LANGUAGE_EXISTING_CACHE_COUNTS",{"paid_question":count_paid,"free_question":count_free},flush=True)
    if not healthy():raise RuntimeError("PREWRITE_HEALTH_FAILED")
    backup=home+"/site-safeguard-backups"
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith("550"):raise
    tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:6]
    for p in files:
        if saved[p]!=new[p]:
            write(backup+"/before-language-practical-"+tag+"-"+p.rsplit("/",1)[-1]+".bak",saved[p])
    for p in files:
        if read(remote(p))!=saved[p]:raise RuntimeError("REMOTE_CONCURRENT_EDIT")
        if saved[p]!=new[p]:
            modified.append(p);write(remote(p),new[p])
    if not healthy():raise RuntimeError("POSTWRITE_HEALTH_FAILED")
    for p in files:
        if read(remote(p))!=new[p]:raise RuntimeError("FINAL_BYTES_DIFFER")
    for p,d in hashes.items():
        if hashlib.sha256(read(p)).digest()!=d:raise RuntimeError("PROTECTED_FILE_CHANGED")
    print("LANGUAGE_PROMPT_ONLY_PUBLISHED 10_ready=true cloudru_gemini=true family_dependency_removed=true four_positions=true 22_traits=true owner_fresh_uncached=true free=1 paid=9 historical_paid_preserved=true cross_section_followups=20 no_payment_changes=true other_sections_unchanged=true paid_ai_calls=0",flush=True)
except BaseException:
    failed=[]
    for p in reversed(modified):
        try:write(remote(p),saved[p])
        except BaseException:failed.append(p)
    print("ROLLBACK_"+("FAILED" if failed else "SUCCESS"),flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
