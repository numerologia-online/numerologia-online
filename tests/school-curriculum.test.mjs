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
  assert.ok(lessonJS.includes('fetch(manifest[index].file+"?v=11")'));
  assert.equal(manifest.lessons.length, 29);
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
  assert.ok(js.includes('const shown=Boolean(matrix)&&visible.includes(key)'));
  assert.ok(js.includes('currentBirth=null;'));
  assert.ok(js.includes('currentBirth=birth;'));
  assert.ok(css.includes('.school-date-row input::placeholder{color:#9ca8ac;opacity:.8;letter-spacing:normal}'));
  assert.ok(html.includes('lesson.js?v=26'));
  assert.ok(html.includes('lesson.css?v=18'));
});

test("Первый урок без повторов, дата подтверждается галочкой и тест закрыт до последнего шага", async () => {
  const script=await src("pro/school/lesson/lesson.js");
  const page=await src("pro/school/lesson/index.html");
  const styles=await src("pro/school/lesson/lesson.css");
  assert.ok(script.includes('id==="start"?0:'));
  assert.ok(script.includes("const firstLessonSteps=["));
  assert.ok(script.includes("drawFirstLessonOutline()"));
  assert.ok(script.includes("root.hidden=hasInteractiveSteps"));
  assert.ok(script.includes("if(!hasInteractiveSteps){"));
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
  assert.ok(page.includes('href="pro/school/lesson/lesson.css?v=18"'));
  assert.ok(page.includes('src="pro/school/lesson/lesson.js?v=26"'));
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
  assert.ok(script.includes('"Правильно "+score+" из "+data.questions.length'));
  assert.ok(script.includes('review.append(item)'));
  assert.ok(script.includes('document.createTextNode(question.explain)'));
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
  assert.ok(html.includes('lesson.js?v=26'));
  assert.ok(html.includes('lesson.css?v=18'));
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
  assert.ok(!html.includes("school-diagram-footnote"));
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
  assert.ok(page.includes('src="pro/school/lesson/lesson.js?v=26"'));
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
  assert.ok(homePage.includes('school.js?v=6'));
  assert.ok(readerPage.includes('lesson.js?v=26'));
  assert.ok(readerPage.includes('school.css?v=11'));
});

test("Заголовок школы на двух строках одного размера с золотым акцентом",async()=>{
  const html=await src("pro/school/index.html");
  const css=await src("pro/school/school.css");
  assert.ok(html.includes('<h1><span class="school-hero-primary">Учиться самостоятельно</span> <span class="school-hero-gold">это легко!</span></h1>'));
  assert.ok(html.includes('school.css?v=11'));
  assert.ok(css.includes('.school-hero h1 .school-hero-primary,.school-hero h1 .school-hero-gold{display:block;white-space:nowrap}'));
  assert.ok(css.includes('.school-hero h1 .school-hero-gold{color:#9e7e50}'));
  assert.ok(css.includes('.school-hero>.school-overline{margin-bottom:19px}'));
  assert.ok(css.includes('font-size:clamp(23px,6.8vw,54px)'));
  assert.ok(css.includes('color:var(--ink)'));
  assert.ok(!css.includes('.school-hero-first{'));
  assert.ok(!css.includes('.school-hero h1 em{'));
});

