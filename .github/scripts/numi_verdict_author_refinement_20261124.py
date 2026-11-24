import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib,json,tempfile
base='cf277cf76d9fca1d19eae14bdae1ee43da099203'
files=json.loads("[\"account-service/private/verdict-owner-knowledge-v1.txt\",\"account-service/private/verdict-live.php\"]")
rules=json.loads("{\"account-service/private/verdict-owner-knowledge-v1.txt\":[[\"1|Первопроходец, амбициозный лидер; в тени самоутверждается за счёт окружающих|Подойдёт женщине, которой комфортно уступать первенство и поддерживать его начинания|Способен ли радоваться чужому таланту и признавать заслуги других людей|Сам воплощает оригинальные идеи или лишь заявляет о своём превосходстве|Не превращать отношения в соревнование; сохранять собственные интересы и достижения|Признание его уникальности, вера в способности, свобода выбора собственных целей|Болезненная реакция на неудачу, высокомерие, унижение других ради доказательства первенства|Изобретательность, находчивость, смелость первым пробовать то, на что другие не решаются|Достаточно пространства для личных проектов и самореализации, взаимный интерес к успехам|Систематически мешает твоему развитию, потому что не выносит твоих успехов\",\"1|Самостоятельный лидер, способен принимать решения; в минусе самоутверждается за счёт других|Подойдёт женщине, которой комфортно уступать первенство и поддерживать его начинания|Уважает ли людей независимо от их статуса, достатка и способностей, признаёт ли чужие заслуги|Добивается поставленных целей или сдаётся при неудаче и обвиняет окружающих|Замечать, уважает ли он тебя или постоянно указывает на твоё место и смотрит свысока|Признание его уникальности, вера в способности, свобода выбора собственных целей|Болезненная реакция на неудачу, высокомерие, унижение других ради доказательства первенства|Находчивость, смелость, инициативность, готовность брать ответственность на себя|Он проявляет лидерство, но у обоих остаются свои интересы, цели и право на самореализацию|Высмеивает твои идеи и достижения, принижает успехи, мешает твоему развитию\"],[\"2|Интуиция, наблюдательность, дипломатичность, тонкое понимание скрытых мотивов людей|Подойдёт ценящей деликатное, постепенное сближение без публичности и громких признаний|Сохраняет порядочность, когда выгоднее промолчать или принять сторону большинства|Хранит ли доверенные ему тайны, не использует ли личную информацию в споре|Спрашивать о намерениях прямо, не строить догадки на основании намёков и полутонов|Такт, конфиденциальность, возможность открываться в собственном темпе, душевное доверие|Двойная игра, скрытое влияние через посредников, интриги вместо открытого разговора|Улавливает твоё настроение, умеет мягко уладить неловкость и примирить людей|Личная жизнь без посторонних глаз, обсуждение чувств наедине, взаимная чуткость|Обнаруживаешь, что он систематически скрывает существенные обстоятельства вашей связи\",\"2|Интуиция, наблюдательность, дипломатичность, тонкое понимание скрытых мотивов людей|Подойдёт женщине, не требующей постоянного внимания и принимающей его потребность побыть в себе|Искренне ли сочувствует людям или использует понимание чужих чувств и слабостей в своих целях|Хранит ли доверенные ему тайны, не использует ли личную информацию в споре|Спрашивать о намерениях прямо, не строить догадки на основании намёков и полутонов|Глубина, разговоры по душам, возможность побыть в себе и открываться без настойчивых расспросов|Двойная игра, чрезмерная закрытость, тайны, интриги и скрытое влияние через других людей|Тонко чувствует людей, замечает настроение, деликатно улаживает неловкость и примиряет|Душевное и чувственное единение, взаимная чуткость, личные разногласия без огласки|За молчаливостью обнаруживаются систематическое враньё, недосказанность и скрытые интриги\"],[\"3|Творческая натура, чувственность, социальная лёгкость, вкус к красивой и комфортной жизни|Подойдёт женщине, ценящей мягкость, общительность и не требующей показной брутальности|Заботится ли о людях, от которых не получает восхищения и внимания|Умеет ли сам организовать бытовой комфорт, когда этим больше никто не занимается|Не подменять любовью материнскую опеку, не обслуживать взрослого мужчину из жалости|Принятие его яркости, мягкости и вкусов, нежность, ощущение собственной привлекательности|Тяга к излишествам, импульсивные траты на удовольствия, зависимость от внешней оценки|Создаёт красоту вокруг, умеет вкусно угостить, придумать красивый досуг и поднять настроение|Творческая свобода, живое общение с друзьями, чувственная близость и уютный общий дом|В трудный период твои нужды игнорируются, чтобы ничто не нарушило его привычный комфорт\",\"3|Мягкий, чувственный, творческий, общительный; в минусе капризный, обидчивый, избегает лидерства|Подойдёт самостоятельной женщине, ценящей мягкость и готовой чаще самой принимать решения|Заботится ли о людях, от которых не получает восхищения и внимания|Умеет ли сам организовать бытовой комфорт, когда этим больше никто не занимается|Не подменять любовью материнскую опеку, не обслуживать взрослого мужчину из жалости|Комплименты, нежность, принятие его мягкости и вкусов, ощущение собственной привлекательности|Тяга к излишествам, импульсивные траты на удовольствия, капризность и обидчивость|Создаёт красоту и уют, умеет вкусно готовить, поднимать настроение, бывает душой компании|Творческая свобода, живое общение с друзьями, чувственная близость и уютный общий дом|Ставит свои капризы выше твоих потребностей и полностью перекладывает на тебя ответственность\"],[\"5|Любознательный наставник, ценит знания, убеждения, семейные традиции; в тени догматизм|Подойдёт при совпадении представлений о браке, воспитании детей и жизненных ценностях|Следует собственной морали даже без свидетелей или использует её ради удобных оправданий|Готов ли изменить мнение, столкнувшись с убедительными фактами и новым опытом|Не путать эрудицию с жизненной мудростью; проверять, применимы ли его советы к твоей ситуации|Интеллектуальный интерес, уважение его опыта, возможность делиться знаниями и обсуждать идеи|Категоричность, назидательность, деление людей на правильных и неправильных|Помогает освоить новое, объясняет сложное, делится опытом и поддерживает обучение|Семейные ритуалы, совместное развитие, свобода убеждений и право задавать вопросы|Стыдит тебя за личные убеждения, выбор или образ жизни, прикрываясь моралью и традициями\",\"5|Любознательный наставник, ценит знания, убеждения, семейные традиции; в тени догматизм|Подойдёт при совпадении представлений о браке, воспитании детей и жизненных ценностях|Следует собственной морали даже без свидетелей или использует её ради удобных оправданий|Сравнивает ли тебя с родителями, способен ли строить собственную семью без их вмешательства|Не путать эрудицию с жизненной мудростью; проверять, применимы ли его советы к твоей ситуации|Интеллектуальный интерес, уважение его опыта, возможность делиться знаниями и обсуждать идеи|Чрезмерная привязанность к родителям, сравнение с матерью, навязывание традиций родительской семьи|Помогает освоить новое, объясняет сложное, делится опытом и поддерживает обучение|Создание собственной семьи, общие ритуалы и ценности, совместное развитие, свобода убеждений|Стыдит тебя за личные убеждения, выбор или образ жизни, прикрываясь моралью и традициями\"]],\"account-service/private/verdict-live.php\":[[\"        if(array_intersect($points,[1,2,3,5,6,7,8,9,10]))$suffix='-verdict-distinct-questions-v5.json';\",\"        if(array_intersect($points,[1,2,3,5]))$suffix='-verdict-author-refinement-v6.json';\\n        elseif(array_intersect($points,[6,7,8,9,10]))$suffix='-verdict-distinct-questions-v5.json';\"]]}")
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
assert a[4]==b[4] and a[6:]==b[6:]
assert len(set(v for row in b[1:] for v in row.split('|')[1:]))==220
assert all(len(b[i].split('|'))==11 for i in range(1,23))
assert len(new['account-service/private/verdict-owner-knowledge-v1.txt'].decode())<=16000

