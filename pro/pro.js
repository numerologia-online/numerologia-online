import { calculateMatrix, parseBirthDate, reduce22 } from "../numerology-core.js?v=4";
import { buildFullReportSections, loadFullReportKnowledge, loadFullReportSection } from "../full-report-library.js?v=4";
import { findKarmicPrograms, findKarmicTail, getMatrixTriples, loadKarmicPrograms, loadKarmicProgramGuidance, loadKarmicTails } from "../karmic-programs.js?v=8";
import { nodesFor } from "./pro-points.js?v=2";
import { createProDiagram } from "./pro-diagram.js?v=11";
import { createFullReportPdfController } from "../full-report-pdf.js?v=3";
import { buildProPdfChapters } from "./pro-pdf-content.js?v=7";
import { loadPurposeReadings, getPurposeReading } from "./purpose-readings.js?v=1";

const form = document.querySelector("#pro-form");
const input = document.querySelector("#pro-birth-date");
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
      ...paths.map(path => fetch(path + "?v=5").then(response => {
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
    zoneLibraryRequest = fetch("pro/zones.json?v=4")
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

const {invalidateFullPdf, createFullReportPdfButton} = createFullReportPdfController({
  getReport: () => current?.pdfReport || null,
  reading: pdfButtons,
  extendContent: buildProPdfChapters,
  buttonClass: "pro-pdf-button"
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

// Every diagram point has its own contextual reading. The 14 large answers
// remain an optional second layer and are never substituted for another point.
function openPointDetail(key) {
  if (!current || !pointDetails) return;
  const point = current.points.find(item => item.key === key);
  const detail = current.previews.details?.[key];
  if (!point || !detail) return;
  const energy = current.knowledge.energies[String(point.value)] || {};
  const previews = current.previews;
  const context = previews.groups.money.includes(key) ? "money"
    : previews.groups.love.includes(key) ? "love" : "self";
  const shortMessage = previews.energies[String(point.value)]?.[context];
  pointDetails.replaceChildren();

  const head = element("div", null, "pro-point-details-header");
  const heading = element("div");
  heading.append(element("p", "ПОДРОБНЫЙ РАЗБОР ТОЧКИ", "pro-eyebrow"));
  heading.append(element("h3", previews.titles[key] || point.label));
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
  pointDetails.append(element("h4", "Что показывает эта точка"));
  pointDetails.append(paragraph(detail.meaning));
  if (shortMessage) {
    pointDetails.append(element("h4", "Как эта энергия проявляется у вас"));
    pointDetails.append(paragraph(shortMessage));
  }
  if (energy.plus || energy.mainStrength) {
    pointDetails.append(element("h4", "В плюсе"));
    pointDetails.append(paragraph(energy.plus || energy.mainStrength));
  }
  if (energy.minus || energy.mainBlock) {
    pointDetails.append(element("h4", "В минусе"));
    pointDetails.append(paragraph(energy.minus || energy.mainBlock));
  }
  pointDetails.append(element("h4", "Что сделать на практике"));
  pointDetails.append(paragraph(detail.action));

  if (point.topic && current.definitions.some(definition => definition.key === point.topic)) {
    const deeper = element("button", "Читать полный разбор по этой теме ↓", "pro-point-details-read");
    deeper.type = "button";
    deeper.addEventListener("click", () => selectQuestion(point.topic, true));
    pointDetails.append(deeper);
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
    content.append(paragraph(role.meaning));
    const energyText = energy[reading.energyField] || energy.shortEssence || energy.mainStrength;
    if (energyText) content.append(paragraph(energyText, "pro-zone-reading-energy"));
    const deeper = element("button", "Разобрать эту точку подробнее →", "pro-zone-reading-detail");
    deeper.type = "button";
    deeper.addEventListener("click", () => openPointDetail(point.key));
    content.append(deeper);
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

  const counts = new Map();
  positions.forEach(point => counts.set(point.value, (counts.get(point.value) || 0) + 1));
  const repeats = [...counts.entries()].filter(([, count]) => count > 1).map(([n]) => String(n));

  const combine = element("details", null, "pro-zone-reading-extra");
  combine.append(element("summary", "Как читать сочетание"));
  const combineContent = element("div", null, "pro-zone-reading-extra-content");
  combineContent.append(paragraph(reading.bridge));
  if (repeats.length) {
    combineContent.append(paragraph("В этой сфере повторяется энергия " + repeats.join(" и ") + ". Обратите внимание на её разные роли в каждой позиции, не смешивая значения.", "pro-zone-reading-repeat"));
  }
  combine.append(combineContent);
  zoneReading.append(combine);

  const practice = element("details", null, "pro-zone-reading-extra");
  practice.append(element("summary", "Что можно сделать в жизни"));
  const practiceContent = element("div", null, "pro-zone-reading-extra-content");
  practiceContent.append(paragraph(reading.practice, "pro-zone-reading-practice"));
  practice.append(practiceContent);
  zoneReading.append(practice);
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
      ["practice", "Что конкретно делать"]
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
    const tailCard = card("", tail,
      deepening?.tail?.[code] || deepening?.tail?.[tail.code],
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
    submit.textContent="Рассчитать →";
  }
});
