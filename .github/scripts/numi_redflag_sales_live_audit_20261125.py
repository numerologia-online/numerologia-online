import ftplib,ssl,io,os,json,re,hashlib,urllib.request,urllib.error,concurrent.futures,time
origin='https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai'
legacy='https://xn--c1adkkdfjbp1a4l.online'
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=35)
ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/');priv=home+'/private/numi-account-20261031/';web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
def read(p):
 b=io.BytesIO();ftp.retrbinary('RETR '+p,b.write);return b.getvalue()
try:
 cat=json.loads(read(priv+'redflag-catalog.json'))['questions']
 manifest=json.loads(read(priv+'store-assets.json'))['files']
 valid=0
 for q,m in cat['money'].items():
  if m['free']:continue
  path='data/redflag/money/'+('comic-verdict' if q=='comic-verdict-money' else q)+'.json'
  blob=read(priv+'store-content/'+path)
  bank=json.loads(blob.decode('utf-8-sig'))
  assert hashlib.sha256(blob).hexdigest()==manifest[path] and bank['status'] in ('ready','complete') and len(bank['entries'])==366,'STATIC_MONEY_'+q
  valid+=1
 print('PRIVATE_MONEY_BANKS_VERIFIED',valid,flush=True)
 cfg=read(home+'/private/numi-wallet-live/config.local.php').decode()
 flags=['real_wallet_enabled','fiscalization_verified','refunds_verified','advance_offset_receipts_verified','offset_receipt_worker_verified','launch_approved']
 def enabled(n):return re.search(r"['\"]"+n+r"['\"]\s*=>\s*true\b",cfg) is not None
 live=re.search(r"['\"]wallet_mode['\"]\s*=>\s*['\"]live['\"]",cfg) is not None
 provider=re.search(r"['\"]provider_test_mode['\"]\s*=>\s*false\b",cfg) is not None
 print('LIVE_WALLET_CONFIG_FLAGS',live,provider,{n:enabled(n) for n in flags},flush=True)
 assert live and provider and all(enabled(n) for n in flags),'WALLET_GATE_NOT_CONFIRMED'
 # Do not print the configuration, keys, bank text or any customer data.
finally:ftp.quit()
def request(host,path,body=None,site_origin=None):
 headers={'Cache-Control':'no-cache','User-Agent':'NUMI-READONLY-RELEASE-AUDIT/1.0'}
 if body is not None:headers['Content-Type']='application/json'
 if site_origin:headers['Origin']=site_origin
 req=urllib.request.Request(host+'/'+path,data=None if body is None else json.dumps(body,ensure_ascii=False).encode(),headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=15) as r:return r.status,r.read(2000000)
 except urllib.error.HTTPError as e:return e.code,e.read(200000)
def check_path(x):
 host,path=x
 try:
  code,raw=request(host,path)
  if code==200:
   try:
    data=json.loads(raw)
    if isinstance(data,dict) and ('entries' in data or 'arcana' in data or 'questions' in data or 'answer' in data):
     return host,path,'PUBLIC_JSON_CONTENT'
   except (ValueError,UnicodeError):pass
  return host,path,code
 except Exception as e:return host,path,'NETWORK_'+type(e).__name__
paid=[(c,q) for c,qs in cat.items() for q,m in qs.items() if not m['free']]
paths=['data/redflag/'+c+'/'+('comic-verdict' if q=='comic-verdict-money' else q)+'.json' for c,q in paid]
paths+=['data/redflag/banks/'+('money-questions' if c=='money' else c)+'.json' for c in cat]
paths+=['redflag-ai-lab/intimacy-knowledge-v1.json','redflag-ai-lab/infidelity-knowledge-v1.json','redflag-ai-lab/banks/unified-question-answers-v1.json']
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as e:
 checks=list(e.map(check_path,[(host,p) for host in (origin,legacy) for p in paths]))
exposed=[(h,p,s) for h,p,s in checks if s=='PUBLIC_JSON_CONTENT']
errors=[(h,p,s) for h,p,s in checks if isinstance(s,str) and s.startswith('NETWORK_')]
print('PUBLIC_DIRECT_CONTENT_CHECKS',len(checks),'exposed',len(exposed),'network_errors',len(errors),flush=True)
for e in exposed+errors:print('CHECK_CANDIDATE',*e,flush=True)
# Ticket lifecycle, using synthetic data only. No bot send or customer record.
report='🚩 Мужчина или Red Flag\n'+('Техническая проверка ссылки для сохранения. Без персональных данных. '*4)
code,b=request(origin,'api/redflag-save.php',{'action':'create','text':report},origin)
data=json.loads(b);ticket=data.get('ticket','')
assert code==200 and data.get('ok') is True and re.fullmatch(r'r_[A-Za-z0-9_-]{32}',ticket),'TICKET_CREATE_FAILED'
try:
 code,b=request(legacy,'api/redflag-save.php',{'action':'read','ticket':ticket})
 assert code==200 and json.loads(b).get('text')==report,'TICKET_READ_FAILED'
finally:
 code,b=request(legacy,'api/redflag-save.php',{'action':'consume','ticket':ticket})
 assert code==200 and json.loads(b).get('ok') is True,'TICKET_CONSUME_FAILED'
code,b=request(legacy,'api/redflag-save.php',{'action':'read','ticket':ticket})
assert code!=200 or json.loads(b).get('ok') is not True,'TICKET_REUSE'
print('LIVE_TICKET_CREATE_READ_CONSUME_PASS no_actual_telegram_message',flush=True)
assert not exposed,'PUBLIC_CONTENT_EXPOSURE'
assert not errors,'INCOMPLETE_NETWORK_AUDIT'
