import { createMonthlyLinkSelector, parseEnergyText, monthNames } from "./year-content.js?v=4";
import { appendPublicPdfOutro } from "./pdf-public-outro.js?v=1";
import { isFreeYearMonth } from "./year-access.js?v=1";

const year = document.querySelector("#year");
const form = document.querySelector("#year-form");
const yearInput = document.querySelector("#report-year");
const birthInput = document.querySelector("#birth-date");
const report = document.querySelector("#report");
const calculationLoader = document.querySelector("#calculation-loader");
const loaderMessage = document.querySelector("#loader-message");
const loaderTrack = calculationLoader.querySelector(".loader-track");
const loaderProgress = document.querySelector("#loader-progress");
const submitButton = form.querySelector(".primary-button");
const yearPaywallDialog = document.querySelector("#year-paywall-dialog");
const purchasedYearRegion=document.createElement("section");
purchasedYearRegion.hidden=true;
purchasedYearRegion.setAttribute("aria-label","Оплаченный разбор года");
report.append(purchasedYearRegion);
let purchasedYear=null;
async function refreshPurchasedYear(){
  const born=birthInput.value.trim(),selectedYear=Number(yearInput.value);
  const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(born);
  if(!match||!Number.isInteger(selectedYear)||selectedYear<1900||selectedYear>2050)return;
  const item={product_code:"year_full",birth_date:match[3]+"-"+match[2]+"-"+match[1],year:selectedYear};
  const {recognizePurchasedReport}=await import("./store-entry.js?v=report-annual-20261109");
  const granted=await recognizePurchasedReport(item,purchasedYearRegion);
  if(born===birthInput.value.trim()&&selectedYear===Number(yearInput.value))purchasedYear=granted;
}
window.addEventListener("numi:wallet-updated",()=>{if(!report.hidden)void refreshPurchasedYear();});
const showYearPaywall = async () => {
  if(purchasedYear&&!purchasedYearRegion.hidden){
    purchasedYearRegion.scrollIntoView({behavior:"smooth",block:"start"});return;
  }
  try {
    const { openSharedOffer } = await import("./shared-offer.js?v=report-annual-20261109");
    await openSharedOffer({
      subject: {product_code:"year_full",birth_date:birthInput.value.split(".").reverse().join("-"),year:Number(yearInput.value)},
      product: "полный разбор года",
      title: "Откройте полный разбор года",
      oncePrice: 990,
      memberPrice: 490,
      clubMonthly: 490
    });
  } catch (error) {
    console.error("Окно покупки разбора года:", error);
    alert("Не удалось открыть варианты доступа. Проверьте интернет и попробуйте снова.");
  }
};
document.querySelector("#year-paywall-close")?.addEventListener("click", () => yearPaywallDialog.close());
document.querySelector(".year-paywall-back")?.addEventListener("click", () => yearPaywallDialog.close());
yearPaywallDialog.addEventListener("click", event => {
  if (event.target === yearPaywallDialog) yearPaywallDialog.close();
});
// Paid originals stay server-side. Only a signed Telegram owner may request them.
const YEAR_CONTENT_API = "/api/";
let verifiedYearOwner = false;
const hasVerifiedYearAccess = () => verifiedYearOwner;

const signedYearInitData = () => {
  const direct = window.Telegram?.WebApp?.initData;
  if (typeof direct === "string" && direct) return direct;
  const fragment = window.location.hash.replace(/^#/, "");
  if (!fragment.includes("tgWebAppData=")) return "";
  try { return new URLSearchParams(fragment).get("tgWebAppData") || ""; }
  catch (_) { return ""; }
};

const requestYearApi = async (route, body) => {
  const response = await fetch(YEAR_CONTENT_API + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(25000)
  });
  const data = await response.json();
  if (!response.ok || data?.ok !== true) throw new Error("Годовой расчёт временно недоступен");
  return data;
};

const verifyYearOwner = async (initData) => {
  if (!initData) return false;
  const result = await requestYearApi("numi-miniapp.php", { init_data: initData });
  return result.owner === true && Boolean(result.user?.id);
};

const loadYearForOwner = async (energies, variant, initData) => {
  const unique = [...new Set(energies)];
  const entries = await Promise.all(unique.map(async (energy) => {
    const path = "data/year/" + (variant === "odd" ? "odd/" : "") + "energy-" + energy + ".txt";
    const result = await requestYearApi("numi-paid-content.php", { init_data: initData, path });
    if (typeof result.content !== "string") throw new Error("Неверный формат закрытого текста года");
    return [energy, parseEnergyText(result.content, energy)];
  }));
  return Object.fromEntries(entries);
};

