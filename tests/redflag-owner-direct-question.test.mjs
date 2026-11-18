import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const source=readFileSync("cloudflare/redflag-draft-ai/src/index.js","utf8");
const bridge=readFileSync("redflag-ai-lab/draft.php","utf8");
const catalog=JSON.parse(readFileSync("redflag-ai-lab/catalog.json","utf8"));
const flags=catalog.categories.find(c=>c.id==="flags").questions;
assert.equal(flags.length,9);

// No old owner Red Flag prompts, energy profiles, scripts, CTA, or lint engine.
for(const old of [
  "FLAGS_OWNER_PROMPT","FLAGS_ENERGY_ROWS","FLAGS_NINTH_QUESTION_VIEW",
  "FLAGS_RELATED_FOLLOWUPS","flagsRelatedFollowup","flagsFinishAnswer",
  "flagsOutputValid","flagsGenericPortrait","FLAGS_QUESTION_FOCUS"
])assert.ok(!source.includes(old),"Old flag-only guidance remains: "+old);
assert.ok(!bridge.includes("$publishedRelated"),"Old PHP recommendation palette remains");
assert.ok(bridge.includes("$followups=[]"),"No follow-up hints leave the PHP owner bridge");
assert.match(source,/flags-owner-clean-slate-no-prompt-20261118/);

const begin=source.indexOf('if(input.category==="flags"){');
const end=source.indexOf("const styleTest=url.pathname",begin);
assert.ok(begin>0&&end>begin);
const branch=source.slice(begin,end);
assert.doesNotMatch(branch,/energy22|\\bSYSTEM\\b|OWNER_QUESTION_SYSTEM|followup|шаблон|тен[ьи]|второй абзац/iu);
assert.equal(branch.split("env.AI.run(MODEL").length-1,1,"Exactly one inference in flags");
assert.match(branch,/messages:\[\{role:"user",content:userInput\}\]/,"Owner flag must have no system prompt");
assert.doesNotMatch(branch,/messages:\[\{role:"system"/,"Owner flag must not include old system instructions");

const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const proof="a".repeat(64);
const hash=createHash("sha256").update(proof).digest("hex");
const answer="Ему может быть непросто принять отказ, когда он уверен в своей идее. Если ты говоришь нет, возможны разные реакции, но по одной дате нельзя узнать, как он поведёт себя в реальности. Важно смотреть, слышит ли он твои слова и может ли остановиться без долгих уговоров. Если ты несколько раз объяснила своё решение, а мужчина продолжает давить, это уже заметное поведение, независимо от его дня рождения.\n\nТы сама сможешь оценить, насколько комфортно тебе рядом с ним и уважает ли он границы.";
let calls=0,mode="ok";
const observed=[];
const env={REDFLAG_BATCH_KEY_SHA256:hash,AI:{run:async(model,opts)=>{
  calls++;
  assert.equal(model,"@cf/google/gemma-4-26b-a4b-it");
  observed.push(opts.messages);
  return {response:mode==="empty"?"":answer};
}}};
const makeRequest=(route,category,id,title,day=9,month=9)=>
  new Request("https://example.test"+route,{
    method:"POST",
    headers:{"Content-Type":"application/json","X-Numi-Redflag-Batch":proof},
    body:JSON.stringify({category,question_id:id,title,day,month,followups:[]})
  });
for(const q of flags){
  const result=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags",q.id,q.title),env);
  assert.equal(result.status,200,q.id);
  const got=await result.json();
  assert.equal(got.answer,answer);
  assert.equal(got.draft_only,true);
  assert.equal(got.published,false);
  assert.equal(got.style_version,"flags-owner-clean-slate-no-prompt-20261118");
  assert.equal(observed.at(-1).length,1);
  assert.equal(observed.at(-1)[0].role,"user");
  assert.equal(observed.at(-1)[0].content,"Вопрос: "+q.title+"\nДата рождения: 09.09");
}
assert.equal(calls,9);
const otherDate=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags",flags[0].id,flags[0].title,31,10),env);
assert.equal(otherDate.status,200);
assert.equal(observed.at(-1)[0].content,"Вопрос: "+flags[0].title+"\nДата рождения: 31.10");
assert.equal(calls,10);

const trial=await worker.fetch(makeRequest("/v1/redflag-style-test","flags",flags[1].id,flags[1].title),env);
assert.equal(trial.status,200);
assert.equal((await trial.json()).style_test,true);
assert.equal(calls,11);
const publicAttempt=await worker.fetch(makeRequest("/v1/redflag-draft","flags",flags[1].id,flags[1].title),env);
assert.equal(publicAttempt.status,409,"Customer-facing flags must remain unavailable");
assert.equal(calls,11);
mode="empty";
const empty=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags",flags[1].id,flags[1].title),env);
assert.equal(empty.status,503,"Empty response must not be published or regenerated");
assert.equal(calls,12,"Empty response cannot cause second inference");
mode="ok";

const other=catalog.categories.find(c=>c.id==="infidelity").questions[0];
const otherResponse=await worker.fetch(makeRequest("/v1/redflag-owner-question","infidelity",other.id,other.title),env);
const otherData=await otherResponse.json();
assert.equal(otherResponse.status,200,"Other Red Flag categories must remain intact: "+JSON.stringify(otherData));
assert.equal(otherData.ok,true);
assert.equal(calls,13);

const guest=await worker.fetch(new Request("https://example.test/v1/redflag-owner-question",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({category:"flags",question_id:flags[0].id,title:flags[0].title,day:9,month:9,followups:[]})
}),env);
assert.equal(guest.status,403);
assert.equal(calls,13);
console.log("PASS: protected blank-slate flags uses only date+question, zero prompts, one inference; other categories untouched; customers blocked");
