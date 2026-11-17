import fs from "node:fs";
import path from "node:path";

/* Generates unpublished owner-review drafts only.
   No paid answers, storefront, balances, or hosting changes. */
const root=process.cwd(),out="redflag-batch-output";
fs.mkdirSync(out,{recursive:true});
const src=fs.readFileSync("cloudflare/redflag-draft-ai/src/index.js","utf8");
const p=new Function(src.slice(0,src.indexOf("export default {"))+
  "\nreturn {MODEL,SYSTEM,CATEGORY_RULES,ENERGY_SHADOWS,energy22,validDraft,hiddenCalculationLeak,draftParagraphs,ensureReadyFollowup,hasReadyFollowup};")();
const cat=JSON.parse(fs.readFileSync("redflag-ai-lab/catalog.json","utf8"));
const question=cat.categories.find(x=>x.id==="flags")?.questions.find(x=>x.id==="care-or-control");
if(question?.title!=="Заботится или будет контролировать каждый твой шаг?")throw Error("QUESTION_MISMATCH");
const pc=fs.readFileSync("redflag-public-catalog.js","utf8");
const published=new Function(pc.replace(/export const/g,"const")+"\nreturn PUBLIC_QUESTIONS;")();
const ready=new Set(Object.values(published).flat().filter(q=>q.status==="ready").map(q=>q.title));
const followups=["Уважает женское «нет» или начинает давить?","Держит слово или опять одни красивые разговоры?","Верный или у него каждая вторая «просто подруга»?"];
if(followups.some(t=>!ready.has(t)))throw Error("UNPUBLISHED_FOLLOWUP");
const limit=Math.max(1,Math.min(366,Number(process.env.BATCH_LIMIT||"1")));
const dates=Array.from({length:366},(_,i)=>{const d=new Date(Date.UTC(2000,0,i+1));return{day:d.getUTCDate(),month:d.getUTCMonth()+1};}).slice(0,limit);
const bank={schemaVersion:1,status:"draft_not_for_sale",section:"flags",questionId:question.id,
  question:question.title,keyRule:"day-month",expectedDates:366,entries:{},flagged:{}};