test("Все школы описаны темами своих систем без больших статусных кнопок",async()=>{
  const html=await src("pro/schools/index.html");
  const css=await src("pro/schools/schools.css");
  assert.ok(html.includes('schools.css?v=12'));
  assert.equal((html.match(/class="academy-school-description"/g)||[]).length,8);
  assert.ok(!html.includes('class="academy-status'));
  assert.ok(!html.includes('Начать обучение'));
  assert.ok(!html.includes('Уроки готовятся'));
  assert.ok(html.includes('Расчёты по дате и имени · Числа 1-9 · Мастер-числа · Уроки · Тренажёр'));
  assert.ok(html.includes('Психоматрица · Девять ячеек · Характер · Линии квадрата'));
  assert.ok(html.includes('Кармические задачи · Уроки души'));
  assert.ok(html.includes('22 аркана · Значения чисел'));
  assert.ok(html.includes('Число души · Число судьбы'));
  assert.ok(html.includes('Квадрат Ло Шу · Девять секторов'));
  assert.ok(html.includes('Вибрации букв · Число имени'));
  assert.equal((html.match(/class="academy-school academy-school--future"/g)||[]).length,6);
  assert.ok(css.includes('.academy-school--classic>.academy-school-description,'));
  assert.ok(css.includes('.academy-school--future>.academy-school-description{'));
  assert.ok(css.includes('font-size:11.5px;line-height:1.4;'));
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
  assert.ok(html.includes('lesson.js?v=26'));
  assert.ok(html.includes('lesson.css?v=18'));
  assert.ok(js.includes('fetch(manifest[index].file+"?v=11")'));
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
  assert.ok(html.includes('schools.css?v=12'));
});

test("Урок 2 подробно показывает день месяц и сложение цифр года по введённой дате",async()=>{
  const js=await src("pro/school/lesson/lesson.js");
  const css=await src("pro/school/lesson/lesson.css");
  const html=await src("pro/school/lesson/index.html");
  assert.ok(js.includes('Обязательно введите дату рождения ниже'));
  assert.ok(!html.includes('Числа на схеме берутся из того же алгоритма'));
  assert.ok(js.includes('if((id==="reduce"||id==="base")&&step===1)'));
  assert.ok(js.includes('showFirstThreeCalculations(formulaBlock,m,currentBirth)'));
  assert.ok(js.includes('const daySteps=reduce22Formula(birth.day)'));
  assert.ok(js.includes('const yearDigits=String(birth.year).split("").map(Number)'));
  assert.ok(js.includes('...reduce22Formula(yearSum)'));
  assert.ok(js.includes('["Слева (день):",dayFormula]'));
  assert.ok(js.includes('["Сверху (месяц):",monthFormula]'));
  assert.ok(js.includes('["Справа (год):",yearFormula]'));
  assert.ok(html.includes('<div id="lesson-step-formula" class="school-step-formula"></div>'));
  assert.ok(html.includes('lesson.js?v=26'));
  assert.ok(html.includes('lesson.css?v=18'));
  assert.ok(css.includes('.school-step-formula.is-calculation-breakdown{'));
  assert.ok(css.includes('width:fit-content;max-width:100%'));
  assert.ok(css.includes('padding:9px 13px!important;'));
  assert.ok(css.includes('.school-calc-row{display:flex;flex-wrap:wrap;'));
  assert.ok(!css.includes('.school-calc-result{'));
  assert.ok(!css.includes('.school-calc-overline{'));
  assert.ok(!js.includes('ОТКУДА ВЗЯЛИСЬ ЭТИ ЧИСЛА'));
  assert.ok(!js.includes('make("strong","school-calc-result"'));
});

