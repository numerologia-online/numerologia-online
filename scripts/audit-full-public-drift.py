"""Check entire frozen REG.RU live snapshot against tracked public GitHub assets.
NEVER print or commit content from the tarball (may contain confidential PHP).
No changes to production or GitHub site files.
"""
import ftplib, ssl, os, io, hashlib, pathlib, tarfile, json, subprocess
DOMAIN="xn--c1adkkdfjbp1a4l.online"
FOLDER="reference-live-20261102T134447Z"
PUBLIC_EXT={".html",".js",".css",".svg",".png",".jpg",".jpeg",".webp",".gif",".ico",".woff",".woff2",".txt",".webmanifest",".pdf"}
def digest(b):return hashlib.sha256(b).hexdigest()
def safe(name):
  p=pathlib.PurePosixPath(name)
  if p.is_absolute() or ".." in p.parts:return False
  if p.suffix.lower() not in PUBLIC_EXT:return False
  if p.parts[0] in ("api","server","private","auth-server","auth-free","cloudflare",".github","scripts","diagnostics","tests","knowledge","data"):return False
  if "secret" in name.lower() or "private" in name.lower() or "config" in name.lower():return False
  return True
def main():
 ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=50)
 ftp.connect("server172.hosting.reg.ru",21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
 root=ftp.pwd().rstrip("/")
 archive=io.BytesIO()
 try:
  ftp.retrbinary("RETR "+root+"/site-safeguard-backups/"+FOLDER+"/live-webroot.tar.gz",archive.write,blocksize=131072)
 finally:
  try:ftp.quit()
  except BaseException:ftp.close()
 snapshot={}
 with tarfile.open(fileobj=io.BytesIO(archive.getvalue()),mode="r:gz") as tar:
  for item in tar:
   if not item.isfile() or not safe(item.name):continue
   source=tar.extractfile(item).read()
   snapshot[item.name]=digest(source)
 tracked=subprocess.check_output(["git","ls-files","-z"]).decode("utf-8").split("\0")
 repo_files={p for p in tracked if p and safe(p)}
 same=[];diff=[];live_only=[]
 for name,expected in snapshot.items():
  if name not in repo_files:
   live_only.append(name)
  elif not pathlib.Path(name).is_file():
   diff.append(name)
  elif digest(pathlib.Path(name).read_bytes())==expected:
   same.append(name)
  else:
   diff.append(name)
 github_only=sorted(repo_files-set(snapshot))
 report={"kind":"public-asset snapshot drift only; data, private and server files excluded",
   "snapshot":FOLDER,"compared":len(snapshot),"matches":len(same),
   "mismatches":len(diff),"live_only_count":len(live_only),
   "github_only_count":len(github_only),
   "mismatch_files":sorted(diff)[:110],
   "live_only_examples":sorted(live_only)[:40],
   "github_only_examples":github_only[:40]}
 pathlib.Path("diagnostics").mkdir(exist_ok=True)
 pathlib.Path("diagnostics/regru-full-public-drift.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
 print("REFERENCE_DIFF",json.dumps({"checked":len(snapshot),"same":len(same),"diff":len(diff),"live_only":len(live_only),"repo_only":len(github_only)},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
