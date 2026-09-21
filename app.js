import { loadEnergies, monthNames } from "./year-content.js?v=1";

const home = document.querySelector("#home");
const year = document.querySelector("#year");
const form = document.querySelector("#year-form");
const yearInput = document.querySelector("#report-year");
const birthInput = document.querySelector("#birth-date");
const report = document.querySelector("#report");
const calculationLoader = document.querySelector("#calculation-loader");
const loaderMessage = document.querySelector("#loader-message");
const submitButton = form.querySelector(".primary-button");
const dialog = document.querySelector("#coming-soon");
let loadingTimers = [];
let loadingTimeout;
let typingTimer;
let typingVersion = 0;
let reportRevealTimer;

const loadingSteps = [
  { at: 0, message: "Соединяю месяцы в вашу личную историю." },
  { at: 3200, message: "Смотрю любовь, отношения, деньги и ресурс." },
  { at: 6500, message: "Ваш разбор почти готов." }
];

const setLoadingStep = (step, isFirstStep = false) => {
  const version = ++typingVersion;
  window.clearTimeout(typingTimer);
  loaderMessage.classList.add("is-fading");
  typingTimer = window.setTimeout(() => {
    if (version !== typingVersion) return;
    loaderMessage.textContent = "";
    loaderMessage.classList.remove("is-fading");
    let letter = 0;
    const typeNextLetter = () => {
      if (version !== typingVersion) return;
      loaderMessage.textContent = step.message.slice(0, letter);
      letter += 1;
      if (letter <= step.message.length) typingTimer = window.setTimeout(typeNextLetter, 38);
    };
    typeNextLetter();
  }, isFirstStep ? 90 : 320);
};

const showCalculationLoading = () => {
  loadingTimers.forEach((timer) => window.clearTimeout(timer));
  loadingTimers = [];
  window.clearTimeout(loadingTimeout);
  window.clearTimeout(typingTimer);
  typingVersion += 1;
  window.clearTimeout(reportRevealTimer);
  report.hidden = true;
  report.classList.remove("is-revealing", "is-visible");
  calculationLoader.hidden = false;
  calculationLoader.classList.remove("is-calculating");
  setLoadingStep(loadingSteps[0], true);
  submitButton.disabled = true;
  calculationLoader.scrollIntoView({ behavior: "smooth", block: "center" });

  loadingTimers = loadingSteps.slice(1).map((step) => window.setTimeout(() => setLoadingStep(step), step.at));

  loadingTimeout = window.setTimeout(() => {
    loadingTimers.forEach((timer) => window.clearTimeout(timer));
    loadingTimers = [];
    window.clearTimeout(typingTimer);
    typingVersion += 1;
    calculationLoader.classList.remove("is-calculating");
    calculationLoader.classList.add("is-leaving");
    reportRevealTimer = window.setTimeout(() => {
      calculationLoader.hidden = true;
      calculationLoader.classList.remove("is-leaving");
      submitButton.disabled = false;
      report.hidden = false;
      report.classList.add("is-revealing");
      window.requestAnimationFrame(() => report.classList.add("is-visible"));
      report.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 700);
  }, 10000);
};

const reduce = (value) => {
  let number = Math.abs(value);
  while (number > 9) number = String(number).split("").reduce((sum, digit) => sum + Number(digit), 0);
  return number || 9;
};

const personalYear = (date, reportYear) => reduce(date.getUTCDate() + date.getUTCMonth() + 1 + String(reportYear).split("").reduce((sum, digit) => sum + Number(digit), 0));
const personalMonth = (yearEnergy, calendarMonth) => reduce(yearEnergy + calendarMonth);

const formatDate = (date) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
const formatFullDate = (date) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date);
const parseBirthDate = (value) => {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, yearValue] = match;
  const date = new Date(Date.UTC(Number(yearValue), Number(month) - 1, Number(day)));
  return date.getUTCDate() === Number(day) && date.getUTCMonth() === Number(month) - 1 && date.getUTCFullYear() === Number(yearValue) ? date : null;
};
const fullLinkMarkup = (link, yearEnergy, monthEnergy) => `<p class="month-kicker">Связка ${yearEnergy} × ${monthEnergy}</p><h3>${link.title}</h3><p>${link.general}</p><div class="link-sections"><section><h4>Деньги</h4><p>${link.money}</p></section><section><h4>Работа и дело</h4><p>${link.work}</p></section><section><h4>Отношения</h4><p>${link.relationships}</p></section><section><h4>Здоровье и ресурс</h4><p>${link.health}</p></section><section><h4>Опасность</h4><p>${link.danger}</p></section><section><h4>Что очень важно сделать</h4><p>${link.do}</p></section><section><h4>Чего категорически не делать</h4><p>${link.dont}</p></section><section><h4>Главный совет</h4><p>${link.advice}</p></section></div>`;
const formatBirthDateInput = () => {
  const cursor = birthInput.selectionStart ?? 0;
  const digitsBeforeCursor = birthInput.value.slice(0, cursor).replace(/\D/g, "").length;
  const digits = birthInput.value.replace(/\D/g, "").slice(0, 8);
  let formatted = digits.slice(0, 2);
  if (digits.length > 2) formatted += `.${digits.slice(2, 4)}`;
  if (digits.length > 4) formatted += `.${digits.slice(4)}`;
  birthInput.value = formatted;

  let seenDigits = 0;
  let nextCursor = 0;
  while (nextCursor < formatted.length && seenDigits < digitsBeforeCursor) {
    if (/\d/.test(formatted[nextCursor])) seenDigits += 1;
    nextCursor += 1;
  }
  if ((seenDigits === 2 || seenDigits === 4) && formatted[nextCursor] === ".") nextCursor += 1;
  birthInput.setSelectionRange(nextCursor, nextCursor);
};

