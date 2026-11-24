#!/usr/bin/env python3
import os,io,json,ssl,ftplib,hashlib,time,uuid,pathlib,subprocess,urllib.request,urllib.error
ENGINE="account-service/private/intimacy-practical-engine.php"
KB="account-service/private/intimacy-practical-knowledge.txt"
API="redflag-ai-lab/intimacy-practical-preview-api.php"
base_ref="b5c9c6e1959edd76e2eb8b4265ee90af83081756"
files=[ENGINE,KB,API,"redflag-feature.js","app.js","index.html"]
old={p:subprocess.check_output(["git","show",base_ref+":"+p]) for p in files[3:]}
for p in files[:3]:old[p]=None
new={p:pathlib.Path(p).read_bytes() for p in files}
for p in [ENGINE,API]:subprocess.run(["php","-l",p],check=True)
for p in ["redflag-feature.js","app.js"]:subprocess.run(["node","--input-type=module","--check"],input=new[p],check=True)
assert b"naTestOwner(naCurrent(naDB()))" in new[API]
assert new[API].index(b"naTestOwner(naCurrent(naDB()))")<new[API].index(b"ipGenerateText(")
assert b"'draft_only'=>true,'published'=>false" in new[API]
assert new[ENGINE].count(b"niCloudCall(")==1 and b"'google/gemini-3-flash-preview'" in new[ENGINE]
assert b"file_put_contents(" not in new[ENGINE] and b"file_put_contents(" not in new[API]
assert new["redflag-feature.js"]==old["redflag-feature.js"].replace(b'section==="family"));',b'section==="family"||section==="intimacy"));').replace(b'if(question.isFree&&id==="fire"&&[...categoryStates].some(',b'if(question.isFree&&id==="fire"&&!ownerDraftInScope(question,state)&&[...categoryStates].some(').replace(b'?"/redflag-ai-lab/family-owner-preview-api.php"\n        :"/redflag-ai-lab/style-test-api.php";',b'?"/redflag-ai-lab/family-owner-preview-api.php"\n        :category==="intimacy"?"/redflag-ai-lab/intimacy-practical-preview-api.php"\n        :"/redflag-ai-lab/style-test-api.php";')
assert new["app.js"]==old["app.js"].replace(b"redflag-feature.js?v=answer-birth-date-20261124",b"redflag-feature.js?v=intimacy-practical-owner-20261124")
assert new["index.html"]==old["index.html"].replace(b"app.js?v=answer-birth-date-20261124",b"app.js?v=intimacy-practical-owner-20261124")
fixture=r"""
<?php
require 'account-service/private/intimacy-practical-engine.php';
$qs=ipQuestions();$kb=ipKnowledge();$topics=[];$follow=[];
if(count($qs)!==10||count($kb)!==22)throw new RuntimeException('COUNT_INVALID');
foreach($kb as $row)if(array_keys($row)!==ipQuestionIds())throw new RuntimeException('KEYS_INVALID');
foreach($qs as $i=>$q){
 $id=$q['id'];$points=ipPointMap($id);
 if(count($points)!==4||array_slice($points,0,3)!==['left','top','right']||count(array_unique($points))!==4)throw new RuntimeException('POINT_MAP_INVALID');
 $topics[]=$points[3];$follow[$id]=ipFollowups($id);
 if(count($follow[$id])!==2)throw new RuntimeException('FOLLOWUP_COUNT');
 foreach([[15,7,1987],[31,10,1988],[9,9,1986],[12,5,1997],[3,6,2000],[21,6,1979],[29,2,2000]] as $date){
  $matrix=ni31(...$date);$messages=ipMessages($q,...$date);
  $p=json_decode($messages[1]['content'],true,30,JSON_THROW_ON_ERROR);
  if(count($p['четыре_значимые_позиции'])!==4||$p['вопрос']!==$q['title']||$p['точная_задача']!==ipQuestionFocus($id))throw new RuntimeException('PAYLOAD_INVALID');
  foreach($points as $j=>$point){$v=$p['четыре_значимые_позиции'][$j];if($v['смысловой_ключ']!==$kb[$matrix[$point]][$id]||isset($v['ресурс'])||isset($v['тень']))throw new RuntimeException('KEY_INVALID');}
 }
 $sample=str_repeat('Это проверка формата, а не готовая трактовка. ',12)."\n\n".'Другой вопрос. '.$follow[$id][1]['вопрос'];
 $out=ipFormatAnswer($sample,$id);
 if(count(explode("\n\n",$out))!==2||!str_contains($out,$follow[$id][1]['вопрос']))throw new RuntimeException('FORMAT');
}
if(count(array_unique($topics))!==10)throw new RuntimeException('TOPICS');
echo json_encode($follow,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
"""
r=subprocess.run(["php"],input=fixture.encode(),capture_output=True)
if r.returncode:raise RuntimeError("OFFLINE_FAIL "+r.stderr.decode(errors="replace")[-1000:])
follow=json.loads(r.stdout);dec=json.JSONDecoder();catalog=pathlib.Path("redflag-public-catalog.js").read_text()
cats=dec.raw_decode(catalog.split("export const PUBLIC_CATEGORIES =",1)[1].lstrip())[0]
qs=dec.raw_decode(catalog.split("export const PUBLIC_QUESTIONS =",1)[1].lstrip())[0]
lookup={c["title"]:c["id"] for c in cats};seen=set()
for pair in follow.values():
    for q in pair:
        cat=lookup[q["раздел"]]
        assert cat!="intimacy" and any(x["title"]==q["вопрос"] and x["priceRub"]==49 for x in qs[cat])
        assert q["вопрос"] not in seen
        seen.add(q["вопрос"])
