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
assert.match(source,/style_version:"flags-owner-question-first-single-20261118"/);
assert.match(source,/Сначала определи суть заданного вопроса/);
assert.doesNotMatch(source,/const FLAGS_ANALYSIS_PROMPT=/);
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const proof="a".repeat(64);
const hash=createHash("sha256").update(proof).digest("hex");
let calls=0;
const observedInputs=[];
const answer="Ему может быть непросто сразу принимать отказ, когда затронуты его интересы. При этом внимательное отношение к границам возможно, если он умеет вести разговор без давления и замечать настроение партнёрши. Оценивать стоит не громкие обещания, а то, как он ведёт себя, когда услышит неудобное для себя решение. Женщина вправе не соглашаться и не объяснять свою позицию по кругу. "
+"\n\nЕсли хочешь проверить его в другой ситуации, посмотри вопрос «Держит слово или опять одни красивые разговоры?». Он поможет по-новому присмотреться к поступкам и понять, совпадают ли слова с делами.";
const env={REDFLAG_BATCH_KEY_SHA256:hash,AI:{run:async(model,opts)=>{
  calls++;
  assert.equal(opts.messages.length,2);
  if(opts.messages[0].content.includes("Ты опытный нумеролог, работающий с 22 энергиями")){
    assert.match(opts.messages[0].content,/Сначала определи суть заданного вопроса/);
    assert.ok(!opts.messages[1].content.includes("Внутренний выбор трактовки"));
    observedInputs.push(opts.messages[1].content);
  }
  return {response:answer};
}}};
const makeRequest=(url,category,id,title,followups=[])=>new Request("https://example.test"+url,{
  method:"POST",
  headers:{"Content-Type":"application/json","X-Numi-Redflag-Batch":proof},
  body:JSON.stringify({category,question_id:id,title,day:9,month:9,followups})
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
  assert.equal(json.style_version,"flags-owner-question-first-single-20261118");
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
assert.equal(calls,11);
// Public flags path remains disabled; must not bill or expose unapproved drafts.
const publicAttempt=await worker.fetch(makeRequest("/v1/redflag-draft","flags","say-no",
  "Уважает женское «нет» или начинает давить?"),env);
assert.equal(publicAttempt.status,409);
assert.equal(calls,11);
// Other categories still reject inputs beyond their original 5-title maximum.
const oversizedOther=await worker.fetch(makeRequest("/v1/redflag-owner-question","infidelity","options",
  "Верный или постоянно ищет запасные варианты?",tenRelated.slice(0,6)),env);
assert.equal(oversizedOther.status,400,"Other categories retain original input limit");
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
assert.equal(observedInputs.length,11,"Exactly one AI call per owner flags question");
console.log("PASS: flags uses one question-first owner AI call; 10 questions work; public flags blocked; other sections intact");