birthInput.addEventListener("input", () => {
  formatBirthDateInput();
  birthInput.setCustomValidity("");
});
yearInput.addEventListener("input", () => yearInput.setCustomValidity(""));

document.querySelectorAll("[data-open-year]").forEach((button) => button.addEventListener("click", () => {
  home.classList.remove("is-active");
  year.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
}));

document.querySelector("#back-home").addEventListener("click", () => {
  year.classList.remove("is-active");
  home.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
});

document.querySelectorAll("[data-coming-soon]").forEach((button) => button.addEventListener("click", () => dialog.showModal()));
document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const birthDate = parseBirthDate(birthInput.value);
  const reportYearValue = Number(yearInput.value);
  if (!birthDate) {
    birthInput.setCustomValidity("Введите настоящую дату в формате ДД.ММ.ГГГГ");
    birthInput.reportValidity();
    return;
  }
  if (!Number.isInteger(reportYearValue) || reportYearValue < 1900 || reportYearValue > 2050) {
    yearInput.setCustomValidity("Введите год от 1900 до 2050");
    yearInput.reportValidity();
    return;
  }
  const energyBeforeBirthday = personalYear(birthDate, reportYearValue - 1);
  const energyAfterBirthday = personalYear(birthDate, reportYearValue);
  let energyContent;
  try {
    energyContent = await loadEnergies([energyBeforeBirthday, energyAfterBirthday]);
  } catch (error) {
    submitButton.disabled = false;
    yearInput.setCustomValidity("Не удалось открыть тексты года. Обновите страницу и попробуйте ещё раз.");
    yearInput.reportValidity();
    return;
  }
  const storyBeforeBirthday = energyContent[energyBeforeBirthday]?.year ?? null;
  const storyAfterBirthday = energyContent[energyAfterBirthday]?.year ?? null;
  const themeBeforeBirthday = storyBeforeBirthday ?? { title: `Личный год ${energyBeforeBirthday}`, text: "Авторское описание этого периода ещё готовится." };
  const themeAfterBirthday = storyAfterBirthday ?? { title: `Личный год ${energyAfterBirthday}`, text: "Авторское описание этого периода ещё готовится." };
  const birthdayInReportYear = new Date(Date.UTC(reportYearValue, birthDate.getUTCMonth(), birthDate.getUTCDate()));
  const firstDayOfReportYear = new Date(Date.UTC(reportYearValue, 0, 1));
  const dayBeforeBirthday = new Date(birthdayInReportYear.getTime() - 86400000);
  const hasPeriodBeforeBirthday = birthdayInReportYear.getTime() > firstDayOfReportYear.getTime();
  const monthContainer = document.querySelector("#months");

  document.querySelector("#report-period").textContent = `Переход личного года · ${formatDate(birthdayInReportYear)}`;
  document.querySelector("#report-title").textContent = `Ваш ${reportYearValue} год`;
  document.querySelector("#report-meta").textContent = `Дата рождения: ${birthInput.value} · Год разбора: ${reportYearValue}`;
  document.querySelector("#report-copy").textContent = "Год состоит из двух периодов, которые соединяются в один личный цикл.";
  const sensitivePeriodStart = new Date(Date.UTC(reportYearValue, birthDate.getUTCMonth(), birthDate.getUTCDate() - 30));
  document.querySelector("#year-transition").innerHTML = storyBeforeBirthday && storyAfterBirthday ? `
    <article class="year-cycle-story">
      <p class="phase-date">С 1 января по ${formatFullDate(dayBeforeBirthday)}</p>
      <p class="phase-kicker">До дня рождения</p>
      <h3>${storyBeforeBirthday.title}</h3>
      <p>${storyBeforeBirthday.text}</p>
      <div class="cycle-divider" aria-hidden="true">✦</div>
      <p class="phase-date">С ${formatFullDate(birthdayInReportYear)}</p>
      <p class="phase-kicker">После дня рождения</p>
      <h3>${storyAfterBirthday.title}</h3>
      <p>${storyAfterBirthday.text}</p>
      <div class="sensitive-period"><h4>Самый чувствительный период</h4><p>Начинается примерно с ${formatFullDate(sensitivePeriodStart)} В это время привычный ритм уже может перестать работать, а новый ещё только складывается. Наблюдайте, что постепенно завершается и какая тема всё настойчивее просит вашего внимания.</p></div>
    </article>` : `
    <article class="year-phase year-phase-before">
      <p class="phase-date">${hasPeriodBeforeBirthday ? `С 1 января по ${formatFullDate(dayBeforeBirthday)}` : "До дня рождения отдельного периода нет"}</p>
      <p class="phase-kicker">До дня рождения</p>
      <p class="phase-energy">Личный год <strong>${energyBeforeBirthday}</strong></p>
      <h3>${themeBeforeBirthday.title}</h3>
      <p>${themeBeforeBirthday.text}</p>
    </article>
    <article class="year-phase year-phase-after">
      <p class="phase-date">С ${formatFullDate(birthdayInReportYear)}</p>
      <p class="phase-kicker">После дня рождения</p>
      <p class="phase-energy">Личный год <strong>${energyAfterBirthday}</strong></p>
      <h3>${themeAfterBirthday.title}</h3>
      <p>${themeAfterBirthday.text}</p>
    </article>`;
  const birthdayNote = document.querySelector("#birthday-note");
  birthdayNote.hidden = Boolean(storyBeforeBirthday && storyAfterBirthday);
  birthdayNote.textContent = `Личный год меняется точно в день рождения - ${formatFullDate(birthdayInReportYear)}.`;

  monthContainer.innerHTML = "";
  monthNames.forEach((monthName, index) => {
    const calendarMonth = index + 1;
    const isBirthdayMonth = index === birthDate.getUTCMonth();
    const isBeforeBirthdayMonth = index < birthDate.getUTCMonth();
    const monthYearEnergy = isBeforeBirthdayMonth ? energyBeforeBirthday : energyAfterBirthday;
    const monthEnergy = personalMonth(monthYearEnergy, calendarMonth);
    const month = { title: `Энергия ${monthEnergy}`, text: "Авторская карточка этой связки ещё готовится." };
    const fullLink = energyContent[monthYearEnergy]?.links[monthEnergy] ?? null;
    const item = document.createElement("details");
    item.className = "month-card";
    if (isBirthdayMonth) {
      const beforeMonthEnergy = personalMonth(energyBeforeBirthday, calendarMonth);
      const afterMonthEnergy = personalMonth(energyAfterBirthday, calendarMonth);
      const beforeMonth = { title: `Энергия ${beforeMonthEnergy}`, text: "Авторская карточка этой связки ещё готовится." };
      const afterMonth = { title: `Энергия ${afterMonthEnergy}`, text: "Авторская карточка этой связки ещё готовится." };
      const beforeFullLink = energyContent[energyBeforeBirthday]?.links[beforeMonthEnergy] ?? null;
      const afterFullLink = energyContent[energyAfterBirthday]?.links[afterMonthEnergy] ?? null;
      const beforeContent = beforeFullLink ? fullLinkMarkup(beforeFullLink, energyBeforeBirthday, beforeMonthEnergy) : `<p class="month-kicker">До ${formatDate(birthdayInReportYear)} · связка ${energyBeforeBirthday} × ${beforeMonthEnergy}</p><h3>${beforeMonth.title}</h3><p>${beforeMonth.text}</p>`;
      const afterContent = afterFullLink ? fullLinkMarkup(afterFullLink, energyAfterBirthday, afterMonthEnergy) : `<p class="month-kicker">С ${formatDate(birthdayInReportYear)} · связка ${energyAfterBirthday} × ${afterMonthEnergy}</p><h3>${afterMonth.title}</h3><p>${afterMonth.text}</p>`;
      item.innerHTML = `<summary><span><small>Переход</small>${monthName}</span><strong>${beforeMonthEnergy}→${afterMonthEnergy}</strong><i>+</i></summary><div class="month-content"><div class="month-period">${beforeContent}</div><div class="month-period">${afterContent}</div></div>`;
    } else {
      item.innerHTML = `<summary><span>${monthName}</span><strong>${monthEnergy}</strong><i>+</i></summary><div class="month-content">${fullLink ? fullLinkMarkup(fullLink, monthYearEnergy, monthEnergy) : `<p class="month-kicker">Связка ${monthYearEnergy} × ${monthEnergy}</p><h3>${month.title}</h3><p>${month.text}</p><p class="draft-note">Это короткий черновик. Здесь появится отдельная авторская карточка для связки ${monthYearEnergy} × ${monthEnergy}: деньги, работа, отношения, ресурс, опасность и главный совет.</p>`}</div>`;
    }
    monthContainer.append(item);
  });

  showCalculationLoading();
});

