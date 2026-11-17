import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const source=readFileSync("cloudflare/redflag-draft-ai/src/index.js","utf8");
const catalog=JSON.parse(readFileSync("redflag-ai-lab/catalog.json","utf8"));
const flags=catalog.categories.find(c=>c.id==="flags").questions;
assert.equal(flags.length,9);
assert.match(source,/const FLAGS_OWNER_PROMPT=/);
assert.match(source,/if\(input.category==="flags"\)/);
assert.match(source,/category:input.category,question_id:input.question_id/);
assert.match(source,/style_version:"flags-owner-approved-20261117"/);
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const proof="a".repeat(64);
const hash=createHash("sha256").update(proof).digest("hex");
let calls=0;
const answer="Ему может быть непросто сразу принимать отказ, когда затронуты его интересы. При этом внимательное отношение к границам возможно, если он умеет вести разговор без давления и замечать настроение партнёрши. Оценивать стоит не громкие обещания, а то, как он ведёт себя, когда услышит неудобное для себя решение. Женщина вправе не соглашаться и не объяснять свою позицию по кругу. "
+"\n\nЕсли хочешь проверить его в другой ситуации, посмотри вопрос «Держит слово или опять одни красивые разговоры?». Он поможет по-новому присмотреться к поступкам и понять, совпадают ли слова с делами.";
const env={REDFLAG_BATCH_KEY_SHA256:hash,AI:{run:async(opts)=>{calls++;assert.equal(opts.messages.length,2);return {response:answer};}}};
const makeRequest=(url,category,id,title,followups=[])=>new Request("https://example.test"+url,{
  method:"POST",
  headers:{"Content-Type":"application/json","X-Numi-Redflag-Batch":proof},
  body:JSON.stringify({category,question_id:id,title,day:9,month:9,followups})
});
// Every owner flags question must reach the model and return its exact output
// (no canned replies, added upsells, rewriting, formatting rules or retries).
for(const q of flags){
  const res=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags",q.id,q.title,
    ["Держит слово или опять одни красивые разговоры?"]),env);
  assert.equal(res.status,200,q.id+" preview route");
  const json=await res.json();
  assert.equal(json.answer,answer,"Must preserve model output verbatim");
  assert.equal(json.draft_only,true);
  assert.equal(json.published,false);
  assert.equal(json.style_version,"flags-owner-approved-20261117");
}
const first=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags","say-no",
  "Уважает женское «нет» или начинает давить?"),env);
assert.equal(first.status,200,"First free question owner preview must work");
assert.equal((await first.json()).answer,answer);
const trial=await worker.fetch(makeRequest("/v1/redflag-style-test","flags","say-no",
  "Уважает женское «нет» или начинает давить?"),env);
assert.equal(trial.status,200,"Legacy protected owner trial should use same new prompt");
assert.equal((await trial.json()).style_test,true);
assert.equal(calls,11);
// Public flags path remains disabled; must not bill or expose unapproved drafts.
const publicAttempt=await worker.fetch(makeRequest("/v1/redflag-draft","flags","say-no",
  "Уважает женское «нет» или начинает давить?"),env);
assert.equal(publicAttempt.status,409);
assert.equal(calls,11);
// All other categories retain their existing owner path.
const other=catalog.categories.find(c=>c.id==="infidelity").questions[0];
const otherResponse=await worker.fetch(makeRequest("/v1/redflag-owner-question","infidelity",other.id,other.title),env);
assert.equal(otherResponse.status,200,"Other category unchanged");
assert.equal((await otherResponse.json()).ok,true);
assert.equal(calls,12);
const guest=await worker.fetch(new Request("https://example.test/v1/redflag-owner-question",{
  method:"POST",headers:{"Content-Type":"application/json"},body:"{}"
}),env);
assert.equal(guest.status,403);
console.log("PASS: only approved prompt for flags; 10 owner tests work; public flags blocked; others intact");
