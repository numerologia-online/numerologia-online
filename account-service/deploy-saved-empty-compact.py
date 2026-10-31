"""Safely compact only Saved empty card CSS on REG.RU. Preserve every other file."""
import ftplib,hashlib,io,json,os,pathlib,ssl,sys,time
from urllib.request import Request,urlopen
DOMAIN="xn--c1adkkdfjbp1a4l.online";HOST="server172.hosting.reg.ru"
CSS_BEGIN=b'    <style id="numi-saved-library-structure-20261031">'
CSS_END=b'    </style>'
ORIGINALS=[
 ('padding:20px 13px 22px;margin:10px 0;border:1px solid #e3cca1;border-radius:20px;',
  'padding:10px 12px 13px;margin:8px 0;border:1px solid #e3cca1;border-radius:18px;'),
 ('#account-dialog .numi-angel {display:block;width:min(100%,285px);height:auto;margin:0 auto 6px}',
  '#account-dialog .numi-angel {display:block;width:min(100%,155px);height:auto;margin:0 auto 2px}'),
 ('#account-dialog .numi-saved-empty h4 {margin:2px 0 8px;color:#184b38;font:normal 27px/1.15 Georgia,serif}',
  '#account-dialog .numi-saved-empty h4 {margin:2px 0 5px;color:#184b38;font:normal 22px/1.15 Georgia,serif}'),
 ('#account-dialog .numi-saved-empty p {margin:0;max-width:260px;color:#718278;font-size:13px;line-height:1.5}',
  '#account-dialog .numi-saved-empty p {margin:0;max-width:260px;color:#718278;font-size:12px;line-height:1.4}')
]
def digest(x):return hashlib.sha256(x).digest()
def status(**x):print("NUMI_COMPACT_SAVED_EMPTY",json.dumps(x,sort_keys=True),flush=True)
def public():
  url="https://"+DOMAIN+"/?compact_saved="+str(time.time_ns())
  with urlopen(Request(url,headers={"Cache-Control":"no-cache"}),timeout=35) as response:
    if response.status!=200:raise RuntimeError("HTTP status mismatch")
    return response.read(3000000)
def main():
  src=pathlib.Path("index.html").read_bytes()
  if src.count(CSS_BEGIN)!=1:raise RuntimeError("Local CSS marker missing")
  newblock=CSS_BEGIN+src.split(CSS_BEGIN,1)[1].split(CSS_END,1)[0]+CSS_END
  if any(new.encode() not in newblock for _,new in ORIGINALS):raise RuntimeError("New style incomplete")
  ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
  ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
  ftp.prot_p();ftp.set_pasv(True)
  root=ftp.pwd().rstrip("/")
  html=root+"/www/"+DOMAIN+"/index.html";guard=root+"/www/"+DOMAIN+"/.htaccess"
  def read(p):
    o=io.BytesIO();ftp.retrbinary("RETR "+p,o.write);return o.getvalue()
  def write(p,b):
    ftp.storbinary("STOR "+p,io.BytesIO(b))
    if digest(read(p))!=digest(b):raise RuntimeError("Remote checksum mismatch")
  try:
    original=read(html);protection=read(guard)
    if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in protection:
      raise RuntimeError("Protected paid content guard missing")
    if original.count(CSS_BEGIN)!=1:raise RuntimeError("Saved styles missing on live site")
    prev=CSS_BEGIN+original.split(CSS_BEGIN,1)[1].split(CSS_END,1)[0]+CSS_END
    if prev==newblock:
      status(success=True,already_live=True);return
    patch=prev
    for old,new in ORIGINALS:
      if patch.count(old.encode())!=1:raise RuntimeError("Unexpected previous CSS value: "+old[:45])
      patch=patch.replace(old.encode(),new.encode(),1)
    if patch!=newblock:
      raise RuntimeError("Extra CSS differences: refusing unrelated layout changes")
    updated=original.replace(prev,patch,1)
    parent=root+"/site-safeguard-backups"
    try:ftp.mkd(parent)
    except ftplib.error_perm:ftp.cwd(parent)
    backup=parent+"/saved-empty-compact-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
    ftp.mkd(backup);write(backup+"/index.html.bak",original)
    attempted=False
    try:
      attempted=True;write(html,updated)
      if digest(public())!=digest(updated):raise RuntimeError("Live homepage verification mismatch")
      if read(guard)!=protection:raise RuntimeError("Paid content guard changed")
      status(success=True,live_verified=True,only_saved_card_css_changed=True)
    except BaseException:
      if attempted:write(html,original)
      status(rollback_complete=True)
      raise
  finally:
    try:ftp.quit()
    except BaseException:ftp.close()
if __name__=="__main__":
  try:main()
  except BaseException as exc:
    status(success=False,reason=str(exc)[:160] if isinstance(exc,RuntimeError) else type(exc).__name__)
    sys.exit(1)
