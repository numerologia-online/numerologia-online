"""Publish public time-cycle editorial articles only."""
import concurrent.futures, ftplib, hashlib, io, json, os, pathlib, ssl, time, urllib.request, xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
HUB="guide/numerologiya-vremeni/"
SLUGS=["pochemu-2026-takoy-slozhnyy","gonka-ii-v-god-edinicy","razvody-i-otnosheniya-2026","dekabr-2026","perehod-iz-2026-v-2027","yanvar-2027"]
PAGES=[HUB+s+"/index.html" for s in SLUGS]+[HUB+"index.html"]
NAV="guide/index.html";SITE="sitemap.xml"
START="<!-- TIME_EDITORIAL_START -->";END="<!-- TIME_EDITORIAL_END -->"
def local(p):return (ROOT/p).read_bytes()
def canonical(p):return BASE+p.removesuffix("index.html")
def offline():
    h=local(HUB+"index.html").decode("utf-8")
    assert h.count('class="energy-card"')==6
    for p in PAGES:
        s=local(p).decode("utf-8")
        assert s.count("<h1>")==1 and 'content="index,follow"' in s and f'href="{canonical(p)}"' in s,p
        if p!=HUB+"index.html":
            assert f'href="/{p.removesuffix("index.html")}"' in h and s.count("<h2>")>=5,p
    x=ET.fromstring(local(SITE));locs=[n.text for n in x.iter() if n.tag.endswith("}loc") or n.tag=="loc"]
    assert all(locs.count(canonical(p))==1 for p in PAGES)
    print("OFFLINE OK: six time articles, catalogue and sitemap",flush=True)
def patch_nav(b):
    if b is None:raise RuntimeError("Missing journal")
    s=b.decode("utf-8");new=local(NAV).decode("utf-8")
    frag=new[new.index(START):new.index(END)+len(END)]
    if START in s:
        if frag not in s:raise RuntimeError("Different time navigation")
        return b
    anchor='<section class="featured" aria-labelledby="featured-title">'
    if s.count(anchor)!=1:raise RuntimeError("Missing unique journal anchor")
    return s.replace(anchor,frag+anchor,1).encode("utf-8")
def patch_sitemap(b):
    if b is None:raise RuntimeError("Missing sitemap")
    s=b.decode("utf-8");ET.fromstring(s)
    if s.count("</urlset>")!=1:raise RuntimeError("Invalid sitemap")
    add="".join(f"  <url><loc>{canonical(p)}</loc></url>\n" for p in PAGES if f"<loc>{canonical(p)}</loc>" not in s)
    s=s.replace("</urlset>",add+"</urlset>");ET.fromstring(s);return s.encode("utf-8")
def verify(p,b):
    url=BASE+p.removesuffix("index.html")+"?time_editorial="+os.environ.get("GITHUB_SHA","check")[:12]
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
        if not read(root+"index.html"):raise RuntimeError("Webroot missing")
        for asset in ("guide/22-energii/editorial.css","guide/22-energii/symbols.svg"):
            if not read(root+asset):raise RuntimeError("Shared design asset missing")
        for p in PAGES:
            originals[p]=read(root+p);targets[p]=local(p)
            if originals[p] not in (None,targets[p]):raise RuntimeError("Existing different page "+p)
        originals[NAV]=read(root+NAV);targets[NAV]=patch_nav(originals[NAV])
        originals[SITE]=read(root+SITE);targets[SITE]=patch_sitemap(originals[SITE])
        mkdir(home+"/site-safeguard-backups")
        backup=home+"/site-safeguard-backups/time-editorial-"+str(time.time_ns());mkdir(backup)
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
            print("TIME EDITORIAL SUCCESS: six articles, catalogue, journal and sitemap",flush=True)
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