fixture=r"""<?php
require 'account-service/private/verdict-live.php';
function naCatalogDate($s){if(!is_string($s)||!preg_match('/^\d{4}-\d\d-\d\d$/D',$s))return null;[$y,$m,$d]=array_map('intval',explode('-',$s));return checkdate($m,$d,$y)?$s:null;}
$kb=vpKnowledge();$questions=vpQuestions();
if(count($kb)!==22||count($questions)!==10||count($kb[4])!==10)throw new RuntimeException('KB');
foreach($questions as $q){
 $id=$q['id'];
 foreach([[31,10,1988],[4,4,1986],[9,9,1986],[15,7,1987],[6,6,1996],[7,7,1997],[8,8,1988],[10,10,1990],[11,11,1999]] as [$d,$m,$y]){
  $matrix=ni31($d,$m,$y);$points=vpPointMap($id);
  $p=json_decode(vpMessages($q,$d,$m,$y)[1]['content'],true,30,JSON_THROW_ON_ERROR);
  foreach($points as $i=>$point)if($p['четыре_значимые_позиции'][$i]['смысловой_ключ']!==$kb[$matrix[$point]][$id])throw new RuntimeException('KEY');
 }
}
foreach(range(1,10) as $n)foreach($kb[$n] as $value)if(mb_strlen($value,'UTF-8')>100)throw new RuntimeException('LENGTH');
foreach([[31,10,1988],[4,4,1986],[9,9,1986],[15,7,1987],[6,6,1996],[7,7,1997],[8,8,1988],[10,10,1990],[11,11,1999]] as [$d,$m,$y]){
 $date=sprintf('%04d-%02d-%02d',$y,$m,$d);
 $matrix=ni31($d,$m,$y);$suffix='-verdict-v1.json';
 $points=array_map(static fn($point)=>$matrix[$point],vpPointMap('final'));
 if(array_intersect($points,[1,2,3,5]))$suffix='-verdict-author-refinement-v6.json';
 elseif(array_intersect($points,[6,7,8,9,10]))$suffix='-verdict-distinct-questions-v5.json';
 elseif(in_array(4,$points,true))$suffix='-verdict-energy4-v2.json';
 if(!str_ends_with(nvCacheFile('final',$date),$suffix))throw new RuntimeException('CACHE');
 if(!str_ends_with(nvCacheFile('check',$date),'-verdict-v1.json'))throw new RuntimeException('PAID_CACHE');
}
echo 'VERDICT_AUTHOR_REFINEMENT_OFFLINE_PASS';
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
  if saved[p]!=new[p]:write(backup+'/before-verdict-author-refinement-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',saved[p])
 for p in files:
  assert read(remote(p))==saved[p],'CONCURRENT_EDIT'
  if saved[p]!=new[p]:changed.append(p);write(remote(p),new[p])
 assert healthy(),'POST_HEALTH'
 for p in files:assert read(remote(p))==new[p],'FINAL_READBACK'
 for p,h in hashes.items():assert hashlib.sha256(read(p)).digest()==h,'PROTECTED_CHANGED'
 print('VERDICT_AUTHOR_REFINEMENT_LIVE four_rows_only paid_cache_preserved model_calls=0',flush=True)
except BaseException:
 for p in reversed(changed):
  try:write(remote(p),saved[p]);print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
