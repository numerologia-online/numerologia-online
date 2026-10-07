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
    if (!yearFeatureLoading) yearFeatureLoading = import("./year-feature.js?v=29");
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
  if (!matrixFeatureLoading) matrixFeatureLoading = import("./matrix-feature.js?v=32");
  return matrixFeatureLoading;
};

const openMatrixFeature = async () => {
  const [feature] = await Promise.all([
    getMatrixFeature(),
    matrixStylesLoading ??= loadStylesheet("matrix-polish.css?v=6")
  ]);
  feature.openMatrix();
};

const getRedFlagFeature = () => {
  if (!redFlagFeatureLoading) redFlagFeatureLoading = import("./redflag-feature.js?v=6");
  return redFlagFeatureLoading;
};

const openRedFlagFeature = async () => {
  const [feature] = await Promise.all([
    getRedFlagFeature(),
    redFlagStylesLoading ??= loadStylesheet("redflag-polish.css?v=2")
  ]);
  feature.openRedFlag();
};

const getPersonalDayFeature = () => {
  if (!personalDayFeatureLoading) personalDayFeatureLoading = import("./personal-day-feature.js?v=38");
  return personalDayFeatureLoading;
};

const openPersonalDayFeature = async () => {
  const feature = await getPersonalDayFeature();
  feature.openPersonalDay();
};

// Предзагрузка модуля расчёта дня, чтобы при открытии форма появлялась сразу.
window.setTimeout(() => getPersonalDayFeature().catch(() => {}), 900);

const getDestinyCodeFeature = () => {
  if (!destinyCodeFeatureLoading) destinyCodeFeatureLoading = import("./destiny-code-feature.js?v=23");
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
      .then(() => {
        if (personalDayOnly) {
          requestAnimationFrame(() => document.querySelector(".personal-day-close")?.remove());
        }
      })
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
    matrixStylesLoading ??= loadStylesheet("matrix-polish.css?v=6")
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

document.querySelectorAll("[data-coming-soon]").forEach((button) => button.addEventListener("click", () => dialog.showModal()));
document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());