import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib,json,tempfile
base='f835268f6f65e0f8aa10f569e8f9df9f49677aef'
files=json.loads("[\"account-service/private/verdict-owner-knowledge-v1.txt\",\"account-service/private/verdict-live.php\"]")
rules=json.loads("{\"account-service/private/verdict-owner-knowledge-v1.txt\":[[\"1|Сам решает, может требовать подчинения|При уважении равенства|Уверенность переходит в командование|Принимает ли чужое решение|Не отдавать право решать за двоих|Уважение инициативы без подчинения|Борьба за власть|Берёт инициативу, решает сложное|Два самостоятельных партнёра|Если за несогласие унижает\",\"1|Первопроходец, амбициозный лидер; в тени самоутверждается за счёт окружающих|Подойдёт женщине, которой комфортно уступать первенство и поддерживать его начинания|Подлинная талантливость и уверенность или убеждённость в собственной исключительности|Сам воплощает оригинальные идеи или лишь заявляет о своём превосходстве|Не превращать отношения в соревнование за первенство и не умалять собственных достоинств|Признание его уникальности, вера в способности, свобода выбора собственных целей|Высокомерие, унижение других ради доказательства собственного превосходства|Оригинальные идеи, смелые начинания, способность открывать новые возможности|Свобода самореализации, взаимное признание талантов без борьбы за первенство|Ради собственной значимости систематически принижает твои способности и достижения\"],[\"2|Чуткий, ищет душевную опору, закрывается|При открытом разговоре|Мягкость не гарантирует открытости|Говорит ли о недовольстве|Не угадывать молчаливые обиды|Доверие, душевное участие|Молчаливое сопротивление|Слышит переживания, замечает мелочи|Тёплый союз с прямым разговором|Если молчание заменяет попытки договориться\",\"2|Дипломатичность, тонкое понимание людей, наблюдательность; в тени двуличие и скрытность|Подойдёт ценящей душевную тонкость, такт и неспешное сближение без лишней огласки|Искреннее миролюбие или умение нравиться всем, скрывая собственные намерения|Одинаково ли говорит о тебе наедине и при других, хранит ли доверенное|Не принимать тонкое понимание твоих чувств за доказательство искренности его намерений|Деликатность, конфиденциальность, доверие, возможность открываться без давления|Двойная игра, недоговорённости, умение незаметно влиять через чужие чувства и мнения|Тонко чувствует настроение, мирит людей, понимает без длинных объяснений|Душевная близость, тактичность, личные тайны без двойной жизни и интриг|Скрывает важную информацию, говорит разным людям противоположное, разрушает доверие\"],[\"3|Общительный, любит внимание, ждёт обслуживания|Если сам вкладывается|Обаяние не равно ответственности|Делает ли сам обещанное|Не становиться обслуживающей мамой|Живой интерес, общение, взаимность|Капризы, ожидание чужой заботы|Веселье, знаки внимания|Лёгкий равноправный союз|Если все обязанности на женщине\",\"3|Чувственность, общительность, творчество, любовь к красоте и комфорту; ранимое самолюбие|Подойдёт ценящей мягкость, живое общение, чувственность и удовольствие от совместной жизни|Душевная щедрость и забота или привлекательная подача себя ради чужого внимания|Создаёт ли приятную жизнь для обоих или ждёт, что его будут баловать|Не требовать показной брутальности, но отличать мягкость от бытовой беспомощности|Принятие его яркости, мягкости и вкусов, нежность, ощущение собственной привлекательности|Тщеславие, зависимость от внимания и удовольствий, нежелание выходить из зоны комфорта|Тепло, красивое ухаживание, вкус к жизни, забота о комфорте, весёлые впечатления|Чувственная близость, творческая свобода, общее удовольствие и забота друг о друге|Твои силы и ресурсы уходят на его комфорт, а твои желания постоянно остаются без внимания\"],[\"5|Ценит семью и принципы, оглядывается на родителей|При общих ценностях и самостоятельности|Традиционность не исключает зависимости от мамы|Кто решает при споре с родителями|Договориться о границах с родными|Общие ценности, традиции|Поучения, сравнение с родителями|Знакомит с близкими, держит слово из принципа|Семья с собственными правилами пары|Если мнение родных всегда важнее твоего\",\"5|Любознательный наставник, ценит знания, убеждения, семейные традиции; в тени догматизм|Подойдёт женщине, с которой совпадают жизненные принципы и интересно обсуждать новое|Живёт согласно своим убеждениям или прикрывает нравоучениями собственные двойные стандарты|Соблюдает ли сам принципы, которым учит других, способен ли признать новое знание|Не принимать его эрудицию и уверенный тон за безусловную правоту|Уважение его знаний и убеждений, интеллектуальный интерес, значимые общие традиции|Категоричность, морализаторство, осуждение чужих взглядов и навязывание единственной истины|Делится знаниями, помогает развиваться, передаёт опыт, создаёт значимые семейные традиции|Общие ценности, интеллектуальное развитие, право обоих пересматривать убеждения|Твои взгляды объявляются неправильными, а отношения превращаются в постоянный экзамен\"]],\"account-service/private/verdict-live.php\":[[\"    // Refresh only free answers whose selected matrix positions include energy 4.\",\"    // Refresh free answers only when a revised energy occurs in the selected positions.\"],[\"        foreach(vpPointMap($id) as $point)if($matrix[$point]===4){$suffix='-verdict-energy4-v2.json';break;}\",\"        foreach(vpPointMap($id) as $point){\\n            if(in_array($matrix[$point],[1,2,3,5],true)){$suffix='-verdict-energies1to5-v3.json';break;}\\n            if($matrix[$point]===4)$suffix='-verdict-energy4-v2.json';\\n        }\"]]}")
new={p:pathlib.Path(p).read_bytes() for p in files}
old={p:subprocess.check_output(['git','show',base+':'+p]) for p in files}
def lint(p,b):
 if p.endswith('.php'):
  with tempfile.NamedTemporaryFile(suffix='.php') as f:
   f.write(b);f.flush();subprocess.run(['php','-l',f.name],check=True)
 if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=b,check=True)
 if p.endswith('.json'):json.loads(b)
