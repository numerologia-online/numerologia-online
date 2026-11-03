import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = file => readFile(new URL("../" + file, import.meta.url), "utf8");

test("Original school layout and simple trainer are restored without the new construction player", async () => {
  const home = await read("pro/school/index.html");
  const script = await read("pro/school/school.js");
  const originalPoints = await read("pro/school/points.js");
  assert.match(home, /id="school-train-point"/);
  assert.match(home, /id="school-train-answer"/);
  assert.match(home, /id="school-train-feedback"/);
  assert.match(script, /import \{ pointCatalog \} from "\.\/points\.js\?v=3"/);
  assert.match(script, /function renderTrainer\(\)/);
  assert.match(script, /function buildFormulaSheet\(birth\)/);
  assert.doesNotMatch(script, /mountConstruction/);
  assert.doesNotMatch(home, /pro\/school\/learning\.css/);
  assert.match(originalPoints, /export const pointCatalog\s*=\s*baseline\.map\(/);
  assert.match(home, /31 точка по шагам/);
});

test("First school lesson starts with an empty hand-drawn matrix and no digit exercises", async () => {
  const lesson = JSON.parse(await read("pro/school/lessons/start.json"));
  const page = await read("pro/school/lesson/index.html");
  const source = await read("pro/school/lesson/lesson.js");
  assert.match(lesson.lead, /Числа и формулы будем изучать позже/);
  assert.match(lesson.sections.at(-1).text, /не нужно запоминать значение/);
  assert.match(page, /id="lesson-step-title"/);
  assert.match(page, /id="lesson-step-next"/);
  assert.match(source, /function drawFirstLessonOutline\(\)/);
  assert.match(source, /На этом шаге никаких цифр/);
  assert.match(source, /if\(id==="start"\)/);
  assert.match(source, /\$\("lesson-date-form"\)\.hidden=true/);
  assert.doesNotMatch(source, /mountLessonGuide|mountConstruction/);
});

test("Matrix lesson two explains the complete 1–22 boundary and progressive sums", async () => {
  const script = await read("pro/school/lesson/lesson.js");
  assert.match(script, /все числа от 1 до 22 включительно оставляем без изменений/);
  assert.match(script, /Это относится ко всем числам, а не только к 11, 15 и 22/);
  assert.match(script, /23 → 2 \+ 3 = 5/);
  assert.match(script, /24 → 2 \+ 4 = 6/);
  assert.match(script, /29 → 2 \+ 9 = 11/);
  assert.match(script, /1999 → 1 \+ 9 \+ 9 \+ 9 = 28 → 2 \+ 8 = 10/);
});

test("Protected lesson delivery and owner-only white-label PDF survive", async () => {
  const js = await read("pro/school/lesson/lesson.js");
  const gate = await read("server/school-access/private/gate.php");
  const home = await read("pro/school/index.html");
  const pro = await read("pro/pro.js");
  const manifest = JSON.parse(await read("pro/school/lessons-manifest.json"));
  assert.equal(manifest.lessons.length, 32);
  assert.deepEqual(manifest.lessons.slice(0,5).map(x=>x.id),["start","reduce","base","corners","internal"]);
  assert.match(js, /fetch\("\/api\/numi-school\.php"/);
  assert.match(js, /action:"content"/);
  assert.match(js, /credentials:"same-origin"/);
  assert.doesNotMatch(js, /fetch\(manifest\[index\]\.file\s*\+/);
  assert.match(gate, /function nsOwner\(/);
  assert.match(gate, /SCHOOL_SUBSCRIPTION_REQUIRED/);
  assert.match(home, /Персональный PDF для клиента/);
  assert.match(home, /href="pro\/\?from=school"/);
  assert.match(pro, /verifiedSchoolClientOwner/);
  assert.match(pro, /customizeDocument: schoolClientMode \?/);
  assert.match(home, /school\.js\?v=20261103legacy1/);
});
