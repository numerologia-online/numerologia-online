import { calculateMatrix, parseBirthDate } from "../../numerology-core.js?v=1";
import { pointCatalog } from "./points.js?v=1";

const byId = (id) => document.getElementById(id);
const error = byId("school-error");
const lessonsPanel = byId("school-lessons");
const lessonList = byId("school-lesson-list");
const lessonContent = byId("school-lesson-content");
const progressLabel = byId("school-progress");
const arcanaButtons = byId("school-arcana-buttons");
const arcanaContent = byId("school-arcana-content");
const trainForm = byId("school-train-form");
const trainDateLabel = byId("school-train-date");
const trainPoint = byId("school-train-point");
const trainAnswer = byId("school-train-answer");
const trainFeedback = byId("school-train-feedback");
const tabButtons = [...document.querySelectorAll("[data-school-panel]")];

const make = (tag, className, value) => {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (value !== undefined) item.textContent = String(value);
  return item;
};
const addParagraph = (parent, value, className) => {
  if (value) parent.append(make("p", className, value));
};
const storageKey = "numerologia-online-pro-school-v1";
function readProgress() {
  try {
    const items = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return new Set(Array.isArray(items) ? items.filter((item) => typeof item === "string") : []);
  } catch { return new Set(); }
}
const completed = readProgress();
function saveProgress() {
  try { localStorage.setItem(storageKey, JSON.stringify([...completed])); } catch { /* Можно заниматься без сохранения. */ }
}

let lessons = [];
let arcana = [];
let activeLessonIndex = 0;
let activeArcanaIndex = 0;
let practiceDateIndex = 0;
let practicePointIndex = 0;

const exampleDates = [
  "14.07.1990", "09.09.1986", "29.02.2000", "31.12.1979",
  "15.08.1992", "24.11.2001", "06.05.1995", "23.02.1988",
  "10.06.1969", "28.03.2003", "17.12.1999", "05.01.2010"
];
const practicePoints = pointCatalog;

const formulaForm = byId("school-formula-form");
const formulaDate = byId("school-formula-date");
const formulaError = byId("school-formula-error");
const formulaList = byId("school-formula-list");

function buildFormulaSheet(birth) {
  const matrix = calculateMatrix(birth);
  formulaList.replaceChildren();
  const groups = [...new Set(pointCatalog.map(point => point.group))];
  groups.forEach((groupName) => {
    const section = make("section","school-formula-group");
    section.append(make("h3","",groupName));
    const cards = make("div","school-formula-cards");
    pointCatalog.filter(point => point.group === groupName).forEach((point) => {
      const card = make("article","school-formula-card");
      const header = make("div","school-formula-title");
      header.append(make("span","",point.title),make("strong","",point.get(matrix)));
      card.append(header,make("p","school-equation",point.work(matrix,birth)));
      cards.append(card);
    });
    section.append(cards);
    formulaList.append(section);
  });
}
formulaDate.addEventListener("input", () => {
  const digits = formulaDate.value.replace(/\\D/g,"").slice(0,8);
  formulaDate.value = [digits.slice(0,2),digits.slice(2,4),digits.slice(4,8)].filter(Boolean).join(".");
  formulaError.hidden = true;
});
formulaForm.addEventListener("submit",(event)=>{
  event.preventDefault();
  const birth = parseBirthDate(formulaDate.value);
  if (!birth) {
    formulaError.textContent = "Введите существующую дату в формате ДД.ММ.ГГГГ (не раньше 1900 года).";
    formulaError.hidden = false;
    return;
  }
  formulaError.hidden = true;
  buildFormulaSheet(birth);
});

function showPanel(key) {
  for (const section of document.querySelectorAll(".school-panel")) {
    section.hidden = section.id !== "school-" + key;
  }
  tabButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.schoolPanel === key)));
}
tabButtons.forEach((button) => button.addEventListener("click", () => {
  showPanel(button.dataset.schoolPanel);
  document.querySelector(".school-tabs").scrollIntoView({block:"start",behavior:"smooth"});
}));

