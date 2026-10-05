const PDF_SCRIPT = "https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/pdfmake.min.js";
const PDF_FONTS = "https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/vfs_fonts.js";

const loadScript = (src) => new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = src;
  script.onload = resolve;
  script.onerror = reject;
  document.head.append(script);
});

const ensurePdfMake = async () => {
  if (window.pdfMake) return;
  await loadScript(PDF_SCRIPT);
  await loadScript(PDF_FONTS);
};

const asParagraphs = (value) => (Array.isArray(value) ? value : [value])
  .filter(Boolean)
  .map((text) => ({ text, margin: [0, 0, 0, 10] }));

const formatDate = ({ day, month, year }) => `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;

const createSection = ({ label, lead, text, ritual, ritualTitle, advice }) => ({
  stack: [
    { text: label || "", style: "eyebrow" },
    { text: lead || "", style: "heading" },
    ...asParagraphs(text),
    ...(ritual ? [
      { text: ritualTitle || "Как использовать", style: "subheading" },
      ...asParagraphs(ritual.split("\n\n"))
    ] : []),
    ...(advice ? [{ text: advice, style: "advice" }] : [])
  ],
  margin: [0, 0, 0, 24],
  unbreakable: true
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
      await ensurePdfMake();
      const doc = {
        pageSize: "A4",
        pageMargins: [48, 58, 48, 54],
        defaultStyle: { fontSize: 12, lineHeight: 1.35, color: "#39264a" },
        styles: {
          eyebrow: { fontSize: 10, bold: true, color: "#9a6b31", characterSpacing: 0.8, margin: [0, 0, 0, 6] },
          title: { fontSize: 26, bold: true, color: "#70421b", alignment: "center", margin: [0, 100, 0, 16] },
          code: { fontSize: 54, bold: true, color: "#70421b", alignment: "center", margin: [0, 8, 0, 22] },
          subtitle: { fontSize: 15, color: "#5b426b", alignment: "center", margin: [0, 0, 0, 34] },
          heading: { fontSize: 19, bold: true, color: "#70421b", margin: [0, 0, 0, 13] },
          subheading: { fontSize: 14, bold: true, color: "#70421b", margin: [0, 10, 0, 8] },
          advice: { fontSize: 11, italics: true, color: "#5b426b", margin: [0, 4, 0, 4] }
        },
        footer: (page, pages) => ({
          text: `Нумерология.online · ${page} / ${pages}`,
          alignment: "center",
          fontSize: 8,
          color: "#806a56",
          margin: [0, 14, 0, 0]
        }),
        content: [
          { text: "ЛИЧНЫЙ ДЕНЕЖНЫЙ КОД", style: "title" },
          { text: code, style: "code" },
          { text: `Расчёт по дате ${formatDate(birthDate)}`, style: "subtitle" },
          { text: "Ваш личный результат", style: "heading", pageBreak: "before" },
          ...sections.map(createSection)
        ]
      };

      window.pdfMake.createPdf(doc).download(`Код денег ${code}.pdf`);
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
