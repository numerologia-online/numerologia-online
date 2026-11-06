import { calculateMatrix, parseBirthDate } from "../numerology-core.js?v=5";
import { loadChildDayReading } from "./child-day-engine.js?v=13";

const byId = (id) => document.getElementById(id);
const form = byId("child-form");
const input = byId("child-date");
const error = byId("child-error");
const result = byId("child-result");
const matrixPanel = byId("child-matrix-panel");
const dayPanel = byId("child-day-panel");
const matrixTab = byId("child-tab-matrix");
const dayTab = byId("child-tab-day");
const matrixVisual = byId("child-matrix-visual");
const matrixSections = byId("child-matrix-sections");
/* Fail closed until a server-verified, per-child purchase entitlement exists.
 * A flag, query string, or localStorage value must NEVER unlock paid readings.
 * This static frontend is not DRM: private JSON must be migrated off GitHub Pages. */
const FREE_CHILD_POINT = "character";
const childEntitlement = { status: "preview", childId: null, birthDate: null };
const hasChildPaidAccess = () => childEntitlement.status === "active" &&
  !!childEntitlement.childId && !!birth &&
  childEntitlement.birthDate === [birth.year, String(birth.month).padStart(2,"0"), String(birth.day).padStart(2,"0")].join("-");
const childPointIsLocked = point => point.id !== FREE_CHILD_POINT && !hasChildPaidAccess();

const preview = byId("child-preview");
let startingTab = "matrix";
preview.querySelectorAll("[data-child-start]").forEach((button) => {
  button.addEventListener("click", () => {
    startingTab = button.dataset.childStart === "day" ? "day" : "matrix";
    preview.querySelectorAll("[data-child-start]").forEach((item) => {
      const active = item.dataset.childStart === startingTab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    input.focus({preventScroll: true});
    form.scrollIntoView({behavior: "smooth", block: "center"});
  });
});

// A small non-modal reading card replaces the full-screen dialog.
// The matrix stays visible and usable while a reading is open.
const insight = document.createElement("aside");
insight.className = "child-insight";
insight.hidden = true;
insight.setAttribute("aria-labelledby", "child-insight-title");
insight.innerHTML = [
  '<div class="child-insight-top">',
  '<span class="child-insight-badge" id="child-insight-number"></span>',
  '<span class="child-insight-kicker">Ваш маленький большой мир</span>',
  '<button class="child-insight-close" type="button" aria-label="Закрыть подсказку">×</button>',
  '</div>',
  '<h3 id="child-insight-title"></h3>',
  '<div id="child-insight-text" class="child-insight-body"></div>'
].join("");
byId("child-insight-place").append(insight);
let selectedPoint = null;
let selectedElements = [];
let insightRequestId = 0;
// Load every approved child energy, not just energy 1. Cache by energy number.
// Static preview loads CHARACTER ONLY. Full paid banks must live on REG.RU server after deployment.
const energyBankRequests = new Map();
const getEnergyBank = (energy) => {
  const number = Number(energy);
  if (!Number.isInteger(number) || number < 1 || number > 22) return Promise.resolve(null);
  if (!energyBankRequests.has(number)) {
    energyBankRequests.set(number,
      fetch(`./data/matrix/free/character-${number}.json?v=1`)
        .then((response) => {
          if (!response.ok) throw new Error("Детская энергия не загрузилась");
          return response.json();
        })
        .catch(() => {
          energyBankRequests.delete(number);
          return null;
        })
    );
  }
  return energyBankRequests.get(number);
};
// Child karmic programs live in their own catalog, separate from single-energy readings.
// Index prevents requests for unwritten combinations; finished JSON is lazy-loaded on tap.
let karmicTailCatalogPromise = null;
const karmicTailRequests = new Map();
const getChildKarmicTail = async (code) => {
  if (!/^[0-9]{1,2}-[0-9]{1,2}-[0-9]{1,2}$/.test(code)) return {state:"missing"};
  if (!karmicTailCatalogPromise) {
    karmicTailCatalogPromise = fetch("./data/matrix/karmic-tail/index.json?v=26")
      .then((response) => {
        if (!response.ok) throw new Error("Каталог кармических программ недоступен");
        return response.json();
      }).catch(() => {
        karmicTailCatalogPromise = null;
        return null;
      });
  }
  const catalog = await karmicTailCatalogPromise;
  if (!catalog || catalog.schema !== "child-karmic-tail-index-v1") return {state:"error"};
  const filename = Object.hasOwn(catalog.available || {}, code) ? catalog.available[code] : null;
  if (filename !== code + ".json") return {state:"missing"};
  if (!karmicTailRequests.has(code)) {
    karmicTailRequests.set(code,
      fetch("./data/matrix/karmic-tail/" + filename + "?v=2")
        .then((response) => {
          if (!response.ok) throw new Error("Кармический разбор недоступен");
          return response.json();
        })
        .then((bank) => {
          if (bank.schema !== "child-karmic-tail-v1" || bank.code !== code ||
              bank.status !== "ready" || !Array.isArray(bank.sections)) {
            throw new Error("Неверный формат кармической программы");
          }
          return bank;
        })
        .catch(() => {
          karmicTailRequests.delete(code);
          return null;
        })
    );
  }
  const bank = await karmicTailRequests.get(code);
  return bank ? {state:"ready",bank} : {state:"error"};
};
const showChildKarmicTail = (container, bank) => {
  const fragment = document.createDocumentFragment();
  if (typeof bank.lead === "string" && bank.lead.trim()) {
    const intro = document.createElement("p");
    intro.textContent = bank.lead;
    fragment.append(intro);
  }
  for (const section of bank.sections) {
    if (!section || !Array.isArray(section.paragraphs)) continue;
    const heading = document.createElement("h4");
    heading.textContent = section.title || "";
    fragment.append(heading);
    for (const line of section.paragraphs) {
      if (typeof line !== "string" || !line.trim()) continue;
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      fragment.append(paragraph);
    }
  }
  container.replaceChildren(fragment);
};

const showChildParagraphs = (container, paragraphs) => {
  container.replaceChildren();
  for (const line of paragraphs) {
    if (typeof line !== "string" || !line.trim()) continue;
    const p = document.createElement("p");
    p.textContent = line;
    container.append(p);
  }
};

const closeInsight = () => {
  ++insightRequestId;
  insight.hidden = true;
  selectedElements.forEach((node) => node.classList.remove("is-selected"));
  selectedElements = [];
  selectedPoint = null;
};
insight.querySelector(".child-insight-close").addEventListener("click", closeInsight);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !insight.hidden) closeInsight();
});
// Adult-style routing: point.number -> energy-N.json -> sections[point.id].
const openPointReading = async (point, source = null) => {
  const requestId = ++insightRequestId;
  const energy = Number(point.number);
  const body = byId("child-insight-text");
  byId("child-insight-number").textContent = point.code || String(energy);
  byId("child-insight-title").textContent = point.title;
  selectedElements.forEach((node) => node.classList.remove("is-selected"));
  selectedPoint = source;
  selectedElements = [...new Set([
    source,
    ...matrixVisual.querySelectorAll('[data-child-point="' + point.id + '"]'),
    ...matrixSections.querySelectorAll('[data-child-topic="' + point.id + '"]')
  ].filter(Boolean))];
  selectedElements.forEach((node) => node.classList.add("is-selected"));
  // Keep the selected number and matrix on screen. The reading opens
  // directly beneath the diagram, without jumping past the chosen point.
  matrixVisual.classList.add("has-started");
  childGuide.hidden = true;
  insight.hidden = false;

  // Free preview is restricted to Character; no paid bank fetch happens here.
  if (childPointIsLocked(point)) {
    body.replaceChildren();
    const note = document.createElement("p");
    note.className = "child-locked-note";
    note.textContent = "🔒 Эта глава входит в полный разбор ребёнка. Бесплатно доступна первая глава «Характер и темперамент».";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "child-lock-buy";
    button.textContent = "Открыть весь разбор и PDF · 490 ₽";
    button.addEventListener("click", showChildPdfOffer);
    body.append(note, button);
    return;
  }
  // A karmic tail is a three-energy combination, never a generic energy text.
  if (point.id === "tail" || point.id === "tail-detail") {
    body.textContent = "Открываю кармический разбор…";
    const code = String(point.code || "").replace(/\s*-\s*/g, "-").trim();
    const reading = await getChildKarmicTail(code);
    if (requestId !== insightRequestId || insight.hidden) return;
    if (reading.state === "ready") {
      byId("child-insight-title").textContent = reading.bank.title;
      showChildKarmicTail(body, reading.bank);
    } else if (reading.state === "missing") {
      body.textContent = "Трактовка сочетания " + (point.code || code) + " ещё готовится.";
    } else {
      body.textContent = "Не удалось загрузить кармический разбор. Проверьте подключение и нажмите ещё раз.";
    }
    return;
  }

  body.textContent = "Открываю подробный разбор…";
  const bank = await getEnergyBank(energy);
  if (requestId !== insightRequestId || insight.hidden) return;
  if (!bank) {
    body.textContent = "Не удалось загрузить текст. Проверьте подключение и нажмите на число ещё раз.";
    return;
  }
  const paragraphs = bank.sections?.[point.section || point.id]?.paragraphs;
  if (!Array.isArray(paragraphs) || !paragraphs.length) {
    body.textContent = "Полная трактовка этого раздела пока не написана.";
    return;
  }
  showChildParagraphs(body, paragraphs);
};