function updateProgress() {
  const count = lessons.filter((item) => completed.has(item.id)).length;
  progressLabel.textContent = `${count} из ${lessons.length} пройдено`;
}
function renderLessonList() {
  lessonList.replaceChildren();
  lessons.forEach((lesson, index) => {
    const button = make("button");
    button.type = "button";
    button.setAttribute("aria-current", String(index === activeLessonIndex));
    button.classList.toggle("completed", completed.has(lesson.id));
    button.append(make("span", "school-index-num", completed.has(lesson.id) ? "✓" : index + 1));
    const copy = make("span");
    copy.append(make("strong", "", lesson.title));
    copy.append(make("small", "", `${lesson.level} · ${lesson.minutes} мин чтения`));
    button.append(copy);
    button.addEventListener("click", () => {
      activeLessonIndex = index;
      renderLessonList();
      renderLesson();
      if (window.matchMedia("(max-width: 850px)").matches) {
        lessonContent.scrollIntoView({behavior:"smooth",block:"start"});
      }
    });
    lessonList.append(button);
  });
  updateProgress();
}

function renderQuiz(lesson) {
  const quiz = make("section", "school-quiz");
  quiz.append(make("h4", "", "Проверьте, что запомнили"));
  addParagraph(quiz, "Ответьте на два вопроса. После двух правильных ответов урок отметится как пройденный.", "school-quiz-intro");
  const form = make("form");
  form.noValidate = true;
  lesson.questions.forEach((question, index) => {
    const group = make("fieldset", "school-question");
    group.append(make("legend", "", `${index + 1}. ${question.prompt}`));
    question.options.forEach((option, optionIndex) => {
      const label = make("label");
      const input = make("input");
      input.type = "radio";
      input.name = "quiz-" + index;
      input.value = String(optionIndex);
      label.append(input, make("span", "", option));
      group.append(label);
    });
    form.append(group);
  });
  const submit = make("button", "school-primary", "Проверить знания");
  submit.type = "submit";
  form.append(submit);
  const feedback = make("p", "school-quiz-result");
  feedback.setAttribute("role","status");
  feedback.setAttribute("aria-live","polite");
  form.append(feedback);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const answers = lesson.questions.map((_,i) => form.querySelector(`input[name="quiz-${i}"]:checked`));
    if (answers.some(x => !x)) {
      feedback.textContent = "Сначала выберите ответ на каждый вопрос.";
      return;
    }
    const correct = answers.reduce((count,answer,i) => count + (Number(answer.value) === lesson.questions[i].correct ? 1 : 0), 0);
    if (correct === lesson.questions.length) {
      completed.add(lesson.id);
      saveProgress();
      renderLessonList();
      feedback.textContent = "Все ответы правильные! Урок пройден. Можно двигаться дальше.";
    } else {
      const explanations = lesson.questions.map((question,i) => {
        return Number(answers[i].value) === question.correct ? null : `${i+1}. ${question.explain}`;
      }).filter(Boolean);
      feedback.textContent = `Правильно: ${correct} из ${lesson.questions.length}. ${explanations.join(" ")}`;
    }
  });
  quiz.append(form);
  return quiz;
}

