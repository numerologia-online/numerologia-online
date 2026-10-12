import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

const loadCore = async () => {
  const code = await source("pro/schools/classic/classic-core.js");
  return new Function(code.replace(/^export /gm,"")+"return {reduceClassic,lifePath,birthdayNumber,personalYear,personalMonth,personalDay,analyzeName,parseClassicDate,letterValue,numberMeaning};")();
};

test("Классическая школа изолирована от 22 энергий",async()=>{
  const classic=await source("pro/schools/classic/classic-core.js");
  const matrix=await source("numerology-core.js");
  assert.ok(!classic.includes("numerology-core.js"));
  assert.ok(matrix.includes("export const reduce22"));
  const hub=await source("pro/schools/index.html");
  const entry=await source("pro/schools/classic/index.html");
  const lesson=await source("pro/schools/classic/lesson/index.html");
  assert.ok(hub.includes('href="pro/schools/classic/"'));
  assert.ok(entry.includes('<base href="../../../">'));
  assert.ok(lesson.includes('<base href="../../../../">'));
  assert.ok(entry.includes("classic-number-grid"));
  assert.ok(entry.includes("classic-date-form"));
  assert.ok(entry.includes("classic-name-form"));
  assert.ok(entry.includes('classic/lesson/?id=hello'));
});

test("Числа жизни, мастера, день рождения и прогнозные циклы",async()=>{
 const c=await loadCore();
 assert.deepEqual(Object.keys(c.numberMeaning).map(Number).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9,11,22,33]);
 assert.equal(c.reduceClassic(11),11);
 assert.equal(c.reduceClassic(22),22);
 assert.equal(c.reduceClassic(33),33);
 assert.equal(c.reduceClassic(15),6);
 assert.equal(c.reduceClassic(33,false),6);
 assert.equal(c.lifePath({day:14,month:7,year:1990}).value,4);
 assert.equal(c.lifePath({day:11,month:11,year:2009}).value,33);
 assert.deepEqual(c.birthdayNumber({day:29}),{original:29,root:11});
 assert.equal(c.personalYear({day:14,month:7},2026),4);
 assert.equal(c.personalMonth({day:14,month:7},2026,10),5);
 assert.equal(c.personalDay({day:14,month:7},2026,10,12),8);
 assert.ok(c.parseClassicDate("29.02.2000"));
 assert.equal(c.parseClassicDate("29.02.2001"),null);
});

test("Русские и латинские имена, кириллица с Ё и мастер-число 22",async()=>{
 const c=await loadCore();
 const anna=c.analyzeName("АННА");
 assert.equal(anna.alphabet,"ru");
 assert.equal(anna.expression,5);
 assert.equal(anna.soul,2);
 assert.equal(anna.personality,3);
 assert.equal(c.analyzeName("МАРИЯ").expression,22);
 assert.equal(c.analyzeName("ANNA").alphabet,"en");
 assert.equal(c.letterValue("Ё","ru"),7);
 assert.equal(c.letterValue("Я","ru"),6);
 assert.ok(c.analyzeName("АННА Anna").error);
 assert.ok(c.analyzeName("123").error);
});

test("Каждый урок существует отдельно, крупные SVG-иллюстрации не требуют CDN",async()=>{
 const manifest=JSON.parse(await source("pro/schools/classic/manifest.json"));
 const dashboard=await source("pro/schools/classic/classic.js");
 const reader=await source("pro/schools/classic/lesson/lesson.js");
 const css=await source("pro/schools/classic/classic.css");
 assert.equal(manifest.schema,"classic-school-curriculum-v1");
 assert.equal(manifest.lessons.length,12);
 assert.ok(dashboard.includes('fetch("pro/schools/classic/manifest.json?v=1")'));
 assert.ok(reader.includes('fetch(manifest[activeIndex].file+"?v=1")'));
 assert.ok(reader.includes('document.createElementNS(ns,tag)'));
 assert.ok(css.includes("@media(max-width:600px)"));
 assert.ok(!css.includes("url(http"));
 for(const lesson of manifest.lessons){
   const data=JSON.parse(await source(lesson.file));
   assert.equal(data.id,lesson.id);
   assert.equal(data.title,lesson.title);
   assert.ok(data.sections.length>=3,data.id);
   assert.ok(data.quiz.options.length>=3,data.id);
   assert.ok(data.quiz.correct>=0&&data.quiz.correct<data.quiz.options.length,data.id);
   assert.ok(data.sections.every(s=>s.text?.length>80),data.id);
 }
});