const currentDate = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
const dateLabel = (date) => new Intl.DateTimeFormat("ru-RU", {day: "numeric", month: "long", year: "numeric"}).format(date);
const pad = (value) => String(value).padStart(2, "0");

let birth = null;
let chosenDate = currentDate();
// Day readings are independent; no legacy matrix short-text bank.
let dayBankPromise = null;
const getDayBank = () => {
  if (!dayBankPromise) {
    dayBankPromise = fetch("./data/day.json?v=1")
      .then((response) => {
        if (!response.ok) throw new Error("Не удалось получить тексты детского дня");
        return response.json();
      })
      .then((day) => {
        if (!day.fallback) throw new Error("Неверный формат детского дня");
        return day;
      })
      .catch((reason) => {
        dayBankPromise = null;
        throw reason;
      });
  }
  return dayBankPromise;
};

// 19 topics read from their own matrix position; money is in the same JSON energy file.
const matrixDefinitions = (matrix) => [
  {id: "character", title: "Характер и темперамент", number: matrix.left, x: 41, y: 260, color: "violet"},
  {id: "innerNature", section: "comfort", title: "Внутренний мир и душевный комфорт", number: matrix.center, x: 260, y: 260, color: "center"},
  {id: "talents", title: "Таланты и сильные стороны", number: matrix.top, x: 260, y: 41, color: "violet"},
  {id: "learning", title: "Как ребёнку легче учиться", number: matrix.left},
  {id: "parenting", title: "Как воспитывать и поддерживать", number: matrix.corners.topLeft, x: 104, y: 104, color: "blue"},
  {id: "activities", title: "Спорт, кружки и увлечения", number: matrix.right, x: 479, y: 260, color: "pink"},
  {id: "recovery", title: "Отдых и восстановление", number: matrix.bottom, x: 260, y: 479, color: "pink"},
  {id: "emotions", title: "Эмоции, дружба и общение", number: matrix.corners.topRight, x: 416, y: 104, color: "blue"},
  {id: "purpose", title: "Личное предназначение и потенциал", number: matrix.purpose.personal},
  {id: "mistakes", title: "Главные ошибки ребёнка", number: matrix.leftSpoke.outer},
  {id: "lifeLessons", title: "Главные жизненные уроки (общее предназначение)", number: matrix.purpose.general},
  {id: "parentMistakes", title: "Главные ошибки родителей", number: matrix.corners.topLeft},
  {id: "gifts", title: "Идеальный подарок", number: matrix.left},
  {id: "games", title: "Как играть и увлекать ребёнка", number: matrix.topSpoke.near, x: 260, y: 157, color: "gold"},
  {id: "parentChildLessons", title: "Детско-родительские уроки", number: matrix.corners.bottomLeft},
  {id: "familyFeelings", title: "Как чувствует близких", number: matrix.corners.bottomLeft, x: 104, y: 416, small: true},
  {id: "independence", title: "Как раскрывает самостоятельность", number: matrix.corners.bottomRight, x: 416, y: 416, small: true},
  {id: "learningHelp", title: "Как помочь освоить новое", number: matrix.leftSpoke.near, x: 157, y: 260, small: true},
  {id: "interests", title: "Что может увлечь ребёнка", number: matrix.rightSpoke.near, x: 363, y: 260, small: true},
  {id: "money", title: "Отношения с деньгами", number: matrix.channels.moneyPoint, color: "gold"},
  {id: "tail", title: "Кармический хвост", number: matrix.tail.first, x: 260, y: 385, color: "gold",
    code: [matrix.tail.first, matrix.tail.second, matrix.bottom].join(" - ")}
];