function renderLesson() {
  const lesson = lessons[activeLessonIndex];
  if (!lesson) return;
  lessonContent.replaceChildren();
  lessonContent.append(make("p", "school-overline", `УРОК ${activeLessonIndex + 1} ИЗ ${lessons.length} · ${lesson.level}`));
  lessonContent.append(make("h3", "", lesson.title));
  addParagraph(lessonContent, lesson.lead, "school-lesson-intro");
  lesson.sections.forEach((section) => {
    const wrapper = make("section", "school-topic");
    wrapper.append(make("h4", "", section.heading));
    addParagraph(wrapper, section.text);
    if (section.example) addParagraph(wrapper, section.example, "school-example");
    lessonContent.append(wrapper);
  });
  const box = make("div", "school-takeaway");
  box.append(make("strong", "", "Главное, что нужно запомнить"));
  addParagraph(box, lesson.takeaway);
  lessonContent.append(box, renderQuiz(lesson));
  const controls = make("div", "school-controls");
  const prev = make("button", "school-secondary", "← Предыдущий урок");
  prev.type = "button";
  prev.disabled = activeLessonIndex === 0;
  prev.addEventListener("click", () => moveLesson(-1));
  const next = make("button", "school-primary", "Следующий урок →");
  next.type = "button";
  next.disabled = activeLessonIndex === lessons.length - 1;
  next.addEventListener("click", () => moveLesson(1));
  controls.append(prev,next);
  lessonContent.append(controls);
}
function moveLesson(step) {
  activeLessonIndex = Math.max(0,Math.min(lessons.length - 1,activeLessonIndex + step));
  renderLessonList();
  renderLesson();
  lessonContent.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderArcanaButtons() {
  arcanaButtons.replaceChildren();
  arcana.forEach((item,index)=>{
    const button = make("button", "", item.id);
    button.type = "button";
    button.title = item.name;
    button.setAttribute("aria-label",`${item.id}. ${item.name}`);
    button.setAttribute("aria-pressed",String(index===activeArcanaIndex));
    button.addEventListener("click",()=>{
      activeArcanaIndex=index;
      renderArcanaButtons();
      renderArcana();
    });
    arcanaButtons.append(button);
  });
}
function renderArcana() {
  const item=arcana[activeArcanaIndex];
  if (!item) return;
  arcanaContent.replaceChildren();
  arcanaContent.append(make("p","school-overline",`ЭНЕРГИЯ ${item.id} ИЗ 22`));
  arcanaContent.append(make("h3","school-arcana-title",item.name));
  addParagraph(arcanaContent,item.core,"school-arcana-core");
  const dl=make("dl");
  [["В сильном проявлении",item.plus],["В сложном проявлении",item.minus],["В отношениях",item.love],["В деньгах и работе",item.money]].forEach(([name,desc])=>{
    const section=make("div");
    section.append(make("dt","",name),make("dd","",desc));
    dl.append(section);
  });
  arcanaContent.append(dl);
}

function getTrainingMatrix() {
  const date=exampleDates[practiceDateIndex];
  const [day,month,year]=date.split(".").map(Number);
  return {date,birth:{day,month,year},matrix:calculateMatrix({day,month,year})};
}
function renderTrainer() {
  const {date}=getTrainingMatrix();
  trainDateLabel.textContent=date;
  trainPoint.value=String(practicePointIndex);
  trainAnswer.value="";
  trainFeedback.textContent="";
}
trainPoint.replaceChildren();
practicePoints.forEach((item,index)=>{
  const option=make("option","",item.name);
  option.value=String(index);
  trainPoint.append(option);
});
trainPoint.addEventListener("change",()=>{
  practicePointIndex=Number(trainPoint.value);
  trainAnswer.value="";
  trainFeedback.textContent="";
});
trainForm.addEventListener("submit",(event)=>{
  event.preventDefault();
  const value=Number(trainAnswer.value);
  if (!Number.isInteger(value)||value<1||value>22) {
    trainFeedback.textContent="Введите целое число от 1 до 22.";
    return;
  }
  const {birth,matrix}=getTrainingMatrix();
  const point=practicePoints[practicePointIndex];
  const expected=point.get(matrix);
  const formula=point.work(matrix,birth);
  trainFeedback.textContent = value===expected
    ? `Верно! ${formula}. Хотите ещё? Выберите следующую точку или другую дату.`
    : `Пока не совпало. Правильный ответ: ${expected}. Проверяем: ${formula}. Попробуйте другую точку.`;
});
byId("school-train-next").addEventListener("click",()=>{
  practiceDateIndex=(practiceDateIndex+1)%exampleDates.length;
  practicePointIndex=(practicePointIndex+1)%practicePoints.length;
  renderTrainer();
});

async function startSchool() {
  try {
    const [lessonResponse,arcanaResponse]=await Promise.all([
      fetch("pro/school/lessons.json?v=1"),
      fetch("pro/school/arcana.json?v=1")
    ]);
    if(!lessonResponse.ok||!arcanaResponse.ok)throw new Error("Учебная база недоступна");
    const [lessonData,arcanaData]=await Promise.all([lessonResponse.json(),arcanaResponse.json()]);
    if(lessonData.schema!=="pro-school-lessons-v1"||arcanaData.schema!=="pro-school-arcana-v1"
      || lessonData.lessons?.length!==12||arcanaData.arcana?.length!==22)throw new Error("Учебная база неполная");
    lessons=lessonData.lessons;
    arcana=arcanaData.arcana;
    renderLessonList();
    renderLesson();
    renderArcanaButtons();
    renderArcana();
    renderTrainer();
    buildFormulaSheet({ day:14, month:7, year:1990 });
  }catch(cause) {
    error.hidden=false;
    error.textContent="Не удалось открыть уроки. Обновите страницу и попробуйте снова.";
    lessonContent.textContent="Материалы временно недоступны.";
  }
}
startSchool();
