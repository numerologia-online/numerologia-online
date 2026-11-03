import { parseBirthDate } from "./numerology-core.js?v=1";
import { getPersonalMonthLink } from "./personal-month-links.js?v=1";

// Авторская шкала 1–22: значения выше 22 приводятся повторным вычитанием 22.
// Не менять на сумму цифр: это другая методика и она исключает энергии 1 и 2.
const reduce22 = (value) => {
  let n = Math.abs(Math.trunc(Number(value) || 0));
  while (n > 22) n -= 22;
  return n || 22;
};

// Авторская формула выбора из 682 готовых текстов.
// Личные год, месяц и день рассчитываются в цикле 1–9, без смешения со шкалой 22 энергий.
// Период для выбора текста определяется календарным годом; месячные прогнозы не меняем.
const sumYearDigits = (year) => String(year).split("").reduce((sum, digit) => sum + Number(digit), 0);
const reduce9 = (value) => {
  let n = Math.abs(Math.trunc(Number(value) || 0));
  while (n > 9) n = String(n).split("").reduce((sum, digit) => sum + Number(digit), 0);
  return n || 9;
};
const lifePathNumber = ({ day, month, year }) => {
  let n = sumYearDigits(day) + sumYearDigits(month) + sumYearDigits(year);
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n).split("").reduce((sum, digit) => sum + Number(digit), 0);
  }
  return n;
};
const reduce31 = (value) => {
  let n = Math.abs(Math.trunc(Number(value) || 0));
  while (n > 31) n -= 31;
  return n || 31;
};
const personalDay = ({ day, month, year }, date = new Date()) => {
  const today = date.getDate();
  const currentMonth = date.getMonth() + 1;
  const currentYear = date.getFullYear();
  const personalYear = reduce9(day + month + sumYearDigits(currentYear));
  const personalMonth = reduce9(personalYear + currentMonth);
  const personalDayNumber = reduce9(personalMonth + today);
  const universalDay = reduce9(today + currentMonth + sumYearDigits(currentYear));
  const lifePath = lifePathNumber({ day, month, year });
  const energy = reduce22(personalDayNumber + personalMonth + universalDay + day + currentMonth);
  const personalNumber = reduce31(lifePath + day + today + sumYearDigits(year));
  return { energy, personalNumber };
};

// В старых банках энергии 1 ключи вида "1-1", в остальных — "1".
// Вторая цифра новой связки — персональная позиция, а не календарное число.
const findDayEntry = (entries, energy, personalNumber) =>
  entries?.[String(personalNumber)] ?? entries?.[`${energy}-${personalNumber}`];

const loadPersonalDay = async (birth, date = new Date()) => {
  const { energy, personalNumber } = personalDay(birth, date);
  const calendarDay = date.getDate();
  try {
    const response = await fetch(`./data/day/general/general-day-${String(energy).padStart(2, "0")}.json?v=8`);
    if (!response.ok) throw new Error("personal day bank unavailable");
    const bank = await response.json();
    const entry = findDayEntry(bank.entries, energy, personalNumber);
    let practical = null;
    try {
      const practicalResponse = await fetch(`./data/day/practical/practical-day-${String(energy).padStart(2, "0")}.json?v=4`);
      if (practicalResponse.ok) practical = await practicalResponse.json();
    } catch {}
    const advice = findDayEntry(practical?.entries, energy, personalNumber) || {};
    if (entry?.text) return { energy, personalNumber, calendarDay, text: entry.text, todayNeed: advice.todayNeed || [], todayAvoid: advice.todayAvoid || [] };
  } catch {}
  return {
    energy,
    personalNumber,
    calendarDay,
    text: "Не удалось загрузить текст дня. Обновите страницу и попробуйте ещё раз.",
    todayNeed: [],
    todayAvoid: [],
    loadError: true
  };
};

const esc = (value = "") => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const paragraphs = (items = []) => items.filter(Boolean).map((text) => `<p>${esc(text)}</p>`).join("");
const bullets = (items = []) => items.filter(Boolean).map((text) => `<li>${esc(text)}</li>`).join("");
const todayLabel = () => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
const monthTitle = (date) => new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);

