const home = document.querySelector("#home");
const dialog = document.querySelector("#coming-soon");
let yearFeatureLoading;
let yearStylesLoading;
let matrixFeatureLoading;
let matrixStylesLoading;
let redFlagFeatureLoading;
let redFlagStylesLoading;

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
  if (!yearFeatureLoading) yearFeatureLoading = import("./year-feature.js?v=14");
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
  if (!matrixFeatureLoading) matrixFeatureLoading = import("./matrix-feature.js?v=2");
  return matrixFeatureLoading;
};

const openMatrixFeature = async () => {
  const [feature] = await Promise.all([
    getMatrixFeature(),
    matrixStylesLoading ??= loadStylesheet("matrix-polish.css?v=3")
  ]);
  feature.openMatrix();
};

const getRedFlagFeature = () => {
  if (!redFlagFeatureLoading) redFlagFeatureLoading = import("./redflag-feature.js?v=1");
  return redFlagFeatureLoading;
};

const openRedFlagFeature = async () => {
  const [feature] = await Promise.all([
    getRedFlagFeature(),
    redFlagStylesLoading ??= loadStylesheet("redflag-polish.css?v=1")
  ]);
  feature.openRedFlag();
};

document.querySelectorAll("[data-open-year]").forEach((button) => button.addEventListener("click", () => {
  openYearFeature().catch(() => alert("Не удалось открыть раздел. Обновите страницу и попробуйте ещё раз."));
}));

document.querySelectorAll("[data-open-matrix]").forEach((button) => button.addEventListener("click", () => {
  openMatrixFeature().catch(() => alert("Не удалось открыть раздел. Обновите страницу и попробуйте ещё раз."));
}));

document.querySelectorAll("[data-open-redflag]").forEach((button) => button.addEventListener("click", () => {
  openRedFlagFeature().catch(() => alert("Не удалось открыть раздел. Обновите страницу и попробуйте ещё раз."));
}));

document.querySelectorAll("[data-coming-soon]").forEach((button) => button.addEventListener("click", () => dialog.showModal()));
document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
