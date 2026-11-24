#!/usr/bin/env python3
"""Editorial static-bank repair. No inference services or paid requests."""
import copy, ftplib, hashlib, io, json, os, pathlib, re, ssl, subprocess, time, urllib.error, urllib.request

ROOT=pathlib.Path.cwd()
MANIFEST='account-service/private/store-assets.json'
BANK=re.compile(r'data/redflag/(love|money)/[a-z0-9-]+\.json\Z')
DATE=re.compile(r'data/redflag/love/published/[0-9]{1,2}-[0-9]{1,2}\.json\Z')
def decode(raw):return json.loads(raw.decode('utf-8-sig'))
def encode(obj):return (json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode()
def sha(raw):return hashlib.sha256(raw).hexdigest()
def paragraphs(v):return [p for p in re.split(r'\n\s*\n',v) if p.strip()]
catalog_text=(ROOT/'redflag-public-catalog.js').read_text()
public=json.loads(re.search(r'export const PUBLIC_QUESTIONS = (\{[\s\S]*?\n\});',catalog_text)[1])
private_catalog=decode((ROOT/'account-service/private/redflag-catalog.json').read_bytes())['questions']
titles={(cat,q['id']):q['title'] for cat,qs in public.items() for q in qs}
# Each continuation addresses a separate observable relationship dimension.
# No continuation states new facts about the man or changes the interpretation.
plans={
'first-step':[
('language','show-love',r'интерес|завоев|охот|азарт|увлеч','Одно дело заинтересовать женщину, совсем другое — сохранять тепло, когда знакомство уже состоялось. Мне бы хотелось посмотреть на его поступки после первых свиданий.'),
('money','courtship',r'пиш|сообщен|перепис|телефон|слов','Даже очень приятная переписка — пока только знакомство. Я бы ещё посмотрела, во что она может превратиться, если вы начнёте встречаться в реальной жизни.'),
('language','how-to-talk',r'молча|скром|стесн|сдерж|нереш|осторож','Если приходится долго гадать, чего человек хочет, неплохо заранее понять, какая форма разговора помогает вам услышать друг друга.'),
('verdict','best-side',r'забот|вниман|радост|тепл|прият','Первые шаги к женщине — лишь одна сторона отношений. А что он способен привнести в них, когда знакомство перерастёт во что-то большее?'),
('money','words-or-deeds',r'обеща|встреч|приглаш|план','Мне бы хотелось проверить ещё одну вещь: совпадут ли его намерения с тем, что он действительно сделает. В этом вопросе лучше смотреть на поступки, а не на красивые сообщения.'),
('verdict','format',r'свобод|дистанц|темп|самостоят','Интересно ещё понять, в каком формате вам обоим будет комфортно, когда общение перестанет быть новым. Ведь первый шаг сам по себе ничего не говорит о том, как складывается союз.'),
('language','love-language',r'симпат|чувств|нежн|романт','А ещё я бы выяснила, какие проявления симпатии он вообще способен заметить. Иногда то, что для одного очевидный знак внимания, другой может просто не распознать.'),
('verdict','check',r'провер|смотр|наблюд|ждать','Когда первое впечатление уже сложилось, хочется понять, достаточно ли его для выводов. Посмотри ещё, какие конкретные поступки могут рассказать больше, чем начало общения.')],
'courtship':[
('language','show-love',r'цвет|подар|ресторан|сюрприз','Красивые свидания радуют, но мне было бы любопытно узнать, как он проявляет чувства в те дни, когда не требуется устраивать праздник.'),
('verdict','best-side',r'рад|удив|вниман|прият','Ухаживания — только начало истории. Давай отдельно посмотрим, какие ещё приятные стороны могут открыться в отношениях, когда вы узнаете друг друга ближе.'),
('language','how-to-talk',r'намек|выбор|вку[сш]|попрос|компромисс','Не все люди одинаково понимают пожелания о свиданиях. Я бы ещё посмотрела, как разговаривать с ним о своих предпочтениях, чтобы не приходилось всё додумывать за двоих.'),
('verdict','check',r'обеща|перепис|ожида|приглас','Хочется понять, насколько легко перейти от красивых слов к обычным делам. Этот момент я бы проверила отдельно, прежде чем строить большие планы.'),
('language','love-language',r'забот|романт|нежн|тепл','Подарки и встречи — далеко не единственный способ выразить любовь. Интересно, что для него самого означает близость и какой знак внимания он действительно заметит.'),
('verdict','format',r'свобод|удоб|привыч|план','Удачное свидание не обязательно означает, что ваши представления о повседневных отношениях совпадают. Я бы отдельно посмотрела, какой формат союза может быть комфортным для обоих.'),
('intimacy','tenderness',r'страст|флирт|влечен|азарт','Мне ещё интересно, сохранится ли пространство для нежности, когда первые яркие впечатления останутся позади. Это совсем другая сторона близости.')],
'words-or-deeds':[
('verdict','check',r'обеща|срок|результ|дел','В этом вопросе главное — увидеть не только намерения, но и результат. Я бы отдельно выяснила, какие реальные поступки помогут оценить его готовность к отношениям.'),
('language','criticism',r'оправда|виноват|спор|замечан|неправ','Особенно многое становится понятно, когда мужчине напоминают о невыполненном обещании. Интересно, способен ли он услышать неудобное замечание, не превращая разговор в спор.'),
('language','conflict-style',r'конфликт|ссор|договор|разноглас','Даже у надёжных людей бывают ситуации, когда договорённости приходится менять. Я бы ещё посмотрела, как он ведёт себя, если ваши мнения по этому поводу расходятся.'),
('verdict','best-side',r'сделал|помог|надеж|надёж|выполня','Выполненное обещание — хороший повод смотреть дальше. Мне было бы интересно понять, какие ещё поступки могут говорить о его участии в отношениях.'),
('language','ask',r'попрос|просьб|ожида|напомин','А ещё полезно понять, в какой форме с ним обсуждать конкретную просьбу и сроки. Не для того, чтобы уговаривать взрослого человека, а чтобы договорённость была понятна обоим.'),
('verdict','format',r'решени|самостоят|правил|план','Совпадение слов и поступков важно не только в отдельных обещаниях. Интересно, какой уклад отношений позволит вам обоим сохранять самостоятельность и выполнять общие обязательства.'),
('language','show-love',r'чувств|любов|вниман|забот','Мне хочется посмотреть на эту историю и с другой стороны: как отличить красивые заверения в любви от ежедневных проявлений участия и заботы.'),
('verdict','weak-point',r'повтор|избега|уходит|переклад','Если один и тот же вопрос приходится обсуждать снова и снова, стоит шире взглянуть на привычный сценарий отношений. Я бы выяснила, где ещё может возникать сложность.')],
'comic-verdict-money':[
('verdict','format',r'корол|цар|император|начальник|правил','Шутки шутками, но дома никому не хочется играть назначенную роль. Я бы ещё посмотрела, какой формат союза позволит вам обоим чувствовать себя самостоятельными людьми.'),
('language','ask',r'деньг|кошел|плат|бюджет|счет|счёт','Раз уж заговорили о деньгах, любопытно узнать, как он воспринимает обычные просьбы. В жизни это полезнее любых догадок о том, что мужчина должен понять сам.'),
('language','criticism',r'самолюб|горд|команд|спор|важн','А теперь представь, что вы смотрите на одну ситуацию совершенно по-разному. Мне бы хотелось отдельно узнать, как он воспринимает замечания и несогласие.'),
('verdict','best-side',r'щедр|подар|рад|прият|забот','А если отложить шутки, ведь интересно и то, какие приятные качества он может проявлять в любви. Я бы заглянула в этот вопрос прежде, чем делать окончательный вывод.'),
('language','show-love',r'любов|женщин|вниман|чувств','Финансовые привычки — только часть отношений. Мне ещё любопытно, какими действиями он может показывать, что женщина для него действительно важна.'),
('verdict','check',r'обещ|дел|работ|заработ|план','За смешной картинкой хочется увидеть реальную жизнь. Я бы посмотрела, какие поступки стоит замечать прежде, чем решать, насколько на человека можно рассчитывать.'),
('language','conflict-style',r'контрол|ссор|разноглас|договор','С деньгами нередко связаны и самые обычные разногласия. Интересно, как с ним обсуждать разные взгляды на расходы, не превращая семейный разговор в заседание суда.'),
('verdict','main-advice',r'свобод|самостоят|выбор|интерес','У каждого из вас остаётся своя жизнь, даже если появятся общие планы. Я бы ещё посмотрела, какая практическая рекомендация поможет сохранить себя в этих отношениях.')]
}
fallback={
'gift':('language','show-love','Подарки — только один из способов выразить симпатию. Интересно ещё понять, как он проявляет чувства в обычной жизни, когда повод для подарка не нужен.'),
'generosity':('verdict','format','Денежные привычки особенно интересно сопоставить с тем, какой уклад отношений будет удобен обоим. Я бы отдельно посмотрела на этот вопрос.'),
'provider':('verdict','check','Способность зарабатывать и участие в общей жизни — разные вещи. Мне бы хотелось отдельно оценить его конкретные поступки и отношение к договорённостям.'),
'family-load':('language','ask','Когда речь заходит об общих обязанностях, полезно понимать, как формулировать конкретную просьбу и договариваться о деле, не принимая всю нагрузку на себя.'),
'resource':('verdict','main-advice','Деньги влияют на повседневность, но не исчерпывают отношения. Я бы ещё посмотрела, как сохранить собственные интересы, когда у пары появляются общие планы.'),
'solve-or-create':('language','compliment','Способность реализовывать цели — одна сторона вопроса. Интересно ещё понять, какая поддержка помогает ему действовать самостоятельно и не перекладывать ответственность.'),
'responsibility':('verdict','check','Я бы отдельно посмотрела, как оценивать поступки мужчины, когда появляются общие обязательства. Это поможет отличить обещания от участия в реальных делах.'),
'celebration':('language','conflict-style','Если вы по-разному относитесь к деньгам, полезно знать, как обсуждать финансовые разногласия. Я бы посмотрела на эту сторону общения отдельно.'),
'romance':('money','courtship','Романтика может выглядеть по-разному. Мне интересно ещё посмотреть, как мужчина ведёт себя на свиданиях, когда уже не нужно производить первое впечатление.'),
'relationship-or-comfort':('verdict','format','Полезно отдельно понять, какой формат отношений будет удобен вам обоим, а не только одному человеку. Я бы заглянула в этот вопрос.'),
'adult-partner':('money','family-load','Готовность к взрослым отношениям проявляется и в самых обычных обязанностях. Мне хотелось бы понять, как он относится к ответственности за общую жизнь.'),
'near-him':('verdict','main-advice','Независимо от того, как складывается общение, важно сохранять собственные желания и интересы. Я бы ещё посмотрела, какой совет относится именно к этому сочетанию.'),
'hard-moment':('language','show-love','Именно в трудные дни особенно заметна разница между словами и поступками. Интересно ещё посмотреть, каким образом он может проявлять чувства.'),
'relationship-format':('verdict','format','Представления о серьёзных отношениях у людей могут различаться. Я бы ещё выяснила, какой формат союза способен учитывать интересы обоих партнёров.'),
'family-or-triangle':('language','how-to-talk','Когда речь заходит о верности и договорённостях, важно уметь говорить о них прямо. Мне было бы интересно посмотреть, какая форма разговора с ним работает лучше.'),
'honest-or-disappear':('language','distance','Отдаление не всегда означает одно и то же. Я бы ещё посмотрела, как можно прояснить происходящее без бесконечного ожидания и попыток вытянуть ответ.'),
'love-or-attention':('language','show-love','Вопрос о чувствах лучше не заканчивать на словах. Мне хотелось бы отдельно посмотреть, какие действия могут помочь понять, что мужчина действительно вовлечён в отношения.')
}
def finish(lead,cat,qid):
    assert private_catalog[cat][qid]['ready'] is True,(cat,qid)
    title=titles[(cat,qid)]
    return lead+' '+title
for rules in plans.values():
    for cat,qid,_,lead in rules:finish(lead,cat,qid)
for cat,qid,lead in fallback.values():finish(lead,cat,qid)
def continuation(qid,key,body):
    rules=plans.get(qid)
    if rules:
        matched=[r for r in rules if re.search(r[2],body,re.I)]
        # Prefer a continuation tied to actual wording; vary the choice across texts.
        options=matched or rules
        seed=int(sha((qid+'|'+key+'|'+body).encode())[:12],16)
        cat,other,_,lead=options[seed%len(options)]
    elif qid in fallback:cat,other,lead=fallback[qid]
    else:raise RuntimeError('NO_EDITORIAL_CONTINUATION:'+qid)
    return finish(lead,cat,other)
def repair(obj,path,public_only=False):
    before=copy.deepcopy(obj)
    es=obj.get('entries')
    if not isinstance(es,dict) or not es:raise RuntimeError('EMPTY_BANK:'+path)
    qid=obj.get('questionId')
    date_bank=bool(DATE.fullmatch(path))
    if date_bank and public_only and set(es)!={'first-step'}:
        raise RuntimeError('PUBLIC_DATE_CONTAINS_NONFREE_CONTENT:'+path)
    if not date_bank:
        if obj.get('keyRule')!='day-month' or obj.get('section') not in ('love','money'):
            raise RuntimeError('BANK_SCHEMA:'+path)
        if public_only and qid not in ('first-step','gift'):raise RuntimeError('PUBLIC_PAID_BANK:'+path)
    missing=0;multi=0
    for key,body in list(es.items()):
        if not isinstance(body,str) or not body.strip():raise RuntimeError('INVALID_BODY:'+path+':'+key)
        parts=paragraphs(body)
        if len(parts)>2:multi+=1;continue
        if len(parts)==2:continue
        actual=key if date_bank else qid
        date=obj.get('dateKey') if date_bank else key
        # Preserve the entire original text, including punctuation, verbatim.
        lead=continuation(actual,date,body)
        es[key]=body+'\n\n'+lead
        assert es[key].startswith(body+'\n\n') and len(paragraphs(es[key]))==2
        missing+=1
    assert set(es)==set(before['entries'])
    assert {k:v for k,v in obj.items() if k!='entries'}=={k:v for k,v in before.items() if k!='entries'}
    for k,old in before['entries'].items():
        if len(paragraphs(old))==1:assert es[k].startswith(old+'\n\n')
        else:assert es[k]==old
    print('AUDIT',path,'entries='+str(len(es)),'added='+str(missing),'more_than_two='+str(multi),flush=True)
    return missing
def patch_js(path,raw):
    s=raw.decode()
    if path=='redflag-feature.js':
        old='response.paragraphs ?? [response.answer]'
        new=r'response.paragraphs ?? String(response.answer??"").split(/\n\s*\n/).map(part=>part.trim()).filter(Boolean)'
        if s.count(old)==2:return s.replace(old,new).encode()
        if s.count(new)==2:return raw
        raise RuntimeError('JS_RENDER_ANCHOR')
    if path=='app.js':
        pattern=r'(\./redflag-feature\.js\?v=)[a-zA-Z0-9_-]+'
    elif path=='index.html':
        pattern=r'(app\.js\?v=)[a-zA-Z0-9_-]+'
    else:raise RuntimeError('INVALID_JS_PATH')
    out,n=re.subn(pattern,r'\g<1>static-paragraphs-20261124',s)
    if n!=1:raise RuntimeError('JS_VERSION_ANCHOR:'+path)
    return out.encode()
def status(path):
    req=urllib.request.Request('https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'+path+'?paragraphs='+str(time.time_ns()),headers={'Cache-Control':'no-cache'})
    try:
        with urllib.request.urlopen(req,timeout=25) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
def healthy():
    codes=[status(''),status('data/redflag/love/first-step.json'),status('data/redflag/money/gift.json'),status('data/redflag/money/words-or-deeds.json')]
    print('SITE_HEALTH',codes,flush=True)
    return codes[0]==200 and codes[1:3]==[200,200] and codes[3] in (401,403,404)
# First prepare and validate the repository version without modifying any original paragraphs.
manifest=decode((ROOT/MANIFEST).read_bytes())
assert manifest['version']==2
bankpaths=sorted(p for p in manifest['files'] if BANK.fullmatch(p))
assert len(bankpaths)==21,('UNEXPECTED_BANK_COUNT',len(bankpaths))
local={}
local_count=0
for path in bankpaths+sorted(str(p) for p in pathlib.Path('data/redflag/love/published').glob('*.json') if DATE.fullmatch(str(p))):
    raw=(ROOT/path).read_bytes();obj=decode(raw)
    if DATE.fullmatch(path) and set(obj['entries'])!={'first-step'}:
        # Historical mixed private source files are not eligible for public publication.
        # Audit their stored entries but do not republish them as public JSON.
        print('REPO_HISTORICAL_MIXED_DATE',path,flush=True)
    n=repair(obj,path)
    if n:
        local[path]=encode(obj);local_count+=n
        if path in manifest['files']:manifest['files'][path]=sha(local[path])
if any(BANK.fullmatch(p) for p in local):local[MANIFEST]=encode(manifest)
for path in ('redflag-feature.js','app.js','index.html'):
    raw=(ROOT/path).read_bytes();new=patch_js(path,raw)
    if new!=raw:local[path]=new
print('REPOSITORY_AUDIT_COMPLETE added='+str(local_count)+' changed_files='+str(len(local)),flush=True)
for p in ('redflag-feature.js','app.js'):
    subprocess.run(['node','--input-type=module','--check'],input=local.get(p,(ROOT/p).read_bytes()),check=True)
assert healthy(),'PRE_HEALTH'
# Work from current REG.RU bytes, not from historical GitHub copies: preserve
# independent author corrections already made on the server.
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
ftp.connect('server172.hosting.reg.ru',21)
ftp.login(os.environ['REG_FTP_USER'],os.environ['REG_FTP_PASSWORD'])
ftp.prot_p();ftp.set_pasv(True)
home=ftp.pwd().rstrip('/')
private=home+'/private/numi-account-20261031/'
web=home+'/www/xn--c1adkkdfjbp1a4l.online/'
def read(path):
    b=io.BytesIO()
    def receive(chunk):
        if b.tell()+len(chunk)>8000000:raise RuntimeError('REMOTE_FILE_TOO_LARGE')
        b.write(chunk)
    ftp.retrbinary('RETR '+path,receive)
    return b.getvalue()
def write(path,data):
    ftp.storbinary('STOR '+path,io.BytesIO(data))
    if read(path)!=data:raise RuntimeError('READBACK:'+path)
def optional_read(path):
    try:return read(path)
    except ftplib.error_perm as e:
        if str(e).startswith('550'):return None
        raise
changes={};live_counts={'private':0,'public':0};changed=[]
def stage_bank(path,dest,scope,expected=None,optional=False):
    raw=optional_read(dest) if optional else read(dest)
    if raw is None:
        print('ABSENT_OPTIONAL',scope,path,flush=True);return None
    if expected is not None and sha(raw)!=expected:
        raise RuntimeError('MANIFEST_HASH_MISMATCH:'+path)
    obj=decode(raw);n=repair(obj,path,public_only=scope=='public')
    live_counts[scope]+=n
    if n:
        out=encode(obj);changes[dest]=(raw,out);return out
    return raw
try:
    mp=private+'store-assets.json';mraw=read(mp);m=decode(mraw)
    assert m['version']==2
    # A paid bank is never written to webroot. Update only its own manifest hash.
    remote_paths=sorted(p for p in m['files'] if BANK.fullmatch(p))
    assert set(remote_paths)==set(bankpaths),'LIVE_BANK_SET_DIFFERS'
    for p in remote_paths:
        dest=private+'store-content/'+p
        raw=stage_bank(p,dest,'private',m['files'][p])
        if dest in changes:m['files'][p]=sha(raw)
    if any(dest.startswith(private+'store-content/') for dest in changes):changes[mp]=(mraw,encode(m))
    for p in ('data/redflag/love/first-step.json','data/redflag/money/gift.json'):
        stage_bank(p,web+p,'public')
    published=web+'data/redflag/love/published'
    names=ftp.nlst(published)
    safe=sorted({n.rsplit('/',1)[-1] for n in names if re.fullmatch(r'[0-9]{1,2}-[0-9]{1,2}\.json',n.rsplit('/',1)[-1])})
    print('LIVE_PUBLIC_DATE_FILES',len(safe),flush=True)
    for name in safe:
        p='data/redflag/love/published/'+name
        stage_bank(p,web+p,'public')
    for p in ('redflag-feature.js','app.js','index.html'):
        raw=read(web+p);new=patch_js(p,raw)
        if new!=raw:changes[web+p]=(raw,new)
        if p.endswith('.js'):subprocess.run(['node','--input-type=module','--check'],input=new,check=True)
    print('LIVE_AUDIT_COMPLETE',json.dumps(live_counts),'changed_files='+str(len(changes)),flush=True)
    # Backups for all changed files, outside webroot, before first write.
    backup=home+'/site-safeguard-backups/paragraphs-'+os.environ['GITHUB_RUN_ID']
    ftp.mkd(backup)
    for i,(dest,(old,new)) in enumerate(changes.items()):
        write(backup+'/'+str(i).zfill(3)+'-'+dest.rsplit('/',1)[-1]+'.before',old)
    # Record repository changes first, with fast-forward only, no overwrites.
    subprocess.run(['git','fetch','origin','main'],check=True)
    current=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
    remote=subprocess.check_output(['git','rev-parse','origin/main'],text=True).strip()
    if current!=remote:raise RuntimeError('MAIN_ADVANCED_REFUSE_TO_OVERWRITE')
    for p,data in local.items():(ROOT/p).write_bytes(data)
    if local:
        subprocess.run(['git','diff','--check'],check=True)
        subprocess.run(['git','config','user.name','github-actions[bot]'],check=True)
        subprocess.run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],check=True)
        subprocess.run(['git','add','--',*local],check=True)
        subprocess.run(['git','commit','-m','Add static editorial followups without rewriting original Red Flag answers'],check=True)
        subprocess.run(['git','push','origin','HEAD:main'],check=True)
    for dest,(old,new) in changes.items():
        if read(dest)!=old:raise RuntimeError('CONCURRENT_EDIT:'+dest)
        changed.append(dest);write(dest,new)
    for dest,(old,new) in changes.items():assert read(dest)==new
    assert healthy(),'POST_HEALTH'
    print('STATIC_PARAGRAPHS_LIVE repository_added='+str(local_count)+' private_added='+str(live_counts['private'])+' public_added='+str(live_counts['public'])+' original_text_preserved=true model_calls=0',flush=True)
except BaseException:
    for dest in reversed(changed):
        try:write(dest,changes[dest][0]);print('ROLLBACK_OK',dest.rsplit('/',1)[-1],flush=True)
        except BaseException:print('ROLLBACK_FAILED',dest.rsplit('/',1)[-1],flush=True)
    raise
finally:
    try:ftp.quit()
    except BaseException:ftp.close()
