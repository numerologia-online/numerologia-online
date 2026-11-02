"""Verify latest immutable REG.RU live full-site archive metadata, read only."""
import ftplib, ssl, os, io, json, pathlib, time
HOST="server172.hosting.reg.ru"
def main():
  ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
  ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
  root=ftp.pwd().rstrip("/")+"/site-safeguard-backups"
  try:
    names=[n for n,meta in ftp.mlsd(root,facts=["type"]) if n.startswith("reference-live-") and meta.get("type")=="dir"]
    if not names:raise RuntimeError("Full snapshot folder absent")
    folder=sorted(names)[-1]
    buf=io.BytesIO()
    ftp.retrbinary("RETR "+root+"/"+folder+"/manifest.json",buf.write)
    manifest=json.loads(buf.getvalue().decode("utf-8"))
    files=manifest.get("files",[])
    if len(files)<600 or not manifest.get("archive_sha256"):
      raise RuntimeError("Full snapshot manifest incomplete")
    archive_size=ftp.size(root+"/"+folder+"/live-webroot.tar.gz")
    if archive_size!=manifest.get("archive_bytes"):
      raise RuntimeError("Archive size differs from verified manifest")
    out={"status":"verified","backup_folder":"site-safeguard-backups/"+folder,
         "archive":"live-webroot.tar.gz","manifest":"manifest.json",
         "files":len(files),"archive_sha256":manifest["archive_sha256"],
         "archive_bytes":archive_size,
         "database_included":False,"live_site_modified":False}
    pathlib.Path("diagnostics").mkdir(exist_ok=True)
    pathlib.Path("diagnostics/regru-reference-backup.json").write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n")
    print("REFERENCE_VERIFIED",json.dumps(out,ensure_ascii=False),flush=True)
  finally:
    try:ftp.quit()
    except BaseException:ftp.close()
if __name__=="__main__":main()
