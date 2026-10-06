import { loadEnergies, monthNames } from "./year-content.js?v=3";  while (result > 9) result = String(result).split("").reduce((sum, digit) => sum + Number(digit), 0);
  return result;
};

const getPersonalLifeCode = (birthDate) => {
  if (!birthDate) return [];
  const day = birthDate.getUTCDate();
  const month = birthDate.getUTCMonth() + 1;
  const year = birthDate.getUTCFullYear();
  const lifeNumber = String(day).padStart(2, "0") + String(month).padStart(2, "0") + String(year);
  return [
    reduceNumber(day),
    reduceNumber(month),
    reduceNumber(year),
    reduceNumber([...lifeNumber].reduce((sum, digit) => sum + Number(digit), 0))
  ];
};

const getPdfKey = () => [birthInput.value, yearInput.value, document.querySelector("#months")?.innerText || ""].join("|");

const loadExternalScript = (source) => new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = source;
  script.async = true;
  script.onload = resolve;
  script.onerror = () => reject(new Error("Не удалось загрузить модуль PDF"));
  document.head.append(script);
});

const getPdfMake = () => {
  if (window.pdfMake) return Promise.resolve(window.pdfMake);
  if (!pdfMakeLoading) {
    pdfMakeLoading = loadExternalScript("https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/pdfmake.min.js")
      .then(() => loadExternalScript("https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/vfs_fonts.js"))
      .then(() => window.pdfMake);
  }
  return pdfMakeLoading;
};

const asParagraphs = (text, style = "paragraph") => text.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => ({ text: line, style }));

const pdfLinkEntry = (link, kicker, fallbackTitle, fallbackText) => ({
  kicker,
  title: link?.title || fallbackTitle,
  general: link?.general || fallbackText,
  sections: link ? [["Деньги", link.money], ["Работа и дело", link.work], ["Отношения", link.relationships], ["Здоровье и ресурс", link.health], ["Опасность", link.danger], ["Что очень важно сделать", link.do], ["Чего категорически не делать", link.dont], ["Главный совет", link.advice]] : []
});

const pdfMonthBlock = (monthName, entries) => ({
  // Keep the month name with its first words, but never lock a whole long
  // month into one block. The latter created title-only pages on mobile.
  stack: entries.flatMap((entry, entryIndex) => {
    const paragraphs = asParagraphs(entry.general || "");
    const firstParagraph = paragraphs.slice(0, 1);
    const remainingParagraphs = paragraphs.slice(1);
    const lead = [
      ...(entryIndex === 0 ? [{ text: monthName, style: "monthTitle" }] : []),
      ...(entry.kicker ? [{ text: entry.kicker, style: "monthKicker" }] : []),
      ...(entry.title ? [{ text: entry.title, style: "sectionTitle" }] : []),
      ...firstParagraph
    ];

    return [
      { stack: lead, unbreakable: (entry.general || "").length < 420 },
      ...remainingParagraphs,
      ...(entry.sections || []).map(([sectionTitle, sectionText]) => ({
        // Sections must be allowed to continue on the next page. Locking a
        // whole section here sent even short blocks to a new blank page.
        stack: [{ text: sectionTitle, style: "subsectionTitle" }, ...asParagraphs(sectionText || "")]
      }))
    ];
  })
});

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

let pdfTemplatesLoading;
const getPdfTemplates = () => {
  if (!pdfTemplatesLoading) {
    pdfTemplatesLoading = Promise.all([
      imageAsDataUrl("assets/year-report-cover.jpg"),
      imageAsDataUrl("assets/year-report-inner.jpg")
    ]).then(([cover, inner]) => ({ cover, inner }));
  }
  return pdfTemplatesLoading;
};

