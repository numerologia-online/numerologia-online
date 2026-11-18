import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const source=readFileSync("cloudflare/redflag-draft-ai/src/index.js","utf8");
const catalog=JSON.parse(readFileSync("redflag-ai-lab/catalog.json","utf8"));
const flags=catalog.categories.find(c=>c.id==="flags").questions;
assert.equal(flags.length,9);
assert.match(source,/flags-owner-gemma4-open-interpretation-20261118/);
assert.match(source,/энергию дня и энергию месяца на равных/i);
assert.match(source,/как одна меняет проявление другой/i);
assert.match(source,/Если месяц меняется/i);
assert.match(source,/Для разных вопросов одной даты/i);
assert.match(source,/const FLAGS_ENERGY_ARCHETYPES=/);
assert.match(source,/const flagsEnergyEvidence=/);
assert.doesNotMatch(source,/const FLAGS_NINTH_QUESTION_VIEW=/);
assert.doesNotMatch(source,/const FLAGS_QUESTION_FACETS=/);
assert.match(source,/const flagsFinishAnswer=/);
assert.match(source,/const FLAGS_QUESTION_FACETS=/);
assert.match(source,/Краткий ориентир дня:/);
assert.match(source,/Краткий ориентир месяца:/);
assert.match(source,/const FLAGS_QUESTION_FOCUS=/);
assert.match(source,/const flagsOutputValid=/);
assert.match(source,/const flagsRelatedFollowup=/);
assert.doesNotMatch(source,/const retry=await env\.AI\.run\(MODEL/);
assert.doesNotMatch(source,/api\.groq\.com/);
assert.doesNotMatch(source,/FLAGS_GROQ_SCHEMA/);
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const proof="a".repeat(64);
const hash=createHash("sha256").update(proof).digest("hex");
const answer="Ему может быть непросто сразу принять отказ, когда его желания расходятся с твоими. В таком сочетании он может сначала настаивать на своём, а потом вполне спокойно обсуждать твоё решение, если слышит аргументы и не принимает каждое возражение за личную обиду. Поэтому здесь важно не угадывать мысли и не проверять мужчину на прочность, а смотреть, действительно ли он признаёт твоё право выбирать и умеет вовремя остановиться. Отговорки и обещания сами по себе ничего не доказывают."
+"\n\nЕсли хочешь увидеть, насколько его слова совпадают с поступками в других ситуациях, посмотри вопрос «Держит слово или опять одни красивые разговоры?». Это поможет не принимать красивые речи за уже сделанные дела.";
const observedInputs=[],observedSystems=[];
let calls=0,shortOnce=false,shortSeen=false;
const env={REDFLAG_BATCH_KEY_SHA256:hash,AI:{run:async(model,opts)=>{
  calls++;
  assert.equal(model,"@cf/google/gemma-4-26b-a4b-it");
  assert.equal(opts.messages[0].role,"system");
  if(opts.messages[0].content.includes("Ты опытная нумеролог"))
    assert.match(opts.messages[0].content,/две энергии/);
  assert.equal(opts.chat_template_kwargs.enable_thinking,false);
  observedSystems.push(opts.messages[0].content);
  const userText=opts.messages.find(x=>x.role==="user")?.content||"";
  observedInputs.push(userText);
  if(shortOnce&&!shortSeen){shortSeen=true;return {response:"Короткий ответ."};}
  return {response:answer};
}}};
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
for(const q of flags){
  const res=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags",q.id,q.title,tenRelated),env);
  assert.equal(res.status,200,q.id);
  const json=await res.json();
  assert.ok(json.answer.startsWith(answer.split("\n\n")[0]),"Keep complete main answer");
  assert.equal(json.answer.split("\n\n").length,2,"Always two paragraphs");
  assert.ok(tenRelated.some(title=>json.answer.split("\n\n")[1].includes(title)),"Related title must be exact");
  assert.equal(json.draft_only,true);
  assert.equal(json.published,false);
  assert.equal(json.style_version,"flags-owner-gemma4-open-interpretation-20261118");
  assert.equal(json.model,"@cf/google/gemma-4-26b-a4b-it");
}
const focus={
  "care-or-control":"границу между заботой и стремлением распоряжаться жизнью женщины",
  "hero":"самооценку мужчины",
  "jealousy":"доверие, отношение к вниманию других мужчин",
  "argument":"обсуждает неудобные темы",
  "abuse-signal":"ранним тревожным сигналом при знакомстве",
  "support-or-cause":"когда женщине тяжело и нужна помощь",
  "apology":"признавать собственную неправоту после ссоры",
  "weak-place":"уязвимая сторона взаимодействия двух энергий",
  "calm-or-swings":"эмоциональную устойчивость и предсказуемость мужчины"
};
for(let i=0;i<flags.length;i++){
  assert.ok(observedInputs[i].includes(focus[flags[i].id]),"Missing distinct question focus "+flags[i].id);
  assert.ok(observedInputs[i].includes("Месяц рождения мужчины: 9 (энергия 9)."));
  assert.ok(observedInputs[i].includes("Краткий ориентир дня:"),"Day profile required");
  assert.ok(observedInputs[i].includes("Краткий ориентир месяца:"),"Month profile required");
}
const first=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags","say-no",
  "Уважает женское «нет» или начинает давить?",tenRelated),env);