for p,b in new.items():lint(p,b)
a=old['account-service/private/verdict-owner-knowledge-v1.txt'].decode().splitlines()
b=new['account-service/private/verdict-owner-knowledge-v1.txt'].decode().splitlines()
assert len(a)==len(b)==23
assert [i for i,(x,y) in enumerate(zip(a,b)) if x!=y]==[1,2,3,5],'UNRELATED_ENERGY_CHANGED'
assert a[4]==b[4]
assert all(len(b[i].split('|'))==11 for i in range(1,23))
assert len(new['account-service/private/verdict-owner-knowledge-v1.txt'].decode())<=16000

fixture=r"""<?php
require 'account-service/private/verdict-live.php';
function naCatalogDate($s){if(!is_string($s)||!preg_match('/^\d{4}-\d\d-\d\d$/D',$s))return null;[$y,$m,$d]=array_map('intval',explode('-',$s));return checkdate($m,$d,$y)?$s:null;}
$kb=vpKnowledge();$questions=vpQuestions();
if(count($kb)!==22||count($questions)!==10||count($kb[4])!==10)throw new RuntimeException('KB');
foreach($questions as $q){
 $id=$q['id'];
 foreach([[31,10,1988],[4,4,1986],[9,9,1986],[15,7,1987]] as [$d,$m,$y]){
  $matrix=ni31($d,$m,$y);$points=vpPointMap($id);
  $p=json_decode(vpMessages($q,$d,$m,$y)[1]['content'],true,30,JSON_THROW_ON_ERROR);
  foreach($points as $i=>$point)if($p['четыре_значимые_позиции'][$i]['смысловой_ключ']!==$kb[$matrix[$point]][$id])throw new RuntimeException('KEY');
 }
}
foreach([1,2,3,4,5] as $n)foreach($kb[$n] as $value)if(mb_strlen($value,'UTF-8')>100)throw new RuntimeException('LENGTH');
foreach([[31,10,1988],[4,4,1986],[9,9,1986],[15,7,1987]] as [$d,$m,$y]){
 $date=sprintf('%04d-%02d-%02d',$y,$m,$d);
 $matrix=ni31($d,$m,$y);$suffix='-verdict-v1.json';
 foreach(vpPointMap('final') as $point){if(in_array($matrix[$point],[1,2,3,5],true)){$suffix='-verdict-energies1to5-v3.json';break;}if($matrix[$point]===4)$suffix='-verdict-energy4-v2.json';}
 if(!str_ends_with(nvCacheFile('final',$date),$suffix))throw new RuntimeException('CACHE');
 if(!str_ends_with(nvCacheFile('check',$date),'-verdict-v1.json'))throw new RuntimeException('PAID_CACHE');
}
echo 'VERDICT_ENERGIES1TO5_OFFLINE_PASS';
"""
subprocess.run(['php'],input=fixture.encode(),check=True)
def status(p):
 try:
  with urllib.request.urlopen('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+p+'?dignity='+str(time.time_ns()),timeout=25) as r:return r.status
 except urllib.error.HTTPError as e:return e.code
def healthy():
 c=[status(''),status('redflag-ai-lab/verdict-owner-preview-api.php'),status('redflag-ai-lab/love-owner-preview-api.php')]
 print('SITE_HEALTH',c,flush=True)
 return c==[200,403,403]
assert healthy(),'PRE_HEALTH'
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21);ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD']);ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/');private=home+'/private/numi-account-20261031/';web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
def remote(p):return private+p.rsplit('/',1)[-1] if p.startswith('account-service/private/') else web+p
def read(p):
 b=io.BytesIO();ftp.retrbinary('RETR '+p,b.write);return b.getvalue()
