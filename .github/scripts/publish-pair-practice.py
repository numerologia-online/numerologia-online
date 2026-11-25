"""Deploy manual compatibility articles, never the paid calculation or source banks."""
import concurrent.futures, ftplib, hashlib, io, json, os, pathlib, re, ssl, subprocess, tempfile, time, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
OLD="8641cf871aebc8945285d9ef78ae449010e165fe"
HUB="guide/enciklopediya-sovmestimosti/"
TOPICS=[
("zachem-vy-vstretilis","meetingMeaning",16,2),
("pochemu-tyanet","attraction",6,3),
("emocii-v-pare","emotions",18,3),
("byt-i-sovmestimost","realLife",20,3),
("strast-i-blizost","sex",8,3),
("dengi-v-pare","money",22,3),
("iz-za-chego-ssory","conflict",8,3),
("uroki-otnosheniy","lesson",8,3),
("emocionalnye-kacheli","swings",12,3),
("budushchee-otnosheniy","future",17,3),
("kak-vyvesti-v-plyus","actions",22,3),
("stoit-li-prodolzhat","honestFinal",22,3)]
PATHS=[HUB+s+"/index.html" for s,_,_,_ in TOPICS]+[HUB+"energy-1/index.html",HUB+"energy-2/index.html",HUB+"index.html"]
def local(p):return (ROOT/p).read_bytes()
def old(p):return subprocess.check_output(["git","show",OLD+":"+p],cwd=ROOT)
def offline():
    with tempfile.TemporaryDirectory() as td:
        d=pathlib.Path(td)
        (d/"core.mjs").write_bytes(local("numerology-core.js"))
        engine=local("compatibility-engine.js").decode("utf-8").replace("./numerology-core.js?v=1","./core.mjs")
        (d/"engine.mjs").write_text(engine,encoding="utf-8")
        (d/"test.mjs").write_text('import {calculateCompatibility} from "./engine.mjs"; console.log(JSON.stringify(calculateCompatibility({day:14,month:5,year:1990},{day:8,month:11,year:1988})));',encoding="utf-8")
        actual={x["key"]:x["energy"] for x in json.loads(subprocess.check_output(["node",str(d/"test.mjs")],cwd=d))}
    count=0
    for slug,key,result,minimum in TOPICS:
        p=HUB+slug+"/index.html";s=local(p).decode("utf-8")
        assert actual[key]==result,(key,actual[key],result)
        assert s.count("PAIR_PRACTICE_START")==s.count("PAIR_PRACTICE_END")==1,p
        assert f"В примере результат: {result}," in s,p
        assert re.findall(r'id="result-(\d+)"',s)==[str(i) for i in range(minimum,23)],p
        assert re.findall(r'href="#result-(\d+)"',s)==[str(i) for i in range(minimum,23)],p
        assert s.count("<h1>")==1 and 'content="index,follow"' in s,p
        assert f'href="{BASE}{p.removesuffix("index.html")}"' in s,p
        old_body=old(p).decode("utf-8").split('<article class="paper">',1)[1]
        new_body=s.split('<article class="paper">',1)[1]
        restored=re.sub(r'<!-- PAIR_PRACTICE_START -->.*?<!-- PAIR_PRACTICE_END -->',"",new_body,flags=re.S)
        assert restored==old_body,p
        count+=23-minimum
        print("FORMULA MATCH",key,result,flush=True)
    assert count==241
    assert "12 практических статей" in local(HUB+"index.html").decode("utf-8")
    print("OFFLINE OK 12 actual-engine formula examples, 241 reachable interpretations, original article bodies retained",flush=True)
def verify(p,b):
    url=BASE+p.removesuffix("index.html")+"?practice="+os.environ.get("GITHUB_SHA","check")[:12]
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","User-Agent":"Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)"})
    with urllib.request.urlopen(req,timeout=40) as r:
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
        backup=home+"/site-safeguard-backups/pair-practice-"+str(time.time_ns());mkdir(backup)
        names={}
        for p,b in originals.items():
            name=hashlib.sha256(p.encode()).hexdigest()[:16]+".bak";names[p]=name;write(backup+"/"+name,b)
        write(backup+"/manifest.json",json.dumps(names).encode())
        try:
            for p in PATHS:
                if originals[p]==targets[p]:continue
                if read(root+p)!=originals[p]:raise RuntimeError("Concurrent edit "+p)
                changed.append(p);write(root+p,targets[p])
                print("FTP VERIFIED",p,flush=True)
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(lambda item:verify(*item),targets.items()))
            print("PAIR PRACTICE SUCCESS: 12 articles, catalogue and two explanatory notes, all HTTP verified",flush=True)
        except BaseException:
            for p in reversed(changed):
                try:write(root+p,originals[p]);print("ROLLBACK OK",p,flush=True)
                except BaseException as e:print("ROLLBACK FAILED",p,str(e),flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":main()
