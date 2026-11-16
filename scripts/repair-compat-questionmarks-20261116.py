#!/usr/bin/env python3
"""Remove irrecoverably replaced '?' tails from exactly 12 compatibility paragraphs.
Preserve every readable character and all other banks, access, payments and UI.
Operate on three public free copies, three private paid banks, one private hash
manifest; create immutable verified backups first. Synchronize source on success.
"""
import ftplib, hashlib, io, json, os, pathlib, re, ssl, subprocess, time

EXPECTED = {
    3: {"pairEssence", "realLife", "money", "honestFinal"},
    4: {"pairEssence", "realLife", "money", "honestFinal"},
    8: {"pairEssence", "realLife", "money", "actions"},
}
REPO_MANIFEST = pathlib.Path("account-service/private/store-assets.json")
Q = re.compile(r"\?{3,}")
def digest(raw): return hashlib.sha256(raw).hexdigest()
def clean(text, label):
    if not isinstance(text,str): raise RuntimeError("BAD_TEXT_TYPE "+label)
    match=Q.search(text)
    if not match: raise RuntimeError("EXPECTED_DAMAGED_TAIL_MISSING "+label)
    tail=text[match.start():]
    if re.search("[А-Яа-яЁёA-Za-z0-9]",tail):
        raise RuntimeError("READABLE_TEXT_AFTER_CORRUPTION_ABORT "+label)
    before=text[:match.start()].rstrip()
    if len(before)<1100 or before[-1] not in ".!?":
        raise RuntimeError("NOT_A_COMPLETE_LAST_SENTENCE_ABORT "+label)
    if Q.search(before): raise RuntimeError("CORRUPTION_IN_SURVIVING_TEXT_ABORT "+label)
    return before

def replace_string(raw,old,new,label):
    old_value=json.dumps(old,ensure_ascii=False).encode("utf-8")
    new_value=json.dumps(new,ensure_ascii=False).encode("utf-8")
    if raw.count(old_value)!=1:raise RuntimeError("STRING_NOT_UNIQUE_OR_ENCODING_MISMATCH "+label)
    result=raw.replace(old_value,new_value,1)
    if not result or result==raw:raise RuntimeError("NO_CHANGE "+label)
    return result

def amend_manifest(raw,changes):
    old=json.loads(raw)
    if old.get("version")!=2:raise RuntimeError("MANIFEST_VERSION")
    result=raw
    for name,(before,after) in changes.items():
        if old["files"].get(name)!=before:raise RuntimeError("BANK_HASH_BASELINE_CHANGED "+name)
        key=('"'+name+'": "'+before+'"').encode("utf-8")
        if result.count(key)!=1:raise RuntimeError("MANIFEST_KEY_NOT_UNIQUE "+name)
        result=result.replace(key,('"'+name+'": "'+after+'"').encode("utf-8"),1)
    updated=json.loads(result)
    if set(old)!=set(updated) or any(old[k]!=updated[k] for k in old if k!="files"):
        raise RuntimeError("UNRELATED_MANIFEST_METADATA")
    if any(updated["files"].get(p)!=v for p,v in old["files"].items() if p not in changes):
        raise RuntimeError("UNRELATED_MANIFEST_HASH")
    return result