assert.equal(first.status,200);
assert.ok((await first.json()).answer.startsWith(answer.split("\n\n")[0]));
assert.match(observedInputs.at(-1),/отношение мужчины к отказу/);
const trial=await worker.fetch(makeRequest("/v1/redflag-style-test","flags","say-no",
  "Уважает женское «нет» или начинает давить?",tenRelated),env);
assert.equal(trial.status,200);
assert.equal((await trial.json()).style_test,true);
assert.equal(calls,11);
const publicAttempt=await worker.fetch(makeRequest("/v1/redflag-draft","flags","say-no",
  "Уважает женское «нет» или начинает давить?",tenRelated),env);
assert.equal(publicAttempt.status,409);
assert.equal(calls,11);
const oversized=await worker.fetch(makeRequest("/v1/redflag-owner-question","infidelity","options",
  "Верный или постоянно ищет запасные варианты?",tenRelated.slice(0,6)),env);
assert.equal(oversized.status,400);
assert.equal(calls,11);
const other=catalog.categories.find(c=>c.id==="infidelity").questions[0];
const otherResponse=await worker.fetch(makeRequest("/v1/redflag-owner-question","infidelity",other.id,other.title),env);
const otherData=await otherResponse.json();
assert.equal(otherResponse.status,200,"Other Red Flag category must remain intact: "+JSON.stringify(otherData));
assert.equal(otherData.ok,true);
assert.ok(calls>=12);
const inputsBefore=observedInputs.length;
for(const [day,month,expectedDayEnergy,expectedMonthEnergy] of [
  [9,1,9,1],[9,3,9,3],[9,9,9,9],[9,10,9,10],[10,9,10,9],[31,10,4,10]
]){
  const res=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags","say-no",
    "Уважает женское «нет» или начинает давить?",tenRelated,day,month),env);
  assert.equal(res.status,200,"Distinct pair "+day+"."+month);
  const text=observedInputs.at(-1);
  assert.ok(text.includes("День рождения мужчины: "+day+" (энергия "+expectedDayEnergy+")"));
  assert.ok(text.includes("Месяц рождения мужчины: "+month+" (энергия "+expectedMonthEnergy+")"));
}
assert.equal(observedInputs.length-inputsBefore,6,"Each combination has its own inference input");
assert.notEqual(observedInputs[inputsBefore],observedInputs[inputsBefore+1],
  "Changing month changes actual model evidence");
shortOnce=true;shortSeen=false;
const beforeRetry=calls;
const retry=await worker.fetch(makeRequest("/v1/redflag-owner-question","flags","hero",
  "Скромный мужчина или считает себя подарком судьбы?",tenRelated,22,3),env);
assert.equal(retry.status,503,"A too-short draft is rejected, never retried");
assert.equal(calls-beforeRetry,1,"One inference per request, no slow second pass");
const guest=await worker.fetch(new Request("https://example.test/v1/redflag-owner-question",{
  method:"POST",headers:{"Content-Type":"application/json"},body:"{}"
}),env);
assert.equal(guest.status,403);
console.log("PASS: owner flags Gemma 4 only, nine distinct question focuses, six date combinations, no second AI call, other Red Flag categories intact, buyers blocked");
