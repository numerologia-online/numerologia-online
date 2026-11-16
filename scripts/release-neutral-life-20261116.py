#!/usr/bin/env python3
"""Strictly scoped release of 16 authored full-life text JSON banks.
Never modifies site code, calculation logic or purchases. An isolated editorial
draft is converted to generic singular masculine grammatical agreement.
"""
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
import ftplib
import urllib.error
import urllib.request

BASE="7cb3a15a80d8f7472a71afc545dafb20def9cc6d"
DRAFT="16c7df76753ad61318601115dca0738439cea277"
TEXT_PATHS=(
    [f"knowledge/full-report/free/impression/energy-{n}.json" for n in [7,9,14]]
    +[f"knowledge/full-report/sections/energy-{n}.json" for n in [1,2,4,6,7,8,9,11,13,14,19,22]]
    +["pro/guidance/energy-14.json"]
)
MANIFEST="account-service/private/store-assets.json"
TOKENS=re.compile(r"[А-Яа-яЁё]+|[^А-Яа-яЁё]+")
JSON_STRING=re.compile(r'"(?:\\.|[^"\\])*"',re.S)

def old(path,ref=BASE):
    return subprocess.check_output(["git","show",ref+":"+path])
def shape(a):
    if isinstance(a,dict):return {k:shape(v) for k,v in a.items()}
    if isinstance(a,list):return [shape(v) for v in a]
    return type(a).__name__

def prepare():
    count=0
    assert len(TEXT_PATHS)==16
    for path in TEXT_PATHS:
        raw=pathlib.Path(path).read_bytes()
        assert raw==old(path),("LIVE_SOURCE_DIFFERENT_FROM_REVIEWED_BASE",path)
        revised=old(path,DRAFT)
        assert shape(json.loads(raw.decode("utf-8-sig")))==shape(json.loads(revised.decode("utf-8-sig")))
        originals=JSON_STRING.findall(raw.decode("utf-8"))
        candidates=JSON_STRING.findall(revised.decode("utf-8"))
        assert len(originals)==len(candidates)
        rendered=[]
        for literal,new_literal in zip(originals,candidates):
            phrase=json.loads(literal)
            new_phrase=json.loads(new_literal)
            if phrase==new_phrase:
                rendered.append(literal);continue
            words=TOKENS.findall(phrase)
            words_new=TOKENS.findall(new_phrase)
            assert len(words)==len(words_new),("NON_GRAMMATICAL_EDIT",path)
            out=[]
            for before,after in zip(words,words_new):
                if before==after:
                    out.append(before);continue
                b=before.lower();a=after.lower()
                assert b.endswith(("ой","ей")) and a.endswith(("ыми","ими")),("UNEXPECTED_WORD_CHANGE",path,before,after)
                stem=b[:-2]
                assert a[:-3]==stem,("WORD_ROOT_CHANGED",path,before,after)
                neutral=stem+("им" if a.endswith("ими") else "ым")
                if before[0].isupper():neutral=neutral[0].upper()+neutral[1:]
                out.append(neutral)
                count+=1
            rendered.append(json.dumps("".join(out),ensure_ascii=False))
        iterator=iter(rendered)
        data=JSON_STRING.sub(lambda _:next(iterator),raw.decode("utf-8")).encode("utf-8")
        assert shape(json.loads(data.decode("utf-8-sig")))==shape(json.loads(raw.decode("utf-8-sig")))
        assert len(data.splitlines())==len(raw.splitlines())
        pathlib.Path(path).write_bytes(data)
    assert 45<=count<=85,("TOTAL_EDIT_COUNT_UNEXPECTED",count)
    manifest_original=old(MANIFEST)
    assert pathlib.Path(MANIFEST).read_bytes()==manifest_original, "CHECKSUM_FILE_CHANGED"
    manifest=json.loads(manifest_original)
    text=manifest_original.decode("utf-8")
    private_count=0
    for path in TEXT_PATHS:
        if not path.startswith("knowledge/full-report/sections/"):continue
        before=hashlib.sha256(old(path)).hexdigest()
        after=hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
        assert manifest["files"][path]==before,("PRIVATE_SOURCE_ALREADY_DIFFERENT",path)
        old_field='"'+path+'": "'+before+'"'
        assert text.count(old_field)==1,("CHECKSUM_LOCATION_INVALID",path)
        text=text.replace(old_field,'"'+path+'": "'+after+'"')
        private_count+=1
    assert private_count==12
    modified=json.loads(text)
    for key,value in manifest.items():
        if key!="files":assert modified[key]==value
    for key,value in manifest["files"].items():
        if key not in TEXT_PATHS:assert modified["files"][key]==value
    pathlib.Path(MANIFEST).write_text(text,encoding="utf-8")
    modified_paths=subprocess.check_output(["git","diff","--name-only"],text=True).splitlines()
    assert set(modified_paths)==set(TEXT_PATHS+[MANIFEST]),("UNRELATED_CHANGED_FILE",modified_paths)
    print("NEUTRAL_EDITORIAL_PREPARED",json.dumps({"files":16,"grammatical_forms":count,"private_banks":12,"original_schemas_unchanged":True,"checkout_unchanged":True},ensure_ascii=False),flush=True)