test("Все управляющие элементы школы и уроков компактные без тяжёлых кнопок",async()=>{
  const schoolCSS=await src("pro/school/school.css");
  const lessonCSS=await src("pro/school/lesson/lesson.css");
  const schoolHTML=await src("pro/school/index.html");
  const lessonHTML=await src("pro/school/lesson/index.html");
  assert.ok(schoolCSS.includes('.school-shell .school-primary,'));
  assert.ok(schoolCSS.includes('width:fit-content;max-width:100%'));
  assert.ok(schoolCSS.includes('.school-tabs button{min-height:44px;'));
  assert.ok(schoolCSS.includes('.school-arcana-buttons button{'));
  assert.ok(schoolCSS.includes('.school-lesson-link:not(.is-locked)'));
  assert.ok(lessonCSS.includes('.school-lesson-shell .school-step-formula{'));
  assert.ok(lessonCSS.includes('width:fit-content;max-width:100%'));
  assert.ok(lessonCSS.includes('.school-lesson-shell .school-step-buttons button,'));
  assert.ok(lessonCSS.includes('min-height:44px;padding:9px 13px;'));
  assert.ok(lessonCSS.includes('white-space:nowrap;'));
  assert.ok(lessonCSS.includes('.school-lesson-shell .school-date-row button.is-confirmed{'));
  assert.ok(lessonCSS.includes('.school-lesson-shell .school-quiz-retry{'));
  assert.ok(lessonCSS.includes('.school-lesson-shell .school-date-row{flex-direction:column}'));
  assert.ok(lessonCSS.includes('width:100%;max-width:100%;align-self:stretch;'));
  assert.ok(lessonCSS.includes('min-height:52px;padding:12px 16px;'));
  assert.ok(schoolHTML.includes('school.css?v=11'));
  assert.ok(lessonHTML.includes('school.css?v=11'));
  assert.ok(lessonHTML.includes('lesson.css?v=18'));
});

test("Кнопка использования даты снова широкая на телефоне",async()=>{
  const css=await src("pro/school/lesson/lesson.css");
  const html=await src("pro/school/lesson/index.html");
  assert.ok(css.includes('@media(max-width:560px){\n  .school-lesson-shell .school-date-row{flex-direction:column}'));
  assert.ok(css.includes('width:100%;max-width:100%;align-self:stretch;'));
  assert.ok(css.includes('min-height:52px;padding:12px 16px;'));
  assert.ok(!css.includes('width:fit-content;align-self:flex-start;max-width:100%;'));
  assert.ok(html.includes('lesson.css?v=18'));
});

test("Нижняя точка по введённой дате показывает сумму и объяснение правила 22",async()=>{
  const js=await src("pro/school/lesson/lesson.js");
  const css=await src("pro/school/lesson/lesson.css");
  const page=await src("pro/school/lesson/index.html");
  const base=JSON.parse(await src("pro/school/lessons/base.json"));
  assert.ok(js.includes('"Рассчитайте нижнюю точку"'));
  assert.ok(js.includes('"Нижняя точка - сумма трёх уже записанных чисел'));
  assert.ok(js.includes('else if(step===2){'));
  assert.ok(js.includes('showBottomCalculation(formulaBlock,m)'));
  assert.ok(js.includes('const total=matrix.left+matrix.top+matrix.right;'));
  assert.ok(js.includes('"Так как "+total+" больше 22, мы снова складываем его цифры: "'));
  assert.ok(js.includes('String(total).split("").join(" + ")+" = "+matrix.bottom'));
  assert.ok(js.includes('оставляем его без сокращения'));
  assert.ok(!js.includes('"Найдите нижнюю опору"'));
  assert.ok(base.sections[3].heading.includes("Нижняя точка"));
  assert.ok(base.sections[3].example.includes("4 + 0 = 4"));
  assert.ok(base.questions[0].prompt.includes("нижняя точка"));
  assert.ok(css.includes('.school-lesson-shell .school-step-formula.is-bottom-explanation{'));
  assert.ok(page.includes('lesson.js?v=26'));
  assert.ok(page.includes('lesson.css?v=18'));
});

