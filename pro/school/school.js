import { calculateMatrix, parseBirthDate } from "../../numerology-core.js?v=1";
import { pointCatalog } from "./points.js?v=2";

const byId = (id) => document.getElementById(id);
const error = byId("school-error");
const lessonsPanel = byId("school-lessons");
const lessonList = byId("school-lesson-list");
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
let completed = readProgress();
function saveProgress() {
  try { localStorage.setItem(storageKey, JSON.stringify([...completed])); } catch { /* Можно заниматься без сохранения. */ }
}

let lessons = [];
let arcana = [];
let activeArcanaIndex = 0;
let practiceDateIndex = 0;
let practicePointIndex = 0;

const exampleDates = [
  "14.07.1990", "08.09.1987", "29.02.2000", "31.12.1979",
  "15.08.1992", "24.11.2001", "06.05.1995", "23.02.1988",
  "16.06.1970", "28.03.2003", "17.12.1999", "05.01.2010"
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
  const digits = formulaDate.value.replace(/\D/g,"").slice(0,8);
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
  completed = readProgress();
  lessonList.replaceChildren();
  const groups = [];
  lessons.forEach((lesson,position)=>{
    const title=lesson.module||"ПРОГРАММА ОБУЧЕНИЯ";
    const last=groups.at(-1);
    if(last&&last.title===title)last.items.push({lesson,position});
    else groups.push({title,items:[{lesson,position}]});
  });
  for (const group of groups) {
    const items=group.items;
    if (!items.length) continue;
    const section = make("section","school-lesson-module");
    section.append(make("h3","school-lesson-module-title",group.title));
    const list = make("div","school-lesson-module-list");
    items.forEach(({lesson,position}) => {
      const unlocked=lessons.slice(0,position).every(previous=>completed.has(previous.id));
      const link=make(unlocked?"a":"div","school-lesson-link"+(unlocked?"":" is-locked"));
      if(unlocked)link.href = "pro/school/lesson/?id=" + encodeURIComponent(lesson.id);
      else{
        link.setAttribute("aria-disabled","true");
        link.title="Откроется после успешного прохождения предыдущих уроков";
      }
      if(completed.has(lesson.id))link.classList.add("completed");
      const number=make("span","school-lesson-number",completed.has(lesson.id)?"✓":position+1);
      const summary=make("span","school-lesson-summary");
      summary.append(make("strong","",lesson.title));
      summary.append(make("small","",lesson.level+" · "+lesson.minutes+" мин"));
      if(!unlocked)summary.append(make("small","school-lesson-locked-hint","Откроется после предыдущих уроков"));
      link.append(number,summary,make("span","school-lesson-arrow",unlocked?"→":"🔒"));
      list.append(link);
    });
    section.append(list);
    lessonList.append(section);
  }
  updateProgress();
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
  const option=make("option","",item.title);
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
      fetch("pro/school/lessons-manifest.json?v=3"),
      fetch("pro/school/arcana.json?v=1")
    ]);
    if(!lessonResponse.ok||!arcanaResponse.ok)throw new Error("Учебная база недоступна");
    const [lessonData,arcanaData]=await Promise.all([lessonResponse.json(),arcanaResponse.json()]);
    if(lessonData.schema!=="pro-school-lessons-manifest-v1"||arcanaData.schema!=="pro-school-arcana-v1"
      || !Array.isArray(lessonData.lessons)||lessonData.lessons.length<1||arcanaData.arcana?.length!==22)throw new Error("Учебная база неполная");
    lessons=lessonData.lessons;
    arcana=arcanaData.arcana;
    renderLessonList();
    renderArcanaButtons();
    renderArcana();
    renderTrainer();
    buildFormulaSheet({ day:14, month:7, year:1990 });
  }catch(cause) {
    error.hidden=false;
    error.textContent="Не удалось открыть уроки. Обновите страницу и попробуйте снова.";
    lessonList.textContent="Программа временно недоступна.";
  }
}
window.addEventListener("pageshow",()=>{if(lessons.length)renderLessonList()});
window.addEventListener("storage",event=>{
  if(event.key===storageKey&&lessons.length)renderLessonList();
});
startSchool();
