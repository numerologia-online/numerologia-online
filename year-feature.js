import { loadEnergies, monthNames } from "./year-content.js?v=1";

const year = document.querySelector("#year");
const form = document.querySelector("#year-form");
const yearInput = document.querySelector("#report-year");
const birthInput = document.querySelector("#birth-date");
const report = document.querySelector("#report");
const calculationLoader = document.querySelector("#calculation-loader");
const loaderMessage = document.querySelector("#loader-message");
const submitButton = form.querySelector(".primary-button");
let reportRevealTimer;

const showCalculationLoading = () => {
  window.clearTimeout(reportRevealTimer);
  report.hidden = true;
  report.classList.remove("is-revealing", "is-visible");
  calculationLoader.hidden = false;
  calculationLoader.classList.remove("is-calculating");
  loaderMessage.textContent = "Собираю ваш личный год...";
  submitButton.disabled = true;
  calculationLoader.scrollIntoView({ behavior: "smooth", block: "center" });
};

const showCalculatedReport = () => {
  calculationLoader.classList.add("is-leaving");
  reportRevealTimer = window.setTimeout(() => {
    calculationLoader.hidden = true;
    calculationLoader.classList.remove("is-leaving");
    submitButton.disabled = false;
    report.hidden = false;
    report.classList.add("is-revealing");
    window.requestAnimationFrame(() => report.classList.add("is-visible"));
    report.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 180);
};

const showCalculationError = () => {
  calculationLoader.hidden = true;
  submitButton.disabled = false;
};

const showMonthProgress = async (monthName) => {
  loaderMessage.textContent = `Собираю ${monthName.toLowerCase()}...`;
  await new Promise((resolve) => window.setTimeout(resolve, 80));
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


export const openYear = () => {
  document.querySelector("#home").classList.remove("is-active");
  year.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
};

document.querySelector("#back-home").addEventListener("click", () => {
  year.classList.remove("is-active");
  document.querySelector("#home").classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
});

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
  showCalculationLoading();
  const energyBeforeBirthday = personalYear(birthDate, reportYearValue - 1);
  const energyAfterBirthday = personalYear(birthDate, reportYearValue);
  let energyContent;
  try {
    energyContent = await loadEnergies([energyBeforeBirthday, energyAfterBirthday]);
  } catch (error) {
    showCalculationError();
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
  calculatedPdfMonths = [];
  for (const [index, monthName] of monthNames.entries()) {
    await showMonthProgress(monthName);
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
      calculatedPdfMonths.push(pdfMonthBlock(monthName, [
        pdfLinkEntry(beforeFullLink, `До ${formatDate(birthdayInReportYear)} · связка ${energyBeforeBirthday} × ${beforeMonthEnergy}`, beforeMonth.title, beforeMonth.text),
        pdfLinkEntry(afterFullLink, `С ${formatDate(birthdayInReportYear)} · связка ${energyAfterBirthday} × ${afterMonthEnergy}`, afterMonth.title, afterMonth.text)
      ]));
    } else {
      item.innerHTML = `<summary><span>${monthName}</span><strong>${monthEnergy}</strong><i>+</i></summary><div class="month-content">${fullLink ? fullLinkMarkup(fullLink, monthYearEnergy, monthEnergy) : `<p class="month-kicker">Связка ${monthYearEnergy} × ${monthEnergy}</p><h3>${month.title}</h3><p>${month.text}</p><p class="draft-note">Это короткий черновик. Здесь появится отдельная авторская карточка для связки ${monthYearEnergy} × ${monthEnergy}: деньги, работа, отношения, ресурс, опасность и главный совет.</p>`}</div>`;
      calculatedPdfMonths.push(pdfMonthBlock(monthName, [
        pdfLinkEntry(fullLink, `Связка ${monthYearEnergy} × ${monthEnergy}`, month.title, month.text)
      ]));
    }
    monthContainer.append(item);
  }

  showCalculatedReport();
  warmPdfInBackground();
});

const pdfButton = document.querySelector("#pdf-button");
const pdfPreviewDialog = document.querySelector("#pdf-preview");
const pdfPreviewPages = document.querySelector("#pdf-preview-pages");
const pdfPreviewClose = document.querySelector("#pdf-preview-close");
const pdfDownloadButton = document.querySelector("#pdf-download-button");
let pdfMakeLoading;
let currentPdfUrl = null;
let currentPdfFilename = null;
let pdfBuildLoading = null;
let preparedPdfKey = null;
let calculatedPdfMonths = [];

const reduceNumber = (number) => {
  let result = Math.abs(Number(number) || 0);
  while (result > 9) result = String(result).split("").reduce((sum, digit) => sum + Number(digit), 0);
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
        stack: [{ text: sectionTitle, style: "subsectionTitle" }, ...asParagraphs(sectionText || "")],
        unbreakable: (sectionText || "").length < 800
      }))
    ];
  }),
  pageBreak: "before"
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
      imageAsDataUrl("year-report-cover.jpg"),
      imageAsDataUrl("year-report-inner.jpg")
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
      ],
      pageBreak: "before"
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
  preview.querySelectorAll("#pdf-button").forEach((button) => button.remove());
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
