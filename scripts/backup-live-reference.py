"""Immutable live REG.RU full-web-root file snapshot in nonpublic FTP storage.

Read-only on live website. The only writes are two new files under
/site-safeguard-backups/reference-live-* (outside www).
No database export is performed. No source or secrets are committed to GitHub.
"""
import ftplib, ssl, os, io, json, hashlib, pathlib, posixpath, tempfile, tarfile, time, sys, stat
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
LIMIT_FILES=28000
LIMIT_BYTES=1250000000
LIMIT_FILE_BYTES=150000000
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=60)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    site=home+"/www/"+DOMAIN
    backuproot=home+"/site-safeguard-backups"
    timestamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
    dest=backuproot+"/reference-live-"+timestamp
    entries=[]
    folders=[]
    total=0
    print("SNAPSHOT stage=inventory root=live-site",flush=True)
    try:
      queue=[("",site)]
      while queue:
        rel,remote=queue.pop(0)
        for name,attrs in ftp.mlsd(remote,facts=["type","size"]):
          if name in (".",".."):continue
          if "/" in name or name in ("..",".") or "\\ " in name:raise RuntimeError("Unsafe filename")
          child=posixpath.join(rel,name)
          kind=attrs.get("type")
          if kind=="dir":
            folders.append(child)
            queue.append((child,remote+"/"+name))
          elif kind=="file":
            size=attrs.get("size")
            if size is None or not str(size).isdigit(): raise RuntimeError("Unknown file size")
            size=int(size)
            total+=size
            if size>LIMIT_FILE_BYTES:raise RuntimeError("Individual file size exceeds safety limit")
            entries.append((child,remote+"/"+name,size))
            if len(entries)>LIMIT_FILES or total>LIMIT_BYTES:raise RuntimeError("Website exceeds safe snapshot size")
          else:
            raise RuntimeError("Unknown FTP entry type")
      if not entries or not any(x[0]=="index.html" for x in entries):
        raise RuntimeError("Production inventory missing homepage")
      print("SNAPSHOT stage=inventory_complete files="+str(len(entries))+" bytes="+str(total)+" dirs="+str(len(folders)),flush=True)
      with tempfile.TemporaryDirectory() as tmp:
        archive_path=pathlib.Path(tmp)/"live-webroot.tar.gz"
        manifest={"kind":"immutable REG.RU production snapshot","date_utc":timestamp,
                  "contains":"complete FTP www site root including any server-side files",
                  "database_included":False,"files":[]}
        with tarfile.open(archive_path,"w:gz",compresslevel=3) as archive:
          for n,(rel,remote,size) in enumerate(entries,1):
            data=io.BytesIO()
            ftp.retrbinary("RETR "+remote,data.write,blocksize=131072)
            raw=data.getvalue()
            if len(raw)!=size:raise RuntimeError("Changed during backup: "+rel)
            manifest["files"].append({"path":rel,"bytes":size,"sha256":sha(raw)})
            info=tarfile.TarInfo(name=rel)
            info.size=len(raw)
            info.mode=0o600
            info.mtime=0
            archive.addfile(info,io.BytesIO(raw))
            if n%250==0:print("SNAPSHOT stage=read files="+str(n)+"/"+str(len(entries)),flush=True)
        source_sha=hashlib.sha256(archive_path.read_bytes()).hexdigest()
        manifest["archive_sha256"]=source_sha
        manifest["archive_bytes"]=archive_path.stat().st_size
        report=json.dumps(manifest,indent=2,ensure_ascii=False).encode("utf-8")
        try:ftp.mkd(backuproot)
        except ftplib.error_perm:ftp.cwd(backuproot)
        ftp.mkd(dest)
        archive_remote=dest+"/live-webroot.tar.gz"
        manifest_remote=dest+"/manifest.json"
        with archive_path.open("rb") as src:
          ftp.storbinary("STOR "+archive_remote,src,blocksize=131072)
        with tempfile.TemporaryFile() as tmp_read:
          ftp.retrbinary("RETR "+archive_remote,tmp_read.write,blocksize=131072)
          tmp_read.seek(0)
          remote_hash=hashlib.sha256()
          while True:
            part=tmp_read.read(1024*1024)
            if not part:break
            remote_hash.update(part)
        if source_sha!=remote_hash.hexdigest():
          raise RuntimeError("Remote archive checksum mismatch")
        ftp.storbinary("STOR "+manifest_remote,io.BytesIO(report))
        verify=io.BytesIO()
        ftp.retrbinary("RETR "+manifest_remote,verify.write)
        if verify.getvalue()!=report:raise RuntimeError("Manifest mismatch")
        summary={"status":"verified","backup_folder":"site-safeguard-backups/reference-live-"+timestamp,
                 "archive":"live-webroot.tar.gz","manifest":"manifest.json",
                 "files":len(entries),"uncompressed_bytes":total,
                 "archive_bytes":archive_path.stat().st_size,
                 "archive_sha256":source_sha,
                 "database_included":False,"live_site_modified":False}
        print("SNAPSHOT stage=verified files="+str(len(entries))+" archive_bytes="+str(summary["archive_bytes"]),flush=True)
        pathlib.Path("diagnostics").mkdir(exist_ok=True)
        pathlib.Path("diagnostics/regru-reference-backup.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n")
    finally:
      try:ftp.quit()
      except BaseException:ftp.close()
if __name__=="__main__":
  try:main()
  except BaseException as exc:
    print("SNAPSHOT stage=failed error="+type(exc).__name__,flush=True)
    raise
