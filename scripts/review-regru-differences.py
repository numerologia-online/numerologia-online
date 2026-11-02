"""Read-only review of production-vs-GitHub JS/CSS differences.
Only creates a diagnostic JSON report; never uploads code to REG.RU.
"""
import ftplib, ssl, os, io, pathlib, difflib, json, hashlib, re
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
FILES=["account-browser.js","redflag-feature.js","compatibility-feature.js","destiny-code-feature.js","compatibility-polish.css","destiny-code.css"]
def digest(b):return hashlib.sha256(b).hexdigest()[:16]
def main():
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p();ftp.set_pasv(True)
    base=ftp.pwd().rstrip("/")+"/www/"+DOMAIN
    out={"kind":"read-only production difference review","files":[]}
    try:
      for name in FILES:
        buf=io.BytesIO()
        ftp.retrbinary("RETR "+base+"/"+name,buf.write)
        live=buf.getvalue()
        github=pathlib.Path(name).read_bytes()
        la=live.decode("utf-8","replace").splitlines()
        ga=github.decode("utf-8","replace").splitlines()
        matcher=difflib.SequenceMatcher(a=la,b=ga,autojunk=False)
        sections=[]
        for kind,l1,l2,g1,g2 in matcher.get_opcodes():
          if kind=="equal":continue
          # only snippets of public JS or CSS, no server private code, no PII
          minus=la[l1:l2];plus=ga[g1:g2]
          def preview(lines):
            clean=[]
            for s in lines[:28]:
              if re.search(r'password|token|secret|api_key|Authorization',s,re.I):
                clean.append("[sensitive line hidden]")
              else:
                clean.append(s[:190])
            return clean
          sections.append({"kind":kind,"live_range":[l1+1,l2],
            "github_range":[g1+1,g2],"live_lines":preview(minus),
            "github_lines":preview(plus),"live_line_count":len(minus),
            "github_line_count":len(plus)})
        out["files"].append({"name":name,"live_bytes":len(live),"github_bytes":len(github),
          "live_hash":digest(live),"github_hash":digest(github),"changes":sections})
    finally:
      try:ftp.quit()
      except BaseException:ftp.close()
    pathlib.Path("diagnostics").mkdir(exist_ok=True)
    pathlib.Path("diagnostics/regru-diff-review.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
    for f in out["files"]:
      print("DIFF",f["name"],"sections="+str(len(f["changes"])),"live="+str(f["live_bytes"]),"github="+str(f["github_bytes"]),flush=True)
if __name__=="__main__":main()
