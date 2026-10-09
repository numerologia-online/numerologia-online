import { calculateMatrix, parseBirthDate, reduce22 } from "../numerology-core.js?v=2";
import { buildFullReportSections, loadFullReportKnowledge, loadFullReportSection } from "../full-report-library.js?v=4";
import { findKarmicPrograms, findKarmicTail, loadKarmicPrograms, loadKarmicTails } from "../karmic-programs.js?v=3";
import { nodesFor } from "./pro-points.js?v=1";
import { createProDiagram } from "./pro-diagram.js?v=5";
import { stopSoulSpeech } from "./pro-voice.js?v=1";
import { createSoulStory } from "./pro-story.js?v=1";

const form = document.querySelector("#pro-form");
const input = document.querySelector("#pro-birth-date");
const error = document.querySelector("#pro-error");
const results = document.querySelector("#pro-results");
const diagram = document.querySelector("#pro-diagram");
const zoneButtons = document.querySelector("#pro-zone-buttons");
const questionButtons = document.querySelector("#pro-question-buttons");
const karmic = document.querySelector("#pro-karma");
const namespace = "http://www.w3.org/2000/svg";

let current = null;
let requestId = 0;
let answerRequestId = 0;
let zoneLibraryRequest;
let previewLibraryRequest;

function loadZoneLibrary() {
  if (!zoneLibraryRequest) {
    zoneLibraryRequest = fetch("pro/zones.json?v=3")
      .then((response) => {
        if (!response.ok) throw new Error("Не удалось загрузить обучающие зоны");
        return response.json();
      })
      .then((source) => {
        if (!Array.isArray(source.zones) || source.zones.length !== 13) {
          throw new Error("Неполная база обучающих зон");
        }
        return source.zones;
      })
      .catch((err) => {
        zoneLibraryRequest = null;
        throw err;
      });
  }
  return zoneLibraryRequest;
}

function loadPreviewLibrary() {
  if (!previewLibraryRequest) {
    previewLibraryRequest = fetch("pro/point-previews.json?v=1")
      .then(response => {
        if (!response.ok) throw new Error("Не удалось загрузить короткие подсказки");
        return response.json();
      })
      .then(source => {
        if (Object.keys(source.energies || {}).length !== 22 || Object.keys(source.titles || {}).length !== 31) {
          throw new Error("База коротких подсказок неполная");
        }
        return source;
      })
      .catch(error => { previewLibraryRequest = null; throw error; });
  }
  return previewLibraryRequest;
}

const category = {
  impression: "Личность", trueSelf: "Личность", growth: "Личность", character: "Личность",
  parentsPain: "Семья и род", familyError: "Семья и род",
  trueLove: "Любовь", partner: "Любовь",
  moneyBlock: "Деньги", moneyFlow: "Деньги", earning: "Деньги",
  energyLeak: "Состояние", health: "Состояние", lifeLesson: "Уроки жизни"
};

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function paragraph(text, className) {
  return element("p", text, className);
}

function appendParagraph(parent, text, className) {
  if (text) parent.append(paragraph(text, className));
}

function svgElement(tag, attributes) {
  const node = document.createElementNS(namespace, tag);
  Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

const {hidePointPreview, renderZones, renderDiagram} = createProDiagram({
  getCurrent: () => current,
  diagram, zoneButtons, questionButtons,
  element, svgElement,
  onSelectQuestion: (key, scroll) => selectQuestion(key, scroll)
});
const appendSoulStoryCard = createSoulStory({element, paragraph, karmic, getCurrent: () => current});

function renderQuestions(definitions) {
  const frag = document.createDocumentFragment();
  definitions.forEach(definition => {
    const card = element("div", null, "pro-question-item");
    const button = element("button");
    button.type = "button";
    button.id = "pro-question-" + definition.key;
    button.dataset.question = definition.key;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "pro-answer-" + definition.key);
    button.append(element("small", category[definition.key] || "Расшифровка"));
    button.append(element("span", definition.title));

    const panel = element("article", null, "pro-answer");
    panel.id = "pro-answer-" + definition.key;
    panel.hidden = true;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", button.id);
    panel.setAttribute("aria-live", "polite");

    button.addEventListener("click", () => selectQuestion(definition.key, false));
    card.append(button, panel);
    frag.append(card);
  });
  questionButtons.replaceChildren(frag);
}

function isSubheading(text) {
  if(text.length>68 || text.includes("\n"))return false;
  return /^(Что это значит|Как проявляется|Где уходит|Что делать|Чего не делать|Стратегия|В плюсе|В минусе|Главный совет|Ваши сильные|Ваши слабые|Как включить|Где легче)/i.test(text) && !/[.!?]$/.test(text);
}

// Только переход из подсказки на матрице требует прокрутки к вопросу.
// Обычное нажатие на вопрос никогда не переносит экран вниз.
function scrollToSelectedQuestion(id, key, button) {
  window.requestAnimationFrame(() => {
    if (!current || current.id !== id || current.selected !== key || !button.isConnected) return;
    button.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
  });
}

