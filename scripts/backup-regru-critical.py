"""Fast immutable critical frontend snapshot, independent of slower full archive."""
import ftplib,ssl,os,io,hashlib,tarfile,time,tempfile,pathlib,json
HOST="server172.hosting.reg.ru"; DOMAIN="xn--c1adkkdfjbp1a4l.online"
FILES=[".htaccess","index.html","app.js","auth-profile.js","account-browser.js","year-feature.js","matrix-feature.js","redflag-feature.js","redflag-categories.js","compatibility-feature.js","destiny-code-feature.js","personal-day-feature.js","year-polish.css","matrix-polish.css","redflag-polish.css","compatibility-polish.css","destiny-code.css","service-worker.js","pro/index.html","contacts.html","privacy.html","offer.html","refunds.html","terms.html","disclaimer.html"]
def digest(b):return hashlib.sha256(b).hexdigest()
def main():
 f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40);f.connect(HOST,21);f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);f.prot_p();f.set_pasv(True)
 root=f.pwd().rstrip("/");base=root+"/www/"+DOMAIN;backup_root=root+"/site-safeguard-backups"
 folder=backup_root+"/reference-critical-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
 raw={}
 try:
  for path in FILES:
   buf=io.BytesIO();f.retrbinary("RETR "+base+"/"+path,buf.write)
   raw[path]=buf.getvalue()
   if path==".htaccess" and b"NUMI PAID STATIC ACCESS GUARD" not in raw[path]:raise RuntimeError("No guard")
  with tempfile.TemporaryFile() as tmp:
   with tarfile.open(fileobj=tmp,mode="w:gz") as archive:
    for path,data in raw.items():
     info=tarfile.TarInfo(path);info.size=len(data);info.mode=0o600;archive.addfile(info,io.BytesIO(data))
   tmp.seek(0);data=tmp.read()
  try:f.mkd(backup_root)
  except ftplib.error_perm:f.cwd(backup_root)
  f.mkd(folder)
  f.storbinary("STOR "+folder+"/site-critical.tar.gz",io.BytesIO(data))
  verify=io.BytesIO();f.retrbinary("RETR "+folder+"/site-critical.tar.gz",verify.write)
  if digest(verify.getvalue())!=digest(data):raise RuntimeError("Backup checksum mismatch")
  manifest={"status":"verified","backup_folder":"site-safeguard-backups/"+folder.rsplit("/",1)[-1],"archive":"site-critical.tar.gz","files":len(raw),"archive_sha256":digest(data),"archive_bytes":len(data),"scope":"critical frontend and legal pages, .htaccess; not full site; no database","production_modified":False}
  f.storbinary("STOR "+folder+"/manifest.json",io.BytesIO(json.dumps(manifest).encode()))
  pathlib.Path("diagnostics").mkdir(exist_ok=True)
  pathlib.Path("diagnostics/regru-critical-backup.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
  print("CRITICAL_BACKUP success=true files="+str(len(raw))+" verified=true",flush=True)
 finally:
  try:f.quit()
  except BaseException:f.close()
if __name__=="__main__":main()
