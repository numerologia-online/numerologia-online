import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync("cloudflare/moment-300-ai/src/index.js","utf8");
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const sampleText="О чувствах человека нельзя судить достоверно только по дате рождения. Смотрите на поступки и взаимность, а символический расчёт используйте лишь как дополнительный ракурс.";
async function inspect(questionId,man,moment){
  let messages;
  const env={
    MOMENT_BRIDGE_SECRET:"test-only-bridge",
    GROQ_API_KEY:"gsk_test_only_not_a_real_key"
  };
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,"https://api.groq.com/openai/v1/chat/completions");
    assert.equal(options.headers.Authorization,"Bearer "+env.GROQ_API_KEY);
    const payload=JSON.parse(options.body);
    assert.equal(payload.model,"openai/gpt-oss-120b");
    assert.equal(payload.include_reasoning,false);
    assert.equal(Object.hasOwn(payload,"reasoning_format"),false,"GPT-OSS rejects reasoning_format");
    messages=payload.messages;
    return Response.json({choices:[{message:{content:sampleText},finish_reason:"stop"}]});
  };
  const req=new Request("https://example.test/v1/owner-preview",{
    method:"POST",
    headers:{"Content-Type":"application/json","X-Numi-Moment-Secret":"test-only-bridge"},
    body:JSON.stringify({
      question_id:questionId,
      title:questionId==="love-001"?"Что он чувствует ко мне?":"Вспоминает ли он обо мне?",
      birth_date:"1988-02-14",
      other_date:man,
      moment
    })
  });
  let res;
  try { res=await worker.fetch(req,env); }
  finally { globalThis.fetch=originalFetch; }
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.ok,true);
  assert.equal(data.provider,"groq");
  assert.ok(messages);
  const note=messages[1].content.split("\n").find(line=>line.includes("заранее рассчитанные показатели"));
  const feelingLine=messages[1].content.split("\n").find(line=>line.includes("ВНУТРЕННИЙ ориентир для прямого ответа про ЧУВСТВА:"));
  return {
    messages,
    values:note?JSON.parse(note.slice(note.indexOf("{"))):null,
    feeling:feelingLine?JSON.parse(feelingLine.slice(feelingLine.indexOf("{"))):null
  };
}
const sameDayMonthOlder=await inspect("love-001","1985-10-31","2026-11-17T11:20");
const sameDayMonthYounger=await inspect("love-001","1997-10-31","2026-11-17T11:20");
const nextCalendarMonth=await inspect("love-001","1985-10-31","2026-12-17T11:20");
const differentDay=await inspect("love-001","1985-10-10","2026-11-17T11:20");
const anotherQuestion=await inspect("love-002","1985-10-31","2026-11-17T11:20");
const a=sameDayMonthOlder.values,b=sameDayMonthYounger.values,c=nextCalendarMonth.values,d=differentDay.values;
assert.ok(a&&b&&c&&d,"love-001 must calculate a distinct full-date profile");
assert.notEqual(a.maleLifePath,b.maleLifePath);
assert.notEqual(a.maleBirthYearCode,b.maleBirthYearCode);
assert.notEqual(a.maleAge,b.maleAge);
assert.notEqual(a.maleAgeCycle,b.maleAgeCycle);
assert.notEqual(a.birthYearInteraction,b.birthYearInteraction);
assert.notEqual(a.maleMonth,c.maleMonth);
assert.notEqual(a.womanMonth,c.womanMonth);
assert.notEqual(a.pairMonth,c.pairMonth);
assert.notEqual(a.manDay,d.manDay);
assert.ok(sameDayMonthOlder.feeling && sameDayMonthYounger.feeling && nextCalendarMonth.feeling);
assert.notEqual(sameDayMonthOlder.feeling.baseline,sameDayMonthYounger.feeling.baseline,
  "same day/month but different birth years must differ in emotional baseline");
assert.notEqual(sameDayMonthOlder.feeling.towardHer,sameDayMonthYounger.feeling.towardHer,
  "different full dates must produce a different pair feeling");
assert.notEqual(sameDayMonthOlder.feeling.now,nextCalendarMonth.feeling.now,
  "next calendar month must change the current emotional shade");
assert.equal(sameDayMonthOlder.feeling.baseline,nextCalendarMonth.feeling.baseline,
  "changing the month must not arbitrarily change baseline emotional style");
