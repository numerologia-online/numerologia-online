import { createMoneyPdfButton } from "./money-pdf.js?v=4";
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

const createMoneyDisclosure = ({ label, lead, text, advice = "", ritual = "", ritualTitle = "Как использовать", accent = false }) => {
  const details = document.createElement("details");
  details.className = `destiny-code-disclosure${accent ? " destiny-code-disclosure--accent" : ""}`;
  const paragraphs = Array.isArray(text) ? text : [text];
  const copy = paragraphs.filter(Boolean).map((paragraph) => `<p>${paragraph}</p>`).join("");
  const ritualParagraphs = ritual ? ritual.split("\n\n").map((paragraph) => `<p>${paragraph}</p>`).join("") : "";
  details.innerHTML = `<summary><span><p>${label}</p><h3>${lead}</h3></span><b aria-hidden="true">+</b></summary><div class="destiny-code-disclosure-body">${copy ? `<div class="destiny-code-copy">${copy}</div>` : ""}${ritual ? `<div class="destiny-code-ritual"><strong>${ritualTitle}</strong>${ritualParagraphs}</div>` : ""}${advice ? `<p class="destiny-code-advice"><strong>Ориентир:</strong> ${advice}</p>` : ""}</div>`;
  return details;
};

let moneyBlocksRequest;
let moneyRitualsRequest;

const loadMoneyBlocks = () => {
  if (!moneyBlocksRequest) {
    moneyBlocksRequest = fetch("data/money-blocks.json?v=2").then((response) => {
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
  if (custom) return { label, lead: label, text: custom.paragraphs };

  const section = await loadFullReportSection(energy);
  const source = section.sections?.[key];
  return {
    label,
    lead: source?.title || fallback,
    text: source?.paragraphs?.filter((paragraph) => !["Что это значит для вас", "Как проявляется в плюсе", "Где уходит в минус", "Что делать прямо сейчас"].includes(paragraph)) || ["Расшифровка этой денежной точки готовится."],
    advice: "Смотрите на этот сценарий как на ориентир для своих решений, а не как на приговор."
  };
};

const createMoneyPathCta = ({ title, text, target, birthDate }) => {
  const article = document.createElement("article");
  article.className = "destiny-code-path-cta destiny-code-disclosure";
  article.innerHTML = `<span><p>Полный расчёт</p><h3>${title}</h3><small>${text}</small></span><b aria-hidden="true">→</b>`;
  article.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("open-matrix-for-date", {
      detail: { date: `${String(birthDate.day).padStart(2, "0")}.${String(birthDate.month).padStart(2, "0")}.${birthDate.year}`, target }
    }));
  });
  return article;
};

const createActivationContent = (code) => ({
  label: `Ваш код денег ${code}`,
  lead: `Как активировать код ${code}`,
  text: "",
  ritualTitle: "Как активировать талисман",
  ritual: `Напишите ${code} своей рукой на первой странице финансового блокнота. Рядом запишите сумму, к которой вы идёте, или одно большое денежное желание. Не «хочу много», а именно ту цифру, которая для вас сейчас важна.\n\nСделайте код заметным, но личным: поставьте на заставку телефона, положите маленькую записку с ним в кошелёк, разместите на карте желаний рядом с домом, путешествием, обучением или суммой, которую хотите получить.\n\nМожно написать код на конверте, где вы храните накопления или записываете свои финансовые цели. Пусть он станет вашим личным знаком достатка, свободы и права жить лучше.`,
  accent: true
});

const createActivationDisclosure = (code) => createMoneyDisclosure(createActivationContent(code));

const createRitualsCta = (code) => {
  const article = document.createElement("article");
  article.className = "destiny-code-rituals-cta destiny-code-disclosure";
  article.innerHTML = `<span><p>Денежная библиотека</p><h3>10 денежных ритуалов с вашим личным кодом денег</h3><small>Код ${code} · практики, которые можно сохранить себе</small></span><b aria-hidden="true">→</b>`;
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
    text: "Это не случайная цифра. Это ваш личный код богатства. В нём соединяются ваше отношение к деньгам, чувство собственной ценности и возможности, которые вы готовы впустить в жизнь. Сделайте из него свой денежный талисман: знак достатка, смелых желаний и выбранного пути.",
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
    cards.replaceChildren(
      code.cards[0] && createCard(code.cards[0]),
      createActivationDisclosure(code.financialCode),
      ...code.cards.slice(1).map(createMoneyDisclosure),
      createMoneyPathCta({
        title: "Как включить свой денежный поток",
        text: "Полная расшифровка энергии, через которую деньги начинают двигаться.",
        target: "moneyFlow",
        birthDate
      }),
      createMoneyPathCta({
        title: "Где вам легче всего заработать",
        text: "Полная расшифровка вашей точки заработка и сильного направления.",
        target: "earning",
        birthDate
      }),
      createRitualsCta(code.financialCode),
      createMoneyPdfButton({
        birthDate,
        code: code.financialCode,
        sections: [
          code.cards[0],
          createActivationContent(code.financialCode),
          ...code.cards.slice(1)
        ]
      })
    );
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
