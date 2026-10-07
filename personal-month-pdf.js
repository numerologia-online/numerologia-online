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

const STATUS = {
  good: {
    label: "Лучшие дни",
    color: "#0A8F55",
    soft: "#E5F8EE",
    border: "#A7E4C5",
    symbol: "✓"
  },
  chance: {
    label: "Важные шансы",
    color: "#9A6B13",
    soft: "#FFF3D7",
    border: "#E8CC88",
    symbol: "★"
  },
  risk: {
    label: "Дни риска",
    color: "#B33A36",
    soft: "#FDE9E7",
    border: "#F0B8B3",
    symbol: "!"
  },
  neutral: {
    label: "Обычный день",
    color: "#405A77",
    soft: "#F1F4F8",
    border: "#DCE3EC",
    symbol: "•"
  }
};

const formatBirth = (birth) =>
  `${String(birth.day).padStart(2, "0")}.${String(birth.month).padStart(2, "0")}.${birth.year}`;

const xml = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

const coverBackground = () => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
    <defs>
      <linearGradient id="cover" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#111B3B"/>
        <stop offset="48%" stop-color="#263B74"/>
        <stop offset="100%" stop-color="#663B78"/>
      </linearGradient>
      <radialGradient id="glowA" cx="18%" cy="16%" r="58%">
        <stop offset="0%" stop-color="#7AD5E0" stop-opacity=".32"/>
        <stop offset="100%" stop-color="#7AD5E0" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="glowB" cx="86%" cy="78%" r="62%">
        <stop offset="0%" stop-color="#E29BCD" stop-opacity=".30"/>
        <stop offset="100%" stop-color="#E29BCD" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="595" height="842" fill="url(#cover)"/>
    <rect width="595" height="842" fill="url(#glowA)"/>
    <rect width="595" height="842" fill="url(#glowB)"/>
    <rect x="25" y="25" width="545" height="792" rx="22" fill="none" stroke="#E5C985" stroke-width="0.8" opacity=".72"/>
    <rect x="33" y="33" width="529" height="776" rx="18" fill="none" stroke="#FFFFFF" stroke-width="0.35" opacity=".22"/>
    <g fill="#FFFFFF" opacity=".10" font-family="Georgia, serif" text-anchor="middle">
      <text x="78" y="130" font-size="88">9</text>
      <text x="158" y="92" font-size="39">6</text>
      <text x="504" y="148" font-size="76">6</text>
      <text x="449" y="97" font-size="36">9</text>
      <text x="90" y="735" font-size="70">6</text>
      <text x="495" y="748" font-size="82">9</text>
    </g>
    <g fill="#E5C985" opacity=".78">
      <circle cx="297.5" cy="82" r="2.2"/>
      <circle cx="285" cy="82" r="1.2"/>
      <circle cx="310" cy="82" r="1.2"/>
      <circle cx="297.5" cy="762" r="2.2"/>
      <circle cx="285" cy="762" r="1.2"/>
      <circle cx="310" cy="762" r="1.2"/>
    </g>
  </svg>`
});

const innerBackground = () => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
    <defs>
      <radialGradient id="paper" cx="18%" cy="8%" r="90%">
        <stop offset="0%" stop-color="#F4F7FF"/>
        <stop offset="52%" stop-color="#FCFBF8"/>
        <stop offset="100%" stop-color="#F8F3FB"/>
      </radialGradient>
    </defs>
    <rect width="595" height="842" fill="url(#paper)"/>
    <rect x="20" y="20" width="555" height="802" rx="16" fill="none" stroke="#D3B56F" stroke-width="0.75" opacity=".72"/>
    <rect x="27" y="27" width="541" height="788" rx="13" fill="none" stroke="#6F83B6" stroke-width="0.3" opacity=".34"/>
    <circle cx="35" cy="94" r="58" fill="#7D9BD1" opacity=".055"/>
    <circle cx="555" cy="724" r="88" fill="#9F67AA" opacity=".05"/>
    <g fill="#C39C49" opacity=".24">
      <circle cx="297.5" cy="34" r="1.7"/>
      <circle cx="289" cy="34" r="1"/>
      <circle cx="306" cy="34" r="1"/>
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
        margin: [17, 15, 17, 15],
        stack: [
          {
            columns: [
              { text: palette.symbol, width: 28, color: palette.color, bold: true, fontSize: 22, alignment: "center" },
              { text: palette.label.toUpperCase(), color: palette.color, bold: true, fontSize: 17, margin: [5, 1, 0, 0] }
            ],
            margin: [0, 0, 0, 10]
          },
          ...groups.map(([label, dates]) => ({
            stack: [
              { text: label, bold: true, color: "#273A57", fontSize: 15, margin: [0, 6, 0, 2] },
              { text: `${dates.join(", ")} ${MONTHS_GENITIVE[monthIndex]}`, color: "#53647D", fontSize: 13 }
            ]
          }))
        ]
      }]]
    },
    layout: {
      hLineWidth: () => 0.8,
      vLineWidth: () => 0.8,
      hLineColor: () => palette.border,
      vLineColor: () => palette.border
    },
    margin: [0, 0, 0, 13]
  };
};

const adviceBox = (title, items, type) => {
  if (!items?.length) return null;
  const need = type === "need";
  return {
    table: {
      widths: ["*"],
      body: [[{
        fillColor: need ? "#EBF8F0" : "#FDEEEE",
        margin: [13, 10, 13, 10],
        stack: [
          { text: title, bold: true, color: need ? "#087A48" : "#A73B37", fontSize: 12.5, margin: [0, 0, 0, 5] },
          { ul: items, color: "#344B67", fontSize: 11.5, lineHeight: 1.28, margin: [7, 0, 0, 0] }
        ]
      }]]
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => need ? "#B9E5CB" : "#F0C1BE",
      vLineColor: () => need ? "#B9E5CB" : "#F0C1BE"
    },
    margin: [0, 7, 0, 0]
  };
};

const dayBlock = ({ day, item, info }, monthIndex) => {
  const status = info?.status || "neutral";
  const palette = STATUS[status] || STATUS.neutral;
  const specialLabel = status === "neutral" ? "" : (info?.group || palette.label);

  return [
    {
      columns: [
        {
          width: 54,
          table: {
            widths: [54],
            heights: [54],
            body: [[{
              text: String(day),
              alignment: "center",
              bold: true,
              fontSize: 22,
              color: palette.color,
              fillColor: palette.soft,
              margin: [0, 12, 0, 10]
            }]]
          },
          layout: {
            hLineWidth: () => 0.8,
            vLineWidth: () => 0.8,
            hLineColor: () => palette.border,
            vLineColor: () => palette.border
          }
        },
        {
          width: "*",
          margin: [14, 2, 0, 0],
          stack: [
            { text: `${day} ${MONTHS_GENITIVE[monthIndex]} · личный день ${item.energy}`, bold: true, color: "#243B60", fontSize: 16 },
            ...(specialLabel ? [{ text: specialLabel, bold: true, color: palette.color, fontSize: 11.5, margin: [0, 5, 0, 0] }] : [])
          ]
        }
      ],
      margin: [0, 6, 0, 10]
    },
    { text: item.text || "Текст дня пока недоступен.", color: "#42536D", fontSize: 13.5, lineHeight: 1.32, margin: [0, 0, 0, 6] },
    ...(adviceBox("СЕГОДНЯ НУЖНО", item.todayNeed, "need") ? [adviceBox("СЕГОДНЯ НУЖНО", item.todayNeed, "need")] : []),
    ...(adviceBox("СЕГОДНЯ НЕЛЬЗЯ", item.todayAvoid, "avoid") ? [adviceBox("СЕГОДНЯ НЕЛЬЗЯ", item.todayAvoid, "avoid")] : []),
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: 463, y2: 0, lineWidth: 0.45, lineColor: "#D8DDE8" }],
      margin: [0, 16, 0, 10]
    }
  ];
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
    pageMargins: [66, 72, 66, 72],
    background: (page) => page === 1 ? coverBackground() : innerBackground(),
    defaultStyle: { font: "Roboto", color: "#3F506A" },
    styles: {
      coverBrand: { fontSize: 12, bold: true, color: "#E9D493", characterSpacing: 2.1, alignment: "center" },
      coverTitle: { fontSize: 25, bold: true, color: "#FFFFFF", alignment: "center", characterSpacing: 1.15 },
      coverMonth: { fontSize: 54, bold: true, color: "#FFFFFF", alignment: "center", lineHeight: 1.0 },
      coverYear: { fontSize: 78, bold: true, color: "#A9DDE5", alignment: "center", lineHeight: 1.0 },
      coverDate: { fontSize: 16, bold: true, color: "#F0D79A", alignment: "center" },
      coverCopy: { fontSize: 15, color: "#E5EAF7", alignment: "center", lineHeight: 1.36 },
      kicker: { fontSize: 11, bold: true, color: "#A2762D", characterSpacing: 1.3, alignment: "center" },
      pageTitle: { fontSize: 33, bold: true, color: "#243F73", alignment: "center", margin: [0, 0, 0, 12] },
      pageLead: { fontSize: 14, color: "#61708A", alignment: "center", lineHeight: 1.34, margin: [0, 0, 0, 24] },
      sectionKicker: { fontSize: 10.5, bold: true, color: "#9A742F", characterSpacing: 1.15, margin: [0, 0, 0, 8] },
      sectionTitle: { fontSize: 30, bold: true, color: "#243F73", margin: [0, 0, 0, 12] }
    },
    content: [
      {
        stack: [
          { text: "НУМЕРОЛОГИЯ ONLINE", style: "coverBrand", margin: [0, 42, 0, 62] },
          { text: "ЛИЧНЫЙ КАЛЕНДАРЬ", style: "coverTitle", margin: [0, 0, 0, 19] },
          { text: month.toUpperCase(), style: "coverMonth", margin: [0, 0, 0, 3] },
          { text: String(year), style: "coverYear", margin: [0, 0, 0, 34] },
          { text: `Дата рождения · ${formatBirth(birth)}`, style: "coverDate", margin: [0, 0, 0, 35] },
          {
            text: "Лучшие дни · важные шансы · дни риска\nи личный прогноз на каждый день месяца",
            style: "coverCopy",
            margin: [34, 0, 34, 0]
          }
        ],
        pageBreak: "after"
      },
      { text: "ВАШ МЕСЯЦ В ОДНОМ ВЗГЛЯДЕ", style: "kicker" },
      { text: "Главные даты месяца", style: "pageTitle" },
      {
        text: "Сначала сохраните ориентиры месяца, а затем переходите к подробному разбору каждого дня.",
        style: "pageLead"
      },
      ...summary,
      { text: "", pageBreak: "after" },
      { text: "ПОДРОБНЫЙ КАЛЕНДАРЬ", style: "sectionKicker" },
      { text: `Все дни · ${month} ${year}`, style: "sectionTitle" },
      { text: `Дата рождения: ${formatBirth(birth)}`, color: "#718099", fontSize: 12.5, margin: [0, 0, 0, 20] },
      ...days.flatMap((day) => dayBlock(day, monthIndex))
    ],
    footer: (page, pages) => page === 1 ? null : ({
      text: `Нумерология Онлайн · ${page - 1} / ${pages - 1}`,
      alignment: "center",
      color: "#8B7896",
      fontSize: 8.5,
      margin: [0, 12, 0, 0]
    })
  };
};

export const downloadPersonalMonthPdf = async ({ birth, monthDate, days }) => {
  const pdfMake = await getPdfMake();
  const definition = buildDocument({ birth, monthDate, days });
  const blob = await new Promise((resolve) => pdfMake.createPdf(definition).getBlob(resolve));
  const url = URL.createObjectURL(blob);
  const filename = `Личный календарь ${MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()} · ${formatBirth(birth)}.pdf`;
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