const buildPdfDocument = (templates) => {
  const reportTitle = document.querySelector("#report-title").textContent;
  const reportPeriod = document.querySelector("#report-period").textContent;
  const reportCopy = document.querySelector("#report-copy").textContent;
  const birthDate = parseBirthDate(birthInput.value);
  const reportYearValue = Number(yearInput.value);
  const age = birthDate ? reportYearValue - birthDate.getUTCFullYear() : "";
  const personalCode = getPersonalLifeCode(birthDate).join("   ");
  const phases = [...document.querySelectorAll("#year-transition .year-cycle-story")].flatMap((phase) => {
    const parts = [];
    phase.querySelectorAll(".phase-kicker").forEach((label, index) => {
      const date = phase.querySelectorAll(".phase-date")[index]?.textContent || "";
      const heading = phase.querySelectorAll("h3")[index]?.textContent || "";
      const body = [...phase.querySelectorAll(":scope > p")].filter((paragraph) => !paragraph.classList.contains("phase-date") && !paragraph.classList.contains("phase-kicker"))[index]?.textContent || "";
      parts.push(
        { text: `${date} · ${label.textContent}`.trim(), style: "phase" },
        { text: heading, style: "sectionTitle" },
        ...asParagraphs(body)
      );
    });
    const sensitiveTitle = phase.querySelector(".sensitive-period h4")?.textContent;
    const sensitiveText = phase.querySelector(".sensitive-period p")?.textContent;
    if (sensitiveTitle && sensitiveText) parts.push({ text: sensitiveTitle, style: "noteTitle" }, ...asParagraphs(sensitiveText));
    return parts;
  });
  const sensitive = document.querySelector("#birthday-note")?.innerText || "";
  const months = calculatedPdfMonths.length ? calculatedPdfMonths : [...document.querySelectorAll("#months details")].map((month) => {
    const title = month.querySelector("summary")?.innerText.replace(/\+/g, "").trim() || "";
    const content = month.querySelector(".month-content");
    const kicker = content?.querySelector(".month-kicker")?.textContent?.trim() || "";
    const heading = content?.querySelector("h3")?.textContent?.trim() || "";
    const intro = [...(content?.querySelectorAll(":scope > p") || [])]
      .filter((paragraph) => !paragraph.classList.contains("month-kicker") && !paragraph.classList.contains("draft-note"))
      .flatMap((paragraph) => asParagraphs(paragraph.textContent || ""));
    const sections = [...(content?.querySelectorAll(".link-sections section") || [])].flatMap((section) => {
      const sectionTitle = section.querySelector("h4")?.textContent?.trim() || "";
      const sectionText = section.querySelector("p")?.textContent || "";
      return [
        ...(sectionTitle ? [{ text: sectionTitle, style: "subsectionTitle" }] : []),
        ...asParagraphs(sectionText)
      ];
    });
    // A closed <details> hides its children from innerText in mobile browsers.
    // textContent keeps the monthly report available to the downloadable PDF.
    const fallback = !intro.length && !sections.length ? asParagraphs(content?.textContent || "") : [];

    return {
      stack: [
        { text: title, style: "monthTitle" },
        ...(kicker ? [{ text: kicker, style: "monthKicker" }] : []),
        ...(heading ? [{ text: heading, style: "sectionTitle" }] : []),
        ...intro,
        ...sections,
        ...fallback
      ]
    };
  });

  return {
    info: { title: `${reportTitle} - ${birthInput.value}` },
    pageSize: "A4",
    // Wide inner margins keep large type safely inside the decorative frame.
    pageMargins: [72, 92, 72, 108],
    images: { cover: templates.cover, inner: templates.inner },
    background: (page) => ({ image: page === 1 ? "cover" : "inner", width: 595.28, height: 841.89 }),
    defaultStyle: { font: "Roboto", fontSize: 24, color: "#142C43", lineHeight: 1.52 },
    styles: {
      coverKicker: { fontSize: 38, bold: true, color: "#1F3E5F", alignment: "center", lineHeight: 1.08 },
      coverCode: { fontSize: 24, color: "#9B7A3E", characterSpacing: 5, alignment: "center" },
      coverName: { fontSize: 18, bold: true, color: "#80642F", characterSpacing: 1.8, alignment: "center" },
      coverYear: { fontSize: 112, bold: true, color: "#1D3654", alignment: "center" },
      coverSubtitle: { fontSize: 35, bold: true, color: "#665332", alignment: "center", lineHeight: 1.1 },
      coverDetails: { fontSize: 24, bold: true, color: "#142C43", alignment: "center", lineHeight: 1.45 },
      innerKicker: { fontSize: 15, bold: true, color: "#8A6A32", characterSpacing: 1.25, alignment: "center", margin: [0, 0, 0, 16] },
      title: { fontSize: 36, bold: true, color: "#1E405F", alignment: "center", margin: [0, 0, 0, 18] },
      subtitle: { fontSize: 20, color: "#334B62", alignment: "center", margin: [0, 0, 0, 28] },
      phase: { fontSize: 15, bold: true, color: "#8A6A32", characterSpacing: 0.7, margin: [0, 28, 0, 12] },
      sectionTitle: { fontSize: 31, bold: true, color: "#1E405F", margin: [0, 0, 0, 18] },
      subsectionTitle: { fontSize: 25, bold: true, color: "#60431D", margin: [0, 30, 0, 11] },
      monthKicker: { fontSize: 15, bold: true, color: "#8A6A32", characterSpacing: 0.7, margin: [0, 0, 0, 13] },
      noteTitle: { fontSize: 22, bold: true, color: "#60431D", margin: [0, 28, 0, 10] },
      paragraph: { fontSize: 24, bold: true, margin: [0, 0, 0, 22] },
      monthTitle: { fontSize: 42, bold: true, color: "#1E405F", alignment: "center", margin: [0, 0, 0, 28] }
    },
    content: [
      {
        stack: [
          { text: "ПЕРСОНАЛЬНЫЙ ПРОГНОЗ", style: "coverKicker", margin: [0, 22, 0, 18] },
          { text: personalCode, style: "coverCode", margin: [0, 0, 0, 34] },
          { text: "НУМЕРОЛОГИЯ МОМЕНТА", style: "coverName", margin: [0, 0, 0, 12] },
          { text: String(reportYearValue), style: "coverYear", margin: [0, 0, 0, 24] },
          { text: `ЛИЧНАЯ КАРТА ГОДА ${reportYearValue}`, style: "coverSubtitle", margin: [0, 0, 0, 22] },
          { text: `Дата рождения: ${birthInput.value}\nВ ${reportYearValue} вам исполняется: ${age} лет`, style: "coverDetails", margin: [0, 0, 0, 12] }
        ],
        pageBreak: "after"
      },
      { text: "КАРТА ГОДА", style: "innerKicker" },
      { text: reportTitle, style: "title" },
      { text: `Дата рождения: ${birthInput.value} · Год разбора: ${yearInput.value}`, style: "subtitle" },
      { text: reportPeriod, style: "innerKicker" },
      { text: reportCopy, style: "subtitle" },
      ...phases,
      ...asParagraphs(sensitive),
      ...months
    ],
    footer: (page, pages) => page === 1 ? null : ({ text: `${page - 1} / ${pages - 1}`, alignment: "center", color: "#9C7A42", fontSize: 10, margin: [0, 18, 0, 0] })
  };
};

