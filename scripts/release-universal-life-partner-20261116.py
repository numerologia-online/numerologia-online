#!/usr/bin/env python3
"""Surgical neutral-language updates in the 'partner' sections of full-life report.
Does not modify calculations, other report sections, layout or pricing.
Run in GitHub Actions: prepare | deploy.
"""
import copy, ftplib, hashlib, io, json, os, pathlib, re, ssl, subprocess, sys, time

REPO_PATHS=[f"knowledge/full-report/sections/energy-{n}.json" for n in range(1,23)]
MANIFEST="account-service/private/store-assets.json"
CHANGED=[]
BEFORE={}

# Only literal, context-reviewed phrasing. All rules act inside 'partner' paragraphs/content.
CUSTOM={
1:[("быть равной:", "быть на равных:"),("режим “я всё сама”","режим “всё держится на мне”")],
2:[("быть глубокой, нежной, внимательной","быть глубоким, нежным, внимательным")],
3:[("ваша женская сила","ваша внутренняя сила"),
   ("сценарий “я всё сама”","сценарий “всё держится на мне”"),
   ("не женщиной в отношениях, а человеком, который","не равным партнёром, а человеком, который")],
4:[("в режиме спасателя и руководителя, а не женщины в отношениях",
     "в режиме спасателя и руководителя, а не равного партнёра")],
5:[("вы рядом с ним женщина и партнер или экзаменатор, воспитатель, мама, наставник?",
     "вы рядом с ним равный партнер или экзаменатор, воспитатель и наставник?")],
6:[("вашу женственность, красоту, желания и границы","вашу индивидуальность, красоту, желания и границы"),
   ("с бывшими, поклонницами, работой","с бывшими партнерами, поклонниками, работой"),
   ("Выбранной или ожидающей?","Чувствуете себя выбранным или продолжаете ждать?")],
8:[("слабый финансово мужчина","финансово несамостоятельный человек"),
   ("виноватой за желание","виноватым за желание"),
   ("делает вас зависимой","делает вас зависимым"),
   ("в женщину, которая все время оценивает","в человека, который все время оценивает"),
   ("Смотрите на финансовую взрослость мужчины","Смотрите на финансовую взрослость партнёра"),
   ("Мужчина рядом должен","Партнёр рядом должен"),
   ("богатого мужчины","состоятельного человека")],
9:[("чувствуете себя одной","чувствуете одиночество"),
   ("женскую раскрытость","желание открываться"),
   ("простую женщину","простого человека"),
   ("глубину мужчины","глубину партнёра")],
11:[("вы и женщина, и мужчина, и вся семья на вас","все семейные обязанности держатся только на вас"),
    ("вы остаетесь сильной женщиной, а не конем семьи",
     "вы остаетесь сильным человеком, а не рабочей лошадью семьи"),
    ("ревнивую сторожевую башню","ревнивого надзирателя"),
    ("маму, спасателя","воспитателя, спасателя")],
13:[("женскую энергию","внутреннюю энергию"),
    ("становиться резкой, уставшей, холодной, закрытой",
     "становиться резким, уставшим, холодным, закрытым")],
17:[("который не боится яркой женщины","который не боится вашей яркости"),
    ("опасны мужчины, которые","опасны люди, которые"),
    ("Ты была такая особенная","Ты был таким особенным")],
18:[("мужчины, которые дают надежду","люди, которые дают надежду")],
19:[("делает вас зависимой от похвалы","делает вас зависимым от похвалы")],
22:[("ты что, ненормальная?","что с тобой не так?")]
}

WORD_FORMS={
 "мужчина":"человек","мужчину":"человека","мужчины":"человека",
 "мужчине":"человеку","мужчиной":"человеком","мужчин":"людей",
 "женщина":"человек","женщину":"человека","женщиной":"человеком",
 "женщины":"человека","женщине":"человеку","женщин":"людей",
 "мужчина-фасад":"человек-фасад",
 "мужчинам-разрушителям":"людям-разрушителям",
}
GENDER_RE=re.compile(r"(?<![А-Яа-яЁё])("+ "|".join(re.escape(w) for w in sorted(WORD_FORMS,key=len,reverse=True)) +r")(?![А-Яа-яЁё])",re.I)
RESIDUAL=re.compile(r"мужчин|женщин|женственност|женск[а-яё]*|мужск[а-яё]*|девушк",re.I)
JSON_STRING=re.compile(r'"(?:\\.|[^"\\])*"',re.S)
BANK_RE=re.compile(r'^knowledge/full-report/sections/energy-(\d+)\.json$')

