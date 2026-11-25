#!/usr/bin/env python3
"""Only publish the age gates and date input fixes; no provider requests."""
import ftplib, ssl, os, io, pathlib, tempfile, subprocess, time, uuid, urllib.request, urllib.error
BASE_REF="8836d2f804281187fefbf17d55945a7f65088d6b"
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
FILES=[
 "account-service/private/core.php",
 *["account-service/public/"+x for x in ["numi-family-free.php","numi-flags-fidelity-free.php","numi-language-free.php","numi-love-free.php","numi-verdict-free.php","numi-money-editor-free.php"]],
 *["redflag-ai-lab/"+x for x in ["family-owner-preview-api.php","love-owner-preview-api.php","verdict-owner-preview-api.php","style-test-api.php","say-no-fresh-api.php","intimacy-pilot-api.php"]],
 "assets/numi-date-fields.js","redflag-feature.js","app.js","child/child.js","pro/pro.js",
 "child/index.html","pro/index.html","year/index.html","moment/index.html","pro/school/index.html","index.html"
]
def lint(path,data):
    if path.endswith(".php"):
        with tempfile.NamedTemporaryFile(suffix=".php") as tmp:
            tmp.write(data);tmp.flush()
            if subprocess.run(["php","-l",tmp.name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
                raise RuntimeError("PHP_LINT_"+path)
    if path.endswith(".js"):
        if subprocess.run(["node","--input-type=module","--check"],input=data,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
            raise RuntimeError("JS_LINT_"+path)
new={p:pathlib.Path(p).read_bytes() for p in FILES}
old={}
for p in FILES:
    if p=="assets/numi-date-fields.js":old[p]=None
    else:old[p]=subprocess.check_output(["git","show",BASE_REF+":"+p])
    lint(p,new[p])
subprocess.run(["node","tests/numi-date-fields-20261125.cjs"],check=True)
fixture="""<?php
require 'account-service/private/core.php';
$t=new DateTimeImmutable('2026-11-25',new DateTimeZone('Europe/Moscow'));
foreach(['2008-11-24'=>[true,false],'2008-11-25'=>[true,false],'2008-11-26'=>[false,true],'2026-11-25'=>[false,true],'2026-11-26'=>[false,false],'2008-02-30'=>[false,false]] as $d=>$want) {
  if([naAdultBirthDate($d,$t),naChildBirthDate($d,$t)]!==$want)throw new RuntimeException('AGE_BOUNDARY');
}
$minor=(new DateTimeImmutable('today',new DateTimeZone('Europe/Moscow')))->modify('-17 years')->format('Y-m-d');
$adult=(new DateTimeImmutable('today',new DateTimeZone('Europe/Moscow')))->modify('-19 years')->format('Y-m-d');
foreach([['redflag_question',$minor,'REDFLAG_AGE_RESTRICTED'],['life_full',$minor,'ADULT_AGE_REQUIRED'],['child_full_v1',$adult,'CHILD_AGE_REQUIRED']] as [$code,$date,$err]){
  try{naCatalogResolve(['product_code'=>$code,'birth_date'=>$date,'category'=>'money','question_id'=>'gift'],false);throw new RuntimeException('GUARD_MISSING');}
  catch(InvalidArgumentException $e){if($e->getMessage()!==$err)throw $e;}
}
echo "AGE_BOUNDARY_AND_CATALOG_PASS\\n";
"""
subprocess.run(["php"],input=fixture.encode(),check=True)
def status(path):
    req=urllib.request.Request(BASE+path+"?age_date_check="+str(time.time_ns()),headers={"Cache-Control":"no-store"})
    try:
        with urllib.request.urlopen(req,timeout=20) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def health():
    for p,expected in [("",200),("child/",200),("pro/",200),("redflag-ai-lab/style-test-api.php",403),("api/numi-owner-material.php",403)]:
        if status(p)!=expected:raise RuntimeError("HEALTH_"+p)
health()
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip("/")
web=home+"/www/xn--c1adkkdfjbp1a4l.online/"
private=home+"/private/numi-account-20261031/"
def remote(p):
    if p.startswith("account-service/private/"):return private+p.rsplit("/",1)[-1]
    if p.startswith("account-service/public/"):return web+"api/"+p.rsplit("/",1)[-1]
    return web+p
def read(p,optional=False):
    out=io.BytesIO()
    try:ftp.retrbinary("RETR "+p,out.write)
    except ftplib.error_perm as e:
        if optional and str(e).startswith("550"):return None
        raise
    return out.getvalue()
def write(p,b):
    ftp.storbinary("STOR "+p,io.BytesIO(b))
    if read(p)!=b:raise RuntimeError("READBACK")
def merge(p,live):
    if live==new[p]:return live
    if live==old[p]:return new[p]
    if live is None or old[p] is None:raise RuntimeError("REMOTE_DRIFT_"+p)
    # Preserve disjoint live-only edits; do not overwrite conflicts or print private data.
    with tempfile.TemporaryDirectory() as d:
        a,b,c=[pathlib.Path(d)/n for n in ("live","base","new")]
        a.write_bytes(live);b.write_bytes(old[p]);c.write_bytes(new[p])
        r=subprocess.run(["git","merge-file","-p",str(a),str(b),str(c)],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
        if r.returncode:raise RuntimeError("REMOTE_CONFLICT_"+p)
        return r.stdout
saved={};prepared={};changed=[]
try:
    for p in FILES:
        saved[p]=read(remote(p),old[p] is None)
        prepared[p]=merge(p,saved[p])
        lint(p,prepared[p])
    # The private directory stays outside the webroot. Back up every changed existing file.
    backup=home+"/site-safeguard-backups"
    try:ftp.mkd(backup)
    except ftplib.error_perm as e:
        if not str(e).startswith("550"):raise
    tag=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())+"-"+uuid.uuid4().hex[:6]
    for p in FILES:
        if saved[p] is not None and saved[p]!=prepared[p]:
            write(backup+"/before-age-date-"+tag+"-"+p.replace("/","_")+".bak",saved[p])
    for p in FILES:
        if read(remote(p),old[p] is None)!=saved[p]:raise RuntimeError("REMOTE_CONCURRENT_EDIT_"+p)
    for p in FILES:
        if read(remote(p),old[p] is None)!=saved[p]:raise RuntimeError("REMOTE_CONCURRENT_EDIT_"+p)
        if saved[p]!=prepared[p]:
            changed.append(p);write(remote(p),prepared[p])
    health()
    for p in FILES:
        if read(remote(p))!=prepared[p]:raise RuntimeError("FINAL_READBACK_"+p)
    if status("assets/numi-date-fields.js")!=200:raise RuntimeError("DATE_ASSET_MISSING")
    print("AGE_DATE_LIVE_PASS files="+str(len(FILES))+" provider_calls=0",flush=True)
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
