const home = document.querySelector("#home");
const dialog = document.querySelector("#coming-soon");
let yearFeatureLoading;
let yearStylesLoading;
let matrixFeatureLoading;
let matrixStylesLoading;
let redFlagFeatureLoading;
let redFlagStylesLoading;
let destinyCodeFeatureLoading;
let destinyCodeStylesLoading;
let personalDayFeatureLoading;
let compatibilityFeatureLoading;
let compatibilityStylesLoading;

const loadStylesheet = (href) => new Promise((resolve, reject) => {
  const existing = document.querySelector(`link[href^="${href}"]`);
  if (existing) return resolve();
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = href;
  stylesheet.onload = resolve;
  stylesheet.onerror = reject;
  document.head.append(stylesheet);
});

const getYearFeature = () => {
    if (!yearFeatureLoading) yearFeatureLoading = import("./year-feature.js?v=30");
  return yearFeatureLoading;
};

const openYearFeature = async () => {
  const [feature] = await Promise.all([
    getYearFeature(),
    yearStylesLoading ??= loadStylesheet("year-polish.css?v=25")
  ]);
  feature.openYear();
};

const getMatrixFeature = () => {
  if (!matrixFeatureLoading) matrixFeatureLoading = import("./matrix-feature.js?v=36");
  return matrixFeatureLoading;
};

const openMatrixFeature = async () => {
  const [feature] = await Promise.all([
    getMatrixFeature(),
    matrixStylesLoading ??= loadStylesheet("matrix-polish.css?v=7")
  ]);
  feature.openMatrix();
};

const getRedFlagFeature = () => {
  if (!redFlagFeatureLoading) redFlagFeatureLoading = import("./redflag-feature.js?v=28");
  return redFlagFeatureLoading;
};

const openRedFlagFeature = async () => {
  const [feature] = await Promise.all([
    getRedFlagFeature(),
    redFlagStylesLoading ??= loadStylesheet("redflag-polish.css?v=10")
  ]);
  feature.openRedFlag();
};

const getCompatibilityFeature = () => {
  if (!compatibilityFeatureLoading) compatibilityFeatureLoading = import("./compatibility-feature.js?v=3");
  return compatibilityFeatureLoading;
};

const openCompatibilityFeature = async () => {
  const [feature] = await Promise.all([
    getCompatibilityFeature(),
    compatibilityStylesLoading ??= loadStylesheet("compatibility-polish.css?v=4")
  ]);
  feature.openCompatibility();
};

const getPersonalDayFeature = () => {
  if (!personalDayFeatureLoading) personalDayFeatureLoading = import("./personal-day-feature.js?v=55");
  return personalDayFeatureLoading;
};

const openPersonalDayFeature = async () => {
  const feature = await getPersonalDayFeature();
  feature.openPersonalDay();
};

// Предзагрузка модуля расчёта дня, чтобы при открытии форма появлялась сразу.
window.setTimeout(() => getPersonalDayFeature().catch(() => {}), 900);

const getDestinyCodeFeature = () => {
  if (!destinyCodeFeatureLoading) destinyCodeFeatureLoading = import("./destiny-code-feature.js?v=24");
  return destinyCodeFeatureLoading;
};

const openDestinyCodeFeature = async () => {
  const [feature] = await Promise.all([
    getDestinyCodeFeature(),
    destinyCodeStylesLoading ??= loadStylesheet("destiny-code.css?v=4")
  ]);
  feature.openDestinyCode();
};

const openMoneyCodeClientLink = async () => {
  const [feature] = await Promise.all([
    getDestinyCodeFeature(),
    destinyCodeStylesLoading ??= loadStylesheet("destiny-code.css?v=4")
  ]);
  feature.openDestinyCode({ clientOnly: true });
  const backButton = document.querySelector("#back-destiny-code-home");
  backButton.hidden = true;
  backButton.style.display = "none";
};

