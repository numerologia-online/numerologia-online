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
        <stop offset="0%" stop-color="#8A611B"/>
        <stop offset="28%" stop-color="#E7C66A"/>
        <stop offset="55%" stop-color="#B17E25"/>
        <stop offset="78%" stop-color="#F1D789"/>
        <stop offset="100%" stop-color="#9A6A1E"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="49%" r="52%">
        <stop offset="0%" stop-color="#F2CF70" stop-opacity=".34"/>
        <stop offset="55%" stop-color="#F5DFA7" stop-opacity=".12"/>
        <stop offset="100%" stop-color="#F7D985" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="595" height="842" fill="url(#paper)"/>
    <rect width="595" height="842" fill="url(#glow)"/>

    <rect x="19" y="19" width="557" height="804" rx="8" fill="none" stroke="#9C7023" stroke-width="1.15"/>
    <rect x="25" y="25" width="545" height="792" rx="7" fill="none" stroke="#D7B661" stroke-width=".45"/>

    <g opacity=".085" fill="#9B7027" font-family="Arial, sans-serif" text-anchor="middle">
      <text x="76" y="224" font-size="30">$</text>
      <text x="519" y="224" font-size="30">€</text>
      <text x="77" y="535" font-size="27">£</text>
      <text x="519" y="535" font-size="27">₽</text>
    </g>

    <g opacity=".10" fill="#A4782D" font-family="Georgia, serif" text-anchor="middle">
      <text x="91" y="164" font-size="54">9</text>
      <text x="155" y="121" font-size="30">9</text>
      <text x="448" y="121" font-size="30">6</text>
      <text x="508" y="164" font-size="54">6</text>
      <text x="86" y="692" font-size="44">6</text>
      <text x="509" y="692" font-size="44">9</text>
    </g>

    <g fill="none" stroke="#B5893F">
      <circle cx="297.5" cy="87" r="34" stroke-width=".65" opacity=".58"/>
      <circle cx="297.5" cy="87" r="22" stroke-width=".42" opacity=".46"/>
      <circle cx="297.5" cy="87" r="44" stroke-width=".28" stroke-dasharray="2 6" opacity=".42"/>
      <path d="M287 70 A19 19 0 1 0 287 104 A15 15 0 1 1 287 70Z" fill="#C39B4D" stroke="none" opacity=".76"/>
      <path d="M297.5 43 V59 M297.5 115 V131 M252 87 H270 M325 87 H343" stroke-width=".7" opacity=".58"/>
      <path d="M266 55 L276 65 M329 55 L319 65 M266 119 L276 109 M329 119 L319 109" stroke-width=".45" opacity=".42"/>
    </g>
    <g fill="#A97927" opacity=".88">
      <path d="M297.5 67 L301.2 80.3 L314.5 84 L301.2 87.7 L297.5 101 L293.8 87.7 L280.5 84 L293.8 80.3Z"/>
      <circle cx="297.5" cy="38" r="1.5"/><circle cx="289" cy="38" r=".8"/><circle cx="306" cy="38" r=".8"/>
      <circle cx="253" cy="58" r="1.2"/><circle cx="342" cy="58" r="1.2"/>
      <circle cx="253" cy="116" r="1.2"/><circle cx="342" cy="116" r="1.2"/>
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

    <!-- light constellation / abundance sparkles -->
    <g fill="#B6812A">
      <circle cx="125" cy="305" r="1.2" opacity=".34"/>
      <circle cx="159" cy="327" r="1.6" opacity=".46"/>
      <circle cx="438" cy="305" r="1.2" opacity=".34"/>
      <circle cx="472" cy="327" r="1.6" opacity=".46"/>
      <circle cx="117" cy="431" r="1.1" opacity=".28"/>
      <circle cx="478" cy="431" r="1.1" opacity=".28"/>
      <path d="M137 354 L140 363 L149 366 L140 369 L137 378 L134 369 L125 366 L134 363Z" opacity=".33"/>
      <path d="M458 354 L461 363 L470 366 L461 369 L458 378 L455 369 L446 366 L455 363Z" opacity=".33"/>
      <path d="M297.5 581 L300 588 L307 590.5 L300 593 L297.5 600 L295 593 L288 590.5 L295 588Z" opacity=".32"/>
    </g>

    <!-- scattered coins, deliberately irregular rather than blocky -->
    <g fill="url(#gold)" stroke="#9A6B1D" stroke-width=".55" opacity=".88">
      <ellipse cx="77" cy="704" rx="18" ry="6"/>
      <ellipse cx="96" cy="718" rx="15" ry="5"/>
      <ellipse cx="120" cy="700" rx="12" ry="4.5"/>
      <ellipse cx="139" cy="724" rx="10" ry="3.8"/>
      <ellipse cx="62" cy="731" rx="11" ry="4"/>
      <ellipse cx="151" cy="686" rx="8" ry="3.2"/>
      <ellipse cx="518" cy="704" rx="18" ry="6"/>
      <ellipse cx="499" cy="718" rx="15" ry="5"/>
      <ellipse cx="475" cy="700" rx="12" ry="4.5"/>
      <ellipse cx="456" cy="724" rx="10" ry="3.8"/>
      <ellipse cx="533" cy="731" rx="11" ry="4"/>
      <ellipse cx="444" cy="686" rx="8" ry="3.2"/>
    </g>
    <g fill="none" stroke="#F1D995" stroke-width=".55" opacity=".78">
      <ellipse cx="77" cy="704" rx="12" ry="3.5"/>
      <ellipse cx="96" cy="718" rx="9" ry="2.8"/>
      <ellipse cx="518" cy="704" rx="12" ry="3.5"/>
      <ellipse cx="499" cy="718" rx="9" ry="2.8"/>
    </g>

    <!-- two simple old-money bullion bars -->
    <g opacity=".86">
      <g transform="translate(113 742) rotate(-7)">
        <path d="M0 10 L12 0 H67 L78 10 L69 31 H9 Z" fill="url(#gold)" stroke="#96691E" stroke-width=".75"/>
        <path d="M12 6 H65" stroke="#F5E0A1" stroke-width=".65" opacity=".84"/>
        <circle cx="39" cy="18" r="5" fill="none" stroke="#8E631E" stroke-width=".6"/>
      </g>
      <g transform="translate(404 742) rotate(7)">
        <path d="M0 10 L12 0 H67 L78 10 L69 31 H9 Z" fill="url(#gold)" stroke="#96691E" stroke-width=".75"/>
        <path d="M12 6 H65" stroke="#F5E0A1" stroke-width=".65" opacity=".84"/>
        <circle cx="39" cy="18" r="5" fill="none" stroke="#8E631E" stroke-width=".6"/>
      </g>
    </g>

    <!-- central gem / talisman -->
    <g transform="translate(297.5 718)" opacity=".84">
      <polygon points="0,-24 28,-5 18,23 -18,23 -28,-5" fill="#FFFDF8" stroke="#C49A43" stroke-width=".9"/>
      <path d="M-28 -5 L28 -5 M-18 23 L0 -24 L18 23 M-28 -5 L0 23 L28 -5" fill="none" stroke="#D7B970" stroke-width=".55"/>
      <circle cx="0" cy="0" r="34" fill="none" stroke="#D1B15F" stroke-width=".35" stroke-dasharray="2 5" opacity=".58"/>
    </g>

    <!-- pearl strands -->
    <g fill="#F9F3E6" stroke="#AF8335" stroke-width=".45" opacity=".96">
      <circle cx="185" cy="751" r="5.2"/><circle cx="198" cy="756" r="5"/><circle cx="212" cy="759" r="4.8"/><circle cx="227" cy="761" r="4.6"/>
      <circle cx="410" cy="751" r="5.2"/><circle cx="397" cy="756" r="5"/><circle cx="383" cy="759" r="4.8"/><circle cx="368" cy="761" r="4.6"/>
    </g>

    <g fill="#B78A3A" opacity=".15" font-family="Georgia, serif" text-anchor="middle">
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="455" height="226" viewBox="0 0 455 226">
      <defs>
        <linearGradient id="codeGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#714A11"/>
          <stop offset="23%" stop-color="#D2A845"/>
          <stop offset="46%" stop-color="#F3DD98"/>
          <stop offset="62%" stop-color="#A66F1D"/>
          <stop offset="82%" stop-color="#E4C26A"/>
          <stop offset="100%" stop-color="#835816"/>
        </linearGradient>
        <radialGradient id="codeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#F1CF73" stop-opacity=".30"/>
          <stop offset="100%" stop-color="#F1CF73" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <circle cx="227.5" cy="112" r="104" fill="url(#codeGlow)"/>
      <circle cx="227.5" cy="112" r="98" fill="none" stroke="#D6BA72" stroke-width=".65" opacity=".74"/>
      <circle cx="227.5" cy="112" r="86" fill="none" stroke="#C49740" stroke-width=".38" stroke-dasharray="2 5" opacity=".78"/>
      <circle cx="227.5" cy="112" r="72" fill="none" stroke="#E0C98D" stroke-width=".32" opacity=".72"/>

      <path d="M227.5 3 V29 M227.5 195 V221 M109 112 H139 M316 112 H346" stroke="#C3943C" stroke-width=".58" opacity=".72"/>
      <path d="M145 30 L163 48 M310 30 L292 48 M145 194 L163 176 M310 194 L292 176" stroke="#C3943C" stroke-width=".45" opacity=".45"/>

      <g fill="none" stroke="#B98A34" stroke-width=".38" opacity=".64">
        <path d="M146 112 A81 81 0 0 1 227.5 31"/>
        <path d="M309 112 A81 81 0 0 1 227.5 193"/>
        <path d="M227.5 31 A81 81 0 0 1 309 112"/>
        <path d="M227.5 193 A81 81 0 0 1 146 112"/>
      </g>

      <g fill="#B5832F">
        <path d="M227.5 15 L231.5 27.5 L244 31.5 L231.5 35.5 L227.5 48 L223.5 35.5 L211 31.5 L223.5 27.5Z" opacity=".82"/>
        <path d="M227.5 176 L230.2 184 L238 186.7 L230.2 189.4 L227.5 197 L224.8 189.4 L217 186.7 L224.8 184Z" opacity=".60"/>
        <path d="M129 112 L131.5 119 L138.5 121.5 L131.5 124 L129 131 L126.5 124 L119.5 121.5 L126.5 119Z" opacity=".43"/>
        <path d="M326 112 L328.5 119 L335.5 121.5 L328.5 124 L326 131 L323.5 124 L316.5 121.5 L323.5 119Z" opacity=".43"/>
        <circle cx="151" cy="60" r="1.4"/><circle cx="304" cy="60" r="1.4"/>
        <circle cx="151" cy="164" r="1.4"/><circle cx="304" cy="164" r="1.4"/>
        <circle cx="119" cy="78" r=".9"/><circle cx="336" cy="78" r=".9"/>
        <circle cx="119" cy="146" r=".9"/><circle cx="336" cy="146" r=".9"/>
      </g>

      <g font-family="Arial, sans-serif" text-anchor="middle" fill="#9B722C" opacity=".22">
        <text x="98" y="91" font-size="17">$</text>
        <text x="357" y="91" font-size="17">€</text>
        <text x="98" y="154" font-size="16">£</text>
        <text x="357" y="154" font-size="16">₽</text>
      </g>

      <text x="227.5" y="137" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="92" font-weight="700" fill="url(#codeGold)">${safeCode}</text>
    </svg>`,
    width: 455,
    height: 226,
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