def deploy():
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
    ftp.connect("server172.hosting.reg.ru",21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    account=ftp.pwd().rstrip("/")
    public=account+"/www/xn--c1adkkdfjbp1a4l.online/"
    private=account+"/private/numi-account-20261031/"
    backups=account+"/site-safeguard-backups/"
    targets={}
    for path in TEXT_PATHS:
        oldbytes=old(path);newbytes=pathlib.Path(path).read_bytes()
        targets[public+path]=(oldbytes,newbytes)
        if path.startswith("knowledge/full-report/sections/"):
            targets[private+"store-content/"+path]=(oldbytes,newbytes)
    targets[private+"store-assets.json"]=(old(MANIFEST),pathlib.Path(MANIFEST).read_bytes())
    assert len(targets)==29
    def read(path):
        output=io.BytesIO()
        try:ftp.retrbinary("RETR "+path,output.write)
        except ftplib.error_perm as exc:
            if str(exc).startswith("550"):return None
            raise
        return output.getvalue()
    def put(path,value):
        ftp.storbinary("STOR "+path,io.BytesIO(value))
        if read(path)!=value:raise RuntimeError("FTP_UPLOAD_VERIFY_FAILED "+path)
    edited=[]
    try:
        # Abort without changing production if any bank differs from the saved baseline.
        for path,(before,after) in targets.items():
            live=read(path)
            if live not in (before,after):
                raise RuntimeError("UNEXPECTED_PRODUCTION_VERSION_ABORT "+path.removeprefix(account))
        now=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        # Create immutable FTP backups for every exact file before changing anything.
        for i,(path,(before,after)) in enumerate(targets.items()):
            if before==after or read(path)==after:continue
            location=backups+"neutral-life-"+now+"-"+str(i).zfill(2)+"-"+path.removeprefix(account).strip("/").replace("/","-")+".bak"
            put(location,before)
        # Public file/paid private shadow must match. Private SHA manifest is last.
        for path,(before,after) in targets.items():
            if read(path)!=after:
                put(path,after);edited.append(path)
        assert all(read(path)==after for path,(before,after) in targets.items())
        baseurl="https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
        for source in [
            "knowledge/full-report/free/impression/energy-9.json",
            "knowledge/full-report/free/impression/energy-14.json",
            "knowledge/full-report/sections/energy-9.json",
            "knowledge/full-report/sections/energy-14.json",
        ]:
            request=urllib.request.Request(baseurl+source+"?neutral_release="+str(time.time_ns()),headers={"Cache-Control":"no-cache"})
            try:
                with urllib.request.urlopen(request,timeout=24) as result:
                    status=result.status
                    value=result.read(240000)
            except urllib.error.HTTPError as err:
                status=err.code
                value=b""
            if "/free/" in source:
                assert status==200 and value==pathlib.Path(source).read_bytes(),("FREE_TEXT_MISMATCH",source,status)
            else:
                assert status==403,("PROTECTED_BANK_PUBLICLY_OPEN",source,status)
        print("NEUTRAL_LIFE_LIVE_OK files=16 sha_private=12 ftp_bytes_verified=true free_public_matching=true paid_protected_403=true original_ui_unchanged=true",flush=True)
    except BaseException:
        for path in reversed(edited):
            try:
                put(path,targets[path][0])
                print("NEUTRAL_LIFE_ROLLBACK_OK "+path.removeprefix(account),flush=True)
            except Exception as exc:
                print("NEUTRAL_LIFE_ROLLBACK_FAILED "+path.removeprefix(account)+" "+type(exc).__name__,flush=True)
        raise
    finally:
        try:ftp.quit()
        except Exception:ftp.close()

if __name__=="__main__":
    if len(sys.argv)!=2 or sys.argv[1] not in ("prepare","deploy"):raise SystemExit("Usage: prepare|deploy")
    globals()[sys.argv[1]]()
