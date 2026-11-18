import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const source=readFileSync("cloudflare/redflag-draft-ai/src/index.js","utf8");
const catalog=JSON.parse(readFileSync("redflag-ai-lab/catalog.json","utf8"));
const flags=catalog.categories.find(c=>c.id==="flags").questions;
assert.equal(flags.length,9,"Published question catalog must stay intact");
assert.match(source,/const MODEL="@cf\/google\/gemma-4-26b-a4b-it"/);
assert.match(source,/FLAGS_PROMPT_NOT_CONFIGURED/);
assert.doesNotMatch(source,/const FLAGS_OWNER_PROMPT=/);
assert.doesNotMatch(source,/const FLAGS_ENERGY_ROWS=/);
assert.doesNotMatch(source,/const FLAGS_NINTH_QUESTION_VIEW=/);
assert.doesNotMatch(source,/const FLAGS_QUESTION_FOCUS=/);
assert.doesNotMatch(source,/const flagsFinishAnswer=/);
const start=source.indexOf('    if(input.category==="flags"){');
const end=source.indexOf('    const styleTest=url.pathname',start);
assert.ok(start>0&&end>start,"Owner flags route must remain isolated");
const flagsRoute=source.slice(start,end);
assert.doesNotMatch(flagsRoute,/env\.AI\.run|messages:|input\.day|input\.month|input\.title|input\.followups/);
assert.match(flagsRoute,/FLAGS_NOT_PUBLISHED/);
assert.match(flagsRoute,/FLAGS_PROMPT_NOT_CONFIGURED/);
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const proof="a".repeat(64);
const hash=createHash("sha256").update(proof).digest("hex");
let calls=0;
const answer="Ему может быть непросто сразу принять отказ, когда его желания расходятся с твоими. В таком сочетании он может сначала настаивать на своём, а потом вполне спокойно обсуждать твоё решение, если слышит аргументы и не принимает каждое возражение за личную обиду. Поэтому здесь важно не угадывать мысли и не проверять мужчину на прочность, а смотреть, действительно ли он признаёт твоё право выбирать и умеет вовремя остановиться. Отговорки и обещания сами по себе ничего не доказывают."
+"\n\nЕсли хочешь увидеть, насколько его слова совпадают с поступками в других ситуациях, посмотри вопрос «Держит слово или опять одни красивые разговоры?». Это поможет не принимать красивые речи за уже сделанные дела.";
const env={REDFLAG_BATCH_KEY_SHA256:hash,AI:{run:async(model)=>{
  calls++;
  assert.equal(model,"@cf/google/gemma-4-26b-a4b-it");
  return {response:answer};
}}};
const req=(route,category,id,title,followups=[],day=9,month=9,authorized=true)=>
  new Request("https://example.test"+route,{
    method:"POST",
    headers:{"Content-Type":"application/json",...(authorized?{"X-Numi-Redflag-Batch":proof}:{})},
    body:JSON.stringify({category,question_id:id,title,day,month,followups})
  });
const health=await worker.fetch(new Request("https://example.test/health"),env);
assert.equal(health.status,200);
assert.equal((await health.json()).ai_bound,true,"AI binding must remain connected");
for(const q of flags){
  const response=await worker.fetch(req("/v1/redflag-owner-question","flags",q.id,q.title),env);
  assert.equal(response.status,409,q.id);
  const data=await response.json();
  assert.equal(data.error,"FLAGS_PROMPT_NOT_CONFIGURED");
  assert.equal(data.published,false);
  assert.equal(data.draft_only,true);
}
const style=await worker.fetch(req("/v1/redflag-style-test","flags",flags[0].id,flags[0].title),env);
assert.equal(style.status,409);
assert.equal((await style.json()).error,"FLAGS_PROMPT_NOT_CONFIGURED");
const consumer=await worker.fetch(req("/v1/redflag-draft","flags",flags[0].id,flags[0].title),env);
assert.equal(consumer.status,409);
assert.equal((await consumer.json()).error,"FLAGS_NOT_PUBLISHED");
assert.equal(calls,0,"Blank flags preview must not call model or send dates/energies/prompts");
const guest=await worker.fetch(req("/v1/redflag-owner-question","flags",flags[0].id,flags[0].title,[],9,9,false),env);
assert.equal(guest.status,403,"Owner endpoint must remain protected");
const infidelity=catalog.categories.find(c=>c.id==="infidelity").questions[0];
const other=await worker.fetch(req("/v1/redflag-owner-question","infidelity",infidelity.id,infidelity.title),env);
const data=await other.json();
assert.equal(other.status,200,"Other Red Flag categories must remain working: "+JSON.stringify(data));
assert.equal(data.ok,true);
assert.ok(calls>=1,"Other categories must still reach bound model");
console.log("PASS: only Красные флаги wiped; Gemma connection retained; zero owner prompt/energy data; other categories intact; public blocked");
