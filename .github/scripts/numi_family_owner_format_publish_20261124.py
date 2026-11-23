#!/usr/bin/env python3
"""Guarded REG.RU publication of FAMILY owner-preview formatting ONLY.
No AI or wallet calls. Verifies 2 paragraphs, cap and dash normalization offline.
"""
import os,subprocess,pathlib,hashlib,ftplib,ssl,io,urllib.request,urllib.error,time,uuid
TARGET="redflag-ai-lab/family-owner-preview-api.php"
CHANGE="3ba866cfba97c10b3499bcaa71b52dd020f91b07"
old=subprocess.check_output(["git","show",CHANGE+"^:"+TARGET])
new=pathlib.Path(TARGET).read_bytes()
assert old!=new
assert b"function foFormatOwnerAnswer(" in new
assert b"FAMILY_PREVIEW_PARAGRAPHS_INVALID" in new
assert new.count(b"niCloudCall(")==old.count(b"niCloudCall(")==1
assert new.count(b"foBrief(")==old.count(b"foBrief(")
assert b"google/gemini-3-flash-preview" in new
assert b"'category'=>'family'" in new
assert b"naTestOwner(naCurrent(naDB()))" in new
assert b"JEST" not in new
assert b"file_put_contents(" not in new
assert b"rename(" not in new
assert b"fopen(" not in new
assert b"family-owner-preview-api.php" not in old
# Syntax and no-provider synthetic formatting tests.
proc=subprocess.run(["php","-l",TARGET],capture_output=True)
if proc.returncode:raise RuntimeError("PHP_LINT_FAILED "+proc.stderr.decode()[-300:])
s=new.decode("utf-8")
start=s.index("function foShortenCompleteSentences(")
end=s.index("\ntry {\n    if(!naTestOwner",start)
helpers=s[start:end]
fixture=r"""<?php
$question='Обещает и делает или просто король планов?';
$first=str_repeat('Он обещает помочь, но потом предлагает тебе распределить все домашние дела. ',20);
$second=str_repeat('При этом он очень убедительно объясняет, почему у него нет времени. ',12).' '.$question;
$text=foFormatOwnerAnswer($first."\n\n".$second,[$question]);
$parts=preg_split('/\n\s*\n/u',$text);
if(count($parts)!==2)throw new RuntimeException('NOT_TWO_PARAGRAPHS');
if(mb_strlen($parts[0])>850)throw new RuntimeException('FIRST_OVERLONG');
if(mb_strlen($parts[1])>210)throw new RuntimeException('TEASER_OVERLONG');
if(strpos($parts[1],$question)===false)throw new RuntimeException('FOLLOWUP_NOT_PRESERVED');
if(preg_match('/[—–―]/u',$text))throw new RuntimeException('DASH_NOT_NORMALIZED');
$short='Прямой ответ. Он умеет взяться за дело.'."\n\n".'Но кто будет отвечать за результат?';
$unchanged=foFormatOwnerAnswer($short,[$question]);
if($short!==$unchanged)throw new RuntimeException('SHORT_TEXT_CHANGED');
$withDash=foFormatOwnerAnswer('Он — хозяйственный, но не всегда берётся за рутину.'."\n\n".'А вот ещё один вопрос — кто отвечает за результат?',[$question]);
if(preg_match('/[—–―]/u',$withDash))throw new RuntimeException('EM_DASH_REMAINS');
echo "FORMAT_FIXTURE_PASS first=".mb_strlen($parts[0])." teaser=".mb_strlen($parts[1])."\n";
"""
test=subprocess.run(["php"],input=("<?php\n"+helpers+"\n"+fixture.removeprefix("<?php")).encode(),capture_output=True)
if test.returncode or b"FORMAT_FIXTURE_PASS" not in test.stdout:
  raise RuntimeError("FORMAT_FIXTURE_FAILED "+test.stderr.decode()[-500:])
print(test.stdout.decode().strip(),flush=True)
urlbase="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
def status(path):
  request=urllib.request.Request(urlbase+path+"?family_format="+str(time.time_ns()),headers={"Cache-Control":"no-store"})
  try:
    with urllib.request.urlopen(request,timeout=27) as r:return r.status
  except urllib.error.HTTPError as e:return e.code
def health():
  codes=[status(""),status("redflag-ai-lab/style-test-api.php"),
         status("redflag-ai-lab/family-owner-preview-api.php")]
  print("SITE_HEALTH",codes,flush=True)
  return codes==[200,403,403]
if not health():raise RuntimeError("SITE_UNHEALTHY_PRECHECK")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip("/")
remote=home+"/www/xn--c1adkkdfjbp1a4l.online/"+TARGET
backup=home+"/site-safeguard-backups"
def read(path):
  buf=io.BytesIO();ftp.retrbinary("RETR "+path,buf.write);return buf.getvalue()
def write(path,blob):
  ftp.storbinary("STOR "+path,io.BytesIO(blob))
  if read(path)!=blob:raise RuntimeError("READBACK_MISMATCH")
changed=False
try:
  actual=read(remote)
  print("FAMILY_FORMAT_REMOTE_BEFORE old=",actual==old,"new=",actual==new,flush=True)
  if actual not in (old,new):raise RuntimeError("REMOTE_CODE_DRIFT_NO_WRITE")
  family=read(home+"/private/numi-account-20261031/family-live.php")
  kept=read(home+"/www/xn--c1adkkdfjbp1a4l.online/redflag-ai-lab/keep.php")
  if b"FAMILY_REBUILD_PENDING" not in family or b"FAMILY_DRAFT_STORAGE_DISABLED" not in kept:
      raise RuntimeError("NO_CACHE_SAFETY_CHANGED")
  protect=[home+"/private/numi-account-20261031/family-live.php",
           home+"/www/xn--c1adkkdfjbp1a4l.online/redflag-ai-lab/keep.php",
           home+"/private/numi-account-20261031/wallet-real-payment.php"]
  hashes={p:hashlib.sha256(read(p)).digest() for p in protect}
  if not health():raise RuntimeError("SITE_HEALTH_CHANGED")
  if actual!=new:
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
      if not str(e).startswith("550"):raise
    tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:8]
    write(backup+"/before-family-owner-format-"+tag+".bak",actual)
    if read(remote)!=actual:raise RuntimeError("REMOTE_CONCURRENT_CHANGE")
    changed=True
    write(remote,new)
  if not health():raise RuntimeError("SITE_UNHEALTHY_AFTER")
  if read(remote)!=new:raise RuntimeError("PUBLISHED_BYTES_NOT_VERIFIED")
  for p,h in hashes.items():
    if hashlib.sha256(read(p)).digest()!=h:raise RuntimeError("PROTECTED_FILE_CHANGED")
  print("FAMILY_OWNER_FORMAT_PUBLISHED first_max_850=true teaser_max_210=true two_paragraphs=true long_dashes_normalized=true other_sections_untouched=true json_caches_still_disabled=true gemini_calls=0",flush=True)
except BaseException:
  if changed:
    try:write(remote,actual);print("ROLLBACK_SUCCESS",flush=True)
    except BaseException:print("ROLLBACK_FAILED",flush=True)
  raise
finally:
  try:ftp.quit()
  except BaseException:ftp.close()
