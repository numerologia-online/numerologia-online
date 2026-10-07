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

const formatDate = ({ day, month, year }) =>
  `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;

const escXml = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const asParagraphs = (value, style = "paragraph") => (Array.isArray(value) ? value : [value])
  .filter(Boolean)
  .flatMap((text) => String(text).split("\n\n"))
  .map((text) => text.trim())
  .filter(Boolean)
  .map((text) => ({ text, style }));

const createSection = ({ label, lead, text, ritual, ritualTitle, advice }) => [
  {
    stack: [
      ...(label ? [{ text: label, style: "sectionKicker" }] : []),
      ...(lead ? [{ text: lead, style: "sectionTitle" }] : [])
    ],
    margin: [0, 20, 0, 0]
  },
  ...asParagraphs(text),
  ...(ritual ? [
    {
      table: {
        widths: ["*"],
        body: [[{
          fillColor: "#FBF3DE",
          margin: [18, 14, 18, 14],
          stack: [
            { text: ritualTitle || "Как использовать", style: "ritualTitle" },
            ...asParagraphs(ritual, "ritualText")
          ]
        }]]
      },
      layout: {
        hLineWidth: () => 0.65,
        vLineWidth: () => 0.65,
        hLineColor: () => "#D8B766",
        vLineColor: () => "#D8B766"
      },
      margin: [0, 8, 0, 14]
    }
  ] : []),
  ...(advice ? [{
    table: {
      widths: ["*"],
      body: [[{
        fillColor: "#F3F6F8",
        margin: [16, 12, 16, 12],
        text: advice,
        style: "advice"
      }]]
    },
    layout: {
      hLineWidth: () => 0.45,
      vLineWidth: () => 0.45,
      hLineColor: () => "#B9C3CF",
      vLineColor: () => "#B9C3CF"
    },
    margin: [0, 4, 0, 10]
  }] : [])
];

const coverFrame = () => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
    <defs>
      <radialGradient id="paper" cx="50%" cy="28%" r="86%">
        <stop offset="0%" stop-color="#FFFDF8"/>
        <stop offset="58%" stop-color="#FBF6EA"/>
        <stop offset="100%" stop-color="#F2E8D3"/>
      </radialGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#8F661F"/>
        <stop offset="32%" stop-color="#E6C56F"/>
        <stop offset="60%" stop-color="#B9892F"/>
        <stop offset="100%" stop-color="#F1D78A"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="51%" r="48%">
        <stop offset="0%" stop-color="#F7D985" stop-opacity=".28"/>
        <stop offset="100%" stop-color="#F7D985" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="595" height="842" fill="url(#paper)"/>
    <rect width="595" height="842" fill="url(#glow)"/>

    <rect x="19" y="19" width="557" height="804" rx="8" fill="none" stroke="#A97927" stroke-width="1.1"/>
    <rect x="25" y="25" width="545" height="792" rx="7" fill="none" stroke="#D9BA68" stroke-width=".45"/>

    <g opacity=".11" fill="#A4782D" font-family="Georgia, serif" text-anchor="middle">
      <text x="91" y="164" font-size="54">9</text>
      <text x="155" y="121" font-size="30">9</text>
      <text x="448" y="121" font-size="30">6</text>
      <text x="508" y="164" font-size="54">6</text>
      <text x="85" y="694" font-size="48">6</text>
      <text x="511" y="694" font-size="48">9</text>
    </g>

    <g fill="none" stroke="#B5893F">
      <circle cx="297.5" cy="87" r="31" stroke-width=".65" opacity=".55"/>
      <circle cx="297.5" cy="87" r="20" stroke-width=".45" opacity=".42"/>
      <path d="M287 70 A19 19 0 1 0 287 104 A15 15 0 1 1 287 70Z" fill="#C39B4D" stroke="none" opacity=".78"/>
      <path d="M297.5 50 V60 M297.5 114 V124 M260 87 H271 M324 87 H335" stroke-width=".7" opacity=".58"/>
    </g>
    <g fill="#A97927" opacity=".86">
      <path d="M297.5 71 L300.7 82.8 L312.5 86 L300.7 89.2 L297.5 101 L294.3 89.2 L282.5 86 L294.3 82.8Z"/>
      <circle cx="297.5" cy="44" r="1.5"/><circle cx="289" cy="44" r=".8"/><circle cx="306" cy="44" r=".8"/>
    </g>

    <g stroke="#A97927" fill="none" opacity=".72">
      <path d="M44 63 H212 M383 63 H551" stroke-width=".55"/>
      <path d="M44 779 H212 M383 779 H551" stroke-width=".55"/>
      <path d="M46 63 C56 54 66 48 78 44 M549 63 C539 54 529 48 517 44" stroke-width=".65"/>
      <path d="M46 779 C56 788 66 794 78 798 M549 779 C539 788 529 794 517 798" stroke-width=".65"/>
    </g>

    <g fill="#B98A34" opacity=".54">
      <circle cx="54" cy="54" r="5"/><circle cx="541" cy="54" r="5"/>
      <circle cx="54" cy="788" r="5"/><circle cx="541" cy="788" r="5"/>
    </g>

    <g transform="translate(50 640)" opacity=".80">
      <g fill="url(#gold)" stroke="#9D7126" stroke-width=".45">
        <rect x="0" y="51" width="47" height="8" rx="4"/><ellipse cx="23.5" cy="51" rx="23.5" ry="4"/>
        <rect x="4" y="41" width="42" height="8" rx="4"/><ellipse cx="25" cy="41" rx="21" ry="4"/>
        <rect x="8" y="31" width="38" height="8" rx="4"/><ellipse cx="27" cy="31" rx="19" ry="4"/>
        <rect x="15" y="21" width="31" height="8" rx="4"/><ellipse cx="30.5" cy="21" rx="15.5" ry="4"/>
      </g>
      <g transform="translate(55 25)">
        <polygon points="0,24 39,17 49,40 9,47" fill="#D7AB4D" stroke="#9B6B20" stroke-width=".7"/>
        <polygon points="8,9 45,2 55,25 17,31" fill="#E9C66D" stroke="#9B6B20" stroke-width=".7"/>
      </g>
    </g>

    <g transform="translate(445 640)" opacity=".80">
      <g fill="url(#gold)" stroke="#9D7126" stroke-width=".45">
        <rect x="50" y="51" width="47" height="8" rx="4"/><ellipse cx="73.5" cy="51" rx="23.5" ry="4"/>
        <rect x="50" y="41" width="42" height="8" rx="4"/><ellipse cx="71" cy="41" rx="21" ry="4"/>
        <rect x="50" y="31" width="38" height="8" rx="4"/><ellipse cx="69" cy="31" rx="19" ry="4"/>
        <rect x="50" y="21" width="31" height="8" rx="4"/><ellipse cx="65.5" cy="21" rx="15.5" ry="4"/>
      </g>
      <g transform="translate(0 25)">
        <polygon points="0,24 39,17 49,40 9,47" fill="#D7AB4D" stroke="#9B6B20" stroke-width=".7"/>
        <polygon points="8,9 45,2 55,25 17,31" fill="#E9C66D" stroke="#9B6B20" stroke-width=".7"/>
      </g>
    </g>

    <g transform="translate(297.5 701)" opacity=".78">
      <polygon points="0,-23 29,-4 18,24 -18,24 -29,-4" fill="#FFFDF8" stroke="#CDA64F" stroke-width=".9"/>
      <path d="M-29 -4 L29 -4 M-18 24 L0 -23 L18 24 M-29 -4 L0 24 L29 -4" fill="none" stroke="#D9BB72" stroke-width=".55"/>
    </g>

    <g fill="#F7F0DE" stroke="#B88B39" stroke-width=".55" opacity=".95">
      <circle cx="97" cy="740" r="6"/><circle cx="111" cy="746" r="5.5"/><circle cx="126" cy="750" r="5"/>
      <circle cx="498" cy="740" r="6"/><circle cx="484" cy="746" r="5.5"/><circle cx="469" cy="750" r="5"/>
    </g>

    <g fill="#B78A3A" opacity=".17" font-family="Georgia, serif" text-anchor="middle">
      <text x="297.5" y="803" font-size="12" letter-spacing="7">9 · 9 · 6 · 6</text>
    </g>
  </svg>`
});

