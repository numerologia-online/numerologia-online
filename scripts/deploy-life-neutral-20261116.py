#!/usr/bin/env python3
"""Deploy gender-neutral full-life text banks to REG.RU with strict backup and rollback.

Only exact generated source versions are accepted, in both public website shadow
and protected paid-content shadow. Private content manifest is patched *in place*,
preserving every unrelated product and hash.
"""
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

META = pathlib.Path("/tmp/numi-life-gender-release.json")
MANIFEST = pathlib.Path("account-service/private/store-assets.json")
BASE = "knowledge/full-report/sections/"

def sha(value):
    return hashlib.sha256(value).hexdigest()

def original(path):
    return subprocess.check_output(["git","show","HEAD^:"+path])

def main():
    info = json.loads(META.read_text("utf-8"))
    updates = info["updates"]
    if len(updates) < 18 or len(updates) > 22:
        raise RuntimeError("LIFE_NEUTRAL_WRONG_FILE_COUNT")
    if len({name for name, *_ in updates}) != len(updates):
        raise RuntimeError("LIFE_NEUTRAL_DUPLICATE_FILE")

    source_manifest = json.loads(MANIFEST.read_text("utf-8"))
    base_manifest = json.loads(original(str(MANIFEST)))
    if source_manifest["version"] != base_manifest["version"] or source_manifest["version"] != 2:
        raise RuntimeError("LIFE_NEUTRAL_WRONG_MANIFEST_VERSION")

    source = {}
    for name, oldhash, newhash, forms in updates:
        if not re.fullmatch(r"knowledge/full-report/sections/energy-(?:[1-9]|1[0-9]|2[0-2])\.json", name):
            raise RuntimeError("LIFE_NEUTRAL_OUT_OF_SCOPE: " + name)
        before = original(name)
        after = pathlib.Path(name).read_bytes()
        if sha(before) != oldhash or sha(after) != newhash or oldhash == newhash:
            raise RuntimeError("LIFE_NEUTRAL_HASH_CONFLICT: " + name)
        if base_manifest["files"][name] != oldhash or source_manifest["files"][name] != newhash:
            raise RuntimeError("LIFE_NEUTRAL_MANIFEST_NOT_SYNCED: " + name)
        b = json.loads(before.decode("utf-8-sig"))
        a = json.loads(after.decode("utf-8-sig"))
        if list(b["sections"]) != list(a["sections"]):
            raise RuntimeError("LIFE_NEUTRAL_SECTION_SCHEMA_CHANGED: " + name)
        for key in b["sections"]:
            if list(b["sections"][key]) != list(a["sections"][key]):
                raise RuntimeError("LIFE_NEUTRAL_SECTION_KEYS_CHANGED: " + name)
            x = a["sections"][key]
            y = b["sections"][key]
            if x.get("title") != y.get("title"):
                raise RuntimeError("LIFE_NEUTRAL_SECTION_TITLE_CHANGED: " + name)
            if "content" in x and "paragraphs" in x:
                if y["content"] == "\n\n".join(y["paragraphs"]):
                    if x["content"] != "\n\n".join(x["paragraphs"]):
                        raise RuntimeError("LIFE_NEUTRAL_PDF_CONTENT_DIVERGED: " + name)
        source[name] = (before, after)

    for key, value in base_manifest["files"].items():
        if key not in source and source_manifest["files"].get(key) != value:
            raise RuntimeError("LIFE_NEUTRAL_UNRELATED_MANIFEST_CHANGED: " + key)

    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=40)
    ftp.connect("server172.hosting.reg.ru", 21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)

    home = ftp.pwd().rstrip("/")
    public_root = home + "/www/xn--c1adkkdfjbp1a4l.online/"
    private_root = home + "/private/numi-account-20261031/"
    protected_root = private_root + "store-content/"
    protected_manifest_path = private_root + "store-assets.json"
    backup_root = home + "/site-safeguard-backups/"

    def read(path):
        buf=io.BytesIO()
        ftp.retrbinary("RETR "+path,buf.write)
        return buf.getvalue()

    def write_and_check(path,value):
        ftp.storbinary("STOR "+path,io.BytesIO(value))
        actual=read(path)
        if actual != value:
            raise RuntimeError("LIFE_NEUTRAL_FTP_READBACK_MISMATCH: " + path)
    targets={}
    touched=[]
    backups=[]
    try:
        if not read(public_root+"index.html").strip():
            raise RuntimeError("LIFE_NEUTRAL_SITE_ROOT_INVALID")
        for path,(oldbytes,newbytes) in source.items():
            targets[public_root+path]=(oldbytes,newbytes)
            targets[protected_root+path]=(oldbytes,newbytes)

        private_manifest_bytes=read(protected_manifest_path)
        private_manifest=json.loads(private_manifest_bytes)
        if private_manifest.get("version")!=2:
            raise RuntimeError("LIFE_NEUTRAL_PROTECTED_MANIFEST_WRONG_VERSION")
        text=private_manifest_bytes.decode("utf-8")
        changed_paths=set(source)
        for name,(before,after) in source.items():
            oldhash=sha(before)
            newhash=sha(after)
            current=private_manifest["files"].get(name)
            if current not in (oldhash,newhash):
                raise RuntimeError("LIFE_NEUTRAL_PROTECTED_MANIFEST_HASH_CONFLICT: "+name)
            if current==oldhash:
                pattern=re.compile('("'+re.escape(name)+r'"\s*:\s*")'+oldhash+'(")')
                if len(pattern.findall(text))!=1:
                    raise RuntimeError("LIFE_NEUTRAL_MANIFEST_PATCH_NOT_UNIQUE: "+name)
                text=pattern.sub(lambda m:m.group(1)+newhash+m.group(2),text)
        patched=text.encode("utf-8")
        new_private=json.loads(patched)
        for k,v in private_manifest["files"].items():
            if k not in changed_paths and new_private["files"].get(k)!=v:
                raise RuntimeError("LIFE_NEUTRAL_UNRELATED_PRIVATE_HASH_CHANGED: "+k)
        for k,v in private_manifest.items():
            if k!="files" and new_private[k]!=v:
                raise RuntimeError("LIFE_NEUTRAL_PROTECTED_MANIFEST_METADATA_CHANGED")
        targets[protected_manifest_path]=(private_manifest_bytes,patched)

        # Abort before ANY writes if live files differ from exactly reviewed GitHub old/new revisions.
        existing={}
        for dest,(before,after) in targets.items():
            value=read(dest)
            if dest!=protected_manifest_path and value not in (before,after):
                raise RuntimeError("LIFE_NEUTRAL_LIVE_CONTENT_CONFLICT_ABORT: "+dest)
            existing[dest]=value
        print("LIFE_NEUTRAL_PRECHECK_OK banks="+str(len(source))+" public_private_checked=true unrelated_hashes_preserved=true",flush=True)

        now=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        # Backup original live bytes before the first edit. Manifest is the last target.
        for index,(dest,(before,after)) in enumerate(targets.items()):
            if existing[dest]==after: continue
            backup_dest=backup_root+"life-neutral-"+now+"-"+str(index).zfill(3)+".bak"
            write_and_check(backup_dest,existing[dest])
            backups.append(backup_dest)
        print("LIFE_NEUTRAL_BACKUPS_OK count="+str(len(backups)),flush=True)
        for dest,(before,after) in targets.items():
            if existing[dest]==after: continue
            touched.append(dest)  # include partial writes in rollback
            write_and_check(dest,after)

        # Read back every protected source and bank. No HTTP public leak caused by this job.
        for dest,(before,after) in targets.items():
            if read(dest)!=after:
                raise RuntimeError("LIFE_NEUTRAL_FINAL_BYTE_VERIFICATION_FAILED: "+dest)
        print("LIFE_NEUTRAL_PRODUCTION_SUCCESS bank_count="+str(len(source))+" website_and_paid_content=true manifest_last=true original_calculations_untouched=true rollback_backups_present=true",flush=True)
    except BaseException:
        failed=[]
        for dest in reversed(touched):
            try:
                write_and_check(dest,existing[dest])
            except Exception:
                failed.append(dest)
        if failed:
            print("LIFE_NEUTRAL_ROLLBACK_INCOMPLETE "+str(failed),flush=True)
        else:
            print("LIFE_NEUTRAL_ROLLBACK_COMPLETED edits_rolled_back="+str(len(touched)),flush=True)
        raise
    finally:
        try:ftp.quit()
        except Exception:ftp.close()

if __name__=="__main__":
    main()
