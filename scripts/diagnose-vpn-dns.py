"""Read-only DNS comparison for the current and former site domains."""
import json, urllib.request, urllib.parse, socket, pathlib, concurrent.futures
names=["xn----8sbhhqijddjgdebdz2c2o.xn--p1ai",
       "www.xn----8sbhhqijddjgdebdz2c2o.xn--p1ai",
       "xn--c1adkkdfjbp1a4l.online","www.xn--c1adkkdfjbp1a4l.online"]
resolvers={"google":"https://dns.google/resolve","cloudflare":"https://cloudflare-dns.com/dns-query"}
results=[]
def check(args):
  hostname,record,resolver,base=args
  url=base+"?"+urllib.parse.urlencode({"name":hostname,"type":record})
  req=urllib.request.Request(url,headers={"accept":"application/dns-json","User-Agent":"NumiDNSReadOnly/1.0"})
  try:
    with urllib.request.urlopen(req,timeout=12) as response: raw=json.load(response)
    return {"name":hostname,"type":record,"resolver":resolver,"status":raw.get("Status"),"answers":[{"type":r.get("type"),"data":r.get("data"),"TTL":r.get("TTL")} for r in raw.get("Answer",[]) if r.get("type") in (1,28,5)]}
  except Exception as e:
    return {"name":hostname,"type":record,"resolver":resolver,"error":type(e).__name__}
tasks=[(name,t,r,url) for name in names for t in ("A","AAAA") for r,url in resolvers.items()]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  results=list(pool.map(check,tasks))
pathlib.Path("diagnostics").mkdir(exist_ok=True)
pathlib.Path("diagnostics/regru-vpn-dns.json").write_text(json.dumps({"check":"Public DNS read-only","results":results},ensure_ascii=False,indent=2)+"\n")
for item in results:print("DNS",json.dumps(item,ensure_ascii=False),flush=True)
