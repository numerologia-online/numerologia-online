"""Publish only public Red Flag articles and journal navigation."""
import concurrent.futures, ftplib, hashlib, html, io, json, os, pathlib, re, ssl, time, urllib.request, xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
HUB="guide/muzhchina-red-flag/voprosy/"
ROWS=sum([json.loads((ROOT/HUB/f"manifest-{x}.json").read_text("utf-8")) for x in ("a","b")],[])
PAGES=[x["url"].lstrip("/")+"index.html" for x in ROWS]+[HUB+"index.html"]
NAV=["guide/index.html","guide/muzhchina-red-flag/index.html"]
SITE="sitemap.xml"
START="<!-- RF_ARTICLES_START -->";END="<!-- RF_ARTICLES_END -->"
def local(p):return (ROOT/p).read_bytes()
def canonical(p):return BASE+p.removesuffix("index.html")
def offline():
    source=local("redflag-public-catalog.js").decode("utf-8")
    catalog=json.loads(re.search(r"export const PUBLIC_QUESTIONS = ([\s\S]*?);\s*(?:export|$)",source).group(1))
    expected={(k,q["id"]) for k,qs in catalog.items() for q in qs if q["status"]=="ready"}
    private=json.loads(local("account-service/private/redflag-catalog.json"))["questions"]
    assert len(ROWS)==81 and len(set(PAGES))==82
    assert {(x["cat"],x["id"]) for x in ROWS}==expected
    assert all(private[x["cat"]][x["id"]]["ready"] for x in ROWS)
    titles=set();bodies=set()
    hub=local(HUB+"index.html").decode("utf-8")
    for row,p in zip(ROWS,PAGES):
        a=local(p).decode("utf-8")
        assert 'content="index,follow"' in a and f'href="{canonical(p)}"' in a and a.count("<h1>")==1,p
        assert f'href="/?view=redflag&amp;question={row["cat"]}:{row["id"]}"' in a,p
        assert f'href="{row["url"]}"' in hub,p
        assert 'href="/author.html" rel="author"' in a,p
        h=re.search(r"<h1>(.*?)</h1>",a).group(1)
        body=re.search(r'<p class="sub">Авторская нумерологическая методика.*?</p><p>(.*?)</p>',a,re.S).group(1)
        assert h not in titles and body not in bodies and len(body)>100,p
        titles.add(h);bodies.add(body)
        assert "—" not in body,p
    root=ET.fromstring(local(SITE));locs=[x.text for x in root.iter() if x.tag.endswith("}loc") or x.tag=="loc"]
    assert all(locs.count(canonical(p))==1 for p in PAGES)
    print("OFFLINE OK: 81 unique editorial articles, exact ready-question coverage, direct links and 82 sitemap URLs",flush=True)
def patch_nav(p,original):
    a=original.decode("utf-8");s=local(p).decode("utf-8")
    assert s.count(START)==s.count(END)==1
    frag=s[s.index(START):s.index(END)+len(END)]
    if START in a:
        if frag not in a:raise RuntimeError("Different article navigation "+p)
        return original
    anchor='<section class="featured" aria-labelledby="featured-title">' if p==NAV[0] else '<article class="paper">'
    if a.count(anchor)!=1:raise RuntimeError("Ambiguous navigation "+p)
    return a.replace(anchor,frag+anchor if p==NAV[0] else anchor+frag,1).encode("utf-8")
def patch_sitemap(original):
    s=original.decode("utf-8");ET.fromstring(s)
    if s.count("</urlset>")!=1:raise RuntimeError("Invalid sitemap")
    add=[]
    for p in PAGES:
        u=canonical(p)
        if f"<loc>{u}</loc>" not in s:add.append(f"  <url><loc>{u}</loc></url>\n")
    b=s.replace("</urlset>","".join(add)+"</urlset>");ET.fromstring(b)
    return b.encode("utf-8")
def verify(p,b):
    url=BASE+p.removesuffix("index.html")+"?rf_articles="+os.environ.get("GITHUB_SHA","check")[:12]
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
            if not read(root+asset):raise RuntimeError("Design asset missing "+asset)
        for p in PAGES:
            originals[p]=read(root+p);targets[p]=local(p)
            if originals[p] not in (None,targets[p]):raise RuntimeError("Existing different page "+p)
        for p in NAV+[SITE]:
            originals[p]=read(root+p)
            if originals[p] is None:raise RuntimeError("Missing navigation "+p)
        for p in NAV:targets[p]=patch_nav(p,originals[p])
        targets[SITE]=patch_sitemap(originals[SITE])
        mkdir(home+"/site-safeguard-backups")
        backup=home+"/site-safeguard-backups/rf-articles-"+str(time.time_ns());mkdir(backup)
        names={}
        for p,b in originals.items():
            if b is not None:
                name=hashlib.sha256(p.encode()).hexdigest()[:16]+".bak";names[p]=name;write(backup+"/"+name,b)
        write(backup+"/manifest.json",json.dumps(names).encode())
        try:
            mkdir(root+HUB.rstrip("/"))
            for cat in sorted({x["cat"] for x in ROWS}):mkdir(root+HUB+cat)
            for p,b in targets.items():
                if originals[p]==b:continue
                if read(root+p)!=originals[p]:raise RuntimeError("Concurrent edit "+p)
                if p in PAGES:mkdir(root+p.rsplit("/",1)[0])
                changed.append(p);write(root+p,b)
                print("FTP VERIFIED",p,flush=True)
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(lambda item:verify(*item),targets.items()))
            print("RED FLAG ARTICLES SUCCESS: 81 articles, index, navigation and sitemap verified",flush=True)
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
