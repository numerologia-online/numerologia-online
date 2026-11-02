"""Read-only inventory of current REG.RU website before a protected backup."""
import ftplib, ssl, os, json, pathlib, posixpath
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
MAX_FILES=30000
def main():
 f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
 f.connect(HOST,21);f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);f.prot_p();f.set_pasv(True)
 root=f.pwd().rstrip("/")
 base=root+"/www/"+DOMAIN
 stats={"dirs":0,"files":0,"size_bytes":0,"size_unknown":0,"extensions":{},"top_directories":{},"largest":[],"unsafe_links":0}
 queue=[("",base)]
 try:
  while queue:
   rel,remote=queue.pop(0)
   if stats["files"]>MAX_FILES:raise RuntimeError("Inventory exceeds guard")
   for name,meta in f.mlsd(remote,facts=["type","size"]):
    if name in (".",".."):continue
    p=posixpath.join(rel,name)
    if meta.get("type")=="dir":
     stats["dirs"]+=1
     queue.append((p,remote+"/"+name))
    elif meta.get("type")=="file":
     size=int(meta["size"]) if meta.get("size","").isdigit() else None
     stats["files"]+=1
     if size is None:stats["size_unknown"]+=1
     else:stats["size_bytes"]+=size
     ext=pathlib.PurePosixPath(name).suffix.lower() or "(none)"
     stats["extensions"][ext]=stats["extensions"].get(ext,0)+1
     top=p.split("/",1)[0]
     info=stats["top_directories"].setdefault(top,{"files":0,"bytes":0})
     info["files"]+=1
     info["bytes"]+=size or 0
     if size:
      stats["largest"].append({"name":p,"bytes":size})
      stats["largest"]=sorted(stats["largest"],key=lambda v:v["bytes"],reverse=True)[:12]
    else:
     stats["unsafe_links"]+=1
  print("SITE_FILE_COUNT",stats["files"],"TOTAL_BYTES",stats["size_bytes"],"DIRECTORIES",stats["dirs"],flush=True)
  print("TOP_LEVEL_COUNT",len(stats["top_directories"]),flush=True)
  output={"purpose":"REG.RU read-only snapshot preflight","site_root":"www/"+DOMAIN,"stats":stats}
  pathlib.Path("diagnostics").mkdir(exist_ok=True)
  pathlib.Path("diagnostics/regru-backup-inventory.json").write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n")
 finally:
  try:f.quit()
  except BaseException:f.close()
if __name__=="__main__":main()
