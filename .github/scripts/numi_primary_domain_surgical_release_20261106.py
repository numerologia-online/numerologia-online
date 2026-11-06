"""Publish ONLY the verified new-domain URL edits to 5 live storefront files.
No new backup folders/files. Existing live bytes kept in memory during this one run
for verification and immediate rollback if a check fails. No private PHP/DB/bot writes.
"""
import ftplib,io,os,ssl,urllib.request,urllib.error,time,subprocess,hashlib,sys
HOST="server172.hosting.reg.ru"
NEW="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
OLD="xn--c1adkkdfjbp1a4l.online"
MAX=500000
EDITS={
 "auth-profile.js":[
   (b'const PROFILE_URL = "https://'+OLD.encode()+b'/api/profile.php";',b'const PROFILE_URL = CHECK_URL;')
 ],
 "year-feature.js":[
   (b'const YEAR_CONTENT_API = "https://'+OLD.encode()+b'/api/";',b'const YEAR_CONTENT_API = "/api/";')
 ],
 "personal-day-feature.js":[
   (b'const DAY_SITE_URL = "https://'+OLD.encode()+b'/?view=day";',b'const DAY_SITE_URL = "https://'+NEW.encode()+b'/?view=day";')
 ],
 "app.js":[
   (b'"./year-feature.js?v=20261102sharedoffer2"',b'"./year-feature.js?v=20261106domain1"'),
   (b'"./personal-day-feature.js?v=20261104save1"',b'"./personal-day-feature.js?v=20261106domain1"')
 ],
 "index.html":[
   (b'src="auth-profile.js?v=20261105logoutbirth1"',b'src="auth-profile.js?v=20261106domain1"'),
   (b'src="app.js?v=20261105scrollfit1"',b'src="app.js?v=20261106domain1"')
 ]
}
def sha(data):return hashlib.sha256(data).hexdigest()
def request(path):
    url="https://"+NEW+"/"+path+("&" if "?" in path else "?")+"primary_domain_verify="+str(time.time_ns())
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache"})
    with urllib.request.urlopen(req,timeout=24) as r:
        body=r.read(MAX+1)
        if r.status!=200 or len(body)>MAX or r.url.split("/")[2]!=NEW:
            raise RuntimeError("PUBLIC_GET_MISMATCH")
        return body
def status(path):
    try:
        with urllib.request.urlopen("https://"+NEW+"/"+path,timeout=16) as r:
            return r.status
    except urllib.error.HTTPError as e:return e.code
def patch(content,edits,filename):
    target=content
    for old,new in edits:
        if target.count(old)!=1 or new in target:raise RuntimeError("LIVE_PATCH_ANCHOR_DRIFT_"+filename)
        target=target.replace(old,new,1)
    return target
