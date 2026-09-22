const dialog = document.querySelector("#coming-soon");
let yearFeatureLoading;
let yearStylesLoading;

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
  if (!yearFeatureLoading) yearFeatureLoading = import("./year-feature.js?v=2");
  return yearFeatureLoading;
};

const openYearFeature = async () => {
  const [feature] = await Promise.all([
    getYearFeature(),
    yearStylesLoading ??= loadStylesheet("year-polish.css?v=22")
  ]);
  feature.openYear();
};

document.querySelectorAll("[data-open-year]").forEach((button) => button.addEventListener("click", () => {
  openYearFeature().catch(() => alert("Не удалось открыть раздел. Обновите страницу и попробуйте ещё раз."));
}));

document.querySelectorAll("[data-coming-soon]").forEach((button) => button.addEventListener("click", () => dialog.showModal()));
document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