test("После интерактивных шагов сразу тест, без повторного текста и технической приписки",async()=>{
  const html=await src("pro/school/lesson/index.html");
  const js=await src("pro/school/lesson/lesson.js");
  const css=await src("pro/school/lesson/lesson.css");
  const manifest=JSON.parse(await src("pro/school/lessons-manifest.json"));
  assert.equal(manifest.lessons.length,29);
  assert.ok(!html.includes('school-diagram-footnote'));
  assert.ok(!html.includes('На схеме показаны позиции, а не готовые предсказания'));
  assert.ok(!css.includes('.school-diagram-footnote{'));
  assert.ok(html.indexOf('id="lesson-drawing"')<html.indexOf('id="lesson-content"'));
  assert.ok(html.indexOf('id="lesson-content"')<html.indexOf('id="lesson-quiz"'));
  assert.ok(js.includes('const hasInteractiveSteps=index<=4'));
  assert.ok(js.includes('root.hidden=hasInteractiveSteps'));
  assert.ok(js.includes('if(!hasInteractiveSteps){'));
  assert.ok(js.includes('if(index<=4){'));
  assert.ok(js.includes('step=[0,1,1,0,0][index]'));
  assert.ok(js.includes('else $("lesson-quiz").scrollIntoView({behavior:"smooth",block:"start"})'));
  assert.ok(js.includes('step===guidedEnd()?"К тесту →":"Следующий шаг →"'));
  assert.ok(js.includes('renderQuiz(data)'));
  assert.ok(js.includes('setupDiagram()'));
  assert.ok(html.includes('lesson.js?v=26'));
  assert.ok(html.includes('lesson.css?v=18'));
});

test("Аудит всех 29 уроков: понятные названия, точные вычисления и работающий тренажёр",async()=>{
  const manifest=JSON.parse(await src("pro/school/lessons-manifest.json"));
  const reader=await src("pro/school/lesson/lesson.js");
  const list=await src("pro/school/school.js");
  const points=await src("pro/school/points.js");
  const schoolPage=await src("pro/school/index.html");
  const lessonPage=await src("pro/school/lesson/index.html");
  assert.equal(manifest.lessons.length,29);
  assert.ok(manifest.lessons[2].title.includes("нижнюю точку"));
  for(const item of manifest.lessons){
    const lesson=JSON.parse(await src(item.file));
    assert.equal(lesson.id,item.id);
    assert.equal(lesson.title,item.title);
    assert.ok(lesson.sections.length>=2);
    assert.ok(lesson.questions.every(q=>q.correct>=0&&q.correct<q.options.length));
    const visible=JSON.stringify({lead:lesson.lead,sections:lesson.sections,takeaway:lesson.takeaway,questions:lesson.questions});
    assert.ok(!/опор[а-я]*/i.test(visible),item.id+" всё ещё содержит техническое слово «опора»");
  }
  assert.ok(reader.includes('"Рассчитайте нижнюю точку"'));
  assert.ok(reader.includes('"Чтобы получить центральное число, сложите четыре числа в кружках'));
  assert.ok(reader.includes('showCenterCalculation(formulaBlock,m)'));
  assert.ok(reader.includes('showCornerCalculations(formulaBlock,m)'));
  assert.ok(reader.includes('showInternalCalculations(formulaBlock,m)'));
  assert.ok(reader.includes('step=[0,1,1,0,0][index]'));
  assert.ok(reader.includes('fetch("pro/school/lessons-manifest.json?v=3")'));
  assert.ok(list.includes('fetch("pro/school/lessons-manifest.json?v=3")'));
  assert.ok(list.includes('const option=make("option","",item.title)'));
  assert.ok(list.includes('points.js?v=2'));
  assert.ok(points.includes('point("bottom","Нижняя точка","Основные"'));
  assert.ok(points.includes('digits.join(" + ") + " = " + sum'));
  assert.ok(schoolPage.includes('school.js?v=6'));
  assert.ok(lessonPage.includes('lesson.js?v=26'));
});

test("В третьем уроке пять вопросов, включая способ расчёта центральной энергии",async()=>{
  const data=JSON.parse(await src("pro/school/lessons/base.json"));
  const reader=await src("pro/school/lesson/lesson.js");
  const page=await src("pro/school/lesson/index.html");
  assert.equal(data.questions.length,5);
  const question=data.questions[2];
  assert.equal(question.prompt,"Как правильно рассчитать центральную энергию матрицы?");
  assert.equal(question.options.length,3);
  assert.equal(question.correct,1);
  assert.ok(question.options[1].includes("слева, сверху, справа и снизу"));
  assert.ok(question.options[1].includes("больше 22"));
  assert.ok(question.explain.includes("14 + 7 + 19 + 4 = 44"));
  assert.ok(question.explain.includes("4 + 4 = 8"));
  assert.ok(reader.includes('fetch(manifest[index].file+"?v=11")'));
  assert.ok(page.includes("lesson.js?v=26"));
});

