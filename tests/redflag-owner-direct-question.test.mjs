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
assert.match(source,/style_version:"flags-owner-groq120b-5050-20261118"/);
assert.match(source,/api\.groq\.com\/openai\/v1\/chat\/completions/);
assert.match(source,/FLAGS_GROQ_NOT_CONFIGURED/);
assert.doesNotMatch(source,/FLAGS_ENERGY_PALETTE/);
assert.match(source,/строго равный вес, 50 на 50/);
assert.match(source,/вывод делай только из сочетания/i);
assert.match(source,/const parseFlagsOwnerStructured=/);
assert.match(source,/FLAGS_PRIVATE_RESPONSE_FORMAT/);
assert.match(source,/Сначала пойми, о каком конкретном поступке спрашивает женщина/);
assert.doesNotMatch(source,/const FLAGS_ANALYSIS_PROMPT=/);
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const proof="a".repeat(64);
const hash=createHash("sha256").update(proof).digest("hex");
let calls=0,groqCalls=0;
const observedInputs=[];

const answer="Ему может быть непросто сразу принимать отказ, когда затронуты его интересы. При этом внимательное отношение к границам возможно, если он умеет вести разговор без давления и замечать настроение партнёрши. Оценивать стоит не громкие обещания, а то, как он ведёт себя, когда услышит неудобное для себя решение. Женщина вправе не соглашаться и не объяснять свою позицию по кругу. "
+"\n\nЕсли хочешь проверить его в другой ситуации, посмотри вопрос «Держит слово или опять одни красивые разговоры?». Он поможет по-новому присмотреться к поступкам и понять, совпадают ли слова с делами.";
const structuredAnswer=[
  "<DAY>Первая энергия раскрывается через самостоятельный выбор и отношение к чужому решению.</DAY>",
  "<MONTH>Вторая энергия добавляет другой способ выражать несогласие и искать компромисс.</MONTH>",
  "<COMBINED>Их взаимодействие меняет конкретную реакцию на отказ и её заметные последствия.</COMBINED>",
  "<ANSWER>"+answer+"</ANSWER>"
].join("\n");
const env={REDFLAG_BATCH_KEY_SHA256:hash,GROQ_API_KEY:"gsk_test-only-no-real-secret",AI:{run:async(model,opts)=>{
  calls++;
  assert.equal(opts.messages.length,2);
  if(opts.messages[0].content.includes("Ты опытный нумеролог, работающий с 22 энергиями")){
    assert.match(opts.messages[0].content,/Сначала пойми, о каком конкретном поступке спрашивает женщина/);
    assert.match(opts.messages[0].content,/<DAY>/);
    assert.match(opts.messages[0].content,/<MONTH>/);
    assert.match(opts.messages[0].content,/<COMBINED>/);
    assert.ok(!opts.messages[1].content.includes("Внутренний выбор трактовки"));
    assert.doesNotMatch(opts.messages[1].content,/Палитра энергии|готовые характеристики/);
    assert.ok(opts.messages[0].content.includes("50 на 50"));
    assert.ok(!opts.messages[1].content.includes("ТЕНЬ дня:"));
    observedInputs.push(opts.messages[1].content);
    return {response:structuredAnswer};
  }
  return {response:answer};
}}};
// Simulate Groq's real OpenAI-compatible response; Cloudflare AI must not be
// used for the owner's Red Flag flags test.
globalThis.fetch=async (url,opts)=>{
  groqCalls++;
  assert.equal(url,"https://api.groq.com/openai/v1/chat/completions");
  assert.equal(opts.method,"POST");
  assert.match(opts.headers.Authorization,/^Bearer gsk_test-only/);
  const payload=JSON.parse(opts.body);
  assert.equal(payload.model,"openai/gpt-oss-120b");
  assert.equal(payload.reasoning_effort,"low");
  assert.equal(payload.messages.length,2);
  assert.ok(payload.messages[0].content.includes("50 на 50"));
  assert.match(payload.messages[0].content,/<DAY>/);
  assert.match(payload.messages[0].content,/<MONTH>/);
  assert.match(payload.messages[0].content,/<COMBINED>/);
  assert.doesNotMatch(payload.messages[1].content,/Палитра энергии|ТЕНЬ дня:/);
  observedInputs.push(payload.messages[1].content);
  return new Response(JSON.stringify({choices:[{message:{content:structuredAnswer}}]}),
    {status:200,headers:{"Content-Type":"application/json"}});
};
const makeRequest=(url,category,id,title,followups=[],day=9,month=9)=>new Request("https://example.test"+url,{
  method:"POST",
  headers:{"Content-Type":"application/json","X-Numi-Redflag-Batch":proof},
  body:JSON.stringify({category,question_id:id,title,day,month,followups})
});
const tenRelated=[
  "Держит слово или опять одни красивые разговоры?",
  "Будет опорой для семьи или всё снова окажется на твоих плечах?",
  "Щедрый мужчина или считает каждую копейку?",
  "Пишет первым или ждёт инициативы от женщины?",
  "Верный или у него каждая вторая «просто подруга»?",
  "На каком языке любви он вообще понимает чувства?",
  "Самостоятельный мужчина или мамина корзиночка?",
  "Какой финальный вердикт по этому мужчине без розовых очков?",
  "Будет ли мужчина жить за твой счёт?",
  "Сексуальный огонь или пять минут — и спасибо?"
];
assert.equal(tenRelated.length,10);
// Every owner flags question must reach the model and return its exact output
// (no canned replies, added upsells, rewriting, formatting rules or retries).
for(const q of flags){
  const res=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags",q.id,q.title,
    tenRelated),env);
  assert.equal(res.status,200,q.id+" preview route");
  const json=await res.json();
  assert.equal(json.answer,answer,"Must preserve model output verbatim");
  assert.equal(json.draft_only,true);
  assert.equal(json.published,false);
  assert.equal(json.style_version,"flags-owner-groq120b-5050-20261118");
  assert.equal(json.model,"openai/gpt-oss-120b");
}
// Each question provides a DIFFERENT analysis focus to the AI,
// with no prewritten red-flag scenario or automatic postediting.
const expectedFocus={
  "care-or-control": "границу между заботой и стремлением распоряжаться жизнью женщины",
  "hero": "самооценку мужчины",
  "jealousy": "доверие, отношение к вниманию других мужчин",
  "argument": "обсуждает неудобные темы",
  "abuse-signal": "ранним тревожным сигналом при знакомстве",
  "support-or-cause": "когда женщине тяжело и нужна помощь",
  "apology": "признавать собственную неправоту после ссоры",
  "weak-place": "уязвимая сторона взаимодействия двух энергий",
  "calm-or-swings": "эмоциональную устойчивость и предсказуемость мужчины",
  "say-no": "отношение мужчины к отказу, несогласию"
};
for(let i=0;i<flags.length;i++){
  assert.ok(observedInputs[i].includes(expectedFocus[flags[i].id]),
    "Missing per-question focus for "+flags[i].id);
  assert.equal(observedInputs[i].split("Направление анализа этого вопроса: ").length,2);
}
const first=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags","say-no",
  "Уважает женское «нет» или начинает давить?",tenRelated),env);