const loadYearForGuest = async (birthDate, reportYearValue) => {
  const birthDateIso = [
    birthDate.getUTCFullYear(),
    String(birthDate.getUTCMonth() + 1).padStart(2, "0"),
    String(birthDate.getUTCDate()).padStart(2, "0")
  ].join("-");
  const result = await requestYearApi("numi-year-preview.php", {
    birth_date: birthDateIso,
    year: reportYearValue,
    timezone: "Europe/Samara"
  });
  if (!result.primary || !result.alternate) throw new Error("Бесплатный просмотр года недоступен");
  return [result.primary, result.alternate];
};
let reportRevealTimer;

const showCalculationLoading = () => {
  if (currentPdfReport?.url) URL.revokeObjectURL(currentPdfReport.url);
  currentPdfReport = null;
  purchasedYear=null;
  purchasedYearRegion.hidden=true;
  purchasedYearRegion.dataset.numiReportKey="";
  window.clearTimeout(reportRevealTimer);
  report.hidden = true;
  report.classList.remove("is-revealing", "is-visible");
  calculationLoader.hidden = false;
  calculationLoader.classList.remove("is-leaving");
  loaderProgress.style.width = "0%";
  loaderTrack.setAttribute("aria-valuenow", "0");
  loaderMessage.textContent = "Считаю ваш январь";
  submitButton.disabled = true;
  calculationLoader.scrollIntoView({ behavior: "smooth", block: "center" });
};

