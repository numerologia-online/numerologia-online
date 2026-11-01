"""Local QA only. Synthetic report is never deployed to the live site."""
import http.server,json,pathlib,os,urllib.parse,argparse
ROOT=pathlib.Path(__file__).resolve().parents[1]/'public'
report={'ok':True,'version':'2.0.0','from':'2026-10-26','to':'2026-11-01','timezone':'Europe/Samara','generated_at':'2026-11-01T12:00:00Z','totals':{'sessions':1284,'orders':37,'subscriptions':9,'revenue':18329,'attributed':35,'unattributed':2},'rows':[],'sources':[{'source':'blogger','campaign':'anna_november','sessions':345,'pages':490,'clicks':231,'checkouts':23,'orders':14,'subscriptions':4,'revenue':8900}],'days':[{'day':'2026-11-01','sessions':204,'clicks':319,'orders':7}]}
for section,item,title,impressions,clicks,orders,subs,revenue in [('moment','q_love','Что он чувствует ко мне?',829,317,12,4,3690),('redflag','-','Мужчина или Red Flag',1098,298,8,2,5200),('year','-','Разбор года',721,196,9,1,6790),('children','character','Как понять характер ребёнка и поддержать его сильные стороны?',398,119,3,1,1690),('compatibility','q_future','Есть ли будущее у наших отношений?',315,84,5,1,959)]:
 report['rows'].append(dict(section=section,item=item,title=title,impressions=impressions,clicks=clicks,opens=clicks,offers=orders*3,checkout_once=orders*2,checkout_club=subs*2,orders=orders,subscriptions=subs,revenue=revenue,ctr=round(100*clicks/impressions,2),conversion=round(100*orders/clicks,2),club_conversion=round(100*subs/clicks,2),subscription_revenue=subs*490))
class Handler(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  path=urllib.parse.urlparse(self.path).path
  if path=='/mobile':
   body=b'<html><body style="margin:0;background:#cdd5c8"><iframe title="Mobile QA" src="/" style="width:390px;height:1100px;border:0;display:block;margin:0 auto"></iframe></body></html>';mime='text/html'
  elif path=='/api/numi-insights.php':
   body=json.dumps({'ok':True,'owner':True} if 'action=session' in self.path else report).encode();mime='application/json'
  else:
   target=ROOT/(path.lstrip('/') or 'index.html')
   if not target.is_file():self.send_error(404);return
   body=target.read_bytes();mime={'.html':'text/html','.js':'application/javascript','.css':'text/css'}.get(target.suffix,'text/plain')
   if target.suffix=='.html':body=body.replace(b'<body>', '<body><div style="padding:8px;text-align:center;background:#ead9a7;font:12px sans-serif">ПРОВЕРКА · ТЕСТОВЫЕ ДАННЫЕ</div>'.encode())
  self.send_response(200);self.send_header('Content-Type',mime+'; charset=utf-8');self.end_headers();self.wfile.write(body)
 def log_message(self,*args):pass
args=argparse.ArgumentParser();args.add_argument('--port',type=int,default=int(os.environ.get('PORT','5173')));options,_=args.parse_known_args()
http.server.ThreadingHTTPServer(('0.0.0.0',options.port),Handler).serve_forever()
