"""Publish public forecast encyclopedia only; never modify annual reading or source banks."""
import concurrent.futures, ftplib, hashlib, html, io, os, pathlib, re, ssl, subprocess, time, urllib.request, xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
OLD="d61591a3143ea9a05403f96382efbfd8fc2e2799"
HUB="guide/enciklopediya-prognozov/"
YEARS=[HUB+f"year-{y}/index.html" for y in range(1,10)]
MONTHS=[HUB+f"month-{m}/index.html" for m in range(1,10)]
LINKS=[HUB+f"year-{y}-month-{m}/index.html" for y in range(1,10) for m in range(1,10)]
PAGES=YEARS+MONTHS+LINKS+[HUB+"index.html"]
NAV=["guide/index.html","guide/lichnyi-god-po-date-rozhdeniya/index.html","guide/lichnyi-mesyac/index.html","guide/razbor-goda/index.html"]
SITE="sitemap.xml"
START="<!-- FORECAST_ENCYCLOPEDIA_START -->";END="<!-- FORECAST_ENCYCLOPEDIA_END -->"
def local(p):return (ROOT/p).read_bytes()
def old(p):return subprocess.check_output(["git","show",OLD+":"+p],cwd=ROOT)
def canonical(p):return BASE+p.removesuffix("index.html")
def reduce(n):
    while n>9:n=sum(map(int,str(n)))
    return n or 9
def normalize(s):return " ".join(s.replace("\u2014","-").replace("\u2013","-").split())
def textpart(s,cls):
    m=re.search(r'<div class="'+cls+r'">(.*?)</div>',s,re.S)
    assert m,cls
    return normalize(html.unescape(re.sub(r"<[^>]+>"," ",m.group(1))))
def parse(text):
    result={};section=None;field=None
    for line in text.splitlines():
        if line.startswith("## "):
            section=line[3:].strip();result[section]={};field=None
        elif line.startswith("### "):
            field=line[4:].strip();result[section][field]=""
        elif section and field:result[section][field]+=line+"\n"
    return result
def offline():
    assert len(PAGES)==100 and len(set(PAGES))==100
    h=local(HUB+"index.html").decode("utf-8")
    for p in PAGES:
        s=local(p).decode("utf-8")
        assert s.count("<h1>")==1 and 'content="index,follow"' in s and f'href="{canonical(p)}"' in s,p
        assert 'editorial.css' in s,p
        if p!=HUB+"index.html":assert f'href="/{p.removesuffix("index.html")}"' in h,p
    for y in range(1,10):
        bank=parse(local(f"data/year/energy-{y}.txt").decode("utf-8-sig"))
        s=local(YEARS[y-1]).decode("utf-8")
        assert textpart(s,"year-source")==normalize(bank["Год"]["Описание"]),y
        for m in range(1,10):
            p=HUB+f"year-{y}-month-{m}/index.html";s=local(p).decode("utf-8")
            a=bank[f"Связка {y}-{m}"]
            for cls,key in [("link-source","Основной текст"),("link-danger","Опасность"),("link-action","Что очень важно сделать")]:
                assert textpart(s,cls)==normalize(a[key]),(p,key)
            ex=re.search(r'дата рождения (\d+)\.01\.1990\. С дня рождения в 2027 году: (\d+) \+ 1 \+ 2 \+ 0 \+ 2 \+ 7 = (\d+), личный год (\d+).*?: (\d+) \+ (\d+) = (\d+), личный месяц (\d+)',s)
            assert ex,p
            d,d2,total,yr,yr2,c,total2,mon=map(int,ex.groups())
            assert d==d2 and total==d+12 and reduce(total)==yr==yr2==y and 1<=c<=12 and total2==y+c and reduce(total2)==mon==m,p
    for m,p in enumerate(MONTHS,1):
        s=local(p).decode("utf-8")
        assert all(f'href="/{HUB}year-{y}-month-{m}/"' in s for y in range(1,10)),p
        ex=re.search(r'после дня рождения: 4 \+ (\d+) = (\d+), личный месяц (\d+)',s)
        assert ex and int(ex[2])==4+int(ex[1]) and reduce(int(ex[2]))==int(ex[3])==m,p
    root=ET.fromstring(local(SITE));locs=[x.text for x in root.iter() if x.tag.endswith("}loc") or x.tag=="loc"]
    assert all(locs.count(canonical(p))==1 for p in PAGES)
    print("OFFLINE OK: 99 public articles, 81 actual source excerpts, 90 monthly examples, complete catalogue and sitemap",flush=True)
def patch_nav(p,b):
    if b is None:raise RuntimeError("Missing live navigation "+p)
    a=b.decode("utf-8");s=local(p).decode("utf-8")
    assert s.count(START)==s.count(END)==1
    frag=s[s.index(START):s.index(END)+len(END)]
    if START in a:
        if frag not in a:raise RuntimeError("Different encyclopedia navigation "+p)
        return b
    if p==NAV[0]:
        anchor='<section class="featured" aria-labelledby="featured-title">'
        if a.count(anchor)!=1:raise RuntimeError("Ambiguous journal")
        return a.replace(anchor,frag+anchor,1).encode()
    match=re.search(r"<article\b[^>]*>",a)
    if not match:raise RuntimeError("Missing article "+p)
    return (a[:match.end()]+frag+a[match.end():]).encode()
