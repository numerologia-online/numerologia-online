"""Publish only the public compatibility encyclopedia and its navigation."""
import concurrent.futures, ftplib, hashlib, html, io, json, os, pathlib, re, ssl, time, urllib.request, xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
HUB="guide/enciklopediya-sovmestimosti/"
TOPICS=json.loads((ROOT/HUB/"topics.json").read_text("utf-8"))
ENERGY=[HUB+f"energy-{n}/index.html" for n in range(1,23)]
TOPIC=[HUB+t["slug"]+"/index.html" for t in TOPICS]
PAGES=ENERGY+TOPIC+[HUB+"index.html"]
NAV=["guide/index.html","guide/sovmestimost-po-date/index.html","guide/matrica-sovmestimosti/index.html"]
SITE="sitemap.xml"
START="<!-- PAIR_ENCYCLOPEDIA_LINK_START -->";END="<!-- PAIR_ENCYCLOPEDIA_LINK_END -->"
def local(p): return (ROOT/p).read_bytes()
def canonical(p): return BASE+p.removesuffix("index.html")
def tokens(s):return re.findall(r"\w+",s)
def offline():
    assert len(ENERGY)==22 and len(TOPIC)==12 and len(set(PAGES))==35
    h=local(HUB+"index.html").decode("utf-8")
    assert h.count('class="energy-card"')==34
    for p in PAGES:
        a=local(p).decode("utf-8")
        assert 'content="index,follow"' in a and f'href="{canonical(p)}"' in a and a.count("<h1>")==1,p
        assert 'editorial.css' in a
        if p!=HUB+"index.html":assert f'href="/{p.removesuffix("index.html")}"' in h,p
    for n,p in enumerate(ENERGY,1):
        src=json.loads((ROOT/f"data/compatibility/deep/energy-{n}.json").read_text("utf-8-sig"))
        assert src["energy"]==n and set(src["blocks"])=={"pairEssence"},n
        b=src["blocks"]["pairEssence"]
        a=local(p).decode("utf-8")
        assert html.escape(b["lead"],quote=False) in a or html.escape(b["lead"],quote=False).replace('"',"&quot;") in a,n
        m=re.search(r'<div class="source-reading">(.*?)</div>',a,re.S)
        assert m,n
        copy=html.unescape(re.sub(r"<[^>]+>"," ",m.group(1)))
        assert tokens(copy)==tokens(b["text"]),("source words differ",n)
    for p in TOPIC:
        assert local(p).count(b"<h2>")==6,p
    root=ET.fromstring(local(SITE)); locs=[x.text for x in root.iter() if x.tag.endswith("}loc") or x.tag=="loc"]
    assert all(locs.count(canonical(p))==1 for p in PAGES)
    print("OFFLINE OK: 22 complete public source texts, 12 original topic articles, 34 links, 35 unique sitemap entries",flush=True)
def patch_nav(p,original):
    if original is None:raise RuntimeError("Missing live navigation "+p)
    a=original.decode("utf-8");s=local(p).decode("utf-8")
    assert s.count(START)==s.count(END)==1
    frag=s[s.index(START):s.index(END)+len(END)]
    if START in a:
        if frag not in a:raise RuntimeError("Different encyclopedia navigation "+p)
        return original
    anchor='<section class="featured" aria-labelledby="featured-title">' if p==NAV[0] else '<article class="paper">'
    if a.count(anchor)!=1:raise RuntimeError("Ambiguous navigation "+p)
    return a.replace(anchor,frag+anchor if p==NAV[0] else anchor+frag,1).encode("utf-8")
def patch_sitemap(original):
    if original is None:raise RuntimeError("Missing sitemap")
    s=original.decode("utf-8");ET.fromstring(s)
    if s.count("</urlset>")!=1:raise RuntimeError("Invalid sitemap")
    add=[]
    for p in PAGES:
        u=canonical(p)
        if f"<loc>{u}</loc>" not in s:add.append(f"  <url><loc>{u}</loc></url>\n")
    b=s.replace("</urlset>","".join(add)+"</urlset>");ET.fromstring(b)
    return b.encode("utf-8")
def verify(p,b):
    url=BASE+p.removesuffix("index.html")+"?pair_encyclopedia="+os.environ.get("GITHUB_SHA","check")[:12]
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","User-Agent":"Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)"})
    with urllib.request.urlopen(req,timeout=40) as r:
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
        for asset in ("guide/22-energii/editorial.css","guide/22-energii/symbols.svg"):
            if not read(root+asset):raise RuntimeError("Shared design asset missing "+asset)
        for p in PAGES:
            originals[p]=read(root+p);targets[p]=local(p)
            if originals[p] not in (None,targets[p]):raise RuntimeError("Existing different page "+p)
        for p in NAV+[SITE]:originals[p]=read(root+p)
        for p in NAV:targets[p]=patch_nav(p,originals[p])
        targets[SITE]=patch_sitemap(originals[SITE])
        mkdir(home+"/site-safeguard-backups")
        backup=home+"/site-safeguard-backups/pair-encyclopedia-"+str(time.time_ns());mkdir(backup)
        names={}
        for p,b in originals.items():
            if b is not None:
                name=hashlib.sha256(p.encode()).hexdigest()[:16]+".bak";names[p]=name;write(backup+"/"+name,b)
        write(backup+"/manifest.json",json.dumps(names).encode())
        try:
            mkdir(root+HUB.rstrip("/"))
            for p,b in targets.items():
                if originals[p]==b:continue
                if read(root+p)!=originals[p]:raise RuntimeError("Concurrent edit "+p)
                if p in PAGES:mkdir(root+p.rsplit("/",1)[0])
                changed.append(p);write(root+p,b)
                print("FTP VERIFIED",p,flush=True)
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(lambda item:verify(*item),targets.items()))
            print("PAIR ENCYCLOPEDIA SUCCESS: 34 articles, catalogue, navigation and sitemap verified",flush=True)
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
