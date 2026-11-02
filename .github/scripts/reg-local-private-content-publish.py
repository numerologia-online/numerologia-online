"""Manual, immutable private-text release from GitHub development to REG.RU storage.

Never runs for visitors. Nothing is synchronized automatically: it requires an exact,
explicitly approved release marker and a matching private Git commit.
"""
import ftplib,hashlib,io,json,os,pathlib,re,ssl,sys,time
from urllib.parse import quote
from urllib.request import Request,urlopen

HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
PRIVATE_REPO="numerologia-online/numi-numi-on-private"
PRIVATE="private/numi-content-reg-20261031"
MANIFEST_SOURCE="infrastructure/reg-protection/2026-10-31/server/manifest.json"
MARKER=pathlib.Path(".github/numi-local-content-release.json")

def log(**kwargs):print("NUMI_LOCAL_CONTENT_RELEASE "+json.dumps(kwargs,sort_keys=True,ensure_ascii=False),flush=True)
def digest(data):return hashlib.sha256(data).hexdigest()
def git_blob(data):return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
def hex_sha(x,n):return isinstance(x,str) and re.fullmatch("[a-f0-9]{"+str(n)+"}",x) is not None
def valid_path(p):
    if not isinstance(p,str) or not p or len(p)>240 or p.startswith("/") or "\\" in p:
        return False
    pieces=p.split("/")
    return all(x and x not in (".","..") and not x.startswith(".") for x in pieces)
def valid_source_record(entry, previous_entry, changed):
    if not isinstance(entry,dict):return False
    source=entry.get("source");sha=entry.get("sha");ref=entry.get("ref")
    if not (valid_path(source) and hex_sha(sha,40) and hex_sha(ref,40)):
        return False
    # Existing legacy references are already cached and are never fetched here.
    # New or changed entries must still use the reviewed site/ source namespace.
    return source.startswith("site/") or (not changed and entry==previous_entry)

def connect():
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    return ftp
def read(ftp,path,limit=5_300_000):
    out=io.BytesIO()
    def append(chunk):
        if out.tell()+len(chunk)>limit:raise RuntimeError("Protected file exceeds limit")
        out.write(chunk)
    ftp.retrbinary("RETR "+path,append)
    return out.getvalue()
def put(ftp,path,data):
    ftp.storbinary("STOR "+path,io.BytesIO(data))
    if digest(read(ftp,path))!=digest(data):raise RuntimeError("FTPS upload integrity mismatch")
def get_private(token,path,commit):
    if not valid_path(path) or not hex_sha(commit,40):raise RuntimeError("Invalid private source reference")
    encoded="/".join(quote(part,safe="") for part in path.split("/"))
    url="https://api.github.com/repos/"+PRIVATE_REPO+"/contents/"+encoded+"?ref="+commit
    request=Request(url,headers={"Authorization":"Bearer "+token,
        "Accept":"application/vnd.github.raw+json",
        "X-GitHub-Api-Version":"2022-11-28",
        "User-Agent":"numi-reg-manual-content-release/1.0"})
    with urlopen(request,timeout=35) as response:
        if response.status!=200:raise RuntimeError("Private development source unavailable")
        payload=response.read(5_200_001)
    if len(payload)>5_200_000:raise RuntimeError("Private source too large")
    return payload

