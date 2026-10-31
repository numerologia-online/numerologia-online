import { appendPublicPdfOutro } from "./pdf-public-outro.js?v=1";

/**
 * PDF совместимости: только оформление и скачивание, без авторских текстов.
 * Все 13 глав подгружаются из тех же JSON, что и ответы на сайте.
 */
const loadScript = (src) => new Promise((resolve, reject) => {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    if (window.pdfMake) return resolve();
    existing.addEventListener("load", resolve, { once: true });
    existing.addEventListener("error", () => reject(new Error("Не удалось загрузить PDF-библиотеку")), { once: true });
    return;
  }
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.onload = resolve;
  script.onerror = () => { script.remove(); reject(new Error("Не удалось загрузить PDF-библиотеку")); };
  document.head.append(script);
});

let pdfMakePromise;
const getPdfMake = () => {
  if (window.pdfMake) return Promise.resolve(window.pdfMake);
  if (!pdfMakePromise) {
    pdfMakePromise = loadScript("https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/pdfmake.min.js")
      .then(() => loadScript("https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/vfs_fonts.js"))
      .then(() => {
        if (!window.pdfMake) throw new Error("PDF-библиотека недоступна");
        return window.pdfMake;
      })
      .catch((error) => { pdfMakePromise = null; throw error; });
  }
  return pdfMakePromise;
};

// Молочная бумага и тонкая золотая рамка, как в других персональных PDF.
const paper = `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
  <rect width="595" height="842" fill="#FCF9F3"/>
  <rect x="19" y="19" width="557" height="804" rx="8" fill="none" stroke="#BDA273" stroke-width=".85"/>
  <rect x="26" y="26" width="543" height="790" rx="6" fill="none" stroke="#E3D9C4" stroke-width=".35"/>
  <g opacity=".13" stroke="#BBA26D" fill="none" stroke-width=".75">
    <circle cx="77" cy="116" r="39"/><circle cx="77" cy="116" r="24"/>
    <path d="M77 62 V82 M77 150 V170 M23 116 H43 M111 116 H131"/>
    <circle cx="518" cy="713" r="38"/><path d="M518 675 L555 713 L518 751 L481 713Z"/>
  </g>
  <g fill="#BDA273" opacity=".28">
    <circle cx="297" cy="35" r="2"/><circle cx="297" cy="807" r="2"/>
    <circle cx="42" cy="42" r="2"/><circle cx="553" cy="42" r="2"/>
    <circle cx="42" cy="800" r="2"/><circle cx="553" cy="800" r="2"/>
  </g>
  <g font-family="Georgia,serif" text-anchor="middle" fill="#C4AF87" opacity=".11">
    <text x="512" y="150" font-size="82">9</text><text x="79" y="746" font-size="80">6</text>
  </g>
</svg>`;

