"""Inventory public source assets for PRIVATE delivery; never publish the output vault."""
import json,pathlib,hashlib,argparse,shutil
root=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--vault',type=pathlib.Path);parser.add_argument('--private-source',type=pathlib.Path);args=parser.parse_args()
paths=set()
for pattern in ['data/year/**/*.txt','data/redflag/money/*.json','data/redflag/love/*.json','knowledge/full-report/sections/*.json','data/compatibility/deep/*.json','child/data/matrix/sections/*.json','child/data/matrix/karmic-tail/*.json']:
 paths.update(p.relative_to(root).as_posix() for p in root.glob(pattern))
paths.add('data/money-rituals.json')
school=json.loads((root/'server/school-access/private/allowlist.json').read_text());paths.update(school)
files={}
for p in sorted(paths):
 source=root/p
 if not source.is_file():continue
 raw=source.read_bytes();files[p]=hashlib.sha256(raw).hexdigest()
 if args.vault:
  target=args.vault/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
raw=(root/'server/school-access/private/allowlist.json').read_bytes();files['school-allowlist.json']=hashlib.sha256(raw).hexdigest()
if args.vault:(args.vault/'school-allowlist.json').write_bytes(raw)
private_files=[]
if args.private_source:
 for source in args.private_source.rglob('*.json'):
  path=source.relative_to(args.private_source).as_posix();raw=source.read_bytes();files[path]=hashlib.sha256(raw).hexdigest();private_files.append(path)
  if args.vault:
   target=args.vault/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
else:
 oldpath=root/'account-service/private/store-assets.json'
 if oldpath.is_file():
  old=json.loads(oldpath.read_text());private_files=old.get('private_files',[])
  for path in private_files:files[path]=old['files'][path]
  if args.vault:raise SystemExit('Private assets required: pass --private-source; refused to build incomplete vault')
(root/'account-service/private/store-assets.json').write_text(json.dumps({'version':2,'private_ref':'e37c5f4ba3b2d3dfc5b6a204f4d99be2246784a9','private_files':sorted(private_files),'files':dict(sorted(files.items()))},ensure_ascii=False,indent=2)+'\n')
print('Inventoried',len(files),'private asset copies; school missing',len(set(school)-set(files)))
