#!/usr/bin/env python3
"""Reconcile gender-neutral full-life copy with newer live partner sections.

Guardrails: compare 21 approved bank versions; keep any newer live partner text;
reject changes anywhere else, public/private drift, stale checksums or wrong
schema; commit reconciled files to GitHub before FTP mutation; back up every
live file before updating; roll back all modified paths on failure.
"""
import copy
import ftplib
import hashlib
import io
import json
import os
import pathlib
import re
import ssl
import subprocess
import time

BASE = "3c39295b4a7ad56f95998bc8c0280de5edc39d21"
REVISED = "701b061d4247255ac6aade1b96ebdc56d6090cd0"
MANIFEST = "account-service/private/store-assets.json"
PREFIX = "knowledge/full-report/sections/"
REPO_ROOT = pathlib.Path(".")

def cmd(*args):
    return subprocess.check_output(args)

def original(revision, name):
    return cmd("git", "show", revision+":"+name)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def parse(data):
    return json.loads(data.decode("utf-8-sig"))

def transplant_partner(target_raw, live_partner):
    """Replace only the JSON object for the 'partner' section, not the other text."""
    s = target_raw.decode("utf-8")
    pattern = re.compile(r'"partner"\s*:\s*\{')
    matches = list(pattern.finditer(s))
    if len(matches) != 1:
        raise RuntimeError("PARTNER_SECTION_NOT_UNIQUE")
    start = matches[0].end()-1
    depth = 0
    quoted = escaped = False
    end = -1
    for i in range(start, len(s)):
        c = s[i]
        if quoted:
            if escaped: escaped = False
            elif c == "\\": escaped = True
            elif c == '"': quoted = False
            continue
        if c == '"': quoted = True
        elif c == "{": depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = i+1
                break
    if end < 0:
        raise RuntimeError("PARTNER_SECTION_BRACES_INVALID")
    merged = (s[:start] + json.dumps(live_partner, ensure_ascii=False, indent=2) + s[end:]).encode("utf8")
    wanted = parse(target_raw)
    wanted["sections"]["partner"] = copy.deepcopy(live_partner)
    if parse(merged) != wanted:
        raise RuntimeError("PARTNER_TRANSPLANT_CHANGED_OTHER_SECTIONS")
    return merged

def replace_manifest_fields(raw, expected, updated):
    s = raw.decode("utf8")
    document = json.loads(s)
    for name, value in updated.items():
        if document["files"].get(name) != expected[name]:
            raise RuntimeError("MANIFEST_BASELINE_MISMATCH "+name)
        pattern = re.compile(r'("'+re.escape(name)+r'"\s*:\s*")'+re.escape(expected[name])+r'(")')
        if len(pattern.findall(s)) != 1:
            raise RuntimeError("MANIFEST_KEY_NOT_UNIQUE "+name)
        s = pattern.sub(lambda match: match.group(1)+value+match.group(2),s)
    result=s.encode("utf8")
    new_document=json.loads(result)
    for k,v in document.items():
        if k!="files" and new_document[k]!=v:
            raise RuntimeError("UNRELATED_MANIFEST_METADATA_MODIFIED")
    for k,v in document["files"].items():
        if k not in updated and new_document["files"][k]!=v:
            raise RuntimeError("UNRELATED_MANIFEST_HASH_MODIFIED "+k)
    return result