const makeDocument = ({ topics, dateA, dateB, readings }) => {
  const chapters = [];
  topics.forEach((topic, index) => {
    const block = readings[index];
    chapters.push({
      text: `РАЗДЕЛ ${String(index + 1).padStart(2, "0")} ИЗ 13`,
      style: "eyebrow",
      ...(index > 0 ? { pageBreak: "before" } : {}),
      margin: [0, 12, 0, 13]
    });
    chapters.push({ text: topic.title, style: "chapter" });
    chapters.push({ text: block.lead, style: "lead" });
    String(block.text).split(/\n\s*\n/).filter(Boolean).forEach(paragraph => {
      chapters.push({ text: paragraph.trim(), style: "paragraph" });
    });
  });

  return {
    info: { title: `Совместимость ${dateA} и ${dateB}`, subject: "Совместимость двух судеб" },
    pageSize: "A4",
    pageMargins: [65, 69, 65, 74],
    background: () => ({ svg: paper }),
    defaultStyle: { font: "Roboto", fontSize: 17.5, color: "#33445A", lineHeight: 1.33 },
    styles: {
      coverKicker: { fontSize: 12, bold: true, color: "#AE8652", alignment: "center", characterSpacing: 2.2 },
      coverTitle: { fontSize: 45, bold: true, color: "#293951", alignment: "center", lineHeight: 1.06 },
      coverSubtitle: { fontSize: 20, color: "#8B7182", alignment: "center" },
      coverDate: { fontSize: 27, bold: true, color: "#293951", alignment: "center" },
      coverText: { fontSize: 18, color: "#566378", alignment: "center", lineHeight: 1.38 },
      eyebrow: { fontSize: 12, bold: true, color: "#A57D42", characterSpacing: 1.4 },
      chapter: { fontSize: 30, bold: true, color: "#293951", lineHeight: 1.13, margin: [0, 0, 0, 18] },
      lead: { fontSize: 19, bold: true, color: "#8E6D7D", lineHeight: 1.32, margin: [0, 0, 0, 20] },
      paragraph: { fontSize: 17.5, color: "#33445A", lineHeight: 1.33, margin: [0, 0, 0, 16] }
    },
    content: [
      { text: "НУМЕРОЛОГИЯ ОНЛАЙН", style: "coverKicker", margin: [0, 127, 0, 30] },
      { text: "Совместимость\nдвух судеб", style: "coverTitle", margin: [0, 0, 0, 23] },
      { text: "✦  ✧  ✦", style: "coverSubtitle", margin: [0, 0, 0, 40] },
      { text: `${dateA}  +  ${dateB}`, style: "coverDate", margin: [0, 0, 0, 34] },
      { text: "13 подробных ответов о вашей паре", style: "coverText", margin: [0, 0, 0, 20] },
      { text: "Что связывает вас, почему возникло притяжение и как лучше проживать ваш союз.", style: "coverText", margin: [10, 0, 10, 0], pageBreak: "after" },
      ...chapters
    ],
    footer: (page, pages) => page === 1 ? null : ({
      text: `${page - 1} / ${pages - 1}`,
      fontSize: 10,
      color: "#A58761",
      alignment: "center",
      margin: [0, 20, 0, 0]
    })
  };
};

export const createCompatibilityPdfController = ({ buttons, getBank }) => {
  let report = null;
  let prepared = null;
  let inProgress = null;
  let generation = 0;

  const updateButtons = (label, disabled = false) => {
    buttons.forEach(button => {
      button.disabled = disabled;
      button.textContent = label;
    });
  };

  const setReport = (next) => {
    generation++;
    if (prepared?.url) URL.revokeObjectURL(prepared.url);
    prepared = null;
    inProgress = null;
    report = next;
    updateButtons("Скачать PDF ↓");
  };

  const prepare = () => {
    if (!report) return Promise.reject(new Error("Сначала рассчитайте совместимость"));
    if (prepared) return Promise.resolve(prepared);
    if (inProgress) return inProgress;
    const token = generation;
    const current = report;
    inProgress = (async () => {
      // Никаких сокращений: PDF содержит все ответы, даже если на сайте карточки закрыты.
      const [pdfMake, readings] = await Promise.all([
        getPdfMake(),
        Promise.all(current.topics.map(async topic => {
          const bank = await getBank(topic.energy);
          const block = bank[topic.key];
          if (!block?.lead || !block?.text) throw new Error(`Отсутствует разбор: ${topic.title}`);
          return block;
        }))
      ]);
      const document = appendPublicPdfOutro(makeDocument({ ...current, readings }));
      const blob = await new Promise((resolve, reject) => {
        try { pdfMake.createPdf(document).getBlob(resolve); }
        catch (error) { reject(error); }
      });
      if (generation !== token) throw new Error("Даты изменились во время подготовки PDF");
      prepared = {
        url: URL.createObjectURL(blob),
        filename: `Совместимость ${current.dateA} и ${current.dateB}.pdf`
      };
      return prepared;
    })().finally(() => {
      if (generation === token) inProgress = null;
    });
    return inProgress;
  };

  const download = async () => {
    if (!report) return;
    updateButtons("Готовлю PDF…", true);
    try {
      const { url, filename } = await prepare();
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      // Safari на iPhone иногда открывает Blob PDF, а не скачивает: сохраняем страницу.
      anchor.target = "_blank";
      anchor.rel = "noopener";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      console.error("PDF совместимости:", error);
      alert("Не удалось подготовить PDF. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      updateButtons("Скачать PDF ↓");
    }
  };

  buttons.forEach(button => button.addEventListener("click", download));
  return { setReport };
};
