import { buildFullReportSections, loadFullReportSection } from "./full-report-library.js?v=4";
import { findKarmicPrograms, findKarmicTail } from "./karmic-programs.js?v=3";

// Отдельный модуль PDF: документ, фон, скачивание и кэширование.
export function createFullReportPdfController({getReport, reading, extendContent = null, buttonClass = "matrix-pdf-button"}) {
let pdfMakeLoading;
let preparedFullPdf = null;
let preparingFullPdf = null;
let fullPdfGeneration = 0;


const loadExternalScript = (source) => new Promise((resolve, reject) => {
  const existing = document.querySelector(`script[src="${source}"]`);
  if (existing) {
    if (window.pdfMake) resolve();
    else {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    }
    return;
  }
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


const appendPdfParagraphs = (content, paragraphs = []) => {
  paragraphs.filter(Boolean).forEach((paragraph) => content.push({ text: paragraph, style: "paragraph" }));
};

const fullReportPdfFrame = () => `
  <svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
    <defs>
      <radialGradient id="fullPaper" cx="38%" cy="14%" r="96%">
        <stop offset="0%" stop-color="#FFFEFA"/>
        <stop offset="62%" stop-color="#FCF9F3"/>
        <stop offset="100%" stop-color="#F8F3EA"/>
      </radialGradient>
      <radialGradient id="fullGoldMist" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#E7D9BE" stop-opacity=".07"/>
        <stop offset="100%" stop-color="#DCBF7E" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="fullBlueMist" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#DCE7E4" stop-opacity=".04"/>
        <stop offset="100%" stop-color="#A9C8CF" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="595" height="842" fill="url(#fullPaper)"/>
    <ellipse cx="498" cy="129" rx="184" ry="176" fill="url(#fullBlueMist)"/>
    <ellipse cx="91" cy="710" rx="168" ry="166" fill="url(#fullGoldMist)"/>
    <rect x="18" y="18" width="559" height="806" rx="9" fill="none" stroke="#B98E46" stroke-width=".82"/>
    <rect x="25" y="25" width="545" height="792" rx="7" fill="none" stroke="#DCCCA9" stroke-width=".34"/>

    <!-- light geometry: delicate, outside the reading column -->
    <g fill="none" stroke="#8DAFBA" opacity=".12">
      <circle cx="74" cy="112" r="43" stroke-width=".65"/>
      <circle cx="74" cy="112" r="29" stroke-width=".36" stroke-dasharray="2 5"/>
      <path d="M74 58 V72 M74 152 V166 M20 112 H34 M114 112 H128" stroke-width=".48"/>
      <circle cx="521" cy="688" r="43" stroke-width=".48"/>
      <polygon points="521,654 555,688 521,722 487,688" stroke-width=".45"/>
      <circle cx="521" cy="688" r="23" stroke-width=".28" stroke-dasharray="2 6"/>
    </g>

    <!-- drifting gold and powder-blue digits: an irregular 9 / 9 / 6 / 6 signature -->
    <g font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
      <g fill="#B7995C" opacity=".125">
        <text x="81" y="153" font-size="103" transform="rotate(-14 81 153)">9</text>
        <text x="170" y="91" font-size="35" transform="rotate(19 170 91)">6</text>
        <text x="521" y="164" font-size="119" transform="rotate(12 521 164)">6</text>
        <text x="448" y="86" font-size="46" transform="rotate(-21 448 86)">9</text>
        <text x="73" y="733" font-size="96" transform="rotate(9 73 733)">6</text>
        <text x="174" y="789" font-size="49" transform="rotate(-16 174 789)">9</text>
        <text x="512" y="770" font-size="110" transform="rotate(-15 512 770)">9</text>
        <text x="442" y="797" font-size="35" transform="rotate(20 442 797)">6</text>
      </g>
      <g fill="#A6BFC1" opacity=".095">
        <text x="48" y="333" font-size="54" transform="rotate(12 48 333)">9</text>
        <text x="103" y="508" font-size="79" transform="rotate(-7 103 508)">6</text>
        <text x="40" y="600" font-size="42" transform="rotate(18 40 600)">9</text>
        <text x="547" y="386" font-size="59" transform="rotate(-12 547 386)">6</text>
        <text x="491" y="545" font-size="93" transform="rotate(8 491 545)">9</text>
        <text x="553" y="638" font-size="38" transform="rotate(-17 553 638)">6</text>
      </g>
      <!-- further-away impressions, visible only as a trace through empty space -->
      <g fill="#B89D6B" opacity=".042">
        <text x="279" y="181" font-size="52" transform="rotate(-17 279 181)">9</text>
        <text x="339" y="690" font-size="68" transform="rotate(13 339 690)">6</text>
      </g>
    </g>

    <!-- quiet golden corners and pearlescent dots -->
    <g fill="none" stroke="#BA9049" stroke-width=".52" opacity=".35">
      <path d="M37 56 H151 M444 56 H558 M37 786 H151 M444 786 H558"/>
      <path d="M37 75 Q49 49 76 37 M558 75 Q546 49 519 37"/>
      <path d="M37 767 Q49 793 76 805 M558 767 Q546 793 519 805"/>
    </g>
    <g fill="#B98E46" opacity=".30">
      <circle cx="297.5" cy="34" r="1.8"/><circle cx="288" cy="34" r=".9"/><circle cx="307" cy="34" r=".9"/>
      <circle cx="297.5" cy="808" r="1.8"/><circle cx="288" cy="808" r=".9"/><circle cx="307" cy="808" r=".9"/>
      <circle cx="51" cy="51" r="2"/><circle cx="544" cy="51" r="2"/>
      <circle cx="51" cy="791" r="2"/><circle cx="544" cy="791" r="2"/>
    </g>

    <!-- 9966 signature, placed beyond page content and deliberately understated -->
    <g fill="#A07837" font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
      <text x="297.5" y="805" font-size="13" letter-spacing="5" opacity=".23">9 · 9 · 6 · 6</text>
      <text x="37" y="466" transform="rotate(-90 37 466)" font-size="11" letter-spacing="4" opacity=".12">9 · 9 · 6 · 6</text>
      <text x="558" y="376" transform="rotate(90 558 376)" font-size="11" letter-spacing="4" opacity=".12">9 · 9 · 6 · 6</text>
    </g>
  </svg>`;

const buildPdfMatrixSvg = (data) => {
  const { corners, diagonals, channels } = data;
  const palettes = {
    plain: { fill: "#FFFDF8", stroke: "#2B2730" },
    violet: { fill: "#E6D7EE", stroke: "#7D4D97" },
    rose: { fill: "#F4D3D9", stroke: "#B75C70" },
    blue: { fill: "#D8E5FA", stroke: "#4779B8" },
    sky: { fill: "#D9F0F4", stroke: "#55AFC3" },
    green: { fill: "#DDEEDB", stroke: "#70A968" },
    gold: { fill: "#F4E2AC", stroke: "#B58A38" },
    center: { fill: "#F5D875", stroke: "#C49A2F" }
  };
  const pdfNode = (x, y, value, type = "plain", size = "small") => {
    const palette = palettes[type];
    const radius = size === "major" ? 29 : size === "center" ? 34 : size === "medium" ? 22 : 18;
    const strokeWidth = size === "major" || size === "center" ? 3 : 2;
    const fontSize = size === "center" ? 27 : size === "major" ? 24 : 18;
    const weight = size === "major" || size === "center" ? 700 : 400;
    return `<g><circle cx="${x}" cy="${y}" r="${radius}" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="${strokeWidth}"/><text x="${x}" y="${y + 6}" fill="#1D3654" font-family="Roboto, Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}" text-anchor="middle">${value}</text></g>`;
  };
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 620">
      <g fill="none" stroke="#8F8171" stroke-width="2">
        <polygon points="310,34 506,114 586,310 506,506 310,586 114,506 34,310 114,114"/>
        <rect x="114" y="114" width="392" height="392"/>
        <polygon points="310,34 586,310 310,586 34,310"/>
        <polygon points="310,104 516,310 310,516 104,310"/>
        <circle cx="310" cy="310" r="156"/>
        <line x1="310" y1="68" x2="310" y2="552"/>
        <line x1="68" y1="310" x2="552" y2="310"/>
        <line x1="142" y1="142" x2="478" y2="478" stroke="#5A79B7"/>
        <line x1="142" y1="478" x2="478" y2="142" stroke="#C67883"/>
      </g>
      <line x1="310" y1="462" x2="462" y2="310" stroke="#B4A084" stroke-width="2" stroke-dasharray="6 7"/>
       <text x="325" y="412" font-size="24" fill="#C98398">♥</text>
       <text x="444" y="351" font-size="23" fill="#87935A">$</text>
       ${pdfNode(310, 52, data.top, "violet", "major")}
      ${pdfNode(568, 310, data.right, "rose", "major")}
      ${pdfNode(310, 568, data.bottom, "rose", "major")}
      ${pdfNode(52, 310, data.left, "violet", "major")}
      ${pdfNode(128, 128, corners.topLeft, "plain", "medium")}
      ${pdfNode(492, 128, corners.topRight, "plain", "medium")}
      ${pdfNode(492, 492, corners.bottomRight, "plain", "medium")}
      ${pdfNode(128, 492, corners.bottomLeft, "plain", "medium")}
      ${pdfNode(310, 108, data.topSpoke.outer, "blue")}
      ${pdfNode(310, 158, data.topSpoke.near, "sky")}
      ${pdfNode(310, 216, data.topSpoke.core, "green")}
      ${pdfNode(108, 310, data.leftSpoke.outer, "blue")}
      ${pdfNode(158, 310, data.leftSpoke.near, "sky")}
      ${pdfNode(216, 310, data.leftSpoke.core, "green")}
      ${pdfNode(512, 310, data.rightSpoke.outer)}
      ${pdfNode(462, 310, channels.moneyEntry, "gold")}
      ${pdfNode(404, 310, data.rightSpoke.core)}
      ${pdfNode(310, 462, data.tail.first, "gold")}
      ${pdfNode(310, 512, data.tail.second)}
      ${pdfNode(160, 160, diagonals.topLeft.outer)}
      ${pdfNode(202, 202, diagonals.topLeft.near)}
      ${pdfNode(460, 160, diagonals.topRight.outer)}
      ${pdfNode(418, 202, diagonals.topRight.near)}
      ${pdfNode(460, 460, diagonals.bottomRight.outer)}
      ${pdfNode(418, 418, diagonals.bottomRight.near)}
      ${pdfNode(160, 460, diagonals.bottomLeft.outer)}
      ${pdfNode(202, 418, diagonals.bottomLeft.near)}
       ${pdfNode(348, 424, channels.lovePoint, "rose")}
       ${pdfNode(386, 386, channels.balance)}
       ${pdfNode(424, 348, channels.moneyPoint, "gold")}
       ${pdfNode(310, 310, data.center, "center", "center")}
    </svg>`;
};

const fullReportCoverTitle = () => `
  <svg xmlns="http://www.w3.org/2000/svg" width="483" height="158" viewBox="0 0 483 158">
    <g text-anchor="middle">
      <text x="241.5" y="25" font-family="Roboto, Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="3.5" fill="#9A702F">ПЕРСОНАЛЬНЫЙ</text>

      <g font-family="Georgia, 'Times New Roman', serif" font-weight="700">
        <text x="241" y="80" font-size="54" fill="#D6C7A8" opacity=".55">Полный разбор</text>
        <text x="239.5" y="78" font-size="54" fill="#19364E">Полный разбор</text>
      </g>

      <path d="M103 111 H210 M273 111 H380" stroke="#B98E46" stroke-width=".7"/>
      <path d="M241.5 103 L245 111 L241.5 119 L238 111Z" fill="#B98E46"/>
      <text x="241.5" y="145" font-family="Roboto, Arial, sans-serif" font-size="13" letter-spacing="1.6" fill="#627888">ЛИЧНАЯ КАРТА И РАСШИФРОВКА</text>
    </g>
  </svg>`;

const buildFullReportPdf = async () => {
  if (!getReport()) throw new Error("Нет данных для PDF");
  const { formattedDate, matrixData, karmicPrograms, karmicTails } = getReport();
  const matrixPdfSvg = buildPdfMatrixSvg(matrixData);
  const definitions = buildFullReportSections(matrixData);
  const [pdfMake, records] = await Promise.all([
    getPdfMake(),
    Promise.all(definitions.map(async (definition) => ({
      definition,
      source: (await loadFullReportSection(definition.energy))?.sections?.[definition.key]
    })))
  ]);

  const [day, month, year] = formattedDate.split(".").map(Number);
  const today = new Date();
  const age = today.getFullYear() - year - (
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0
  );
  const tail = findKarmicTail(matrixData, karmicTails);
  const programs = findKarmicPrograms(matrixData, karmicPrograms);

  const content = [
    {
      stack: [
        { svg: fullReportCoverTitle(), width: 483, height: 158, alignment: "center", margin: [0, 0, 0, 10] },
        { svg: matrixPdfSvg, width: 430, height: 430, alignment: "center", margin: [0, 0, 0, 14] },
        { text: `Дата рождения · ${formattedDate}`, style: "coverDate", alignment: "center" },
        { text: `Возраст · ${age} лет`, style: "coverAge", alignment: "center" }
      ],
      margin: [0, 0, 0, 0],
      pageBreak: "after"
    },
    { text: "ВАША ЛИЧНАЯ КАРТА", style: "eyebrow", fontSize: 12 },
    { text: "Ключевые точки", style: "chapter", fontSize: 34, margin: [0, 0, 0, 10] },
    { text: "Эти цифры становятся основой для всех разделов ниже.", style: "chapterLead", fontSize: 18, lineHeight: 1.2, margin: [0, 0, 0, 14] },
    {
      table: {
        widths: ["*", "auto"],
        body: [
          ["День рождения", String(matrixData.left)],
          ["Месяц рождения", String(matrixData.top)],
          ["Энергия года", String(matrixData.right)],
          ["Центральная энергия", String(matrixData.center)],
          ["Что блокирует деньги", String(matrixData.rightSpoke.outer)],
          ["Вход в денежный канал", String(matrixData.channels.moneyEntry)],
          ["Под долларом - заработок", String(matrixData.channels.moneyPoint)],
           ["Вход в отношения", String(matrixData.channels.loveEntry)],
           ["Под сердцем - партнёр", String(matrixData.channels.lovePoint)],
           ["Баланс денег и любви", String(matrixData.channels.balance)],
          ["Кармический хвост", tail ? String(tail.code) : [matrixData.tail.first, matrixData.tail.second, matrixData.bottom].join("-")],
          ["Кармические программы", programs.length ? programs.map((program) => program.code).join(" · ") : "—"],
          ...programs.map((program) => [String(program.code), program.title])
        ]
      },
      layout: {
        hLineWidth: (index) => (index === 0 || index === 10 ? 0.7 : 0.35),
        vLineWidth: () => 0,
        hLineColor: () => "#d7c6a4",
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 7,
        paddingBottom: () => 7,
        fillColor: (rowIndex) => (rowIndex % 2 === 0 ? "#FBF7EE" : "#F5F8F7")
      },
      style: "points", fontSize: 16, lineHeight: 1.15
    }
  ];

  records.forEach(({ definition, source }) => {
    const paragraphs = (source?.paragraphs || []).filter(Boolean);
    content.push({
      stack: [
        { text: `${definition.eyebrow.toUpperCase()} · ЭНЕРГИЯ ${definition.energy}`, style: "eyebrow" },
        { text: source?.title || definition.title, style: "sectionTitle", background: "#EEF3F2" },
        ...paragraphs.slice(0, 1).map((paragraph) => ({ text: paragraph, style: paragraph.length < 90 ? "subheading" : "paragraph" }))
      ],
      margin: [0, 28, 0, 0]
    });
    paragraphs.slice(1).forEach((paragraph) => {
      content.push({ text: paragraph, style: paragraph.length < 90 ? "subheading" : "paragraph" });
    });
  });

  // Optional extra chapters from the interactive matrix. The original PDF stays unchanged.
  if (typeof extendContent === "function") {
    const extra = await extendContent(getReport());
    if (!Array.isArray(extra)) throw new Error("Дополнительные главы PDF не найдены");
    content.push(...extra);
  }

  const documentDefinition = {
    pageSize: "A4",
    pageMargins: [56, 64, 56, 62],
    info: { title: `Полный разбор ${formattedDate}` },
    background: () => ({ svg: fullReportPdfFrame() }),
    content,
    defaultStyle: { font: "Roboto", fontSize: 26, color: "#314454", lineHeight: 1.34 },
    styles: {
      coverDate: { font: "Roboto", fontSize: 18, bold: true, color: "#8E6729", margin: [0, 0, 0, 0] },
      coverAge: { font: "Roboto", fontSize: 17, color: "#19364E", bold: true, margin: [0, 8, 0, 0] },
      chapter: { font: "Roboto", fontSize: 46, bold: true, color: "#19364E", margin: [0, 0, 0, 18] },
      chapterLead: { font: "Roboto", fontSize: 25, color: "#667784", lineHeight: 1.36, margin: [0, 0, 0, 28] },
      eyebrow: { font: "Roboto", fontSize: 15, bold: true, color: "#5D8791", characterSpacing: 1.05, margin: [0, 0, 0, 13] },
      sectionTitle: { font: "Roboto", fontSize: 42, bold: true, color: "#19364E", lineHeight: 1.12, margin: [0, 0, 0, 20] },
      subheading: { font: "Roboto", fontSize: 32, bold: true, color: "#8A672F", lineHeight: 1.16, margin: [0, 18, 0, 12] },
      partTitle: { font: "Roboto", fontSize: 34, bold: true, color: "#8A672F", margin: [0, 26, 0, 12] },
      paragraph: { fontSize: 26, color: "#314454", alignment: "left", lineHeight: 1.34, margin: [0, 0, 0, 22] },
      points: { margin: [0, 0, 0, 0], color: "#314454", fontSize: 22 }
    },
    footer: (page, pages) => ({ text: `Нумерология Онлайн · ${page} / ${pages}`, alignment: "center", color: "#9A8661", fontSize: 8.5, margin: [0, 8, 0, 0] })
  };

  const blob = await new Promise((resolve) => pdfMake.createPdf(documentDefinition).getBlob(resolve));
  return { url: URL.createObjectURL(blob), filename: `Полный разбор ${formattedDate}.pdf` };
};

const getFullPdfKey = () => getReport() ? `${getReport().formattedDate}|full-pdf-9966-v1` : "";

const updateFullPdfButtons = () => {
  const key = getFullPdfKey();
  const ready = Boolean(key && preparedFullPdf?.key === key);
  const preparing = Boolean(key && preparingFullPdf?.key === key);
  reading.querySelectorAll(`.${buttonClass}`).forEach((button) => {
    if (button.dataset.downloading === "1") return;
    const label = ready ? "Скачать PDF" : preparing ? "PDF готовится…" : "Скачать PDF";
    button.innerHTML = `${label} <span aria-hidden="true">↓</span>`;
  });
};

const invalidateFullPdf = () => {
  fullPdfGeneration += 1;
  if (preparedFullPdf?.url) URL.revokeObjectURL(preparedFullPdf.url);
  preparedFullPdf = null;
  preparingFullPdf = null;
};

const prepareFullReportPdf = () => {
  const key = getFullPdfKey();
  if (!key) return Promise.reject(new Error("Нет данных для PDF"));
  if (preparedFullPdf?.key === key) return Promise.resolve(preparedFullPdf);
  if (preparingFullPdf?.key === key) return preparingFullPdf.promise;

  const generation = fullPdfGeneration;
  const promise = buildFullReportPdf().then((file) => {
    if (generation !== fullPdfGeneration || getFullPdfKey() !== key) {
      URL.revokeObjectURL(file.url);
      throw new Error("Расчёт изменился во время подготовки PDF");
    }
    if (preparedFullPdf?.url) URL.revokeObjectURL(preparedFullPdf.url);
    preparedFullPdf = { ...file, key };
    return preparedFullPdf;
  }).finally(() => {
    if (preparingFullPdf?.promise === promise) preparingFullPdf = null;
    updateFullPdfButtons();
  });

  preparingFullPdf = { key, promise };
  updateFullPdfButtons();
  return promise;
};

const warmFullPdfInBackground = () => {
  const key = getFullPdfKey();
  if (!key) return;
  const warm = () => {
    if (getFullPdfKey() !== key) return;
    prepareFullReportPdf().catch((error) => {
      console.warn("Фоновая подготовка полного PDF:", error);
    });
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(warm, { timeout: 900 });
  } else {
    window.setTimeout(warm, 160);
  }
};

const createFullReportPdfButton = (position = "bottom") => {
  const button = document.createElement("button");
  button.className = `${buttonClass} ${buttonClass}--${position}`;
  button.type = "button";
  button.innerHTML = "Скачать PDF <span aria-hidden=\"true\">↓</span>";
  button.addEventListener("click", async () => {
    button.dataset.downloading = "1";
    button.disabled = true;
    button.textContent = "Готовлю PDF…";
    try {
      // Await the same preparation as the background task; never build twice.
      const { url, filename } = await prepareFullReportPdf();
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.append(link);
      link.click();
      link.remove();
      // The URL remains alive for a second download; it is revoked on a new calculation.
    } catch (error) {
      console.error(error);
      alert("PDF пока не удалось подготовить. Проверьте подключение к интернету и попробуйте ещё раз.");
    } finally {
      button.disabled = false;
      delete button.dataset.downloading;
      updateFullPdfButtons();
    }
  });
  return button;
};


  return {invalidateFullPdf,createFullReportPdfButton,warmFullPdfInBackground};
}
