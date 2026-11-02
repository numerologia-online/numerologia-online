"""Read-only REG.RU module diagnostic with safe JSON report (no source or secrets)."""
import ftplib, hashlib, io, json, os, pathlib, re, ssl, difflib, subprocess, tempfile
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
FILES=["index.html","app.js","auth-profile.js","account-browser.js","year-feature.js","matrix-feature.js","redflag-feature.js","redflag-categories.js","compatibility-feature.js","personal-day-feature.js","destiny-code-feature.js","year-polish.css","matrix-polish.css","redflag-polish.css","compatibility-polish.css","destiny-code.css","contacts.html","analytics-settings.html"]
def sha(b):return hashlib.sha256(b).hexdigest()[:16]
def main():
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    f.connect(HOST,21);f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);f.prot_p();f.set_pasv(True)
    base=f.pwd().rstrip("/")+"/www/"+DOMAIN
    cache={}
    def remote(name):
        if name in cache:return cache[name]
        out=io.BytesIO()
        try:f.retrbinary("RETR "+base+"/"+name,out.write);cache[name]=out.getvalue()
        except ftplib.error_perm as e:
            if str(e).startswith("550"):cache[name]=None
            else:raise
        return cache[name]
    report={"diagnostic":"read-only","production":"REG.RU","files":[],"modules":[],"errors":[]}
    try:
        for name in FILES:
            live=remote(name)
            local=pathlib.Path(name).read_bytes() if pathlib.Path(name).is_file() else None
            entry={"name":name,"status":"missing" if live is None else "match" if live==local else "different","remote_bytes":len(live) if live is not None else None,"github_bytes":len(local) if local is not None else None,"remote_hash":sha(live) if live is not None else None,"github_hash":sha(local) if local is not None else None}
            if live is not None and local is not None and live!=local:
                old=live.decode("utf-8","replace").splitlines()
                new=local.decode("utf-8","replace").splitlines()
                changes=[op for op in difflib.SequenceMatcher(a=old,b=new,autojunk=False).get_opcodes() if op[0]!="equal"]
                entry["changed_regions"]=len(changes)
                entry["changed_line_ranges"]=[{"remote":[a+1,b],"github":[c+1,d],"kind":tag} for tag,a,b,c,d in changes[:18]]
            report["files"].append(entry)
        source=remote("app.js")
        if source:
            for item in source.decode("utf-8","replace").split('import("./')[1:]:
                name=item.split('"',1)[0].split("?",1)[0]
                report["modules"].append({"name":name,"present":remote(name) is not None})
        for name in ["app.js","auth-profile.js","account-browser.js","redflag-feature.js","compatibility-feature.js","destiny-code-feature.js"]:
            live=remote(name)
            if live is None:continue
            with tempfile.NamedTemporaryFile(suffix=".mjs") as tmp:
                tmp.write(live);tmp.flush()
                check=subprocess.run(["node","--check",tmp.name],capture_output=True,text=True)
                report.setdefault("syntax",[]).append({"file":name,"valid":check.returncode==0,"error_type":"SyntaxError" if check.returncode else None})
        # Inspect transitive static and dynamic ES-module dependencies on live REG.RU.
        import posixpath
        roots=["app.js","year-feature.js","matrix-feature.js","redflag-feature.js",
               "compatibility-feature.js","personal-day-feature.js","destiny-code-feature.js"]
        scanned=set()
        queue=list(roots)
        missing=[]
        parse_errors=[]
        while queue and len(scanned)<120:
            name=queue.pop(0)
            if name in scanned:continue
            scanned.add(name)
            data=remote(name)
            if data is None:
                missing.append({"from":"entry","path":name})
                continue
            value=data.decode("utf-8","replace")
            patterns=[
                r"""\\bfrom\\s+['"]([^'"]+)['"]""",
                r"""\\bimport\\s*\\(\\s*['"]([^'"]+)['"]""",
                r"""\\bimport\\s+['"]([^'"]+)['"]"""
            ]
            references=[]
            for pattern in patterns:
                references.extend(re.findall(pattern,value))
            for ref in references:
                if not ref.startswith("."):continue
                child=posixpath.normpath(posixpath.join(posixpath.dirname(name),ref.split("?",1)[0]))
                if child.startswith("../"):continue
                if remote(child) is None:missing.append({"from":name,"path":child})
                elif child.endswith(".js") and child not in scanned and child not in queue:queue.append(child)
        report["dependency_audit"]={"scanned":len(scanned),"missing":missing,"files":sorted(scanned)}
        index=remote("index.html") or b""
        report["index_checks"]={k: (v in index) for k,v in {
            "telegram_script":b"auth-profile.js?v=20",
            "app_script":b"app.js?v=20261101fix1",
            "cookie_popup":b'numi-cookie-notice',
            "contact_link":b'href="/contacts.html"',
        }.items()}
    finally:
        try:f.quit()
        except BaseException:f.close()
    pathlib.Path("diagnostics").mkdir(exist_ok=True)
    pathlib.Path("diagnostics/regru-current.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("RESULT",json.dumps({"different":[x["name"] for x in report["files"] if x["status"]=="different"],"missing_modules":[x for x in report["modules"] if not x["present"]],"invalid_js":[x for x in report.get("syntax",[]) if not x["valid"]]},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