assert.match(sameDayMonthOlder.messages[0].content,/ПОЛНЫЕ даты рождения/);
assert.match(sameDayMonthOlder.messages[0].content,/К ЭТОЙ ЖЕНЩИНЕ/);
assert.match(sameDayMonthOlder.messages[0].content,/Первые 2 предложения о КОНКРЕТНЫХ чувствах/);
assert.match(sameDayMonthOlder.messages[0].content,/СТРОГО НЕ ПИШИ В ОТВЕТЕ/);
assert.doesNotMatch(sameDayMonthOlder.messages[1].content,/Приоритет трактовки:/);
assert.notEqual(anotherQuestion.messages[0].content,sameDayMonthOlder.messages[0].content);
assert.equal(anotherQuestion.values,null,"other 299 questions must keep existing prompt");
assert.equal(anotherQuestion.feeling,null,"other 299 must not use first-question feelings lens");
const health=await worker.fetch(new Request("https://example.test/health"),{GROQ_API_KEY:"gsk_test_only"});
assert.equal(health.status,200);
const status=await health.json();
assert.equal(status.love001_cycle_version,"full-birthdate-two-person-monthly-20261117");
assert.equal(status.live_answers_enabled,false);
assert.equal(status.provider,"groq");
assert.equal(status.groq_key_bound,true);
assert.equal(status.workers_ai_used,false);
assert.equal(status.provider_version,"groq-direct-20261119");
assert.equal(status.love001_emotion_version,"direct-feelings-20261117");
assert.equal(status.redflag_owner_model,undefined,"No model details for retired module");
const unauthorized=await worker.fetch(new Request("https://example.test/v1/redflag-draft",{
  method:"POST",headers:{"Content-Type":"application/json"},body:"{}"
}),{});
assert.equal(unauthorized.status,404,"Retired route must not reach a model");
const transportEnv={MOMENT_BRIDGE_SECRET:"test-only-bridge",GROQ_API_KEY:"gsk_test_only"};
const metadataFetch=globalThis.fetch;
let metadataCalls=0;
try{
  globalThis.fetch=async(url,options)=>{
    metadataCalls++;
    assert.equal(options.method,"GET");
    assert.equal(url,"https://api.groq.com/openai/v1/models");
    return Response.json({data:[{id:"openai/gpt-oss-120b"}]});
  };
  const denied=await worker.fetch(new Request("https://example.test/health",{headers:{"X-Numi-Moment-Check":"provider-metadata"}}),transportEnv);
  assert.equal(denied.status,403);
  assert.equal(metadataCalls,0,"Public callers cannot request provider metadata");
  const result=await worker.fetch(new Request("https://example.test/health",{headers:{"X-Numi-Moment-Check":"provider-metadata","X-Numi-Moment-Secret":"test-only-bridge"}}),transportEnv);
  const metadata=await result.json();
  assert.equal(metadata.provider_http,200);
  assert.equal(metadata.model_available,true);
  assert.equal(metadataCalls,1,"Diagnostics must only list models and never generate an answer");
}finally{globalThis.fetch=metadataFetch;}
function transportRequest(authenticated=true){
  return new Request("https://example.test/v1/owner-preview",{
    method:"POST",
    headers:{"Content-Type":"application/json",...(authenticated?{"X-Numi-Moment-Secret":"test-only-bridge"}:{})},
    body:JSON.stringify({question_id:"love-002",title:"Вспоминает ли он обо мне?",birth_date:"1988-02-14",other_date:"1985-10-31"})
  });
}
const originalFetch=globalThis.fetch;
let calls=0;
try{
  globalThis.fetch=async()=>{calls++;throw Error("Network must not be used");};
  const denied=await worker.fetch(transportRequest(false),transportEnv);
  assert.equal(denied.status,403);
  const missingKey=await worker.fetch(transportRequest(),{MOMENT_BRIDGE_SECRET:"test-only-bridge"});
  assert.equal(missingKey.status,503);
  assert.equal((await missingKey.json()).error,"GROQ_KEY_MISSING");
  assert.equal(calls,0,"Rejected requests must not call either provider");
  for(const statusCode of [401,403,429]){
    calls=0;
    globalThis.fetch=async()=>{calls++;return Response.json({error:{message:"provider rejected"}},{status:statusCode});};
    const response=await worker.fetch(transportRequest(),transportEnv);
    assert.equal(response.status,statusCode===429?429:503);
    assert.equal((await response.json()).error,statusCode===429?"MODEL_RATE_LIMITED":"MODEL_UNAVAILABLE");
    assert.equal(calls,1,"Never retry or fall back to Workers AI");
  }
  globalThis.fetch=async()=>Response.json({choices:[{message:{content:sampleText},finish_reason:"length"}]});
  const truncated=await worker.fetch(transportRequest(),transportEnv);
  assert.equal(truncated.status,503,"A truncated provider response must not become a completed answer");
}finally{globalThis.fetch=originalFetch;}
console.log("PASS: direct Groq only, auth before inference, limits, no retries or Workers AI fallback");
console.log("PASS: love-001 full birth years, age cycles, both personal months, other 299 isolated");

