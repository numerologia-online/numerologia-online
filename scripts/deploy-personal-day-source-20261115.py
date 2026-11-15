"""Guarded publisher: unify live day website with Telegram's GitHub Pages source."""
import ftplib,io,json,os,pathlib,ssl,time,urllib.parse,urllib.request
HOST="server172.hosting.reg.ru"
DOMAIN="xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
ORIGIN="https://numerologia-online.github.io/numerologia-online/"
TAG="20261115-day-source-unified"
D='$'
general='fetch('+chr(96)+'./data/day/general/general-day-'+D+'{String(energy).padStart(2, "0")}.json?v=8'+chr(96)+')'
practical='fetch('+chr(96)+'./data/day/practical/practical-day-'+D+'{String(energy).padStart(2, "0")}.json?v=4'+chr(96)+')'
newgeneral='fetch('+chr(96)+ORIGIN+'data/day/general/general-day-'+D+'{String(energy).padStart(2, "0")}.json'+chr(96)+', { cache: "no-store" })'
newpractical='fetch('+chr(96)+ORIGIN+'data/day/practical/practical-day-'+D+'{String(energy).padStart(2, "0")}.json'+chr(96)+', { cache: "no-store" })'
PATCHES={
"personal-day-feature.js":[(general,newgeneral),(practical,newpractical)],
"app.js":[("./personal-day-feature.js?v=20261106domain1","./personal-day-feature.js?v="+TAG)],
"day.html":[("./personal-day-feature.js?v=58","./personal-day-feature.js?v="+TAG)],
"index.html":[("app.js?v=year-pdf-view-20261113","app.js?v="+TAG)]}
def get(url):
 req=urllib.request.Request(url,headers={"Cache-Control":"no-cache"})
 with urllib.request.urlopen(req,timeout=25) as res:
  if res.status!=200:raise RuntimeError("HTTP_STATUS_FAILED")
  data=res.read(2200001)
 if len(data)>2200000:raise RuntimeError("OVERSIZE")
 return data
def patch(name,raw):
 s=raw.decode("utf-8")
 for old,new in PATCHES[name]:
  if s.count(new)==1:continue
  if s.count(old)!=1:raise RuntimeError("UNRECOGNIZED_LIVE_BASELINE:"+name)
  s=s.replace(old,new)
 for _,new in PATCHES[name]:
  if pathlib.Path(name).read_text().count(new)!=1:raise RuntimeError("GITHUB_SOURCE_MISMATCH:"+name)
 return s.encode("utf-8")
def main():
 if not(os.environ.get("REG_FTP_USER") and os.environ.get("REG_FTP_PASSWORD")):raise RuntimeError("FTP_SECRETS_MISSING")
 canonical=json.loads(get(ORIGIN+"data/day/general/general-day-19.json?verify="+str(time.time_ns())))
 if "Умение вовремя замолчать" not in canonical["entries"]["23"]["text"]:raise RuntimeError("NEWSLETTER_SOURCE_NOT_READY")
 canonical_practical=json.loads(get(ORIGIN+"data/day/practical/practical-day-19.json?verify="+str(time.time_ns())))
 if len(canonical_practical["entries"])!=31:raise RuntimeError("PRACTICAL_SOURCE_NOT_READY")
 print("NEWSLETTER_CANONICAL_SOURCE_VERIFIED",flush=True)
 public_index=get("https://"+DOMAIN+"/index.html?verify="+str(time.time_ns()))
 ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
 ftp.connect(HOST,21)
 ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
 ftp.prot_p();ftp.set_pasv(True)
 def read(p):
  out=io.BytesIO()
  def collect(b):
   if out.tell()+len(b)>2200000:raise RuntimeError("REMOTE_OVERSIZE")
   out.write(b)
  ftp.retrbinary("RETR "+p,collect)
  return out.getvalue()
 def put(p,data):
  ftp.storbinary("STOR "+p,io.BytesIO(data))
  if read(p)!=data:raise RuntimeError("UPLOAD_READBACK_FAILED:"+p)
 try:
  home=ftp.pwd().rstrip("/")
  site=None
  for dom in (DOMAIN,"xn--c1adkkdfjbp1a4l.online"):
   cand=home+"/www/"+dom
   try:
    if read(cand+"/index.html")==public_index:site=cand;break
   except ftplib.error_perm:pass
  if site is None:raise RuntimeError("ACTIVE_SITE_NOT_VERIFIED")
  before={p:read(site+"/"+p) for p in PATCHES}
  after={p:patch(p,before[p]) for p in PATCHES}
  changed=[p for p in PATCHES if before[p]!=after[p]]
  if changed:
   root=home+"/site-safeguard-backups"
   try:ftp.mkd(root)
   except ftplib.error_perm:ftp.cwd(root)
   backup=root+"/unify-personal-day-"+os.environ["GITHUB_RUN_ID"]
   ftp.mkd(backup)
   for i,p in enumerate(changed):put(backup+"/"+str(i)+"-"+p+".before",before[p])
   print("BACKUPS_VERIFIED",len(changed),flush=True)
  done=[]
  try:
   for p in changed:
    if read(site+"/"+p)!=before[p]:raise RuntimeError("CONCURRENT_EDIT:"+p)
    done.append(p);put(site+"/"+p,after[p])
   for p in PATCHES:
    if read(site+"/"+p)!=after[p]:raise RuntimeError("SERVER_READBACK_FAILED:"+p)
    actual=get("https://"+DOMAIN+"/"+p+"?verify="+str(time.time_ns()))
    if actual!=after[p]:raise RuntimeError("PUBLIC_READBACK_FAILED:"+p)
   print("PERSONAL_DAY_UNIFIED_SITE_AND_TELEGRAM_VERIFIED",flush=True)
  except BaseException:
   for p in reversed(done):
    try:put(site+"/"+p,before[p]);print("ROLLBACK_OK",p,flush=True)
    except BaseException:print("ROLLBACK_FAILED",p,flush=True)
   raise
 finally:
  try:ftp.quit()
  except BaseException:ftp.close()
if __name__=="__main__":main()
