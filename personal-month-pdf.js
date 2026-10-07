const PDF_SCRIPT = "https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/pdfmake.min.js";
const PDF_FONTS = "https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/vfs_fonts.js";

let pdfMakeLoading;

const loadScript = (src) => new Promise((resolve, reject) => {
  const existing = [...document.scripts].find((script) => script.src === src);
  if (existing) {
    if (window.pdfMake) return resolve();
    existing.addEventListener("load", resolve, { once: true });
    existing.addEventListener("error", reject, { once: true });
    return;
  }
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.onload = resolve;
  script.onerror = reject;
  document.head.append(script);
});

const getPdfMake = () => {
  if (window.pdfMake) return Promise.resolve(window.pdfMake);
  if (!pdfMakeLoading) {
    pdfMakeLoading = loadScript(PDF_SCRIPT)
      .then(() => loadScript(PDF_FONTS))
      .then(() => window.pdfMake);
  }
  return pdfMakeLoading;
};

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

const WEEKDAYS = [
  "ВОСКРЕСЕНЬЕ", "ПОНЕДЕЛЬНИК", "ВТОРНИК", "СРЕДА",
  "ЧЕТВЕРГ", "ПЯТНИЦА", "СУББОТА"
];

const STATUS = {
  good: {
    label: "Лучшие дни",
    color: "#466D73",
    soft: "#EAF3F2",
    border: "#B8D2D2",
    symbol: "✦"
  },
  chance: {
    label: "Важные шансы",
    color: "#9A702F",
    soft: "#F8F0DF",
    border: "#DCC792",
    symbol: "◇"
  },
  risk: {
    label: "Дни риска",
    color: "#8A5D62",
    soft: "#F6EBEB",
    border: "#DDBFC2",
    symbol: "!"
  },
  neutral: {
    label: "Обычный день",
    color: "#657484",
    soft: "#F3F1EC",
    border: "#D9D4C8",
    symbol: "·"
  }
};

const formatBirth = (birth) =>
  `${String(birth.day).padStart(2, "0")}.${String(birth.month).padStart(2, "0")}.${birth.year}`;

