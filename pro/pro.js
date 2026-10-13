import { calculateMatrix, parseBirthDate, reduce22 } from "../numerology-core.js?v=4";
import { buildFullReportSections, loadFullReportKnowledge, loadFullReportSection } from "../full-report-library.js?v=4";
import { findKarmicPrograms, findKarmicTail, getMatrixTriples, loadKarmicPrograms, loadKarmicProgramGuidance, loadKarmicTails } from "../karmic-programs.js?v=31";
import { nodesFor } from "./pro-points.js?v=2";
import { createProDiagram } from "./pro-diagram.js?v=13";
import { createFullReportPdfController } from "../full-report-pdf.js?v=4";
import { buildProPdfChapters } from "./pro-pdf-content.js?v=24";
import { loadPurposeReadings, getPurposeReading } from "./purpose-readings.js?v=1";

const schoolClientMode = new URLSearchParams(window.location.search).get("from") === "school";
const defaultSubmitHtml = schoolClientMode
  ? 'Рассчитать для клиента <span aria-hidden="true">→</span>'
  : 'Открыть мой разбор <span aria-hidden="true">→</span>';

const form = document.querySelector("#pro-form");
const input = document.querySelector("#pro-birth-date");
if (schoolClientMode) {
  const homeLink = document.querySelector("#pro-home-link");
  homeLink.href = "pro/school/";
  homeLink.textContent = "← В школу";
  homeLink.setAttribute("aria-label", "Вернуться в Школу нумерологов");
  document.querySelector(".pro-hero .pro-eyebrow").textContent = "РАСЧЁТ ДЛЯ КЛИЕНТА";
  document.querySelector(".pro-hero h1").textContent = "Полный разбор клиента";
  document.querySelector(".pro-hero-lead").textContent =
    "Введите дату рождения клиента, получите полную матрицу с подробными расшифровками и сохраните персональный PDF. Все расчёты и тексты используются из основного раздела.";
  document.querySelector('label[for="pro-birth-date"]').textContent = "Дата рождения клиента";
  form.querySelector('button[type="submit"]').innerHTML = defaultSubmitHtml;
}
const error = document.querySelector("#pro-error");
const results = document.querySelector("#pro-results");
const diagram = document.querySelector("#pro-diagram");
const pointDetails = document.querySelector("#pro-point-details");
const zoneButtons = document.querySelector("#pro-zone-buttons");
const zoneReading = document.querySelector("#pro-zone-reading");
const questionButtons = document.querySelector("#pro-question-buttons");
const karmic = document.querySelector("#pro-karma");
const purpose = document.querySelector("#pro-purpose");
const pdfControls = document.querySelector("#pro-pdf-controls");
const pdfButtons = document.querySelector("#pro-pdf-buttons");
const zoneReadingHome = zoneReading.nextElementSibling; // caption after the unchanged matrix
let selectedZoneFrom = "diagram";
diagram.addEventListener("click", () => { selectedZoneFrom = "diagram"; }, true);
zoneButtons.addEventListener("click", () => { selectedZoneFrom = "picker"; }, true);

const namespace = "http://www.w3.org/2000/svg";

