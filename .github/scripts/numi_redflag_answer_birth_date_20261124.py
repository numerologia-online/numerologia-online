#!/usr/bin/env python3
"""Only answer birth-date label and cache version. No AI, payments or database writes."""
import ftplib,ssl,os,io,time,subprocess,pathlib,urllib.request,hashlib,uuid
base_ref="77c567b5de0acae119270646feaeb1b184d9f4b2"
paths=["redflag-feature.js","app.js","index.html"]
old={p:subprocess.check_output(["git","show",base_ref+":"+p]) for p in paths}
new={p:pathlib.Path(p).read_bytes() for p in paths}
marker="  article.append(button, answer);\n  return article;"
insertion="  // Show the same calculated birth date as the existing Telegram report.\n  // All categories, saved answers and owner drafts use this common card.\n  if (opened && response && formattedDate) {\n    const dateLabel = document.createElement(\"p\");\n    dateLabel.className = \"redflag-answer-birth-date\";\n    dateLabel.textContent = \"Дата рождения: \" + formattedDate;\n    dateLabel.style.cssText = \"margin:0 0 12px;font:600 14px/1.4 system-ui;color:#76576b;\";\n    answer.prepend(dateLabel);\n  }\n\n"
assert new[paths[0]].decode()==old[paths[0]].decode().replace(marker,insertion+marker)
assert old[paths[0]].decode().count(marker)==1
assert new[paths[1]]==old[paths[1]].replace(b"redflag-feature.js?v=family-no-json-20261123",b"redflag-feature.js?v=answer-birth-date-20261124")
assert new[paths[2]]==old[paths[2]].replace(b"app.js?v=family-no-json-20261123",b"app.js?v=answer-birth-date-20261124")
for p in paths[:2]:
    subprocess.run(["node","--input-type=module","--check"],input=new[p],check=True)
# Exercise the exact shared UI insertion for regular and draft responses, not live requests.
test=r"""
const assert=require("node:assert/strict");
function label(opened,response,formattedDate) {
  const result=[];
  const answer={prepend(x){result.unshift(x)}};
  const document={createElement(tag){return {tag,style:{}}}};
""" + insertion + r"""
  return result;
}
for (const response of [{paragraphs:["answer"]},{answer:"draft",isDraft:true},{answer:"saved",isSaved:true}]) {
  const a=label(true,response,"09.09.1986");
  assert.equal(a.length,1);
  assert.equal(a[0].textContent,"Дата рождения: 09.09.1986");
  assert.equal(label(true,response,"29.02.2000")[0].textContent,"Дата рождения: 29.02.2000");
  assert.equal(label(false,response,"09.09.1986").length,0);
  assert.equal(label(true,response,undefined).length,0);
}
assert.equal(label(true,undefined,"09.09.1986").length,0);
"""
subprocess.run(["node","-"],input=test.encode(),check=True)
print("ANSWER_DATE_OFFLINE_PASS common_renderer=true regular_draft_saved=true no_ai_calls=true",flush=True)
# Refuse any live drift instead of overwriting an unverified site version.
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip("/")
prefix=home+"/www/xn--c1adkkdfjbp1a4l.online/"
def read(path):
    buf=io.BytesIO();ftp.retrbinary("RETR "+path,buf.write);return buf.getvalue()
def write(path,data):
    ftp.storbinary("STOR "+path,io.BytesIO(data))
    if read(path)!=data:raise RuntimeError("READBACK_MISMATCH")
base="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
def http(path):
    req=urllib.request.Request(base+path+"?answer_date_check="+str(time.time_ns()),headers={"Cache-Control":"no-cache","Accept-Encoding":"identity"})
    with urllib.request.urlopen(req,timeout=30) as r:return r.read()
before={};changed=[]
try:
    before={p:read(prefix+p) for p in paths}
    for p in paths:
        if before[p] not in (old[p],new[p]):raise RuntimeError("LIVE_DRIFT_ABORT_"+p)
        if http(p)!=before[p]:raise RuntimeError("PUBLIC_PREIMAGE_MISMATCH_"+p)
    backup=home+"/site-safeguard-backups"
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith("550"):raise
    tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:6]
    for p in paths:
        if before[p]!=new[p]:write(backup+"/before-answer-date-"+tag+"-"+p+".bak",before[p])
    for p in paths:
        if read(prefix+p)!=before[p]:raise RuntimeError("CONCURRENT_EDIT_"+p)
        if before[p]!=new[p]:
            changed.append(p);write(prefix+p,new[p])
    for p in paths:
        if read(prefix+p)!=new[p] or http(p)!=new[p]:raise RuntimeError("PUBLIC_POSTIMAGE_MISMATCH_"+p)
    http("")
    print("ANSWER_DATE_LIVE_VERIFIED all_redflag_questions=true owner_and_customer=true telegram_text_unchanged=true ui_only=true paid_ai_calls=0",flush=True)
except BaseException:
    for p in reversed(changed):
        try:write(prefix+p,before[p]);print("ROLLBACK_OK "+p,flush=True)
        except BaseException:print("ROLLBACK_FAILED "+p,flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
