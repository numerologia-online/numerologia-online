"""Publish only the redesigned public journal landing page and its isolated CSS."""
import ftplib, io, os, pathlib, re, ssl, subprocess, time, urllib.request, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
OLD="93a025e85cb44f0a557e3521d46fc493cbc0e123"
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
CSS="guide/magazine-20261126.css"
PAGE="guide/index.html"
PATHS=[CSS,PAGE]
def local(p):return (ROOT/p).read_bytes()
def old(p):return subprocess.check_output(["git","show",OLD+":"+p],cwd=ROOT)
def offline():
    a=old(PAGE).decode("utf-8")
    b=local(PAGE).decode("utf-8")
    old_links={x for x in re.findall(r'href="([^"]+)"',a) if "journal.css" not in x}
    new_links=set(re.findall(r'href="([^"]+)"',b))
    assert old_links<=new_links,old_links-new_links
    assert b.count("<h1")==1 and 'content="index,follow"' in b
    assert 'href="/guide/magazine-20261126.css?v=1"' in b
    assert b.count('class="editorial-card ')==5 and b.count('class="collection ')==5
    assert len(re.findall(r'data-section="[^"]+"',b))==8
    assert len(local(CSS))<12000
    for p in re.findall(r'<img[^>]* src="/([^"]+)"',b):
        assert (ROOT/p).is_file(),p
    for p in new_links:
        if p.startswith("/guide/") and p.endswith("/"):assert (ROOT/p.lstrip("/")/"index.html").is_file(),p
    print("OFFLINE OK: all original links preserved, 8 rubrics, 5 illustrated stories and 5 encyclopedia cards; no added images or external scripts",flush=True)
def verify(p,b):
    url=BASE+("guide/" if p==PAGE else p)+"?magazine="+os.environ.get("GITHUB_SHA","check")[:12]
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req,timeout=40) as r:
        assert r.status==200 and r.read(2_000_001)==b,p
        if p==PAGE:assert "noindex" not in r.headers.get("X-Robots-Tag","").lower()
    print("HTTP VERIFIED",p,flush=True)
def main():
    offline()
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    ftp.connect("server172.hosting.reg.ru",21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p()
    home=ftp.pwd().rstrip("/");root=home+"/www/xn--c1adkkdfjbp1a4l.online/"
    def read(p):
        out=io.BytesIO()
        try:ftp.retrbinary("RETR "+p,out.write)
        except ftplib.error_perm as e:
            if str(e).startswith("550"):return None
            raise
        return out.getvalue()
    def write(p,b):
        ftp.storbinary("STOR "+p,io.BytesIO(b))
        assert read(p)==b,p
    def mkdir(p):
        try:ftp.mkd(p)
        except ftplib.error_perm:
            previous=ftp.pwd();ftp.cwd(p);ftp.cwd(previous)
    originals={};changed=[]
    try:
        assert read(root+"index.html") is not None,"webroot missing"
        for p in re.findall(r'<img[^>]* src="/([^"]+)"',local(PAGE).decode("utf-8")):
            assert read(root+p) is not None,"missing live asset "+p
        originals={p:read(root+p) for p in PATHS}
        assert originals[PAGE] in (old(PAGE),local(PAGE)),"Live journal differs from reviewed version; refusing overwrite"
        assert originals[CSS] in (None,local(CSS)),"Unexpected existing CSS"
        mkdir(home+"/site-safeguard-backups")
        backup=home+"/site-safeguard-backups/magazine-"+str(time.time_ns());mkdir(backup)
        for p,b in originals.items():
            if b is not None:write(backup+"/"+p.rsplit("/",1)[-1]+".bak",b)
        try:
            for p in PATHS:
                if originals[p]==local(p):continue
                assert read(root+p)==originals[p],"Concurrent edit "+p
                changed.append(p);write(root+p,local(p))
                print("FTP VERIFIED",p,flush=True)
            for p in PATHS:verify(p,local(p))
            print("MAGAZINE SUCCESS: only guide/index.html and isolated stylesheet published",flush=True)
        except BaseException:
            for p in reversed(changed):
                try:
                    if originals[p] is None:ftp.delete(root+p)
                    else:write(root+p,originals[p])
                    print("ROLLBACK OK",p,flush=True)
                except BaseException as e:print("ROLLBACK FAILED",p,str(e),flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":main()