def patch_sitemap(b):
    if b is None:raise RuntimeError("Missing sitemap")
    s=b.decode("utf-8");ET.fromstring(s)
    if s.count("</urlset>")!=1:raise RuntimeError("Invalid sitemap")
    add=[f"  <url><loc>{canonical(p)}</loc></url>\n" for p in PAGES if f"<loc>{canonical(p)}</loc>" not in s]
    result=s.replace("</urlset>","".join(add)+"</urlset>");ET.fromstring(result)
    return result.encode()
def verify(p,b):
    url=BASE+p.removesuffix("index.html")+"?forecast="+os.environ.get("GITHUB_SHA","check")[:12]
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","User-Agent":"Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)"})
    with urllib.request.urlopen(req,timeout=45) as r:
        if r.status!=200 or r.read(3_000_001)!=b:raise RuntimeError("HTTP mismatch "+p)
        if p.endswith("index.html") and "noindex" in r.headers.get("X-Robots-Tag","").lower():raise RuntimeError("Index blocked "+p)
    print("HTTP VERIFIED",p,flush=True)
def connect():
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    f.connect("server172.hosting.reg.ru",21);f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"]);f.prot_p()
    return f
def read(f,p):
    out=io.BytesIO()
    try:f.retrbinary("RETR "+p,out.write)
    except ftplib.error_perm as e:
        if str(e).startswith("550"):return None
        raise
    return out.getvalue()
def write(f,p,b):
    f.storbinary("STOR "+p,io.BytesIO(b))
    if read(f,p)!=b:raise RuntimeError("FTP readback mismatch "+p)
def mkdir(f,p):
    try:f.mkd(p)
    except ftplib.error_perm:
        before=f.pwd();f.cwd(p);f.cwd(before)
def close(f):
    try:f.quit()
    except BaseException:f.close()
def main():
    offline()
    ftp=connect();home=ftp.pwd().rstrip("/");root=home+"/www/xn--c1adkkdfjbp1a4l.online/"
    originals={};targets={};changed=[]
    try:
        if not read(ftp,root+"index.html"):raise RuntimeError("Webroot missing")
        if not read(ftp,root+"guide/22-energii/editorial.css"):raise RuntimeError("Shared design asset missing")
        # New pages are checked using three independent FTP sessions.
        def preflight(chunk):
            f=connect()
            try:
                result={}
                for p in chunk:
                    b=read(f,root+p)
                    if b not in (None,local(p)):raise RuntimeError("Different existing page "+p)
                    result[p]=b
                return result
            finally:close(f)
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            for r in pool.map(preflight,[PAGES[i::3] for i in range(3)]):originals.update(r)
        targets.update({p:local(p) for p in PAGES})
        for p in NAV+[SITE]:originals[p]=read(ftp,root+p)
        for p in NAV:targets[p]=patch_nav(p,originals[p])
        targets[SITE]=patch_sitemap(originals[SITE])
        mkdir(ftp,home+"/site-safeguard-backups")
        backup=home+"/site-safeguard-backups/forecast-encyclopedia-"+str(time.time_ns());mkdir(ftp,backup)
        names={}
        for p,b in originals.items():
            if b is not None:
                name=hashlib.sha256(p.encode()).hexdigest()[:16]+".bak";names[p]=name;write(ftp,backup+"/"+name,b)
        import json
        write(ftp,backup+"/manifest.json",json.dumps(names).encode())
        try:
            mkdir(ftp,root+HUB.rstrip("/"))
            def upload(chunk):
                f=connect()
                try:
                    for p in chunk:
                        b=targets[p]
                        if originals[p]==b:continue
                        if read(f,root+p)!=originals[p]:raise RuntimeError("Concurrent edit "+p)
                        mkdir(f,root+p.rsplit("/",1)[0])
                        changed.append(p);write(f,root+p,b)
                        print("FTP VERIFIED",p,flush=True)
                finally:close(f)
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(upload,[PAGES[i::3] for i in range(3)]))
            # Publish discovery links only after the pages exist.
            for p in NAV+[SITE]:
                if originals[p]==targets[p]:continue
                if read(ftp,root+p)!=originals[p]:raise RuntimeError("Concurrent edit "+p)
                changed.append(p);write(ftp,root+p,targets[p])
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(lambda item:verify(*item),targets.items()))
            print("FORECAST ENCYCLOPEDIA SUCCESS: 99 articles and catalogue verified",flush=True)
        except BaseException:
            for p in reversed(changed):
                try:
                    if originals[p] is None:ftp.delete(root+p)
                    else:write(ftp,root+p,originals[p])
                    print("ROLLBACK OK",p,flush=True)
                except BaseException as e:print("ROLLBACK FAILED",p,str(e),flush=True)
            raise
    finally:close(ftp)
if __name__=="__main__":main()