/* Draw the onboarding arrow from the heading down to the actual character
   circle, respecting mobile widths and font wrapping. Decorative only. */
const childGuide = byId("child-matrix-guide");
const updateChildGuide = () => {
  if (childGuide.hidden || matrixVisual.classList.contains("has-started")) return;
  const panel = byId("child-matrix-panel");
  const callout = panel.querySelector(".child-matrix-start-heading");
  const matrixSvg = matrixVisual.querySelector(".child-matrix-svg");
  if (!callout || !matrixSvg || panel.hidden) return;
  const outer = panel.getBoundingClientRect();
  const cardRect = callout.getBoundingClientRect();
  const diagram = matrixSvg.getBoundingClientRect();
  if (!outer.width || !diagram.width || !cardRect.width) return;
  // Begin BELOW the card's lower-left border, never over its lettering.
  const x0 = cardRect.left - outer.left + Math.min(42, cardRect.width * .11);
  const y0 = cardRect.bottom - outer.top + 11;
  // The first (character) number is at 41,260 in the 520x520 SVG.
  // End at its upper-left rim without obscuring the number or its label.
  const x1 = diagram.left - outer.left + diagram.width * (41 / 520) - 18;
  const y1 = diagram.top - outer.top + diagram.height * (260 / 520) - 20;
  if (y1 <= y0 + 30) return;
  // Bow gently into the empty left margin; avoid a vertical thick line.
  const length = y1 - y0;
  const c1x = Math.max(10, x0 - 41), c1y = y0 + Math.min(80, length * .39);
  const c2x = Math.max(8, x1 - 30), c2y = y1 - Math.min(75, length * .38);
  const angle = Math.atan2(y1 - c2y, x1 - c2x);
  const wing = (direction) => {
    const a = angle + direction * .58;
    return [x1 - 14 * Math.cos(a), y1 - 14 * Math.sin(a)];
  };
  const [leftX,leftY] = wing(-1), [rightX,rightY] = wing(1);
  const path = [
    "M",x0,y0,"C",c1x,c1y,c2x,c2y,x1,y1,
    "M",leftX,leftY,"L",x1,y1,"L",rightX,rightY
  ].join(" ");
  childGuide.style.height = Math.ceil(y1 + 20) + "px";
  childGuide.setAttribute("viewBox", "0 0 " + Math.ceil(outer.width) + " " + Math.ceil(y1 + 20));
  childGuide.querySelectorAll("path").forEach(node => node.setAttribute("d", path));
};
window.addEventListener("resize", () => window.requestAnimationFrame(updateChildGuide), {passive:true});
document.fonts?.ready.then(() => window.requestAnimationFrame(updateChildGuide));