const innerFrame = () => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
    <defs>
      <radialGradient id="innerPaper" cx="25%" cy="12%" r="95%">
        <stop offset="0%" stop-color="#FFFDF9"/>
        <stop offset="62%" stop-color="#FBF8F0"/>
        <stop offset="100%" stop-color="#F5EFE2"/>
      </radialGradient>
    </defs>
    <rect width="595" height="842" fill="url(#innerPaper)"/>
    <rect x="20" y="20" width="555" height="802" rx="8" fill="none" stroke="#B88A36" stroke-width=".72"/>
    <rect x="27" y="27" width="541" height="788" rx="7" fill="none" stroke="#DCC579" stroke-width=".28"/>

    <g opacity=".047" fill="#8E6729" font-family="Georgia, serif" text-anchor="middle">
      <text x="76" y="150" font-size="62">9</text>
      <text x="519" y="150" font-size="62">9</text>
      <text x="76" y="710" font-size="62">6</text>
      <text x="519" y="710" font-size="62">6</text>
    </g>

    <g fill="#A97D30" opacity=".42">
      <circle cx="297.5" cy="36" r="1.8"/><circle cx="289" cy="36" r=".9"/><circle cx="306" cy="36" r=".9"/>
      <circle cx="297.5" cy="806" r="1.8"/><circle cx="289" cy="806" r=".9"/><circle cx="306" cy="806" r=".9"/>
    </g>

    <g fill="#A97D30" opacity=".10" font-family="Georgia, serif" text-anchor="middle">
      <text x="297.5" y="810" font-size="10" letter-spacing="6">9 · 9 · 6 · 6</text>
    </g>
  </svg>`
});

const coverTitleSvg = () => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="455" height="138" viewBox="0 0 455 138">
    <g font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
      <text x="227.5" y="54" font-size="47" fill="#13253D">ЛИЧНЫЙ КОД</text>
      <text x="227.5" y="119" font-size="58" fill="#A7782C">БОГАТСТВА</text>
    </g>
    <path d="M115 134 H205 M250 134 H340" stroke="#B88A36" stroke-width=".7"/>
    <path d="M227.5 127 L231 134 L227.5 141 L224 134Z" fill="#B88A36"/>
  </svg>`,
  width: 455,
  height: 138,
  alignment: "center"
});

