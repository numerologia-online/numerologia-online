import { loadFullReportKnowledge, loadFullReportSection } from "./full-report-library.js?v=3";
import { calculateMatrix } from "./numerology-core.js?v=1";

const home = document.querySelector("#home");
const section = document.querySelector("#destiny-code");
const form = document.querySelector("#destiny-code-form");
const birthInput = document.querySelector("#destiny-code-birth-date");
const error = document.querySelector("#destiny-code-error");
const result = document.querySelector("#destiny-code-result");
const resultTitle = document.querySelector("#destiny-code-result-title");
const cards = document.querySelector("#destiny-code-cards");
const ritualsSection = document.querySelector("#money-rituals");
const ritualsCode = document.querySelector("#money-rituals-code");
const ritualsList = document.querySelector("#money-rituals-list");

const masterNumbers = new Set([11, 22, 33]);

const sumDigits = (value) => String(Math.abs(Number(value) || 0))
  .split("")
  .reduce((sum, digit) => sum + Number(digit), 0);

const reduceClassic = (value, preserveMaster = false) => {
  let result = Math.abs(Number(value) || 0);
  while (result > 9 && !(preserveMaster && masterNumbers.has(result))) result = sumDigits(result);
  return result || 9;
};

const parseBirthDate = (value) => {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const currentYear = new Date().getFullYear();
  if (Number(year) < 1900 || Number(year) > currentYear || date.getUTCDate() !== Number(day) || date.getUTCMonth() !== Number(month) - 1) return null;
  return { day: Number(day), month: Number(month), year: Number(year) };
};

const formatBirthDateInput = () => {
  const digits = birthInput.value.replace(/\D/g, "").slice(0, 8);
  birthInput.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join(".");
};

const createCard = ({ label, value = "", lead, text, advice = "", ritual = "", ritualTitle = "Как использовать", accent = false }) => {
  const article = document.createElement("article");
  article.className = `destiny-code-card${accent ? " destiny-code-card--accent" : ""}`;
  const paragraphs = Array.isArray(text) ? text : [text];
  const ritualParagraphs = ritual ? ritual.split("\n\n").map((paragraph) => `<p>${paragraph}</p>`).join("") : "";
  article.innerHTML = `<p>${label}</p>${value ? `<div class="destiny-code-number">${value}</div>` : ""}<h3>${lead}</h3><div class="destiny-code-copy">${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}</div>${ritual ? `<div class="destiny-code-ritual"><strong>${ritualTitle}</strong>${ritualParagraphs}</div>` : ""}${advice ? `<p class="destiny-code-advice"><strong>Ориентир:</strong> ${advice}</p>` : ""}`;
  return article;
};

let moneyBlocksRequest;
let moneyRitualsRequest;

const loadMoneyBlocks = () => {
  if (!moneyBlocksRequest) {
    moneyBlocksRequest = fetch("data/money-blocks.json?v=1").then((response) => {
      if (!response.ok) throw new Error("Не удалось загрузить денежные блоки");
      return response.json();
    });
  }
  return moneyBlocksRequest;
};

const loadMoneyRituals = () => {
  if (!moneyRitualsRequest) {
    moneyRitualsRequest = fetch("data/money-rituals.json?v=1").then((response) => {
      if (!response.ok) throw new Error("Не удалось загрузить денежные ритуалы");
      return response.json();
    });
  }
  return moneyRitualsRequest;
};

const MONEY_CARDS = [
  { key: "moneyBlock", label: "Что блокирует деньги", fallback: "Почему деньги могут не приходить" }
];

const moneyCard = async ({ key, label, fallback }, energy) => {
  const blocks = await loadMoneyBlocks();
  const custom = key === "moneyBlock" ? blocks[String(energy)] : null;
  if (custom) return { label, lead: custom.lead, text: custom.paragraphs };

  const section = await loadFullReportSection(energy);
  const source = section.sections?.[key];
  return {
    label,
    lead: source?.title || fallback,
    text: source?.paragraphs?.filter((paragraph) => !["Что это значит для вас", "Как проявляется в плюсе", "Где уходит в минус", "Что делать прямо сейчас"].includes(paragraph)) || ["Расшифровка этой денежной точки готовится."],
    advice: "Смотрите на этот сценарий как на ориентир для своих решений, а не как на приговор."
  };
};

const createFullReportCta = () => {
  const article = document.createElement("article");
  article.className = "destiny-code-full-cta";
  article.innerHTML = `<p class="eyebrow">Продолжение разбора</p><h3>Деньги можно не только терять</h3><p>Подробнее о том, как открыть денежный поток и где легче зарабатывать, читайте в полном разборе вашей матрицы судьбы.</p><button type="button">Открыть полный разбор <span aria-hidden="true">→</span></button>`;
  article.querySelector("button").addEventListener("click", () => {
    section.classList.remove("is-active");
    home.classList.add("is-active");
    document.querySelector("[data-open-matrix]")?.click();
  });
  return article;
};

