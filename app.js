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
  if (!matrixFeatureLoading) matrixFeatureLoading = import("./matrix-feature.js?v=35");
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
  if (!redFlagFeatureLoading) redFlagFeatureLoading = import("./redflag-feature.js?v=15");
  return redFlagFeatureLoading;
};

const openRedFlagFeature = async () => {
  const [feature] = await Promise.all([
    getRedFlagFeature(),
    redFlagStylesLoading ??= loadStylesheet("redflag-polish.css?v=4")
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
  if (!personalDayFeatureLoading) personalDayFeatureLoading = import("./personal-day-feature.js?v=52");
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
const personalDayOnly = new URLSearchParams(window.location.search).get("view") === "day";
const syncPersonalDayLink = () => {
  if (window.location.hash === "#lichnyj-den" || personalDayOnly) {
    if (home) home.hidden = true;
    openPersonalDayFeature()
      .catch(() => alert("Не удалось открыть расчёт дня. Обновите страницу и попробуйте ещё раз."));
  }
};
syncPersonalDayLink();
window.addEventListener("hashchange", syncPersonalDayLink);

// Direct links from the Telegram bot open the same feature as its homepage card.
// Only these three additional views are handled here; old website navigation
// and the private #moy-kod-deneg client link remain unchanged.
const botDirectView = new URLSearchParams(window.location.search).get("view");
const botViewOpeners = {
  redflag: openRedFlagFeature,
  compatibility: openCompatibilityFeature,
  wealth: openDestinyCodeFeature
};
if (Object.prototype.hasOwnProperty.call(botViewOpeners, botDirectView)) {
  botViewOpeners[botDirectView]().catch(() =>
    alert("Не удалось открыть раздел. Обновите страницу и попробуйте ещё раз."));
}

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