import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync("cloudflare/moment-300-ai/src/index.js","utf8");
const redflagSource=readFileSync("cloudflare/redflag-draft-ai/src/index.js","utf8");
const redflagDataUrl="data:text/javascript;base64,"+Buffer.from(redflagSource).toString("base64");
const bundled=source.replace(
  'import redflagDraftWorker from "../../redflag-draft-ai/src/index.js";',
  'import redflagDraftWorker from "'+redflagDataUrl+'";'
);
assert.notEqual(bundled,source,"Expected isolated Red Flag module import");
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(bundled).toString("base64"));
const sampleText="О чувствах человека нельзя судить достоверно только по дате рождения. Смотрите на поступки и взаимность, а символический расчёт используйте лишь как дополнительный ракурс.";
async function inspect(questionId,man,moment){
  let messages;
  const env={
    MOMENT_BRIDGE_SECRET:"test-only-bridge",
    AI:{run:async(_model,options)=>{
      messages=options.messages;
      return {response:sampleText};
    }}
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
  const res=await worker.fetch(req,env);
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.ok,true);
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
const health=await worker.fetch(new Request("https://example.test/health"),{AI:{}});
assert.equal(health.status,200);
const status=await health.json();
assert.equal(status.love001_cycle_version,"full-birthdate-two-person-monthly-20261117");
assert.equal(status.live_answers_enabled,false);
assert.equal(status.love001_emotion_version,"direct-feelings-20261117");
assert.equal(status.redflag_draft_version,"redflag-owner-drafts-v3-no-numbers-ready-cta-20261117");

const draftSourcePrefix=redflagSource.split("export default {")[0];
const draftTools=new Function(draftSourcePrefix+
  "\nreturn {hiddenCalculationLeak,validDraft,ensureReadyFollowup,hasReadyFollowup,draftParagraphs};")();
assert.equal(draftTools.hiddenCalculationLeak("Девятка-девятка означает характер."),true,
  "Never expose numerology energy names to the reader");
assert.equal(draftTools.hiddenCalculationLeak("По энергии 9-9 мужчина ведёт себя так."),true,
  "Never expose numeric energy pairs to the reader");
assert.equal(draftTools.hiddenCalculationLeak("Он может ревновать и проверять сообщения."),false);
const sampleDraft=Array(15).fill("Он любит управлять всеми твоими планами, но с отказами справляется тяжело.").join(" ")+
  "\n\nЕсли отказывает тебе в простом выборе, посмотри, как он реагирует на твои границы.";
const readyFollowup="Уважает женское «нет» или начинает давить?";
const linkedDraft=draftTools.ensureReadyFollowup(sampleDraft,[readyFollowup]);
assert.equal(draftTools.draftParagraphs(linkedDraft).length,2);
assert.ok(draftTools.draftParagraphs(linkedDraft)[1].includes(readyFollowup),
  "A second paragraph must point only to an existing ready question");
assert.equal(linkedDraft.includes("\\n"),false,
  "The displayed answer must have actual newlines, not literal backslash-n text");

const unauthorized=await worker.fetch(new Request("https://example.test/v1/redflag-draft",{
  method:"POST",headers:{"Content-Type":"application/json"},body:"{}"
}),{AI:{}});
assert.equal(unauthorized.status,403,"Red Flag drafting must reject anonymous requests");
console.log("PASS: love-001 full birth years, age cycles, both personal months, other 299 isolated");
