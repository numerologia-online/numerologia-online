import { calculateMatrix, parseBirthDate, reduce9 } from "../numerology-core.js?v=2";

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

const pointDialog = document.createElement("dialog");
pointDialog.className = "child-point-dialog";
pointDialog.setAttribute("aria-labelledby", "child-point-dialog-title");
pointDialog.innerHTML = [
  '<div class="child-point-dialog-inner">',
  '<button class="child-point-dialog-close" type="button" aria-label="Закрыть трактовку">×</button>',
  '<p class="child-point-dialog-eyebrow">✧ Маленькая подсказка для мамы</p>',
  '<div id="child-point-dialog-number" class="child-point-dialog-number"></div>',
  '<h3 id="child-point-dialog-title" class="child-point-dialog-title"></h3>',
  '<p id="child-point-dialog-text" class="child-point-dialog-text"></p>',
  '<button class="child-point-dialog-done" type="button">Вернуться к матрице ♡</button>',
  '</div>'
].join("");
document.body.append(pointDialog);
pointDialog.querySelectorAll(".child-point-dialog-close, .child-point-dialog-done")
  .forEach((button) => button.addEventListener("click", () => pointDialog.close()));
pointDialog.addEventListener("click", (event) => {
  if (event.target !== pointDialog) return;
  const box = pointDialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right ||
      event.clientY < box.top || event.clientY > box.bottom) pointDialog.close();
});
const openPointReading = (point) => {
  if (!banks?.matrix?.entries) return;
  const field = point.field || point.id;
  const description = banks.matrix.entries[String(point.number)]?.[field];
  byId("child-point-dialog-number").textContent = point.code || String(point.number);
  byId("child-point-dialog-title").textContent = point.title;
  byId("child-point-dialog-text").textContent =
    description || "Скоро здесь появится отдельная трактовка. А пока можно изучить другие точки матрицы.";
  if (!pointDialog.open) pointDialog.showModal();
};

const currentDate = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
const dateLabel = (date) => new Intl.DateTimeFormat("ru-RU", {day: "numeric", month: "long", year: "numeric"}).format(date);
const pad = (value) => String(value).padStart(2, "0");

let birth = null;
let chosenDate = currentDate();
let banksPromise = null;
let banks = null;

const fetchBank = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Не удалось получить детские тексты");
  return response.json();
};
const getBanks = () => {
  if (!banksPromise) {
    banksPromise = Promise.all([
      fetchBank("./data/matrix.json?v=1"),
      fetchBank("./data/day.json?v=1")
    ]).then(([matrix, day]) => {
      if (!matrix.entries || !day.fallback) throw new Error("Неверный формат текстов");
      return {matrix, day};
    }).catch((reason) => {
      banksPromise = null;
      throw reason;
    });
  }
  return banksPromise;
};

const sumDigits = (number) => String(number).split("").reduce((sum, digit) => sum + Number(digit), 0);
const reduceTo = (value, maximum) => {
  let number = Math.abs(Math.trunc(Number(value) || 0));
  while (number > maximum) number -= maximum;
  return number || maximum;
};
const lifePath = (date) => {
  let number = sumDigits(date.day) + sumDigits(date.month) + sumDigits(date.year);
  while (number > 9 && number !== 11 && number !== 22 && number !== 33) number = sumDigits(number);
  return number;
};
// Separate adapter for the child's day: the existing adult personal-day feature stays untouched.
// We keep the established combinations so child-specific 22 x 31 texts can be added later.
const calculateChildDay = (date, target) => {
  const d = target.getDate();
  const m = target.getMonth() + 1;
  const y = target.getFullYear();
  const personalYear = reduce9(date.day + date.month + sumDigits(y));
  const personalMonth = reduce9(personalYear + m);
  const personalDay = reduce9(personalMonth + d);
  const generalDay = reduce9(d + m + sumDigits(y));
  const energy = reduceTo(personalDay + personalMonth + generalDay + date.day + m, 22);
  const personalNumber = reduceTo(lifePath(date) + date.day + d + sumDigits(date.year), 31);
  return {energy, personalNumber};
};

const matrixDefinitions = (matrix) => [
  {id: "character", title: "Характер и темперамент", number: matrix.center, x: 260, y: 260, color: "center"},
  {id: "talents", title: "Таланты и сильные стороны", number: matrix.top, x: 260, y: 41, color: "violet"},
  {id: "learning", title: "Как ребёнку легче учиться", number: matrix.left, x: 41, y: 260, color: "violet"},
  {id: "parenting", title: "Как воспитывать и поддерживать", number: matrix.corners.topLeft, x: 104, y: 104, color: "blue"},
  {id: "activities", title: "Спорт, кружки и увлечения", number: matrix.right, x: 479, y: 260, color: "pink"},
  {id: "recovery", title: "Отдых и восстановление", number: matrix.bottom, x: 260, y: 479, color: "pink"},
  {id: "emotions", title: "Эмоции и общение", number: matrix.corners.topRight, x: 416, y: 104, color: "blue"},
  {id: "purpose", title: "Предназначение и потенциал", number: matrix.purpose.personal, x: 260, y: 157, color: "gold"},
  {id: "tail", title: "Кармический хвост", number: matrix.tail.first, x: 260, y: 385, color: "gold",
    code: [matrix.tail.first, matrix.tail.second, matrix.bottom].join(" - ")}
];