def run():
    release=json.loads(MARKER.read_text(encoding="utf-8"))
    if (release.get("mode")!="publish" or
        not hex_sha(release.get("private_commit"),40) or
        not hex_sha(release.get("expected_live_manifest_sha256"),64) or
        not hex_sha(release.get("approved_manifest_sha256"),64)):
        raise RuntimeError("A complete, approved manual release marker is required")
    approved=release.get("approved_paths")
    if (not isinstance(approved,list) or not 1<=len(approved)<=500
        or any(not valid_path(p) for p in approved)
        or len(set(approved))!=len(approved)):
        raise RuntimeError("Invalid explicit approval list")
    ftp=connect()
    changed=False
    try:
        home=ftp.pwd().rstrip("/")
        server=home+"/"+PRIVATE
        manifest_file=server+"/manifest.json"
        core=read(ftp,server+"/core.php",2_000_000)
        if b"function numiPrivateRead" not in core or b"api.github.com/repos" in core:
            raise RuntimeError("REG.RU local-only content reader not active")
        old_bytes=read(ftp,manifest_file,2_000_000)
        if digest(old_bytes)!=release["expected_live_manifest_sha256"]:
            raise RuntimeError("Live private manifest changed; manual release cancelled")
        old=json.loads(old_bytes)
        previous=old.get("files",{})
        if not isinstance(previous,dict) or len(previous)<300:
            raise RuntimeError("Unexpected existing REG.RU manifest")
        github_config=read(ftp,home+"/private/numi-secure-access/config.local.php",100_000)
        matches=re.findall(rb"(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}",github_config)
        if len(matches)!=1:raise RuntimeError("Private release authentication not configured")
        token=matches[0].decode("ascii")
        new_bytes=get_private(token,MANIFEST_SOURCE,release["private_commit"])
        if digest(new_bytes)!=release["approved_manifest_sha256"]:
            raise RuntimeError("Private manifest does not match approved release")
        updated=json.loads(new_bytes).get("files",{})
        if not isinstance(updated,dict) or len(updated)>3000:
            raise RuntimeError("Invalid new private manifest")
        if not set(previous).issubset(updated):
            raise RuntimeError("Removing protected entries needs a separate approved migration")
        diff={key for key in updated if previous.get(key)!=updated[key]}
        if diff!=set(approved):
            raise RuntimeError("Actual private text changes differ from the approved paths")
        for path in updated:
            if not valid_path(path):raise RuntimeError("Unexpected private manifest path")
            entry=updated[path]
            if not isinstance(entry,dict):
                raise RuntimeError("Invalid private content record")
            source=entry.get("source");sha=entry.get("sha");ref=entry.get("ref")
            if not valid_source_record(entry,previous.get(path),path in diff):
                raise RuntimeError("Invalid private content source or checksum")
        local_names={entry.rsplit("/",1)[-1] for entry in ftp.nlst(server+"/cache")}
        # All old blobs must remain available; publication never deletes them.
        old_shas={e["sha"] for e in previous.values()}
        if old_shas-local_names:raise RuntimeError("Existing REG.RU private content is incomplete")
        new_shas={updated[p]["sha"] for p in approved}
        log(approved_texts=len(approved),new_blobs=len(new_shas-local_names),old_files=len(previous),automatic_sync=False)
        for index,path in enumerate(approved,1):
            entry=updated[path];sha=entry["sha"]
            remote=server+"/cache/"+sha
            if sha in local_names:
                if git_blob(read(ftp,remote))!=sha:raise RuntimeError("Existing protected blob integrity error")
                continue
            payload=get_private(token,entry["source"],entry["ref"])
            if git_blob(payload)!=sha:raise RuntimeError("Private source checksum mismatch")
            put(ftp,remote,payload)
            try:ftp.sendcmd("SITE CHMOD 600 "+remote)
            except ftplib.error_perm:pass
            local_names.add(sha)
            if index%25==0:log(provisioned=index,approved=len(approved))
        if {updated[p]["sha"] for p in approved}-local_names:
            raise RuntimeError("Not all approved private text blobs were installed")
        # Create a rollback copy outside www, then swap only the manifest.
        backup_root=home+"/site-safeguard-backups"
        try:ftp.mkd(backup_root)
        except ftplib.error_perm:pass
        archive=backup_root+"/local-content-release-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(archive)
        put(ftp,archive+"/manifest.json.bak",old_bytes)
        try:
            changed=True
            put(ftp,manifest_file,new_bytes)
            if digest(read(ftp,manifest_file,2_000_000))!=digest(new_bytes):
                raise RuntimeError("New REG.RU manifest checksum mismatch")
            # Fail closed if the server stops serving its own health endpoint.
            request=Request("https://"+DOMAIN+"/api/numi-content-health.php",
                            headers={"Cache-Control":"no-store","User-Agent":"numi-manual-release-qa"})
            with urlopen(request,timeout=35) as response:
                health=json.loads(response.read(3000))
                if response.status!=200 or health.get("configured") is not True:
                    raise RuntimeError("Protected content health check failed")
            log(success=True,local_only=True,published=len(approved),
                manifest_entries=len(updated),public_site_files_modified=0,
                github_only_used_during_approved_publication=True)
        except BaseException:
            if changed:
                try:put(ftp,manifest_file,old_bytes);log(manifest_rolled_back=True)
                except BaseException as exc:log(rollback_failed=type(exc).__name__)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:run()
    except BaseException as exc:
        log(success=False,reason=str(exc)[:180]);sys.exit(1)
