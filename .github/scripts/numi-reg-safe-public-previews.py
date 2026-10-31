"""Publish only 36 reviewed guest-safe JSON catalogs, preserving free first answers.
Keep private 321-source vault, Telegram auth, website UI and paid Apache guard intact.
"""
import concurrent.futures
import ftplib
import hashlib
import io
import json
import os
import pathlib
import re
import ssl
import subprocess
import sys
import time

DOMAIN = "xn--c1adkkdfjbp1a4l.online"
SERVER = "server172.hosting.reg.ru"
CANDIDATE = "f67c2ce48928e97a8471d07608b6c722985b7267"
RELEASE = "eb1fb7c9b1e3992f2207d9979f3d029276bc3401"
LOGIN_SHA = "c9bbfeef5d85d66b6e119357734fabb74bdf2301c279ff6b060063428c918dbe"

def note(**kwargs):
    print(json.dumps(kwargs, sort_keys=True, ensure_ascii=False), flush=True)

def git_bytes(commit, path):
    return subprocess.check_output(["git", "show", commit + ":" + path], timeout=25)

def blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\x00" + data).hexdigest()

def get_public(path):
    url = "https://" + DOMAIN + "/" + path + "?numi_release_check=" + str(int(time.time()))
    cmd = ["curl", "-4", "-sS", "-L", "--max-time", "21",
           "-H", "Cache-Control: no-cache", "-w", "\\n%{http_code}", url]
    r = subprocess.run(cmd, capture_output=True, timeout=26)
    if r.returncode:
        raise RuntimeError("Public HTTP request failed: " + path)
    body, sep, status = r.stdout.rpartition(b"\n")
    if not sep or status.strip() != b"200":
        raise RuntimeError("Unexpected public HTTP status for " + path + " " + status.decode()[:10])
    return body

def prepare():
    policy_text = git_bytes(CANDIDATE, "paid-content-paths.js").decode()
    m = re.search(r"export const protectedFiles\s*=\s*(\{[^;]+\})\s*;", policy_text, re.S)
    if not m:
        raise RuntimeError("Pinned safe content inventory not found")
    policy = json.loads(m.group(1))
    original_manifest = json.loads(git_bytes(RELEASE, ".github/numi-frontend-release.json"))
    entries = {e["path"]: e for e in original_manifest["files"]}
    paths = sorted(p for p,v in policy.items() if v["public"] is True and not p.startswith("data/redflag/love/published/"))
    if len(paths) != 40:
        raise RuntimeError("Expected 40 mixed/free catalog paths")
    files = {}
    for path in paths:
        e = entries[path]
        if e["old"] == e["new"]:
            continue
        if not path.endswith(".json") or ".." in path or not re.fullmatch(r"[a-zA-Z0-9_./-]+", path):
            raise RuntimeError("Unsafe public file path")
        old = pathlib.Path(path).read_bytes()
        new = git_bytes(CANDIDATE, path)
        if blob(old) != e["old"] or blob(new) != e["new"]:
            raise RuntimeError("Verified source checksum mismatch for " + path)
        a, b = json.loads(old), json.loads(new)
        if path.startswith("data/compatibility/deep/"):
            if a.get("energy") != b.get("energy") or a.get("title") != b.get("title"):
                raise RuntimeError("Compatibility free title changed")
            if set(b.get("blocks", {})) != {"pairEssence"} or b["blocks"]["pairEssence"] != a["blocks"]["pairEssence"]:
                raise RuntimeError("Free compatibility reading changed")
        elif path.startswith("data/redflag/banks/"):
            old_questions, new_questions = a["questions"], b["questions"]
            if len(old_questions) != len(new_questions):
                raise RuntimeError("Red Flag question count changed")
            for old_q, new_q in zip(old_questions, new_questions):
                for k in ("id", "title", "textFile"):
                    if old_q.get(k) != new_q.get(k):
                        raise RuntimeError("Red Flag free question identity changed")
                if new_q.get("isFree"):
                    for k in ("variants", "answer", "text", "observation"):
                        if k in old_q and old_q[k] != new_q.get(k):
                            raise RuntimeError("Free Red Flag answer changed")
        elif path == "pro/school/lessons.json":
            if not b["lessons"] or b["lessons"][0] != a["lessons"][0]:
                raise RuntimeError("Open first school lesson changed")
        elif path == "pro/point-previews.json":
            if b.get("titles") != a.get("titles") or b.get("groups") != a.get("groups"):
                raise RuntimeError("Open report titles changed")
        elif path == "pro/zones.json":
            if [(z.get("id"),z.get("title")) for z in a.get("zones",[])] != [(z.get("id"),z.get("title")) for z in b.get("zones",[])]:
                raise RuntimeError("Public learning sections changed")
        files[path] = (old, new)
    if len(files) != 36 or sum(p.startswith("data/compatibility/deep/") for p in files) != 22:
        raise RuntimeError("Expected 36 mixed preview files with 22 compatibility entries")
    return files

