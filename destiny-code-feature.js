import { loadFullReportKnowledge } from "./full-report-library.js?v=3";

const home = document.querySelector("#home");
const section = document.querySelector("#destiny-code");
const form = document.querySelector("#destiny-code-form");
const birthInput = document.querySelector("#destiny-code-birth-date");
const error = document.querySelector("#destiny-code-error");
const result = document.querySelector("#destiny-code-result");
const resultTitle = document.querySelector("#destiny-code-result-title");
const cards = document.querySelector("#destiny-code-cards");

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

const nameFor = (number, energies) => energies[String(number)]?.name || `Число ${number}`;

const createCard = ({ label, value, lead, text, advice, ritual = "", accent = false }) => {
  const article = document.createElement("article");
  article.className = `destiny-code-card${accent ? " destiny-code-card--accent" : ""}`;
  article.innerHTML = `<p>${label}</p><div class="destiny-code-number">${value}</div><h3>${lead}</h3><p class="destiny-code-copy">${text}</p>${ritual ? `<div class="destiny-code-ritual"><strong>Как его использовать</strong><p>${ritual}</p></div>` : ""}<p class="destiny-code-advice"><strong>Ориентир:</strong> ${advice}</p>`;
  return article;
};

const buildCode = (birthDate, energies) => {
  const lifePath = reduceClassic(sumDigits(`${String(birthDate.day).padStart(2, "0")}${String(birthDate.month).padStart(2, "0")}${birthDate.year}`), true);
  const birthday = reduceClassic(birthDate.day, true);
  const birthMonth = reduceClassic(birthDate.month, true);
  const birthYear = reduceClassic(sumDigits(birthDate.year), true);
  const currentYear = new Date().getFullYear();
  const personalYear = reduceClassic(birthDate.day + birthDate.month + sumDigits(currentYear), true);
  const financialDigits = [reduceClassic(birthday), reduceClassic(birthMonth), reduceClassic(birthYear), reduceClassic(lifePath)];
  const financialCode = financialDigits.join("");
  const energy = (number) => energies[String(number)] || energies[String(reduceClassic(number))];
  const item = (label, value, intro, field, adviceField) => {
    const record = energy(value);
    return {
      label,
      value,
      lead: `${nameFor(value, energies)}. ${intro}`,
      text: record?.[field] || record?.shortEssence || "Описание этой энергии сейчас готовится.",
      advice: record?.[adviceField] || record?.advice || "Смотрите, где это число уже проявляется в вашей жизни."
    };
  };
  const moneyCode = {
    label: "Ваш код денег",
    value: financialCode,
    lead: "Личная денежная формула",
    text: `Это не случайный набор цифр. В нём соединяются ваши привычки заработка, отношение к ценности и то, через какие качества деньги легче остаются в жизни. ${financialDigits.map((number) => `${number} отвечает за ${energy(number)?.shortEssence?.toLowerCase() || nameFor(number, energies).toLowerCase()}`).join(". ")}.`,
    ritual: `Напишите ${financialCode} на первой странице финансового блокнота или в заметке, где ведёте доходы и цели. Можно поставить его рядом с конкретной суммой на карте желаний. Когда видите этот код, не ждите чуда, а делайте один денежный шаг: назвать цену, отправить предложение, проверить бюджет, закрыть долг или отложить сумму себе. Так цифры становятся личным знаком действия, а не просто красивым талисманом.`,
    advice: `Результат кода: ${reduceClassic(financialDigits.reduce((sum, number) => sum + number, 0))}. Деньги включаются не от одной сильной цифры, а когда вся связка ${financialCode} работает вместе.`,
    accent: true
  };

  return {
    title: `Код даты ${String(birthDate.day).padStart(2, "0")}.${String(birthDate.month).padStart(2, "0")}.${birthDate.year}`,
    cards: [
      moneyCode,
      item("Число жизненного пути", lifePath, "главный маршрут", "lifeScenario", "advice"),
      item("Число дня рождения", birthday, "ваше живое проявление", "mainStrength", "whatNotToDo"),
      item("Число месяца рождения", birthMonth, "внутренний двигатель", "shortEssence", "advice"),
      item("Число года рождения", birthYear, "фон взросления", "mainBlock", "whatNotToDo"),
      item(`Личный год ${currentYear}`, personalYear, "тема текущего периода", "lifeScenario", "advice"),
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
    const code = buildCode(birthDate, energies);
    resultTitle.textContent = code.title;
    cards.replaceChildren(...code.cards.map(createCard));
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    error.textContent = "Не удалось открыть базу расшифровок. Обновите страницу и попробуйте ещё раз.";
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.innerHTML = "Узнать мой код <span aria-hidden=\"true\">→</span>";
  }
});