const showCalculatedReport = () => {
  loaderProgress.style.width = "100%";
  loaderTrack.setAttribute("aria-valuenow", "100");
  loaderMessage.textContent = "Ваш расчёт года готов";
  calculationLoader.classList.add("is-leaving");
  reportRevealTimer = window.setTimeout(() => {
    calculationLoader.hidden = true;
    calculationLoader.classList.remove("is-leaving");
    submitButton.disabled = false;
    report.hidden = false;
    report.classList.add("is-revealing");
    window.requestAnimationFrame(() => report.classList.add("is-visible"));
    report.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 680);
};

const showCalculationError = () => {
  calculationLoader.hidden = true;
  submitButton.disabled = false;
};

const showMonthProgress = async (monthName, monthIndex) => {
  const progress = Math.round(((monthIndex + 1) / monthNames.length) * 100);
  loaderMessage.textContent = `Считаю ваш ${monthName.toLowerCase()}`;
  loaderProgress.style.width = `${progress}%`;
  loaderTrack.setAttribute("aria-valuenow", String(progress));
  await new Promise((resolve) => window.setTimeout(resolve, 85));
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
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#razbor-goda`);
  document.querySelector("#home").classList.remove("is-active");
  year.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

document.querySelector("#back-home").addEventListener("click", () => {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  year.classList.remove("is-active");
  document.querySelector("#home").classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
});

// Month forecasts behave like a single reading, not twelve open text stacks.
const yearMonths = document.querySelector("#months");
yearMonths?.addEventListener("toggle", (event) => {
  const opened = event.target;
  if (!(opened instanceof HTMLDetailsElement) || !opened.open ||
      !opened.matches("details.month-card") || opened.parentElement !== yearMonths) return;
  yearMonths.querySelectorAll(":scope > details.month-card[open]").forEach((other) => {
    if (other !== opened) other.open = false;
  });
}, true);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const birthLabel = birthInput.value;
  const birthDate = parseBirthDate(birthLabel);
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
  // Один набор текстов используется для чётных лет, второй — для нечётных.
  // Расчёт энергий при этом остаётся неизменным.
  const textVariant = reportYearValue % 2 === 0 ? "even" : "odd";
  const energyBeforeBirthday = personalYear(birthDate, reportYearValue - 1);
  const energyAfterBirthday = personalYear(birthDate, reportYearValue);
  let energyContent;
  let alternateEnergyContent;
  verifiedYearOwner = false;
  try {
    const initData = signedYearInitData();
    if (initData) {
      try { verifiedYearOwner = await verifyYearOwner(initData); }
      catch (_) { verifiedYearOwner = false; }
    }
    if (verifiedYearOwner) {
      try {
        [energyContent, alternateEnergyContent] = await Promise.all([
          loadYearForOwner([energyBeforeBirthday, energyAfterBirthday], textVariant, initData),
          loadYearForOwner([energyBeforeBirthday, energyAfterBirthday], textVariant === "even" ? "odd" : "even", initData)
        ]);
      } catch (_) {
        // Owner-only source is temporarily unavailable: show the safe free preview.
        verifiedYearOwner = false;
      }
    }
    if (!verifiedYearOwner) {
      [energyContent, alternateEnergyContent] = await loadYearForGuest(birthDate, reportYearValue);
    }
  } catch (error) {
    showCalculationError();
    yearInput.setCustomValidity("Не удалось получить расчёт года. Попробуйте ещё раз.");
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
  document.querySelector("#report-meta").textContent = `Дата рождения: ${birthLabel} · Год разбора: ${reportYearValue}`;
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
  const monthlyLinkFor = createMonthlyLinkSelector(energyContent, alternateEnergyContent);
  for (const [index, monthName] of monthNames.entries()) {
    await showMonthProgress(monthName, index);
    const calendarMonth = index + 1;
    const isBirthdayMonth = index === birthDate.getUTCMonth();
    const isBeforeBirthdayMonth = index < birthDate.getUTCMonth();
    const monthYearEnergy = isBeforeBirthdayMonth ? energyBeforeBirthday : energyAfterBirthday;
    const monthEnergy = personalMonth(monthYearEnergy, calendarMonth);
    const month = { title: `Энергия ${monthEnergy}`, text: "Авторская карточка этой связки ещё готовится." };
    const item = document.createElement("details");
    item.className = "month-card";
    if (!hasVerifiedYearAccess() && !isFreeYearMonth(reportYearValue, calendarMonth)) {
      item.classList.add("month-card--locked");
      const energyLabel = isBirthdayMonth
        ? personalMonth(energyBeforeBirthday, calendarMonth) + "→" + personalMonth(energyAfterBirthday, calendarMonth)
        : String(monthEnergy);
      item.innerHTML = `<summary><span>${monthName}</span><strong>${energyLabel}</strong><i aria-hidden="true">🔒</i></summary>
        <div class="month-content"><div class="year-month-lock">
          <p class="year-month-lock-title">🔒 Прогноз на ${monthName.toLowerCase()} закрыт</p>
          <p>Прошедшие месяцы доступны бесплатно. Чтобы узнать о текущем и будущих месяцах, откройте полный разбор года.</p>
          <button class="year-paywall-open" type="button">Открыть полный разбор года</button>
        </div></div>`;
      item.querySelector(".year-paywall-open").addEventListener("click", showYearPaywall);
      monthContainer.append(item);
      continue;
    }
    if (isBirthdayMonth) {
      const beforeMonthEnergy = personalMonth(energyBeforeBirthday, calendarMonth);
      const afterMonthEnergy = personalMonth(energyAfterBirthday, calendarMonth);
      const beforeMonth = { title: `Энергия ${beforeMonthEnergy}`, text: "Авторская карточка этой связки ещё готовится." };
      const afterMonth = { title: `Энергия ${afterMonthEnergy}`, text: "Авторская карточка этой связки ещё готовится." };
      const beforeFullLink = monthlyLinkFor(energyBeforeBirthday, beforeMonthEnergy);
      const afterFullLink = monthlyLinkFor(energyAfterBirthday, afterMonthEnergy);
      const beforeContent = beforeFullLink ? fullLinkMarkup(beforeFullLink, energyBeforeBirthday, beforeMonthEnergy) : `<p class="month-kicker">До ${formatDate(birthdayInReportYear)} · связка ${energyBeforeBirthday} × ${beforeMonthEnergy}</p><h3>${beforeMonth.title}</h3><p>${beforeMonth.text}</p>`;
      const afterContent = afterFullLink ? fullLinkMarkup(afterFullLink, energyAfterBirthday, afterMonthEnergy) : `<p class="month-kicker">С ${formatDate(birthdayInReportYear)} · связка ${energyAfterBirthday} × ${afterMonthEnergy}</p><h3>${afterMonth.title}</h3><p>${afterMonth.text}</p>`;
      item.innerHTML = `<summary><span><small>Переход</small>${monthName}</span><strong>${beforeMonthEnergy}→${afterMonthEnergy}</strong><i>+</i></summary><div class="month-content"><div class="month-period">${beforeContent}</div><div class="month-period">${afterContent}</div></div>`;
      calculatedPdfMonths.push(pdfMonthBlock(monthName, [
        pdfLinkEntry(beforeFullLink, `До ${formatDate(birthdayInReportYear)} · связка ${energyBeforeBirthday} × ${beforeMonthEnergy}`, beforeMonth.title, beforeMonth.text),
        pdfLinkEntry(afterFullLink, `С ${formatDate(birthdayInReportYear)} · связка ${energyAfterBirthday} × ${afterMonthEnergy}`, afterMonth.title, afterMonth.text)
      ]));
    } else {
      const fullLink = monthlyLinkFor(monthYearEnergy, monthEnergy);
      item.innerHTML = `<summary><span>${monthName}</span><strong>${monthEnergy}</strong><i>+</i></summary><div class="month-content">${fullLink ? fullLinkMarkup(fullLink, monthYearEnergy, monthEnergy) : `<p class="month-kicker">Связка ${monthYearEnergy} × ${monthEnergy}</p><h3>${month.title}</h3><p>${month.text}</p><p class="draft-note">Это короткий черновик. Здесь появится отдельная авторская карточка для связки ${monthYearEnergy} × ${monthEnergy}: деньги, работа, отношения, ресурс, опасность и главный совет.</p>`}</div>`;
      calculatedPdfMonths.push(pdfMonthBlock(monthName, [
        pdfLinkEntry(fullLink, `Связка ${monthYearEnergy} × ${monthEnergy}`, month.title, month.text)
      ]));
    }
    monthContainer.append(item);
  }

  const canDownloadPdf = hasVerifiedYearAccess();
  const pdfLabel = canDownloadPdf ? "Скачать полный PDF" : "🔒 Скачать полный PDF";
  pdfButton.textContent = pdfLabel;
  pdfButtonTop.textContent = pdfLabel;
  if (canDownloadPdf) {
    currentPdfReport = { birthDate, birthLabel, reportYearValue, file: null, url: null, loading: null };
    warmPdfInBackground(currentPdfReport);
  }
  showCalculatedReport();
  void refreshPurchasedYear();
});

const pdfButton = document.querySelector("#pdf-button");
const pdfButtonTop = document.querySelector("#pdf-button-top");
const pdfPreviewDialog = document.querySelector("#pdf-preview");
const pdfPreviewPages = document.querySelector("#pdf-preview-pages");
const pdfPreviewClose = document.querySelector("#pdf-preview-close");
const pdfDownloadButton = document.querySelector("#pdf-download-button");
const pdfShareButton = document.querySelector("#pdf-share-button");
let pdfMakeLoading;
let pdfViewerLoading;
let activePdfPreview;
let currentPdfReport = null;
let calculatedPdfMonths = [];

const loadExternalScript = (source) => new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = source;
  script.async = true;
  script.onload = resolve;
  script.onerror = () => reject(new Error("Не удалось загрузить модуль PDF"));
  document.head.append(script);
});

