#!/usr/bin/env python3
"""Single-file guarded REG.RU patch to remove 50/50 in Love Languages.
No AI calls, no cache writes/deletion, no payment or other sections edited.
"""
import os,io,ftplib,ssl,hashlib,pathlib,subprocess,time,uuid,urllib.request,urllib.error
ROOT="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
TARGET="account-service/private/language-live.php"
PRIOR="8754654dcd5f89b93c9952b3a8cd85bfc46eed12^"
old=subprocess.check_output(["git","show",PRIOR+":"+TARGET])
new=pathlib.Path(TARGET).read_bytes()
a="День и месяц учитывай строго 50/50".encode()
assert old.count(a)==1 and new.count(a)==0
assert "Все четыре остальные позиции".encode() in new and "Никаких процентов".encode() in new
assert len(new)>len(old) and new.count(b"function nlGenerateText")==1
lint=subprocess.run(["php","-l"],input=new,capture_output=True)
if lint.returncode:raise RuntimeError("LANGUAGE_SYNTAX_INVALID")
# Assert sole change is the one sentence block of the prompt.
s=old.decode(); t=new.decode()
prefix="День и месяц учитывай строго 50/50"
left=s.index(prefix); end=s.index(" Не выбирай автоматом",left)
left2=t.index("День рождения и месяц задают два исходных ведущих смысла:")
end2=t.index(" Не выбирай автоматом",left2)
assert s[:left]==t[:left2] and s[end:]==t[end2:],"UNEXPECTED_LANGUAGE_CHANGES"
def status(path):
    req=urllib.request.Request(ROOT+path+"?language_ratio_patch="+str(time.time_ns()),headers={"Cache-Control":"no-store"})
    try:
        with urllib.request.urlopen(req,timeout=28) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    codes=[status(""),status("redflag-ai-lab/style-test-api.php"),
      status("redflag-ai-lab/family-owner-preview-api.php")]
    print("SITE_HEALTH",codes,flush=True)
    return codes==[200,403,403]
if not healthy():raise RuntimeError("SITE_UNHEALTHY_NO_WRITE")
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=48)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip("/")
remote=home+"/private/numi-account-20261031/language-live.php"
backup=home+"/site-safeguard-backups"
def read(path):
    out=io.BytesIO();ftp.retrbinary("RETR "+path,out.write);return out.getvalue()
def write(path,data):
    ftp.storbinary("STOR "+path,io.BytesIO(data))
    if read(path)!=data:raise RuntimeError("READBACK_MISMATCH")
original=None;changed=False
try:
    original=read(remote)
    print("LANGUAGE_REMOTE_PRIOR",original==old,"already_updated",original==new,flush=True)
    if original not in (old,new):raise RuntimeError("REMOTE_DRIFT_NO_WRITE")
    if not healthy():raise RuntimeError("SITE_CHANGED_NO_WRITE")
    if original==new:
        print("LANGUAGE_50_50_ALREADY_REMOVED",flush=True)
    else:
        try:ftp.mkd(backup)
        except ftplib.error_perm as e:
            if not str(e).startswith("550"):raise
        tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:8]
        write(backup+"/before-language-ratio-"+tag+".bak",original)
        if read(remote)!=original:raise RuntimeError("CONCURRENT_CHANGE_NO_WRITE")
        changed=True
        write(remote,new)
        if not healthy():raise RuntimeError("SITE_UNHEALTHY_AFTER_WRITE")
    assert read(remote)==new
    print("LANGUAGE_50_50_REMOVED_PUBLISHED verified=true all_six_positions=true paid_ai_calls=0 other_sections_untouched=true",flush=True)
except BaseException:
    if changed and original is not None:
        try:write(remote,original);print("ROLLBACK_SUCCESS",flush=True)
        except BaseException:print("ROLLBACK_FAILED",flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
