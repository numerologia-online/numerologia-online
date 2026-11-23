#!/usr/bin/env python3
"""Guarded exact two-file release, no Gemini invocations and no wallet changes."""
import ftplib, ssl, io, os, pathlib, subprocess, hashlib, json, time, uuid, urllib.request, urllib.error

base="8b424da13351c0d5e5dde6e4d7cc8fdedad63abf"
prefix="private/numi-account-20261031/"
files={
 "account-service/private/intimacy-live-knowledge.json":prefix+"intimacy-live-knowledge.json",
 "account-service/private/intimacy-live.php":prefix+"intimacy-live.php"
}
paths=list(files)
old={p:subprocess.check_output(["git","show",base+":"+p]) for p in paths}
new={p:pathlib.Path(p).read_bytes() for p in paths}
oldkb=json.loads(old[paths[0]])
newkb=json.loads(new[paths[0]])
assert oldkb["schema"]==newkb["schema"]
assert len(newkb["arcana"])==22
assert {k for k in oldkb["arcana"] if oldkb["arcana"][k]!=newkb["arcana"][k]}=={"4","8"}
assert oldkb["arcana"]["15"]==newkb["arcana"]["15"]
before=old[paths[1]].decode("utf-8")
after=new[paths[1]].decode("utf-8")
oldline="'pace'=>['left','right','center','tailFirst','loveHeart'],"
newline="'pace'=>['left','tailSecond','center','tailFirst','loveHeart'],"
oldcache="($id==='fire'?'-voice8':'')"
newcache="($id==='fire'?'-kb48-v9':'')"
assert before.count(oldline)==1 and after.count(newline)==1
assert before.count(oldcache)==1 and after.count(newcache)==1
assert before.replace(oldline,newline).replace(oldcache,newcache)==after, "UNRELATED_PHP_CHANGED"
assert "google/gemini-3-flash-preview" in after and "niGenerateText" in after
assert subprocess.run(["php","-l",paths[1]],capture_output=True).returncode==0

def status(url_path):
 url="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"+url_path+"?kb48_health="+str(time.time_ns())
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={"Cache-Control":"no-cache"}),timeout=22) as response:
   return response.status
 except urllib.error.HTTPError as e: return e.code

def healthy():
 codes=[status(""),status("redflag-ai-lab/style-test-api.php"),status("api/numi-account.php")]
 print("SITE_HEALTH",codes,flush=True)
 return codes[0]==200 and codes[1]==403 and codes[2] in (403,405)

if not healthy():raise RuntimeError("HEALTH_CHECK_FAILED_BEFORE_NO_WRITES")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p()
ftp.set_pasv(True)
home=ftp.pwd().rstrip("/")
backup_dir=home+"/site-safeguard-backups"
def read(p):
 output=io.BytesIO();ftp.retrbinary("RETR "+p,output.write)
 return output.getvalue()
def write(p,v):
 ftp.storbinary("STOR "+p,io.BytesIO(v))
 if read(p)!=v:raise RuntimeError("READBACK_MISMATCH")
changed=[]
try:
 for p in paths:
  if read(home+"/"+files[p])!=old[p]:
   raise RuntimeError("LIVE_REMOTE_DRIFT_ABORT_NO_CHANGES_"+p)
 try:ftp.mkd(backup_dir)
 except ftplib.error_perm as exc:
  if not str(exc).startswith("550"):raise
 tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:8]
 for p in paths:
  write(backup_dir+"/before-intimacy-kb48-"+tag+"-"+p.replace("/","-")+".bak",old[p])
 for p in paths:
  if read(home+"/"+files[p])!=old[p]:
   raise RuntimeError("CONCURRENT_REMOTE_EDIT_ABORT")
 for p in paths:
  changed.append(p)
  write(home+"/"+files[p],new[p])
 if not healthy():raise RuntimeError("HEALTH_CHECK_FAILED_AFTER")
 for p in paths:
  if read(home+"/"+files[p])!=new[p]:
   raise RuntimeError("FINAL_READBACK_MISMATCH")
 print("INTIMACY_KB_4_8_AND_PACE_PUBLISHED_OK energies_changed=4,8 energy_15_unchanged=true "+
       "pace_map_updated=true free_cache_refreshed=true prompt_unchanged=true paid_calls=0 "+
       "wallet_unchanged=true other_knowledge_unchanged=true",flush=True)
except BaseException:
 failed=[]
 for p in reversed(changed):
  try:write(home+"/"+files[p],old[p])
  except BaseException:failed.append(p)
 print("ROLLBACK_"+("FAILED:"+",".join(failed) if failed else "SUCCESS"),flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