const syncClientLink = () => {
  if (window.location.hash === "#moy-kod-deneg") {
    openMoneyCodeClientLink().catch(() => alert("Не удалось открыть код богатства. Обновите страницу и попробуйте ещё раз."));
  }
};

syncClientLink();
window.addEventListener("hashchange", syncClientLink);
const syncYearLink = () => {
  if (window.location.hash === "#razbor-goda") {
    openYearFeature().catch(() => {});
  }
};
syncYearLink();
window.addEventListener("hashchange", syncYearLink);
const syncPersonalDayLink = () => {
  if (window.location.hash === "#lichnyj-den") {
    if (home) home.hidden = true;
    openPersonalDayFeature()
      .catch(() => alert("Не удалось открыть расчёт дня. Обновите страницу и попробуйте ещё раз."));
  }
};
syncPersonalDayLink();
window.addEventListener("hashchange", syncPersonalDayLink);

document.querySelectorAll("[data-open-year]").forEach((button) => button.addEventListener("click", () => {
  openYearFeature().catch(() => alert("Не удалось открыть раздел. Обновите страницу и попробуйте ещё раз."));
}));

document.querySelectorAll("[data-open-matrix]").forEach((button) => button.addEventListener("click", () => {
  openMatrixFeature().catch(() => alert("Не удалось открыть раздел. Обновите страницу и попробуйте ещё раз."));
}));

window.addEventListener("open-matrix-for-date", (event) => {
  const { date, target } = event.detail || {};
  if (!date || !target) return;
  Promise.all([
    getMatrixFeature(),
    matrixStylesLoading ??= loadStylesheet("matrix-polish.css?v=7")
  ]).then(([feature]) => feature.openMatrixForDate(date, target))
    .catch(() => alert("Не удалось открыть полный расчёт. Обновите страницу и попробуйте ещё раз."));
});

document.querySelectorAll("[data-open-redflag]").forEach((button) => button.addEventListener("click", () => {
  openRedFlagFeature().catch(() => alert("Не удалось открыть раздел. Обновите страницу и попробуйте ещё раз."));
}));

document.querySelectorAll("[data-open-personal-day]").forEach((button) => button.addEventListener("click", () => {
  openPersonalDayFeature().catch(() => alert("Не удалось открыть личный расчёт дня. Обновите страницу и попробуйте ещё раз."));
}));

document.querySelectorAll("[data-open-destiny-code]").forEach((button) => button.addEventListener("click", () => {
  openDestinyCodeFeature().catch(() => alert("Не удалось открыть раздел. Обновите страницу и попробуйте ещё раз."));
}));

document.querySelectorAll("[data-open-compatibility]").forEach((button) => button.addEventListener("click", () => {
  openCompatibilityFeature().catch(() => alert("Не удалось открыть совместимость. Обновите страницу и попробуйте ещё раз."));
}));

document.querySelectorAll("[data-coming-soon]").forEach((button) => button.addEventListener("click", () => dialog.showModal()));
document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
// One route type for every Telegram section: /?view=<section>.
// Reuse the real homepage card's click handler. No duplicate calculation or
// separate chatbot action: exactly what pressing the card on the site does.
const telegramSectionCards = Object.freeze({
  day: '[data-open-personal-day]',
  year: '[data-open-year]',
  redflag: '[data-open-redflag]',
  compatibility: '[data-open-compatibility]',
  full: 'a.product-card.calculation',
  woman: '#woman-section',
  wealth: '[data-open-destiny-code]',
  children: '#children-section',
  horary: '#horary-section',
  school: 'a.school-home-button',
  appointment: '#appointment-section'
});
const telegramView = new URLSearchParams(window.location.search).get("view");
if (Object.prototype.hasOwnProperty.call(telegramSectionCards, telegramView)) {
  const card = document.querySelector(telegramSectionCards[telegramView]);
  if (card) card.click();
}