def sha(data): return hashlib.sha256(data).hexdigest()
def repo_old(path):return subprocess.check_output(["git","show","HEAD:"+path])

def normalize(n,s):
    for old,new in CUSTOM.get(n,[]):
        if old in s:s=s.replace(old,new)
    def word(m):
        old=m.group(0)
        value=WORD_FORMS[old.lower()]
        return value[0].upper()+value[1:] if old[0].isupper() else value
    s=GENDER_RE.sub(word,s)
    return s

def edit_bank(path,before):
    n=int(BANK_RE.fullmatch(path).group(1))
    source=json.loads(before.decode("utf-8-sig"))
    p=source["sections"]["partner"]
    strings=[p.get("content")]+p.get("paragraphs",[])
    original_values={x for x in strings if isinstance(x,str)}
    # A textual token transformation preserves all whitespace, JSON key order,
    # BOM and ALL unrelated sections and formatting.
    data=before.decode("utf-8")
    occurrences=0
    def transform(m):
        nonlocal occurrences
        literal=m.group(0)
        value=json.loads(literal)
        if value not in original_values:return literal
        updated=normalize(n,value)
        if updated==value:return literal
        occurrences+=1
        return json.dumps(updated,ensure_ascii=False)
    output=JSON_STRING.sub(transform,data).encode("utf-8")
    target=json.loads(output.decode("utf-8-sig"))
    expected=copy.deepcopy(source)
    expected_p=expected["sections"]["partner"]
    if isinstance(p.get("content"),str):expected_p["content"]=normalize(n,p["content"])
    if isinstance(p.get("paragraphs"),list):expected_p["paragraphs"]=[normalize(n,x) for x in p["paragraphs"]]
    if target!=expected:raise RuntimeError("UNEXPECTED_NON_PARTNER_CHANGE "+path)
    if RESIDUAL.search(str(expected_p.get("content",""))+"\n".join(expected_p.get("paragraphs",[]))):
        raise RuntimeError("GENDERED_PARTNER_WORD_REMAINS "+path)
    if p.get("content") and p["content"]=="\n\n".join(p.get("paragraphs",[])):
        if expected_p["content"]!="\n\n".join(expected_p["paragraphs"]):raise RuntimeError("PDF_PARAGRAPHS_DESYNC "+path)
    if output!=before and not occurrences:raise RuntimeError("NO_VALUE_REPLACED "+path)
    return output

def prepare():
    old_manifest=repo_old(MANIFEST)
    manifest=json.loads(old_manifest)
    assert manifest["version"]==2
    # Use a textual hash replacement to avoid touching unrelated private products.
    output_manifest=old_manifest.decode("utf-8")
    edits=0
    for path in REPO_PATHS:
        before=pathlib.Path(path).read_bytes()
        new=edit_bank(path,before)
        if new==before:continue
        oldhash,newhash=sha(before),sha(new)
        if manifest["files"].get(path)!=oldhash:raise RuntimeError("SOURCE_MANIFEST_HASH_CONFLICT "+path)
        old_token='"'+path+'": "'+oldhash+'"'
        assert output_manifest.count(old_token)==1
        output_manifest=output_manifest.replace(old_token,'"'+path+'": "'+newhash+'"')
        pathlib.Path(path).write_bytes(new)
        CHANGED.append(path)
        BEFORE[path]=before
        edits+=1
    if not 10 <= edits <= 20:raise RuntimeError(f"CHANGED_BANK_COUNT_UNEXPECTED {edits}")
    modified=json.loads(output_manifest)
    for k,value in manifest["files"].items():
        if k not in CHANGED and modified["files"][k]!=value:raise RuntimeError("OTHER_PRODUCT_MANIFEST_CHANGED")
    pathlib.Path(MANIFEST).write_text(output_manifest,encoding="utf-8")
    changed_paths=subprocess.check_output(["git","diff","--name-only"],text=True).splitlines()
    if set(changed_paths)!=set(CHANGED+[MANIFEST]):raise RuntimeError("OUT_OF_SCOPE_EDIT "+str(changed_paths))
    for path in CHANGED:
        new=pathlib.Path(path).read_bytes()
        assert modified["files"][path]==sha(new)
        old=json.loads(BEFORE[path].decode("utf-8-sig"))
        nxt=json.loads(new.decode("utf-8-sig"))
        assert old["sections"].keys()==nxt["sections"].keys()
        for key in old["sections"]:
            if key!="partner":assert old["sections"][key]==nxt["sections"][key]
    print("UNIVERSAL_PARTNER_READY changes="+str(edits)+" files="+",".join(CHANGED)+" unrelated_sections_preserved=true",flush=True)

