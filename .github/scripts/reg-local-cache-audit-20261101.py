"""READ-ONLY REG.RU audit: verify all cached private source blobs, no writes."""
import concurrent.futures, ftplib, hashlib, io, json, os, re, ssl, sys, time
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
PRIVATE="private/numi-content-reg-20261031"

def log(**x): print("REG_LOCAL_CACHE_AUDIT "+json.dumps(x,ensure_ascii=False,sort_keys=True),flush=True)
def digest(blob):return hashlib.sha1(b"blob "+str(len(blob)).encode()+b"\0"+blob).hexdigest()
def connect():
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    return ftp
def receive(ftp,path,cap=5_500_000):
    out=io.BytesIO()
    def collect(chunk):
        if out.tell()+len(chunk)>cap: raise RuntimeError("Unexpectedly large private source")
        out.write(chunk)
    ftp.retrbinary("RETR "+path,collect)
    return out.getvalue()

def run():
    ftp=connect()
    try:
        home=ftp.pwd().rstrip("/")
        site=home+"/www/"+DOMAIN
        before=receive(ftp,site+"/index.html",5_000_000)
        if b"<html" not in before.lower():raise RuntimeError("Unexpected live website")
        server=home+"/"+PRIVATE
        source=receive(ftp,server+"/manifest.json",2_000_000)
        manifest=json.loads(source)
        entries=manifest.get("files")
        if not isinstance(entries,dict) or len(entries)<300 or len(entries)>1000:
            raise RuntimeError("Unexpected manifest size")
        sha_to_paths={}
        for path,item in entries.items():
            sha=item.get("sha") if isinstance(item,dict) else None
            if not isinstance(path,str) or not isinstance(sha,str) or not re.fullmatch(r"[0-9a-f]{40}",sha):
                raise RuntimeError("Invalid private manifest")
            sha_to_paths.setdefault(sha,[]).append(path)
        remote_names=ftp.nlst(server+"/cache")
        names={name.rsplit("/",1)[-1] for name in remote_names}
        missing=[sha for sha in sha_to_paths if sha not in names]
        old_php=receive(ftp,server+"/core.php",1_000_000)
        current_dependency=b"api.github.com/repos/numerologia-online/numi-numi-on-private" in old_php
        log(manifest_entries=len(entries),unique_sources=len(sha_to_paths),
            cache_listing=len(names),files_not_cached=len(missing),
            runtime_github_dependency=current_dependency,read_only=True)
        if missing:raise RuntimeError("Some private sources are missing from REG cache: count "+str(len(missing)))
        if not current_dependency: log(server_already_local_only=True)
        all_shas=sorted(sha_to_paths)
        def check(partition):
            ftps=connect()
            valid=0;bytes_total=0
            try:
                for n,sha in enumerate(partition,1):
                    blob=receive(ftps,server+"/cache/"+sha)
                    if digest(blob)!=sha:raise RuntimeError("Integrity mismatch in cached source")
                    valid+=1;bytes_total+=len(blob)
                return valid,bytes_total
            finally:
                try:ftps.quit()
                except BaseException:ftps.close()
        jobs=[all_shas[i::4] for i in range(4)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            done=list(pool.map(check,jobs))
        valid=sum(n for n,b in done)
        total=sum(b for n,b in done)
        if valid!=len(all_shas):raise RuntimeError("Not all private sources verified")
        log(success=True,read_only=True,all_cached_verified=valid,
            manifest_entries=len(entries),verified_bytes=total,
            runtime_github_dependency=current_dependency,
            public_files_modified=0)
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:run()
    except BaseException as exc:
        log(success=False,error=str(exc)[:170]);sys.exit(1)
