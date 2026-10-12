import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const src = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Школа начинает с построения матрицы и загружает отдельные уроки", async () => {
  const index = await src("pro/school/index.html");
  const script = await src("pro/school/school.js");
  const reader = await src("pro/school/lesson/index.html");
  const lessonJS = await src("pro/school/lesson/lesson.js");
  const manifest = JSON.parse(await src("pro/school/lessons-manifest.json"));
  assert.ok(index.indexOf('class="school-tabs"') < index.indexOf('class="school-client-service"'));
  assert.ok(!index.includes('class="school-metrics"'));
  assert.ok(!index.includes('class="school-lead"'));
  assert.ok(index.includes('id="school-lesson-list"'));
  assert.ok(!index.includes('id="school-lesson-content"'));
  assert.ok(script.includes("lessons-manifest.json"));
  assert.ok(!script.includes('fetch("pro/school/lessons.json'));
  assert.ok(script.includes('link.href = "pro/school/lesson/?id="'));
  assert.ok(reader.includes('<base href="../../../">'));
  assert.ok(lessonJS.includes('fetch(manifest[index].file+"?v=1")'));
  assert.equal(manifest.lessons.length, 12);
  assert.deepEqual(manifest.lessons.slice(0,5).map(x=>x.id), ["start","reduce","base","corners","internal"]);
  for (const meta of manifest.lessons) {
    const lesson = JSON.parse(await src(meta.file));
    assert.equal(lesson.id, meta.id);
    assert.equal(lesson.title, meta.title);
    assert.ok(lesson.sections.length >= 2);
    assert.ok(lesson.questions.length >= 2);
    for (const question of lesson.questions) {
      assert.ok(question.correct >= 0 && question.correct < question.options.length);
    }
  }
});

test("28 формул в справочнике соответствуют текущему расчётному ядру", async () => {
  const coreSource = await src("numerology-core.js");
  const catalogSource = await src("pro/school/points.js");
  const calculateMatrix = new Function(coreSource.replace(/^export /gm, "") + ";return calculateMatrix")();
  const pointCatalog = new Function(catalogSource.replace(/^export /gm, "") + ";return pointCatalog")();
  assert.equal(pointCatalog.length, 28);
  const dates = [
    {day:14,month:7,year:1990}, {day:31,month:10,year:1988},
    {day:9,month:9,year:1986}, {day:28,month:2,year:2000}
  ];
  for (const date of dates) {
    const matrix = calculateMatrix(date);
    for (const point of pointCatalog) {
      const result = String(point.get(matrix));
      const explanation = point.work(matrix,date);
      assert.ok(explanation.endsWith(result), `Не совпадает ${point.id} ${JSON.stringify(date)}: ${explanation} vs ${result}`);
    }
  }
});


test("Первый урок без повторов, дата подтверждается галочкой и тест закрыт до последнего шага", async () => {
  const script=await src("pro/school/lesson/lesson.js");
  const page=await src("pro/school/lesson/index.html");
  const styles=await src("pro/school/lesson/lesson.css");
  assert.ok(script.includes('id==="start"?0:'));
  assert.ok(script.includes("const firstLessonSteps=["));
  assert.ok(script.includes("drawFirstLessonOutline()"));
  assert.ok(script.includes('root.hidden=id==="start"'));
  assert.ok(script.includes('if(id!=="start"){'));
  assert.ok(script.includes('step===max'));
  assert.ok(script.includes("unlockFirstLessonQuiz()"));
  assert.ok(script.includes('root.classList.add("is-locked")'));
  assert.ok(script.includes('fieldset.disabled=true'));
  assert.ok(script.includes('fieldset.disabled=false'));
  assert.ok(script.includes('submit.disabled=true'));
  assert.ok(script.includes('button.textContent="✓"'));
  assert.ok(script.includes('resetConfirmation()'));
  assert.ok(page.includes('id="lesson-date-submit"'));
  assert.ok(page.includes('id="lesson-date-confirmed"'));
  assert.ok(page.includes('href="pro/school/lesson/lesson.css?v=2"'));
  assert.ok(page.includes('src="pro/school/lesson/lesson.js?v=2"'));
  assert.ok(styles.includes(".school-date-row button.is-confirmed"));
  assert.ok(styles.includes(".school-lesson-quiz.is-locked"));
  const first=JSON.parse(await src("pro/school/lessons/start.json"));
  assert.equal(first.questions.length,2);
});