const pdfButton = document.querySelector("#pdf-button");
const pdfPreviewDialog = document.querySelector("#pdf-preview");
const pdfPreviewPages = document.querySelector("#pdf-preview-pages");
const pdfPreviewClose = document.querySelector("#pdf-preview-close");
const pdfDownloadButton = document.querySelector("#pdf-download-button");
let pdfMakeLoading;
let currentPdfUrl = null;
let currentPdfFilename = null;

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);

const createPreviewPage = (content, type = "inner") => `<article class="pdf-live-page pdf-live-page--${type}"><div class="pdf-live-page-content">${content}</div></article>`;

const buildPdfPreview = () => {
  const birthDate = parseBirthDate(birthInput.value);
  const reportYearValue = Number(yearInput.value);
  const age = birthDate ? reportYearValue - birthDate.getUTCFullYear() : "";
  const reportTitle = escapeHtml(document.querySelector("#report-title").textContent);
  const reportPeriod = escapeHtml(document.querySelector("#report-period").textContent);
  const reportCopy = escapeHtml(document.querySelector("#report-copy").textContent);
  const cover = createPreviewPage(`
    <p class="pdf-cover-kicker">ПЕРСОНАЛЬНЫЙ ПРОГНОЗ</p>
    <p class="pdf-cover-code">9&nbsp;&nbsp;9&nbsp;&nbsp;6&nbsp;&nbsp;6</p>
    <h2>НУМЕРОЛОГИЯ<br />МОМЕНТА</h2>
    <p class="pdf-cover-year">${reportYearValue}</p>
    <p class="pdf-cover-subtitle">Карта года ${reportYearValue}</p>
    <p class="pdf-cover-details">Дата рождения: ${escapeHtml(birthInput.value)}<br />В ${reportYearValue} вам исполняется: ${age} лет</p>
  `, "cover");
  const opening = createPreviewPage(`
    <p class="pdf-inner-kicker">КАРТА ГОДА</p>
    <h2 class="pdf-inner-title">${reportTitle}</h2>
    <p class="pdf-inner-meta">Дата рождения: ${escapeHtml(birthInput.value)} · Год разбора: ${reportYearValue}</p>
    <p class="pdf-inner-kicker pdf-inner-kicker--period">${reportPeriod}</p>
    <p class="pdf-inner-copy">${reportCopy}</p>
  `);
  const phases = createPreviewPage(`<p class="pdf-inner-kicker">ЛИЧНЫЙ ЦИКЛ</p>${document.querySelector("#year-transition").innerHTML}`);
  const months = [...document.querySelectorAll("#months details")].map((month) => {
    const title = escapeHtml(month.querySelector("summary")?.innerText.replace(/\+/g, "").trim() || "");
    const content = month.querySelector(".month-content")?.innerHTML || "";
    return createPreviewPage(`<p class="pdf-inner-kicker">МЕСЯЦ ГОДА</p><h2 class="pdf-month-title">${title}</h2><div class="pdf-month-copy">${content}</div>`);
  });
  return [cover, opening, phases, ...months].join("");
};

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
      imageAsDataUrl("year-report-cover.png"),
      imageAsDataUrl("year-report-inner.png")
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
  const months = [...document.querySelectorAll("#months details")].flatMap((month) => {
    const title = month.querySelector("summary")?.innerText.replace(/\+/g, "").trim() || "";
    const content = month.querySelector(".month-content")?.innerText || "";
    return [{ text: title, style: "monthTitle", pageBreak: "before" }, ...asParagraphs(content)];
  });

  return {
    info: { title: `${reportTitle} - ${birthInput.value}` },
    pageSize: "A4",
    pageMargins: [66, 82, 66, 70],
    images: { cover: templates.cover, inner: templates.inner },
    background: (page) => ({ image: page === 1 ? "cover" : "inner", width: 595.28, height: 841.89 }),
    defaultStyle: { font: "Roboto", fontSize: 10.4, color: "#24384F", lineHeight: 1.42 },
    styles: {
      coverKicker: { fontSize: 10, bold: true, color: "#80642F", characterSpacing: 1.45, alignment: "center" },
      coverCode: { fontSize: 15, color: "#9B7A3E", characterSpacing: 5, alignment: "center" },
      coverName: { fontSize: 21, bold: true, color: "#1F3E5F", alignment: "center", lineHeight: 1.1 },
      coverYear: { fontSize: 72, bold: true, color: "#1D3654", alignment: "center" },
      coverSubtitle: { fontSize: 15, bold: true, color: "#665332", alignment: "center" },
      coverDetails: { fontSize: 12, bold: true, color: "#24384F", alignment: "center", lineHeight: 1.5 },
      innerKicker: { fontSize: 9, bold: true, color: "#8A6A32", characterSpacing: 1.25, alignment: "center", margin: [0, 0, 0, 9] },
      title: { fontSize: 27, bold: true, color: "#1E405F", alignment: "center", margin: [0, 0, 0, 8] },
      subtitle: { fontSize: 11.5, color: "#53677B", alignment: "center", margin: [0, 0, 0, 16] },
      phase: { fontSize: 8.8, bold: true, color: "#8A6A32", characterSpacing: 0.7, margin: [0, 16, 0, 5] },
      sectionTitle: { fontSize: 18, bold: true, color: "#1E405F", margin: [0, 0, 0, 8] },
      noteTitle: { fontSize: 12, bold: true, color: "#715431", margin: [0, 14, 0, 5] },
      paragraph: { margin: [0, 0, 0, 9] },
      monthTitle: { fontSize: 20, bold: true, color: "#1E405F", alignment: "center", margin: [0, 0, 0, 14] }
    },
    content: [
      { text: "ПЕРСОНАЛЬНЫЙ ПРОГНОЗ", style: "coverKicker", absolutePosition: { x: 82, y: 92 }, width: 431 },
      { text: "9   9   6   6", style: "coverCode", absolutePosition: { x: 82, y: 132 }, width: 431 },
      { text: "НУМЕРОЛОГИЯ\nМОМЕНТА", style: "coverName", absolutePosition: { x: 82, y: 236 }, width: 431 },
      { text: String(reportYearValue), style: "coverYear", absolutePosition: { x: 82, y: 338 }, width: 431 },
      { text: `Карта года ${reportYearValue}`, style: "coverSubtitle", absolutePosition: { x: 82, y: 520 }, width: 431 },
      { text: `Дата рождения: ${birthInput.value}\nВ ${reportYearValue} вам исполняется: ${age} лет`, style: "coverDetails", absolutePosition: { x: 82, y: 654 }, width: 431, pageBreak: "after" },
      { text: "КАРТА ГОДА", style: "innerKicker" },
      { text: reportTitle, style: "title" },
      { text: `Дата рождения: ${birthInput.value} · Год разбора: ${yearInput.value}`, style: "subtitle" },
      { text: reportPeriod, style: "innerKicker" },
      { text: reportCopy, style: "subtitle" },
      ...phases,
      ...asParagraphs(sensitive),
      ...months
    ],
    footer: (page, pages) => page === 1 ? null : ({ text: `${page - 1} / ${pages - 1}`, alignment: "center", color: "#9C7A42", fontSize: 8, margin: [0, 14, 0, 0] })
  };
};

const openPdfPreview = () => {
  pdfPreviewPages.innerHTML = buildPdfPreview();
  pdfPreviewDialog.showModal();
  pdfPreviewPages.scrollTop = 0;
};

const downloadPdf = async () => {
  const originalDownloadLabel = pdfDownloadButton.innerHTML;
  pdfDownloadButton.disabled = true;
  pdfDownloadButton.textContent = "Готовлю PDF...";
  try {
    const [pdfMake, templates] = await Promise.all([getPdfMake(), getPdfTemplates()]);
    const filename = `${birthInput.value} ${yearInput.value} год`;
    const blob = await new Promise((resolve) => pdfMake.createPdf(buildPdfDocument(templates)).getBlob(resolve));
    if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
    currentPdfUrl = URL.createObjectURL(blob);
    currentPdfFilename = `${filename}.pdf`;
    const link = document.createElement("a");
    link.href = currentPdfUrl;
    link.download = currentPdfFilename;
    link.click();
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
pdfPreviewClose.addEventListener("click", () => pdfPreviewDialog.close());
pdfDownloadButton.addEventListener("click", downloadPdf);
pdfPreviewDialog.addEventListener("close", () => {
  pdfPreviewPages.innerHTML = "";
});
