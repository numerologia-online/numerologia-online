"""Read-only REG.RU pre-payment audit: public availability, legal notices, account API, protection markers.
Does not request private report content and does not mutate production.
"""
import ftplib, io, ssl, os, json, time, pathlib, hashlib
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
HOST="server172.hosting.reg.ru"
DOMAIN="xn--c1adkkdfjbp1a4l.online"
LEGAL=["","contacts.html","privacy.html","offer.html","refunds.html","terms.html","disclaimer.html","analytics-settings.html"]
ASSETS=["app.js","auth-profile.js","account-browser.js","service-worker.js","pro/index.html"]
API=["api/profile.php","api/numi-account.php"]
SENSITIVE=[".git/config","site-safeguard-backups/","api/.env","api/config.php"]
def public(path):
    req=Request("https://"+DOMAIN+"/"+path+("?audit="+str(time.time_ns()) if "?" not in path else "&audit="+str(time.time_ns())),headers={"Cache-Control":"no-cache","User-Agent":"NumiReadOnlyAudit/1.0"})
    t=time.monotonic()
    try:
        with urlopen(req,timeout=25) as res:
            body=res.read(1800000)
            return {"path":path,"status":res.status,"bytes":len(body),"mime":res.headers.get("Content-Type",""),"elapsed_ms":int((time.monotonic()-t)*1000),"body":body}
    except HTTPError as exc:
        return {"path":path,"status":exc.code,"elapsed_ms":int((time.monotonic()-t)*1000)}
    except Exception as exc:
        return {"path":path,"error":type(exc).__name__,"elapsed_ms":int((time.monotonic()-t)*1000)}
def without_body(res):
    return {k:v for k,v in res.items() if k!="body"}
def main():
    report={"type":"REG.RU read-only pre-YooKassa audit","pages":[],"assets":[],"api":[],"security_checks":{},"observations":[]}
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=30)
    ftp.connect(HOST,21)
    ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p();ftp.set_pasv(True)
    base=ftp.pwd().rstrip("/")+"/www/"+DOMAIN
    def read(name):
        buff=io.BytesIO()
        try:ftp.retrbinary("RETR "+base+"/"+name,buff.write);return buff.getvalue()
        except ftplib.error_perm as exc:
            if str(exc).startswith("550"):return None
            raise
    try:
        index=read("index.html") or b""
        guard=read(".htaccess") or b""
        report["security_checks"]={
          "paid_static_guard_present":b"NUMI PAID STATIC ACCESS GUARD BEGIN 2026-10-31" in guard,
          "htaccess_present":len(guard)>0,
          "footer_present":b"NUMI PRIVACY FOOTER" in index,
          "cookie_notice_on_live_html":b'id="numi-cookie-notice"' in index,
          "analytics_choice_link":b'href="/analytics-settings.html"' in index,
          "contacts_link":b'href="/contacts.html"' in index,
          "offer_link":b'href="/offer.html"' in index,
          "refunds_link":b'href="/refunds.html"' in index,
          "privacy_link":b'href="/privacy.html"' in index,
          "disclaimer_link":b'href="/disclaimer.html"' in index,
          "telegram_auth_script":b"auth-profile.js" in index,
          "browser_auth_script":b"account-browser.js" in index,
          "main_app_script":b"app.js" in index,
        }
        for path in LEGAL:
            r=public(path)
            page=r.get("body",b"")
            if path=="contacts.html":
                r["has_operator_requisites"]=all(x in page for x in [b"633011166908",b"325632700163022",b"online.numerology.info@yandex.ru"])
            report["pages"].append(without_body(r))
        for path in ASSETS:
            r=public(path)
            ft=read(path)
            if "body" in r and ft is not None:r["http_matches_ftp"]=r["body"]==ft
            report["assets"].append(without_body(r))
        for path in API:
            report["api"].append(without_body(public(path)))
        for path in SENSITIVE:
            r=public(path)
            report["security_checks"]["blocked_"+path]=r.get("status") in [401,403,404,410]
            report["observations"].append(without_body(r))
    finally:
        try:ftp.quit()
        except BaseException:ftp.close()
    pathlib.Path("diagnostics").mkdir(exist_ok=True)
    pathlib.Path("diagnostics/regru-prepayment-audit.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
    print("LEGAL",[(r["path"],r.get("status",r.get("error"))) for r in report["pages"]],flush=True)
    print("GUARDS",report["security_checks"],flush=True)
    print("ASSETS",[(r["path"],r.get("status",r.get("error")),r.get("http_matches_ftp")) for r in report["assets"]],flush=True)
    print("API",[(r["path"],r.get("status",r.get("error"))) for r in report["api"]],flush=True)
if __name__=="__main__":main()
