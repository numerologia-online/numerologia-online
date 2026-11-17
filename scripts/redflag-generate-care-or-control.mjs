#!/usr/bin/env node
/* Generate precisely ONE unpublished Red Flag question bank.
 * No wallet, customer content, manifest or site edits.
 * Runs only from approved GitHub Action using account-scoped secret.
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from "node:fs";
import {dirname} from "node:path";

const SRC="cloudflare/redflag-draft-ai/src/index.js";
const raw=readFileSync(SRC,"utf8");
const prefix=raw.slice(0,raw.indexOf("export default {"));
if(!prefix.includes("const SYSTEM="))throw Error("Worker source prompt missing");
const {SYSTEM,CATEGORY_RULES,ENERGY_SHADOWS,energy22,validDraft,hiddenCalculationLeak,
       draftParagraphs,ensureReadyFollowup,normalizeDraft}=
  new Function(prefix+"\nreturn {SYSTEM,CATEGORY_RULES,ENERGY_SHADOWS,energy22,validDraft,hiddenCalculationLeak,draftParagraphs,ensureReadyFollowup,normalizeDraft};")();

const CATEGORY="flags",ID="care-or-control";
const TITLE="Заботится или будет контролировать каждый твой шаг?";
const READY=[
  "Уважает женское «нет» или начинает давить?",
  "Верный или у него каждая вторая «просто подруга»?",
  "Держит слово или опять одни красивые разговоры?"
];
const OUTPUT="data/redflag/ai-drafts/flags/care-or-control.json";
const account="de77758c4b3efd26fef26ab600cb02a2";
const model="@cf/google/gemma-4-26b-a4b-it";
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error("Workers AI API token missing (never print secret)");
const mode=process.env.REDFLAG_GENERATION_MODE||"pilot";
if(!["pilot","all"].includes(mode))throw Error("Invalid generation mode");

const days=[];
for(let month=1;month<=12;month++){
 const limit=new Date(Date.UTC(2000,month,0)).getUTCDate();
 for(let day=1;day<=limit;day++)days.push({day,month,key:day+"-"+month});
}
if(days.length!==366)throw Error("Expected 366 day-month combinations");
const selected=mode==="pilot"?[
 {day:1,month:1,key:"1-1"},{day:9,month:9,key:"9-9"},
 {day:31,month:10,key:"31-10"},{day:13,month:7,key:"13-7"},
 {day:22,month:2,key:"22-2"},{day:29,month:2,key:"29-2"}
]:days;

let prior={};
if(existsSync(OUTPUT)){
 const current=JSON.parse(readFileSync(OUTPUT,"utf8"));
 if(current.section!==CATEGORY||current.questionId!==ID||current.status!=="draft")
   throw Error("Refuse to overwrite unknown bank schema");
 prior=current.entries||{};
}
const entries={...prior},quality={};
const endpoint="https://api.cloudflare.com/client/v4/accounts/"+account+"/ai/run/"+model;
const headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function runModel(messages,temperature=0.76){
 for(let trial=1;trial<=3;trial++){
  let response;
  try{
   response=await fetch(endpoint,{
      method:"POST",headers,
      body:JSON.stringify({messages,temperature,max_completion_tokens:630,chat_template_kwargs:{enable_thinking:false}}),
      signal:AbortSignal.timeout(95000)
   });
  }catch(e){
   if(trial>=3)throw Error("Workers AI connection failed: "+String(e?.name||"network"));
   await sleep(900*trial);continue;
  }
  if(response.status===401||response.status===403)
    throw Error("Workers AI token lacks inference permission (HTTP "+response.status+"). The existing live worker is unchanged.");
  if(response.status===429||response.status>=500){
   if(trial<3){await sleep(trial*2200);continue;}
  }
  if(!response.ok)throw Error("Workers AI HTTP "+response.status+" (body intentionally not logged)");
  let body;
  try{body=await response.json();}catch{throw Error("Non-JSON Workers AI response");}
  const reply=body?.result?.response??body?.result?.choices?.[0]?.message?.content??
      body?.response??body?.choices?.[0]?.message?.content;
  if(typeof reply!=="string")throw Error("Missing model response, envelope keys "+Object.keys(body||{}).join(","));
  return normalizeDraft(reply);
 }
 throw Error("Workers AI retries exhausted");
}
function prompt({day,month,key}){
 const d=energy22(day),m=energy22(month);
 return [
  "Категория: "+CATEGORY,
  "Вопрос: "+TITLE,
  "Комбинация даты: "+key,
  "День: исходное "+day+", энергия "+d+", тень: "+ENERGY_SHADOWS[d]+".",
  "Месяц: исходное "+month+", энергия "+m+", тень: "+ENERGY_SHADOWS[m]+".",
  "Совместный акцент "+energy22(d+m)+". Внутренняя разница "+energy22(Math.abs(d-m)||22)+".",
  "Применяй ОБЕ энергии, но НИКОГДА НЕ НАЗЫВАЙ их в готовом ответе.",
  "Категория: "+CATEGORY_RULES[CATEGORY],
  "Обязательно закончи вторым абзацем с рекомендацией конкретного ГОТОВОГО вопроса из списка: "+JSON.stringify(READY),
  "Учитывай исходное число дня, не повторяй базовый портрет во всех ответах.",
  "Напиши единственный готовый текст из двух абзацев."
 ].join("\n");
}
function qa(text){
 const issues=[];
 const paras=draftParagraphs(text);
 const words=text.trim().split(/\s+/).length;
 if(!validDraft(text))issues.push("length_or_format_or_energy");
 if(hiddenCalculationLeak(text))issues.push("energy_reference");
 if(!paras[1]||!READY.some(q=>paras[1].includes(q)))issues.push("missing_ready_followup");
 if(/[:—]/.test(text))issues.push("colon_or_em_dash");
 if(words<80||words>190)issues.push("word_count");
 return [...new Set(issues)];
}
async function generate(record){
 const user=prompt(record);
 const messages=[{role:"system",content:SYSTEM},{role:"user",content:user}];
 let answer=await runModel(messages);
 let issues=qa(answer);
 if(issues.length){
  const revised=[...messages,{role:"assistant",content:answer},
    {role:"user",content:"Исправь замечания: "+issues.join(",")+
    ". Ровно два абзаца, 80–150 русских слов. Первое предложение прямо отвечает о контроле, текст живой и дерзкий без формул, ни единой девятки или упоминания энергий, без длинных тире и двоеточий. Второй абзац предлагает по точному названию ОДИН готовый вопрос из списка "+JSON.stringify(READY)+". Только итоговый текст."}];
  answer=await runModel(revised,0.65);
 }
 answer=ensureReadyFollowup(answer,READY);
 const problems=qa(answer);
 return {answer,problems};
}
function save(){
 mkdirSync(dirname(OUTPUT),{recursive:true});
 const sorted=Object.fromEntries(days.filter(d=>typeof entries[d.key]==="string").map(d=>[d.key,entries[d.key]]));
 const checks=Object.fromEntries(days.filter(d=>quality[d.key]?.length).map(d=>[d.key,quality[d.key]]));
 const result={
  schemaVersion:2,section:CATEGORY,questionId:ID,question:TITLE,
  keyRule:"day-month",status:"draft",autoPublish:false,
  source:"Cloudflare Workers AI batch v1",entries:sorted,
  qualitySummary:{generated:Object.keys(sorted).length,
    flagged:Object.keys(checks).length,issues:checks}
 };
 writeFileSync(OUTPUT,JSON.stringify(result,null,2)+"\n");
}
let generated=0,flagged=0;
for(const record of selected){
 if(typeof entries[record.key]==="string"&&entries[record.key].length>500)continue;
 try{
  const {answer,problems}=await generate(record);
  entries[record.key]=answer;quality[record.key]=problems;
  generated++;if(problems.length)flagged++;
  if(generated%6===0){save();console.log("progress",generated,"of",selected.length,"flagged",flagged);}
 }catch(e){
  save();
  console.error("Generation stopped at",record.key,"after",generated,"new entries:",String(e?.message||"failure"));
  process.exitCode=2;break;
 }
}
save();
console.log("BATCH_DONE",JSON.stringify({mode,generatedThisRun:generated,
  saved:Object.keys(entries).length,flaggedThisRun:flagged,
  file:OUTPUT,published:false}));
if(mode==="all"&&Object.keys(entries).length!==366)process.exitCode=2;
