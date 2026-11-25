import ftplib,io,os,pathlib,ssl,subprocess,urllib.request,urllib.error,time,json,hashlib
base="e8b36f0b7a9197a52e84aeb59f42367d386b5a3a"
files=["redflag-feature.js","app.js","index.html"]
rules=json.loads("{\"redflag-feature.js\":[{\"a\":\"let ownerDraftAccess=false,ownerDraftAccessChecked=false;\",\"b\":\"let ownerDraftAccess=false,ownerDraftAccessChecked=false;\\nlet ownerDraftCheckEpoch=0,ownerDraftCheckPending=null;\"},{\"a\":\"async function verifyOwnerDraftAccess(){\\n  if(ownerDraftAccessChecked)return;\\n  ownerDraftAccessChecked=true;\\n  try{\\n    const response=await fetch(\\\"/redflag-ai-lab/style-test-api.php\\\",{\\n      method:\\\"GET\\\",credentials:\\\"same-origin\\\",cache:\\\"no-store\\\",\\n      headers:{\\\"Accept\\\":\\\"application/json\\\"}\\n    });\\n    if(!response.ok)return;\\n    const data=await response.json();\\n    if(data?.ok!==true||data?.owner!==true||data?.draft_only!==true)return;\\n    ownerDraftAccess=true;\\n    if(redFlag.classList.contains(\\\"is-active\\\"))renderCategories();\\n  }catch(_){/* Unverified users never see draft generation. */}\\n}\",\"b\":\"async function verifyOwnerDraftAccess({retry=false}={}){\\n  if(ownerDraftCheckPending)return ownerDraftCheckPending;\\n  if(ownerDraftAccessChecked&&(!retry||ownerDraftAccess))return ownerDraftAccess;\\n  ownerDraftAccessChecked=true;\\n  const epoch=ownerDraftCheckEpoch;\\n  const task=(async()=>{\\n    try{\\n      const response=await fetch(\\\"/redflag-ai-lab/style-test-api.php\\\",{\\n        method:\\\"GET\\\",credentials:\\\"same-origin\\\",cache:\\\"no-store\\\",\\n        headers:{\\\"Accept\\\":\\\"application/json\\\"},signal:AbortSignal.timeout(15000)\\n      });\\n      if(epoch!==ownerDraftCheckEpoch)return false;\\n      if(!response.ok)return false;\\n      const data=await response.json();\\n      if(epoch!==ownerDraftCheckEpoch||data?.ok!==true||data?.owner!==true||data?.draft_only!==true)return false;\\n      const wasOwner=ownerDraftAccess;\\n      ownerDraftAccess=true;\\n      if(!wasOwner){\\n        const love=categoryStates.get(\\\"love\\\");\\n        if(love){\\n          for(const [id,response] of love.answers)\\n            if(!response?.isDraft)love.answers.delete(id);\\n          love.answerErrors.clear();\\n        }\\n      }\\n      if(redFlag.classList.contains(\\\"is-active\\\"))renderCategories();\\n      return true;\\n    }catch(_){return false;/* Unverified users never see draft generation. */}\\n  })();\\n  ownerDraftCheckPending=task;\\n  try{return await task;}\\n  finally{if(ownerDraftCheckPending===task)ownerDraftCheckPending=null;}\\n}\"},{\"a\":\"  ownerDraftAccess=false;ownerDraftAccessChecked=false;\\n  for(const state of categoryStates.values()){\",\"b\":\"  ownerDraftAccess=false;ownerDraftAccessChecked=false;\\n  ownerDraftCheckEpoch++;ownerDraftCheckPending=null;\\n  for(const state of categoryStates.values()){\"},{\"a\":\"    if (opening) ensureQuestions(category);\",\"b\":\"    if (opening) {\\n      if(category.id===\\\"love\\\"&&!ownerDraftAccess)void verifyOwnerDraftAccess({retry:true});\\n      ensureQuestions(category);\\n    }\"},{\"a\":\"  void verifyOwnerDraftAccess();\\n\\n  // A broadcast deep link\",\"b\":\"  void verifyOwnerDraftAccess({retry:true});\\n\\n  // A broadcast deep link\"},{\"a\":\"      text.textContent=response.answer;\\n      text.style.whiteSpace=\\\"pre-wrap\\\";\\n      answer.append(note,text);\",\"b\":\"      text.textContent=response.answer;\\n      text.style.whiteSpace=\\\"pre-wrap\\\";\\n      if(question.id===\\\"first-step\\\"&&state===categoryStates.get(\\\"love\\\")){\\n        const match=/^(.*?)\\\\s*\\\\nШуточный вердикт:\\\\s*([^\\\\n]+)\\\\n\\\\s*\\\\n([\\\\s\\\\S]+)$/s.exec(response.answer);\\n        if(match){\\n          text.textContent=match[1].trim();\\n          const joke=document.createElement(\\\"p\\\");\\n          const bold=document.createElement(\\\"strong\\\");\\n          bold.textContent=\\\"Шуточный вердикт: \\\"+match[2].trim();\\n          joke.append(bold);\\n          const follow=document.createElement(\\\"p\\\");\\n          follow.textContent=match[3].trim();\\n          answer.append(note,text,joke,follow);\\n        }else answer.append(note,text);\\n      }else answer.append(note,text);\"},{\"a\":\"    ${paragraphs.map((paragraph) => `<p>${escapeMarkup(paragraph)}</p>`).join(\\\"\\\")}\",\"b\":\"    ${paragraphs.map((paragraph,index) => {\\n      if(index===0&&question.id===\\\"first-step\\\"&&state===categoryStates.get(\\\"love\\\")){\\n        const match=/^(.*?)\\\\s*\\\\nШуточный вердикт:\\\\s*([^\\\\n]+)$/s.exec(paragraph);\\n        if(match)return `<p>${escapeMarkup(match[1].trim())}</p><p><strong>Шуточный вердикт: ${escapeMarkup(match[2].trim())}</strong></p>`;\\n      }\\n      return `<p>${escapeMarkup(paragraph)}</p>`;\\n    }).join(\\\"\\\")}\"}],\"app.js\":[{\"a\":\"./redflag-feature.js?v=redflag-sales-20261125\",\"b\":\"./redflag-feature.js?v=love-humor-ui-20261125\"}],\"index.html\":[{\"a\":\"app.js?v=redflag-sales-20261125\",\"b\":\"app.js?v=love-humor-ui-20261125\"}]}")
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files}
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
 for r in rules[p]:
  assert old[p].decode().count(r['a'])==1,'REPO_ANCHOR'
 assert all(r['b'] in new[p].decode() for r in rules[p]),'REPO_PATCH'