const getPdfMake = () => {
  if (!pdfMakeLoading) {
    const loadLibrary = window.pdfMake
      ? Promise.resolve()
      : loadExternalScript("https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/pdfmake.min.js");
    pdfMakeLoading = loadLibrary
      .then(() => loadExternalScript("https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/vfs_fonts.js"))
      .then(() => window.pdfMake)
      .catch((error) => {
        pdfMakeLoading = null;
        throw error;
      });
  }
  return pdfMakeLoading;
};

const asParagraphs = (text, style = "paragraph") => text.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => ({ text: line, style }));

// These numeric combinations are internal calculation keys, not customer PDF headings.
const clientPdfLabel = (value = "") => String(value)
  .replace(/(?:\s*·\s*)?связка\s+\d+\s*[×xх-]\s*\d+/giu, "")
  .trim();

const pdfLinkEntry = (link, kicker, fallbackTitle, fallbackText) => ({
  kicker: clientPdfLabel(kicker),
  title: link?.title || fallbackTitle,
  general: link?.general || fallbackText.replace("этой связки", "этого месяца"),
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

const yearReportFrame = () => ({ svg: `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
  <defs>
    <radialGradient id="yearPaper" cx="42%" cy="20%" r="94%">
      <stop offset="0%" stop-color="#FFFDF8"/>
      <stop offset="64%" stop-color="#FBFAF5"/>
      <stop offset="100%" stop-color="#F4EFE4"/>
    </radialGradient>
  </defs>
  <rect width="595" height="842" fill="url(#yearPaper)"/>
  <rect x="19" y="19" width="557" height="804" rx="8" fill="none" stroke="#C5A15D" stroke-width=".72"/>
  <rect x="26" y="26" width="543" height="790" rx="7" fill="none" stroke="#DED0AD" stroke-width=".28"/>

  <g fill="none" stroke="#6D8296" stroke-width=".35" opacity=".065">
    <rect x="380" y="585" width="145" height="112" rx="5"/>
    <path d="M400.7 585 V697 M421.4 585 V697 M442.1 585 V697 M462.8 585 V697 M483.5 585 V697 M504.2 585 V697"/>
    <path d="M380 607.4 H525 M380 629.8 H525 M380 652.2 H525 M380 674.6 H525"/>
  </g>
  <g fill="#6D8296" opacity=".055" font-family="Arial, sans-serif" font-size="9" text-anchor="middle">
    <text x="390" y="579">ПН</text><text x="411" y="579">ВТ</text><text x="432" y="579">СР</text>
    <text x="453" y="579">ЧТ</text><text x="474" y="579">ПТ</text><text x="495" y="579">СБ</text><text x="516" y="579">ВС</text>
  </g>

  <g fill="none" stroke="#C5A15D" opacity=".20">
    <circle cx="82" cy="112" r="42" stroke-width=".5"/>
    <circle cx="82" cy="112" r="29" stroke-width=".3" stroke-dasharray="2 5"/>
    <path d="M82 60 V72 M82 152 V164 M30 112 H42 M122 112 H134" stroke-width=".45"/>
    <path d="M47 77 L55 85 M117 77 L109 85 M47 147 L55 139 M117 147 L109 139" stroke-width=".32"/>
  </g>
  <g fill="#C5A15D" opacity=".26">
    <circle cx="82" cy="112" r="2.3"/>
    <circle cx="82" cy="60" r="1.2"/><circle cx="134" cy="112" r="1.2"/>
    <circle cx="82" cy="164" r="1.2"/><circle cx="30" cy="112" r="1.2"/>
  </g>

  <g fill="none" stroke="#C5A15D" stroke-width=".52" opacity=".34">
    <path d="M35 52 H132"/><path d="M463 52 H560"/>
    <path d="M35 790 H132"/><path d="M463 790 H560"/>
  </g>
  <g fill="#C5A15D" opacity=".42">
    <circle cx="297.5" cy="34" r="1.7"/><circle cx="289" cy="34" r=".8"/><circle cx="306" cy="34" r=".8"/>
    <circle cx="297.5" cy="808" r="1.7"/><circle cx="289" cy="808" r=".8"/><circle cx="306" cy="808" r=".8"/>
  </g>
</svg>` });

const yearReportCover = ({ year, birthDate, age }) => {
  const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeYear = escape(year);
  const safeBirth = escape(birthDate);
  const safeAge = escape(age);

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="451" height="620" viewBox="0 0 451 620">
      <g text-anchor="middle">
        <text x="225.5" y="72" font-family="Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="3.5" fill="#98691F">ПЕРСОНАЛЬНЫЙ</text>

        <text x="227" y="138" font-family="Georgia, 'Times New Roman', serif" font-size="51" fill="#D7C8AB" opacity=".45">РАЗБОР ГОДА</text>
        <text x="225.5" y="136" font-family="Georgia, 'Times New Roman', serif" font-size="51" fill="#19334E">РАЗБОР ГОДА</text>

        <path d="M115 167 H196 M255 167 H336" stroke="#C5A15D" stroke-width=".7"/>
        <path d="M225.5 160 L229 167 L225.5 174 L222 167Z" fill="#C5A15D"/>

        <g transform="translate(225.5 318)">
          <circle r="121" fill="none" stroke="#C5A15D" stroke-width=".55" opacity=".48"/>
          <circle r="101" fill="none" stroke="#B9C7D0" stroke-width=".35" stroke-dasharray="2 5" opacity=".64"/>
          <g fill="#A57B33" opacity=".70">
            <circle cx="0" cy="-121" r="2.2"/><circle cx="60.5" cy="-104.8" r="2.2"/>
            <circle cx="104.8" cy="-60.5" r="2.2"/><circle cx="121" cy="0" r="2.2"/>
            <circle cx="104.8" cy="60.5" r="2.2"/><circle cx="60.5" cy="104.8" r="2.2"/>
            <circle cx="0" cy="121" r="2.2"/><circle cx="-60.5" cy="104.8" r="2.2"/>
            <circle cx="-104.8" cy="60.5" r="2.2"/><circle cx="-121" cy="0" r="2.2"/>
            <circle cx="-104.8" cy="-60.5" r="2.2"/><circle cx="-60.5" cy="-104.8" r="2.2"/>
          </g>
          <g font-family="Arial, sans-serif" font-size="9.5" fill="#647A8D" text-anchor="middle" opacity=".86">
            <text x="0" y="-135">ЯНВ</text><text x="72" y="-117">ФЕВ</text>
            <text x="120" y="-69">МАР</text><text x="138" y="3">АПР</text>
            <text x="120" y="75">МАЙ</text><text x="72" y="123">ИЮН</text>
            <text x="0" y="140">ИЮЛ</text><text x="-72" y="123">АВГ</text>
            <text x="-120" y="75">СЕН</text><text x="-138" y="3">ОКТ</text>
            <text x="-120" y="-69">НОЯ</text><text x="-72" y="-117">ДЕК</text>
          </g>
          <text x="2" y="23" font-family="Arial, sans-serif" font-size="77" font-weight="700" fill="#D8C49B" opacity=".44">${safeYear}</text>
          <text x="0" y="20" font-family="Arial, sans-serif" font-size="77" font-weight="700" fill="#19334E">${safeYear}</text>
        </g>

        <text x="225.5" y="492" font-family="Georgia, 'Times New Roman', serif" font-size="23" fill="#5B472A">ваша личная карта времени</text>
        <path d="M104 520 H347" stroke="#C5A15D" stroke-width=".55" opacity=".68"/>

        <text x="225.5" y="556" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="#203E58">Дата рождения · ${safeBirth}</text>
        <text x="225.5" y="586" font-family="Arial, sans-serif" font-size="17" fill="#6B5430">В ${safeYear} году вам исполняется ${safeAge} лет</text>
      </g>
    </svg>`
  };
};

const buildPdfDocument = ({ birthDate, birthLabel, reportYearValue }) => {
  const reportTitle = document.querySelector("#report-title").textContent;
  const reportPeriod = document.querySelector("#report-period").textContent;
  const reportCopy = document.querySelector("#report-copy").textContent;
  const age = reportYearValue - birthDate.getUTCFullYear();
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
    const kicker = clientPdfLabel(content?.querySelector(".month-kicker")?.textContent || "");
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
    const fallback = !intro.length && !sections.length ? asParagraphs(clientPdfLabel(content?.textContent || "").replace("этой связки", "этого месяца")) : [];

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
    info: { title: `${reportTitle} - ${birthLabel}` },
    pageSize: "A4",
    // Wide inner margins keep large type safely inside the decorative frame.
    pageMargins: [68, 88, 68, 104],
    background: () => yearReportFrame(),
    defaultStyle: { font: "Roboto", fontSize: 22.5, color: "#26394A", lineHeight: 1.43 },
    styles: {
      coverKicker: { fontSize: 13, bold: true, color: "#A57B33", characterSpacing: 2.4, alignment: "center" },
      coverCode: { fontSize: 20, color: "#A57B33", characterSpacing: 4, alignment: "center" },
      coverName: { fontSize: 17, bold: true, color: "#6E5B3B", characterSpacing: 1.5, alignment: "center" },
      coverYear: { fontSize: 92, bold: true, color: "#19334E", alignment: "center" },
      coverSubtitle: { fontSize: 26, color: "#6E5B3B", alignment: "center", lineHeight: 1.14 },
      coverDetails: { fontSize: 18, color: "#29445C", alignment: "center", lineHeight: 1.42 },
      innerKicker: { fontSize: 13.5, bold: true, color: "#98691F", characterSpacing: 1.35, alignment: "center", margin: [0, 0, 0, 15] },
      title: { fontSize: 34, bold: true, color: "#142F49", alignment: "center", margin: [0, 0, 0, 16] },
      subtitle: { fontSize: 20.5, color: "#465D70", alignment: "center", lineHeight: 1.42, margin: [8, 0, 8, 26] },
      phase: { fontSize: 13.5, bold: true, color: "#98691F", characterSpacing: 0.7, margin: [0, 26, 0, 10] },
      sectionTitle: { fontSize: 29, bold: true, color: "#142F49", margin: [0, 6, 0, 14] },
      subsectionTitle: { fontSize: 24, bold: true, color: "#3F6174", margin: [0, 21, 0, 9] },
      monthKicker: { fontSize: 13.5, bold: true, color: "#98691F", characterSpacing: 0.7, margin: [0, 0, 0, 11] },
      noteTitle: { fontSize: 21.5, bold: true, color: "#6C522A", margin: [0, 25, 0, 9] },
      paragraph: { fontSize: 22.5, color: "#26394A", lineHeight: 1.43, margin: [0, 0, 0, 19] },
      monthTitle: { fontSize: 40, bold: true, color: "#142F49", alignment: "center", margin: [0, 12, 0, 9] }
    },
    content: [
      { ...yearReportCover({ year: reportYearValue, birthDate: birthLabel, age }), pageBreak: "after" },
      { text: reportPeriod, style: "innerKicker" },
      { text: reportCopy, style: "subtitle" },
      ...phases,
      ...asParagraphs(sensitive),
      ...months
    ],
    footer: (page, pages) => page === 1 ? null : ({ text: `${page - 1} / ${pages - 1}`, alignment: "center", color: "#9C7A42", fontSize: 10, margin: [0, 18, 0, 0] })
  };
};

const preparePdf = async (pdfReport) => {
  if (!hasVerifiedYearAccess() || !pdfReport || pdfReport !== currentPdfReport) {
    throw new Error("Полный PDF недоступен для этого расчёта.");
  }
  if (pdfReport.file) return pdfReport.file;

  if (!pdfReport.loading) {
    pdfReport.loading = (async () => {
      const pdfMake = await getPdfMake();
      if (pdfReport !== currentPdfReport) throw new Error("Расчёт изменился.");
      const definition = appendPublicPdfOutro(buildPdfDocument(pdfReport));
      const blob = await new Promise((resolve) => pdfMake.createPdf(definition).getBlob(resolve));
      if (pdfReport !== currentPdfReport) throw new Error("Расчёт изменился.");
      const filename = `${pdfReport.birthLabel} ${pdfReport.reportYearValue} год.pdf`;
      pdfReport.file = new File([blob], filename, { type: "application/pdf" });
      return pdfReport.file;
    })().finally(() => {
      pdfReport.loading = null;
    });
  }
  return pdfReport.loading;
};

const warmPdfInBackground = (pdfReport) => {
  const warm = () => preparePdf(pdfReport).catch(() => {});
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(warm, { timeout: 1200 });
  } else {
    window.setTimeout(warm, 350);
  }
};

const setPdfPreviewMessage = (message) => {
  const status = document.createElement("p");
  status.className = "pdf-preview-loading";
  status.setAttribute("role", "status");
  status.textContent = message;
  pdfPreviewPages.replaceChildren(status);
};

const getPdfViewer = () => {
  if (!pdfViewerLoading) {
    const build = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/legacy/build/";
    pdfViewerLoading = import(build + "pdf.min.mjs").then((viewer) => {
      viewer.GlobalWorkerOptions.workerSrc = build + "pdf.worker.min.mjs";
      return viewer;
    }).catch((error) => {
      pdfViewerLoading = null;
      throw error;
    });
  }
  return pdfViewerLoading;
};

const closePdfPreview = () => {
  const preview = activePdfPreview;
  activePdfPreview = null;
  if (preview) {
    preview.observer?.disconnect();
    preview.visible.clear();
    preview.canvasTask?.cancel();
    preview.loadingTask?.destroy().catch(() => {});
  }
  pdfPreviewPages.replaceChildren();
};

const renderPdfPage = async (preview, container) => {
  const number = Number(container.dataset.page);
  const page = await preview.document.getPage(number);
  if (preview !== activePdfPreview || !preview.visible.has(container)) {
    page.cleanup();
    return;
  }
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(container.clientWidth * Math.min(window.devicePixelRatio || 1, 2), 1200) / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `Страница ${number} из ${preview.document.numPages}`);
  const task = page.render({ canvas, viewport });
  preview.canvasTask = task;
  try {
    await task.promise;
    if (preview === activePdfPreview && preview.visible.has(container)) {
      container.replaceChildren(canvas);
      preview.rendered.add(container);
    }
  } finally {
    preview.canvasTask = null;
    page.cleanup();
  }
};

const renderVisiblePdfPages = async (preview) => {
  if (preview.rendering) return;
  preview.rendering = true;
  try {
    while (preview === activePdfPreview) {
      const next = [...preview.visible].find((page) => !preview.rendered.has(page));
      if (!next) break;
      try {
        await renderPdfPage(preview, next);
      } catch (error) {
        if (preview !== activePdfPreview) return;
        console.error("Не удалось показать страницу PDF:", error);
        next.textContent = "Не удалось показать страницу.";
        preview.rendered.add(next);
      }
    }
  } finally {
    preview.rendering = false;
  }
};

const renderPdfPreview = async (preview, file, viewer) => {
  const data = new Uint8Array(await file.arrayBuffer());
  if (preview !== activePdfPreview) return;
  preview.loadingTask = viewer.getDocument({
    data,
    isEvalSupported: false,
    useWorkerFetch: false,
    enableXfa: false
  });
  preview.document = await preview.loadingTask.promise;
  if (preview !== activePdfPreview) return;
  const firstPage = await preview.document.getPage(1);
  if (preview !== activePdfPreview) return;
  const size = firstPage.getViewport({ scale: 1 });
  const pages = Array.from({ length: preview.document.numPages }, (_, index) => {
    const element = document.createElement("div");
    element.className = "pdf-preview-sheet";
    element.dataset.page = index + 1;
    element.style.aspectRatio = `${size.width} / ${size.height}`;
    return element;
  });
  pdfPreviewPages.replaceChildren(...pages);
  pdfPreviewPages.scrollTop = 0;
  preview.observer = new IntersectionObserver((entries) => {
    if (preview !== activePdfPreview) return;
    for (const entry of entries) {
      const page = entry.target;
      if (entry.isIntersecting) {
        preview.visible.add(page);
      } else {
        preview.visible.delete(page);
        if (preview.rendered.delete(page)) page.replaceChildren();
      }
    }
    void renderVisiblePdfPages(preview);
  }, { root: pdfPreviewPages, rootMargin: "240px 0px" });
  pages.forEach((page) => preview.observer.observe(page));
};

const openPdfPreview = async () => {
  if (!hasVerifiedYearAccess() || !currentPdfReport) return showYearPaywall();
  if (pdfPreviewDialog.open) return;
  closePdfPreview();
  const preview = { visible: new Set(), rendered: new Set() };
  activePdfPreview = preview;
  const pdfReport = currentPdfReport;
  pdfPreviewDialog.showModal();
  setPdfPreviewMessage("Готовлю PDF…");
  if (pdfShareButton) {
    pdfShareButton.hidden = true;
    pdfShareButton.disabled = true;
  }
  pdfDownloadButton.disabled = true;
  pdfDownloadButton.hidden = false;
  pdfDownloadButton.textContent = "Скачать PDF";
  const viewerReady = getPdfViewer().catch(() => null);
  try {
    const file = await preparePdf(pdfReport);
    if (preview !== activePdfPreview || !pdfPreviewDialog.open) return;
    const canShare = Boolean(pdfShareButton) && typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    if (canShare) {
      pdfShareButton.hidden = false;
      pdfShareButton.disabled = false;
    }
    pdfDownloadButton.hidden = canShare && Boolean(signedYearInitData());
    pdfDownloadButton.disabled = false;
    setPdfPreviewMessage("Открываю страницы PDF…");
    const viewer = await viewerReady;
    if (preview !== activePdfPreview || !pdfPreviewDialog.open) return;
    if (!viewer) throw new Error("Модуль просмотра PDF недоступен.");
    await renderPdfPreview(preview, file, viewer);
  } catch (error) {
    if (preview !== activePdfPreview || !pdfPreviewDialog.open) return;
    console.error("Не удалось открыть PDF:", error);
    if (pdfReport.file) {
      setPdfPreviewMessage("Не удалось показать страницы. Готовый PDF можно сохранить или отправить кнопкой внизу.");
    } else {
      setPdfPreviewMessage("Не удалось подготовить PDF. Попробуйте ещё раз.");
      pdfDownloadButton.textContent = "Повторить";
      pdfDownloadButton.disabled = false;
    }
  }
};

const sharePdf = async () => {
  if (!hasVerifiedYearAccess()) return showYearPaywall();
  const file = currentPdfReport?.file;
  if (!file || pdfShareButton.disabled) return;
  pdfShareButton.disabled = true;
  try {
    // The File is ready before the tap so the iOS share sheet receives a user gesture.
    await navigator.share({ files: [file] });
  } catch (error) {
    if (error.name !== "AbortError") {
      pdfDownloadButton.hidden = false;
      alert("Не удалось открыть меню отправки. Можно нажать «Скачать PDF».");
    }
  } finally {
    pdfShareButton.disabled = false;
  }
};

const downloadPdf = () => {
  if (!hasVerifiedYearAccess() || !currentPdfReport) return showYearPaywall();
  const pdfReport = currentPdfReport;
  if (!pdfReport.file) {
    pdfPreviewDialog.close();
    return openPdfPreview();
  }
  pdfReport.url ??= URL.createObjectURL(pdfReport.file);
  const link = document.createElement("a");
  link.href = pdfReport.url;
  link.download = pdfReport.file.name;
  document.body.append(link);
  link.click();
  link.remove();
};

pdfButton.addEventListener("click", openPdfPreview);
pdfButtonTop.addEventListener("click", openPdfPreview);
pdfPreviewClose.addEventListener("click", () => pdfPreviewDialog.close());
pdfDownloadButton.addEventListener("click", downloadPdf);
pdfShareButton?.addEventListener("click", sharePdf);
pdfPreviewDialog.addEventListener("close", () => {
  if (!pdfPreviewDialog.open) closePdfPreview();
});
