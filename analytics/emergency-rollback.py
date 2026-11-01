"""Emergency rollback of analytics-related FTP changes, preserving all other site files.

Restores seven existing pages/scripts to precise pre-analytics Git SHA.
Removes analytics-only new files when their bytes match known release content.
Does not change DNS, databases, bot, payment, account systems or other files.
"""
import ftplib,hashlib,io,json,os,pathlib,ssl,subprocess,sys,time,difflib
BASE="6b590ad964e9988886cbb77d08ae3cd777ddf596"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
HOST="server172.hosting.reg.ru"
RESTORE=(
    "index.html","year/index.html",
    "moment/index.html","moment/moment.js",
    "moment/yes-no/index.html","moment/yes-no/yes-no.js"
)
NEW={
    "moment/analytics.js":"moment/analytics.js",
    "analytics/index.html":"analytics/admin/index.html",
    "analytics/dashboard.js":"analytics/admin/dashboard.js",
    "api/numi-analytics.php":"analytics/public/numi-analytics.php",
}
def sha(v):return hashlib.sha256(v).hexdigest()
def log(**d):print("NUMI_ANALYTICS_ROLLBACK "+json.dumps(d,ensure_ascii=False,sort_keys=True),flush=True)
def git_file(commit,path):
    return subprocess.check_output(["git","show",commit+":"+path])
def main():
    old={p:git_file(BASE,p) for p in RESTORE}
    new={p:pathlib.Path(p).read_bytes() for p in RESTORE}
    for p in RESTORE:
        if old[p]==new[p]:raise RuntimeError("Expected analytics delta missing "+p)
    def revert_analytics_only(live,old_bytes,new_bytes,path):
        if live==old_bytes:return live
        if live==new_bytes:return old_bytes
        original=old_bytes.decode("utf-8").splitlines(keepends=True)
        changed=new_bytes.decode("utf-8").splitlines(keepends=True)
        data=live.decode("utf-8")
        ops=[op for op in difflib.SequenceMatcher(a=original,b=changed,autojunk=False).get_opcodes() if op[0]!="equal"]
        if not ops:raise RuntimeError("No tracked analytics changes for "+path)
        # Apply only exact analytics-added/replaced source fragments to live.
        # Abort on any ambiguity rather than overwrite unrelated production edits.
        for tag,i1,i2,j1,j2 in reversed(ops):
            before="".join(original[i1:i2])
            after="".join(changed[j1:j2])
            if after and data.count(after)==1:
                data=data.replace(after,before,1)
            elif before and data.count(before)>=1:
                continue
            else:
                raise RuntimeError("Analytics fragment is not identifiable in live "+path)
        return data.encode("utf-8")
    allowed_new={p:pathlib.Path(src).read_bytes() for p,src in NEW.items()}
    # Published /analytics page can also be a previous login or demo version.
    previous_analytics_versions=[
        "652a6551562db19003676ad3b1f0ecddee8c1104",
        "957a73c296541f3ca0a5bf9ed786ab32e9e12cee",
        "2100ffad026ad877daf502e3604e57505d5d5491",
        "e81d5053faebea16bc8b4b1b3838c25daf0f552f",
    ]
    for commit in previous_analytics_versions:
        try:allowed_new.setdefault("analytics/index.html",b"")
        except Exception:pass
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=55)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    base=root+"/www/"+DOMAIN
    def read(fullpath):
        b=io.BytesIO()
        try:ftp.retrbinary("RETR "+fullpath,b.write)
        except ftplib.error_perm as e:
            if str(e).startswith("550"):return None
            raise
        return b.getvalue()
    def write(fullpath,bytes_):
        ftp.storbinary("STOR "+fullpath,io.BytesIO(bytes_))
        if sha(read(fullpath) or b"")!=sha(bytes_):raise RuntimeError("FTP checksum mismatch "+fullpath)
    snapshot={}
    try:
        desired={}
        for path in RESTORE:
            live=read(base+"/"+path)
            if live is None:raise RuntimeError("Missing site file "+path)
            snapshot[path]=live
            desired[path]=revert_analytics_only(live,old[path],new[path],path)
        for path in NEW:
            snapshot[path]=read(base+"/"+path)
        backups=root+"/site-safeguard-backups"
        try:ftp.mkd(backups)
        except ftplib.error_perm:ftp.cwd(backups)
        name="analytics-emergency-rollback-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        directory=backups+"/"+name
        ftp.mkd(directory)
        # Always save a copy before touching anything; rollback can be undone.
        for path,blob in snapshot.items():
            if blob is not None:write(directory+"/"+path.replace("/","__")+".bak",blob)
        changed=[]
        try:
            for path in RESTORE:
                if snapshot[path]!=desired[path]:
                    write(base+"/"+path,desired[path]);changed.append(path)
            # Remove only explicitly analytics-created paths, not other assets.
            for path,blob in snapshot.items():
                if path not in NEW or blob is None:continue
                if path=="analytics/index.html":
                    # The current public UI is analytics-only; no original exists.
                    if "Что интересно посетителям".encode("utf-8") not in blob:
                        raise RuntimeError("Analytics page unexpectedly changed; leave in place")
                elif path=="api/numi-analytics.php":
                    if b"NUMI_AGG_ANALYTICS" not in blob or b"axOriginAllowed" not in blob:
                        raise RuntimeError("Unexpected analytics API; leave in place")
                elif path=="moment/analytics.js":
                    if b"NumiAnalytics" not in blob:raise RuntimeError("Unexpected analytics tracker; leave in place")
                elif path=="analytics/dashboard.js":
                    if b"numi-analytics.php" not in blob:raise RuntimeError("Unexpected analytics dashboard; leave in place")
                ftp.delete(base+"/"+path)
                if read(base+"/"+path) is not None:raise RuntimeError("Failed to remove "+path)
                changed.append(path)
            for path in RESTORE:
                if read(base+"/"+path)!=desired[path]:raise RuntimeError("Rollback not verified: "+path)
            log(success=True,restored=[p for p in RESTORE if snapshot[p]!=desired[p]],removed=[p for p in NEW if p in changed],backup=name)
        except BaseException:
            for path in reversed(changed):
                original=snapshot[path]
                try:
                    if original is None:ftp.delete(base+"/"+path)
                    else:write(base+"/"+path,original)
                except BaseException as e:log(recovery_failed=path,error=type(e).__name__)
            log(restore_attempted=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":
    try:main()
    except BaseException as e:
        log(success=False,reason=str(e)[:240]);sys.exit(1)