protected=['account-service/private/love-practical-engine.php','account-service/private/love-practical-knowledge.txt','account-service/private/love-live.php','account-service/private/love-first-step-humor.php','account-service/private/love-first-step-humor.json','account-service/private/core.php','redflag-ai-lab/style-test-api.php','redflag-ai-lab/love-owner-preview-api.php','account-service/private/wallet-real-payment.php','account-service/public/numi-love-free.php']
for p in protected:assert pathlib.Path(p).read_bytes()==subprocess.check_output(['git','show',base+':'+p]),p
def get(p):
 req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p,headers={'Cache-Control':'no-cache'})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,b''
def health():
 codes=[get(x)[0] for x in ['', 'redflag-ai-lab/style-test-api.php','redflag-ai-lab/love-owner-preview-api.php','api/numi-love-free.php']]
 assert codes[:3]==[200,403,403] and codes[3] in (400,401,403,405),codes
 print('SITE_HEALTH',codes,flush=True)
health()
with ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45) as f:
 f.connect('server172.hosting.reg.ru',21);f.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);f.prot_p()
 home=f.pwd().rstrip('/');private=home+'/private/numi-account-20261031/';web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
 def remote(p):
  if p.startswith('account-service/private/'):return private+p.rsplit('/',1)[-1]
  if p.startswith('account-service/public/'):return web+'api/'+p.rsplit('/',1)[-1]
  return web+p
 def read(p):
  b=io.BytesIO();f.retrbinary('RETR '+p,b.write);return b.getvalue()
 def write(p,b):
  f.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b
 before={p:read(remote(p)) for p in files}
 hashes={p:hashlib.sha256(read(remote(p))).digest() for p in protected}
 for p in files:
  if before[p] not in (old[p],new[p]):
   actual=before[p].decode()
   for r in rules[p]:
    if actual.count(r['b'])==1:continue
    assert actual.count(r['a'])==1,'LIVE_ANCHOR_'+p
    actual=actual.replace(r['a'],r['b'])
   new[p]=actual.encode()
  if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new[p],check=True)
 backup=home+'/site-safeguard-backups'
 try:f.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:write(backup+'/before-love-humor-ui-'+tag+'-'+p,before[p])
 changed=[]
 try:
  for p in files:
   assert read(remote(p))==before[p],'CONCURRENT_CHANGE'
   if before[p]!=new[p]:
    changed.append(p);write(remote(p),new[p])
  for p in files:assert read(remote(p))==new[p]
  for p,v in hashes.items():assert hashlib.sha256(read(remote(p))).digest()==v,'PROTECTED_CHANGE'
  health()
  for p in files:
   url='?check='+tag if p=='index.html' else p+'?v=love-humor-ui-20261125&check='+tag
   code,data=get(url)
   assert code==200,'HTTP_'+p
   marker='app.js?v=love-humor-ui-20261125' if p=='index.html' else ('redflag-feature.js?v=love-humor-ui-20261125' if p=='app.js' else 'ownerDraftCheckEpoch')
   assert marker.encode() in data,'LIVE_HTTP_MARKER_'+p
 except BaseException:
  for p in reversed(changed):write(remote(p),before[p])
  raise
 print('LOVE_HUMOR_UI_LIVE refreshed browser assets; server authorization retained; all engines and payments unchanged; model calls 0',flush=True)
