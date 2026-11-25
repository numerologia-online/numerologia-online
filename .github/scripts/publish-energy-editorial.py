"""Safe visual-only release for the energy encyclopedia."""
import concurrent.futures, ftplib, hashlib, io, os, pathlib, re, ssl, subprocess, time, urllib.request, xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
OLD="59d17953072501067e3a5cbd80f08d79a7116007"
HUB="guide/22-energii/index.html"
ASSETS=["guide/22-energii/editorial.css","guide/22-energii/symbols.svg"]
PAGES=[f"guide/22-energii/energy-{n}/index.html" for n in range(1,23)]
PATHS=ASSETS+PAGES+[HUB]
def local(p): return (ROOT/p).read_bytes()
def old(p): return subprocess.check_output(["git","show",OLD+":"+p],cwd=ROOT)
def region(s,start,end):
    if s.count(start)!=1 or s.count(end)!=1: raise RuntimeError("Unexpected hub markers")
    i=s.index(start);j=s.index(end,i)+len(end)
    return s[i:j]
def hero(s):
    m=re.search(rb'<div class="hero">(<div class="eyebrow">[^<]*</div><h1>[^<]*</h1><p class="lead">[^<]*</p>)</div>',s)
    if not m: raise RuntimeError("Unexpected hub hero")
    return m.group()
def hub_target(live):
    if live==local(HUB): return live
    before=old(HUB);after=local(HUB)
    if live==before:return after
    a=b"<!-- ENERGY_ENCYCLOPEDIA_START -->";z=b"<!-- ENERGY_ENCYCLOPEDIA_END -->"
    beforefrag=region(before,a,z);afterfrag=region(after,a,z)
    h=hero(before);newhero=after[after.index(b'<div class="hero energy-hero">'):after.index(a)]
    newhero=newhero.rstrip()
    if live.count(beforefrag)!=1 or live.count(h)!=1 or live.count(b"<body>")!=1 or live.count(b"</head>")!=1: raise RuntimeError("Hub has conflicting live edits")
    return live.replace(beforefrag,afterfrag,1).replace(h,newhero,1).replace(b"<body>",b'<body class="energy-editorial">',1).replace(b"</head>",b'<link rel="stylesheet" href="/guide/22-energii/editorial.css?v=20261125"></head>',1)
def offline():
    assert sum(len(local(p)) for p in ASSETS)<16000
    sprite=ET.fromstring(local(ASSETS[1]));assert {x.attrib["id"] for x in sprite}=={f"e{n}" for n in range(23)}
    assert local(HUB).count(b'class="energy-card"')==22
    for n,p in enumerate(PAGES,1):
        a,b=old(p),local(p);marker=b'<article class="paper">'
        assert a.split(marker,1)[1]==b.split(marker,1)[1],p
        assert f"symbols.svg#e{n}\"".encode() in b and b'content="index,follow"' in b
        assert b.count(b'<h1>')==1 and len(b)-len(a)<1200
    print("OFFLINE OK: 22 unmodified article bodies, 22 cards, 23 symbols; asset bytes:",sum(len(local(p)) for p in ASSETS),flush=True)
def verify(p,b):
    url=BASE+(p.removesuffix("index.html") if p.endswith("index.html") else p)+"?editorial="+os.environ["GITHUB_SHA"][:12]
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req,timeout=35) as r:
        if r.status!=200 or r.read(3_000_001)!=b:raise RuntimeError("HTTP mismatch "+p)
        if p.endswith("index.html") and "noindex" in r.headers.get("X-Robots-Tag","").lower():raise RuntimeError("Index blocked "+p)
    print("HTTP VERIFIED",p,flush=True)
def main():
    offline()
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    ftp.connect("server172.hosting.reg.ru",21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p()
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
        if read(p)!=b:raise RuntimeError("FTP readback mismatch "+p)
    def mkdir(p):
        try:ftp.mkd(p)
        except ftplib.error_perm:
            before=ftp.pwd();ftp.cwd(p);ftp.cwd(before)
    originals={};targets={};changed=[]
    try:
        if read(root+"index.html") is None:raise RuntimeError("Webroot missing")
        for p in PATHS:
            b=read(root+p);originals[p]=b
            if p in ASSETS:
                if b not in (None,local(p)):raise RuntimeError("Asset conflict "+p)
                targets[p]=local(p)
            elif p==HUB:targets[p]=hub_target(b)
            else:
                if b not in (old(p),local(p)):raise RuntimeError("Article changed "+p)
                targets[p]=local(p)
        mkdir(home+"/site-safeguard-backups")
        backup=home+"/site-safeguard-backups/energy-editorial-"+str(time.time_ns());mkdir(backup)
        for p,b in originals.items():
            if b is not None:write(backup+"/"+hashlib.sha256(p.encode()).hexdigest()[:16]+".bak",b)
        try:
            for p in PATHS:
                if originals[p]==targets[p]:continue
                if read(root+p)!=originals[p]:raise RuntimeError("Concurrent live edit "+p)
                changed.append(p);write(root+p,targets[p])
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(lambda item:verify(*item),targets.items()))
            print("ENERGY EDITORIAL SUCCESS: 25 public files, article texts untouched",flush=True)
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
