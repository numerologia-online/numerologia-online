"""Editorial additions to ten public encyclopedia articles only."""
import concurrent.futures, ftplib, hashlib, html, io, json, os, pathlib, re, ssl, subprocess, time, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
OLD="880a705d66fea9d9f1305b5ce2aec0f95dbab91d"
NUMBERS=(10,12,15,16,17,18,19,20,21,22)
PATHS=[f"guide/22-energii/energy-{n}/index.html" for n in NUMBERS]
def local(p):return (ROOT/p).read_bytes()
def old(p):return subprocess.check_output(["git","show",OLD+":"+p],cwd=ROOT)
def offline():
    pattern=re.compile(r'(<section id="[^"]+">)(.*?)(</section>)',re.S)
    count=0;words=0
    for p in PATHS:
        a=old(p).decode("utf-8");b=local(p).decode("utf-8")
        aa=list(pattern.finditer(a));bb=list(pattern.finditer(b))
        assert len(aa)==len(bb)==14,p
        additions=[]
        for x,y in zip(aa,bb):
            assert x.group(1)==y.group(1) and y.group(2).startswith(x.group(2)),p
            extra=y.group(2)[len(x.group(2)):]
            if extra:
                assert re.fullmatch(r"\n<p>[^<>]+</p>",extra),p
                text=html.unescape(extra[4:-4])
                assert "\u2014" not in text and "\u2013" not in text,p
                additions.append((y.start(2)+len(x.group(2)),y.end(2)))
                words+=len(text.split());count+=1
        restored=b
        for start,end in reversed(additions):restored=restored[:start]+restored[end:]
        assert restored==a and additions,p
        assert 'content="index,follow"' in b
        print("SOURCE VERIFIED",p,"new paragraphs",len(additions),flush=True)
    assert count==92 and words>6000,(count,words)
    print("OFFLINE OK",count,"new paragraphs;",words,"words; original content and layout unchanged",flush=True)
def verify(p,b):
    url=BASE+p.removesuffix("index.html")+"?article_review="+os.environ["GITHUB_SHA"][:12]
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req,timeout=35) as r:
        if r.status!=200 or r.read(3_000_001)!=b:raise RuntimeError("HTTP mismatch "+p)
        if "noindex" in r.headers.get("X-Robots-Tag","").lower():raise RuntimeError("Index blocked "+p)
    print("HTTP VERIFIED",p,flush=True)
def main():
    offline()
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    ftp.connect("server172.hosting.reg.ru",21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p()
    home=ftp.pwd().rstrip("/");root=home+"/www/xn--c1adkkdfjbp1a4l.online/"
    def read(p):
        out=io.BytesIO();ftp.retrbinary("RETR "+p,out.write);return out.getvalue()
    def write(p,b):
        ftp.storbinary("STOR "+p,io.BytesIO(b))
        if read(p)!=b:raise RuntimeError("FTP readback mismatch "+p)
    def mkdir(p):
        try:ftp.mkd(p)
        except ftplib.error_perm:
            before=ftp.pwd();ftp.cwd(p);ftp.cwd(before)
    originals={};targets={};changed=[]
    try:
        for p in PATHS:
            b=read(root+p)
            if b not in (old(p),local(p)):raise RuntimeError("Unexpected live version "+p)
            originals[p]=b;targets[p]=local(p)
        mkdir(home+"/site-safeguard-backups")
        backup=home+"/site-safeguard-backups/energy-review-"+str(time.time_ns());mkdir(backup)
        names={}
        for p,b in originals.items():
            name=hashlib.sha256(p.encode()).hexdigest()[:16]+".bak";names[p]=name;write(backup+"/"+name,b)
        write(backup+"/manifest.json",json.dumps(names).encode())
        try:
            for p in PATHS:
                if originals[p]==targets[p]:continue
                if read(root+p)!=originals[p]:raise RuntimeError("Concurrent edit "+p)
                changed.append(p);write(root+p,targets[p])
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(lambda item:verify(*item),targets.items()))
            print("ENERGY REVIEW SUCCESS: ten public articles only",flush=True)
        except BaseException:
            for p in reversed(changed):
                try:write(root+p,originals[p]);print("ROLLBACK OK",p,flush=True)
                except BaseException as e:print("ROLLBACK FAILED",p,str(e),flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":main()