const renderMatrix = (matrix) => {
  const definitions = matrixDefinitions(matrix);
  matrixSections.replaceChildren();
  definitions.forEach((definition, index) => {
    const detail = document.createElement("details");
    detail.className = "child-accordion";
    detail.id = "child-read-" + definition.id;
    detail.open = index === 0;
    const heading = document.createElement("summary");
    const title = document.createElement("span");
    title.textContent = definition.title;
    const energy = document.createElement("span");
    energy.className = "child-accordion-energy";
    energy.textContent = definition.code || String(definition.number);
    heading.append(title, energy);

    const text = document.createElement("p");
    text.textContent = banks.matrix.entries?.[String(definition.number)]?.[definition.id]
      || "Эта трактовка готовится. Попробуйте другие разделы.";
    detail.append(heading, text);
    detail.addEventListener("toggle", () => {
      if (detail.open) {
        matrixSections.querySelectorAll("details").forEach((item) => {
          if (item !== detail) item.open = false;
        });
      }
    });
    matrixSections.append(detail);
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
    {id: "family-feelings", field: "emotions", title: "Как чувствует близких", x: 104, y: 416, number: matrix.corners.bottomLeft},
    {id: "independence", field: "purpose", title: "Как раскрывает самостоятельность", x: 416, y: 416, number: matrix.corners.bottomRight},
    {id: "tail-detail", field: "tail", title: "Кармический хвост ребёнка", x: 260, y: 431, number: matrix.tail.second,
      code: [matrix.tail.first, matrix.tail.second, matrix.bottom].join(" - ")},
    {id: "learning-help", field: "learning", title: "Как помочь освоить новое", x: 157, y: 260, number: matrix.leftSpoke.near},
    {id: "interests", field: "activities", title: "Что может увлечь ребёнка", x: 363, y: 260, number: matrix.rightSpoke.near}
  ];
  extraPoints.forEach((point) => {
    svgPieces.push('<g tabindex="0" role="button" data-child-point="' + point.id +
      '" class="child-matrix-extra child-matrix-small-button" aria-label="' + point.title +
      ', энергия ' + point.number + '"><circle cx="' + point.x + '" cy="' + point.y +
      '" r="17"/><circle class="child-matrix-hit" cx="' + point.x + '" cy="' + point.y +
      '" r="24"/><text x="' + point.x + '" y="' + (point.y + 5) + '">' + point.number + '</text></g>');
  });
  definitions.forEach((point) => {
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
      if (point) openPointReading(point);
    };
    node.addEventListener("click", open);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
};

const updateDay = () => {
  if (!birth || !banks) return;
  const {energy, personalNumber} = calculateChildDay(birth, chosenDate);
  const data = banks.day.entries?.[energy + "-" + personalNumber]
    || banks.day.fallback[String(energy)];
  byId("child-day-date").textContent = dateLabel(chosenDate);
  byId("child-day-text").textContent = data?.text || "Прогноз пока готовится.";
  byId("child-day-try").textContent = data?.try || "Выберите что-нибудь приятное вместе.";
  byId("child-day-care").textContent = data?.care || "Сохраняйте комфортный ритм ребёнка.";
  const bornOn = new Date(birth.year, birth.month - 1, birth.day);
  byId("child-day-prev").disabled = chosenDate.getTime() <= bornOn.getTime();
  byId("child-day-today").hidden = chosenDate.getTime() === currentDate().getTime();
};

const setTab = (next) => {
  const isMatrix = next === "matrix";
  matrixPanel.hidden = !isMatrix;
  dayPanel.hidden = isMatrix;
  matrixTab.setAttribute("aria-selected", String(isMatrix));
  dayTab.setAttribute("aria-selected", String(!isMatrix));
  if (!isMatrix) updateDay();
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
    banks = await getBanks();
    birth = entered;
    chosenDate = currentDate();
    if (pointDialog.open) pointDialog.close();
    renderMatrix(calculateMatrix(birth));
    byId("child-born").textContent = "Дата рождения: " + pad(birth.day) + "." + pad(birth.month) + "." + birth.year;
    updateDay();
    setTab("matrix");
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