const wealthCodeSvg = (code) => {
  const safeCode = escXml(code);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="455" height="210" viewBox="0 0 455 210">
      <defs>
        <linearGradient id="codeGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#7D571C"/>
          <stop offset="26%" stop-color="#D3AD50"/>
          <stop offset="52%" stop-color="#F0D88E"/>
          <stop offset="76%" stop-color="#A67322"/>
          <stop offset="100%" stop-color="#D7B45C"/>
        </linearGradient>
      </defs>
      <circle cx="227.5" cy="104" r="91" fill="none" stroke="#D9BF79" stroke-width=".7"/>
      <circle cx="227.5" cy="104" r="78" fill="none" stroke="#C79A45" stroke-width=".35" stroke-dasharray="2 5"/>
      <path d="M227.5 6 V28 M227.5 180 V202 M126 104 H150 M305 104 H329" stroke="#C79A45" stroke-width=".55" opacity=".72"/>
      <g fill="#B88A36">
        <path d="M227.5 24 L231 34 L241 37.5 L231 41 L227.5 51 L224 41 L214 37.5 L224 34Z" opacity=".74"/>
        <path d="M227.5 157 L230.2 165 L238 167.7 L230.2 170.4 L227.5 178 L224.8 170.4 L217 167.7 L224.8 165Z" opacity=".54"/>
      </g>
      <text x="227.5" y="128" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="92" font-weight="700" fill="url(#codeGold)">${safeCode}</text>
    </svg>`,
    width: 455,
    height: 210,
    alignment: "center"
  };
};

const buildDocument = ({ birthDate, code, sections }) => ({
  info: {
    title: `Личный код богатства ${code}`,
    subject: "Персональная денежная формула"
  },
  pageSize: "A4",
  pageMargins: [70, 78, 70, 82],
  background: (page) => page === 1 ? coverFrame() : innerFrame(),
  defaultStyle: { font: "Roboto", fontSize: 16.5, color: "#263B52", lineHeight: 1.38 },
  styles: {
    coverBrand: {
      fontSize: 11,
      bold: true,
      color: "#9A722B",
      characterSpacing: 2.3,
      alignment: "center"
    },
    coverSubtitle: {
      fontSize: 16,
      color: "#263B52",
      characterSpacing: 1.6,
      alignment: "center"
    },
    coverDetails: {
      fontSize: 15,
      bold: true,
      color: "#75541E",
      alignment: "center"
    },
    innerKicker: {
      fontSize: 11,
      bold: true,
      color: "#9A722B",
      characterSpacing: 1.45,
      alignment: "center",
      margin: [0, 0, 0, 10]
    },
    title: {
      fontSize: 32,
      bold: true,
      color: "#162B47",
      alignment: "center",
      margin: [0, 0, 0, 12]
    },
    subtitle: {
      fontSize: 15.5,
      color: "#657083",
      alignment: "center",
      lineHeight: 1.35,
      margin: [16, 0, 16, 24]
    },
    sectionKicker: {
      fontSize: 10.5,
      bold: true,
      color: "#A1742D",
      characterSpacing: 1.15,
      margin: [0, 0, 0, 8]
    },
    sectionTitle: {
      fontSize: 25,
      bold: true,
      color: "#182F4A",
      margin: [0, 0, 0, 12]
    },
    subsectionTitle: {
      fontSize: 20,
      bold: true,
      color: "#8A6222",
      margin: [0, 20, 0, 8]
    },
    paragraph: {
      fontSize: 16.5,
      color: "#34495F",
      lineHeight: 1.4,
      margin: [0, 0, 0, 15]
    },
    ritualTitle: {
      fontSize: 17,
      bold: true,
      color: "#805A1F",
      margin: [0, 0, 0, 8]
    },
    ritualText: {
      fontSize: 15.5,
      color: "#4B4A43",
      lineHeight: 1.36,
      margin: [0, 0, 0, 10]
    },
    advice: {
      fontSize: 14.5,
      italics: true,
      color: "#45566A",
      lineHeight: 1.35
    },
    ctaTitle: {
      fontSize: 23,
      bold: true,
      color: "#182F4A",
      lineHeight: 1.2,
      margin: [0, 0, 0, 13]
    },
    ctaCopy: {
      fontSize: 15,
      color: "#34495F",
      lineHeight: 1.38,
      margin: [0, 0, 0, 13]
    },
    ctaGift: {
      fontSize: 15.5,
      bold: true,
      color: "#7C591E",
      lineHeight: 1.35,
      margin: [0, 4, 0, 14]
    },
    telegramLink: {
      fontSize: 17,
      bold: true,
      color: "#193655",
      decoration: "underline",
      margin: [0, 0, 0, 18]
    }
  },
  content: [
    {
      stack: [
        { text: "НУМЕРОЛОГИЯ ONLINE", style: "coverBrand", margin: [0, 56, 0, 28] },
        { ...coverTitleSvg(), margin: [0, 0, 0, 12] },
        { text: "ваша личная денежная формула", style: "coverSubtitle", margin: [0, 0, 0, 5] },
        { ...wealthCodeSvg(code), margin: [0, 1, 0, 6] },
        { text: `Дата рождения · ${formatDate(birthDate)}`, style: "coverDetails", margin: [0, 0, 0, 8] },
        { text: "9 · 9 · 6 · 6", fontSize: 9.5, color: "#B9A37D", characterSpacing: 2.4, alignment: "center" }
      ],
      pageBreak: "after"
    },
    { text: "ВАШ ЛИЧНЫЙ РЕЗУЛЬТАТ", style: "innerKicker" },
    { text: `Код богатства ${code}`, style: "title" },
    {
      text: "Сохраните этот разбор, чтобы возвращаться к нему в моменты денежных решений, новых целей и больших перемен.",
      style: "subtitle"
    },
    {
      canvas: [
        { type: "line", x1: 110, y1: 0, x2: 360, y2: 0, lineWidth: 0.7, lineColor: "#D0B064" }
      ],
      margin: [0, 0, 0, 4]
    },
    ...sections.flatMap(createSection),
    {
      table: {
        widths: ["*"],
        body: [[{
          fillColor: "#F8F0DD",
          margin: [20, 18, 20, 18],
          stack: [
            { text: "ПРОДОЛЖИТЬ ЛИЧНЫЙ РАЗБОР", style: "sectionKicker" },
            { text: "Что откроется в полном личном разборе", style: "ctaTitle" },
            {
              text: "Как вам легче включить денежный поток. Вы увидите свои денежные качества, решения и внутренние точки, через которые доход начинает двигаться легче.",
              style: "ctaCopy"
            },
            {
              text: "Где вам легче всего заработать. Нумерология показывает сильные направления, форматы работы и способы получать деньги без постоянного выжимания себя.",
              style: "ctaCopy"
            },
            {
              text: "Какие уроки вы проходите на пути к богатству. Это помогает заметить сценарии, из-за которых вы обесцениваете себя, боитесь назвать цену или не удерживаете деньги.",
              style: "ctaCopy"
            },
            {
              text: "При заказе полного личного разбора вы получаете в подарок разборы 2026 и 2027 годов, а также 10 денежных ритуалов с вашим личным кодом.",
              style: "ctaGift"
            },
            {
              text: "Написать Татьяне в Telegram",
              style: "telegramLink",
              link: `https://t.me/Kod_9966?text=${encodeURIComponent("Татьяна, добрый день! Хочу заказать у вас полный личный разбор судьбы и своей жизни. Подскажите, пожалуйста, как можно записаться и какая стоимость на данный момент?")}`
            }
          ]
        }]]
      },
      layout: {
        hLineWidth: () => 0.75,
        vLineWidth: () => 0.75,
        hLineColor: () => "#D1AE5E",
        vLineColor: () => "#D1AE5E"
      },
      margin: [0, 26, 0, 10]
    }
  ],
  footer: (page, pages) => page === 1 ? null : ({
    text: `Нумерология Онлайн · ${page - 1} / ${pages - 1}`,
    alignment: "center",
    color: "#9D8357",
    fontSize: 8.5,
    margin: [0, 12, 0, 0]
  })
});

export const createMoneyPdfButton = ({ birthDate, code, sections }) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "destiny-code-pdf-button";
  button.textContent = "Сохранить результат в PDF ↓";
  button.setAttribute("aria-label", "Сохранить расчёт кода богатства в PDF");
  button.style.cssText = "width:100%;min-height:58px;border:1px solid #b9833c;border-radius:18px;background:#fff6e5;color:#754316;font:800 16px/1.2 inherit;cursor:pointer";

  button.addEventListener("click", async () => {
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Собираем ваш PDF…";

    try {
      const pdfMake = await getPdfMake();
      pdfMake.createPdf(buildDocument({ birthDate, code, sections })).download(`Код богатства ${code}.pdf`);
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