test("Второй и третий уроки имеют разную практику и разные проверочные вопросы",async()=>{
  const reduce=JSON.parse(await src("pro/school/lessons/reduce.json"));
  const base=JSON.parse(await src("pro/school/lessons/base.json"));
  const js=await src("pro/school/lesson/lesson.js");
  const page=await src("pro/school/lesson/index.html");
  assert.ok(reduce.questions.length>=4);
  assert.ok(reduce.questions.some(q=>q.prompt.includes("31")));
  assert.ok(reduce.questions.some(q=>q.prompt.includes("22")));
  assert.equal(base.questions.length,5);
  assert.ok(base.questions.some(q=>q.prompt.includes("нижняя точка")));
  assert.ok(base.questions.some(q=>q.prompt.includes("центральную энергию")));
  assert.equal(reduce.questions.filter(q=>base.questions.some(q2=>q.prompt===q2.prompt)).length,0);
  assert.ok(js.includes('id==="reduce"?2:id==="base"?3:id==="corners"?3:4'));
  assert.ok(js.includes('stageKeys[id==="reduce"?1:step]'));
  assert.ok(js.includes('showRulePractice(formulaBlock)'));
  assert.ok(js.includes('showFirstThreeCalculations(formulaBlock,m,currentBirth)'));
  assert.ok(js.includes('step===guidedEnd()?"К тесту →":"Следующий шаг →"'));
  assert.ok(js.includes('step=Math.max(guidedStart(),step-1)'));
  assert.ok(js.includes('const max=guidedEnd()'));
  assert.ok(page.includes("lesson.js?v=26"));
});

test("Расширенная программа: 29 уроков, тематические модули и практика по 22 энергиям",async()=>{
  const manifest=JSON.parse(await src("pro/school/lessons-manifest.json"));
  assert.equal(manifest.lessons.length,29);
  assert.deepEqual(manifest.lessons.slice(0,5).map(l=>l.id),["start","reduce","base","corners","internal"]);
  assert.equal(new Set(manifest.lessons.map(x=>x.id)).size,29);
  assert.equal(new Set(manifest.lessons.map(x=>x.module)).size,6);
  assert.equal(manifest.lessons.filter(x=>/^energy-\d\d-\d\d$/.test(x.id)).length,11);
  for(const l of manifest.lessons){
    const data=JSON.parse(await src(l.file));
    assert.equal(data.id,l.id);
    assert.equal(data.title,l.title);
    assert.ok(data.sections.length>=2);
    assert.ok(data.questions.length>=2);
    assert.ok(data.questions.every(q=>q.options.length>=2&&q.correct>=0&&q.correct<q.options.length&&q.explain));
    if(l.id.startsWith("energy-")) {
      assert.ok(data.sections.length>=4);
      assert.ok(data.questions.length>=4);
      assert.ok(data.practice);
    }
  }
});
test("Обратная связь после неверного ответа и скрытые контрольные ключи",async()=>{
  const reader=await src("pro/school/lesson/lesson.js");
  const css=await src("pro/school/lesson/lesson.css");
  assert.ok(reader.includes('const review=make("div","school-quiz-review")'));
  assert.ok(reader.includes('review.append(item)'));
  assert.ok(reader.includes('document.createTextNode(question.explain)'));
  assert.ok(reader.includes('id==="case-independent"&&key.includes("контрольный ключ")'));
  assert.ok(reader.includes('if(data.practice){'));
  assert.ok(reader.includes('showCornerStep(formulaBlock,m)'));
  assert.ok(reader.includes('showInternalStep(formulaBlock,m)'));
  assert.ok(css.includes('.school-workbook{'));
  assert.ok(css.includes('.school-answer-key{'));
});