let current = null;
let requestId = 0;
let answerRequestId = 0;
let zoneLibraryRequest;
let previewLibraryRequest;
const practicalEnergies = new Set([4, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
const practicalGuidanceRequests = new Map();

function loadPracticalGuidance(energy) {
  const number = Number(energy);
  if (!practicalEnergies.has(number)) return Promise.resolve(null);
  if (!practicalGuidanceRequests.has(number)) {
    const request = fetch("pro/guidance/energy-" + number + ".json?v=1")
      .then(response => {
        if (!response.ok) throw new Error("Не удалось загрузить практическое дополнение");
        return response.json();
      })
      .then(bank => {
        if (bank.energy !== number || Object.keys(bank.sections || {}).length !== 14) {
          throw new Error("Практическое дополнение неполное");
        }
        return bank;
      })
      .catch(() => {
        practicalGuidanceRequests.delete(number);
        return null;
      });
    practicalGuidanceRequests.set(number, request);
  }
  return practicalGuidanceRequests.get(number);
}

let karmicDeepeningRequest;
function loadKarmicDeepening() {
  if (!karmicDeepeningRequest) {
    // Program supplements are already included in the shared program JSON.
    // Only the two ordered karmic-tail supplements remain separate.
    const paths = [
      "pro/karmic-tail-deepening-a.json",
      "pro/karmic-tail-deepening-b.json"
    ];
    karmicDeepeningRequest = Promise.all([
      ...paths.map(path => fetch(path + "?v=12").then(response => {
        if (!response.ok) throw new Error("Не удалось загрузить дополнения кармического хвоста");
        return response.json();
      })),
      loadKarmicProgramGuidance()
    ]).then(([tailA, tailB, program]) => {
      if (tailA.role !== "tail" || tailB.role !== "tail" ||
          !tailA.entries || !tailB.entries) {
        throw new Error("Неполная база дополнений кармического хвоста");
      }
      return { tail: { ...tailA.entries, ...tailB.entries }, program };
    }).catch(error => {
      karmicDeepeningRequest = null;
      throw error;
    });
  }
  return karmicDeepeningRequest;
}

function loadZoneLibrary() {
  if (!zoneLibraryRequest) {
    zoneLibraryRequest = fetch("pro/zones.json?v=7")
      .then((response) => {
        if (!response.ok) throw new Error("Не удалось загрузить обучающие зоны");
        return response.json();
      })
      .then((source) => {
        if (!Array.isArray(source.zones) || source.zones.length !== 13
          || source.zones.some(zone => !zone.reading || zone.points.some(key => !zone.reading.roles?.[key]))) {
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
    previewLibraryRequest = fetch("pro/point-previews.json?v=2")
      .then(response => {
        if (!response.ok) throw new Error("Не удалось загрузить короткие подсказки");
        return response.json();
      })
      .then(source => {
        if (Object.keys(source.energies || {}).length !== 22 || Object.keys(source.titles || {}).length !== 31 || Object.keys(source.details || {}).length !== 31) {
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

const {hidePointPreview, hideZonePreview, clearZone, renderZones, renderDiagram} = createProDiagram({
  getCurrent: () => current,
  diagram, zoneButtons, questionButtons,
  element, svgElement,
  onSelectQuestion: (key, scroll) => selectQuestion(key, scroll),
  onOpenPoint: (key) => openPointDetail(key),
  onSelectZone: (zone, scroll) => renderZoneReading(zone, scroll)
});
// The fourteenth compact topic now behaves exactly like the other sphere buttons:
// first a preview, then the original full interpretation at this very position.
// We MOVE #pro-karma instead of cloning it so that every existing action,
// disclosure, audio control, and already loaded interpretation stays functional.
const karmicHome = karmic.parentElement;
const karmicHomeNext = karmic.nextSibling;
const karmicPreview = element("button", null, "pro-point-preview pro-zone-preview inline pro-karmic-preview");
karmicPreview.id = "pro-karmic-preview";
karmicPreview.type = "button";
karmicPreview.hidden = true;
karmicPreview.setAttribute("aria-label", "Открыть полный разбор кармических программ");
const karmicInline = element("section", null, "pro-zone-reading pro-karmic-inline-reading");
karmicInline.id = "pro-karmic-inline-reading";
karmicInline.hidden = true;
karmicInline.setAttribute("aria-label", "Полный разбор кармических программ");
const karmicInlineHead = element("div", null, "pro-zone-reading-header");
const karmicInlineTitles = element("div");
karmicInlineTitles.append(element("p", "ВАША МАТРИЦА · РАЗБОР СФЕРЫ", "pro-eyebrow"));
karmicInlineTitles.append(element("h3", "Кармические программы"));
const closeKarmicButton = element("button", "Закрыть", "pro-zone-reading-close");
closeKarmicButton.type = "button";
closeKarmicButton.setAttribute("aria-label", "Закрыть разбор кармических программ");
karmicInlineHead.append(karmicInlineTitles, closeKarmicButton);
karmicInline.append(karmicInlineHead);

function karmicTopicButton() {
  return zoneButtons.querySelector('button[data-karmic="true"]');
}
function hideKarmicPreview() {
  karmicPreview.hidden = true;
  karmicPreview.remove();
}
function closeKarmicInline({restoreFocus = false} = {}) {
  hideKarmicPreview();
  if (karmic.parentNode !== karmicHome) {
    karmicHome.insertBefore(karmic, karmicHomeNext);
  }
  karmicHome.hidden = false;
  karmicInline.hidden = true;
  karmicInline.remove();
  const button = karmicTopicButton();
  if (button) {
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "pro-karmic-preview");
    if (restoreFocus) button.focus();
  }
}
function showKarmicPreview(button) {
  closeKarmicInline();
  clearZone();
  hidePointPreview();
  hideZonePreview();
  karmicPreview.replaceChildren();
  karmicPreview.append(element("span", "ВЫБРАННАЯ СФЕРА", "pro-point-preview-eyebrow"));
  karmicPreview.append(element("strong", "Кармические программы", "pro-point-preview-title"));
  const matrix = current?.matrix;
  if (matrix?.tail) {
    const code = [matrix.tail.first, matrix.tail.second, matrix.bottom].join("-");
    karmicPreview.append(element("span", "Ваш кармический хвост: " + code, "pro-zone-preview-values"));
  }
  karmicPreview.append(element("span", "Узнайте, какие программы проявляются в вашей матрице, где они повторяются и как с ними работать.", "pro-point-preview-excerpt"));
  karmicPreview.append(element("span", "Открыть разбор ↓", "pro-point-preview-next"));
  button.after(karmicPreview);
  karmicPreview.hidden = false;
  button.setAttribute("aria-expanded", "true");
}
function openKarmicInline() {
  const button = karmicTopicButton();
  if (!button || !current) return;
  hideKarmicPreview();
  clearZone();
  hideZonePreview();
  // Retain the real, interactive reading and all its event listeners.
  karmicInline.append(karmic);
  karmicHome.hidden = true;
  button.after(karmicInline);
  karmicInline.hidden = false;
  button.setAttribute("aria-expanded", "true");
  button.setAttribute("aria-controls", "pro-karmic-inline-reading");
}
karmicPreview.addEventListener("click", openKarmicInline);
closeKarmicButton.addEventListener("click", () => closeKarmicInline({restoreFocus: true}));
zoneButtons.addEventListener("click", event => {
  const specialButton = event.target.closest('button[data-karmic="true"]');
  if (specialButton) {
    if (!current) return;
    if (karmicPreview.isConnected || karmicInline.isConnected) {
      closeKarmicInline();
    } else {
      showKarmicPreview(specialButton);
    }
    return;
  }
  if (event.target.closest('button[data-zone]')) closeKarmicInline();
});
diagram.addEventListener("click", event => {
  if (event.target.closest(".pro-sector-tag, .pro-node")) closeKarmicInline();
}, true);
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && (karmicPreview.isConnected || karmicInline.isConnected)) {
    closeKarmicInline({restoreFocus: true});
  }
});
document.querySelector('a[href="#pro-karmic-title"]')?.addEventListener("click", () => closeKarmicInline());

// Client customization is lazy and runs only when opened from the School.
let schoolClientPdf = null;
let schoolClientPdfLoading = null;
const getSchoolClientPdf = () => {
  if (!schoolClientMode) return Promise.reject(new Error("Режим школы не активен"));
  if (schoolClientPdf) return Promise.resolve(schoolClientPdf);
  if (!schoolClientPdfLoading) {
    schoolClientPdfLoading = import("./school/client-pdf.js?v=2")
      .then(({ createSchoolClientPdf }) => {
        schoolClientPdf = createSchoolClientPdf();
        return schoolClientPdf;
      }).catch((error) => {
        schoolClientPdfLoading = null;
        throw error;
      });
  }
  return schoolClientPdfLoading;
};
if (schoolClientMode) {
  const schoolPdfStyles = document.createElement("link");
  schoolPdfStyles.rel = "stylesheet";
  schoolPdfStyles.href = "pro/school/client-pdf.css?v=2";
  document.head.append(schoolPdfStyles);
}

const {invalidateFullPdf, createFullReportPdfButton} = createFullReportPdfController({
  getReport: () => current?.pdfReport || null,
  reading: pdfButtons,
  extendContent: buildProPdfChapters,
  buttonClass: "pro-pdf-button",
  beforeDownload: schoolClientMode ? async () => (await getSchoolClientPdf()).beforeDownload() : null,
  customizeDocument: schoolClientMode ? async (documentDefinition) => {
    return (await getSchoolClientPdf()).customizeDocument(documentDefinition);
  } : null
});

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

// Один общий вывод полного авторского текста для точек схемы и сфер.
// Берём готовый раздел из того же банка, который используется в «О чём хотите узнать?».
// Никакой второй версии трактовок или формул.

// Смысловые главы исходных авторских текстов; ни один абзац не переписываем.
function authorChapterTag(title){
  const t=title.toLowerCase().replaceAll("ё","е");
  if(t.startsWith("что это значит"))return ["meaning"];
  if(t.startsWith("в чем ваша сила"))return ["meaning","plus"];
  if(t.startsWith("как проявляется в плюсе"))return ["plus"];
  if(t.startsWith("где вы сами себе")||t.startsWith("где уходит в минус")||t.startsWith("в минусе"))return ["shadow","limits"];
  if(t.startsWith("главный запрет"))return ["limits"];
  if(t.startsWith("что жизнь будет"))return ["cost"];
  if(t.startsWith("что начнет приходить"))return ["plus","reward"];
  if(t.startsWith("где вы путаете"))return ["dilemma"];
  if(t.startsWith("как перестать терять силы"))return ["resource"];
  if(t.startsWith("что делать"))return ["action","resource"];
  if(t.startsWith("какой уровень жизни")||t.startsWith("стратегия на будущее"))return ["future"];
  if(t.startsWith("в плюсе"))return ["plus","reward"];
  return ["meaning"];
}
function authorParagraphTags(text,index,total){
  const t=text.toLowerCase().replaceAll("ё","е");
  if(t.startsWith("что это значит"))return ["meaning","plus"];
  if(t.startsWith("в плюсе"))return ["plus","reward"];
  if(t.startsWith("в минусе"))return ["shadow","limits"];
  if(t.startsWith("что делать"))return ["action","resource"];
  if(t.startsWith("стратегия")||t.startsWith("главная точка роста"))return ["future","action"];
  if(t.startsWith("но ")||t.startsWith("однако ")||t.startsWith("главная потеря"))return ["shadow","dilemma","limits"];
  if(index===0)return ["meaning","plus"];
  if(index===total-1)return ["future","action","reward"];
  if(index===1)return ["plus","dilemma"];
  if(index===2)return ["shadow","limits"];
  return ["action","resource","cost"];
}
function authorChapters(paragraphs){
  const texts=(paragraphs||[]).filter(Boolean);
  const chapters=[];
  texts.forEach(text=>{
    const heading=text.length<92&&!/[.!?…]$/.test(text)&&!text.includes("\n");
    if(heading)chapters.push({title:text,body:[],tags:authorChapterTag(text)});
    else{
      if(!chapters.length)chapters.push({title:"Авторский текст",body:[],tags:["meaning"]});
      chapters[chapters.length-1].body.push(text);
    }
  });
  // Некоторые авторские энергии написаны сплошным рассказом или со встроенными
  // подзаголовками. Делим по целым абзацам, не редактируя их содержания.
  if(chapters.length<=1&&texts.length>=3){
    const contents=chapters.flatMap(ch=>ch.body);
    const labels=["Главная тема","Как проявляется","На что обратить внимание","Практический ориентир","Перспектива"];
    return contents.map((text,index)=>({
      title:labels[Math.min(index,labels.length-1)],
      body:[text],
      tags:authorParagraphTags(text,index,contents.length)
    }));
  }
  return chapters;
}
function appendAuthorChapter(target,chapter){
  target.append(element("h5",chapter.title,"pro-inline-reading-subheading"));
  chapter.body.forEach(item=>target.append(paragraph(item)));
}
function appendPositionReading(target,section,definition,ctx,energy){
  const chapters=authorChapters(section.paragraphs);
  const focus=new Set(ctx.focus||[]);
  const available=chapters.filter(ch=>ch.body.length);
  // Если похожая тема встречается в одной сфере несколько раз,
  // подбираем разные сочетания АВТОРСКИХ глав, а не копируем одно и то же.
  // When one authored topic describes several points of a sphere, show two
  // different substantial chapters rather than repeating three near-identical ones.
  const sameTopicPositions=(ctx.relatedFocus||[]).length;
  const size=Math.min(available.length,sameTopicPositions>1?2:(available.length>4?3:2));
  const combinations=[];
  function collect(start,chosen){
    if(chosen.length===size){combinations.push(chosen);return}
    for(let i=start;i<=available.length-(size-chosen.length);i++)collect(i+1,[...chosen,available[i]]);
  }
  collect(0,[]);
  // Последовательно выбираем наиболее подходящие неповторяющиеся сочетания
  // для всех точек одной темы. Разные фокусы не должны давать один и тот же результат.
  const used=new Set();
  let chosen=available;
  const allFocus=ctx.relatedFocus||[ctx.focus];
  for(let ordinal=0;ordinal<=(ctx.variant||0);ordinal++){
    const wanted=new Set(allFocus[ordinal]||ctx.focus);
    const ranked=combinations.map((chapters,index)=>({
      chapters,index,
      score:chapters.reduce((sum,ch)=>sum+ch.tags.filter(tag=>wanted.has(tag)).length,0)
    })).sort((a,b)=>b.score-a.score||a.index-b.index);
    const picked=ranked.find(item=>!used.has(item.index))||ranked[0];
    if(picked){used.add(picked.index);chosen=picked.chapters}
  }
  target.append(element("p","ЭНЕРГИЯ "+energy+" В ЭТОЙ ПОЗИЦИИ","pro-eyebrow"));
  target.append(element("h4",ctx.title||section.title,"pro-inline-reading-title"));
  // Show the matching authored paragraphs immediately, not a generic position description.
  chosen.forEach(ch=>appendAuthorChapter(target,ch));
  target.append(element("h5","Вопрос для себя","pro-inline-reading-subheading"));
  target.append(paragraph(ctx.question,"pro-position-question"));
  const original=element("details",null,"pro-position-original");
  original.append(element("summary","Читать подробную трактовку целиком"));
  const all=element("div",null,"pro-position-original-text");
  all.append(element("h4",section.title||definition.title,"pro-inline-reading-title"));
  chapters.forEach(ch=>appendAuthorChapter(all,ch));
  original.append(all);target.append(original);
}

function loadInlineFullReading(target, key, pointEnergy = null, includeGuidance = true, positionContext = null) {
  const report = current;
  const definition = report?.definitions.find(item => item.key === key);
  if (!definition) return;
  const id = report.id;
  // Для тематических точек берём значение именно выбранного кружка,
  // а не энергию того же вопроса из другой позиции общего PDF.
  const energy = Number.isInteger(pointEnergy) ? pointEnergy : definition.energy;
  target.replaceChildren(paragraph("Открываю полный разбор…", "pro-muted"));
  return Promise.all([loadFullReportSection(energy), includeGuidance ? loadPracticalGuidance(energy) : Promise.resolve(null)])
    .then(([bank, guidance]) => {
      if (!current || current.id !== id || !target.isConnected) return;
      const section = bank?.sections?.[key];
      if (!section?.paragraphs?.length) throw new Error("Полный текст позиции не найден");
      const fragment = document.createDocumentFragment();
      if(positionContext){
        appendPositionReading(fragment,section,definition,positionContext,energy);
      }else{
      fragment.append(element("p", "ПОЛНЫЙ РАЗБОР ПО ВАШЕЙ МАТРИЦЕ", "pro-eyebrow"));
      fragment.append(element("h4", section.title || definition.title, "pro-inline-reading-title"));
      section.paragraphs.filter(Boolean).forEach(text => {
        fragment.append(isSubheading(text)
          ? element("h5", text, "pro-inline-reading-subheading")
          : paragraph(text));
      });
      }
      const practical = guidance?.sections?.[key];
      if (practical?.action && practical?.result) {
        fragment.append(element("h5", "Практика на ближайшие семь дней", "pro-inline-reading-subheading"));
        fragment.append(paragraph(practical.action));
        fragment.append(element("h5", "Как понять что энергия вышла в плюс", "pro-inline-reading-subheading"));
        fragment.append(paragraph(practical.result));
      }
      target.replaceChildren(fragment);
    })
    .catch(error => {
      if (current?.id !== id || !target.isConnected) return;
      console.warn("Полная расшифровка точки:", error);
      const position = target.closest(".pro-zone-reading-position");
      if (position) delete position.dataset.loaded; // allow retry on next opening
      target.replaceChildren(paragraph("Не удалось загрузить полный текст. Проверьте интернет и откройте позицию ещё раз.", "pro-muted"));
    });
}

// Every diagram point has its own contextual reading. The 14 large answers
// remain an optional second layer and are never substituted for another point.
// Every interactive diagram point should lead to the matching energy's approved
// authored reading. The active sphere supplies its precise meaning; otherwise,
// the first relevant sphere is used for points shared between several spheres.
const additionalPointReadings = {
  leftOuter: "impression",
  leftNear: "character",
  rightOuter: "moneyBlock",
  rightCore: "moneyFlow"
};

function authoredPositionForPoint(key) {
  if (!current) return null;
  const matches = current.zones.filter(zone =>
    zone.points.includes(key) && zone.reading?.authored?.[key] && zone.reading?.depth?.[key]
  );
  const zone = matches.find(zone => zone.id === current.activeZone?.id) || matches[0];
  if (!zone) return null;
  const authoredKey = zone.reading.authored[key];
  const related = zone.points.filter(item => zone.reading.authored?.[item] === authoredKey);
  return {
    key: authoredKey,
    title: zone.reading.roles[key]?.title,
    context: {
      ...zone.reading.depth[key],
      title: zone.reading.roles[key]?.title,
      variant: related.indexOf(key),
      relatedFocus: related.map(item => zone.reading.depth[item].focus)
    }
  };
}

function openPointDetail(key) {
  if (!current || !pointDetails) return;
  const point = current.points.find(item => item.key === key);
  if (!point) return;
  const energy = current.knowledge.energies[String(point.value)] || {};
  const position = authoredPositionForPoint(key);
  const authoredKey = position?.key || point.topic || additionalPointReadings[key];
  const hasAuthoredText = Boolean(authoredKey &&
    current.definitions.some(definition => definition.key === authoredKey));
  pointDetails.replaceChildren();

  const head = element("div", null, "pro-point-details-header");
  const heading = element("div");
  heading.append(element("p", "ПОДРОБНЫЙ РАЗБОР ТОЧКИ", "pro-eyebrow"));
  heading.append(element("h3", position?.title || current.previews.titles[key] || point.label));
  const close = element("button", "Закрыть", "pro-point-details-close");
  close.type = "button";
  close.setAttribute("aria-label", "Закрыть подробный разбор точки");
  close.addEventListener("click", () => {
    pointDetails.hidden = true;
    pointDetails.replaceChildren();
  });
  head.append(heading, close);
  pointDetails.append(head);

  const chips = element("div", null, "pro-chips");
  chips.append(element("span", "Энергия " + point.value));
  if (energy.name) chips.append(element("span", energy.name));
  pointDetails.append(chips);

  if (hasAuthoredText) {
    // IMPORTANT: supply point.value, never the same topic's other matrix energy.
    // No generic advice from point-previews.json is substituted for an authored answer.
    const full = element("section", null, "pro-inline-full-reading");
    pointDetails.append(full);
    loadInlineFullReading(full, authoredKey, point.value, false, position?.context || null);
  } else {
    // Defensive fallback only if a new, unconfigured point is added later.
    const detail = current.previews.details?.[key];
    pointDetails.append(paragraph(detail?.meaning || "Расшифровка этой точки пока не подключена.", "pro-muted"));
  }

  pointDetails.hidden = false;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.requestAnimationFrame(() => {
    if (!pointDetails.hidden) {
      pointDetails.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
  });
}

function renderZoneReading(zone, shouldScroll = true) {
  if (!zoneReading || !current) return;
  zoneReading.replaceChildren();
  if (!zone) {
    zoneReading.hidden = true;
    return;
  }
  if (pointDetails) {
    pointDetails.hidden = true;
    pointDetails.replaceChildren();
  }
  // From a compact sphere list, keep the full interpretation beside the row.
  // From the diagram, show it at the original spot directly below the matrix.
  if (selectedZoneFrom === "picker") {
    const selected = zoneButtons.querySelector('button[data-zone="' + zone.id + '"]');
    if (selected) {
      const buttons = [...zoneButtons.querySelectorAll(".pro-zone-button")];
      const index = buttons.indexOf(selected);
      const rowEnd = index >= 0 && index % 2 === 0 ? (buttons[index + 1] || selected) : selected;
      rowEnd.after(zoneReading);
    } else {
      zoneReadingHome.before(zoneReading);
    }
  } else {
    zoneReadingHome.before(zoneReading);
  }
  const {reading} = zone;
  const positions = zone.points.map(key => current.points.find(point => point.key === key)).filter(Boolean);
  const top = element("div", null, "pro-zone-reading-header");
  const heading = element("div");
  heading.append(element("p", "ВАША МАТРИЦА · РАЗБОР СФЕРЫ", "pro-eyebrow"));
  const title = element("h3", zone.title);
  title.id = "pro-zone-reading-title";
  heading.append(title);
  const close = element("button", "Закрыть", "pro-zone-reading-close");
  close.type = "button";
  close.setAttribute("aria-label", "Закрыть разбор выбранной сферы");
  close.addEventListener("click", () => {
    // The same topic can be selected again by its label or the lower picker.
    zoneReading.hidden = true;
    zoneReading.replaceChildren();
    current.activeZone = null;
    hidePointPreview();
    renderZones(current.zones);
    renderDiagram(current.points);
  });
  top.append(heading,close);
  zoneReading.append(top);
  zoneReading.style.setProperty("--reading-color", zone.color);
  zoneReading.append(paragraph(reading.lead,"pro-zone-reading-lead"));
  zoneReading.append(element("h4","Что говорят выделенные энергии"));

  // One compact, accessible list instead of seven large bordered cards.
  // Nothing is cut: every original paragraph is inside its own disclosure.
  const list = element("div", null, "pro-zone-reading-points");
  positions.forEach(point => {
    const role = reading.roles[point.key];
    if (!role) return;
    const energy = current.knowledge.energies[String(point.value)] || {};
    const card = element("details", null, "pro-zone-reading-position");
    const line = element("summary", null, "pro-zone-reading-position-head");
    line.append(element("span", String(point.value), "pro-zone-reading-number"));
    const labels = element("span", null, "pro-zone-reading-position-labels");
    labels.append(element("strong", role.title));
    labels.append(element("small", energy.name ? "Энергия " + point.value + " · " + energy.name : "Энергия " + point.value));
    line.append(labels);
    card.append(line);

    const content = element("div", null, "pro-zone-reading-position-content");
    // Open straight into the authored energy-based reading, not universal hints.
    const authoredKey = reading.authored?.[point.key];
    const lens = reading.depth?.[point.key];
    if (authoredKey && lens && current.definitions.some(definition=>definition.key===authoredKey)) {
      const full = element("section", null, "pro-inline-full-reading");
      content.append(full);
      // Данные подгружаем только по нажатию, чтобы страница была лёгкой.
      card.addEventListener("toggle", () => {
        if (card.open && !card.dataset.loaded) {
          card.dataset.loaded = "true";
          const related = zone.points.filter(key=>reading.authored?.[key]===authoredKey);
          const variant=related.indexOf(point.key);
          const relatedFocus=related.map(key=>reading.depth[key].focus);
          loadInlineFullReading(full, authoredKey, point.value, false, {...lens,title:role.title,variant,relatedFocus});
        }
      });
    } else {
      // При неполном соответствии не подменяем авторскую трактовку случайным текстом.
      content.append(paragraph("Для этой точки подробный авторский текст пока не подключён.", "pro-muted"));
    }
    card.append(content);
    card.addEventListener("toggle", () => {
      if (!card.open) return;
      list.querySelectorAll(".pro-zone-reading-position[open]").forEach(other => {
        if (other !== card) other.open = false;
      });
    });
    list.append(card);
  });
  zoneReading.append(list);

  zoneReading.hidden = false;
  if(shouldScroll){
    const id=current.id;
    window.requestAnimationFrame(() => {
      if(!current || current.id !== id || current.activeZone?.id !== zone.id || zoneReading.hidden)return;
      zoneReading.scrollIntoView({
        behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block:"start"
      });
    });
  }
}

function isSubheading(text) {
  if(text.length>68 || text.includes("\n"))return false;
  return /^(Что это значит|Как проявляется|Где уходит|Что делать|Чего не делать|Стратегия|В плюсе|В минусе|Главный совет|Ваши сильные|Ваши слабые|Как включить|Где легче|Какой уровень жизни вам положен)/i.test(text) && !/[.!?]$/.test(text);
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
  if (scroll) {
    scrollToSelectedQuestion(id, key, button);
  }
  if (alreadyOpen) return;

  answer.setAttribute("aria-busy", "true");
  answer.replaceChildren(paragraph("Загружаю подробную расшифровку…", "pro-muted"));
  try {
    const [bank, practicalGuidance] = await Promise.all([loadFullReportSection(definition.energy), loadPracticalGuidance(definition.energy)]);
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
    source.paragraphs.filter(Boolean).forEach(text => {
      answer.append(isSubheading(text) ? element("h4", text, "pro-paragraph-title") : paragraph(text));
    });
    const practical = practicalGuidance?.sections?.[key];
    if (practical?.action && practical?.result) {
      answer.append(element("h4", "Практика на ближайшие семь дней", "pro-paragraph-title"));
      answer.append(paragraph(practical.action));
      answer.append(element("h4", "Как понять что энергия вышла в плюс", "pro-paragraph-title"));
      answer.append(paragraph(practical.result));
    }
    answer.setAttribute("aria-busy", "false");
  } catch (err) {
    if (!current || current.id !== id || current.selected !== key || answerRequestId !== request) return;
    answer.setAttribute("aria-busy", "false");
    answer.replaceChildren(paragraph("Не удалось загрузить расшифровку. Проверьте соединение и попробуйте выбрать вопрос снова.", "pro-muted"));
  }
}

async function renderPurpose(matrix) {
  if (!purpose) return;
  const id = current?.id;
  purpose.replaceChildren(paragraph("Подбираю персональные трактовки предназначения…", "pro-muted"));
  const readings = await loadPurposeReadings();
  if (!current || current.id !== id) return;
  purpose.replaceChildren();
  const headline = element("h2", "Ваше предназначение");
  purpose.append(headline);
  purpose.append(paragraph("Сначала личные задачи и место среди людей. Затем общий жизненный путь. Каждое число рассчитано по вашей матрице.", "pro-muted"));
  const descriptions = [
    {label: "Личное предназначение", number: matrix.purpose.personal, scope: "personal"},
    {label: "Социальное предназначение", number: matrix.purpose.social, scope: "social"},
    {label: "Общее предназначение", number: matrix.purpose.general, scope: "general"},
    {label: "Планетарное предназначение", number: matrix.purpose.planetary, scope: "planetary"}
  ];
  descriptions.forEach(({label, number, scope}) => {
    const card = element("details", null, "pro-purpose-card");
    card.append(element("summary", label + " - энергия " + number));
    card.append(paragraph(getPurposeReading(readings, scope, number), "pro-purpose-reading"));
    purpose.append(card);
  });
}

function markKarmicNodes(matches) {
  hidePointPreview();
  const keys = new Set((matches || []).flatMap(match => match.nodes || []));
  diagram.querySelectorAll(".pro-node").forEach(node => {
    node.classList.toggle("pro-karmic-highlight", keys.has(node.dataset.nodeKey));
  });
  diagram.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "center"
  });
}


// Count the places where the same three energies appear, regardless of order.
const karmicTripleKey = values => [...values].sort((a, b) => a - b).join("-");
const countLabel = count => count === 1 ? "1 раз" : count >= 2 && count <= 4 ? count + " раза" : count + " раз";

// Three clear lines instead of one overlong karmic-tail heading.
function formatTailSummary(summary, name, code, count) {
  summary.replaceChildren(element("span", "История души · Кармический хвост", "pro-karma-tail-label"));
  if (name) summary.append(element("span", name, "pro-karma-tail-name"));
  summary.append(element("span", code + " · " + countLabel(count), "pro-karma-tail-meta"));
}

// One compact index keeps the complete readings and soul narration.
function compactKarmicList(tailCount = 1) {
  const original = Array.from(karmic.children);
  const codeText = karmic.querySelector(".pro-karmic-current-code");
  const tailCode = codeText?.textContent.replace(/^Кармический хвост\s*/, "").trim() || "";
  const tailInfo = codeText?.nextElementSibling;
  const tailCard = original.find(node =>
    node.matches?.("details.pro-karma-card") &&
    node.querySelector(":scope > summary > .pro-karma-tail-label")
  );
  if (tailCard) {
    const summary = tailCard.querySelector(":scope > summary");
    if (tailInfo?.matches("p.pro-muted")) summary.after(tailInfo);
    codeText?.remove();
  } else if (codeText) {
    // Unrecognised tails also get a single collapsed row.
    const missing = element("details", null, "pro-karma-card");
    const missingSummary = element("summary");
    formatTailSummary(missingSummary, "", tailCode, tailCount);
    missing.append(missingSummary);
    if (tailInfo?.matches("p.pro-muted")) missing.append(tailInfo);
    const noDescription = Array.from(karmic.children).find(node => node.matches?.("p.pro-muted") && node.textContent.includes("Для этого хвоста подробный текст"));
    if (noDescription) missing.append(noDescription);
    codeText.replaceWith(missing);
  }
  const separator = Array.from(karmic.children).find(node =>
    node.tagName === "H3" && node.textContent === "Другие программы по сферам жизни"
  );
  if (separator) {
    const explanation = separator.nextElementSibling;
    const firstProgram = explanation?.nextElementSibling;
    if (explanation?.matches("p.pro-muted") && firstProgram?.matches("details.pro-karma-card")) {
      firstProgram.querySelector(":scope > summary")?.after(explanation);
    }
    separator.remove();
  }
  const list = element("div", null, "pro-karma-list");
  list.setAttribute("role", "group");
  list.setAttribute("aria-label", "Кармический хвост и программы");
  list.append(...Array.from(karmic.children));
  // Only one full text is open at a time; all data remains available.
  list.addEventListener("toggle", event => {
    if (!event.target.open || event.target.parentElement !== list) return;
    Array.from(list.children).forEach(item => {
      if (item !== event.target && item.tagName === "DETAILS" && item.open) item.open = false;
    });
  }, true);
  list.querySelectorAll(":scope > details > summary").forEach(summary => {
    summary.title = summary.querySelector(".pro-karma-tail-label")
      ? Array.from(summary.children).map(node => node.textContent).join(" · ")
      : summary.textContent;
  });
  karmic.append(list);
}

function renderKarmic(matrix, programsBank, tailsBank, deepening) {
  const tail = findKarmicTail(matrix, tailsBank);
  const programs = findKarmicPrograms(matrix, programsBank);
  karmic.replaceChildren();
  const tailValues = [matrix.tail.first, matrix.tail.second, matrix.bottom];
  const code = tailValues.join("-");
  const tailKey = karmicTripleKey(tailValues);
  const tailPlaces = getMatrixTriples(matrix).filter(item => karmicTripleKey(item.values) === tailKey);
  karmic.append(paragraph("Кармический хвост " + code, "pro-karmic-current-code"));
  karmic.append(paragraph("Первая энергия показывает вход в сценарий. Вторая показывает его развитие. Третья связана с главным уроком. Порядок чисел сохраняется.", "pro-muted"));

  function card(title, source, guidance, locations = [], isTail = false) {
    const details = element("details", null, "pro-karma-card");
    const summary = element("summary", title);
    details.append(summary);
    if (locations.length) {
      details.append(paragraph("Где обнаружена программа. " + locations.map(item => item.label).join(". ") + ".", "pro-karmic-locations"));
      const jump = element("button", "Показать точки на матрице", "pro-karmic-jump");
      jump.type = "button";
      jump.addEventListener("click", () => markKarmicNodes(locations));
      details.append(jump);
    }
    // Approved five-section readings replace old overlapping text for this entry.
    if (Array.isArray(guidance?.approvedReading) && guidance.approvedReading.length === 5) {
      guidance.approvedReading.forEach(part => {
        details.append(element("h4", part.title));
        String(part.text || "").split(/\n\s*\n/).filter(Boolean).forEach(text => {
          details.append(paragraph(text.trim()));
        });
      });
      return details;
    }
    (source.parts || []).forEach(part => {
      details.append(element("h4", part.title));
      details.append(paragraph(part.text));
    });
    const sections = [
      ["origins", "Другие возможные истории происхождения"],
      ["minus", "Как программа уводит жизнь в минус"],
      ["plus", "Как выглядит программа в плюсе"],
      ["practice", "Какие действия принимать, чтобы правильно проживать эту программу"]
    ];
    if (guidance) sections.forEach(([key, title]) => {
      if (!guidance[key]) return;
      details.append(element("h4", title));
      details.append(paragraph(guidance[key]));
    });
    // Leave the long karmic text folded until explicitly selected.
    return details;
  }

  if (tail) {
    const tailMatches = [{
      label: "Нижний луч матрицы",
      nodes: ["tailFirst", "tailSecond", "bottom"]
    }, ...tailPlaces.filter(item => item.id !== "tail")];
    // Prefer the new complete five-part reading for this code, if one exists.
    // Otherwise retain the existing tail-specific supplement.
    const approvedProgramReading = deepening?.program?.[code]?.approvedReading?.length === 5
      ? deepening.program[code] : null;
    const tailCard = card("", tail,
      approvedProgramReading || deepening?.tail?.[code] || deepening?.tail?.[tail.code],
      tailMatches, true);
    formatTailSummary(tailCard.querySelector(":scope > summary"), tail.title, code, tailPlaces.length);
    karmic.append(tailCard);
  } else {
    karmic.append(paragraph("Для этого хвоста подробный текст пока не найден.", "pro-muted"));
  }

  const unique = programs.filter(program => program.key !== tail?.key);
  if (unique.length) {
    karmic.append(element("h3", "Другие программы по сферам жизни"));
    karmic.append(paragraph("Название программы не определяет её тяжесть. Смотрите где именно в матрице встретились три энергии.", "pro-muted"));
    unique.forEach(program => {
      const title = program.title + " · " + program.code + " · " + countLabel(program.repeats);
      const guidance = deepening?.program?.[program.code] || deepening?.tail?.[program.code];
      karmic.append(card(title, program, guidance, program.matches));
    });
  } else {
    karmic.append(paragraph("Другие именованные программы в выбранном каталоге не совпали. Это не означает отсутствие жизненных задач.", "pro-muted"));
  }


  compactKarmicList(tailPlaces.length);
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
  closeKarmicInline();
  invalidateFullPdf();
  pdfControls.hidden = true;
  pdfButtons.replaceChildren();
  const formattedDate = input.value;
  const id=++requestId;
  hidePointPreview();
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
    pointDetails.hidden = true;
    pointDetails.replaceChildren();
    zoneReadingHome.before(zoneReading);
    zoneReading.hidden = true;
    zoneReading.replaceChildren();
    renderDiagram(points);
    renderZones(zones);
    renderQuestions(definitions);
    renderPurpose(matrix).catch(err => {
      console.error("Не удалось загрузить предназначение:", err);
      if (current?.id === id) {
        purpose.replaceChildren(paragraph("Не удалось загрузить предназначение. Обновите страницу и попробуйте ещё раз.", "pro-muted"));
      }
    });
    diagram.querySelectorAll(".pro-node").forEach(node => node.classList.remove("pro-karmic-highlight"));
    results.hidden=false;
    results.scrollIntoView({behavior:"smooth",block:"start"});
    karmic.replaceChildren(paragraph("Подбираю кармические программы…","pro-muted"));
    Promise.all([
      loadKarmicPrograms(),
      loadKarmicTails(),
      loadKarmicDeepening().catch(() => ({tail: {}, program: {}}))
    ]).then(([programs,tails,deepening])=>{
      if(current?.id!==id)return;
      renderKarmic(matrix,programs,tails,deepening);
      current.pdfReport = {
        formattedDate, matrixData: matrix, karmicPrograms: programs, karmicTails: tails,
        points, zones, previews, knowledge, deepening
      };
      pdfButtons.replaceChildren(createFullReportPdfButton("top"));
      pdfControls.hidden = false;
    })
      .catch(()=>{if(current?.id===id)karmic.replaceChildren(paragraph("Не получилось загрузить кармические программы. Попробуйте обновить страницу.","pro-muted"));});
  }catch(err){
    error.textContent="Не удалось загрузить расчёт. Обновите страницу и попробуйте снова.";
    error.hidden=false;
  }finally{
    submit.disabled=false;
    submit.innerHTML=defaultSubmitHtml;
  }
});
