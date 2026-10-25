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
let insightRequestId = 0;
// Load every approved child energy, not just energy 1. Cache by energy number.
// One reading source: one JSON file per energy, all topics in its sections.
const energyBankRequests = new Map();
const getEnergyBank = (energy) => {
  const number = Number(energy);
  if (!Number.isInteger(number) || number < 1 || number > 22) return Promise.resolve(null);
  if (!energyBankRequests.has(number)) {
    energyBankRequests.set(number,
      fetch(`./data/matrix/sections/energy-${number}.json?v=3`)
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
  if (selectedPoint) selectedPoint.classList.remove("is-selected");
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
  if (selectedPoint) selectedPoint.classList.remove("is-selected");
  selectedPoint = source;
  if (source) source.classList.add("is-selected");
  insight.hidden = false;

  // Karmic tail requires three energies, not one isolated number.
  if (point.id === "tail" || point.id === "tail-detail") {
    body.textContent = "Кармический хвост рассчитывается по сочетанию трёх чисел. Полная трактовка этого сочетания ещё готовится.";
    return;
  }

  body.textContent = "Открываю подробный разбор…";
  const bank = await getEnergyBank(energy);
  if (requestId !== insightRequestId || insight.hidden) return;
  if (!bank) {
    body.textContent = "Не удалось загрузить текст. Проверьте подключение и нажмите на число ещё раз.";
    return;
  }
  const paragraphs = bank.sections?.[point.id]?.paragraphs;
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
  {id: "character", title: "Характер и темперамент", number: matrix.center, x: 260, y: 260, color: "center"},
  {id: "talents", title: "Таланты и сильные стороны", number: matrix.top, x: 260, y: 41, color: "violet"},
  {id: "learning", title: "Как ребёнку легче учиться", number: matrix.left, x: 41, y: 260, color: "violet"},
  {id: "parenting", title: "Как воспитывать и поддерживать", number: matrix.corners.topLeft, x: 104, y: 104, color: "blue"},
  {id: "activities", title: "Спорт, кружки и увлечения", number: matrix.right, x: 479, y: 260, color: "pink"},
  {id: "recovery", title: "Отдых и восстановление", number: matrix.bottom, x: 260, y: 479, color: "pink"},
  {id: "emotions", title: "Эмоции, дружба и общение", number: matrix.corners.topRight, x: 416, y: 104, color: "blue"},
  {id: "purpose", title: "Предназначение и потенциал", number: matrix.purpose.personal, x: 260, y: 157, color: "gold"},
  {id: "mistakes", title: "Главные ошибки ребёнка", number: matrix.leftSpoke.outer},
  {id: "lifeLessons", title: "Главные жизненные уроки", number: matrix.purpose.general},
  {id: "parentMistakes", title: "Главные ошибки родителей", number: matrix.corners.topLeft},
  {id: "comfort", title: "Точка душевного комфорта", number: matrix.leftSpoke.core},
  {id: "gifts", title: "Идеальный подарок", number: matrix.rightSpoke.core},
  {id: "games", title: "Как играть и увлекать ребёнка", number: matrix.topSpoke.near},
  {id: "parentChildLessons", title: "Детско-родительские уроки", number: matrix.corners.bottomLeft},
  {id: "familyFeelings", title: "Как чувствует близких", number: matrix.corners.bottomLeft, x: 104, y: 416, small: true},
  {id: "independence", title: "Как раскрывает самостоятельность", number: matrix.corners.bottomRight, x: 416, y: 416, small: true},
  {id: "learningHelp", title: "Как помочь освоить новое", number: matrix.leftSpoke.near, x: 157, y: 260, small: true},
  {id: "interests", title: "Что может увлечь ребёнка", number: matrix.rightSpoke.near, x: 363, y: 260, small: true},
  {id: "money", title: "Отношения с деньгами", number: matrix.center, color: "gold"},
  {id: "tail", title: "Кармический хвост", number: matrix.tail.first, x: 260, y: 385, color: "gold",
    code: [matrix.tail.first, matrix.tail.second, matrix.bottom].join(" - ")}
];

const renderMatrix = (matrix) => {
  const definitions = matrixDefinitions(matrix);
  matrixSections.replaceChildren();
  definitions.forEach((definition) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = definition.id === "tail" ? "child-topic child-topic-tail" : "child-topic";
    button.setAttribute("aria-label", "Открыть: " + definition.title);
    const symbol = document.createElement("span");
    symbol.className = "child-topic-symbol";
    const symbols = {character:"✧",talents:"☆",learning:"▤",parenting:"♡",
      activities:"◈",recovery:"❀",emotions:"◌",purpose:"⌾",money:"₽",tail:"∞"};
    symbol.textContent = symbols[definition.id] || "✧";
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
    '<path class="child-matrix-outline" d="M260 20 L500 260 L260 500 L20 260 Z"/>',
    '<path class="child-matrix-outline child-outline-soft" d="M104 104 H416 V416 H104 Z"/>',
    '<path class="child-matrix-outline child-outline-soft" d="M260 20 L416 104 L500 260 L416 416 L260 500 L104 416 L20 260 L104 104 Z"/>',
    '<path class="child-matrix-line" d="M260 20 V500 M20 260 H500 M104 104 L416 416 M416 104 L104 416"/>',
    '<path class="child-matrix-line child-line-pink" d="M260 260 L416 416 M260 260 L416 104"/>'
  ];
  const extraPoints = [
    ...definitions.filter((point) => point.small),
    {id: "tail-detail", title: "Кармический хвост ребёнка", x: 260, y: 431, number: matrix.tail.second,
      code: [matrix.tail.first, matrix.tail.second, matrix.bottom].join(" - ")}
  ];
  extraPoints.forEach((point) => {
    svgPieces.push('<g tabindex="0" role="button" data-child-point="' + point.id +
      '" class="child-matrix-extra child-matrix-small-button" aria-label="' + point.title +
      ', энергия ' + point.number + '"><circle cx="' + point.x + '" cy="' + point.y +
      '" r="17"/><circle class="child-matrix-hit" cx="' + point.x + '" cy="' + point.y +
      '" r="24"/><text x="' + point.x + '" y="' + (point.y + 5) + '">' + point.number + '</text></g>');
  });
  definitions.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && !point.small).forEach((point) => {
    svgPieces.push('<g tabindex="0" role="button" data-child-point="' + point.id +
      '" class="child-matrix-point child-point-' + point.color +
      '" aria-label="' + point.title + ', энергия ' + point.number +
      '"><circle cx="' + point.x + '" cy="' + point.y + '" r="' + (point.id === "character" ? 33 : 25) +
      '"/><circle class="child-matrix-hit" cx="' + point.x + '" cy="' + point.y +
      '" r="' + (point.id === "character" ? 35 : 30) +
      '"/><text x="' + point.x + '" y="' + (point.y + 6) + '">' + point.number + '</text></g>');
  });
  svgPieces.push("</svg>");
  matrixVisual.innerHTML = svgPieces.join("");
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
  // Open the first helpful reading inside the page, not over the screen.
  const firstButton = matrixSections.querySelector('.child-topic');
  openPointReading(definitions[0], firstButton);
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
    chosenDate = currentDate();
    closeInsight();
    renderMatrix(calculateMatrix(birth));
    byId("child-born").textContent = "Дата рождения: " + pad(birth.day) + "." + pad(birth.month) + "." + birth.year;
    setTab(startingTab);
    preview.hidden = true;
    result.hidden = false;
    result.scrollIntoView({behavior: "smooth", block: "start"});
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