def main():
    if not os.getenv("REG_FTP_USER") or not os.getenv("REG_FTP_PASSWORD"):
        raise RuntimeError("MISSING_FTP_CREDENTIALS")
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    f.connect("server172.hosting.reg.ru",21)
    f.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    f.prot_p();f.set_pasv(True)
    home=f.pwd().rstrip("/")
    public=home+"/www/xn--c1adkkdfjbp1a4l.online/"
    private=home+"/private/numi-account-20261031/"
    manifest_name="account-service/private/store-assets.json"
    def read(path):
        output=io.BytesIO()
        def collect(chunk):
            if output.tell()+len(chunk)>2_500_000:raise RuntimeError("LARGE_FILE "+path)
            output.write(chunk)
        f.retrbinary("RETR "+path,collect)
        return output.getvalue()
    def put(path,data):
        f.storbinary("STOR "+path,io.BytesIO(data))
        if read(path)!=data:raise RuntimeError("READBACK_MISMATCH "+path)
    remote_manifest_path=private+"store-assets.json"
    old_live_manifest=read(remote_manifest_path)
    old_git_manifest=REPO_MANIFEST.read_bytes()
    live=json.loads(old_live_manifest)
    source=json.loads(old_git_manifest)
    targets={};local_files={}
    changes={}
    repaired_count=0
    for n,expected in EXPECTED.items():
        relative=f"data/compatibility/deep/energy-{n}.json"
        remote_path=private+"store-content/"+relative
        original=read(remote_path)
        if live["files"].get(relative)!=digest(original):
            raise RuntimeError("LIVE_MANIFEST_MISMATCH_ABORT "+relative)
        if source["files"].get(relative)!=digest(original):
            raise RuntimeError("GIT_MANIFEST_MISMATCH_ABORT "+relative)
        obj=json.loads(original)
        if obj.get("energy")!=n or set(obj.get("blocks",{})) != {"pairEssence","meetingMeaning","attraction","emotions","realLife","sex","money","conflict","lesson","swings","future","actions","honestFinal"}:
            raise RuntimeError("PRIVATE_SCHEMA_UNEXPECTED "+relative)
        detected={key for key,value in obj["blocks"].items() if Q.search(value.get("text",""))}
        if detected!=expected:raise RuntimeError("DAMAGE_SCOPE_UNEXPECTED "+relative+" "+str(detected))
        changed=original
        for key in sorted(expected):
            value=obj["blocks"][key]["text"]
            replacement=clean(value,f"{n}.{key}")
            changed=replace_string(changed,value,replacement,f"{n}.{key}")
            repaired_count+=1
        verified=json.loads(changed)
        for key,block in obj["blocks"].items():
            if key not in expected and verified["blocks"][key]!=block:
                raise RuntimeError("UNRELATED_BLOCK_CHANGED "+relative+":"+key)
        if any(Q.search(json.dumps(v,ensure_ascii=False)) for v in verified["blocks"].values()):
            raise RuntimeError("CORRUPTION_REMAINS "+relative)
        targets[remote_path]=(original,changed)
        changes[relative]=(digest(original),digest(changed))
        # The public one-topic mirror is also affected; never reveal other 12 paid chapters.
        public_source=pathlib.Path(relative)
        old_source=public_source.read_bytes()
        public_obj=json.loads(old_source)
        if public_obj.get("energy")!=n or set(public_obj.get("blocks",{}))!={"pairEssence"}:
            raise RuntimeError("PUBLIC_SOURCE_SHAPE_UNEXPECTED "+relative)
        old_public_text=public_obj["blocks"]["pairEssence"]["text"]
        if old_public_text!=obj["blocks"]["pairEssence"]["text"]:
            raise RuntimeError("PUBLIC_PRIVATE_FREE_TEXT_DIVERGED "+relative)
        new_source=replace_string(old_source,old_public_text,clean(old_public_text,relative),relative)
        if json.loads(new_source)["blocks"]["pairEssence"]["text"]!=verified["blocks"]["pairEssence"]["text"]:
            raise RuntimeError("PUBLIC_PRIVATE_PATCH_DIVERGED "+relative)
        actual_public=read(public+relative)
        if actual_public!=old_source:raise RuntimeError("PUBLIC_LIVE_VERSION_CONFLICT_ABORT "+relative)
        targets[public+relative]=(actual_public,new_source)
        local_files[relative]=new_source
    assert repaired_count==12 and len(changes)==3 and len(targets)==6
    patched_live_manifest=amend_manifest(old_live_manifest,changes)
    patched_git_manifest=amend_manifest(old_git_manifest,changes)
    targets[remote_manifest_path]=(old_live_manifest,patched_live_manifest)
    local_files[manifest_name]=patched_git_manifest
    assert len(targets)==7 and len(local_files)==4
    print("PREFLIGHT_OK damaged_tails=12 banks=3 other_banks_untouched=true purchased_texts_not_public=true",flush=True)
    stamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
    backups=home+"/site-safeguard-backups/compat-questionmarks-"+stamp+"-"+os.environ.get("GITHUB_RUN_ID","manual")
    f.mkd(backups)
    for index,(path,(before,after)) in enumerate(targets.items()):
        name=f"{index:02d}.bak"
        put(backups+"/"+name,before)
    print("SEVEN_ORIGINAL_FILES_BACKED_UP_AND_VERIFIED "+backups.rsplit("/",1)[-1],flush=True)
    changed_paths=[]
    try:
        for path,(before,after) in targets.items():
            if read(path)!=before:raise RuntimeError("PRODUCTION_CHANGED_DURING_RELEASE_ABORT "+path)
            put(path,after)
            changed_paths.append(path)
        for path,(_,after) in targets.items():
            if read(path)!=after:raise RuntimeError("FINAL_READBACK_MISMATCH "+path)
        for path,value in local_files.items():
            pathlib.Path(path).write_bytes(value)
        names=sorted(local_files)
        subprocess.run(["git","config","user.name","github-actions[bot]"],check=True)
        subprocess.run(["git","config","user.email","41898282+github-actions[bot]@users.noreply.github.com"],check=True)
        subprocess.run(["git","add",*names],check=True)
        diff=subprocess.check_output(["git","diff","--cached","--name-only"],text=True).splitlines()
        if sorted(diff)!=names:raise RuntimeError("GIT_CHANGE_SCOPE_MISMATCH "+str(diff))
        subprocess.run(["git","commit","-m","Repair 12 corrupted compatibility tails without changing surviving copy"],check=True)
        subprocess.run(["git","push","origin","HEAD:main"],check=True)
        print("REPAIR_DONE 12_DAMAGED_TAILS_REMOVED 3_BANKS_UPDATED PUBLIC_AND_PRIVATE_READBACK_OK HASHES_OK GITHUB_SYNCED",flush=True)
    except BaseException:
        for path in reversed(changed_paths):
            try:
                put(path,targets[path][0])
                print("ROLLBACK_OK "+path.removeprefix(home),flush=True)
            except Exception as ex:
                print("ROLLBACK_FAILED "+path.removeprefix(home)+" "+type(ex).__name__,flush=True)
        raise
    finally:
        try:f.quit()
        except BaseException:f.close()
if __name__=="__main__":main()
