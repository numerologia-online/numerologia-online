"""Build one private, reproducible release archive. Never includes keys or customer data."""
import argparse,hashlib,json,pathlib,subprocess,zipfile,tempfile,shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='f168651149e032a4809b49832d4993b8c7141617'
PUBLIC=['store-entry.js','store-material.js','store-browser.js','store-catalog.json','shared-offer.js','year-feature.js','compatibility-feature.js','redflag-feature.js','destiny-code-feature.js','auth-profile.js','account-browser.js','app.js','assets/numi-school-access-20261103.js','pro/pro.js','pro/index.html','child/child.js','child/index.html','year/index.html','moment/yes-no/yes-no.js','moment/yes-no/index.html','index.html']
PRIVATE=['subscriptions.php','fulfillment.php','store-assets.json','store-renew.php','store.php','core.php']
def sha(data):return hashlib.sha256(data).hexdigest()
def prepare(vault,destination):
 records=[];payload={}
 def add(source,target,scope,new=False):
  raw=source.read_bytes();key=f'{len(records):04d}';payload[key]=raw
  base=None
  if not new:
   relative=source.relative_to(ROOT).as_posix();r=subprocess.run(['git','show',BASE+':'+relative],cwd=ROOT,capture_output=True)
   if r.returncode==0:base=sha(r.stdout)
  records.append({'source':source.relative_to(ROOT).as_posix() if source.is_relative_to(ROOT) else 'private-content/'+target,'scope':scope,'target':target,'payload':key,'sha256':sha(raw),'base_sha256':base})
 for name in PUBLIC[:-1]:add(ROOT/name,name,'public')
 add(ROOT/'yesno-service/public/numi-yesno-answer.php','api/numi-yesno-answer.php','public')
 add(ROOT/'server/school-access/private/gate.php','numi-school-owner-20261103/gate.php','private')
 add(ROOT/'server/school-access/private/offer.html','numi-school-owner-20261103/offer.html','private')
 add(ROOT/'server/school-access/private/allowlist.json','numi-school-owner-20261103/allowlist.json','private')
 assets=json.loads((ROOT/'account-service/private/store-assets.json').read_text())
 for path,digest in assets['files'].items():
  source=vault/path
  if not source.is_file()or sha(source.read_bytes())!=digest:raise RuntimeError('Incomplete or mismatched PRIVATE vault: '+path)
  add(source,'numi-account-20261031/store-content/'+path,'private',True)
 # Install dependencies before the account API entry and homepage.
 for name in PRIVATE:
  if name!='core.php':add(ROOT/'account-service/private'/name,'numi-account-20261031/'+name,'private')
 add(ROOT/'account-service/private/core.php','numi-account-20261031/core.php','private')
 add(ROOT/'index.html','index.html','public')
 manifest={'version':2,'base_commit':BASE,'private_source_commit':assets['private_ref'],'real_payments_enabled':False,'files':records}
 destination.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9)as z:
  z.writestr('release-manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
  z.writestr('install-store.php',(ROOT/'account-service/install-store.php').read_bytes())
  z.writestr('README.md',(ROOT/'docs/store-release-2.md').read_bytes())
  for key,raw in payload.items():z.writestr('payload/'+key,raw)
 print(json.dumps({'archive':str(destination),'files':len(records),'sha256':sha(destination.read_bytes()),'bytes':destination.stat().st_size}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--vault',required=True,type=pathlib.Path);p.add_argument('--out',required=True,type=pathlib.Path);a=p.parse_args();prepare(a.vault.resolve(),a.out.resolve())
