"""Remove repetitive editorial disclaimers from public journal only."""
import concurrent.futures, ftplib, hashlib, html, io, json, os, pathlib, re, ssl, subprocess, time, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
# Exact editorial boilerplate, not the source readings or medical advice.
REPLACEMENTS={
"Это общие символические трактовки энергии в разных позициях матрицы. Они не описывают автоматически все стороны одного человека и не являются научно подтверждённым методом оценки личности, здоровья или будущего.":"Авторские трактовки энергии в разных позициях матрицы. При чтении учитывайте конкретную позицию в личном расчёте.",
"Это символическое описание общей энергии связи в матрице пары, а не научно подтверждённая оценка совместимости или предсказание поведения. Остальные позиции матрицы трактуются отдельно.":"Авторская трактовка общей энергии связи в матрице пары. Остальные позиции матрицы рассматриваются отдельно.",
"Она не является результатом расчёта центра пары, научной оценкой совместимости или предсказанием поведения.":"Она приводится для знакомства с системой, отдельно от расчёта центра пары.",
"Нумерология предлагает символическую трактовку, а не научно подтверждённый прогноз.":"",
"Нумерология является символической системой интерпретации, а не научным прогнозом событий. ":"",
"Это не личный прогноз и не научное объяснение событий.":"Для индивидуального прогноза учитывается личный период.",
"Это интересный образ для осмысления времени, но не научное объяснение происходящего.":"Через этот образ мы рассматриваем темы текущего периода.",
"Трактовка символическая, она не доказывает реальные поступки, чувства или намерения мужчины.":"Сопоставьте трактовку с реальными поступками мужчины.",
"Это краткая авторская символическая трактовка именно этой позиции, а не доказанный прогноз поведения или чувств.":"Перед вами краткая авторская трактовка именно этой позиции матрицы.",
}
# Catch other phrasing in plain-text editorial sentences, never in scripts or source readings.
SCIENCE=re.compile(r"(?i)(?:не\s+(?:явля(?:ется|ются)|счита(?:ется|ются))\s+научн\w*|(?:а|но)\s+не\s+научн\w*|не\s+научн\w*\s+(?:объяснен|прогноз|метод|оценк)|научно\s+не\s+подтвержд)")
def edit(b,p):
    s=b.decode("utf-8")
    # Only plain HTML text nodes: preserve attributes, navigation, and source data.
    def node(m):
        orig=m.group(1); t=orig
        for a,z in REPLACEMENTS.items():t=t.replace(a,z)
        return ">"+t+"<"
    out=re.sub(r">([^<>]+)<",node,s)
    out=re.sub(r'<(p|div) class="note">\s*</\1>',"",out)
    return out.encode("utf-8")
def git(*args):return subprocess.check_output(["git",*args],cwd=ROOT)
def verify(p,b):
    url=BASE+p.removesuffix("index.html")+"?editorial_cleanup="+os.environ["GITHUB_RUN_ID"]
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","User-Agent":"Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)"})
    with urllib.request.urlopen(req,timeout=45) as r:
        if r.status!=200 or r.read(4_000_001)!=b:raise RuntimeError("HTTP mismatch "+p)
        if "noindex" in r.headers.get("X-Robots-Tag","").lower():raise RuntimeError("Index blocked "+p)
    print("HTTP VERIFIED "+p,flush=True)
def main():
    paths=sorted(p.relative_to(ROOT).as_posix() for p in (ROOT/"guide").rglob("*.html") if p.is_file())
    assert len(paths)>=270
    originals={};targets={};remaining=[]
    for p in paths:
        b=(ROOT/p).read_bytes();a=edit(b,p)
        if a!=b:
            assert p.startswith("guide/") and p.endswith(".html")
            assert a.count(b"<h1")==b.count(b"<h1") and a.count(b'href=')==b.count(b'href=')
            originals[p]=b;targets[p]=a
        for m in re.finditer(r">([^<>]+)<",a.decode("utf-8")):
            if SCIENCE.search(html.unescape(m.group(1))):
                remaining.append((p,m.group(1)[:400]))
    print("SCANNED",len(paths),"CHANGED",len(targets),"REMAINING",len(remaining),flush=True)
    for p,s in remaining:print("REMAINING_EDITORIAL_PHRASE",p,s,flush=True)
    if remaining:raise RuntimeError("Unreviewed scientific disclaimer wording; no changes published")
    if not targets:raise RuntimeError("No matching boilerplate")
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
    live={};desired={};changed=[]
    try:
        for p,b in originals.items():
            l=read(root+p)
            # Apply the same surgical transformation to live text, preserving independent edits.
            t=edit(l,p)
            if t==l and l!=targets[p]:raise RuntimeError("Live article differs without matching disclaimer "+p)
            live[p]=l;desired[p]=t
        mkdir(home+"/site-safeguard-backups")
        backup=home+"/site-safeguard-backups/editorial-cleanup-"+str(time.time_ns());mkdir(backup)
        names={}
        for p,b in live.items():
            name=hashlib.sha256(p.encode()).hexdigest()[:20]+".bak";names[p]=name;write(backup+"/"+name,b)
        write(backup+"/manifest.json",json.dumps(names).encode())
        try:
            for p,b in desired.items():
                if b==live[p]:continue
                if read(root+p)!=live[p]:raise RuntimeError("Concurrent edit "+p)
                changed.append(p);write(root+p,b);print("FTP VERIFIED "+p,flush=True)
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(lambda item:verify(*item),desired.items()))
            # Synchronize only these public HTML source files, preserving concurrent unrelated commits.
            git("config","user.name","github-actions[bot]");git("config","user.email","41898282+github-actions[bot]@users.noreply.github.com")
            for p,b in targets.items():(ROOT/p).write_bytes(b)
            git("add","--",*targets)
            if set(git("diff","--cached","--name-only").decode().splitlines())!=set(targets):raise RuntimeError("Git scope changed")
            git("commit","-m","Remove repetitive scientific disclaimers from public journal")
            git("pull","--rebase","origin","main");git("push","origin","HEAD:main")
            print("EDITORIAL CLEANUP SUCCESS",len(targets),"public pages; no paid content, calculations, or medical advice changed",flush=True)
        except BaseException:
            for p in reversed(changed):
                try:write(root+p,live[p]);print("ROLLBACK OK "+p,flush=True)
                except BaseException as e:print("ROLLBACK FAILED",p,str(e),flush=True)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
if __name__=="__main__":main()