def deploy():
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect("server172.hosting.reg.ru",21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    public=home+"/www/xn--c1adkkdfjbp1a4l.online/"
    private=home+"/private/numi-account-20261031/store-content/"
    manifest_path=home+"/private/numi-account-20261031/store-assets.json"
    backups=home+"/site-safeguard-backups/"
    changed_paths=subprocess.check_output(["git","diff","--name-only","HEAD^","HEAD"],text=True).splitlines()
    paths=[x for x in changed_paths if BANK_RE.fullmatch(x)]
    if not 10<=len(paths)<=20:raise RuntimeError("RELEASE_SCOPE_UNEXPECTED "+str(paths))
    def read(path):
        b=io.BytesIO()
        ftp.retrbinary("RETR "+path,b.write)
        return b.getvalue()
    def write(path,value):
        ftp.storbinary("STOR "+path,io.BytesIO(value))
        if read(path)!=value:raise RuntimeError("FTP_READBACK_MISMATCH "+path)
    manifest_original=json.loads(subprocess.check_output(["git","show","HEAD^:"+MANIFEST]))
    manifest_committed=json.loads(pathlib.Path(MANIFEST).read_bytes())
    live_manifest_bytes=read(manifest_path)
    live_manifest=json.loads(live_manifest_bytes)
    if live_manifest.get("version")!=2:raise RuntimeError("LIVE_MANIFEST_VERSION_MISMATCH")
    patched_text=live_manifest_bytes.decode("utf-8")
    desired={}
    for path in paths:
        old=subprocess.check_output(["git","show","HEAD^:"+path])
        new=pathlib.Path(path).read_bytes()
        if manifest_original["files"].get(path)!=sha(old) or manifest_committed["files"].get(path)!=sha(new):
            raise RuntimeError("RELEASE_HASH_MISMATCH "+path)
        lh=live_manifest["files"].get(path)
        if lh not in (sha(old),sha(new)):raise RuntimeError("LIVE_MANIFEST_CONFLICT "+path)
        if lh!=sha(new):
            rx=re.compile('("'+re.escape(path)+r'"\s*:\s*")'+sha(old)+'(")')
            if len(rx.findall(patched_text))!=1:raise RuntimeError("LIVE_MANIFEST_FORMAT_ERROR "+path)
            patched_text=rx.sub(lambda m:m.group(1)+sha(new)+m.group(2),patched_text)
        desired[public+path]=(old,new)
        desired[private+path]=(old,new)
    patched=json.loads(patched_text)
    for k,v in live_manifest["files"].items():
        if k not in paths and patched["files"][k]!=v:raise RuntimeError("UNRELATED_PRIVATE_HASH_CHANGED "+k)
    desired[manifest_path]=(live_manifest_bytes,patched_text.encode("utf-8"))
    current={}
    written=[]
    try:
        # Full preflight for every target before changing any production file.
        for dest,(old,new) in desired.items():
            got=read(dest)
            if got not in (old,new):raise RuntimeError("LIVE_BANK_CONTENT_CONFLICT "+dest)
            current[dest]=got
        stamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        for i,(dest,(old,new)) in enumerate(desired.items()):
            if current[dest]==new:continue
            write(backups+"universal-partner-"+stamp+"-"+str(i).zfill(2)+".bak",current[dest])
        for dest,(old,new) in desired.items():
            if current[dest]==new:continue
            written.append(dest)
            write(dest,new)
        for dest,(old,new) in desired.items():
            if read(dest)!=new:raise RuntimeError("FINAL_READBACK_FAILED "+dest)
        print(f"UNIVERSAL_PARTNER_PUBLISHED_OK energy_banks={len(paths)} protected_banks={len(paths)} private_manifest=true unrelated_files_untouched=true",flush=True)
    except BaseException:
        for dest in reversed(written):
            try:
                write(dest,current[dest])
                print("UNIVERSAL_PARTNER_ROLLBACK_OK "+dest,flush=True)
            except Exception:
                print("UNIVERSAL_PARTNER_ROLLBACK_FAILED "+dest,flush=True)
        raise
    finally:
        try:ftp.quit()
        except Exception:ftp.close()

if __name__=="__main__":
    if sys.argv[1]=="prepare":prepare()
    elif sys.argv[1]=="deploy":deploy()
    else:raise RuntimeError("Usage: prepare|deploy")