async function selectQuestion(key, scroll = false) {
  if (!current) return;
  const definition = current.definitions.find(item => item.key === key);
  if (!definition) return;
  const button = Array.from(questionButtons.querySelectorAll("button[data-question]"))
    .find(item => item.dataset.question === key);
  const answer = button?.parentElement?.querySelector(".pro-answer");
  if (!button || !answer) return;

  const id = current.id;
  const request = ++answerRequestId;
  const alreadyOpen = current.selected === key;
  // Нажатие на ту же карточку закрывает её; переход с матрицы - открывает.
  current.selected = alreadyOpen && !scroll ? null : key;

  questionButtons.querySelectorAll(".pro-question-item").forEach(card => {
    const trigger = card.querySelector("button[data-question]");
    const panel = card.querySelector(".pro-answer");
    const open = trigger.dataset.question === current.selected;
    card.classList.toggle("expanded", open);
    trigger.setAttribute("aria-expanded", String(open));
    trigger.setAttribute("aria-pressed", String(open));
    panel.hidden = !open;
    if (!open) panel.setAttribute("aria-busy", "false");
  });
  if (current.selected !== key) return;
  if (scroll) scrollToSelectedQuestion(id, key, button);
  if (alreadyOpen) return;

  answer.setAttribute("aria-busy", "true");
  answer.replaceChildren(paragraph("Загружаю подробную расшифровку…", "pro-muted"));
  try {
    const bank = await loadFullReportSection(definition.energy);
    if (!current || current.id !== id || current.selected !== key || answerRequestId !== request) return;
    const source = bank?.sections?.[key];
    if (!source?.paragraphs?.length) throw new Error("Нет описания этой позиции");
    answer.replaceChildren();
    answer.append(paragraph("ОТВЕТ ПО ВАШЕЙ МАТРИЦЕ", "pro-eyebrow"));
    answer.append(element("h3", source.title || definition.title));
    const chips = element("div", null, "pro-chips");
    chips.append(element("span", "Энергия " + definition.energy));
    chips.append(element("span", "Тема: " + (category[key] || "Расшифровка")));
    const energy = current.knowledge.energies[String(definition.energy)];
    if (energy?.name) chips.append(element("span", energy.name));
    answer.append(chips);
    const match = current.points.find(point => point.topic === key);
    if (match) answer.append(paragraph("Точка матрицы: " + match.label + ". Формула: " + match.formula, "pro-equation"));
    source.paragraphs.filter(Boolean).forEach(text => {
      answer.append(isSubheading(text) ? element("h4", text, "pro-paragraph-title") : paragraph(text));
    });
    answer.setAttribute("aria-busy", "false");
  } catch (err) {
    if (!current || current.id !== id || current.selected !== key || answerRequestId !== request) return;
    answer.setAttribute("aria-busy", "false");
    answer.replaceChildren(paragraph("Не удалось загрузить расшифровку. Проверьте соединение и попробуйте выбрать вопрос снова.", "pro-muted"));
  }
}

function renderKarmic(matrix, programsBank, tailsBank) {
  const tail=findKarmicTail(matrix,tailsBank);
  const programs=findKarmicPrograms(matrix,programsBank);
  karmic.replaceChildren();
  const code=[matrix.tail.first,matrix.tail.second,matrix.bottom].join("-");
  karmic.append(paragraph("Кармический хвост: " + code));
  function card(title,source){
    const details=element("details");
    const summary=element("summary",title);
    details.append(summary);
    (source.parts||[]).forEach(part=>{
      details.append(element("h4",part.title));
      details.append(paragraph(part.text));
    });
    return details;
  }
  if(tail){
    karmic.append(card("Описание кармического хвоста",tail));
    appendSoulStoryCard(tail,code);
  }
  else karmic.append(paragraph("Для этой комбинации развёрнутая программа пока не найдена.","pro-muted"));
  if(programs.length){
    programs.forEach(program=>karmic.append(card(program.code+" · "+program.title+" (повторов: "+program.repeats+")",program)));
  }else{
    karmic.append(paragraph("Среди подготовленных кармических программ дополнительных совпадений не найдено.","pro-muted"));
  }
}

input.addEventListener("input",()=>{
  const digits=input.value.replace(/\D/g,"").slice(0,8);
  input.value=[digits.slice(0,2),digits.slice(2,4),digits.slice(4,8)].filter(Boolean).join(".");
  error.hidden=true;
});

form.addEventListener("submit", async(event)=>{
  event.preventDefault();
  const birth=parseBirthDate(input.value);
  if(!birth){
    error.textContent="Введите существующую дату в формате ДД.ММ.ГГГГ.";
    error.hidden=false;
    input.focus();
    return;
  }
  error.hidden=true;
  const id=++requestId;
  hidePointPreview();
  stopSoulSpeech();
  current=null;
  results.hidden=true;
  const submit=form.querySelector("button[type=submit]");
  submit.disabled=true;
  submit.textContent="Подбираю ответы…";
  try{
    const matrix=calculateMatrix(birth);
    const [knowledge,zones,previews]=await Promise.all([loadFullReportKnowledge(),loadZoneLibrary(),loadPreviewLibrary()]);
    if(id!==requestId)return;
    const points=nodesFor(birth,matrix);
    const definitions=buildFullReportSections(matrix);
    current={id,birth,matrix,knowledge,points,definitions,zones,previews,activeZone:null,selected:null};
    renderDiagram(points);
    renderZones(zones);
    renderQuestions(definitions);
    results.hidden=false;
    results.scrollIntoView({behavior:"smooth",block:"start"});
    karmic.replaceChildren(paragraph("Подбираю кармические программы…","pro-muted"));
    Promise.all([loadKarmicPrograms(),loadKarmicTails()])
      .then(([programs,tails])=>{if(current?.id===id)renderKarmic(matrix,programs,tails);})
      .catch(()=>{if(current?.id===id)karmic.replaceChildren(paragraph("Не получилось загрузить кармические программы. Попробуйте обновить страницу.","pro-muted"));});
  }catch(err){
    error.textContent="Не удалось загрузить расчёт. Обновите страницу и попробуйте снова.";
    error.hidden=false;
  }finally{
    submit.disabled=false;
    submit.textContent="Рассчитать →";
  }
});
