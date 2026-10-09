import { calculateMatrix, parseBirthDate, reduce22 } from "../numerology-core.js?v=4";
import { buildFullReportSections, loadFullReportKnowledge, loadFullReportSection } from "../full-report-library.js?v=4";
import { findKarmicPrograms, findKarmicTail, getMatrixTriples, loadKarmicPrograms, loadKarmicTails } from "../karmic-programs.js?v=5";
import { nodesFor } from "./pro-points.js?v=2";
import { createProDiagram } from "./pro-diagram.js?v=9";
import { stopSoulSpeech } from "./pro-voice.js?v=2";
import { createSoulStory } from "./pro-story.js?v=2";

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
    const paths = [
      "pro/karmic-tail-deepening-a.json",
      "pro/karmic-tail-deepening-b.json",
      "pro/karmic-program-deepening-a.json",
      "pro/karmic-program-deepening-b.json",
      "pro/karmic-program-deepening-c.json"
    ];
    karmicDeepeningRequest = Promise.all(paths.map(path =>
      fetch(path + "?v=2").then(response => {
        if (!response.ok) throw new Error("Не удалось загрузить дополнения кармических программ");
        return response.json();
      })
    )).then(banks => {
      if (banks.some(bank => !bank.entries || !bank.schema)) throw new Error("Неполная база программ");
      return {
        tail: Object.assign({}, ...banks.filter(bank => bank.role === "tail").map(bank => bank.entries)),
        program: Object.assign({}, ...banks.filter(bank => bank.role === "program").map(bank => bank.entries))
      };
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

const {hidePointPreview, renderZones, renderDiagram} = createProDiagram({
  getCurrent: () => current,
  diagram, zoneButtons, questionButtons,
  element, svgElement,
  onSelectQuestion: (key, scroll) => selectQuestion(key, scroll),
  onOpenPoint: (key) => openPointDetail(key),
  onSelectZone: (zone, scroll) => renderZoneReading(zone, scroll)
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

  const list = element("div",null,"pro-zone-reading-points");
  positions.forEach(point => {
    const role=reading.roles[point.key];
    if(!role)return;
    const energy=current.knowledge.energies[String(point.value)] || {};
    const card=element("article",null,"pro-zone-reading-position");
    const line=element("div",null,"pro-zone-reading-position-head");
    line.append(element("span",String(point.value),"pro-zone-reading-number"));
    const labels=element("div");
    labels.append(element("strong",role.title));
    labels.append(element("small",energy.name ? "Энергия " + point.value + " · " + energy.name : "Энергия " + point.value));
    line.append(labels);
    card.append(line);
    card.append(paragraph(role.meaning));
    const energyText=energy[reading.energyField] || energy.shortEssence || energy.mainStrength;
    if(energyText)card.append(paragraph(energyText,"pro-zone-reading-energy"));
    const deeper=element("button","Разобрать эту точку подробнее →","pro-zone-reading-detail");
    deeper.type="button";
    deeper.addEventListener("click", () => openPointDetail(point.key));
    card.append(deeper);
    list.append(card);
  });
  zoneReading.append(list);

  zoneReading.append(element("h4","Как читать сочетание"));
  zoneReading.append(paragraph(reading.bridge));
  const counts = new Map();
  positions.forEach(point => counts.set(point.value,(counts.get(point.value)||0)+1));
  const repeats = [...counts.entries()].filter(([,count]) => count>1).map(([n])=>String(n));
  if(repeats.length) {
    zoneReading.append(paragraph("В этой сфере повторяется энергия " + repeats.join(" и ") + ". Обратите внимание на её разные роли в каждой позиции, не смешивая значения.", "pro-zone-reading-repeat"));
  }
  zoneReading.append(element("h4","Что можно сделать в жизни"));
  zoneReading.append(paragraph(reading.practice,"pro-zone-reading-practice"));
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

function renderPurpose(matrix, knowledge) {
  if (!purpose) return;
  purpose.replaceChildren();
  const headline = element("h2", "Ваше предназначение");
  purpose.append(headline);
  purpose.append(paragraph("Сначала личные задачи и место среди людей. Затем общий жизненный путь. Каждое число рассчитано по вашей матрице.", "pro-muted"));
  const descriptions = [
    {
      label: "Личное предназначение",
      number: matrix.purpose.personal,
      detail: "Что важно развивать в себе и как соединить внутренние потребности с реальными делами."
    },
    {
      label: "Социальное предназначение",
      number: matrix.purpose.social,
      detail: "Как вы можете приносить пользу другим людям через собственные способности и опыт."
    },
    {
      label: "Общее предназначение",
      number: matrix.purpose.general,
      detail: "Направление в котором ваши личные качества и участие в жизни людей соединяются."
    },
    {
      label: "Планетарное предназначение",
      number: matrix.purpose.planetary,
      detail: "Как объединить свои знания и жизненный опыт в дело которое полезно не только ближайшему окружению."
    }
  ];
  descriptions.forEach(({label, number, detail}) => {
    const card = element("details", null, "pro-purpose-card");
    card.append(element("summary", label + " - энергия " + number));
    card.append(paragraph(detail));
    const energy = knowledge.energies[String(number)];
    if (energy?.shortEssence) card.append(paragraph(energy.shortEssence));
    if (energy?.mainStrength) card.append(paragraph(energy.mainStrength));
    if (energy?.mainBlock) card.append(paragraph(energy.mainBlock));
    if (energy?.advice) card.append(paragraph(energy.advice));
    purpose.append(card);
  });
  const skyAndEarth = element("p", null, "pro-muted");
  skyAndEarth.textContent = "Личное предназначение складывается из неба " + matrix.purpose.sky
    + " и земли " + matrix.purpose.earth + ". Социальное связано с мужской и женской линиями рода.";
  purpose.append(skyAndEarth);
  const centers = element("details", null, "pro-purpose-card");
  centers.append(element("summary", "Три центра силы матрицы"));
  centers.append(paragraph("Личный центр - энергия " + matrix.center + ". Показывает внутреннюю опору и привычные реакции."));
  centers.append(paragraph("Родовой центр - энергия " + matrix.lineage.ancestralCenter + ". Складывается из четырёх углов родового квадрата."));
  centers.append(paragraph("Общий центр силы - энергия " + matrix.lineage.overallCenter + ". Складывается из личного и родового центров."));
  purpose.append(centers);
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

function renderKarmic(matrix, programsBank, tailsBank, deepening) {
  const tail = findKarmicTail(matrix, tailsBank);
  const programs = findKarmicPrograms(matrix, programsBank);
  karmic.replaceChildren();
  const code = [matrix.tail.first, matrix.tail.second, matrix.bottom].join("-");
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
    if (isTail) details.open = true;
    return details;
  }

  if (tail) {
    const tailMatches = [{
      label: "Нижний луч матрицы",
      nodes: ["tailFirst", "tailSecond", "bottom"]
    }];
    karmic.append(card("Кармический хвост. " + tail.title, tail,
      deepening?.tail?.[code] || deepening?.tail?.[tail.code],
      tailMatches, true));
    appendSoulStoryCard(tail, code);
  } else {
    karmic.append(paragraph("Для этого хвоста подробный текст пока не найден.", "pro-muted"));
  }

  const unique = programs.filter(program => program.key !== tail?.key);
  if (unique.length) {
    karmic.append(element("h3", "Другие программы по сферам жизни"));
    karmic.append(paragraph("Название программы не определяет её тяжесть. Смотрите где именно в матрице встретились три энергии.", "pro-muted"));
    unique.forEach(program => {
      const level = program.karmicPlacement ? "Кармическая программа" : "Программа";
      const title = level + ". " + program.title + ". " + program.code;
      const guidance = deepening?.program?.[program.code] || deepening?.tail?.[program.code];
      karmic.append(card(title, program, guidance, program.matches));
    });
  } else {
    karmic.append(paragraph("Другие именованные программы в выбранном каталоге не совпали. Это не означает отсутствие жизненных задач.", "pro-muted"));
  }

  const combinations = getMatrixTriples(matrix);
  const recognized = new Set([tail?.key, ...programs.map(program => program.key)]);
  const overview = element("details", null, "pro-karma-card");
  overview.append(element("summary", "Все 10 сочетаний чисел матрицы"));
  overview.append(paragraph("Здесь показаны все рассчитанные тройки независимо от наличия отдельного названия. Не каждую тройку нужно считать тяжёлой кармической задачей.", "pro-muted"));
  combinations.forEach(item => {
    const code = item.values.join("-");
    const sortedCode = [...item.values].sort((a,b) => a - b).join("-");
    const present = recognized.has(sortedCode);
    const inner = element("div", null, "pro-karmic-combination");
    inner.append(element("strong", item.label + " - " + code));
    inner.append(paragraph(present ? "Эта комбинация есть в подробном разборе выше." : "Это расчётная тройка без отдельного имени в выбранном каталоге."));
    if (!present && current?.knowledge?.energies) {
      const labels = item.values.map(number => current.knowledge.energies[String(number)]?.name).filter(Boolean);
      if (labels.length) inner.append(paragraph("Энергии сочетания. " + labels.join(". ") + "."));
      inner.append(paragraph("Читайте эти энергии вместе с темой линии. Одна и та же тройка в деньгах и в семье раскрывается через разные решения."));
    }
    const show = element("button", "Выделить числа на матрице", "pro-karmic-jump");
    show.type = "button";
    show.addEventListener("click", () => markKarmicNodes([item]));
    inner.append(show);
    overview.append(inner);
  });
  karmic.append(overview);

  const repeats = programs.filter(program => program.key === tail?.key);
  if (repeats.length) {
    const otherPlaces = repeats.flatMap(program => program.matches.filter(match => match.id !== "tail"));
    if (otherPlaces.length) {
      const repeatCard = element("details", null, "pro-karma-card");
      repeatCard.append(element("summary", "Повторение темы кармического хвоста в других сферах"));
      repeatCard.append(paragraph("Та же тройка встретилась ещё здесь. " + otherPlaces.map(match => match.label).join(". ") + "."));
      const jump = element("button", "Показать точки на матрице", "pro-karmic-jump");
      jump.type = "button";
      jump.addEventListener("click", () => markKarmicNodes(otherPlaces));
      repeatCard.append(jump);
      karmic.append(repeatCard);
    }
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
    pointDetails.hidden = true;
    pointDetails.replaceChildren();
    zoneReading.hidden = true;
    zoneReading.replaceChildren();
    renderDiagram(points);
    renderZones(zones);
    renderQuestions(definitions);
    renderPurpose(matrix, knowledge);
    diagram.querySelectorAll(".pro-node").forEach(node => node.classList.remove("pro-karmic-highlight"));
    results.hidden=false;
    results.scrollIntoView({behavior:"smooth",block:"start"});
    karmic.replaceChildren(paragraph("Подбираю кармические программы…","pro-muted"));
    Promise.all([
      loadKarmicPrograms(),
      loadKarmicTails(),
      loadKarmicDeepening().catch(() => ({tail: {}, program: {}}))
    ]).then(([programs,tails,deepening])=>{
      if(current?.id===id)renderKarmic(matrix,programs,tails,deepening);
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
