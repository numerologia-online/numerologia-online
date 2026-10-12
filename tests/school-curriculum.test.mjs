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
  assert.ok(lessonJS.includes('fetch(manifest[index].file+"?v=5")'));
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
  assert.ok(page.includes('href="pro/school/lesson/lesson.css?v=5"'));
  assert.ok(page.includes('src="pro/school/lesson/lesson.js?v=7"'));
  assert.ok(styles.includes(".school-date-row button.is-confirmed"));
  assert.ok(styles.includes(".school-lesson-quiz.is-locked"));
  const first=JSON.parse(await src("pro/school/lessons/start.json"));
  assert.equal(first.questions.length,3);
  assert.deepEqual(first.questions.map(q=>q.correct),[1,1,1]);
  assert.ok(first.questions.every(q=>!/рассчит|посчитать центр|вычислить центр/i.test(q.prompt)));
  assert.ok(first.sections[3].text.includes("месяц рождения"));
  assert.ok(first.sections[3].text.includes("день рождения"));
  assert.ok(first.sections[3].text.includes("год рождения"));
  assert.ok(script.includes('["↑","Месяц рождения"]'));
  assert.ok(script.includes('["←","День рождения"]'));
  assert.ok(script.includes('["→","Год рождения"]'));
  assert.ok(script.includes('["↓","Сумма"]'));
  assert.ok(script.includes('diagram.append(legend)'));
  assert.ok(!script.includes('"Пример для "+date'));
  assert.ok(script.includes('$("lesson-date-form").hidden=true'));
  assert.ok(script.includes('$("lesson-step-formula").hidden=true'));
  assert.ok(styles.includes(".school-position-key"));
  assert.ok(styles.includes(".school-drawing.is-first-lesson #lesson-date-form"));
  assert.ok(!JSON.stringify(first).includes("09.09.1986"));

});

test("Неверный ответ выделен красным и возвращает к началу первого урока",async()=>{
  const script=await src("pro/school/lesson/lesson.js");
  const css=await src("pro/school/lesson/lesson.css");
  const html=await src("pro/school/lesson/index.html");
  assert.ok(script.includes("Пройдите ещё раз урок. Это займёт немного времени, зато вы точно усвоите материал."));
  assert.ok(script.includes('feedback.classList.add("is-incorrect")'));
  assert.ok(script.includes('feedback.classList.remove("is-incorrect")'));
  assert.ok(script.includes('retry.hidden=false'));
  assert.ok(script.includes('form.querySelectorAll(\'input[type="radio"]\')'));
  assert.ok(script.includes('step=0;'));
  assert.ok(script.includes('root.classList.add("is-locked")'));
  assert.ok(script.includes('root.querySelectorAll("fieldset").forEach(fieldset=>{fieldset.disabled=true})'));
  assert.ok(script.includes('submit.disabled=true'));
  assert.ok(script.includes('$("lesson-drawing").scrollIntoView'));
  assert.ok(css.includes(".school-quiz-result.is-incorrect"));
  assert.ok(css.includes("color:#a82d38"));
  assert.ok(css.includes(".school-quiz-retry[hidden]"));
  assert.ok(html.includes('lesson.js?v=7'));
  assert.ok(html.includes('lesson.css?v=5'));
});

test("Первый урок показывает сразу практику, без двух вступлений",async()=>{
  const js=await src("pro/school/lesson/lesson.js");
  const html=await src("pro/school/lesson/index.html");
  const css=await src("pro/school/lesson/lesson.css");
  assert.ok(html.includes('id="lesson-hero"'));
  assert.ok(js.includes('id==="start"?"Рисуем матрицу с нуля":data.title'));
  assert.ok(js.includes('$("lesson-hero").classList.add("is-compact")'));
  assert.ok(js.includes('$("lesson-drawing").classList.add("is-first-lesson")'));
  assert.ok(css.includes(".school-lesson-hero.is-compact .school-lesson-lead{display:none!important}"));
  assert.ok(css.includes(".school-drawing.is-first-lesson .school-drawing-intro h2"));
  assert.ok(css.includes(".school-drawing.is-first-lesson #lesson-drawing-description"));
  assert.ok(css.includes(".school-drawing.is-first-lesson .school-diagram-footnote"));
  assert.ok(js.includes('renderQuiz(data)'));
  assert.ok(js.includes('setupDiagram()'));
});

test("Пустая матрица первого урока не содержит подписей поверх линий и числовых примеров",async()=>{
  const js=await src("pro/school/lesson/lesson.js");
  const css=await src("pro/school/lesson/lesson.css");
  const lesson=JSON.parse(await src("pro/school/lessons/start.json"));
  const draw=js.slice(js.indexOf("function drawFirstLessonOutline()"),js.indexOf("const stageKeys = ["));
  assert.ok(!draw.includes('makeSvg("text"'));
  assert.ok(draw.includes('diagram.append(legend)'));
  assert.ok(draw.includes('school-position-chip'));
  assert.ok(css.includes("grid-template-columns:repeat(2,minmax(0,1fr))"));
  assert.ok(lesson.questions.length===3);
  assert.ok(!lesson.sections[3].text.includes("09.09.1986"));
  assert.ok(!lesson.sections[3].example.includes("09.09.1986"));
});

test("В первом тесте считаем кружочки и после успеха показываем переход дальше",async()=>{
  const lesson=JSON.parse(await src("pro/school/lessons/start.json"));
  const script=await src("pro/school/lesson/lesson.js");
  const page=await src("pro/school/lesson/index.html");
  assert.equal(lesson.questions[1].prompt,"Сколько кружочков мы нарисовали на схеме?");
  assert.equal(lesson.questions[1].correct,1);
  assert.ok(lesson.questions[1].explain.includes("девять"));
  const success=script.slice(script.indexOf("if(score===data.questions.length)"),script.indexOf("}else{",script.indexOf("if(score===data.questions.length)")));
  assert.ok(success.includes('feedback.classList.add("is-correct")'));
  assert.ok(success.includes('feedback.scrollIntoView({behavior:"smooth",block:"center"})'));
  assert.ok(!script.slice(script.indexOf('feedback.classList.add("is-incorrect")'),script.indexOf('retry.hidden=false')).includes("scrollIntoView"));
  assert.ok(script.includes('link(next,"Следующий урок →","school-primary")'));
  assert.ok(page.includes('src="pro/school/lesson/lesson.js?v=7"'));
});