def write(p,b):
 ftp.storbinary('STOR '+p,io.BytesIO(b));assert read(p)==b,'READBACK'
saved={};changed=[]
try:
 for p in files:
  saved[p]=read(remote(p))
  if saved[p] not in (old[p],new[p]):
   a=saved[p].decode()
   for x,y in rules[p]:
    if a.count(y)==1:continue
    assert a.count(x)==1,'REMOTE_ANCHOR_'+p
    a=a.replace(x,y)
   new[p]=a.encode()
  lint(p,new[p])
 protected=[private+x for x in ['core.php','wallet-real-payment.php','fulfillment.php','redflag-catalog.json','store-assets.json','verdict-practical-engine.php','verdict-owner-questions.json','love-practical-engine.php','love-practical-knowledge.txt','love-live.php','language-live.php','family-live.php','intimacy-live.php']]
 hashes={p:hashlib.sha256(read(p)).digest() for p in protected}
 backup=home+'/site-safeguard-backups'
 try:ftp.mkd(backup)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
 tag=str(time.time_ns())
 for p in files:
  if saved[p]!=new[p]:write(backup+'/before-verdict-energies1to5-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',saved[p])
 for p in files:
  assert read(remote(p))==saved[p],'CONCURRENT_EDIT'
  if saved[p]!=new[p]:changed.append(p);write(remote(p),new[p])
 assert healthy(),'POST_HEALTH'
 for p in files:assert read(remote(p))==new[p],'FINAL_READBACK'
 for p,h in hashes.items():assert hashlib.sha256(read(p)).digest()==h,'PROTECTED_CHANGED'
 print('VERDICT_ENERGIES1TO5_LIVE forty_revised_keys_four_preserved paid_cache_preserved model_calls=0',flush=True)
except BaseException:
 for p in reversed(changed):
  try:write(remote(p),saved[p]);print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
