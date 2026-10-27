import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=async path=>readFile(new URL("../"+path,import.meta.url),"utf8");
const js=await source("child/child-report-pdf.js");
const {collectChildPdf,childPdfDefinition}=new Function(
  js.replace(/^export /gm,"")+"\nreturn {collectChildPdf,childPdfDefinition};"
)();
const matrixJs=await source("child/child.js");
const calculateMatrix=new Function(
  (await source("numerology-core.js")).replace(/^export /gm,"")+"\nreturn calculateMatrix;"
)();
const definitionStart=matrixJs.indexOf("const matrixDefinitions = (matrix) => [");
const definitionSource=matrixJs.slice(definitionStart,matrixJs.indexOf("\n];",definitionStart)+3);
const definitions=new Function("matrix",definitionSource+"\nreturn matrixDefinitions(matrix);")(
  calculateMatrix({day:2,month:2,year:2024})
);
const ids=[...new Set(definitions.filter(x=>x.id!=="tail").map(x=>x.section||x.id))];
const energyBank=(status="ready")=>({
  status,
  sections:Object.fromEntries(ids.map(id=>[id,{paragraphs:["Авторский текст для "+id]}]))
});
const tail=async()=>({
  state:"ready",
  bank:{title:"Семейные уроки",lead:"Вступление",sections:[
    {title:"Главный урок",paragraphs:["Воспитывать с любовью и уважением."]}
  ]}
});
const born={day:2,month:2,year:2024};

test("All calculated topics are included in a complete child PDF",async()=>{
  const report=await collectChildPdf(born,definitions,async()=>energyBank(),tail);
  assert.equal(report.total,22);
  assert.equal(report.chapters.length,22);
  assert.equal(report.missing.length,0);
  assert.equal(report.ready,true);
  assert.equal(report.birthday,"02.02.2024");
  const pdf=childPdfDefinition(report);
  assert.equal(pdf.pageSize,"A4");
  assert.equal(pdf.info.title,"Всё о ребёнке - 02.02.2024");
  assert.ok(JSON.stringify(pdf.content).includes("Содержание"));
  assert.ok(JSON.stringify(pdf.content).includes("Кармический хвост"));
  assert.ok(!JSON.stringify(pdf).includes('"image":'),"No embedded photos in lightweight PDF");
});

test("Never issue a finished report with draft or missing readings",async()=>{
  const draft=await collectChildPdf(born,definitions,async()=>energyBank("draft"),tail);
  assert.ok(!draft.ready);
  assert.ok(draft.missing.length>0);
  assert.throws(()=>childPdfDefinition(draft));
  const preview=childPdfDefinition(draft,{preview:true});
  assert.match(preview.info.title,/ЧЕРНОВИК/);
  assert.match(JSON.stringify(preview.content),/В РАБОТЕ/);
  assert.equal(preview.watermark.text,"ЧЕРНОВИК");
  assert.match(JSON.stringify(preview.content),/ГЛАВА 22/);
  const completed=await collectChildPdf(born,definitions,async()=>energyBank("complete"),tail);
  assert.equal(completed.ready,true,"Approved complete chapters must count as finished");
  const missingTail=await collectChildPdf(born,definitions,async()=>energyBank(),async()=>({state:"missing"}));
  assert.ok(!missingTail.ready);
  assert.ok(missingTail.missing.includes("Кармический хвост"));
});

test("Repeated text is not printed twice as two full chapters",async()=>{
  const report=await collectChildPdf(born,definitions,async()=>({
    status:"ready",
    sections:Object.fromEntries(ids.map(id=>[id,{paragraphs:["Одна общая трактовка"]}]))
  }),tail);
  const repeated=report.chapters.filter(ch=>ch.paragraphs[0]?.includes("Подробная трактовка"));
  assert.ok(repeated.length>0);
  assert.equal(report.chapters.length,22);
});

test("All 22 authored child energy files are populated and marked as finished",async()=>{
  for (let number=1;number<=22;number++) {
    const bank=JSON.parse(await source(`child/data/matrix/sections/energy-${number}.json`));
    assert.ok(["ready","complete"].includes(bank.status),`Energy ${number} wrongly marked ${bank.status}`);
    const sections=Object.entries(bank.sections || {});
    assert.equal(sections.length,20,`Energy ${number} must contain all 20 authored topics`);
    for (const [topic,section] of sections) {
      assert.ok(Array.isArray(section.paragraphs) && section.paragraphs.length &&
        section.paragraphs.every(text=>typeof text==="string"&&text.trim()),`Energy ${number}: ${topic} missing text`);
    }
  }
});

test("All 26 listed karmic programs have full ready text",async()=>{
  const index=JSON.parse(await source("child/data/matrix/karmic-tail/index.json"));
  const codes=Object.keys(index.available);
  assert.equal(codes.length,index.expectedPrograms);
  for (const code of codes) {
    const bank=JSON.parse(await source("child/data/matrix/karmic-tail/"+index.available[code]));
    assert.equal(bank.status,"ready",`Karmic program ${code} not ready`);
    assert.equal(bank.code,code);
    assert.ok(Array.isArray(bank.sections) && bank.sections.length>=1);
    assert.ok(bank.sections.every(part=>part.title &&
      part.paragraphs?.length>0 &&
      part.paragraphs.every(text=>typeof text==="string"&&text.trim())),
      `Karmic program ${code} has unfinished content`);
  }
});

test("Two real birthdays generate complete 22-chapter reports without draft placeholders",async()=>{
  const index=JSON.parse(await source("child/data/matrix/karmic-tail/index.json"));
  for (const date of [{day:2,month:2,year:2024},{day:2,month:1,year:2025}]) {
    const points=new Function("matrix",definitionSource+"\nreturn matrixDefinitions(matrix);")(
      calculateMatrix(date)
    );
    const report=await collectChildPdf(date,points,
      async number=>JSON.parse(await source(`child/data/matrix/sections/energy-${number}.json`)),
      async code=>({state:"ready",bank:JSON.parse(await source(
        "child/data/matrix/karmic-tail/"+index.available[code]
      ))})
    );
    assert.equal(report.chapters.length,22);
    assert.equal(report.missing.length,0);
    assert.equal(report.ready,true);
    const pdf=childPdfDefinition(report);
    assert.equal(pdf.watermark.text,"9966");
    assert.doesNotMatch(JSON.stringify(pdf.content),/Этот раздел пока не готов|В РАБОТЕ/);
  }
});
