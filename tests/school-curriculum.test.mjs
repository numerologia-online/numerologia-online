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
  assert.ok(lessonJS.includes('fetch(manifest[index].file+"?v=7")'));
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


test("В уроках нет готовой даты, ученик выбирает собственную дату для расчёта",async()=>{
  const html=await src("pro/school/lesson/index.html");
  const js=await src("pro/school/lesson/lesson.js");
  const css=await src("pro/school/lesson/lesson.css");
  assert.ok(html.includes('placeholder="Введите любую дату"'));
  assert.ok(!html.includes('value="14.07.1990"'));
  assert.ok(html.includes('<label for="lesson-date">Дата рождения</label>'));
  assert.ok(js.includes('currentBirth = null'));
  assert.ok(js.includes('if(!currentBirth){'));
  assert.ok(js.includes('drawBasic(null)'));
  assert.ok(js.includes('const shown=Boolean(matrix)&&stageKeys[step].includes(key)'));
  assert.ok(js.includes('currentBirth=null;'));
  assert.ok(js.includes('currentBirth=birth;'));
  assert.ok(css.includes('.school-date-row input::placeholder{color:#9ca8ac;opacity:.8;letter-spacing:normal}'));
  assert.ok(html.includes('lesson.js?v=13'));
  assert.ok(html.includes('lesson.css?v=9'));
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
  assert.ok(page.includes('href="pro/school/lesson/lesson.css?v=9"'));
  assert.ok(page.includes('src="pro/school/lesson/lesson.js?v=13"'));
  assert.ok(styles.includes(".school-date-row button.is-confirmed"));
  assert.ok(styles.includes(".school-lesson-quiz.is-locked"));
  const first=JSON.parse(await src("pro/school/lessons/start.json"));
  assert.equal(first.questions.length,3);
  assert.deepEqual(first.questions.map(q=>q.correct),[1,1,1]);
  assert.ok(first.questions.every(q=>!/рассчит|посчитать центр|вычислить центр/i.test(q.prompt)));
  assert.ok(first.sections[3].text.includes("месяц рождения"));
  assert.ok(first.sections[3].text.includes("день рождения"));
  assert.ok(first.sections[3].text.includes("год рождения"));
  assert.ok(script.includes('lines:["Месяц рождения"]'));
  assert.ok(script.includes('lines:["День","рождения"]'));
  assert.ok(script.includes('lines:["Год","рождения"]'));
  assert.ok(script.includes('lines:["Сумма"]'));
  assert.ok(script.includes('svg.append(text)'));
  assert.ok(!script.includes('diagram.append(legend)'));
  assert.ok(!script.includes('"Пример для "+date'));
  assert.ok(script.includes('$("lesson-date-form").hidden=true'));
  assert.ok(script.includes('$("lesson-step-formula").hidden=true'));
  assert.ok(styles.includes(".school-diagram-anchor-label"));
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
  assert.ok(html.includes('lesson.js?v=13'));
  assert.ok(html.includes('lesson.css?v=9'));
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

test("В четвёртом шаге подписи находятся на матрице, а не в отдельных карточках",async()=>{
  const js=await src("pro/school/lesson/lesson.js");
  const css=await src("pro/school/lesson/lesson.css");
  const lesson=JSON.parse(await src("pro/school/lessons/start.json"));
  const draw=js.slice(js.indexOf("function drawFirstLessonOutline()"),js.indexOf("const stageKeys = ["));
  assert.ok(draw.includes('makeSvg("text"'));
  assert.ok(draw.includes('svg.append(text)'));
  assert.ok(draw.includes('school-diagram-anchor-label'));
  assert.ok(!draw.includes('school-position-chip'));
  assert.ok(!draw.includes('diagram.append(legend)'));
  assert.ok(css.includes(".school-diagram-anchor-label"));
  assert.ok(!css.includes(".school-position-chip{"));
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
  assert.ok(page.includes('src="pro/school/lesson/lesson.js?v=13"'));
});

test("Уроки открываются строго последовательно, включая прямые ссылки",async()=>{
  const home=await src("pro/school/school.js");
  const reader=await src("pro/school/lesson/lesson.js");
  const homePage=await src("pro/school/index.html");
  const readerPage=await src("pro/school/lesson/index.html");
  const css=await src("pro/school/school.css");
  assert.ok(home.includes("lessons.slice(0,position).every(previous=>completed.has(previous.id))"));
  assert.ok(home.includes('make(unlocked?"a":"div"'));
  assert.ok(home.includes('if(unlocked)link.href = "pro/school/lesson/?id="'));
  assert.ok(home.includes('link.setAttribute("aria-disabled","true")'));
  assert.ok(home.includes('window.addEventListener("pageshow"'));
  assert.ok(reader.includes('manifest.slice(0,index).find(item=>!completed.has(item.id))'));
  assert.ok(reader.includes('if(firstMissing){'));
  assert.ok(reader.includes('if(next&&readCompleted().has(id))nav.append(link(next,"Следующий урок →","school-primary"))'));
  assert.ok(reader.includes('saved=readCompleted().has(data.id)'));
  assert.ok(css.includes(".school-lesson-link.is-locked"));
  assert.ok(css.includes(".school-lesson-locked-next"));
  assert.ok(homePage.includes('school.js?v=3'));
  assert.ok(readerPage.includes('lesson.js?v=13'));
  assert.ok(readerPage.includes('school.css?v=10'));
});

test("Заголовок школы на двух строках одного размера с золотым акцентом",async()=>{
  const html=await src("pro/school/index.html");
  const css=await src("pro/school/school.css");
  assert.ok(html.includes('<h1><span class="school-hero-primary">Учиться самостоятельно</span> <span class="school-hero-gold">это легко!</span></h1>'));
  assert.ok(html.includes('school.css?v=10'));
  assert.ok(css.includes('.school-hero h1 .school-hero-primary,.school-hero h1 .school-hero-gold{display:block;white-space:nowrap}'));
  assert.ok(css.includes('.school-hero h1 .school-hero-gold{color:#9e7e50}'));
  assert.ok(css.includes('.school-hero>.school-overline{margin-bottom:19px}'));
  assert.ok(css.includes('font-size:clamp(23px,6.8vw,54px)'));
  assert.ok(css.includes('color:var(--ink)'));
  assert.ok(!css.includes('.school-hero-first{'));
  assert.ok(!css.includes('.school-hero h1 em{'));
});

test("Статусы школ шире, содержат подсказку и аккуратно размещены на телефоне",async()=>{
  const html=await src("pro/schools/index.html");
  const css=await src("pro/schools/schools.css");
  assert.ok(html.includes('schools.css?v=11'));
  assert.equal((html.match(/class="academy-status academy-status--ready"/g)||[]).length,1);
  assert.equal((html.match(/class="academy-status"/g)||[]).length,6);
  assert.equal((html.match(/academy-status-subtitle">Начать обучение/g)||[]).length,1);
  assert.equal((html.match(/academy-status-subtitle">Уроки готовятся/g)||[]).length,6);
  assert.ok(css.includes('width:164px;min-height:41px'));
  assert.ok(css.includes('.academy-status{grid-column:2;grid-row:2;'));
  assert.ok(css.includes('.academy-arrow{grid-column:3;grid-row:1/3;'));
});

test("Матрица судьбы показывает программу обучения вместо общей плашки",async()=>{
  const html=await src("pro/schools/index.html");
  const css=await src("pro/schools/schools.css");
  const matrix=html.slice(html.indexOf('<a href="pro/school/"'),html.indexOf('</a>',html.indexOf('<a href="pro/school/"')));
  assert.ok(matrix.includes('academy-school--matrix'));
  assert.ok(matrix.includes('Построение матрицы с нуля · Уроки · Тренажёр · Формулы · Персональный разбор для клиента'));
  assert.ok(!matrix.includes('Перейти к обучению'));
  assert.ok(matrix.includes('<span class="academy-arrow" aria-hidden="true">→</span>'));
  assert.ok(!matrix.includes('Открыта'));
  assert.ok(css.includes('.academy-school--matrix>.academy-school-description{'));
  assert.ok(!css.includes('.academy-school--matrix .academy-school-cta{'));
  assert.ok(css.includes('.academy-school--matrix>.academy-school-cta{display:none!important}'));
  assert.ok(matrix.includes('class="academy-matrix-watermark"'));
  assert.ok(css.includes('background:linear-gradient(115deg,#223d52'));
  assert.ok(css.includes('.academy-school--matrix .academy-arrow{'));
  assert.ok(css.includes('color:#fff1d2;font-size:25px;line-height:1;'));
  assert.ok(css.includes('.academy-matrix-watermark{'));
  assert.ok(css.includes('grid-template-columns:32px minmax(0,1fr) 29px;'));
  assert.ok(css.includes('padding:10px 11px;'));
  assert.ok(css.includes('pointer-events:none;'));
  assert.ok(css.includes('opacity:.13'));
});

test("Главное правило второго урока выделено отдельной золотистой карточкой",async()=>{
  const data=JSON.parse(await src("pro/school/lessons/reduce.json"));
  const html=await src("pro/school/lesson/index.html");
  const js=await src("pro/school/lesson/lesson.js");
  const css=await src("pro/school/lesson/lesson.css");
  assert.equal(data.lead,"Теперь, когда схема уже нарисована, учимся правильно заполнять кружки.");
  assert.equal(data.mainRule.title,"ГЛАВНОЕ ПРАВИЛО");
  assert.deepEqual(data.mainRule.lines,[
    "Числа от 1 до 22 оставляем как есть.",
    "Если число больше 22 - сокращаем его сложением цифр."
  ]);
  assert.ok(!data.lead.includes("Главное правило:"));
  assert.ok(html.includes('id="lesson-main-rule"'));
  assert.ok(html.includes('lesson.js?v=13'));
  assert.ok(html.includes('lesson.css?v=9'));
  assert.ok(js.includes('fetch(manifest[index].file+"?v=7")'));
  assert.ok(js.includes('if(data.mainRule&&Array.isArray(data.mainRule.lines)'));
  assert.ok(js.includes('mainRule.hidden=false'));
  assert.ok(js.includes('mainRule.hidden=true'));
  assert.ok(css.includes('.school-main-rule{'));
  assert.ok(css.includes('border:1px solid #d8bd8b'));
  assert.ok(css.includes('.school-main-rule-line{'));
});

test("Старая кнопка не возвращается при смешивании кэшированных версий",async()=>{
  const html=await src("pro/schools/index.html");
  const css=await src("pro/schools/schools.css");
  const matrix=html.slice(html.indexOf('<a href="pro/school/"'),html.indexOf('</a>',html.indexOf('<a href="pro/school/"')));
  assert.ok(!matrix.includes('academy-school-cta'));
  assert.ok(matrix.includes('class="academy-arrow"'));
  assert.ok(css.includes('.academy-school--matrix>.academy-school-cta{display:none!important}'));
  assert.ok(html.includes('schools.css?v=11'));
});

test("Урок 2 подробно показывает день месяц и сложение цифр года по введённой дате",async()=>{
  const js=await src("pro/school/lesson/lesson.js");
  const css=await src("pro/school/lesson/lesson.css");
  const html=await src("pro/school/lesson/index.html");
  assert.ok(js.includes('Обязательно введите дату рождения ниже'));
  assert.ok(!html.includes('Числа на схеме берутся из того же алгоритма'));
  assert.ok(js.includes('if(id==="reduce"&&step===1)'));
  assert.ok(js.includes('showFirstThreeCalculations(formulaBlock,m,currentBirth)'));
  assert.ok(js.includes('const daySteps=reduce22Formula(birth.day)'));
  assert.ok(js.includes('const yearDigits=String(birth.year).split("").map(Number)'));
  assert.ok(js.includes('...reduce22Formula(yearSum)'));
  assert.ok(js.includes('["СЛЕВА · ДЕНЬ",dayFormula,matrix.left]'));
  assert.ok(js.includes('["СВЕРХУ · МЕСЯЦ",monthFormula,matrix.top]'));
  assert.ok(js.includes('["СПРАВА · ГОД",yearFormula,matrix.right]'));
  assert.ok(html.includes('<div id="lesson-step-formula" class="school-step-formula"></div>'));
  assert.ok(html.includes('lesson.js?v=13'));
  assert.ok(html.includes('lesson.css?v=9'));
  assert.ok(css.includes('.school-step-formula.is-calculation-breakdown{'));
  assert.ok(css.includes('.school-calc-result{'));
});