// The assembled daily reading is used for user-initiated sharing.
const DAY_SITE_URL = "https://numerologia-online.github.io/numerologia-online/?view=day";
const DAY_BOT_URL = "https://t.me/Numerologiaonline_bot";
const formatDayMessage = (dateOfBirth, item) => {
  const parts = [
    "🔮 Личный расчёт дня",
    "📅 " + todayLabel(),
    "Дата рождения: " + dateOfBirth,
    "",
    item.text.trim()
  ];
  if (item.todayNeed?.length) parts.push("", "✅ Сегодня нужно:", ...item.todayNeed.map(text => "• " + text));
  if (item.todayAvoid?.length) parts.push("", "⛔ Сегодня нельзя:", ...item.todayAvoid.map(text => "• " + text));
  parts.push("", "✨ Нумерология Онлайн", "🌐 Сайт: " + DAY_SITE_URL, "🤖 Бот: " + DAY_BOT_URL);
  return parts.join("\n");
};
const addDayShareButtons = (result, report) => {
  const controls = document.createElement("section");
  controls.className = "personal-day-share";
  controls.setAttribute("aria-label", "Сохранить и поделиться прогнозом");
  controls.innerHTML = '<p class="personal-day-share-title">Хочешь получать прогноз каждый день? ❤️</p>'
    + '<a class="personal-day-share-subscribe" href="' + DAY_BOT_URL
    + '" target="_blank" rel="noopener noreferrer" aria-label="Подписаться на ежедневный бесплатный прогноз в Telegram-боте">'
    + '<span class="personal-day-subscribe-icon" aria-hidden="true">✈</span>'
    + '<span>Подпишись на ежедневный бесплатный прогноз в телеграм-боте</span></a>'
    + '<button type="button" class="personal-day-share-send">💌 Поделиться с подругой</button>';
  result.append(controls);
  const share = controls.querySelector(".personal-day-share-send");
  share.addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Мой личный расчёт дня", text: report });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    const shareLink = "https://t.me/share/url?url=" + encodeURIComponent(DAY_SITE_URL)
      + "&text=" + encodeURIComponent(report);
    if (typeof window.Telegram?.WebApp?.openTelegramLink === "function") {
      window.Telegram.WebApp.openTelegramLink(shareLink);
    } else {
      window.location.assign(shareLink);
    }
  });
};

const animateScroll = (node, targetTop, duration = 980) => {
  const startTop = node.scrollTop;
  const distance = targetTop - startTop;
  const startedAt = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 4);
    node.scrollTop = startTop + distance * eased;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
