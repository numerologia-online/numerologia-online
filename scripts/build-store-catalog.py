"""Public labels only. Server naCatalogResolve remains the sole price authority."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
products=[('year_full','Полный разбор года'),('life_full','Полный разбор жизни'),('compatibility_full','Совместимость'),('child_full_v1','Детский разбор'),('redflag_question','Мужчина или Red Flag'),('yesno_question','Да или нет?'),('moment_question','Нумерология момента'),('club_month','Клуб'),('school_week','Школа нумерологии'),('money_rituals','Денежные ритуалы'),('wallet_topup','Пополнение кошелька')]
redflag=[]
for category in json.loads((root/'data/redflag/catalog.json').read_text()):
 bank='money-questions' if category['id']=='money' else category['id']
 for q in json.loads((root/f'data/redflag/banks/{bank}.json').read_text())['questions']:
  redflag.append({'id':q['id'],'category':category['id'],'title':category['title']+' · '+q['title']})
data={'products':[{'code':code,'title':title} for code,title in products], 'redflag':redflag,
'yesno':json.loads((root/'moment/yes-no/questions.json').read_text())['questions'],
'moment':json.loads((root/'moment/questions.json').read_text())['questions']}
(root/'store-catalog.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