assert.equal(first.status,200,"First free question owner preview must work");
assert.equal((await first.json()).answer,answer);
assert.ok(observedInputs[9].includes(expectedFocus["say-no"]),"Free first question must use its own focus");
const trial=await worker.fetch(makeRequest("/v1/redflag-style-test","flags","say-no",
  "Уважает женское «нет» или начинает давить?"),env);
assert.equal(trial.status,200,"Legacy protected owner trial should use same new prompt");
assert.equal((await trial.json()).style_test,true);
assert.equal(groqCalls,11);
// Public flags path remains disabled; must not bill or expose unapproved drafts.
const publicAttempt=await worker.fetch(makeRequest("/v1/redflag-draft","flags","say-no",
  "Уважает женское «нет» или начинает давить?"),env);
assert.equal(publicAttempt.status,409);
assert.equal(groqCalls,11);
assert.equal(calls,0);
// Other categories still reject inputs beyond their original 5-title maximum.
const oversizedOther=await worker.fetch(makeRequest("/v1/redflag-owner-question","infidelity","options",
  "Верный или постоянно ищет запасные варианты?",tenRelated.slice(0,6)),env);
assert.equal(oversizedOther.status,400,"Other categories retain original input limit");
assert.equal(groqCalls,11);
assert.equal(calls,0);
// All other categories retain their existing owner path.
const other=catalog.categories.find(c=>c.id==="infidelity").questions[0];
const otherResponse=await worker.fetch(makeRequest("/v1/redflag-owner-question","infidelity",other.id,other.title),env);
assert.equal(otherResponse.status,200,"Other category unchanged");
assert.equal((await otherResponse.json()).ok,true);
assert.equal(calls,1);
// Separate pair comparison, same month but different day: no generic 9-only payload.
const beforePairs=groqCalls;
for(const [day,month,expectedDayEnergy,expectedMonthEnergy] of [
  [9,1,9,1],[9,3,9,3],[9,9,9,9],[9,10,9,10],[10,9,10,9],[31,10,4,10]
]){
  const pair=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags","say-no",
    "Уважает женское «нет» или начинает давить?",tenRelated,day,month),env);
  assert.equal(pair.status,200,"Valid pair "+day+"-"+month);
  const payload=observedInputs.at(-1);
  assert.ok(payload.includes("День рождения мужчины: "+day+" (энергия "+expectedDayEnergy+")"),"Day energy "+day);
  assert.ok(payload.includes("Месяц рождения мужчины: "+month+" (энергия "+expectedMonthEnergy+")"),"Month energy "+month);
  assert.ok(!payload.includes("<DAY>"),"Service notes must only be in private model prompt");
}
assert.equal(groqCalls,beforePairs+6,"One Groq inference per day/month pair");
const guest=await worker.fetch(new Request("https://example.test/v1/redflag-owner-question",{
  method:"POST",headers:{"Content-Type":"application/json"},body:"{}"
}),env);
assert.equal(guest.status,403);
assert.equal(observedInputs.length,17,"One AI call for each owner flags request, including six date pairs");
console.log("PASS: owner-only flags use actual Groq 120B without Gemma fallback; no preset palette; other categories and customer routes intact");
