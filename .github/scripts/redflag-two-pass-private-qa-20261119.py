#!/usr/bin/env python3
"""Temporary owner-only two-pass Red Flag editorial QA, no site publication."""
import concurrent.futures
import datetime
import json
import os
import pathlib
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path.cwd()
source = (ROOT / "cloudflare/redflag-draft-ai/src/index.js").read_text("utf-8")
match = re.search(r"const openArchetypes=\{([\s\S]*?)\};", source)
if not match:
    raise RuntimeError("ENERGY_LENSES_NOT_FOUND")
lenses = {int(k): v for k, v in re.findall(r'(\d+):"([^"]+)"', match.group(1))}
if len(lenses) != 22:
    raise RuntimeError("EXPECTED_22_LENSES")
catalog = json.loads((ROOT / "redflag-ai-lab/catalog.json").read_text("utf-8"))
all_titles = [q["title"] for c in catalog["categories"] for q in c["questions"]]
options = [
    "Заботится или будет контролировать каждый твой шаг?",
    "Умеет говорить о проблемах или наказывает молчанием?",
    "После ссоры извинится или виноватой сделает тебя?",
    "Обещает и делает или просто король планов?",
    "Будет партнёром или начальником в семье?",
    "Как он реагирует на критику и неудобную правду?",
    "Ему можно доверять или лучше снять розовые очки?",
    "С ним вообще стоит связываться или лучше не тратить время?",
]
assert all(t in all_titles for t in options)
runtime = ROOT / "private-redflag-two-pass-runtime"
(runtime / "src").mkdir(parents=True, exist_ok=True)
cfg = json.loads((ROOT / "cloudflare/redflag-draft-ai/wrangler.jsonc").read_text("utf-8"))
cfg["name"] = "redflag-local-private-two-pass-only"
(runtime / "wrangler.jsonc").write_text(json.dumps(cfg), "utf-8")
worker = r'''
const LENSES=__LENSES__;
const OPTIONS=__OPTIONS__;
const MODEL="@cf/openai/gpt-oss-120b";
const textOf=r=>r?.response??r?.choices?.[0]?.message?.content??"";
const energy=n=>{let x=n;while(x>22)x=String(x).split("").reduce((a,d)=>a+Number(d),0);return x;};
const ai=async(env,messages,max_tokens,temperature)=>{
  const res=await env.AI.run(MODEL,{
    messages,temperature,max_tokens,reasoning_effort:"low"
  });
  const txt=textOf(res);
  if(typeof txt!=="string"||!txt.trim())throw Error("NO_MODEL_TEXT");
  return txt.trim();
};
export default {async fetch(req,env){
  if(new URL(req.url).pathname==="/health")
    return Response.json({ok:true,ai_bound:!!env.AI});
  if(req.method!=="POST"||new URL(req.url).pathname!=="/preview")
    return Response.json({ok:false,error:"NOT_FOUND"},{status:404});
  if(!env.AI)return Response.json({ok:false,error:"NO_AI"},{status:503});
  try{
    const b=await req.json();
    const d=energy(b.day),m=energy(b.month);
    if(!LENSES[d]||!LENSES[m]||b.title!=="Уважает женское «нет» или начинает давить?")
      return Response.json({ok:false,error:"BAD_INPUT"},{status:400});
    const p1=[
      "Ты нумеролог и редактор. НЕ ПИШИ готовый клиентский ответ. Сначала определяй содержательную индивидуальность сочетания.",
      "День и месяц равноправны. Их тени не готовые приговоры. Выбери одну конкретную и правдоподобную реакцию на отказ именно для этой пары. Отдавай предпочтение узнаваемым повседневным ситуациям, а не необычным выдуманным историям.",
      "Не своди всё к молчанию, контролю или переубеждению. Выбери конкретную жизненную ситуацию без странных ритуалов, письменных договоров, контрактов, квестов, игр, заданий и выдуманных особенностей.",
      "Только JSON с ключами day_role, month_role, unique_scenario, one_life_example, observable_red_flag, distinct_from_other_months, next_question.",
      "next_question должен быть точным названием из данного списка. Не утверждай, что мужчина уже совершал плохие поступки."
    ].join(" ");
    const prompt=[
      "Вопрос: "+b.title,
      "День: "+b.day+"; энергия "+d+"; возможные проявления: "+LENSES[d],
      "Месяц: "+b.month+"; энергия "+m+"; возможные проявления: "+LENSES[m],
      "Выбери связанный вопрос из: "+JSON.stringify(OPTIONS)
    ].join("\n");
    const plan=await ai(env,[{role:"system",content:p1},{role:"user",content:prompt}],850,0.95);
    const p2=[
      "Ты женщина-нумеролог, которая доброжелательно и честно говорит с женщиной о мужчине. Пиши простой разговорный русский без канцелярита, психологических абстракций и комплиментарности.",
      "Ниже редакторский план. Это НЕ текст ответа: используй его только как внутреннюю основу. Красный флаг не оправдывай, но не объявляй возможное доказанным.",
      "Первый абзац 650–900 символов, дай прямой ответ на конкретный вопрос с одним живым примером. Никаких вводных «Важно проверить», «Он скорее не...», «Этот мужчина», общих рассуждений и повторов.",
      "Второй абзац 180–300 символов, естественно добавь новую полезную грань, а затем предложи ровно ОДИН соседний вопрос по точному названию в кавычках «». Не используй «стоит посмотреть», «чтобы лучше понять», «обрати внимание на вопрос».",
      "ОБЩАЯ длина 900–1300 символов с пробелами, ровно два абзаца. Не называй день, месяц, числа, энергии, арканы, расчёты, теоретические термины. Избегай двоеточий, длинных тире и английских слов. Никаких заголовков.",
      "Пиши как в живой консультации. Не придумывай нелепые декорации, будто мужчина подписывает бумаги, играет в квест, организует мероприятия или проводит эксперименты ради отказа. Лучше обычный разговор после отменённой встречи, отказа от поездки, просьбы или бытового дела. Не утверждай вымышленный поступок как факт. Правь согласования, стиль, пунктуацию и избегай роботизированного голоса."
    ].join(" ");
    const user=[
      "Заданный вопрос женщины: "+b.title,
      "Редакторский план: "+plan,
      "Разрешённые точные названия следующего вопроса: "+JSON.stringify(OPTIONS),
      "Пиши только два абзаца ответа без пояснений."
    ].join("\n");
    let answer=await ai(env,[{role:"system",content:p2},{role:"user",content:user}],1300,0.82);
    const good=s=>{
      const chunks=s.split(/\n\s*\n/).filter(Boolean);
      return s.length>=900&&s.length<=1300&&chunks.length===2&&OPTIONS.some(t=>chunks[1].includes("«"+t+"»"));
    };
    if(!good(answer)){
      answer=await ai(env,[
        {role:"system",content:p2},{role:"user",content:user},
        {role:"assistant",content:answer.slice(0,1800)},
        {role:"user",content:"Перепиши текст начисто. Строго 900–1300 символов с пробелами, ровно два абзаца. Во втором процитируй в кавычках «» ОДИН точный заголовок из списка. Не повторяй мысли и не используй шаблонное вступление. Только ответ."}
      ],1350,0.75);
    }
    // Private editorial proofreading pass, without inventing new events.
    const polishSystem=[
      "Ты строгий литературный редактор русского языка, работающий с нумерологическими трактовками. Перепиши текст живо и естественно, без шаблонов и повторов.",
      "Убери выдуманные странные события, письменные договоры, неестественные диалоги, квесты и метафоры. Переведи мысль в простую узнаваемую бытовую ситуацию без категорических обвинений.",
      "Сохрани уникальный нумерологический смысл сочетания двух энергий и правдоподобный риск. Не добавляй новые факты и не называй энергии.",
      "Ровно два абзаца, в сумме 900–1300 символов с пробелами. Первый абзац дает конкретный ответ, второй естественно приводит к одному доступному связанному вопросу.",
      "Название следующего вопроса перепиши дословно в кавычках «». Не меняй регистр и знак вопроса. Не повторяй формулы «стоит посмотреть» и «обрати внимание на вопрос». Только готовый текст."
    ].join(" ");
    let polished=await ai(env,[
      {role:"system",content:polishSystem},
      {role:"user",content:"Вопрос: "+b.title+"\\nДоступные названия: "+JSON.stringify(OPTIONS)+"\\nЧерновик, который нужно улучшить:\\n"+answer}
    ],1400,0.7);
    if(good(polished))answer=polished;
    return Response.json({ok:true,answer,plan,passes:true,
      length_ok:answer.length>=900&&answer.length<=1300,
      paragraphs:answer.split(/\n\s*\n/).filter(Boolean).length,
      exact_followup:OPTIONS.filter(t=>answer.split(/\n\s*\n/).at(-1).includes("«"+t+"»")),
      model:MODEL});
  }catch(e){
    return Response.json({ok:false,error:String(e?.message||"AI_ERROR").slice(0,150)},{status:503});
  }
}};
'''
worker = worker.replace("__LENSES__", json.dumps(lenses, ensure_ascii=False))
worker = worker.replace("__OPTIONS__", json.dumps(options, ensure_ascii=False))
(runtime / "src/index.js").write_text(worker, "utf-8")
folder = ROOT / "private-redflag-two-pass-answers"
folder.mkdir(exist_ok=True)
env = os.environ.copy()
env.update({"NO_PROXY":"localhost,127.0.0.1","no_proxy":"localhost,127.0.0.1","WRANGLER_SEND_METRICS":"false"})
client = urllib.request.build_opener(urllib.request.ProxyHandler({}))
question = "Уважает женское «нет» или начинает давить?"
pairs = [(9,2),(9,7),(9,9),(31,3),(31,8),(31,12)]
with (folder/"wrangler.log").open("w",encoding="utf-8") as log:
    p = subprocess.Popen(["npx","--yes","wrangler@4","dev","--ip","127.0.0.1","--port","8787"],
        cwd=runtime,env=env,stdout=log,stderr=subprocess.STDOUT)
    try:
        ready=False
        for i in range(75):
            if p.poll() is not None:break
            try:
                with client.open("http://127.0.0.1:8787/health",timeout=3) as resp:
                    health=json.load(resp)
                if health.get("ok") and health.get("ai_bound"):ready=True;break
            except Exception:pass
            time.sleep(1)
        if not ready:raise RuntimeError("PRIVATE_WRANGLER_NOT_READY")
        def ask(pair):
            day,month=pair
            payload=json.dumps({"day":day,"month":month,"title":question},ensure_ascii=False).encode()
            result={};http=0
            for retry in range(2):
                req=urllib.request.Request("http://127.0.0.1:8787/preview",data=payload,
                  headers={"Content-Type":"application/json"},method="POST")
                try:
                    with client.open(req,timeout=240) as resp:
                        http=resp.status;result=json.load(resp)
                    break
                except urllib.error.HTTPError as e:
                    http=e.code
                    try:result=json.loads(e.read(2500))
                    except Exception:result={"error":"HTTP_"+str(http)}
                except Exception as e:
                    http=0;result={"error":type(e).__name__}
                time.sleep(5)
            answer=result.get("answer","")
            return {"date":f"{day:02d}.{month:02d}","http":http,"ok":bool(result.get("ok")),
               "chars":len(answer),"length_ok":result.get("length_ok"),
               "paragraphs":result.get("paragraphs"),"exact_followup":result.get("exact_followup",[]),
               "answer":answer,"plan":result.get("plan",""),"error":result.get("error")}
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            output=list(pool.map(ask,pairs))
        for r in output:
            print("TWO_PASS_REDFLAG",r["date"],"HTTP",r["http"],"OK",r["ok"],"CHARS",r["chars"],
                "PARAS",r["paragraphs"],"EXACT",len(r["exact_followup"]),"ERROR",r["error"],flush=True)
        (folder/"six-dates.json").write_text(json.dumps({"type":"private two-pass real Workers AI",
            "model":"@cf/openai/gpt-oss-120b","published":False,"reg_ru_touched":False,
            "time_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "results":output},ensure_ascii=False,indent=2),encoding="utf-8")
        print("TWO_PASS_SUMMARY",sum(x["ok"] for x in output),"/6",flush=True)
        if sum(x["ok"] for x in output)<4:raise RuntimeError("TWO_PASS_INCOMPLETE")
    finally:
        p.terminate()
        try:p.wait(timeout=8)
        except subprocess.TimeoutExpired:p.kill()