const report={requested:limit,accepted:0,flagged:0,checked:0,reviewScores:{},startedAt:new Date().toISOString()};
const save=()=>{
  report.accepted=Object.keys(bank.entries).length;report.flagged=Object.keys(bank.flagged).length;
  fs.writeFileSync(path.join(out,"care-or-control-drafts.json"),JSON.stringify(bank,null,2)+"\n");
  fs.writeFileSync(path.join(out,"care-or-control-report.json"),JSON.stringify(report,null,2)+"\n");
};
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function run(messages,maxTokens=650,temp=.76){
  const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
  if(!token||!account)throw Error("WORKERS_AI_AUTH_MISSING");
  const url="https://api.cloudflare.com/client/v4/accounts/"+account+"/ai/run/"+p.MODEL;
  for(let i=0;i<4;i++){
    try{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),85000);
      let response;
      try{response=await fetch(url,{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
        body:JSON.stringify({messages,temperature:temp,max_completion_tokens:maxTokens,chat_template_kwargs:{enable_thinking:false}}),signal:controller.signal});}
      finally{clearTimeout(timer);}
      if(!response.ok){
        if([429,500,502,503,504].includes(response.status)&&i<3){await sleep(2500*(i+1));continue;}
        throw Error("WORKERS_AI_HTTP_"+response.status);
      }
      const data=await response.json();
      if(data.success===false)throw Error("WORKERS_AI_RESULT_FAILED");
      const v=data.result??data,answer=v.response??v.choices?.[0]?.message?.content;
      if(typeof answer!=="string")throw Error("WORKERS_AI_MISSING_TEXT");
      return answer.trim().replace(/\r\n/g,"\n").replace(/\n{3,}/g,"\n\n");
    }catch(e){
      if(i===3||/WORKERS_AI_HTTP_40\d|AUTH_MISSING|RESULT_FAILED/.test(e.message))throw e;
      await sleep(1800*(i+1));
    }
  }
  throw Error("WORKERS_AI_RETRY_EXHAUSTED");
}
function context(d){
  const a=p.energy22(d.day),b=p.energy22(d.month);
  return [
    "Раздел: Красные флаги. Вопрос: "+question.title,
    "Дата мужчины: "+d.day+"-"+d.month+". Скрытая нумерология: энергия дня "+a+", энергия месяца "+b+".",
    "Тень дня: "+p.ENERGY_SHADOWS[a]+". Тень месяца: "+p.ENERGY_SHADOWS[b]+".",
    "Их общий акцент "+p.energy22(a+b)+", напряжение "+p.energy22(Math.abs(a-b)||22)+".",
    "Именно эта пара энергий должна определять отличие от других дат. Вывод ДЛЯ ЖЕНЩИНЫ без чисел и раскрытия расчёта.",
    p.CATEGORY_RULES.flags,
    "Во втором абзаце обязательно назови один связанный УЖЕ ГОТОВЫЙ вопрос из списка: "+JSON.stringify(followups),
    "Ровно два абзаца, 750–1100 знаков, живо, дерзко, женским языком, без заумности и двоеточий."
  ].join("\n");
}
function staticIssues(text,previous){
  const errors=[];
  if(!p.validDraft(text))errors.push("STRUCTURE_LENGTH_OR_ENERGY_LEAK");
  if(!p.hasReadyFollowup(text,followups))errors.push("NO_PUBLISHED_FOLLOWUP");
  if(/[:—]/u.test(text))errors.push("COLON_OR_LONG_DASH");
  const parts=p.draftParagraphs(text);
  if(parts.length===2&&(parts[0].split(/\s+/).length<60||parts[1].split(/\s+/).length<16))errors.push("THIN_PARAGRAPH");
  const normalize=v=>v.toLowerCase().replace(/[^а-яёa-z ]/gu," ").replace(/\s+/g," ").trim();
  const opening=normalize(text).split(" ").slice(0,13).join(" ");
  if(previous.some(v=>normalize(v).split(" ").slice(0,13).join(" ")===opening))errors.push("DUPLICATE_OPENING");
  const grams=v=>{
    const words=normalize(v).split(" ").filter(x=>x.length>3);
    return new Set(words.slice(0,-3).map((_,i)=>words.slice(i,i+4).join(" ")));
  };
  const gramsNew=grams(text);
  for(const old of previous.slice(-60)){
    const gramsOld=grams(old);
    const matched=[...gramsNew].filter(x=>gramsOld.has(x)).length;
    if(matched/Math.max(1,Math.min(gramsNew.size,gramsOld.size))>.61){errors.push("NEAR_DUPLICATE");break;}
  }
  return errors;
}
async function reviewer(text,d){
  const instructions="Проверь ответ на вопрос «"+question.title+"» по дате "+d.day+"-"+d.month+
  ". Внутренне учитываются тени дня "+p.ENERGY_SHADOWS[p.energy22(d.day)]+
  " и месяца "+p.ENERGY_SHADOWS[p.energy22(d.month)]+
  ". Оцени по 10-балльной шкале: прямой ответ, конкретный узнаваемый сюжет, теневые стороны, живой язык, отличие от шаблонного текста и естественная рекомендация УЖЕ ГОТОВОГО вопроса. Строго, без комплиментов. Ответь ТОЛЬКО JSON {\"score\":8,\"pass\":true,\"reason\":\"...\"}, pass=true только при score>=8. Текст:\n"+text;
  const raw=await run([{role:"system",content:"Ты строгий редактор Red Flag. Только JSON."},{role:"user",content:instructions}],170,.1);
  let obj;
  try{obj=JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0]||"{}");}catch{return{pass:false,score:0,reason:"INVALID_REVIEW_JSON"};}
  const score=Number(obj.score)||0;
  return {pass:obj.pass===true&&score>=8,score,reason:String(obj.reason||"").slice(0,150)};
}
async function generate(d){
  const key=d.day+"-"+d.month,previous=Object.values(bank.entries),ctx=context(d);
  let reasons=["NEW"],judgment={pass:false,score:0,reason:""};
  for(let attempt=0;attempt<3;attempt++){
    try{
      const extra=attempt===0?"":"\nПредыдущая попытка была забракована: "+reasons.join(", ")+". "+judgment.reason+
      ". Перепиши с новым конкретным сюжетом и полностью соблюдай ограничения.";
      let answer=await run([{role:"system",content:p.SYSTEM},{role:"user",content:ctx+extra}],attempt===0?650:570,attempt===0?.72:.82);
      answer=p.ensureReadyFollowup(answer,followups);
      reasons=staticIssues(answer,previous);
      if(!reasons.length){
        judgment=await reviewer(answer,d);
        report.checked++;
        if(!judgment.pass)reasons.push("REVIEW_BELOW_8");
      }
      if(!reasons.length){
        bank.entries[key]=answer;
        report.reviewScores[key]=judgment.score;
        save();console.log("PASS "+key+" score="+judgment.score);
        return;
      }
    }catch(e){
      reasons=[String(e.message||e).slice(0,90)];
      if(/WORKERS_AI_HTTP_40\d|AUTH_MISSING|RESULT_FAILED/.test(reasons[0]))throw e;
    }
  }
  bank.flagged[key]={reason:reasons.join(","),review:judgment.reason};
  save();console.log("FLAG "+key+" "+reasons.join(","));
}
save();
console.log("REDFLAG_BATCH_START "+limit+" dates, unpublished JSON artifact only");
if(process.env.SELFTEST==="1"){
  if(dates.length!==1||p.energy22(31)!==4||!ready.has(followups[0]))throw Error("SELFTEST_FAILED");
  console.log("SELFTEST_OK");
}else{
  const concurrency=limit>1?3:1;let cursor=0;
  try{
    await Promise.all(Array.from({length:concurrency},async()=>{
      while(cursor<dates.length){const d=dates[cursor++];await generate(d);}
    }));
  }catch(e){save();throw e;}
  report.finishedAt=new Date().toISOString();save();
  console.log("REDFLAG_BATCH_RESULT accepted="+report.accepted+" flagged="+report.flagged+" requested="+limit);
  if(report.accepted!==limit)process.exitCode=2;
}
