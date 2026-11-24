import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib,json,tempfile
base='909755b81a958dcca9d95abeec67385e4e0be4fb'
files=json.loads("[\"account-service/private/verdict-owner-knowledge-v1.txt\",\"account-service/private/verdict-live.php\"]")
rules=json.loads("{\"account-service/private/verdict-owner-knowledge-v1.txt\":[[\"5|Любознательный наставник, ценит знания, убеждения, семейные традиции; в тени догматизм|Подойдёт при совпадении представлений о браке, воспитании детей и жизненных ценностях|Следует собственной морали даже без свидетелей или использует её ради удобных оправданий|Сравнивает ли тебя с родителями, способен ли строить собственную семью без их вмешательства|Не путать эрудицию с жизненной мудростью; проверять, применимы ли его советы к твоей ситуации|Интеллектуальный интерес, уважение его опыта, возможность делиться знаниями и обсуждать идеи|Чрезмерная привязанность к родителям, сравнение с матерью, навязывание традиций родительской семьи|Помогает освоить новое, объясняет сложное, делится опытом и поддерживает обучение|Создание собственной семьи, общие ритуалы и ценности, совместное развитие, свобода убеждений|Стыдит тебя за личные убеждения, выбор или образ жизни, прикрываясь моралью и традициями\",\"5|Любознательный наставник, ценит знания, убеждения, семейные традиции; в тени догматизм|Подойдёт при совпадении представлений о браке, воспитании детей и жизненных ценностях|Следует собственной морали даже без свидетелей или использует её ради удобных оправданий|Сравнивает ли тебя с родителями, способен ли строить собственную семью без их вмешательства|Не путать эрудицию с жизненной мудростью; проверять, применимы ли его советы к твоей ситуации|Интеллектуальный интерес, уважение его опыта, возможность делиться знаниями и обсуждать идеи|Чрезмерная привязанность к родителям, сравнение с матерью, навязывание традиций родительской семьи|Помогает освоить новое, объясняет сложное, делится опытом и поддерживает обучение|Создание собственной семьи, общие ритуалы и ценности, совместное развитие, свобода убеждений|Традиции родительской семьи важнее твоих желаний; забывает, что ты тоже член новой семьи\"],[\"6|Романтичный, сердечный, ориентирован на близкие отношения; многое решает через чувства|Подойдёт женщине, которая хочет душевно близкую пару, а не формальный союз для удобства|Способен принять любимую со слабостями и недостатками, не превращая её в идеальный образ|Делает ли ясный выбор в пользу отношений, готов ли обсуждать конкретное совместное будущее|Не жертвовать собой ради сохранения любви; говорить о желаниях, а не заслуживать чувства|Телесная нежность, душевное тепло, взаимное желание быть вместе и ощущение, что его любят|Метания между симпатиями, болезненная потребность быть любимым, поиск близости при её нехватке|Романтические сюрпризы, ласка, эмоциональное участие, умение создавать атмосферу влюблённости|Семейное тепло, общие заботы и привычки, искреннее внимание к эмоциональной жизни друг друга|Оставляет тебя в любовном треугольнике и отказывается определиться, несмотря на твои страдания\",\"6|Тёплый, романтичный, семейный мужчина; способен быть любящим мужем и заботливым отцом|Подойдёт женщине, которая хочет душевно близкую пару, а не формальный союз для удобства|Способен принять любимую со слабостями и недостатками, не превращая её в идеальный образ|Делает ли ясный выбор в пользу отношений, готов ли обсуждать конкретное совместное будущее|Не жертвовать собой ради сохранения любви; говорить о желаниях, а не заслуживать чувства|Нежность, телесный контакт, разговоры по душам, личное время и ощущение, что его любят|Болезненная потребность в любви; при отчуждении может искать душевное и телесное тепло на стороне|Романтические сюрпризы, ласка, эмоциональное участие, умение создавать атмосферу влюблённости|Семейное тепло, общие заботы и привычки, искреннее внимание к эмоциональной жизни друг друга|Твои потребности в нежности и близости намного меньше его; постоянный запрос на любовь утомляет\"],[\"8|Чувство справедливости, принципиальность, логика, стремление к равновесию и честному обмену|Подойдёт женщине, ценящей предсказуемые обязательства и конкретику вместо неоднозначных намёков|Одинаково ли строг к своим поступкам и чужим, способен ли признать несправедливость с его стороны|Исправляет ли причинённый ущерб, возвращает ли долги и выполняет невыгодные ему обязательства|Не превращать конфликт в судебное разбирательство; не искать виноватого вместо решения|Честность, прозрачность намерений, признание его вклада и соблюдение взаимных договорённостей|Злопамятность, подсчёт чужих ошибок и заслуг, желание наказать за нарушение его представлений|Отстаивает твои интересы, способен объективно рассудить спор и добиться честного решения|Понятные правила финансов и быта, при этом добровольная забота без расчёта каждой услуги|Любую помощь предъявляет как долг, которым оправдывает требования и ограничение твоей свободы\",\"8|Чувство справедливости, логика, гибкий ум, честный обмен; в минусе всему ведёт счёт|Подойдёт женщине, готовой вместе расти, развиваться, вкладываться и учитывать взаимный вклад|Справедливый, надёжный, рассудительный; способен ли признавать ошибки и искренне извиняться|Возвращает ли долги, выполняет ли обязательства, соответствует ли видимое благополучие доходам|Не выбирать его из-за материальных благ; болезненно воспринимает меркантильность в отношениях|Честность, признание его вклада; женщина тоже развивается и вносит посильный вклад в семью|Злопамятность, подсчёт расходов и заслуг, показное богатство при долгах и кредитах|Гибкий ум, финансовые способности, умение добиваться успеха и достойного положения|Общий бюджет без подсчёта каждой копейки; любовь не зависит от зарплаты и достижений|Мерит твою ценность зарплатой и успехами, помнит каждый подарок и предъявляет помощь как долг\"],[\"18|Эмоционально вовлекается, тревожится, додумывает|При ясности и разговоре о страхах|Чуткость соседствует с подозрительностью|Спрашивает ли вместо обвинений|Не отвечать за каждое его настроение|Определённость, эмоциональная безопасность|Накручивает себя, обижается, избегает решений|Сопереживает, замечает настроение|Тёплый союз с прямым разговором|Если подозрения и обиды управляют твоей жизнью\",\"18|Воображение, тонкое восприятие скрытого, загадочность; в минусе двуличие и самообман|Подойдёт женщине, ценящей эмоциональную глубину и необычный взгляд на мир, но не туман в отношениях|Замечает тёмные стороны людей и помогает разобраться в них или использует это ради выгоды|Совпадают ли его версии событий с фактами, особенно когда выгодно скрыть неудобную правду|Не принимать красивый образ и убедительные объяснения за действительность; проверять факты|Душевная безопасность, принятие его чувствительности, возможность делиться страхами и фантазиями|Хитрость, скрытые мотивы, двуличие, страхи и способность запутать другого в иллюзиях|Богатое воображение, необычные впечатления, понимание переживаний, трудных для слов|Эмоциональная глубина, творчество, ясные договорённости и свобода говорить о неприятном|Систематически искажает факты, скрывает важное и заставляет тебя сомневаться в очевидном\"],[\"19|Яркий, любит признание, ждёт материнской опеки|При взаимном внимании и ответственности|Обаяние не исключает инфантильности|Помогает ли без зрителей и похвалы|Не становиться мамой и группой поддержки|Искреннее внимание без поклонения|Обижается при критике, ждёт обслуживания|Щедро одаривает вниманием, создаёт праздник|Тёплый союз без роли мамы|Если всё вращается вокруг него\",\"19|Жизнерадостный, яркий, щедрый на внимание и энергию; в минусе чрезмерно заполняет собой всё вокруг|Подойдёт женщине, которой нравятся активное общение, открытые чувства и насыщенная жизнь|Делится успехом и теплом с людьми или стремится быть единственным источником радости и признания|Замечает ли, когда помощь не нужна, способен ли услышать просьбу оставить в покое|Не чувствовать себя обязанной принимать всю его заботу; говорить, когда внимания слишком много|Возможность проявлять щедрость, открыто радоваться успехам, получать искреннюю благодарность|Избыточная опека, навязчивое участие во всём, жажда внимания, эмоциональное истощение близких|Заряжает радостью, объединяет людей, устраивает праздники, делится достижениями и теплом|Открытость, семейная радость, общие праздники и достаточно времени для спокойной личной жизни|Его добрые намерения становятся оправданием постоянного вмешательства во все сферы твоей жизни\"]],\"account-service/private/verdict-live.php\":[[\"        if(array_intersect($points,[1,2,3,5]))$suffix='-verdict-author-refinement-v6.json';\",\"        if(array_intersect($points,[5,6,8,18,19]))$suffix='-verdict-author-refinement-v7.json';\\n        elseif(array_intersect($points,[1,2,3,5]))$suffix='-verdict-author-refinement-v6.json';\"]]}")
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
assert [i for i,(x,y) in enumerate(zip(a,b)) if x!=y]==[5,6,8,18,19],'UNRELATED_ENERGY_CHANGED'
assert all(a[i]==b[i] for i in range(23) if i not in (5,6,8,18,19))
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
foreach(array_merge(range(1,10),[18,19]) as $n)foreach($kb[$n] as $value)if(mb_strlen($value,'UTF-8')>100)throw new RuntimeException('LENGTH');
foreach([[31,10,1988],[4,4,1986],[9,9,1986],[15,7,1987],[6,6,1996],[7,7,1997],[8,8,1988],[10,10,1990],[11,11,1999]] as [$d,$m,$y]){
 $date=sprintf('%04d-%02d-%02d',$y,$m,$d);
 $matrix=ni31($d,$m,$y);$suffix='-verdict-v1.json';
 $points=array_map(static fn($point)=>$matrix[$point],vpPointMap('final'));
 if(array_intersect($points,[5,6,8,18,19]))$suffix='-verdict-author-refinement-v7.json';
 elseif(array_intersect($points,[1,2,3,5]))$suffix='-verdict-author-refinement-v6.json';
 elseif(array_intersect($points,[6,7,8,9,10]))$suffix='-verdict-distinct-questions-v5.json';
 elseif(in_array(4,$points,true))$suffix='-verdict-energy4-v2.json';
 if(!str_ends_with(nvCacheFile('final',$date),$suffix))throw new RuntimeException('CACHE');
 if(!str_ends_with(nvCacheFile('check',$date),'-verdict-v1.json'))throw new RuntimeException('PAID_CACHE');
}
echo 'VERDICT_AUTHOR_REFINEMENT2_OFFLINE_PASS';
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
  if saved[p]!=new[p]:write(backup+'/before-verdict-author-refinement2-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',saved[p])
 for p in files:
  assert read(remote(p))==saved[p],'CONCURRENT_EDIT'
  if saved[p]!=new[p]:changed.append(p);write(remote(p),new[p])
 assert healthy(),'POST_HEALTH'
 for p in files:assert read(remote(p))==new[p],'FINAL_READBACK'
 for p,h in hashes.items():assert hashlib.sha256(read(p)).digest()==h,'PROTECTED_CHANGED'
 print('VERDICT_AUTHOR_REFINEMENT2_LIVE five_rows_only paid_cache_preserved model_calls=0',flush=True)
except BaseException:
 for p in reversed(changed):
  try:write(remote(p),saved[p]);print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
