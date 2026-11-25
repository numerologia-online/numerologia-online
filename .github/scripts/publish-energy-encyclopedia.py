"""Only public encyclopedia pages, navigation and sitemap. No paid services."""
import concurrent.futures, ftplib, io, json, os, pathlib, ssl, time, urllib.request, hashlib, html
from xml.etree import ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
PATHS=[f"guide/22-energii/energy-{n}/index.html" for n in range(1,23)]
HUB="guide/22-energii/index.html"
JOURNAL="guide/index.html"
SITE="sitemap.xml"
def local(p): return (ROOT/p).read_bytes()
def insert(original,source,start,end,anchor):
    if original is None: raise RuntimeError("Missing live navigation")
    a=original.decode("utf-8"); s=source.decode("utf-8")
    fragment=s[s.index(start):s.index(end,s.index(start))+len(end)]
    if start in a:
        if fragment not in a: raise RuntimeError("Different live encyclopedia navigation")
        return original
    if a.count(anchor)!=1: raise RuntimeError("Missing or ambiguous navigation anchor")
    return a.replace(anchor,fragment+anchor,1).encode("utf-8")
def sitemap(original):
    if original is None: raise RuntimeError("Missing sitemap")
    s=original.decode("utf-8"); ET.fromstring(s)
    if s.count("</urlset>")!=1: raise RuntimeError("Invalid sitemap")
    additions=[]
    for p in PATHS:
        u=BASE+p.removesuffix("index.html")
        if f"<loc>{u}</loc>" not in s: additions.append(f"  <url><loc>{u}</loc></url>\n")
    result=s.replace("</urlset>","".join(additions)+"</urlset>"); ET.fromstring(result)
    return result.encode("utf-8")
def verify(p,b):
    u=BASE+(p.removesuffix("index.html") if p.endswith("index.html") else p)+"?encyclopedia_verify="+os.environ.get("GITHUB_SHA","check")[:12]
    req=urllib.request.Request(u,headers={"Cache-Control":"no-cache","User-Agent":"Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)"})
    with urllib.request.urlopen(req,timeout=35) as r:
        if r.status!=200 or "noindex" in r.headers.get("X-Robots-Tag","").lower(): raise RuntimeError("HTTP not indexable: "+p)
        if r.read(3_000_001)!=b: raise RuntimeError("HTTP readback mismatch: "+p)
    print("HTTP VERIFIED",p,flush=True)
def main():
    count=0
    for n,p in enumerate(PATHS,1):
        a=json.loads((ROOT/f"knowledge/full-report/sections/energy-{n}.json").read_text("utf-8-sig"))
        page=local(p).decode("utf-8")
        assert a["id"]==n and len(a["sections"])==14 and BASE+p.removesuffix("index.html") in page
        for k,v in a["sections"].items():
            assert f'id="{k}"' in page
            for paragraph in v["paragraphs"]:
                escaped=html.escape(paragraph,quote=False).replace('"',"&quot;").replace("\r\n","<br>").replace("\n","<br>")
                assert escaped in page, (n,k)
                count+=1
    print(f"SOURCE VERIFIED: 22 articles, 308 sections, {count} source paragraphs",flush=True)
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    ftp.connect("server172.hosting.reg.ru",21);ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);ftp.prot_p()
    home=ftp.pwd().rstrip("/");root=home+"/www/xn--c1adkkdfjbp1a4l.online/"
    def read(p):
        out=io.BytesIO()
        try: ftp.retrbinary("RETR "+p,out.write)
        except ftplib.error_perm as e:
            if str(e).startswith("550"): return None
            raise
        return out.getvalue()
    def write(p,b):
        ftp.storbinary("STOR "+p,io.BytesIO(b))
        if read(p)!=b: raise RuntimeError("FTP readback mismatch: "+p)
    def mkdir(p):
        try: ftp.mkd(p)
        except ftplib.error_perm:
            before=ftp.pwd();ftp.cwd(p);ftp.cwd(before)
    originals={};targets={};changed=[]
    try:
        if read(root+"index.html") is None: raise RuntimeError("Webroot missing")
        for p in PATHS:
            originals[p]=read(root+p);targets[p]=local(p)
            if originals[p] not in (None,targets[p]): raise RuntimeError("Existing different article: "+p)
        for p in (HUB,JOURNAL,SITE): originals[p]=read(root+p)
        targets[HUB]=insert(originals[HUB],local(HUB),"<!-- ENERGY_ENCYCLOPEDIA_START -->","<!-- ENERGY_ENCYCLOPEDIA_END -->",'<article class="paper">')
        targets[JOURNAL]=insert(originals[JOURNAL],local(JOURNAL),"<!-- ENERGY_ENCYCLOPEDIA_LINK_START -->","<!-- ENERGY_ENCYCLOPEDIA_LINK_END -->",'<section class="featured" aria-labelledby="featured-title">')
        targets[SITE]=sitemap(originals[SITE])
        mkdir(home+"/site-safeguard-backups")
        backup=home+"/site-safeguard-backups/encyclopedia-"+str(time.time_ns());mkdir(backup)
        for p,b in originals.items():
            if b is not None: write(backup+"/"+hashlib.sha256(p.encode()).hexdigest()[:16]+".bak",b)
        write(backup+"/manifest.json",json.dumps({p:hashlib.sha256(b).hexdigest() if b is not None else None for p,b in originals.items()}).encode())
        try:
            for p,b in targets.items():
                if originals[p]==b: continue
                if read(root+p)!=originals[p]: raise RuntimeError("Concurrent live edit: "+p)
                if p in PATHS: mkdir(root+p.rsplit("/",1)[0])
                changed.append(p);write(root+p,b)
                print("FTP VERIFIED",p,flush=True)
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                list(pool.map(lambda item:verify(*item),targets.items()))
            print("ENCYCLOPEDIA SUCCESS: 22 articles; 308 sections; journal, hub and sitemap verified",flush=True)
        except BaseException:
            for p in reversed(changed):
                try:
                    if originals[p] is None: ftp.delete(root+p)
                    else: write(root+p,originals[p])
                    print("ROLLBACK OK",p,flush=True)
                except BaseException as e: print("ROLLBACK FAILED",p,str(e),flush=True)
            raise
    finally:
        try: ftp.quit()
        except BaseException: ftp.close()
if __name__=="__main__": main()