def main():
    files = prepare()
    note(prepared_files=len(files), exact_free_first_answers_verified=True,
         content_sources_modified=0)
    if get_public("api/numi-content-health.php") is None:
        raise RuntimeError("Private backend unavailable")
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=28)
    try:
        ftp.connect(SERVER, 21)
        ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
        ftp.prot_p()
        ftp.set_pasv(True)
        home = ftp.pwd().rstrip("/")
        site = home + "/www/" + DOMAIN
        def read(path, size_limit=1200000):
            buf = io.BytesIO()
            def add(chunk):
                if buf.tell() + len(chunk) > size_limit:
                    raise RuntimeError("Unexpectedly large remote file")
                buf.write(chunk)
            ftp.retrbinary("RETR "+path,add)
            return buf.getvalue()
        def put(path, data):
            ftp.storbinary("STOR "+path,io.BytesIO(data))
            if hashlib.sha256(read(path)).digest() != hashlib.sha256(data).digest():
                raise RuntimeError("FTPS writeback mismatch")
        main_html=read(site+"/index.html")
        auth=read(site+"/auth-profile.js")
        if hashlib.sha256(auth).hexdigest()!=LOGIN_SHA:
            raise RuntimeError("Login changed, refusing to publish")
        guard=read(site+"/.htaccess")
        if b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" not in guard:
            raise RuntimeError("Paid static guard absent; refusing mixed preview publication")
        changes={}
        for i,(path,(old,new)) in enumerate(files.items(),1):
            remote = read(site+"/"+path)
            if blob(remote)==blob(old):
                changes[path]=(old,new)
            elif blob(remote)==blob(new):
                changes[path]=(new,new)
            else:
                raise RuntimeError("Live edited source differs from known versions, no writes: "+path)
            if i%12==0:note(verified_live_originals=i,total=len(files))
        note(preflight_passed=len(files),unchanged_live=len(files)-sum(x[0]!=x[1] for x in changes.values()))
        backup_root=home+"/site-safeguard-backups"
        try:ftp.mkd(backup_root)
        except ftplib.error_perm:pass
        backup=backup_root+"/mixed-free-safe-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        ftp.mkd(backup)
        for i,(path,(old,new)) in enumerate(changes.items(),1):
            safe_name=hashlib.sha256(path.encode()).hexdigest()[:12]+"-"+pathlib.PurePosixPath(path).name
            put(backup+"/"+safe_name,old)
            if i%12==0:note(backed_up=i,total=len(files))
        note(all_36_backups_verified_outside_public_root=True)
        uploaded=[]
        try:
            for i,(path,(old,new)) in enumerate(changes.items(),1):
                if old!=new:
                    uploaded.append(path)
                    put(site+"/"+path,new)
                if i%12==0:note(published_guest_safe_files=i,total=len(files))
            if read(site+"/index.html")!=main_html or read(site+"/auth-profile.js")!=auth or read(site+"/.htaccess")!=guard:
                raise RuntimeError("A protected site asset changed unexpectedly")
            def check(item):
                path,(_,expected)=item
                observed=get_public(path)
                if hashlib.sha256(observed).digest()!=hashlib.sha256(expected).digest():
                    raise RuntimeError("Public cache or content does not match scrubbed version "+path)
                return path
            with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
                verified=list(pool.map(check, changes.items()))
            if len(verified)!=36:
                raise RuntimeError("Incomplete public sample audit")
            public_free=["data/redflag/money/gift.json","data/redflag/love/published/1-2.json",
                         "child/data/matrix/free/character-1.json"]
            for p in public_free:
                if not json.loads(get_public(p)):
                    raise RuntimeError("Free reading inaccessible after sanitized publication")
            for p in ["data/year/energy-1.txt","child/data/matrix/sections/energy-1.json",
                      "data/redflag/money/generosity.json","pro/purpose/general.json"]:
                response=subprocess.run(["curl","-4","-sS","-L","--max-time","16",
                                         "-o","/dev/null","-w","%{http_code}",
                                         "https://"+DOMAIN+"/"+p+"?chk="+str(int(time.time()))],
                                        capture_output=True,text=True,timeout=20)
                if response.returncode!=0 or response.stdout.strip() not in ("401","403","404","410"):
                    raise RuntimeError("Paid static guard lost on "+p)
            note(success=True,sanitized_public_mixed_files=36,
                 paid_static_184_urls_still_denied=True,
                 free_readings_still_available=True,telegram_auth_unchanged=True)
        except BaseException:
            note(publication_failed=True,starting_restore=len(uploaded))
            failures=[]
            for p in reversed(uploaded):
                try:put(site+"/"+p,changes[p][0])
                except BaseException:failures.append(p)
            note(rollback_failed_paths=failures)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:main()
    except BaseException as ex:
        note(stopped=type(ex).__name__,
             detail=str(ex)[:160] if isinstance(ex,RuntimeError) else "")
        sys.exit(1)
