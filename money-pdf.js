const PDF_SCRIPT = "https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/pdfmake.min.js";
const PDF_FONTS = "https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/vfs_fonts.js";

const loadScript = (src) => new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.onload = resolve;
  script.onerror = reject;
  document.head.append(script);
});

const getPdfMake = async () => {
  if (!window.pdfMake) {
    await loadScript(PDF_SCRIPT);
    await loadScript(PDF_FONTS);
  }
  return window.pdfMake;
};

const imageAsDataUrl = async (source) => {
  const response = await fetch(source);
  if (!response.ok) throw new Error("Не удалось открыть шаблон PDF");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

let templatesLoading;
const getTemplates = () => {
  if (!templatesLoading) {
    templatesLoading = Promise.all([
      imageAsDataUrl("assets/year-report-cover.jpg"),
      imageAsDataUrl("assets/year-report-inner.jpg")
    ]).then(([cover, inner]) => ({ cover, inner }));
  }
  return templatesLoading;
};

const asParagraphs = (value, style = "paragraph") => (Array.isArray(value) ? value : [value])
  .filter(Boolean)
  .flatMap((text) => String(text).split("\n\n"))
  .map((text) => text.trim())
  .filter(Boolean)
  .map((text) => ({ text, style }));

const formatDate = ({ day, month, year }) => `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;

const createSection = ({ label, lead, text, ritual, ritualTitle, advice }) => [
  ...(label ? [{ text: label, style: "sectionKicker" }] : []),
  ...(lead ? [{ text: lead, style: "sectionTitle" }] : []),
  ...asParagraphs(text),
  ...(ritual ? [
    { text: ritualTitle || "Как использовать", style: "subsectionTitle" },
    ...asParagraphs(ritual)
  ] : []),
  ...(advice ? [{ text: advice, style: "advice" }] : [])
];

const buildDocument = ({ birthDate, code, sections }, templates) => ({
  info: { title: `Личный денежный код ${code}` },
  pageSize: "A4",
  pageMargins: [88, 112, 88, 122],
  images: { cover: templates.cover, inner: templates.inner },
  background: (page) => ({ image: page === 1 ? "cover" : "inner", width: 595.28, height: 841.89 }),
  defaultStyle: { font: "Roboto", fontSize: 19, bold: true, color: "#142C43", lineHeight: 1.42 },
  styles: {
    coverKicker: { fontSize: 36, bold: true, color: "#1F3E5F", alignment: "center", lineHeight: 1.08 },
    coverCode: { fontSize: 108, bold: true, color: "#1D3654", alignment: "center" },
    coverName: { fontSize: 18, bold: true, color: "#80642F", characterSpacing: 1.8, alignment: "center" },
    coverSubtitle: { fontSize: 28, bold: true, color: "#665332", alignment: "center", lineHeight: 1.1 },
    coverDetails: { fontSize: 21, bold: true, color: "#142C43", alignment: "center", lineHeight: 1.45 },
    innerKicker: { fontSize: 15, bold: true, color: "#8A6A32", characterSpacing: 1.25, alignment: "center", margin: [0, 0, 0, 16] },
    title: { fontSize: 36, bold: true, color: "#1E405F", alignment: "center", margin: [0, 0, 0, 22] },
    subtitle: { fontSize: 20, bold: true, color: "#334B62", alignment: "center", margin: [0, 0, 0, 30] },
    sectionKicker: { fontSize: 15, bold: true, color: "#8A6A32", characterSpacing: 0.7, margin: [0, 26, 0, 11] },
    sectionTitle: { fontSize: 31, bold: true, color: "#1E405F", margin: [0, 0, 0, 18] },
    subsectionTitle: { fontSize: 25, bold: true, color: "#60431D", margin: [0, 28, 0, 11] },
    paragraph: { fontSize: 19, bold: true, color: "#142C43", margin: [0, 0, 0, 17] },
    advice: { fontSize: 17, bold: true, italics: true, color: "#60431D", margin: [0, 8, 0, 20] }
  },
  content: [
    {
      stack: [
        { text: "ЛИЧНЫЙ ДЕНЕЖНЫЙ КОД", style: "coverKicker", margin: [0, 42, 0, 26] },
        { text: code, style: "coverCode", margin: [0, 0, 0, 30] },
        { text: "НУМЕРОЛОГИЯ.ONLINE", style: "coverName", margin: [0, 0, 0, 16] },
        { text: "ВАША ЛИЧНАЯ ДЕНЕЖНАЯ ФОРМУЛА", style: "coverSubtitle", margin: [0, 0, 0, 28] },
        { text: `Дата рождения: ${formatDate(birthDate)}`, style: "coverDetails" }
      ],
      pageBreak: "after"
    },
    { text: "ВАШ ЛИЧНЫЙ РЕЗУЛЬТАТ", style: "innerKicker" },
    { text: `Код денег ${code}`, style: "title" },
    { text: "Сохраните этот разбор, чтобы возвращаться к нему в моменты денежных решений и новых целей.", style: "subtitle" },
    ...sections.flatMap(createSection)
  ],
  footer: (page, pages) => page === 1 ? null : ({
    text: `${page - 1} / ${pages - 1}`,
    alignment: "center",
    color: "#9C7A42",
    fontSize: 10,
    margin: [0, 18, 0, 0]
  })
});

export const createMoneyPdfButton = ({ birthDate, code, sections }) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "destiny-code-pdf-button";
  button.textContent = "Сохранить результат в PDF ↓";
  button.setAttribute("aria-label", "Сохранить расчёт кода денег в PDF");
  button.style.cssText = "width:100%;min-height:58px;border:1px solid #b9833c;border-radius:18px;background:#fff6e5;color:#754316;font:800 16px/1.2 inherit;cursor:pointer";

  button.addEventListener("click", async () => {
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Собираем ваш PDF…";

    try {
      const [pdfMake, templates] = await Promise.all([getPdfMake(), getTemplates()]);
      pdfMake.createPdf(buildDocument({ birthDate, code, sections }, templates)).download(`Код денег ${code}.pdf`);
      button.textContent = "PDF готов — скачивание началось";
    } catch (error) {
      console.error(error);
      button.textContent = "Не удалось собрать PDF — попробуйте ещё раз";
    } finally {
      button.disabled = false;
      window.setTimeout(() => {
        if (button.textContent !== originalLabel) button.textContent = originalLabel;
      }, 2500);
    }
  });

  return button;
};