const createRitualsCta = (code) => {
  const article = document.createElement("article");
  article.className = "destiny-code-rituals-cta";
  article.innerHTML = `<span aria-hidden="true">✦</span><div><p>Денежная библиотека</p><h3>Ритуалы с кодом ${code}</h3><small>10 практик, которые можно сохранить себе</small></div><b aria-hidden="true">→</b>`;
  article.addEventListener("click", () => openMoneyRituals(code));
  return article;
};

const createRitual = (ritual, code) => {
  const details = document.createElement("details");
  details.className = "money-ritual";
  const render = (value) => value.replaceAll("{code}", code);
  details.innerHTML = `<summary><span class="money-ritual-icon" aria-hidden="true">${ritual.icon}</span><span><b>${ritual.title}</b><small>${ritual.when}</small></span><i aria-hidden="true">+</i></summary><div class="money-ritual-body"><p class="money-ritual-needs"><strong>Понадобится:</strong> ${ritual.needs}</p><ol>${ritual.steps.map((step) => `<li>${render(step)}</li>`).join("")}</ol><p class="money-ritual-phrase">«${ritual.phrase}»</p></div>`;
  return details;
};

const openMoneyRituals = async (code) => {
  section.classList.remove("is-active");
  ritualsSection.classList.add("is-active");
  ritualsCode.textContent = `Ваш код денег: ${code}`;
  ritualsList.innerHTML = `<p class="money-rituals-loading">Открываю денежную библиотеку…</p>`;
  window.scrollTo({ top: 0, behavior: "instant" });
  try {
    const rituals = await loadMoneyRituals();
    ritualsList.replaceChildren(...rituals.map((ritual) => createRitual(ritual, code)));
  } catch {
    ritualsList.innerHTML = `<p class="money-rituals-loading">Не удалось открыть ритуалы. Обновите страницу и попробуйте ещё раз.</p>`;
  }
};

const buildCode = async (birthDate, energies) => {
  const lifePath = reduceClassic(sumDigits(`${String(birthDate.day).padStart(2, "0")}${String(birthDate.month).padStart(2, "0")}${birthDate.year}`), true);
  const birthday = reduceClassic(birthDate.day, true);
  const birthMonth = reduceClassic(birthDate.month, true);
  const birthYear = reduceClassic(sumDigits(birthDate.year), true);
  const financialDigits = [reduceClassic(birthday), reduceClassic(birthMonth), reduceClassic(birthYear), reduceClassic(lifePath)];
  const financialCode = financialDigits.join("");
  const moneyCode = {
    label: "Ваш код денег",
    value: financialCode,
    lead: "Личная денежная формула",
    text: "Это не случайный набор цифр. В нём соединяются ваши привычки заработка, отношение к ценности и то, через какие качества деньги легче остаются в жизни.",
    ritualTitle: "Как активировать талисман",
    ritual: `Напишите ${financialCode} своей рукой на первой странице финансового блокнота. Рядом запишите сумму, к которой вы идёте, или одно большое денежное желание. Не «хочу много», а именно ту цифру, которая для вас сейчас важна.\n\nСделайте код заметным, но личным: поставьте на заставку телефона, положите маленькую записку с ним в кошелёк, разместите на карте желаний рядом с домом, путешествием, обучением или суммой, которую хотите получить.\n\nМожно написать код на конверте, где вы храните накопления или записываете свои финансовые цели. Пусть он станет вашим личным знаком достатка, свободы и права жить лучше.`,
    accent: true
  };

  const matrix = calculateMatrix(birthDate);
  const moneyPositions = {
    moneyBlock: matrix.rightSpoke.outer,
    moneyFlow: matrix.rightSpoke.near,
    earning: matrix.rightSpoke.core
  };
  const moneyCards = await Promise.all(MONEY_CARDS.map((definition) => moneyCard(definition, moneyPositions[definition.key])));

  return {
    title: `Код даты ${String(birthDate.day).padStart(2, "0")}.${String(birthDate.month).padStart(2, "0")}.${birthDate.year}`,
    financialCode,
    cards: [
      moneyCode,
      ...moneyCards
    ]
  };
};

export const openDestinyCode = () => {
  home.classList.remove("is-active");
  section.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
};

document.querySelector("#back-destiny-code-home").addEventListener("click", () => {
  section.classList.remove("is-active");
  home.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
});

document.querySelector("#back-money-rituals").addEventListener("click", () => {
  ritualsSection.classList.remove("is-active");
  section.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
});

birthInput.addEventListener("input", () => {
  formatBirthDateInput();
  error.hidden = true;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const birthDate = parseBirthDate(birthInput.value);
  if (!birthDate) {
    error.textContent = "Введите настоящую дату в формате ДД.ММ.ГГГГ.";
    error.hidden = false;
    return;
  }

  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Считаю ваш код...";
  try {
    const { energies } = await loadFullReportKnowledge();
    const code = await buildCode(birthDate, energies);
    resultTitle.textContent = code.title;
    cards.replaceChildren(...code.cards.map(createCard), createRitualsCta(code.financialCode), createFullReportCta());
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    error.textContent = "Не удалось открыть базу расшифровок. Обновите страницу и попробуйте ещё раз.";
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.innerHTML = "Узнать код денег <span aria-hidden=\"true\">→</span>";
  }
});