def main():
    if status("api/profile.php")!=200:
        raise RuntimeError("NEW_PROFILE_API_UNAVAILABLE")
    for p in ("api/numi-miniapp.php","api/numi-paid-content.php","api/numi-year-preview.php"):
        if status(p)!=405:raise RuntimeError("NEW_YEAR_API_UNAVAILABLE")
    # GitHub main version must match exactly the intended edits from historical source.
    pinned={"auth-profile.js":"2219648d47366e2603b2f73814c76075e9958776",
       "year-feature.js":"f8db6155da9e8b837ee6e18c5a1cf26da2487087",
       "personal-day-feature.js":"5fa0638825971dbaa8aada449c5466c2c2f506ba",
       "app.js":"41c62b9ad1872d70187cbfed25edb7e9c6d3997f",
       "index.html":"b6bab736cb7eacf538fb33273d2faef3c7c88fcb"}
    for name,blob in pinned.items():
        baseline=subprocess.check_output(["git","cat-file","blob",blob],timeout=20)
        expected=patch(baseline,EDITS[name],name)
        current=subprocess.check_output(["git","show","HEAD:"+name],timeout=20)
        if current!=expected:raise RuntimeError("MAIN_PATCH_BASELINE_DRIFT_"+name)
    originals={p:request(p) for p in EDITS}
    desired={p:patch(b,EDITS[p],p) for p,b in originals.items()}
    for p,b in desired.items():
        if p in ("auth-profile.js","year-feature.js","personal-day-feature.js") and OLD.encode() in b:
            raise RuntimeError("OLD_DOMAIN_REMAINS_"+p)
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=28)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    modified=[]
    try:
        home=ftp.pwd().rstrip("/")
        def read(p):
            output=bytearray()
            def append(x):
                output.extend(x)
                if len(output)>MAX:raise RuntimeError("FTP_SIZE_EXCEEDED")
            ftp.retrbinary("RETR "+p,append)
            return bytes(output)
        def write(p,value):
            ftp.storbinary("STOR "+p,io.BytesIO(value))
            if read(p)!=value:raise RuntimeError("FTP_WRITE_VERIFY_FAILED")
        root=None
        for folder in ("www/"+NEW,"www/"+OLD):
            candidate=home+"/"+folder
            if read(candidate+"/index.html")==originals["index.html"]:
                root=candidate;break
        if root is None:raise RuntimeError("ACTUAL_SITE_ROOT_NOT_FOUND")
        for name,blob in originals.items():
            if read(root+"/"+name)!=blob:raise RuntimeError("SITE_FILE_CHANGED_"+name)
        protected=("account-browser.js","api/numi-account.php",".htaccess")
        hashes={p:sha(read(root+"/"+p)) for p in protected}
        print("PRIMARY_DOMAIN_PREFLIGHT_CONFIRMED; no new backup created",flush=True)
        try:
            for name in EDITS: # index.html is last, after the new JS is available
                path=root+"/"+name
                if read(path)!=originals[name]:raise RuntimeError("CONCURRENT_SITE_CHANGE_"+name)
                modified.append(name)
                write(path,desired[name])
            for name in EDITS:
                if request(name)!=desired[name]:raise RuntimeError("PUBLIC_VERIFY_FAILED_"+name)
            for p,originalHash in hashes.items():
                if sha(read(root+"/"+p))!=originalHash:raise RuntimeError("PROTECTED_FILE_CHANGED_"+p)
            print("PRIMARY_DOMAIN_LIVE_PATCH_PUBLISHED_AND_VERIFIED",flush=True)
            print("FILES_CHANGED: auth-profile.js, year-feature.js, personal-day-feature.js, app.js, index.html",flush=True)
            print("UNCHANGED: account PHP, paid entitlement logic, database, bot, school, real payments",flush=True)
            print("NO_NEW_BACKUP_FOLDERS_OR_FILES",flush=True)
        except BaseException:
            for name in reversed(modified):
                try:
                    write(root+"/"+name,originals[name])
                    print("PRIMARY_DOMAIN_ROLLBACK_VERIFIED_"+name,flush=True)
                except BaseException:
                    print("PRIMARY_DOMAIN_ROLLBACK_FAILED_"+name,flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        code=str(e)
        allowed={"NEW_PROFILE_API_UNAVAILABLE","NEW_YEAR_API_UNAVAILABLE","PUBLIC_GET_MISMATCH",
          "FTP_SIZE_EXCEEDED","FTP_WRITE_VERIFY_FAILED","ACTUAL_SITE_ROOT_NOT_FOUND"}
        if code.startswith(("MAIN_PATCH_BASELINE_DRIFT_","LIVE_PATCH_ANCHOR_DRIFT_",
            "OLD_DOMAIN_REMAINS_","SITE_FILE_CHANGED_","CONCURRENT_SITE_CHANGE_",
            "PUBLIC_VERIFY_FAILED_","PROTECTED_FILE_CHANGED_")):allowed.add(code)
        print("PRIMARY_DOMAIN_RELEASE_STOPPED:",code if code in allowed else type(e).__name__,flush=True)
        sys.exit(1)
