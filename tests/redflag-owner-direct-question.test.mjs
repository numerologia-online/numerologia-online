import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const source=readFileSync("cloudflare/redflag-draft-ai/src/index.js","utf8");
const catalog=JSON.parse(readFileSync("redflag-ai-lab/catalog.json","utf8"));
const flags=catalog.categories.find(category=>category.id==="flags").questions;
assert.equal(flags.length,9);
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const proof="a".repeat(64);
const hash=createHash("sha256").update(proof).digest("hex");
const paragraph="Решение лучше проверять по поступкам, разговорам и готовности учитывать границы женщины в этой конкретной ситуации.";
const outro="Отдельные случаи не дают полной картины, а повторяющееся поведение со временем покажет больше, чем обещания.";
const sample=Array(5).fill(paragraph).join(" ")+"\n\n"+Array(2).fill(outro).join(" ");
assert.ok(sample.length>=750&&sample.length<=1100);
for(const q of flags){
  let received;
  let calls=0;
  const request=new Request("https://example.test/v1/redflag-owner-question",{
    method:"POST",
    headers:{"Content-Type":"application/json","X-Numi-Redflag-Batch":proof},
    body:JSON.stringify({category:"flags",question_id:q.id,title:q.title,day:9,month:9,followups:[]})
  });
  const response=await worker.fetch(request,{
    REDFLAG_BATCH_KEY_SHA256:hash,
    AI:{run:async(_model,options)=>{
      calls++;
      received=options.messages;
      return {response:sample};
    }}
  });
  assert.equal(response.status,200,q.id+" owner route should work");
  const result=await response.json();
  assert.equal(result.ok,true);
  assert.equal(result.draft_only,true);
  assert.equal(result.published,false);
  assert.equal(result.question_id,q.id);
  assert.equal(result.date_key,"9-9");
  assert.equal(calls,1,"No added AI request for a valid answer");
  assert.equal(received.length,2);
  assert.match(received[0].content,/В первом предложении прямо ответь/);
  assert.ok(received[0].content.length<1000);
  assert.ok(!/ледян|молчан|исчезновен|допрос за каждый лайк/u.test(received[0].content));
  assert.ok(received[1].content.includes("Вопрос: "+q.title));
  assert.ok(received[1].content.includes("День рождения мужчины: 9"));
  assert.ok(received[1].content.includes("Месяц рождения мужчины: 9"));
  assert.ok(!/ДРУГИЕ УЖЕ ПОКАЗАННЫЕ|ТЕНЬ дня|ТЕНЬ месяца|рекоменд/u.test(received[1].content));
  assert.equal(received[1].content.split("\n").length,4);
}
// The model often produces a single paragraph, using a colon or long dash.
// It must be formatted into two paragraphs rather than discarded.
let retryCalls=0;
const single=Array(6).fill(paragraph).join(" ")+": "+Array(2).fill(outro).join(" ");
const singleResponse=await worker.fetch(new Request("https://example.test/v1/redflag-owner-question",{
  method:"POST",
  headers:{"Content-Type":"application/json","X-Numi-Redflag-Batch":proof},
  body:JSON.stringify({category:"flags",question_id:"hero",title:flags[1].title,day:9,month:9,followups:[]})
}),{
  REDFLAG_BATCH_KEY_SHA256:hash,
  AI:{run:async()=>{retryCalls++;return {response:single};}}
});
assert.equal(singleResponse.status,200,"A valid one-paragraph model answer should be reformatted");
const singleAnswer=(await singleResponse.json()).answer;
assert.equal(singleAnswer.split(/\n\s*\n/).length,2);
assert.ok(!/[—:]/.test(singleAnswer));
assert.equal(retryCalls,1,"Formatting repair must not trigger another paid inference");

const guest=await worker.fetch(new Request("https://example.test/v1/redflag-owner-question",{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:"{}"
}),{AI:{run:async()=>({response:sample})}});
assert.equal(guest.status,403);
console.log("PASS: 9 owner Red Flag questions use minimal isolated prompt, one mocked AI call each, guest forbidden");
