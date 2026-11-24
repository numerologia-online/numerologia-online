import os,io,ssl,ftplib,pathlib,subprocess,time,urllib.request,urllib.error,hashlib,json,tempfile
base='449788e74772fb2a34f04ba267ba016377290a85'
files=json.loads("[\"account-service/private/verdict-owner-knowledge-v1.txt\",\"account-service/private/verdict-live.php\"]")
rules=json.loads("{\"account-service/private/verdict-owner-knowledge-v1.txt\":[[\"6|Тянется к любви, важна взаимность|При общих намерениях и поступках|Романтика не доказывает зрелость|Постоянна ли забота вне красивых моментов|Говорить о потребностях и намерениях|Нежность, серьёзность намерений|Болезненно переживает холодность|Обнимает, строит планы, помогает|Близкий союз с взаимной заботой|Если чувства не превращаются в уважение и участие\",\"6|Душевная близость, романтичность, преданность любимым; в тени идеализация и метания в выборе|Подойдёт женщине, ценящей глубокую взаимную любовь, нежность и совместную семейную жизнь|Любит реальную женщину с её недостатками или влюблён в собственный идеал отношений|Сохраняет ли тепло после периода влюблённости, способен ли сделать однозначный выбор|Не изображать идеальную женщину ради любви; выяснить, способен ли принять тебя настоящую|Душевное тепло, телесная нежность, искренняя взаимность и ощущение, что его выбрали|Зависимость от ощущения любви, разочарование в неидеальном партнёре, поиск новой близости|Любовная романтика, эмоциональная включённость, нежность и ощущение родного человека|Глубокая взаимная привязанность, верность сделанному выбору, принятие несовершенства обоих|Постоянно сравнивает тебя с идеалом, ищет любовь на стороне вместо сближения с тобой\"],[\"7|Деятельный, ценит свободу, не любит рутину|При общих обязательствах|Азарт и успех не гарантируют постоянства|Остаётся ли в скучные и трудные дни|Сохранять планы, смотреть на договорённости|Свобода, общие цели, движение|Уходит от трудных разговоров, ставит свои планы первыми|Включает в приключения, решает срочное|Активный союз с личным пространством|Если свободой оправдывает исчезновения\",\"7|Целеустремлённый, мобильный, любит побеждать; в тени спешка и жизнь в постоянной гонке|Подойдёт женщине, которой нравится активная жизнь, новые маршруты и меняющиеся интересы|Достигает целей без ущерба близким или превращает любые отношения в соревнование|Учитывает ли последствия своих решений для пары, способен ли доводить начатое до конца|Не превращаться в пассажира его жизни; согласовывать направление движения и свои планы|Свобода движения, поддержка его целей, совместные приключения без постоянного торможения|Спешка, азарт победы, смена приоритетов, привычка оставлять близких позади ради новой цели|Энергичные совместные поездки, решительность, умение продвигать общее дело вперёд|Совместные цели, активный образ жизни, свобода менять интересы с учётом последствий|Ты вынуждена бесконечно догонять его новые планы, жертвуя собственной жизнью и желаниями\"],[\"8|Практичен в деньгах, оценивает вклад|При прозрачных договорённостях|Достаток не равен щедрости|Реальная помощь и общие расходы|Обсудить деньги и вклад прямо|Справедливый обмен, конкретные дела|Пересчитывает вклад, предъявляет претензии|Обеспечивает, оплачивает нужное|Партнёрство с понятным бюджетом|Если деньгами контролирует или унижает\",\"8|Справедливость, честный обмен, последовательность; в тени болезненный поиск виноватых|Подойдёт женщине, ценящей прозрачные отношения, равный вклад и честное выполнение обещаний|Применяет ли одинаковую меру справедливости к себе и женщине или прав только он|Способен ли признать свою долю в конфликте, возместить ущерб и выполнить невыгодное обещание|Не оправдываться бесконечно и не доказывать невиновность; обсуждать конкретные факты|Честность, уважение взаимных обязательств, признание его реального вклада в общее дело|Судейская позиция, злопамятность, подсчёт обид и расходов, стремление наказать за ошибки|Честные решения, материальный вклад, защита твоих интересов и восстановление справедливости|Прозрачные деньги и обязательства, взаимное доверие без бухгалтерии чувств и заслуг|Каждая ошибка становится обвинением, а любовь и помощь приходится постоянно заслуживать\"],[\"9|Самостоятелен, ценит честность и уединение|При комфортной обоим дистанции|Закрытость не доказывает обман или глубину|Возвращается ли к разговору после паузы|Не путать пространство с игнорированием|Честность, доверие, время наедине|Замыкается, переживает один|Открывает личный мир, уважает самостоятельность|Спокойный союз с личным пространством|Если постоянно избегает ясности и близости\",\"9|Мудрость, самодостаточность, глубина чувств, душевная щедрость; в тени отчуждение и снобизм|Подойдёт ценящей содержательную близость, тишину, личные интересы и избирательность в общении|Подлинная житейская мудрость и человечность или убеждённость, что окружающие слишком глупы|Делится ли опытом без высокомерия, проявляет ли сочувствие, когда тебе трудно|Уважать потребность в уединении, но не довольствоваться ролью посторонней в его жизни|Душевная честность, интерес к его внутреннему миру, доверие и время для себя|Интеллектуальное высокомерие, эмоциональное отчуждение, привычка обходиться без близких|Глубокие разговоры, искреннее внимание, душевная щедрость, мудрая поддержка в трудностях|Тихая содержательная близость, общие духовные интересы, самостоятельность без отчуждения|Не делится с тобой своей жизнью, не нуждается во взаимности и считает твои чувства пустяками\"],[\"10|Лёгкий, любит перемены, непоследователен|Если выполняет договорённости|Сюрпризы не равны надёжности|Выполняет ли обещания в обычные дни|Смотреть на регулярность|Впечатления, лёгкость без ухода от проблем|Меняет решения, ждёт, что само рассосётся|Удивляет, поднимает настроение|Гибкий союз с устойчивыми обязательствами|Если обещания постоянно меняет без согласования\",\"10|Умение ловить возможности, доверие жизни, адаптивность; в тени пассивная надежда на удачу|Подойдёт женщине, спокойно относящейся к жизненным поворотам и неожиданным возможностям|Умеет использовать удачный момент или приписывает случайные успехи исключительно себе|Что делает, когда удача отворачивается: ищет новый выход или ждёт, что всё наладится само|Не подменять его инициативу собственной; различать доверие обстоятельствам и бездействие|Оптимизм, лёгкость, принятие жизненных перемен, готовность вместе использовать возможности|Жизнь по воле случая, ожидание лёгких денег и решений, отказ действовать в неудачные периоды|Неожиданные счастливые возможности, лёгкое отношение к переменам, находчивость и оптимизм|Гибкие совместные планы, умение пользоваться шансами и действовать при смене обстоятельств|Всё держится на твоих усилиях, пока он ждёт счастливого поворота и ничего не предпринимает\"]],\"account-service/private/verdict-live.php\":[[\"        foreach(vpPointMap($id) as $point){\\n            if(in_array($matrix[$point],[1,2,3,5],true)){$suffix='-verdict-energies1to5-v3.json';break;}\\n            if($matrix[$point]===4)$suffix='-verdict-energy4-v2.json';\\n        }\",\"        $points=array_map(static fn($point)=>$matrix[$point],vpPointMap($id));\\n        if(array_intersect($points,[6,7,8,9,10]))$suffix='-verdict-energies6to10-v4.json';\\n        elseif(array_intersect($points,[1,2,3,5]))$suffix='-verdict-energies1to5-v3.json';\\n        elseif(in_array(4,$points,true))$suffix='-verdict-energy4-v2.json';\"]]}")
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
assert [i for i,(x,y) in enumerate(zip(a,b)) if x!=y]==[6,7,8,9,10],'UNRELATED_ENERGY_CHANGED'
assert a[1:6]==b[1:6]
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
 if(array_intersect($points,[6,7,8,9,10]))$suffix='-verdict-energies6to10-v4.json';
 elseif(array_intersect($points,[1,2,3,5]))$suffix='-verdict-energies1to5-v3.json';
 elseif(in_array(4,$points,true))$suffix='-verdict-energy4-v2.json';
 if(!str_ends_with(nvCacheFile('final',$date),$suffix))throw new RuntimeException('CACHE');
 if(!str_ends_with(nvCacheFile('check',$date),'-verdict-v1.json'))throw new RuntimeException('PAID_CACHE');
}
echo 'VERDICT_ENERGIES6TO10_OFFLINE_PASS';
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
  if saved[p]!=new[p]:write(backup+'/before-verdict-energies6to10-'+tag+'-'+p.rsplit('/',1)[-1]+'.bak',saved[p])
 for p in files:
  assert read(remote(p))==saved[p],'CONCURRENT_EDIT'
  if saved[p]!=new[p]:changed.append(p);write(remote(p),new[p])
 assert healthy(),'POST_HEALTH'
 for p in files:assert read(remote(p))==new[p],'FINAL_READBACK'
 for p,h in hashes.items():assert hashlib.sha256(read(p)).digest()==h,'PROTECTED_CHANGED'
 print('VERDICT_ENERGIES6TO10_LIVE fifty_revised_keys_first_five_preserved paid_cache_preserved model_calls=0',flush=True)
except BaseException:
 for p in reversed(changed):
  try:write(remote(p),saved[p]);print('ROLLBACK_OK',p,flush=True)
  except BaseException:print('ROLLBACK_FAILED',p,flush=True)
 raise
finally:
 try:ftp.quit()
 except BaseException:ftp.close()
