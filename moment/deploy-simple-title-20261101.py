"""One-file guarded publication of the compact 300-questions Moment header."""
import ftplib, hashlib, io, json, os, pathlib, ssl, subprocess, sys, time
from urllib.request import Request, urlopen

HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
OLD_BLOB="fce8e5d09728202f9dbf4680751aa95b78213954"

def sha(x): return hashlib.sha256(x).hexdigest()
def log(**kwargs): print("NUMI_MOMENT_SIMPLIFY "+json.dumps(kwargs,ensure_ascii=False,sort_keys=True),flush=True)

def hero(blob):
    first=b'    <section class="hero">'
    next_section=b'    <section class="shell" aria-label="'
    start=blob.find(first)
    if start<0: raise RuntimeError("Original hero not found")
    end=blob.find(next_section,start)
    if end<0 or end<=start: raise RuntimeError("Next section not found")
    return blob[start:end]

def public():
    url="https://"+DOMAIN+"/moment/index.html?moment_simplify="+str(time.time_ns())
    req=Request(url,headers={"Cache-Control":"no-cache","Pragma":"no-cache",
                             "User-Agent":"numi-moment-verified/1.0"})
    with urlopen(req,timeout=40) as response:
        if response.status!=200: raise RuntimeError("Public site returned unexpected status")
        return response.read(1000000)

def main():
    source=pathlib.Path("moment/index.html").read_bytes()
    baseline=subprocess.check_output(["git","show",OLD_BLOB])
    previous_hero=hero(baseline)
    new_start=b'    <section class="shell" aria-label="300 '
    begin=source.find(new_start)
    end=source.find(b'    <section class="shell" aria-label="',begin+len(new_start))
    if begin<0 or end<0: raise RuntimeError("Simplified heading layout not found")
    new_intro=source[begin:end]
    if (source.count('300 вопросов о жизни'.encode())!=2
        or source.count(b'id="question-search"')!=1
        or source.count(b'id="clear-search"')!=1
        or b'hidden aria-hidden="true"' not in new_intro
        or b'href="./yes-no/"' not in source):
        raise RuntimeError("Source heading or compatibility controls incorrect")
    if b'<div class="hero-stats">' in source or b'<section class="hero">' in source:
        raise RuntimeError("Hero clutter remains in the source")

    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    base=ftp.pwd().rstrip("/")
    destination=base+"/www/"+DOMAIN+"/moment/index.html"
    backup_root=base+"/site-safeguard-backups"
    backup=backup_root+"/moment-simplify-"+time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())

    def read(path):
        output=io.BytesIO()
        ftp.retrbinary("RETR "+path,output.write)
        return output.getvalue()
    def write(path,payload):
        ftp.storbinary("STOR "+path,io.BytesIO(payload))
        if sha(read(path))!=sha(payload): raise RuntimeError("FTPS checksum mismatch")

    changed=False
    try:
        original=read(destination)
        if original.count(previous_hero)==1:
            target=original.replace(previous_hero,new_intro,1)
        elif original.count(new_intro)==1 and original.count(previous_hero)==0:
            target=original
        else:
            raise RuntimeError("Live Moment hero has independent modifications; abort")
        # The exact original page outside the replaced hero must be retained.
        if target.replace(new_intro,previous_hero,1)!=original and target!=original:
            raise RuntimeError("Unexpected unrelated page modification")
        if target.count(b'href="./yes-no/"')!=1:
            raise RuntimeError("Yes/No card missing from live page")
        try:ftp.mkd(backup_root)
        except ftplib.error_perm:pass
        ftp.mkd(backup)
        write(backup+"/moment-index.html.bak",original)
        log(backup_completed=True,homepage_untouched=True,only_moment_index=True)
        try:
            if original!=target:
                write(destination,target)
                changed=True
            if sha(public())!=sha(target):
                raise RuntimeError("Live public Moment HTML differs from release")
            log(success=True,verified=True,removed_hero=True,centered_title=True,
                preserved_yes_no=True,other_sections_unchanged=True)
        except BaseException:
            if changed:
                try:write(destination,original);log(rolled_back=True)
                except BaseException as err:log(rollback_failed=type(err).__name__)
            raise
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()

if __name__=="__main__":
    try:main()
    except BaseException as error:
        log(success=False,reason=str(error)[:260]);sys.exit(1)
