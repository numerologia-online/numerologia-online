"""Offline fixture: exact preflight, atomic installation, conflict refusal and rollback."""
import hashlib,json,pathlib,subprocess,sys,tempfile,zipfile,os,shutil
archive=pathlib.Path(sys.argv[1]);php=sys.argv[2];repo=pathlib.Path(__file__).resolve().parents[2]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()if p.is_file()else None
def setup(base):
 home=base/'home';site=home/'www/site';package=home/'private/release';site.mkdir(parents=True);package.mkdir(parents=True)
 with zipfile.ZipFile(archive)as z:z.extractall(package)
 manifest=json.loads((package/'release-manifest.json').read_text())
 for item in manifest['files']:
  if item['base_sha256']is None:continue
  p=(home/'private'if item['scope']=='private'else site)/item['target'];p.parent.mkdir(parents=True,exist_ok=True)
  raw=subprocess.check_output(['git','show',manifest['base_commit']+':'+item['source']],cwd=repo)
  if len(sys.argv)>3:
   fixture=pathlib.Path(sys.argv[3])/item['scope']/item['target']
   if fixture.is_file():raw=fixture.read_bytes()
  p.write_bytes(raw);assert sha(p)==item['base_sha256'],item['target']
 return home,site,package,manifest
with tempfile.TemporaryDirectory(prefix='numi-release-test-')as temp:
 root=pathlib.Path(temp);home,site,package,manifest=setup(root/'success')
 args=[php,str(package/'install-store.php'),'--home='+str(home),'--site='+str(site)]
 check=subprocess.run(args,capture_output=True,text=True);assert check.returncode==0,check.stderr;assert 'check-only'in check.stdout
 result=subprocess.run(args+['--apply','--offline-test'],env={**os.environ,'NUMI_INSTALL_TEST':'1'},capture_output=True,text=True);assert result.returncode==0,result.stderr
 for item in manifest['files']:assert sha((home/'private'if item['scope']=='private'else site)/item['target'])==item['sha256']
 conflict=site/'shared-offer.js';conflict.write_text('unknown server change');before=sha(conflict)
 failed=subprocess.run(args,capture_output=True,text=True);assert 'CONFLICT'in failed.stderr;assert sha(conflict)==before
 home,site,package,manifest=setup(root/'rollback')
 args=[php,str(package/'install-store.php'),'--home='+str(home),'--site='+str(site),'--apply','--verify-origin=https://invalid.example']
 result=subprocess.run(args,capture_output=True,text=True);assert 'rolled back'in result.stderr,result.stderr
 for item in manifest['files']:assert sha((home/'private'if item['scope']=='private'else site)/item['target'])==item['base_sha256']
print('PASS release: read-only preflight, 334-file installation, unknown-change refusal and full rollback')