const preparePdf = () => {
  const pdfKey = getPdfKey();
  if (currentPdfUrl && preparedPdfKey === pdfKey) return Promise.resolve({ url: currentPdfUrl, filename: currentPdfFilename });
  if (pdfBuildLoading) return pdfBuildLoading;

  pdfBuildLoading = (async () => {
    const [pdfMake, templates] = await Promise.all([getPdfMake(), getPdfTemplates()]);
    const blob = await new Promise((resolve) => pdfMake.createPdf(buildPdfDocument(templates)).getBlob(resolve));
    if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
    currentPdfUrl = URL.createObjectURL(blob);
    currentPdfFilename = `${birthInput.value} ${yearInput.value} год.pdf`;
    preparedPdfKey = pdfKey;
    return { url: currentPdfUrl, filename: currentPdfFilename };
  })().finally(() => {
    pdfBuildLoading = null;
  });

  return pdfBuildLoading;
};

const warmPdfInBackground = () => {
  const warm = () => preparePdf().catch(() => {});
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(warm, { timeout: 1200 });
  } else {
    window.setTimeout(warm, 350);
  }
};

const setPdfPreviewLoading = (message) => {
  pdfPreviewPages.innerHTML = `<div class="pdf-preview-loading"><strong>${message}</strong><span>Подготавливаю точный макет для скачивания.</span></div>`;
};

const renderMobilePdfPreview = () => {
  const report = document.querySelector("#report");
  if (!report) return setPdfPreviewLoading("Сначала создайте расчёт");

  const preview = report.cloneNode(true);
  preview.removeAttribute("id");
  preview.classList.add("pdf-mobile-preview");
  preview.querySelectorAll("details").forEach((month) => { month.open = true; });
  preview.querySelectorAll(".draft-note").forEach((note) => note.remove());
  preview.querySelectorAll("#pdf-button, #pdf-button-top").forEach((button) => button.remove());
  pdfPreviewPages.replaceChildren(preview);
};

const openPdfPreview = async () => {
  pdfPreviewDialog.showModal();
  renderMobilePdfPreview();
  pdfDownloadButton.disabled = true;
  pdfDownloadButton.textContent = "Готовлю PDF...";
  try {
    await preparePdf();
  } catch (error) {
    // Предпросмотр остаётся доступен на сайте, даже если браузер не смог собрать файл.
  } finally {
    pdfDownloadButton.disabled = false;
    pdfDownloadButton.innerHTML = "Скачать PDF <span>↓</span>";
  }
};

const downloadPdf = async () => {
  const originalDownloadLabel = pdfDownloadButton.innerHTML;
  pdfDownloadButton.disabled = true;
  pdfDownloadButton.textContent = currentPdfUrl ? "Скачиваю PDF..." : "Готовлю PDF...";
  try {
    const { url, filename } = await preparePdf();
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    // iOS Safari may ignore `download` for a Blob URL and replace the current
    // tab with the PDF. Open it separately so closing the PDF returns to the
    // already calculated report and its date/year form.
    link.target = "_blank";
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
  } catch (error) {
    alert("PDF пока не удалось подготовить. Проверьте подключение к интернету и попробуйте ещё раз.");
  } finally {
    window.setTimeout(() => {
      pdfDownloadButton.disabled = false;
      pdfDownloadButton.innerHTML = originalDownloadLabel;
    }, 900);
  }
};

pdfButton.addEventListener("click", openPdfPreview);
pdfButtonTop.addEventListener("click", openPdfPreview);
pdfPreviewClose.addEventListener("click", () => pdfPreviewDialog.close());
pdfDownloadButton.addEventListener("click", downloadPdf);
pdfPreviewDialog.addEventListener("close", () => {
  pdfPreviewPages.innerHTML = "";
});
