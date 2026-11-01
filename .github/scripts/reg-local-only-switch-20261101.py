"""One-time guarded REG.RU private content switch, no source text writes."""
import ftplib,hashlib,io,json,os,pathlib,re,ssl,subprocess,sys,time,urllib.request,urllib.error

HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
PRIVATE="private/numi-content-reg-20261031"
OLD_CORE_BLOB="d8357310f3c01b3d20f2a983bc794a2029aaf8e1"
NEW_CORE_BLOB="8571aadd7ea5a5f12cfd9f9f97ae8c6375e389b1"
NEW_BLOCK="// Private files are provisioned onto REG.RU manually during approved releases.\n// Never contact GitHub while handling a visitor's request.\nfunction numiPrivateRead(string $path, array $config): string {\n    $entry = numiManifest()['files'][$path] ?? null;\n    if (!is_array($entry)) throw new InvalidArgumentException('INVALID_PATH');\n    $sha = $entry['sha'] ?? '';\n    if (!is_string($sha) || !preg_match('/^[a-f0-9]{40}$/D', $sha)) throw new RuntimeException('INVALID_MANIFEST');\n    // Deliberately use the existing protected, locally verified blob directory.\n    // Files live outside www; deployment must install and verify every blob first.\n    $file = __DIR__.'/cache/'.$sha;\n    if (!is_file($file)) throw new RuntimeException('PRIVATE_CONTENT_UNAVAILABLE');\n    $data = file_get_contents($file);\n    if (!is_string($data)) throw new RuntimeException('PRIVATE_CONTENT_UNAVAILABLE');\n    $actual = sha1('blob '.strlen($data).\"\\0\".$data);\n    if (!hash_equals($sha, $actual)) throw new RuntimeException('PRIVATE_CONTENT_UNAVAILABLE');\n    return $data;\n}\n"
OLD_HEALTH="is_file($config['bot_config'])&&is_file($config['github_config'])"
NEW_HEALTH="is_file($config['bot_config'])&&is_file(__DIR__.'/manifest.json')&&is_dir(__DIR__.'/cache')"

def log(**data):print("REG_LOCAL_ONLY_SWITCH "+json.dumps(data,sort_keys=True,ensure_ascii=False),flush=True)
def git_blob(data):return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
def sha(data):return hashlib.sha256(data).hexdigest()

def patch(source):
    text=source.decode("utf-8")
    start=text.find("function numiPrivateRead(string $path, array $config): string {")
    end=text.find("function numiIsOwner(",start)
    if start<0 or end<start:raise RuntimeError("Unexpected existing PHP function layout")
    if text.count(OLD_HEALTH)!=1:raise RuntimeError("Unexpected PHP health code")
    changed=(text[:start]+NEW_BLOCK+text[end:]).replace(OLD_HEALTH,NEW_HEALTH,1)
    return changed.encode("utf-8")

def http(route,body=None):
    url="https://"+DOMAIN+"/api/numi-"+route+".php?local_only_verify="+str(time.time_ns())
    payload=None if body is None else json.dumps(body).encode()
    headers={"User-Agent":"numi-reg-local-only-qa/1.0","Cache-Control":"no-store"}
    if payload is not None:headers["Content-Type"]="application/json"
    request=urllib.request.Request(url,data=payload,headers=headers)
    try:response=urllib.request.urlopen(request,timeout=30)
    except urllib.error.HTTPError as exc:response=exc
    with response:
        raw=response.read(100000)
        try:result=json.loads(raw)
        except ValueError:result={"raw_http":response.status}
        return response.status,result

def run():
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    root=ftp.pwd().rstrip("/")
    site=root+"/www/"+DOMAIN
    private=root+"/"+PRIVATE
    core=private+"/core.php"
    backup_root=root+"/site-safeguard-backups"
    archive=backup_root+"/reg-local-only-core-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())

    def read(path,limit=5_500_000):
        buff=io.BytesIO()
        def write_chunk(chunk):
            if buff.tell()+len(chunk)>limit:raise RuntimeError("Unexpectedly large protected file")
            buff.write(chunk)
        ftp.retrbinary("RETR "+path,write_chunk)
        return buff.getvalue()
    def write(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if sha(read(path))!=sha(data):raise RuntimeError("FTPS readback failed for server code")

    changed=False
    before=None
    try:
        homepage_before=sha(read(site+"/index.html"))
        previous=read(core)
        baseline_blob=git_blob(previous)
        if baseline_blob==NEW_CORE_BLOB:
            log(success=True,already_local_only=True,modified=False)
            return
        if baseline_blob!=OLD_CORE_BLOB:
            raise RuntimeError("Live core differs from approved source; no changes")
        target=patch(previous)
        if git_blob(target)!=NEW_CORE_BLOB:
            raise RuntimeError("Patched PHP does not match approved private source")
        # Avoid changing the backend if any currently used immutable private blob is missing.
        manifest=json.loads(read(private+"/manifest.json",2_000_000))
        files=manifest.get("files",{})
        if len(files)!=321:raise RuntimeError("Unexpected private manifest entries")
        wanted={item["sha"] for item in files.values()}
        listing={x.rsplit("/",1)[-1] for x in ftp.nlst(private+"/cache")}
        if len(wanted-listing):raise RuntimeError("Missing private content blobs; switch aborted")
        status,health=http("content-health")
        if status!=200 or not health.get("configured") or health.get("payments_enabled") is not False:
            raise RuntimeError("Pre-switch health endpoint differs")
        # Full content checksums were verified in the read-only audit. Recheck representative data.
        sample=sorted(wanted)[::max(1,len(wanted)//18)]
        for item in sample:
            blob=read(private+"/cache/"+item)
            if git_blob(blob)!=item:raise RuntimeError("Local content integrity check failed")
        log(preflight=True,manifest_entries=len(files),cached=len(wanted),sampled=len(sample),site_unchanged=True)
        try:ftp.mkd(backup_root)
        except ftplib.error_perm:pass
        ftp.mkd(archive)
        write(archive+"/core.php.bak",previous)
        log(backup_ready=True,private_server_only=True)
        try:
            # core.php is the only active file modified, with a verified backup first.
            changed=True
            write(core,target)
            status,health=http("content-health")
            if status!=200 or health.get("configured") is not True or health.get("payments_enabled") is not False:
                raise RuntimeError("Post-switch backend health check failed")
            for endpoint in ("paid-content","redflag-content","miniapp"):
                code,response=http(endpoint,{"init_data":"","path":"data/year/energy-1.txt"})
                if code!=401 or response.get("ok") is not False:
                    raise RuntimeError("Anonymous access check failed: "+endpoint)
            if sha(read(site+"/index.html"))!=homepage_before:
                raise RuntimeError("Concurrent public homepage change")
            if git_blob(read(core))!=NEW_CORE_BLOB:
                raise RuntimeError("Protected PHP source checksum mismatch")
            log(success=True,live_health=True,anonymous_denied=True,
                all_cached=len(wanted),github_runtime_dependency=False,
                modified_files=["private/core.php"],public_files_modified=0)
        except BaseException:
            if changed:
                try:write(core,previous);log(rolled_back=True)
                except BaseException as exc:log(rollback_failed=str(type(exc).__name__))
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:run()
    except BaseException as exc:log(success=False,reason=str(exc)[:220]);sys.exit(1)