const coverBackground = () => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
    <defs>
      <radialGradient id="paper" cx="42%" cy="18%" r="92%">
        <stop offset="0%" stop-color="#FFFDF8"/>
        <stop offset="62%" stop-color="#F8F2E7"/>
        <stop offset="100%" stop-color="#EEE3D2"/>
      </radialGradient>
      <linearGradient id="powder" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#DCEAF0"/>
        <stop offset="100%" stop-color="#C7DDE5"/>
      </linearGradient>
    </defs>
    <rect width="595" height="842" fill="url(#paper)"/>
    <rect x="20" y="20" width="555" height="802" rx="12" fill="none" stroke="#B78A3F" stroke-width=".8"/>
    <rect x="27" y="27" width="541" height="788" rx="10" fill="none" stroke="#D9C59F" stroke-width=".32"/>

    <g fill="none" stroke="#B78A3F" opacity=".30">
      <circle cx="297.5" cy="99" r="38" stroke-width=".5"/>
      <circle cx="297.5" cy="99" r="25" stroke-width=".35" stroke-dasharray="2 5"/>
      <path d="M297.5 50 V65 M297.5 133 V148 M249 99 H264 M331 99 H346" stroke-width=".45"/>
    </g>
    <g fill="#B78A3F" opacity=".55">
      <path d="M297.5 77 L301 89 L313 92.5 L301 96 L297.5 108 L294 96 L282 92.5 L294 89Z"/>
    </g>

    <!-- abstract tear-off calendar silhouette -->
    <g transform="translate(125 255)">
      <rect x="0" y="0" width="345" height="330" rx="18" fill="#FFFDFC" stroke="#C8A45D" stroke-width=".9"/>
      <rect x="0" y="0" width="345" height="75" rx="18" fill="url(#powder)"/>
      <rect x="0" y="58" width="345" height="17" fill="url(#powder)"/>
      <circle cx="92" cy="22" r="7.5" fill="#F8F2E7" stroke="#B78A3F" stroke-width=".6"/>
      <circle cx="253" cy="22" r="7.5" fill="#F8F2E7" stroke="#B78A3F" stroke-width=".6"/>
      <path d="M26 91 H319" stroke="#C8A45D" stroke-width=".55" stroke-dasharray="2 5" opacity=".58"/>
      <g fill="#B78A3F" opacity=".10" font-family="Georgia, serif" text-anchor="middle">
        <text x="55" y="288" font-size="46">9</text>
        <text x="290" y="285" font-size="44">6</text>
      </g>
    </g>

    <g fill="#B78A3F" opacity=".42">
      <circle cx="297.5" cy="34" r="1.8"/><circle cx="288" cy="34" r=".9"/><circle cx="307" cy="34" r=".9"/>
      <circle cx="297.5" cy="808" r="1.8"/><circle cx="288" cy="808" r=".9"/><circle cx="307" cy="808" r=".9"/>
    </g>
  </svg>`
});

const innerBackground = () => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
    <defs>
      <radialGradient id="innerPaper" cx="35%" cy="12%" r="96%">
        <stop offset="0%" stop-color="#FFFDF9"/>
        <stop offset="70%" stop-color="#FAF7F0"/>
        <stop offset="100%" stop-color="#F2EBDF"/>
      </radialGradient>
    </defs>
    <rect width="595" height="842" fill="url(#innerPaper)"/>
    <rect x="20" y="20" width="555" height="802" rx="10" fill="none" stroke="#B99151" stroke-width=".62"/>
    <rect x="27" y="27" width="541" height="788" rx="8" fill="none" stroke="#DCCDAF" stroke-width=".25"/>

    <g fill="none" stroke="#91B2C0" opacity=".065">
      <rect x="402" y="625" width="124" height="96" rx="4"/>
      <path d="M419.7 625 V721 M437.4 625 V721 M455.1 625 V721 M472.8 625 V721 M490.5 625 V721 M508.2 625 V721"/>
      <path d="M402 644.2 H526 M402 663.4 H526 M402 682.6 H526 M402 701.8 H526"/>
    </g>

    <g fill="#C29B58" opacity=".20">
      <circle cx="297.5" cy="34" r="1.6"/><circle cx="289" cy="34" r=".8"/><circle cx="306" cy="34" r=".8"/>
    </g>
  </svg>`
});

const groupByStatus = (days, status) => {
  const groups = new Map();
  days.forEach(({ day, info }) => {
    if (info?.status !== status) return;
    const label = info.group || STATUS[status].label;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(day);
  });
  return [...groups.entries()];
};

const summaryCard = (days, status, monthIndex) => {
  const palette = STATUS[status];
  const groups = groupByStatus(days, status);
  if (!groups.length) return null;
  return {
    table: {
      widths: ["*"],
      body: [[{
        fillColor: palette.soft,
        margin: [18, 16, 18, 16],
        stack: [
          {
            columns: [
              { text: palette.symbol, width: 28, color: palette.color, bold: true, fontSize: 20, alignment: "center" },
              { text: palette.label.toUpperCase(), color: palette.color, bold: true, fontSize: 16.5, margin: [5, 1, 0, 0] }
            ],
            margin: [0, 0, 0, 9]
          },
          ...groups.map(([label, dates]) => ({
            stack: [
              { text: label, bold: true, color: "#304657", fontSize: 17, margin: [0, 5, 0, 2] },
              { text: `${dates.join(", ")} ${MONTHS_GENITIVE[monthIndex]}`, color: "#687685", fontSize: 15.5 }
            ]
          }))
        ]
      }]]
    },
    layout: {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => palette.border,
      vLineColor: () => palette.border
    },
    margin: [0, 0, 0, 14]
  };
};

const adviceBox = (title, items, type) => {
  if (!items?.length) return null;
  const need = type === "need";
  return {
    table: {
      widths: ["*"],
      body: [[{
        fillColor: need ? "#ECF3F3" : "#F6EEEE",
        margin: [16, 13, 16, 13],
        stack: [
          {
            text: title,
            bold: true,
            color: need ? "#466D73" : "#8A5D62",
            fontSize: 15,
            characterSpacing: .6,
            margin: [0, 0, 0, 7]
          },
          {
            ul: items,
            color: "#293F50",
            fontSize: 15.5,
            lineHeight: 1.32,
            margin: [7, 0, 0, 0]
          }
        ]
      }]]
    },
    layout: {
      hLineWidth: () => 0.45,
      vLineWidth: () => 0.45,
      hLineColor: () => need ? "#BCD0D0" : "#DABFC2",
      vLineColor: () => need ? "#BCD0D0" : "#DABFC2"
    },
    margin: [0, 8, 0, 0]
  };
};

