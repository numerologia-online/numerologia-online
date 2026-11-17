import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const source=readFileSync("cloudflare/redflag-draft-ai/src/index.js","utf8");
const catalog=JSON.parse(readFileSync("redflag-ai-lab/catalog.json","utf8"));
const flags=catalog.categories.find(c=>c.id==="flags").questions;
assert.equal(flags.length,9);
assert.match(source,/flags:"", \/\/ Cleared by owner request/);
assert.match(source,/if\(input.category==="flags"\)/);
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const proof="a".repeat(64);
const hash=createHash("sha256").update(proof).digest("hex");
let calls=0;
const text=("Нельзя судить о характере человека по одному поступку, поэтому стоит замечать повторяющиеся реакции и то, как он обращается с тобой в повседневных ситуациях. ").repeat(4).trim()
  +"\n\n"+"Учитывай конкретные слова, действия и готовность уважать твой выбор, а не чьё-то громкое обещание. Попробуй проверить это в обычном разговоре.";
const env={REDFLAG_BATCH_KEY_SHA256:hash,AI:{run:async()=>{calls++;return {response:text};}}};
const makeRequest=(url,category,id,title)=>new Request("https://example.test"+url,{
  method:"POST",
  headers:{"Content-Type":"application/json","X-Numi-Redflag-Batch":proof},
  body:JSON.stringify({category,question_id:id,title,day:9,month:9,followups:[]})
});
// All nine owner Red Flag questions have no prompt or text, no model calls.
for(const q of flags){
  const res=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags",q.id,q.title),env);
  assert.equal(res.status,409,"Only flags are intentionally cleared");
  const result=await res.json();
  assert.equal(result.error,"FLAGS_PROMPT_CLEARED");
  assert.equal(result.published,false);
}
for(const url of ["/v1/redflag-style-test","/v1/redflag-draft"]){
  const res=await worker.fetch(makeRequest(url,"flags","say-no","Уважает женское «нет» или начинает давить?"),env);
  assert.equal(res.status,409,url+" must not show old text");
}
assert.equal(calls,0,"No flags model inference after the reset");
// One other category still uses its existing connection/instructions.
const other=catalog.categories.find(c=>c.id==="infidelity").questions[0];
const response=await worker.fetch(makeRequest("/v1/redflag-owner-question","infidelity",other.id,other.title),env);
assert.equal(response.status,200,"Other categories must remain functional");
assert.equal((await response.json()).ok,true);
assert.equal(calls,1);
// No owner authorization -> forbidden even though flags are cleared.
const guest=await worker.fetch(new Request("https://example.test/v1/redflag-owner-question",{
  method:"POST",headers:{"Content-Type":"application/json"},body:"{}"
}),env);
assert.equal(guest.status,403);
console.log("PASS: nine flags cleared, free flags disabled, other categories connected, guest denied");