assert len(seen)==20
print("INTIMACY_PRACTICAL_OFFLINE_PASS questions=10 keys=220 dates=7 points=4 followups=20 model_calls=0",flush=True)
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
def status(p):
    req=urllib.request.Request(BASE+p+"?intimacy_practical="+str(time.time_ns()),headers={"Cache-Control":"no-store"})
    try:
        with urllib.request.urlopen(req,timeout=25) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def healthy(new=False):
    codes=[status(""),status("redflag-ai-lab/style-test-api.php"),status("redflag-ai-lab/family-owner-preview-api.php"),status("api/numi-owner-material.php"),status("api/numi-intimacy-free.php")]
    if new:codes.append(status(API))
    print("SITE_HEALTH",codes,flush=True)
    return codes[:4]==[200,403,403,403] and codes[4] in (400,403,405) and (not new or codes[5]==403)
if not healthy():raise RuntimeError("PRE_HEALTH")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45);ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip("/");private=home+"/private/numi-account-20261031/";web=home+"/www/xn--c1adkkdfjbp1a4l.online/"
def remote(p):return private+p.rsplit("/",1)[-1] if p in [ENGINE,KB] else web+p
def read(p,optional=False):
    out=io.BytesIO()
    try:ftp.retrbinary("RETR "+p,out.write)
    except ftplib.error_perm as e:
        if optional and str(e).startswith("550"):return None
        raise
    return out.getvalue()
def write(p,b):
    ftp.storbinary("STOR "+p,io.BytesIO(b))
    if read(p)!=b:raise RuntimeError("READBACK_FAIL")
protected=[private+x for x in ["intimacy-live.php","intimacy-live-knowledge.json","intimacy-live-questions.json","family-live.php","family-practical-engine.php","family-owner-knowledge-v1.txt","language-live.php","language-live-knowledge.txt","wallet-real-payment.php","fulfillment.php","core.php","redflag-catalog.json"]]+[web+x for x in ["redflag-public-catalog.js","api/numi-intimacy-free.php","api/numi-language-free.php","api/numi-owner-material.php","redflag-ai-lab/style-test-api.php","redflag-ai-lab/family-owner-preview-api.php","redflag-ai-lab/keep.php"]]
saved={};changed=[]
try:
    for p in files:
        saved[p]=read(remote(p),p in files[:3])
        if saved[p] not in (old[p],new[p]):raise RuntimeError("REMOTE_DRIFT_"+p)
    hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
    for n in ["intimacy-live.php","intimacy-live-knowledge.json","intimacy-live-questions.json","family-practical-engine.php","family-owner-knowledge-v1.txt","language-live.php","language-live-knowledge.txt"]:
        assert read(private+n)==pathlib.Path("account-service/private/"+n).read_bytes()
    backup=home+"/site-safeguard-backups"
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith("550"):raise
    tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:6]
    for p in files:
        if saved[p] is not None and saved[p]!=new[p]:write(backup+"/before-intimacy-practical-"+tag+"-"+p.rsplit("/",1)[-1]+".bak",saved[p])
    for p in files:
        if read(remote(p),p in files[:3])!=saved[p]:raise RuntimeError("REMOTE_CONCURRENT_EDIT")
        if saved[p]!=new[p]:
            changed.append(p);write(remote(p),new[p])
    if not healthy(True):raise RuntimeError("POST_HEALTH")
    for p in files:
        if read(remote(p))!=new[p]:raise RuntimeError("FINAL_BYTES")
    for p,h in hashes.items():
        if hashlib.sha256(read(p)).digest()!=h:raise RuntimeError("PROTECTED_CHANGED")
    print("INTIMACY_PRACTICAL_OWNER_LIVE 10_questions=true 220_keys=true four_positions=true 20_cross_followups=true original_customer_engine_unchanged=true family_language_unchanged=true paid_ai_calls=0",flush=True)
except BaseException:
    for p in reversed(changed):
        try:
            if saved[p] is None:ftp.delete(remote(p))
            else:write(remote(p),saved[p])
            print("ROLLBACK_OK",p,flush=True)
        except BaseException:print("ROLLBACK_FAILED",p,flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