test("Итоговая проверка сложнее вводных уроков",async()=>{
 const start=JSON.parse(await src("pro/school/lessons/start.json"));
 const final=JSON.parse(await src("pro/school/lessons/final.json"));
 const corners=JSON.parse(await src("pro/school/lessons/corners.json"));
 const money=JSON.parse(await src("pro/school/lessons/money-practice.json"));
 assert.equal(start.questions.length,3);
 assert.equal(corners.questions.length,5);
 assert.equal(money.questions.length,4);
 assert.equal(final.questions.length,10);
 assert.ok(final.questions.some(q=>q.prompt.includes("родовой центр")));
 assert.ok(final.questions.some(q=>q.prompt.includes("сумма цифр года")));
 assert.ok(final.questions.some(q=>q.prompt.includes("Клиент")||q.prompt.includes("клиентской")));
});

test("Выпускной практикум: сохранение черновика и критерии самопроверки",async()=>{
 const final=JSON.parse(await src("pro/school/lessons/final.json"));
 const case1=JSON.parse(await src("pro/school/lessons/case-clinic.json"));
 const case2=JSON.parse(await src("pro/school/lessons/case-independent.json"));
 const js=await src("pro/school/lesson/lesson.js");
 const css=await src("pro/school/lesson/lesson.css");
 for(const l of [final,case1,case2]){
   assert.ok(l.practice);
   assert.equal(l.rubric.length,5);
 }
 assert.ok(js.includes('"numerologia-online-school-notes-"+data.id'));
 assert.ok(js.includes('if(Array.isArray(data.rubric)&&data.rubric.length)'));
 assert.ok(js.includes('notes.addEventListener("input"'));
 assert.ok(css.includes('.school-workbook-checklist-items{'));
 assert.ok(css.includes('.school-workbook-textarea{'));
});

test("Классическая школа: 12 уроков, расширенные тесты и последовательный доступ",async()=>{
  const manifest=JSON.parse(await src("pro/schools/classic/manifest.json"));
  const main=await src("pro/schools/classic/classic.js");
  const reader=await src("pro/schools/classic/lesson/lesson.js");
  const page=await src("pro/schools/classic/index.html");
  const lessonPage=await src("pro/schools/classic/lesson/index.html");
  const css=await src("pro/schools/classic/classic.css");
  assert.equal(manifest.lessons.length,12);
  let questions=0;
  for(const meta of manifest.lessons){
    const data=JSON.parse(await src(meta.file));
    assert.equal(data.id,meta.id);
    assert.ok(Array.isArray(data.quizzes));
    assert.ok(data.quizzes.length>=(data.id==="final"?6:4));
    assert.ok(data.quizzes.every(q=>q.correct>=0&&q.correct<q.options.length&&q.options.length>=3&&q.why));
    questions+=data.quizzes.length;
  }
  assert.equal(questions,50);
  assert.ok(main.includes('bank.lessons.slice(0,i).every(previous=>completed.has(previous.id))'));
  assert.ok(main.includes('item(unlocked?"a":"div"'));
  assert.ok(main.includes('if(event.persisted)initLessons()'));
  assert.ok(reader.includes('const questions=Array.isArray(data.quizzes)'));
  assert.ok(reader.includes('const correct=answers.filter'));
  assert.ok(reader.includes('correct===questions.length'));
  assert.ok(reader.includes('manifest.slice(0,activeIndex).find(item=>!readProgress().has(item.id))'));
  assert.ok(reader.includes('if(next&&readProgress().has(id))'));
  assert.ok(reader.includes('document.createTextNode(q.why)'));
  assert.ok(page.includes('classic.js?v=2'));
  assert.ok(lessonPage.includes('lesson.js?v=2'));
  assert.ok(css.includes('.classic-card.is-locked'));
  assert.ok(css.includes('.classic-quiz-review-item'));
});