const dayHeader = ({ day, monthIndex, year, energy, weekday }) => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="466" height="183" viewBox="0 0 466 183">
    <defs><linearGradient id="dayTop" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#E5F0F1"/><stop offset="100%" stop-color="#D4E5E9"/>
    </linearGradient></defs>
    <rect x="1" y="1" width="464" height="181" rx="10" fill="#FFFDF9" stroke="#C6A46A" stroke-width=".75"/>
    <path d="M1 10 Q1 1 11 1 H455 Q465 1 465 10 V50 H1 Z" fill="url(#dayTop)"/>
    <path d="M20 50 H446" stroke="#BFA06D" stroke-width=".7" stroke-dasharray="2 4"/>
    <g fill="#FFFDF9" stroke="#B99151" stroke-width=".9"><circle cx="64" cy="16" r="6"/><circle cx="402" cy="16" r="6"/></g>
    <g font-family="Arial, sans-serif" text-anchor="middle">
      <text x="233" y="33" font-size="16" font-weight="700" letter-spacing="2" fill="#496A76">${weekday}</text>
      <text x="233" y="125" font-size="78" font-weight="700" fill="#1C3B51">${day}</text>
      <text x="233" y="152" font-size="15" font-weight="700" letter-spacing="2" fill="#926B30">${MONTHS_GENITIVE[monthIndex].toUpperCase()} · ${year}</text>
      <text x="233" y="173" font-size="13" fill="#536E78">ЛИЧНЫЙ ДЕНЬ ${energy}</text>
    </g></svg>`,
  width: 466, height: 183, alignment: "center"
});

const dayPage = ({ day, item, info }, monthIndex, year) => {
  const status = info?.status || "neutral";
  const palette = STATUS[status] || STATUS.neutral;
  const specialLabel = status === "neutral" ? "" : (info?.group || palette.label);
  const weekday = WEEKDAYS[new Date(year, monthIndex, day).getDay()];
  const forecast = String(item.text || "").trim();
  const parts = forecast ? forecast.split(/\n\s*\n/).filter(Boolean) : ["Текст дня пока недоступен."];
  return {
    pageBreak: "before",
    stack: [
      { ...dayHeader({ day, monthIndex, year, energy: item.energy, weekday }), margin: [0, 0, 0, 18] },
      ...(specialLabel ? [{ text: specialLabel, fontSize: 16, bold: true, color: palette.color, alignment: "center", margin: [0, 0, 0, 14] }] : []),
      ...parts.map((part) => ({ text: part, fontSize: 19, color: "#263D4D", lineHeight: 1.38, margin: [5, 0, 5, 17] })),
      ...(item.todayNeed?.length ? [adviceBox("СЕГОДНЯ НУЖНО", item.todayNeed, "need")] : []),
      ...(item.todayAvoid?.length ? [adviceBox("СЕГОДНЯ НЕЛЬЗЯ", item.todayAvoid, "avoid")] : [])
    ]
  };
};

const buildDocument = ({ birth, monthDate, days }) => {
  const monthIndex = monthDate.getMonth();
  const year = monthDate.getFullYear();
  const month = MONTHS[monthIndex];
  const summary = ["good", "chance", "risk"]
    .map((status) => summaryCard(days, status, monthIndex))
    .filter(Boolean);

  return {
    info: {
      title: `Личный календарь · ${month} ${year} · ${formatBirth(birth)}`,
      subject: "Персональный нумерологический разбор месяца"
    },
    pageSize: "A4",
    pageMargins: [62, 66, 62, 66],
    background: (page) => page === 1 ? coverBackground() : innerBackground(),
    defaultStyle: { font: "Roboto", color: "#34495A" },
    styles: {
      coverBrand: { fontSize: 11.5, bold: true, color: "#9A702F", characterSpacing: 2.2, alignment: "center" },
      coverTitle: { fontSize: 21, bold: true, color: "#19364E", alignment: "center", characterSpacing: 1.3 },
      coverMonth: { fontSize: 49, bold: true, color: "#19364E", alignment: "center", lineHeight: 1.0 },
      coverYear: { fontSize: 67, bold: true, color: "#9A702F", alignment: "center", lineHeight: 1.0 },
      coverDate: { fontSize: 15.5, bold: true, color: "#5B6E79", alignment: "center" },
      coverCopy: { fontSize: 14.5, color: "#687985", alignment: "center", lineHeight: 1.38 },
      kicker: { fontSize: 11.5, bold: true, color: "#9A702F", characterSpacing: 1.35, alignment: "center" },
      pageTitle: { fontSize: 31, bold: true, color: "#19364E", alignment: "center", margin: [0, 0, 0, 12] },
      pageLead: { fontSize: 14.5, color: "#687985", alignment: "center", lineHeight: 1.4, margin: [8, 0, 8, 24] }
    },
    content: [
      {
        stack: [
          { text: "НУМЕРОЛОГИЯ ONLINE", style: "coverBrand", margin: [0, 47, 0, 69] },
          { text: "ЛИЧНЫЙ КАЛЕНДАРЬ", style: "coverTitle", margin: [0, 0, 0, 15] },
          { text: month.toUpperCase(), style: "coverMonth", margin: [0, 0, 0, 1] },
          { text: String(year), style: "coverYear", margin: [0, 0, 0, 34] },
          { text: `Дата рождения · ${formatBirth(birth)}`, style: "coverDate", margin: [0, 0, 0, 32] },
          {
            text: "Ваш месяц как личный отрывной календарь —\nс прогнозом, подсказками и важными датами.",
            style: "coverCopy",
            margin: [38, 0, 38, 0]
          }
        ],
        pageBreak: "after"
      },
      { text: "ВАШ МЕСЯЦ В ОДНОМ ВЗГЛЯДЕ", style: "kicker" },
      { text: "Главные даты месяца", style: "pageTitle" },
      {
        text: "Сначала сохраните ориентиры месяца, а дальше листайте его как личный календарь — день за днём.",
        style: "pageLead"
      },
      ...summary,
      ...days.map((day) => dayPage(day, monthIndex, year))
    ],
    footer: (page, pages) => page === 1 ? null : ({
      text: `Нумерология Онлайн · ${page - 1} / ${pages - 1}`,
      alignment: "center",
      color: "#9A8661",
      fontSize: 8.5,
      margin: [0, 11, 0, 0]
    })
  };
};

let preparedPdf = null;
let preparedPdfKey = "";
let preparingPdf = null;
let preparingPdfKey = "";

const getPdfKey = ({ birth, monthDate }) =>
  `${formatBirth(birth)}|${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`;

export const warmPersonalMonthPdfEngine = () => getPdfMake();

export const preparePersonalMonthPdf = ({ birth, monthDate, days }) => {
  const key = getPdfKey({ birth, monthDate });
  if (preparedPdf && preparedPdfKey === key) return Promise.resolve(preparedPdf);
  if (preparingPdf && preparingPdfKey === key) return preparingPdf;

  preparingPdfKey = key;
  preparingPdf = (async () => {
    const pdfMake = await getPdfMake();
    if (!Array.isArray(days) || !days.length || days.some(({ item }) => !item || typeof item.text !== "string" || !item.text.trim())) throw new Error("Неполные тексты календаря");
    const definition = buildDocument({ birth, monthDate, days });
    const blob = await new Promise((resolve) => pdfMake.createPdf(definition).getBlob(resolve));
    const url = URL.createObjectURL(blob);
    const filename = `Личный календарь ${MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()} · ${formatBirth(birth)}.pdf`;

    if (preparedPdf?.url && preparedPdf.url !== url) URL.revokeObjectURL(preparedPdf.url);
    preparedPdf = { url, filename };
    preparedPdfKey = key;
    return preparedPdf;
  })().finally(() => {
    preparingPdf = null;
    preparingPdfKey = "";
  });

  return preparingPdf;
};

export const downloadPersonalMonthPdf = async ({ birth, monthDate, days }) => {
  const { url, filename } = await preparePersonalMonthPdf({ birth, monthDate, days });
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
};