const renderMatrix = (matrix) => {
  const definitions = matrixDefinitions(matrix);
  // Every fresh calculation starts without an open reading.
  matrixVisual.classList.remove("has-started");
  childGuide.hidden = false;
  matrixSections.replaceChildren();
  definitions.forEach((definition) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.childTopic = definition.id;
    button.className = definition.id === "tail" ? "child-topic child-topic-tail" : "child-topic";
    const locked = childPointIsLocked(definition);
    button.classList.toggle("child-topic-locked", locked);
    button.setAttribute("aria-label", (locked ? "Закрытая глава: " : "Открыть: ") + definition.title);
    const symbol = document.createElement("span");
    symbol.className = "child-topic-symbol";
    const symbols = {character:"✧",talents:"☆",learning:"▤",parenting:"♡",
      activities:"◈",recovery:"❀",emotions:"◌",purpose:"⌾",money:"₽",tail:"∞"};
    symbol.textContent = locked ? "🔒" : (symbols[definition.id] || "✧");
    symbol.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "child-topic-label";
    name.textContent = definition.title;
    const energy = document.createElement("span");
    energy.className = "child-topic-energy";
    energy.textContent = definition.code || String(definition.number);
    const arrow = document.createElement("span");
    arrow.className = "child-topic-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    button.append(symbol, name, energy, arrow);
    button.addEventListener("click", () => openPointReading(definition, button));
    matrixSections.append(button);
  });

  const svgPieces = [
    '<svg class="child-matrix-svg" viewBox="0 0 520 520" role="group" aria-label="Нажмите на круг с числом, чтобы прочитать трактовку">',
    '<defs>'+
    '<linearGradient id="childLineGold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c48e3f"/><stop offset=".44" stop-color="#ffdc8b"/><stop offset=".77" stop-color="#f6b859"/><stop offset="1" stop-color="#ce8fba"/></linearGradient>'+
    '<linearGradient id="childLineBlue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4aa9ec"/><stop offset=".5" stop-color="#a7eaff"/><stop offset="1" stop-color="#6b9bea"/></linearGradient>'+
    '<radialGradient id="childAura"><stop stop-color="#fff7cf" stop-opacity=".84"/><stop offset=".5" stop-color="#f4dafa" stop-opacity=".32"/><stop offset="1" stop-color="#dceeff" stop-opacity="0"/></radialGradient>'+
    '<radialGradient id="childGemViolet" cx="32%" cy="22%" r="82%"><stop stop-color="#fff"/><stop offset=".31" stop-color="#fcf6ff"/><stop offset=".72" stop-color="#eecbff"/><stop offset="1" stop-color="#c998f1"/></radialGradient>'+
    '<radialGradient id="childGemBlue" cx="32%" cy="20%" r="87%"><stop stop-color="#fff"/><stop offset=".3" stop-color="#f1fcff"/><stop offset=".73" stop-color="#c8efff"/><stop offset="1" stop-color="#7dbcef"/></radialGradient>'+
    '<radialGradient id="childGemPink" cx="32%" cy="20%" r="87%"><stop stop-color="#fff"/><stop offset=".3" stop-color="#fff5fd"/><stop offset=".73" stop-color="#ffd2eb"/><stop offset="1" stop-color="#e18abc"/></radialGradient>'+
    '<radialGradient id="childGemGold" cx="32%" cy="18%" r="87%"><stop stop-color="#fff"/><stop offset=".3" stop-color="#fffdf2"/><stop offset=".73" stop-color="#ffebb3"/><stop offset="1" stop-color="#dfa852"/></radialGradient>'+
    '<radialGradient id="childGemSmall" cx="30%" cy="20%" r="86%"><stop stop-color="#fff"/><stop offset=".4" stop-color="#fff9ff"/><stop offset=".84" stop-color="#efdcf9"/><stop offset="1" stop-color="#cb9cde"/></radialGradient>'+
    '<linearGradient id="childGemIridescentRim" x1="0%" y1="0%" x2="100%" y2="100%"><stop stop-color="#ffffff"/><stop offset=".19" stop-color="#ffe8b8"/><stop offset=".41" stop-color="#e9cbff"/><stop offset=".66" stop-color="#9deaff"/><stop offset=".84" stop-color="#ffd2ed"/><stop offset="1" stop-color="#ffffff"/></linearGradient>'+
    '<linearGradient id="childCaptionGlassViolet" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".98"/><stop offset=".58" stop-color="#fffbff" stop-opacity=".95"/><stop offset="1" stop-color="#f5eafa" stop-opacity=".92"/></linearGradient>'+
    '<linearGradient id="childCaptionGlassBlue" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".98"/><stop offset="1" stop-color="#e7f4ff" stop-opacity=".93"/></linearGradient>'+
    '<linearGradient id="childCaptionGlassPink" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".98"/><stop offset="1" stop-color="#ffeaf5" stop-opacity=".94"/></linearGradient>'+
    '<linearGradient id="childCaptionGlassGold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fffefa" stop-opacity=".98"/><stop offset="1" stop-color="#fff3df" stop-opacity=".94"/></linearGradient>'+
    '<radialGradient id="childMatrixCorona"><stop stop-color="#fffad3" stop-opacity=".64"/><stop offset=".45" stop-color="#ffe7b4" stop-opacity=".38"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient>'+
    '<linearGradient id="childRayGold"><stop stop-color="#efb55e"/><stop offset=".5" stop-color="#fff6d7"/><stop offset="1" stop-color="#efb766"/></linearGradient>'+
    '<linearGradient id="childRayBlue"><stop stop-color="#7ac4ec"/><stop offset=".5" stop-color="#efffff"/><stop offset="1" stop-color="#7cc8ee"/></linearGradient>'+
    '<linearGradient id="childRayPink"><stop stop-color="#f2a0c8"/><stop offset=".5" stop-color="#fff6fc"/><stop offset="1" stop-color="#eda0cb"/></linearGradient>'+
    '</defs>',
    '<circle class="child-matrix-aura" cx="260" cy="258" r="246" fill="url(#childAura)"/>',
    '<circle class="child-matrix-orbit" cx="260" cy="258" r="212"/>',
    '<circle class="child-matrix-orbit child-matrix-orbit-inner" cx="260" cy="258" r="148"/>',
    '<path class="child-matrix-glow child-matrix-glow-gold" d="M260 20 L500 260 L260 500 L20 260 Z"/>',
    '<path class="child-matrix-glow child-matrix-glow-blue" d="M104 104 H416 V416 H104 Z"/>',
    '<circle class="child-matrix-corona" cx="260" cy="260" r="138" fill="url(#childMatrixCorona)"/>',
    '<path class="child-matrix-lightray child-matrix-lightray-gold" d="M260 260 L260 41 M260 260 L260 479"/>',
    '<path class="child-matrix-lightray child-matrix-lightray-blue" d="M260 260 L104 104 M260 260 L416 416"/>',
    '<path class="child-matrix-lightray child-matrix-lightray-pink" d="M260 260 L416 104 M260 260 L104 416"/>',
    '<path class="child-matrix-outline child-outline-outer" d="M260 20 L500 260 L260 500 L20 260 Z"/>',
    '<path class="child-matrix-outline child-outline-soft child-outline-square" d="M104 104 H416 V416 H104 Z"/>',
    '<path class="child-matrix-outline child-outline-soft child-outline-inner" d="M260 20 L416 104 L500 260 L416 416 L260 500 L104 416 L20 260 L104 104 Z"/>',
    '<path class="child-matrix-line" d="M260 20 V500 M20 260 H500 M104 104 L416 416 M416 104 L104 416"/>',
    '<path class="child-matrix-line child-line-pink" d="M260 260 L416 416 M260 260 L416 104"/>'
  ];
  const extraPoints = [
    ...definitions.filter((point) => point.small),
    {id: "tail-detail", title: "Кармический хвост ребёнка", x: 260, y: 431, number: matrix.tail.second,
      code: [matrix.tail.first, matrix.tail.second, matrix.bottom].join(" - ")}
  ];
  // Static pearl/iridescent ring: lightweight SVG strokes, no looping effects.
  const gemDetails = (point, radius) => {
    const x = point.x, y = point.y;
    return [
      '<circle class="child-gem-color-halo" cx="' + x + '" cy="' + y +
        '" r="' + (radius + 4.4) + '"/>',
      '<circle class="child-gem-rainbow-rim" cx="' + x + '" cy="' + y +
        '" r="' + (radius + 2.5) + '"/>',
      '<circle class="child-gem-rim" cx="' + x + '" cy="' + y +
        '" r="' + (radius + 1.1) + '"/>',
      '<circle class="child-gem-inner" cx="' + x + '" cy="' + y +
        '" r="' + (radius - 3.6) + '"/>',
      '<path class="child-gem-lustre" d="M' + (x - radius*.72) + ' ' + (y - radius*.69) +
        ' A' + radius + ' ' + radius + ' 0 0 1 ' + (x + radius*.42) + ' ' + (y - radius*.91) + '"/>',
      '<path class="child-gem-side-glint" d="M' + (x + radius*.92) + ' ' + (y + radius*.38) +
        ' A' + radius + ' ' + radius + ' 0 0 1 ' + (x + radius*.62) + ' ' + (y + radius*.78) + '"/>',
      '<ellipse class="child-gem-sheen" cx="' + (x - radius*.17) +
        '" cy="' + (y - radius*.47) + '" rx="' + (radius*.47) +
        '" ry="' + (radius*.19) + '"/>',
      '<path class="child-gem-glint-star" d="M' + (x + radius*.67) + ' ' + (y - radius*.78 - 3.5) +
        ' v7 m-3.5 -3.5 h7"/>',
      // Unmistakable static active-state rings + a small pearl checkmark.
      // CSS hides these on unselected points: the full matrix stays colorful.
      '<circle class="child-gem-active-aura" cx="' + x + '" cy="' + y +
        '" r="' + (radius + 10.5) + '"/>',
      '<circle class="child-gem-active-ring" cx="' + x + '" cy="' + y +
        '" r="' + (radius + 7.5) + '"/>',
      '<circle class="child-gem-active-ring-inner" cx="' + x + '" cy="' + y +
        '" r="' + (radius + 4.5) + '"/>',
      '<circle class="child-gem-active-check" cx="' + (x + radius*.74) +
        '" cy="' + (y - radius*.75) + '" r="' + (radius < 20 ? 7.6 : 9.4) + '"/>',
      '<path class="child-gem-active-checkmark" d="M' + (x + radius*.74 - 3.6) +
        ' ' + (y - radius*.75) + ' l2.6 2.7 4.8 -5.5"/>'
    ].join("");
  };
  extraPoints.forEach((point) => {
    svgPieces.push('<g tabindex="0" role="button" data-child-point="' + point.id +
      '" class="child-matrix-extra child-matrix-small-button" aria-label="' + point.title +
      ', энергия ' + point.number + '"><circle cx="' + point.x + '" cy="' + point.y +
      '" r="17"/>' + gemDetails(point, 17) + '<circle class="child-matrix-hit" cx="' + point.x + '" cy="' + point.y +
      '" r="24"/><text x="' + point.x + '" y="' + (point.y + 5) + '">' + point.number + '</text></g>');
  });
  definitions.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && !point.small).forEach((point) => {
    svgPieces.push('<g tabindex="0" role="button" data-child-point="' + point.id +
      '" class="child-matrix-point child-point-' + point.color +
      '" aria-label="' + point.title + ', энергия ' + point.number +
      '"><circle cx="' + point.x + '" cy="' + point.y + '" r="' + (point.id === "innerNature" ? 33 : 25) +
      '"/>' + gemDetails(point, point.id === "innerNature" ? 33 : 25) + '<circle class="child-matrix-hit" cx="' + point.x + '" cy="' + point.y +
      '" r="' + (point.id === "innerNature" ? 35 : 30) +
      '"/><text x="' + point.x + '" y="' + (point.y + 6) + '">' + point.number + '</text></g>');
  });
  // Elegant glass capsules: every label opens the same real numeric position.
  // Positions are tuned for the 520x520 responsive mobile diagram.
  // Lightweight fairytale labels. Their ids stay linked to the original point readings.
  // Jewel-glass labels. All 13 IDs continue opening their original authored readings.
  // Compact caption capsules; labels stay connected to their original matrix sections.
  const matrixCaptions = [
    {id:"talents",x:260,y:94,w:144,h:37,icon:"star",lines:["Таланты","и сильные стороны"],tone:"violet"},
    {id:"parenting",x:115,y:53,w:116,h:35,icon:"crown",lines:["Воспитание","и поддержка"],tone:"gold"},
    {id:"emotions",x:416,y:55,w:134,h:35,icon:"chat",lines:["Эмоции","и общение"],tone:"blue"},
    {id:"character",x:99,y:209,w:133,h:35,icon:"person",lines:["Характер","и темперамент"],tone:"pink"},
    {id:"activities",x:421,y:209,w:131,h:35,icon:"target",lines:["Спорт, кружки","и увлечения"],tone:"pink"},
    {id:"games",x:260,y:205,w:140,h:30,icon:"game",lines:["Игры и увлечения"],tone:"gold"},
    {id:"innerNature",x:260,y:333,w:149,h:34,icon:"heart",lines:["Внутренний мир","и душевный комфорт"],tone:"pink"},
    {id:"learningHelp",x:152,y:297,w:116,h:30,icon:"book",lines:["Освоить новое"],tone:"violet"},
    {id:"interests",x:369,y:297,w:110,h:30,icon:"sparkle",lines:["Что увлекает"],tone:"violet"},
    {id:"familyFeelings",x:108,y:369,w:131,h:35,icon:"home",lines:["Как чувствует","близких"],tone:"blue"},
    {id:"independence",x:411,y:371,w:166,h:36,icon:"diamond",lines:["Развитие","самостоятельности"],tone:"violet"},
    {id:"tail",x:154,y:450,w:150,h:30,icon:"infinity",lines:["Кармический хвост"],tone:"pink"},
    {id:"recovery",x:382,y:480,w:166,h:36,icon:"leaf",lines:["Отдых","и восстановление"],tone:"gold"}
  ];
  // Hand-drawn outline pictograms stay vector-sharp on iPhone and require zero network requests.
  const captionIcons = {
    star:'<path d="m12 2.5 2.7 6.8 6.8 2.7-6.8 2.7-2.7 6.8-2.7-6.8-6.8-2.7 6.8-2.7z"/>',
    crown:'<path d="m2.7 8 4.9 4.4L12 4.8l4.4 7.6L21.3 8l-2 10.5H4.7L2.7 8z"/><path d="M5 21h14"/>',
    chat:'<path d="M5 5.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H10l-5.5 3v-3.1A2 2 0 0 1 3 16V7.5a2 2 0 0 1 2-2z"/><path d="M8 11h8"/>',
    person:'<circle cx="12" cy="8" r="3.25"/><path d="M5.2 20c.2-4.2 2.6-6.5 6.8-6.5s6.6 2.3 6.8 6.5"/>',
    target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.1"/>',
    game:'<rect x="2.5" y="6.5" width="19" height="12" rx="5.1"/><path d="M7.5 10v5m-2.5-2.5h5"/><circle cx="16.6" cy="10.8" r=".65"/><circle cx="18.5" cy="13.2" r=".65"/>',
    heart:'<path d="M20.4 5.7c-2.5-2.6-6.4-1.7-8.4 1.2-2-2.9-5.9-3.8-8.4-1.2-3 3.1-1.8 6.7.9 9.4L12 21l7.5-5.9c2.7-2.7 3.9-6.3.9-9.4z"/>',
    book:'<path d="M12 5.8C9.1 3.8 5.5 4 3 4.9v13.4c3-.9 6.2-.5 9 1.5 2.8-2 6-2.4 9-1.5V4.9c-2.5-.9-6.1-1.1-9 .9z"/><path d="M12 5.8v14"/>',
    sparkle:'<path d="m12 2.8 2.2 7 7 2.2-7 2.2-2.2 7-2.2-7-7-2.2 7-2.2z"/>',
    home:'<path d="m3 11 9-7 9 7v9H3z"/><path d="M9 20v-6h6v6"/>',
    diamond:'<path d="m7 4-4.5 6 9.5 11 9.5-11L17 4z"/><path d="M2.5 10h19M7 4l-2 6 7 11 7-11-2-6"/>',
    infinity:'<path d="M12 12c-2.3-2.6-4.2-5.1-7-4.2-4.8 1.5-2.4 8.5 1.5 8.5 2.6 0 4.3-2.2 5.5-4.3 1.2 2.1 2.9 4.3 5.5 4.3 3.9 0 6.3-7 1.5-8.5-2.8-.9-4.7 1.6-7 4.2z"/>',
    leaf:'<path d="M20.5 3.5C11 3.1 4 7.1 4 14c0 4.1 2.8 6.4 6.1 6.4 7 0 11-7.5 10.4-16.9z"/><path d="M4 21c3-5.3 7.4-8.4 13-11"/>'
  };
  matrixCaptions.forEach(({id,x,y,w,h,icon,lines,tone}) => {
    const left=x-w/2, top=y-h/2, twoLines=lines.length>1;
    const lineY=twoLines ? h/2-2.7 : h/2+4.5;
    // The ancestry pill clears the girl's face. The heart sits outside its compact pill.
    const textX=id==="innerNature" ? w/2+7 : id==="parenting" ? w/2+17 : w/2+(twoLines ? 4 : 9);
    const badgeX=id==="innerNature" ? -3 : twoLines ? 19 : 0;
    const badgeY=id==="innerNature" ? h/2 : twoLines ? 0 : h/2;
    const spans=lines.map((line,i)=>
      '<tspan x="' + textX + '" y="' + (lineY+13.2*i) + '">' + line + '</tspan>'
    ).join("");
    svgPieces.push(
      '<g tabindex="0" role="button" data-child-point="' + id +
      '" class="child-matrix-label child-matrix-label-' + tone +
      '" aria-label="Открыть: ' + lines.join(" ") +
      '" transform="translate(' + left + ' ' + top + ')">' +
      '<ellipse class="child-caption-halo" cx="' + w/2 + '" cy="' + h/2 +
      '" rx="' + (w/2+3) + '" ry="' + (h/2+4) + '"/>' +
      '<rect class="child-caption-glass" width="' + w + '" height="' + h +
      '" rx="' + h/2 + '"/>' +
      '<rect class="child-caption-highlight" x="1.7" y="1.5" width="' + (w-3.4) +
      '" height="' + (h-3) + '" rx="' + (h-3)/2 + '"/>' +
      '<circle class="child-caption-medallion-halo" cx="' + badgeX +
      '" cy="' + badgeY + '" r="15.8"/>' +
      '<circle class="child-caption-medallion" cx="' + badgeX +
      '" cy="' + badgeY + '" r="12.9"/>' +
      '<svg class="child-caption-symbol" x="' + (badgeX-10.5) +
      '" y="' + (badgeY-10.5) +
      '" width="21" height="21" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      captionIcons[icon] + '</svg>' +
      '<text class="child-matrix-label-copy">' + spans + '</text></g>'
    );
  });
  // The introductory arrow is an overlay across the heading and diagram;
  // no extra SVG elements are embedded in the interactive matrix.
  svgPieces.push("</svg>");
  matrixVisual.innerHTML = svgPieces.join("");
  window.requestAnimationFrame(updateChildGuide);
  const allPoints = new Map([...definitions, ...extraPoints].map((point) => [point.id, point]));
  matrixVisual.querySelectorAll("[data-child-point]").forEach((node) => {
    const open = () => {
      const point = allPoints.get(node.dataset.childPoint);
      if (point) openPointReading(point, node);
    };
    node.addEventListener("click", open);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
  // Show the complete topic list first; readings open only on explicit selection.
};

// One energy-bank request per calculation; stale date requests can never overwrite a newer day.
let childDayRequestId = 0;
const populateList = (id, values) => {
  const list = byId(id);
  list.replaceChildren();
  for (const value of values) {
    const line = document.createElement("li");
    line.textContent = value;
    list.append(line);
  }
};
const updateDay = async () => {
  if (!birth) return;
  const requestId = ++childDayRequestId;
  const target = new Date(chosenDate.getFullYear(), chosenDate.getMonth(), chosenDate.getDate());
  byId("child-day-date").textContent = dateLabel(target);
  const bornOn = new Date(birth.year, birth.month - 1, birth.day);
  byId("child-day-prev").disabled = target.getTime() <= bornOn.getTime();
  byId("child-day-today").hidden = target.getTime() === currentDate().getTime();
  try {
    const reading = await loadChildDayReading(birth, target, await getDayBank());
    if (requestId !== childDayRequestId) return;
    byId("child-day-text").textContent = reading.text;
    populateList("child-day-need", reading.todayNeed);
    populateList("child-day-avoid", reading.todayAvoid);
    populateList("child-day-care", reading.parentAttention);
    byId("child-day-need-wrap").hidden = !reading.todayNeed.length;
    byId("child-day-avoid-wrap").hidden = !reading.todayAvoid.length;
    byId("child-day-attention-wrap").hidden = !reading.parentAttention.length;
    const ageNote = byId("child-day-age-note");
    ageNote.textContent = reading.ageHint;
    ageNote.hidden = !reading.ageHint;
  } catch {
    if (requestId !== childDayRequestId) return;
    byId("child-day-text").textContent = "Не удалось получить текст. Попробуйте выбрать дату ещё раз.";
    ["child-day-need-wrap","child-day-avoid-wrap","child-day-attention-wrap","child-day-age-note"]
      .forEach((id) => {byId(id).hidden = true;});
  }
};

const setTab = (next) => {
  const isMatrix = next === "matrix";
  matrixPanel.hidden = !isMatrix;
  dayPanel.hidden = isMatrix;
  byId("child-day-discovery").hidden = !isMatrix;
  result.classList.toggle("is-day-view", !isMatrix);
  matrixTab.setAttribute("aria-selected", String(isMatrix));
  dayTab.setAttribute("aria-selected", String(!isMatrix));
  matrixTab.tabIndex = isMatrix ? 0 : -1;
  dayTab.tabIndex = isMatrix ? -1 : 0;
  if (isMatrix) ++childDayRequestId;
  else {
    closeInsight();
    updateDay();
  }
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.hidden = true;
  const entered = parseBirthDate(input.value.trim());
  if (!entered) {
    error.textContent = "Проверьте дату. Например: 05.09.2020.";
    error.hidden = false;
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    birth = entered;
    invalidateChildPdf();
    chosenDate = currentDate();
    closeInsight();
    renderMatrix(calculateMatrix(birth));
    byId("child-born-date").textContent = pad(birth.day) + "." + pad(birth.month) + "." + birth.year;
    byId("child-born-date").dateTime = birth.year + "-" + pad(birth.month) + "-" + pad(birth.day);
    // Each new calculation opens the matrix, never an old Day selection.
    startingTab = "matrix";
    setTab("matrix");
    preview.hidden = true;
    result.hidden = false;
    // Show the child's birth date and both navigation prompts after calculating.
    // Starting at the result header also keeps the first topic cards in view on
    // taller mobile screens; the responsive overview below adapts shorter screens.
    window.requestAnimationFrame(() => {
      result.scrollIntoView({behavior: "smooth", block: "start"});
      window.requestAnimationFrame(updateChildGuide);
    });
    warmChildPdf();
  } catch (reason) {
    error.textContent = "Не удалось загрузить расчёт. Проверьте подключение и попробуйте ещё раз.";
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

input.addEventListener("input", () => {
  const digits = input.value.replace(/\D/g, "").slice(0, 8);
  input.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join(".");
});

matrixTab.addEventListener("click", () => setTab("matrix"));
dayTab.addEventListener("click", () => setTab("day"));
byId("child-day-discovery").addEventListener("click", () => {
  setTab("day");
  dayTab.scrollIntoView({behavior:"smooth", block:"start"});
});
// Keep the two actual tabs accessible by keyboard as well as touch.
[matrixTab, dayTab].forEach((tab) => tab.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const toMatrix = event.key === "ArrowLeft";
  setTab(toMatrix ? "matrix" : "day");
  (toMatrix ? matrixTab : dayTab).focus();
}));


byId("child-day-prev").addEventListener("click", () => {
  chosenDate = new Date(chosenDate.getFullYear(), chosenDate.getMonth(), chosenDate.getDate() - 1);
  updateDay();
});
byId("child-day-next").addEventListener("click", () => {
  chosenDate = new Date(chosenDate.getFullYear(), chosenDate.getMonth(), chosenDate.getDate() + 1);
  updateDay();
});
byId("child-day-today").addEventListener("click", () => {
  chosenDate = currentDate();
  updateDay();
});

// Full child report: create the PDF only after the parent requests it.
const pdfDialog = byId("child-pdf-dialog");
const pdfOpen = byId("child-pdf-open");
const pdfClose = byId("child-pdf-close");
const pdfSave = byId("child-pdf-save");
const pdfChapters = byId("child-pdf-list");
const pdfStatus = byId("child-pdf-status");
let preparedChildPdf=null;
let preparingChildPdf=null;
let childPdfGeneration=0;
const childPdfKey = date => date ? [date.day,date.month,date.year].map((v,i)=>i<2?String(v).padStart(2,"0"):v).join(".") : "";
const invalidateChildPdf = () => {
  ++childPdfGeneration;
  preparedChildPdf=null;
  preparingChildPdf=null;
};
let childPdfModulePromise = null;
const pdfModule = () => {
  if (!childPdfModulePromise) childPdfModulePromise = import("./child-report-pdf.js?v=8")
    .catch(error => { childPdfModulePromise = null; throw error; });
  return childPdfModulePromise;
};
// Keep the PDF warm and cached, as in the annual report.
const prepareChildPdf=(date)=>{
  const key=childPdfKey(date);
  if (!key) return Promise.reject(new Error("Сначала рассчитайте матрицу ребёнка."));
  if (!hasChildPaidAccess()) return Promise.reject(new Error("PDF доступен после подтверждённой покупки для этого ребёнка."));
  if (preparedChildPdf?.key===key) return Promise.resolve(preparedChildPdf);
  if (preparingChildPdf?.key===key) return preparingChildPdf.promise;
  const generation=childPdfGeneration;
  const promise=(async()=>{
    const {collectChildPdf,buildChildPdfBlob,preloadChildPdfEngine}=await pdfModule();
    const [report]=await Promise.all([
      collectChildPdf(date,matrixDefinitions(calculateMatrix(date)),getEnergyBank,getChildKarmicTail),
      preloadChildPdfEngine()
    ]);
    if (!report.ready) throw new Error("Не удалось загрузить все главы. Проверьте соединение и попробуйте ещё раз.");
    const blob=await buildChildPdfBlob(report);
    if (generation!==childPdfGeneration || childPdfKey(birth)!==key) throw new Error("Дата рождения изменилась.");
    preparedChildPdf={key,blob,filename:"Полный разбор ребёнка "+report.birthday+".pdf"};
    if (pdfDialog.open) pdfStatus.textContent="Полный PDF готов. Собрана 21 глава.";
    return preparedChildPdf;
  })();
  preparingChildPdf={key,promise};
  promise.finally(()=>{
    if (preparingChildPdf?.promise===promise) preparingChildPdf=null;
  }).catch(()=>{});
  return promise;
};
const warmChildPdf=()=>{
  if(!birth || !hasChildPaidAccess()) return;
  const date={...birth},key=childPdfKey(date);
  const warm=()=>{
    if(childPdfKey(birth)!==key || preparedChildPdf?.key===key) return;
    prepareChildPdf(date).catch(()=>{});
  };
  if("requestIdleCallback" in window) window.requestIdleCallback(warm,{timeout:1250});
  else window.setTimeout(warm,320);
};

// Every locked child point opens the same offer; the free chapter stays readable.
document.addEventListener("click", (event) => {
  if (!birth || hasChildPaidAccess()) return;
  const target = event.target.closest("[data-child-topic], [data-child-point], .child-lock-buy");
  if (!target) return;
  const point = target.dataset.childTopic || target.dataset.childPoint;
  if (point === FREE_CHILD_POINT) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void showChildPdfOffer();
}, true);
const showChildPdfOffer = async () => {
  if (!birth) return;
  if (!hasChildPaidAccess()) {
    try {
      const { openSharedOffer } = await import("../shared-offer.js?v=store2");
      await openSharedOffer({ subject:{product_code:"child_full_v1",birth_date:[birth.year,String(birth.month).padStart(2,"0"),String(birth.day).padStart(2,"0")].join("-")}, product: "полный разбор ребёнка", title: "Откройте полный разбор ребёнка", oncePrice: 990, memberPrice: 490 });
    } catch (error) { alert("Не удалось открыть варианты покупки. Попробуйте ещё раз."); }
    return;
  }
  const dateISO = birth.year + "-" + pad(birth.month) + "-" + pad(birth.day);
  const pdfDate = byId("child-pdf-confirm-date");
  pdfDate.textContent = pad(birth.day) + "." + pad(birth.month) + "." + birth.year;
  pdfDate.dateTime = dateISO;
  const chapters = matrixDefinitions(calculateMatrix(birth));
  pdfChapters.replaceChildren();
  for (const chapter of chapters) {
    const item = document.createElement("li");
    item.textContent = chapter.title;
    pdfChapters.append(item);
  }
  const paid = hasChildPaidAccess();
  pdfSave.disabled = !paid;
  pdfSave.querySelector(".child-pdf-save-label").textContent = paid
    ? "Скачать полный разбор в PDF" : "Скачать PDF после покупки";
  pdfSave.querySelector(".child-pdf-save-symbol").textContent = paid ? "↓" : "🔒";
  pdfStatus.textContent = paid
    ? (preparedChildPdf?.key===childPdfKey(birth) ? "PDF готов к скачиванию." : "Файл будет собран для этого ребёнка.")
    : "Оплата пока не подключена. Полный разбор и PDF закрыты; первая глава бесплатна.";
  pdfDialog.showModal();
};
pdfOpen.addEventListener("click", showChildPdfOffer);
byId("child-pdf-top-open").addEventListener("click", showChildPdfOffer);
// Closing the offer must NEVER depend on the PDF purchase/download state.
pdfClose.addEventListener("click", () => pdfDialog.close());
byId("child-pdf-change-date").addEventListener("click", () => {
  pdfDialog.close();
  form.scrollIntoView({behavior:"smooth",block:"center"});
  input.focus({preventScroll:true});
  input.select();
});
pdfDialog.addEventListener("click", event => {
  if (event.target === pdfDialog) pdfDialog.close();
});
pdfSave.addEventListener("click", async () => {
  if (!birth || pdfSave.disabled || !hasChildPaidAccess()) return;
  const date={...birth};
  const normalLabel=pdfSave.innerHTML;
  pdfSave.disabled=true;
  pdfSave.textContent=preparedChildPdf?.key===childPdfKey(date) ? "Открываю PDF…" : "Готовлю PDF…";
  try {
    const {blob,filename}=await prepareChildPdf(date);
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download=filename;
    link.target="_blank";
    link.rel="noopener";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),120000);
    pdfStatus.textContent="PDF готов. Повторное скачивание не потребует новой сборки.";
  } catch (error) {
    pdfStatus.textContent=error?.message || "Не удалось создать PDF. Попробуйте ещё раз.";
  } finally {
    pdfSave.disabled=false;
    pdfSave.innerHTML=normalLabel;
  }
});