def main():
    if not (os.environ.get("REG_FTP_USER") and os.environ.get("REG_FTP_PASSWORD")):
        raise RuntimeError("FTP_CREDENTIALS_MISSING")
    assert cmd("git","status","--porcelain","--untracked-files=no").strip() == b"", "WORKTREE_NOT_CLEAN"
    # Do not touch content that has changed in GitHub since approved review.
    paths=cmd("git","diff","--name-only",BASE,REVISED).decode().splitlines()
    names=sorted(name for name in paths if name!=MANIFEST)
    if len(names)!=21 or set(paths)!=set(names)|{MANIFEST}:
        raise RuntimeError("RELEASE_SCOPE_DIFFERENT")
    for name in names:
        if not re.fullmatch(r"knowledge/full-report/sections/energy-(?:[1-9]|1[0-9]|2[0-2])\.json",name):
            raise RuntimeError("BANK_PATH_INVALID "+name)
        if pathlib.Path(name).read_bytes()!=original(REVISED,name):
            raise RuntimeError("GITHUB_BANK_CHANGED_SINCE_APPROVAL "+name)
    if pathlib.Path(MANIFEST).read_bytes()!=original(REVISED,MANIFEST):
        raise RuntimeError("GITHUB_MANIFEST_CHANGED_SINCE_APPROVAL")

    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect("server172.hosting.reg.ru",21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    home=ftp.pwd().rstrip("/")
    webroot=home+"/www/xn--c1adkkdfjbp1a4l.online/"
    account=home+"/private/numi-account-20261031/"
    protected=account+"store-content/"
    manifest_path=account+"store-assets.json"
    backups=home+"/site-safeguard-backups/"

    def read(path):
        buf=io.BytesIO()
        ftp.retrbinary("RETR "+path,buf.write)
        return buf.getvalue()

    def write_checked(path,data):
        ftp.storbinary("STOR "+path,io.BytesIO(data))
        if read(path)!=data:
            raise RuntimeError("FTP_UPLOAD_VERIFICATION_FAILED "+path)

    touched=[]
    original_bytes={}
    targets={}
    bank_updates={}
    status={}
    try:
        if not read(webroot+"index.html").strip():
            raise RuntimeError("WEBSITE_ROOT_INVALID")
        live_manifest_raw=read(manifest_path)
        live_manifest=parse(live_manifest_raw)
        revised_manifest=parse(original(REVISED,MANIFEST))
        if live_manifest.get("version") != revised_manifest.get("version") or live_manifest.get("version")!=2:
            raise RuntimeError("PRIVATE_MANIFEST_VERSION_CONFLICT")
        expected_live_hash={}
        revised_hash={}
        for name in names:
            base_bytes=original(BASE,name)
            revised_bytes=original(REVISED,name)
            live_private=read(protected+name)
            live_public=read(webroot+name)
            if live_private!=live_public:
                raise RuntimeError("LIVE_PUBLIC_PRIVATE_DIFFER "+name)
            if live_manifest["files"].get(name)!=sha(live_private):
                raise RuntimeError("LIVE_MANIFEST_PROTECTED_BANK_HASH_MISMATCH "+name)
            if revised_manifest["files"][name]!=sha(revised_bytes):
                raise RuntimeError("GITHUB_MANIFEST_BANK_HASH_MISMATCH "+name)
            live_doc=parse(live_private)
            base_doc=parse(base_bytes)
            revised_doc=parse(revised_bytes)
            if list(live_doc["sections"])!=list(base_doc["sections"]) or list(revised_doc["sections"])!=list(base_doc["sections"]):
                raise RuntimeError("LIVE_SECTION_SCHEMA_CHANGED "+name)
            if live_private==base_bytes:
                merged=revised_bytes
                status[name]="identical_old"
            elif live_private==revised_bytes:
                merged=revised_bytes
                status[name]="already_published"
            else:
                # Newer published partner copy is preserved. NO other live sections may differ.
                for sec in base_doc["sections"]:
                    if sec!="partner" and live_doc["sections"][sec] != base_doc["sections"][sec]:
                        raise RuntimeError("LIVE_NON_PARTNER_TEXT_CONFLICT "+name+" "+sec)
                partner=live_doc["sections"]["partner"]
                if partner.get("title") != base_doc["sections"]["partner"].get("title"):
                    raise RuntimeError("LIVE_PARTNER_TITLE_CHANGED "+name)
                all_partner = "\n\n".join(partner.get("paragraphs",[])) + "\n\n" + str(partner.get("content",""))
                if re.search(r"(?<!\w)(?:женщин|мужчин|девушк)\w*",all_partner,re.IGNORECASE):
                    raise RuntimeError("LIVE_PARTNER_GENDERED_TEXT_REQUIRES_REVIEW "+name)
                merged=transplant_partner(revised_bytes,partner)
                status[name]="preserved_newer_partner"
            merged_doc=parse(merged)
            for sec in base_doc["sections"]:
                if sec!="partner" or status[name]!="preserved_newer_partner":
                    if merged_doc["sections"][sec]!=revised_doc["sections"][sec]:
                        raise RuntimeError("EDITORIAL_UPDATE_MISSING "+name+" "+sec)
            if merged_doc["sections"]["partner"].get("content") is not None and merged_doc["sections"]["partner"].get("paragraphs") is not None:
                live_partner=merged_doc["sections"]["partner"]
                old_partner=base_doc["sections"]["partner"]
                if old_partner.get("content")=="\n\n".join(old_partner.get("paragraphs",[])):
                    if live_partner["content"]!="\n\n".join(live_partner["paragraphs"]):
                        raise RuntimeError("PARTNER_PDF_CONTENT_MISMATCH "+name)
            bank_updates[name]=merged
            expected_live_hash[name]=sha(live_private)
            revised_hash[name]=sha(merged)
            targets[webroot+name]=merged
            targets[protected+name]=merged
            original_bytes[webroot+name]=live_public
            original_bytes[protected+name]=live_private

        # Completely reject unexpected differences BEFORE updating any GitHub or FTP content.
        print("LIFE_RECONCILE_PREFLIGHT_OK",json.dumps({
            "banks":len(names),
            "preserved_newer_partner":sum(v=="preserved_newer_partner" for v in status.values()),
            "identical_old":sum(v=="identical_old" for v in status.values()),
            "already_published":sum(v=="already_published" for v in status.values()),
            "public_private_consistent":True,
            "unrelated_sections_untouched":True
        }),flush=True)
        updated_live_manifest=replace_manifest_fields(live_manifest_raw,expected_live_hash,revised_hash)
        targets[manifest_path]=updated_live_manifest
        original_bytes[manifest_path]=live_manifest_raw

        # Reconcile GitHub: keep the newer live partner texts in the repository as well,
        # so future source releases do not accidentally undo those 18 partner corrections.
        current_manifest_raw=pathlib.Path(MANIFEST).read_bytes()
        current_manifest=parse(current_manifest_raw)
        for name in names:
            if current_manifest["files"].get(name)!=sha(pathlib.Path(name).read_bytes()):
                raise RuntimeError("CURRENT_GITHUB_MANIFEST_NOT_IN_SYNC "+name)
        git_updated=replace_manifest_fields(
            current_manifest_raw,
            {name:current_manifest["files"][name] for name in names},
            revised_hash
        )
        changed_paths=[]
        for name in names:
            if pathlib.Path(name).read_bytes()!=bank_updates[name]:
                pathlib.Path(name).write_bytes(bank_updates[name])
                changed_paths.append(name)
        if git_updated!=current_manifest_raw:
            pathlib.Path(MANIFEST).write_bytes(git_updated)
            changed_paths.append(MANIFEST)
        if changed_paths:
            actual=set(cmd("git","diff","--name-only").decode().splitlines())
            if actual!=set(changed_paths):
                raise RuntimeError("UNEXPECTED_GITHUB_DIFF")
            cmd("git","diff","--check")
            subprocess.check_call(["git","config","user.name","numi-full-life-protected-reconciler"])
            subprocess.check_call(["git","config","user.email","numi-full-life-protected-reconciler@users.noreply.github.com"])
            subprocess.check_call(["git","add","--"]+changed_paths)
            subprocess.check_call(["git","commit","-m","Full life: preserve live partner revisions while publishing approved neutral text for all other sections"])
            subprocess.check_call(["git","push","origin","HEAD:refs/heads/main"])
            print("LIFE_RECONCILE_GITHUB_OK changed_files="+str(len(changed_paths)),flush=True)
        else:
            print("LIFE_RECONCILE_GITHUB_ALREADY_SYNCED",flush=True)

        # Race protection: ensure no site source or manifest changed during Git commit.
        for dest,expected in original_bytes.items():
            if read(dest)!=expected:
                raise RuntimeError("LIVE_SOURCE_CHANGED_DURING_GITHUB_COMMIT "+dest)
        print("LIFE_RECONCILE_LIVE_RACE_GUARD_OK",flush=True)
        stamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
        for index,(dest,desired) in enumerate(targets.items()):
            if original_bytes[dest]==desired:
                continue
            backup=backups+"neutral-merged-"+stamp+"-"+str(index).zfill(3)+".bak"
            write_checked(backup,original_bytes[dest])
        print("LIFE_RECONCILE_FTP_BACKUPS_OK",flush=True)
        for dest,desired in targets.items():
            if original_bytes[dest]==desired:
                continue
            touched.append(dest)
            write_checked(dest,desired)
        for dest,desired in targets.items():
            if read(dest)!=desired:
                raise RuntimeError("FINAL_LIVE_FILE_CONTENT_MISMATCH "+dest)
        print("LIFE_RECONCILE_PRODUCTION_OK all_21_approved_text_banks=true newer_partner_texts_preserved=true paid_public_copies_synced=true private_manifest_verified=true git_synced=true",flush=True)
    except BaseException:
        failures=[]
        for dest in reversed(touched):
            try:
                write_checked(dest,original_bytes[dest])
            except Exception:
                failures.append(dest)
        print("LIFE_RECONCILE_ROLLBACK", "incomplete" if failures else "completed", "changed="+str(len(touched)),"failures="+str(len(failures)),flush=True)
        raise
    finally:
        try: ftp.quit()
        except Exception: ftp.close()

if __name__ == "__main__":
    main()