const calendarInfo = (energy, personalNumber) => {
  const link = getPersonalMonthLink(energy, personalNumber);
  return link ? { ...link, label: link.group } : { status: "neutral", group: "", label: "" };
};
const monthMarkedDays = (birth, date = new Date()) => {
  const total = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const selected = new Map();
  for (let day = 1; day <= total; day += 1) {
    const { energy, personalNumber } = personalDay(birth, new Date(date.getFullYear(), date.getMonth(), day));
    const info = calendarInfo(energy, personalNumber);
    // Окрашиваем только заранее отмеченные сильные связки; остальные дни серые.
    if (info.status !== "neutral") selected.set(day, { day, energy, info });
  }
  return selected;
};
// Важные числа месяца: календарь и значения отмеченных дат.
// Полный прогноз месяца остаётся в отдельном разделе "Разбор года".
// Preview-only until the monthly subscription is implemented.
// Do not place a real personalised calendar or its date lists in the public DOM.
const monthCalendar = (_birth, date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const total = new Date(year, month + 1, 0).getDate();
  const first = new Date(year, month, 1).getDay();
  const offset = (first + 6) % 7;
  // Illustrative colours, NOT real personalised predictions.
  const sampleColors = ["good", "neutral", "chance", "risk", "neutral", "good", "chance", "neutral", "risk", "good"];
  const teaserCells = [];
  for (let i = 0; i < offset; i += 1) teaserCells.push('<span class="personal-month-teaser-empty"></span>');
  for (let day = 1; day <= total; day += 1) {
    const locked = day > 10;
    const style = locked ? "locked" : sampleColors[day - 1];
    const warning = day === 4;
    teaserCells.push(`<span class="personal-month-teaser-day personal-month-teaser-${style}${warning ? " personal-month-teaser-warning" : ""}" aria-label="${day}${locked ? ", закрыто" : ""}">${day}${warning ? '<b aria-hidden="true">!</b>' : ""}</span>`);
  }
  return `<section class="personal-month-preview personal-month-important" aria-label="Важные числа месяца по подписке">
    <div class="personal-month-teaser">
      <p class="personal-month-teaser-kicker">ТВОЙ КАЛЕНДАРЬ · ПО ПОДПИСКЕ</p>
      <h3 class="personal-month-teaser-title">Важные числа месяца <span class="personal-month-teaser-padlock" aria-hidden="true">🔒</span></h3>
      <p class="personal-month-teaser-subtitle">Когда не упустить шанс и где лучше быть осторожнее</p>
      <div class="personal-month-teaser-board" aria-label="Пример закрытого календаря">
        <div class="personal-month-teaser-weekdays">${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d => `<span>${d}</span>`).join("")}</div>
        <div class="personal-month-teaser-grid">${teaserCells.join("")}</div>
        <div class="personal-month-teaser-warning-note"><span aria-hidden="true">!</span><strong>ВАЖНЫЕ ДАТЫ</strong><small>Узнайте заранее, когда стоит быть внимательнее с покупками и когда могут появиться новые возможности.</small></div>
      </div>
      <p class="personal-month-teaser-footnote">Пример оформления. Личные даты доступны по подписке.</p>
      <p class="personal-month-teaser-copy">Ваш календарь лучших дней, важных шансов и дат риска на ${esc(monthTitle(date))}.</p>
    </div>
    <button type="button" class="personal-month-open" aria-expanded="false" aria-controls="personal-month-subscription">Подписка 490 ₽/мес <span aria-hidden="true">↓</span></button>
    <div class="personal-month-subscription numi-day-club-offer" id="personal-month-subscription" hidden>
      <div class="numi-tariff-lead">
        <div class="numi-tariff-once">
          <span class="numi-tariff-card-icon" aria-hidden="true">◇</span>
          <strong>Разовые покупки</strong>
          <small>Выбирайте только то, что интересно</small>
          <span class="numi-tariff-card-foot">Без подписки</span>
        </div>
        <div class="numi-tariff-club">
          <span class="numi-tariff-club-badge">♕ ВЫГОДНЕЕ</span>
          <strong class="numi-tariff-club-title">Клуб</strong>
          <strong class="numi-tariff-club-price">490 ₽ <em>/ мес.</em></strong>
          <small>Скидки, бесплатные вопросы и закрытые материалы</small>
        </div>
      </div>
      <p class="numi-tariff-caption"><strong>Что вы получаете в клубе каждый месяц</strong><span>Ваш календарь, клубные материалы и особые цены</span></p>
      <div class="numi-tariff-table" role="table" aria-label="Преимущества клуба и цены без подписки">
        <div class="numi-tariff-head" role="row">
          <span role="columnheader">Раздел</span><span role="columnheader">Без подписки</span><span role="columnheader">По подписке</span>
        </div>
        <div class="numi-tariff-row" role="row"><strong role="cell">Полный разбор года + PDF</strong><span role="cell">990 ₽</span><span role="cell" class="numi-club-discount">−50%</span></div>
        <div class="numi-tariff-row" role="row"><strong role="cell">Полный разбор жизни</strong><span role="cell">990 ₽</span><span role="cell" class="numi-club-discount">−50%</span></div>
        <div class="numi-tariff-row" role="row"><strong role="cell">Совместимость</strong><span role="cell">990 ₽</span><span role="cell" class="numi-club-discount">−50%</span></div>
        <div class="numi-tariff-row" role="row"><strong role="cell">Детский разбор + PDF</strong><span role="cell">990 ₽</span><span role="cell" class="numi-club-discount">490 ₽</span></div>
        <div class="numi-tariff-row" role="row"><strong role="cell">Вопросы «Да или нет?»</strong><span role="cell">19 ₽</span><span role="cell" class="numi-club-free">БЕСПЛАТНО!</span></div>
        <div class="numi-tariff-row numi-tariff-row--feature" role="row">
          <span role="cell"><strong>Мужчина или Red Flag</strong><small>Стоимость одного вопроса</small></span>
          <span role="cell">20 / 39 / 79 ₽</span>
          <span role="cell" class="numi-club-special">10 / 19 / 39 ₽</span>
        </div>
        <div class="numi-tariff-row" role="row"><strong role="cell">Нумерология момента</strong><span role="cell">50 ₽</span><span role="cell" class="numi-club-special">25 ₽</span></div>
        <div class="numi-tariff-row" role="row"><strong role="cell">Календарь важных чисел</strong><span role="cell" class="numi-tariff-unavailable">—</span><span role="cell" class="numi-club-included">✓<small>Включено</small></span></div>
        <div class="numi-tariff-row" role="row"><strong role="cell">Личный разбор месяца</strong><span role="cell" class="numi-tariff-unavailable">—</span><span role="cell" class="numi-club-included">✓<small>Включено</small></span></div>
        <div class="numi-tariff-row" role="row"><strong role="cell">Глава текущего месяца в разборе года</strong><span role="cell" class="numi-tariff-unavailable">—</span><span role="cell" class="numi-club-included">✓<small>Включено</small></span></div>
        <div class="numi-tariff-row" role="row"><strong role="cell">Денежные ритуалы</strong><span role="cell" class="numi-tariff-unavailable">—</span><span role="cell" class="numi-club-included">✓<small>Включено</small></span></div>
      </div>
      <p class="numi-tariff-footer">490 ₽ в месяц — стоимость клубной подписки. Большие разборы и PDF, где предусмотрены, приобретаются отдельно по клубной цене.</p>
    </div>
  </section>`;
};
/* Personal day club uses the same tariff cards, gold accents and bright green column as My Tariffs. */
const dayClubTariffCss = \`
.personal-day-result .numi-day-club-offer{margin-top:13px;padding:13px 12px 15px;border:1px solid #d4bc75;border-radius:20px;background:#fffdfa;color:#143629;box-shadow:0 8px 24px rgba(100,75,28,.09);text-align:left}
.numi-day-club-offer,.numi-day-club-offer *{box-sizing:border-box}
.numi-day-club-offer .numi-tariff-lead{display:grid;grid-template-columns:1fr 1fr;gap:9px;align-items:stretch;margin:3px 0 14px}
.numi-day-club-offer .numi-tariff-lead>div{display:flex;flex-direction:column;min-width:0;position:relative;padding:15px 11px;border-radius:17px;border:1px solid #e7d8bf;background:linear-gradient(150deg,#fffefa,#f6f0e6);box-shadow:0 6px 18px rgba(66,50,24,.07)}
.numi-day-club-offer .numi-tariff-card-icon{color:#a07837;font:normal 29px/1 Georgia,serif;margin:0 0 5px}
.numi-day-club-offer .numi-tariff-once>strong{color:#143629;font:normal clamp(16px,4.4vw,22px)/1.13 Georgia,serif}
.numi-day-club-offer .numi-tariff-once>small{color:#67746b;font:12px/1.4 system-ui,sans-serif;margin:10px 0}
.numi-day-club-offer .numi-tariff-card-foot{display:block;margin-top:auto;padding:8px 5px;border-radius:10px;background:#ebe5da;color:#60513b;text-align:center;font:700 11px/1.3 system-ui,sans-serif}
.numi-day-club-offer .numi-tariff-lead>div.numi-tariff-club{border:1.5px solid #d7a23e;background:linear-gradient(138deg,#fffcf5 0%,#f5e5c5 55%,#fff8eb 100%);box-shadow:0 7px 22px rgba(185,132,37,.18),inset 0 1px 0 #fff}
.numi-day-club-offer .numi-tariff-club-badge{align-self:flex-start;margin:-4px 0 8px;padding:5px 8px;border-radius:30px;background:linear-gradient(100deg,#9e6b1d,#dbaa4a,#956319);color:#fff;font:800 10px/1.2 system-ui,sans-serif;letter-spacing:.07em}
.numi-day-club-offer .numi-tariff-club-title{font:normal clamp(24px,6.4vw,31px)/1 Georgia,serif;color:#14583f}
.numi-day-club-offer .numi-tariff-club-price{margin:9px 0 4px;color:#086e48;font:800 clamp(25px,7.1vw,36px)/1.08 system-ui,sans-serif}
.numi-day-club-offer .numi-tariff-club-price em{font:600 12px/1.2 system-ui,sans-serif;color:#5b513c;white-space:nowrap}
.numi-day-club-offer .numi-tariff-club>small{color:#4c624e;font:12px/1.45 system-ui,sans-serif}
.numi-day-club-offer .numi-tariff-caption{display:block;margin:14px 2px 12px;color:#536356;text-align:left;font:12px/1.45 system-ui,sans-serif}
.numi-day-club-offer .numi-tariff-caption strong{display:block;color:#173c2e;font:normal 22px/1.2 Georgia,serif;margin:0 0 5px;text-align:left}
.numi-day-club-offer .numi-tariff-caption span{display:block}
.numi-day-club-offer .numi-tariff-table{overflow:hidden;border:1px solid #d4bc75;border-radius:15px;box-shadow:0 5px 22px rgba(110,79,24,.14)}
.numi-day-club-offer .numi-tariff-head,.numi-day-club-offer .numi-tariff-row{display:grid;grid-template-columns:minmax(0,1.52fr) minmax(0,.74fr) minmax(0,.79fr);gap:0;align-items:stretch}
.numi-day-club-offer .numi-tariff-head{background:#f1eee7;color:#364a3f;font:800 10px/1.3 system-ui,sans-serif}
.numi-day-club-offer .numi-tariff-head [role=columnheader]{display:grid;place-items:center;min-width:0;padding:12px 5px;text-align:center}
.numi-day-club-offer .numi-tariff-head [role=columnheader]:first-child{justify-items:start;text-align:left;padding-left:9px}
.numi-day-club-offer .numi-tariff-head [role=columnheader]:last-child{background:linear-gradient(125deg,#157750,#094d39);color:#fff;font-weight:900;letter-spacing:.025em}
.numi-day-club-offer .numi-tariff-row{background:linear-gradient(90deg,#fffefa,#fbfaf6);border-bottom:1px solid #e9e5dd;color:#224c3c;font:12px/1.35 system-ui,sans-serif}
.numi-day-club-offer .numi-tariff-row:last-child{border-bottom:0}
.numi-day-club-offer .numi-tariff-row>[role=cell]{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;min-width:0;min-height:63px;padding:10px 6px;overflow-wrap:anywhere}
.numi-day-club-offer .numi-tariff-row>[role=cell]:first-child{padding-left:9px}
.numi-day-club-offer .numi-tariff-row>[role=cell]:not(:first-child){align-items:center;text-align:center}
.numi-day-club-offer .numi-tariff-row>[role=cell]:last-child{background:linear-gradient(135deg,#d4efcd 0%,#e6f4dd 55%,#d1ecca 100%);border-left:1px solid #bddcb4;color:#096e43;font-weight:900}
.numi-day-club-offer .numi-tariff-row strong{color:#173e30;font:750 12.5px/1.3 system-ui,sans-serif}
.numi-day-club-offer .numi-tariff-row small{display:block;margin-top:3px;color:#587362;font:500 10.5px/1.3 system-ui,sans-serif}
.numi-day-club-offer .numi-tariff-row .numi-club-discount{color:#087447!important;font:900 clamp(21px,6vw,29px)/1.1 Georgia,serif;text-shadow:0 1px 0 rgba(255,255,255,.75)}
.numi-day-club-offer .numi-tariff-row .numi-club-free{color:#047645!important;font:900 clamp(10px,3vw,13px)/1.12 system-ui,sans-serif}
.numi-day-club-offer .numi-tariff-row .numi-club-special{color:#087447;font:850 12px/1.35 system-ui,sans-serif}
.numi-day-club-offer .numi-tariff-row .numi-club-included{color:#0a7548;font:900 20px/1.15 system-ui,sans-serif}
.numi-day-club-offer .numi-tariff-row .numi-club-included small{font-size:10px;color:#246246}
.numi-day-club-offer .numi-tariff-unavailable{color:#8c9a93}
.numi-day-club-offer .numi-tariff-footer{margin:14px 0 0;padding:12px;border:1px solid #e7d8b8;border-radius:12px;background:#f7f1e5;color:#5d513c;font:12px/1.5 system-ui,sans-serif;text-align:left}
@media(max-width:390px){.numi-day-club-offer .numi-tariff-lead>div{padding:13px 9px}.numi-day-club-offer .numi-tariff-head,.numi-day-club-offer .numi-tariff-row{grid-template-columns:minmax(0,1.42fr) minmax(0,.72fr) minmax(0,.82fr)}.numi-day-club-offer .numi-tariff-row>[role=cell]{padding:10px 4px}.numi-day-club-offer .numi-tariff-row>[role=cell]:first-child{padding-left:7px}.numi-day-club-offer .numi-tariff-row strong{font-size:12px}}
\`;
const ensureDayClubTariffStyles = () => {
  if (document.getElementById("numi-day-club-tariffs-20261103")) return;
  const el = document.createElement("style");
  el.id = "numi-day-club-tariffs-20261103";
  el.textContent = dayClubTariffCss;
  document.head.append(el);
};

export const openPersonalDay = () => {
  ensureDayClubTariffStyles();
  // iOS: прокручиваем страницу, а не внутреннее фиксированное окно.
  // Это сохраняет позицию при системном скриншоте и смене размеров viewport.
  const nativePageScroll = window.CSS?.supports?.("-webkit-touch-callout", "none") === true;
  const previousPageScroll = window.scrollY;
  const shell = document.createElement("section");
  shell.className = "personal-day-overlay personal-day-page-overlay";
  shell.innerHTML = `<div class="personal-day-card personal-day-page" role="dialog" aria-modal="true"><button class="personal-day-back" type="button" aria-label="Вернуться ко всем расчётам" style="display:inline-flex;align-items:center;justify-content:center;min-width:148px;min-height:54px;margin:0 56px 17px 0;padding:12px 22px;border:1px solid #39588c;border-radius:16px;background:linear-gradient(125deg,#304779,#5871af);color:#fff;font:800 18px/1.3 Inter,system-ui,sans-serif;box-shadow:0 8px 20px rgba(48,71,121,.22);text-align:center;cursor:pointer">← Назад</button><button class="personal-day-close" type="button" aria-label="Закрыть">×</button><p class="eyebrow">Личный прогноз</p><h2>Ваш личный расчёт дня</h2><p class="personal-day-lead">Личный разбор дня подскажет, куда направить силы, какой шаг сделать, чего избегать, к каким чувствам прислушаться и какие тайны бережно хранит для вас этот день.</p><section class="personal-day-form-panel"><p class="personal-day-form-kicker">РАССЧИТАЙТЕ СВОЙ ЛИЧНЫЙ ДЕНЬ</p><p class="personal-day-date">Сегодня ${todayLabel()}</p><form><label><span>Дата рождения</span><input required type="tel" inputmode="numeric" autocomplete="bday" placeholder="09.09.1986" maxlength="10"></label><button class="personal-day-submit" type="submit" disabled>Рассчитать личный день</button><p class="personal-day-error" hidden></p></form></section><section class="personal-day-result" hidden></section></div>`;
  document.body.classList.add("personal-day-reading");
  document.body.append(shell);
  if (nativePageScroll) window.scrollTo(0, 0);
  const card = shell.querySelector(".personal-day-card");
  const form = shell.querySelector("form");
  const input = shell.querySelector("input");
  const submit = shell.querySelector("button[type=submit]");
  const result = shell.querySelector(".personal-day-result");
  const returnToHome = () => {
    shell.remove();
    document.body.classList.remove("personal-day-reading");
    const home = document.querySelector("#home");
    if (home) {
      home.hidden = false;
      if (window.location.hash === "#lichnyj-den" || new URLSearchParams(window.location.search).get("view") === "day") {
        const url = new URL(window.location.href);
        url.hash = "";
        url.searchParams.delete("view");
        window.history.replaceState(null, "", url.pathname + url.search);
      }
    } else {
      // Прямое открытие day.html: на странице нет главного экрана.
      window.location.assign("./");
    }
    if (nativePageScroll && home) {
      requestAnimationFrame(() => window.scrollTo(0, previousPageScroll));
    }
  };
  shell.querySelector(".personal-day-close").onclick = returnToHome;
  shell.querySelector(".personal-day-back").onclick = returnToHome;
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "").slice(0, 8);
    input.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join(".");
    submit.disabled = digits.length !== 8;
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    const birth = parseBirthDate(input.value);
    const error = shell.querySelector(".personal-day-error");
    if (!birth) { error.hidden = false; error.textContent = "Введите дату в формате ДД.ММ.ГГГГ"; return; }
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = "Считаю ваш день…";
    // Убрать фокус с поля, чтобы iOS не пытался вернуть страницу к клавиатуре.
    input.blur();
    const item = await loadPersonalDay(birth);
    result.hidden = false;
    result.innerHTML = `<section class="personal-day-main"><p class="personal-day-label">ВАШ ДЕНЬ</p>${paragraphs([item.text])}${item.todayNeed?.length ? `<section class="personal-day-advice personal-day-need"><h4><span class="personal-day-advice-icon">✓</span> Сегодня нужно</h4><ul>${bullets(item.todayNeed)}</ul></section>` : ""}${item.todayAvoid?.length ? `<section class="personal-day-advice personal-day-avoid"><h4><span class="personal-day-advice-icon">×</span> Сегодня нельзя</h4><ul>${bullets(item.todayAvoid)}</ul></section>` : ""}</section>`;
    if (!item.loadError) addDayShareButtons(result, formatDayMessage(input.value, item));
    result.insertAdjacentHTML("beforeend", monthCalendar(birth));
    const importantButton = result.querySelector(".personal-month-open");
    const subscriptionInfo = result.querySelector(".personal-month-subscription");
    importantButton?.addEventListener("click", () => {
      if (!subscriptionInfo) return;
      const expanded = importantButton.getAttribute("aria-expanded") === "true";
      importantButton.setAttribute("aria-expanded", String(!expanded));
      subscriptionInfo.hidden = expanded;
      importantButton.innerHTML = expanded
        ? 'Подписка 490 ₽/мес <span aria-hidden="true">↓</span>'
        : 'Скрыть преимущества подписки <span aria-hidden="true">↑</span>';
      if (!expanded) {
        requestAnimationFrame(() => {
          const targetTop = subscriptionInfo.getBoundingClientRect().top;
          const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
          if (nativePageScroll) {
            window.scrollTo({ top: Math.max(0, targetTop + window.scrollY - 12), behavior: reduceMotion ? "instant" : "smooth" });
          } else {
            const top = Math.max(0, card.scrollTop + targetTop - card.getBoundingClientRect().top - 12);
            card.scrollTo({ top, behavior: reduceMotion ? "instant" : "smooth" });
          }
        });
      }
    });
    requestAnimationFrame(() => {
      if (nativePageScroll) {
        // Единственный переход после расчёта; дальнейшую прокрутку ведёт браузер.
        const top = result.getBoundingClientRect().top + window.scrollY - 16;
        window.scrollTo(0, Math.max(0, top));
      } else {
        animateScroll(card, Math.max(0, result.offsetTop - 16));
      }
    });
    submit.textContent = "Рассчитать личный день";
    submit.disabled = false;
  };
};
