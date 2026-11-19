import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const source=readFileSync("cloudflare/redflag-draft-ai/src/index.js","utf8");
const catalog=JSON.parse(readFileSync("redflag-ai-lab/catalog.json","utf8"));
const flags=catalog.categories.find(c=>c.id==="flags").questions;
assert.equal(flags.length,9,"Question catalog is unchanged");
assert.match(source,/const MODEL="@cf\/google\/gemma-4-26b-a4b-it"/);
assert.doesNotMatch(source,/const FLAGS_ENERGY_ROWS=/);
assert.doesNotMatch(source,/const FLAGS_QUESTION_FOCUS=/);
const start=source.indexOf('    if(input.category==="flags"){');
const end=source.indexOf("    const styleTest=url.pathname",start);
assert.ok(start>0&&end>start);
const route=source.slice(start,end);
assert.match(route,/flagsSystem/);
assert.match(route,/энергии даты рождения, день и месяц/);
assert.match(route,/одинаковую значимость/);
assert.match(route,/input\.day/);
assert.match(route,/input\.month/);
assert.match(route,/env\.AI\.run\(MODEL/);
assert.match(route,/FLAGS_NOT_PUBLISHED/);
assert.doesNotMatch(route,/ENERGY_SHADOWS|CATEGORY_RULES|ensureReadyFollowup/);

const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const proof="a".repeat(64);
const hash=createHash("sha256").update(proof).digest("hex");
const answer="Он может выслушать твоё «нет», но в неудобный для себя момент попытается вернуть разговор к тому, чего хочет сам. В таких ситуациях важно не путать заботу с настойчивостью. Один раз предложить своё решение нормально, но повторять его после твоего отказа уже совсем другая история. Здесь лучше смотреть, насколько спокойно он способен остановиться, когда твоё желание не совпало с его планами. Его слова могут звучать красиво, но уважение видно по тому, оставляет ли он тебе право решать самой."
+"\n\nЕсли границы действительно уважают, не приходится каждый раз доказывать, что твой выбор имеет значение. У такого мужчины можно заметить и хорошие проявления, но окончательно судить стоит по поступкам, а не по обещаниям.";
let calls=[];
const env={REDFLAG_BATCH_KEY_SHA256:hash,AI:{run:async(model,params)=>{
  assert.equal(model,"@cf/google/gemma-4-26b-a4b-it");
  calls.push(params);
  return {response:answer};
}}};
const req=(route,category,id,title,day=9,month=9,authorized=true)=>
  new Request("https://example.test"+route,{method:"POST",
    headers:{"Content-Type":"application/json",...(authorized?{"X-Numi-Redflag-Batch":proof}:{})},
    body:JSON.stringify({category,question_id:id,title,day,month,followups:[]})
  });

const health=await worker.fetch(new Request("https://example.test/health"),env);
assert.equal(health.status,200);
assert.equal((await health.json()).live_answers_enabled,false);
for(let month=1;month<=12;month++){
  const r=await worker.fetch(req("/v1/redflag-owner-question","flags",
    "say-no","Уважает женское «нет» или начинает давить?",9,month),env);
  const d=await r.json();
  assert.equal(r.status,200,JSON.stringify(d));
  assert.equal(d.draft_only,true);
  assert.equal(d.published,false);
  assert.equal(d.date_key,"9-"+month);
  assert.equal(d.model,"@cf/google/gemma-4-26b-a4b-it");
  assert.equal(d.style_version,"flags-free-voice-equal-day-month-20261119");
  assert.ok(d.answer.length>=380);
  const messages=calls.at(-1).messages;
  assert.match(messages[0].content,/одинаковую значимость/);
  assert.match(messages[1].content,new RegExp("Месяц рождения мужчины: "+month+";"));
  assert.match(messages[1].content,/День рождения мужчины: 9;/);
}
const consumer=await worker.fetch(req("/v1/redflag-draft","flags","say-no",
  "Уважает женское «нет» или начинает давить?"),env);
assert.equal(consumer.status,409);
assert.equal((await consumer.json()).error,"FLAGS_NOT_PUBLISHED");
const unauthorized=await worker.fetch(req("/v1/redflag-owner-question","flags","say-no",
  "Уважает женское «нет» или начинает давить?",9,9,false),env);
assert.equal(unauthorized.status,403);
const otherCategory=catalog.categories.find(c=>c.id==="infidelity");
const firstOther=otherCategory.questions[0];
const other=await worker.fetch(req("/v1/redflag-owner-question","infidelity",firstOther.id,firstOther.title),env);
assert.equal(other.status,200,"Other categories must remain untouched");
assert.equal((await other.json()).draft_only,true);
assert.ok(calls.length>=13);
console.log("PASS: 12 months owner-only mocked Gemma responses; day and month equal; public flags blocked; all other categories untouched");
