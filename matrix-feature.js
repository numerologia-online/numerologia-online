import { calculateMatrix, parseBirthDate } from "./numerology-core.js?v=1";
import {
  buildFullReportPreview,
  buildFullReportSections,
  loadFullReportKnowledge,
  loadFullReportSection
} from "./full-report-library.js?v=3";
import { findKarmicPrograms, findKarmicTail, loadKarmicPrograms, loadKarmicTails } from "./karmic-programs.js?v=2";

const home = document.querySelector("#home");
const matrix = document.querySelector("#matrix");
const form = document.querySelector("#matrix-form");
const birthDateInput = document.querySelector("#matrix-birth-date");
const error = document.querySelector("#matrix-error");
const result = document.querySelector("#matrix-result");
const resultTitle = document.querySelector("#matrix-result-title");
const diagram = document.querySelector("#matrix-diagram");
const reading = document.querySelector("#matrix-reading");
const backButton = document.querySelector("#back-matrix-home");

let reportSectionControls = new Map();
let reportPreviewControls = new Map();
let karmicProgramControls = new Set();
let pendingMatrixTarget;
let activeFullReport;
let pdfMakeLoading;

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

const nodeRadius = (size) => (size === "major" ? 29 : size === "center" ? 34 : 18);

const node = (x, y, value, type = "plain", size = "small", target = null, label = "", karmicId = "") => `
  <g class="matrix-node matrix-node--${type} matrix-node--${size}${target ? " matrix-node--interactive" : ""}"
    ${target ? `role="button" tabindex="0" data-matrix-target="${target}" aria-label="${label || `Открыть расшифровку: ${value}`}"` : ""}
    ${karmicId ? `data-karmic-node="${karmicId}"` : ""}>
    ${target ? `<circle class="matrix-node-tap-ring" cx="${x}" cy="${y}" r="${nodeRadius(size) + 5}"></circle>` : ""}
    <circle cx="${x}" cy="${y}" r="${nodeRadius(size)}"></circle>
    <text x="${x}" y="${y}">${value}</text>
  </g>`;

const scrollToTarget = (element) => {
  if (!element) return;
  window.requestAnimationFrame(() => {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("matrix-report-section--targeted");
    window.setTimeout(() => element.classList.remove("matrix-report-section--targeted"), 900);
  });
};

const openMatrixTarget = (target) => {
  const section = reportSectionControls.get(target);
  reportSectionControls.forEach((otherSection) => {
    if (otherSection !== section) otherSection.open = false;
  });
  if (section) {
    section.open = true;
    scrollToTarget(section);
    return;
  }
  scrollToTarget(reportPreviewControls.get(target));
};

const activateMatrixTarget = (event) => {
  const target = event.currentTarget.dataset.matrixTarget;
  if (target) openMatrixTarget(target);
};

const bindMatrixTargets = () => {
  diagram.querySelectorAll("[data-matrix-target]").forEach((target) => {
    target.addEventListener("click", activateMatrixTarget);
    target.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activateMatrixTarget(event);
    });
  });
};

const renderMatrix = (data, formattedDate) => {
  const { corners, diagonals } = data;
  diagram.innerHTML = `
    <svg viewBox="0 0 620 620" role="img" aria-labelledby="matrix-svg-title matrix-svg-description">
      <title id="matrix-svg-title">Матрица для даты ${formattedDate}</title>
      <desc id="matrix-svg-description">Симметричная матрица с основными точками, внутренними узлами и кармическим хвостом.</desc>
      <g class="matrix-frame">
        <polygon class="matrix-frame--soft" points="310,34 506,114 586,310 506,506 310,586 114,506 34,310 114,114"></polygon>
        <rect x="114" y="114" width="392" height="392"></rect>
        <polygon points="310,34 586,310 310,586 34,310"></polygon>
        <polygon class="matrix-frame--soft" points="310,104 516,310 310,516 104,310"></polygon>
        <circle cx="310" cy="310" r="156"></circle>
        <line class="matrix-axis matrix-axis--neutral" x1="310" y1="68" x2="310" y2="552"></line>
        <line class="matrix-axis matrix-axis--neutral" x1="68" y1="310" x2="552" y2="310"></line>
        <line class="matrix-axis matrix-axis--blue" x1="142" y1="478" x2="478" y2="142"></line>
        <line class="matrix-axis matrix-axis--rose" x1="142" y1="142" x2="478" y2="478"></line>
      </g>

      ${node(310, 52, data.top, "violet", "major", "period", "Открыть описание текущего возрастного периода", "top")}
      ${node(568, 310, data.right, "rose", "major", "earning", "Открыть раздел о заработке", "right")}
      ${node(310, 568, data.bottom, "rose", "major", "lifeLesson", "Открыть главный урок жизни", "bottom")}
      ${node(52, 310, data.left, "violet", "major", "impression", "Открыть раздел о том, как вас видят другие", "left")}

      ${node(128, 128, corners.topLeft, "plain", "medium", "parentsPain", "Открыть раздел о родительской теме", "topLeft")}
      ${node(492, 128, corners.topRight, "plain", "medium", "partner", "Открыть раздел о подходящем партнёре", "topRight")}
      ${node(492, 492, corners.bottomRight, "plain", "medium", "growth", "Открыть раздел о личном росте", "bottomRight")}
      ${node(128, 492, corners.bottomLeft, "plain", "medium", "trueLove", "Открыть раздел о настоящей любви", "bottomLeft")}

      ${node(310, 108, data.topSpoke.outer, "blue", "small", null, "", "topOuter")}
      ${node(310, 158, data.topSpoke.near, "sky", "small", null, "", "topNear")}
      ${node(310, 216, data.topSpoke.core, "green")}
      ${node(108, 310, data.leftSpoke.outer, "blue", "small", null, "", "leftOuter")}
      ${node(158, 310, data.leftSpoke.near, "sky", "small", null, "", "leftNear")}
      ${node(216, 310, data.leftSpoke.core, "green")}

      ${node(432, 310, data.rightSpoke.outer, "plain", "small", "moneyBlock", "Открыть раздел о денежных блоках", "rightOuter")}
      ${node(382, 310, data.rightSpoke.near, "gold", "small", "moneyFlow", "Открыть раздел о денежном потоке", "rightNear")}
      ${node(356, 356, data.rightSpoke.core, "plain", "small", "earning", "Открыть раздел о заработке")}

      ${node(310, 388, data.tail.first, "gold", "small", "lifeLesson", "Открыть главный урок жизни", "tailFirst")}
      ${node(310, 442, data.tail.second, "plain", "small", "familyError", "Открыть раздел о родовом сценарии", "tailSecond")}

      ${node(186, 186, diagonals.topLeft.outer, "plain", "small", null, "", "topLeftOuter")}
      ${node(230, 230, diagonals.topLeft.near, "plain", "small", null, "", "topLeftNear")}
      ${node(434, 186, diagonals.topRight.outer, "plain", "small", null, "", "topRightOuter")}
      ${node(390, 230, diagonals.topRight.near, "plain", "small", null, "", "topRightNear")}
      ${node(434, 434, diagonals.bottomRight.outer, "plain", "small", null, "", "bottomRightOuter")}
      ${node(390, 390, diagonals.bottomRight.near, "plain", "small", null, "", "bottomRightNear")}
      ${node(186, 434, diagonals.bottomLeft.outer, "plain", "small", null, "", "bottomLeftOuter")}
      ${node(230, 390, diagonals.bottomLeft.near, "plain", "small", null, "", "bottomLeftNear")}

      ${node(310, 310, data.center, "center", "center", "trueSelf", "Открыть раздел о вашей главной энергии")}
    </svg>
    <p class="matrix-diagram-hint">Кружки с двойным контуром можно нажать - они откроют свою расшифровку.</p>`;
  bindMatrixTargets();
};

const showError = (message) => {
  error.textContent = message;
  error.hidden = false;
  result.hidden = true;
};

const renderReading = (cards) => {
  reading.replaceChildren(...cards.map((card) => {
    const article = document.createElement("article");
    article.className = "matrix-reading-card";
  if (card.key) article.dataset.previewKey = card.key;

    const eyebrow = document.createElement("p");
    eyebrow.className = "matrix-reading-eyebrow";
    eyebrow.textContent = card.eyebrow;

    const title = document.createElement("h3");
    title.textContent = card.title;

    article.append(eyebrow, title);
    card.paragraphs.forEach((paragraph) => {
      const text = document.createElement("p");
      text.textContent = paragraph;
      article.append(text);
    });
    return article;
  }));
  reading.hidden = false;
};

const showReadingStatus = (message) => {
  reading.replaceChildren();
  const text = document.createElement("p");
  text.className = "matrix-reading-status";
  text.textContent = message;
  reading.append(text);
  reading.hidden = false;
};

const renderSectionText = (container, definition, source) => {
  container.replaceChildren();
  const title = document.createElement("h4");
  title.textContent = source?.title ?? definition.title;
  container.append(title);

  const paragraphs = Array.isArray(source?.paragraphs) ? source.paragraphs : [];
  paragraphs.filter(Boolean).forEach((paragraph) => {
    const text = document.createElement("p");
    text.textContent = paragraph;
    container.append(text);
  });
};

const createFullSection = (definition) => {
  const details = document.createElement("details");
  details.className = "matrix-report-section";
  const summary = document.createElement("summary");
  const labels = document.createElement("span");
  const eyebrow = document.createElement("small");
  eyebrow.textContent = `${definition.eyebrow} · энергия ${definition.energy}`;
  const title = document.createElement("strong");
  title.textContent = definition.title;
  labels.append(eyebrow, title);
  summary.append(labels);

  const content = document.createElement("div");
  content.className = "matrix-report-section-content";
  let loaded = false;

  details.addEventListener("toggle", async () => {
    if (!details.open) return;
    reportSectionControls.forEach((otherSection) => {
      if (otherSection !== details) otherSection.open = false;
    });
    if (loaded) return;
    const loading = document.createElement("p");
    loading.className = "matrix-report-loading";
    loading.textContent = "Открываю раздел…";
    content.replaceChildren(loading);
    try {
      const energyRecord = await loadFullReportSection(definition.energy);
      renderSectionText(content, definition, energyRecord?.sections?.[definition.key]);
      loaded = true;
    } catch {
      content.replaceChildren();
      const message = document.createElement("p");
      message.className = "matrix-report-loading";
      message.textContent = "Этот раздел пока не загрузился. Обновите страницу и попробуйте ещё раз.";
      content.append(message);
    }
  });

  details.append(summary, content);
  return details;
};

const renderFullSections = (matrixData) => {
  const title = document.createElement("h3");
  title.className = "matrix-report-title";
  title.textContent = "Полный разбор";
  const intro = document.createElement("p");
  intro.className = "matrix-report-intro";
  intro.textContent = "Откройте нужную тему - внутри будет развёрнутая расшифровка по вашей дате.";
  reportSectionControls = new Map();
  const list = document.createElement("div");
  list.className = "matrix-report-sections";
  const sections = buildFullReportSections(matrixData);
  const elements = sections.map((definition) => {
    const section = createFullSection(definition);
    reportSectionControls.set(definition.key, section);
    return section;
  });
  list.append(...elements);
  reading.append(title, intro, list);
};

const appendPdfParagraphs = (content, paragraphs = []) => {
  paragraphs.filter(Boolean).forEach((paragraph) => content.push({ text: paragraph, style: "paragraph" }));
};

const fullReportPdfFrame = () => `
  <svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
    <rect width="595" height="842" fill="#FBF7EE"/>
    <rect x="18" y="18" width="559" height="806" fill="none" stroke="#C8A45D" stroke-width="0.8"/>
    <g fill="#C8A45D" opacity="0.14" font-family="Georgia, serif" text-anchor="middle">
      <text x="72" y="108" font-size="72">9</text><text x="145" y="78" font-size="34">6</text><text x="215" y="120" font-size="25">✦</text>
      <text x="506" y="112" font-size="70">6</text><text x="447" y="80" font-size="32">9</text><text x="380" y="122" font-size="24">✦</text>
      <text x="64" y="430" font-size="30">✦</text><text x="92" y="512" font-size="48">6</text><text x="62" y="596" font-size="24">9</text>
      <text x="531" y="430" font-size="30">✦</text><text x="502" y="514" font-size="48">9</text><text x="533" y="598" font-size="24">6</text>
      <text x="92" y="770" font-size="66">6</text><text x="168" y="802" font-size="30">9</text><text x="238" y="768" font-size="24">✦</text>
      <text x="505" y="770" font-size="68">9</text><text x="430" y="802" font-size="30">6</text><text x="360" y="768" font-size="24">✦</text>
    </g>
    <g fill="#B49354" opacity="0.08" font-family="Georgia, serif" font-size="18" text-anchor="middle">
      <text x="297" y="54">9 · 9 · 6 · 6 · 9 · 9</text>
      <text x="297" y="816">6 · 6 · 9 · 9 · 6 · 6</text>
      <text x="31" y="330" transform="rotate(-90 31 330)">9 · 6 · 9 · 6 · 9</text>
      <text x="564" y="520" transform="rotate(90 564 520)">6 · 9 · 6 · 9 · 6</text>
    </g>
  </svg>`;

const buildPdfMatrixSvg = (data) => {
  const { corners, diagonals } = data;
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
        <line x1="142" y1="478" x2="478" y2="142" stroke="#5A79B7"/>
        <line x1="142" y1="142" x2="478" y2="478" stroke="#C67883"/>
      </g>
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
      ${pdfNode(432, 310, data.rightSpoke.outer)}
      ${pdfNode(382, 310, data.rightSpoke.near, "gold")}
      ${pdfNode(356, 356, data.rightSpoke.core)}
      ${pdfNode(310, 388, data.tail.first, "gold")}
      ${pdfNode(310, 442, data.tail.second)}
      ${pdfNode(186, 186, diagonals.topLeft.outer)}
      ${pdfNode(230, 230, diagonals.topLeft.near)}
      ${pdfNode(434, 186, diagonals.topRight.outer)}
      ${pdfNode(390, 230, diagonals.topRight.near)}
      ${pdfNode(434, 434, diagonals.bottomRight.outer)}
      ${pdfNode(390, 390, diagonals.bottomRight.near)}
      ${pdfNode(186, 434, diagonals.bottomLeft.outer)}
      ${pdfNode(230, 390, diagonals.bottomLeft.near)}
      ${pdfNode(310, 310, data.center, "center", "center")}
    </svg>`;
};

const fullReportCoverTitle = () => `
  <svg xmlns="http://www.w3.org/2000/svg" width="483" height="158" viewBox="0 0 483 158">
    <g text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700">
      <text x="241" y="71" font-size="66" fill="#B9955A" opacity="0.10">Полный</text>
      <text x="241" y="145" font-size="66" fill="#B9955A" opacity="0.10">разбор</text>
      <text x="240" y="70" font-size="66" fill="#7A5A8B" opacity="0.16">Полный</text>
      <text x="240" y="144" font-size="66" fill="#7A5A8B" opacity="0.16">разбор</text>
      <text x="238" y="68" font-size="66" fill="#583D73">Полный</text>
      <text x="238" y="142" font-size="66" fill="#583D73">разбор</text>
    </g>
  </svg>`;

const buildFullReportPdf = async () => {
  if (!activeFullReport) throw new Error("Нет данных для PDF");
  const { formattedDate, matrixData, karmicPrograms, karmicTails } = activeFullReport;
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
          ["Как включить поток", String(matrixData.rightSpoke.near)],
          ["Где легче заработать", String(matrixData.rightSpoke.core)],
          ["Кармический хвост", tail ? String(tail.code) : [matrixData.tail.first, matrixData.tail.second, matrixData.bottom].join("-")],
          ["Кармические программы", programs.length ? programs.map((program) => program.code).join(" · ") : "—"],
          ...programs.map((program) => [String(program.code), program.title])
        ]
      },
      layout: {
        hLineWidth: (index) => (index === 0 || index === 7 ? 0.7 : 0.35),
        vLineWidth: () => 0,
        hLineColor: () => "#d8cfbd",
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 7,
        paddingBottom: () => 7,
        fillColor: (rowIndex) => (rowIndex % 2 === 0 ? "#fcfaf5" : null)
      },
      style: "points", fontSize: 16, lineHeight: 1.15
    }
  ];
  content.push({ text: "", pageBreak: "after" });

  records.forEach(({ definition, source }) => {
    const paragraphs = (source?.paragraphs || []).filter(Boolean);
    content.push({
      stack: [
        { text: `${definition.eyebrow.toUpperCase()} · ЭНЕРГИЯ ${definition.energy}`, style: "eyebrow" },
        { text: source?.title || definition.title, style: "sectionTitle", background: "#E9DDF1" },
        ...paragraphs.slice(0, 1).map((paragraph) => ({ text: paragraph, style: paragraph.length < 90 ? "subheading" : "paragraph" }))
      ],
      margin: [0, 28, 0, 0]
    });
    paragraphs.slice(1).forEach((paragraph) => {
      content.push({ text: paragraph, style: paragraph.length < 90 ? "subheading" : "paragraph" });
    });
  });

  const documentDefinition = {
    pageSize: "A4",
    pageMargins: [56, 64, 56, 62],
    info: { title: `Полный разбор ${formattedDate}` },
    background: () => ({ svg: fullReportPdfFrame() }),
    content,
    defaultStyle: { font: "Roboto", fontSize: 26, color: "#493f53", lineHeight: 1.34 },
    styles: {
      coverDate: { font: "Roboto", fontSize: 18, bold: true, color: "#A06A2D", margin: [0, 0, 0, 0] },
      coverAge: { font: "Roboto", fontSize: 17, color: "#1D3654", bold: true, margin: [0, 8, 0, 0] },
      chapter: { font: "Roboto", fontSize: 46, bold: true, color: "#4D286B", margin: [0, 0, 0, 18] },
      chapterLead: { font: "Roboto", fontSize: 25, color: "#6d6376", lineHeight: 1.36, margin: [0, 0, 0, 28] },
      eyebrow: { font: "Roboto", fontSize: 15, bold: true, color: "#087C82", characterSpacing: 1.05, margin: [0, 0, 0, 13] },
      sectionTitle: { font: "Roboto", fontSize: 42, bold: true, color: "#5B2A78", lineHeight: 1.12, margin: [0, 0, 0, 20] },
      subheading: { font: "Roboto", fontSize: 32, bold: true, color: "#8C5B20", lineHeight: 1.16, margin: [0, 18, 0, 12] },
      partTitle: { font: "Roboto", fontSize: 34, bold: true, color: "#8C5B20", margin: [0, 26, 0, 12] },
      paragraph: { fontSize: 26, alignment: "left", lineHeight: 1.34, margin: [0, 0, 0, 22] },
      points: { margin: [0, 0, 0, 0], color: "#493f53", fontSize: 22 }
    },
    footer: (page, pages) => ({ text: `Нумерология Онлайн · ${page} / ${pages}`, alignment: "center", color: "#a089a8", fontSize: 8.5, margin: [0, 8, 0, 0] })
  };

  const blob = await new Promise((resolve) => pdfMake.createPdf(documentDefinition).getBlob(resolve));
  return { url: URL.createObjectURL(blob), filename: `Полный разбор ${formattedDate}.pdf` };
};

const createFullReportPdfButton = (position = "bottom") => {
  const button = document.createElement("button");
  button.className = `matrix-pdf-button matrix-pdf-button--${position}`;
  button.type = "button";
  button.innerHTML = "Скачать PDF <span aria-hidden=\"true\">↓</span>";
  button.addEventListener("click", async () => {
    const label = button.innerHTML;
    button.disabled = true;
    button.textContent = "Готовлю PDF…";
    try {
      const { url, filename } = await buildFullReportPdf();
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      alert("PDF пока не удалось подготовить. Проверьте подключение к интернету и попробуйте ещё раз.");
    } finally {
      button.disabled = false;
      button.innerHTML = label;
    }
  });
  return button;
};

const repeatLabel = (count) => {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `Повторяется ${count} раз`;
  if (lastDigit === 1) return `Повторяется ${count} раз`;
  if (lastDigit >= 2 && lastDigit <= 4) return `Повторяется ${count} раза`;
  return `Повторяется ${count} раз`;
};

const clearKarmicHighlight = () => {
  const svg = diagram.querySelector("svg");
  if (!svg) return;
  svg.classList.remove("matrix-has-karmic-focus");
  svg.querySelectorAll(".matrix-node--karmic-active").forEach((nodeElement) => nodeElement.classList.remove("matrix-node--karmic-active"));
  svg.querySelectorAll(".matrix-karmic-trace").forEach((trace) => trace.remove());
};

const highlightKarmicProgram = (matches = []) => {
  const svg = diagram.querySelector("svg");
  if (!svg) return;
  clearKarmicHighlight();
  const nodeIds = [...new Set(matches.flatMap((match) => match.nodes ?? []))];
  const nodes = nodeIds
    .map((id) => svg.querySelector(`[data-karmic-node="${id}"]`))
    .filter(Boolean);
  if (!nodes.length) return;
  svg.classList.add("matrix-has-karmic-focus");
  nodes.forEach((nodeElement) => nodeElement.classList.add("matrix-node--karmic-active"));

  matches.filter((match) => (match.nodes ?? []).length === 3).forEach((match) => {
    const points = match.nodes
      .map((id) => svg.querySelector(`[data-karmic-node="${id}"] circle:not(.matrix-node-tap-ring)`))
      .filter(Boolean)
      .map((circle) => `${circle.getAttribute("cx")},${circle.getAttribute("cy")}`);
    if (points.length !== 3) return;
    const trace = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    trace.classList.add("matrix-karmic-trace");
    trace.setAttribute("points", points.join(" "));
    svg.append(trace);
  });
};

const createKarmicCard = (program, label, open = false) => {
  const details = document.createElement("details");
  details.className = "matrix-karmic-card";
  details.open = open;
  const summary = document.createElement("summary");
  const labels = document.createElement("span");
  const marker = document.createElement("small");
  marker.textContent = label;
  const programTitle = document.createElement("strong");
  programTitle.textContent = `${program.code} ${program.title}`;
  labels.append(marker, programTitle);
  summary.append(labels);

  const content = document.createElement("div");
  content.className = "matrix-karmic-content";
  program.parts.forEach((part) => {
    const partTitle = document.createElement("h4");
    partTitle.textContent = part.title;
    const text = document.createElement("p");
    text.textContent = part.text;
    content.append(partTitle, text);
  });
  details.addEventListener("toggle", () => {
    if (!details.open) {
      requestAnimationFrame(() => {
        if (![...karmicProgramControls].some((card) => card.open)) clearKarmicHighlight();
      });
      return;
    }
    karmicProgramControls.forEach((other) => {
      if (other !== details) other.open = false;
    });
    highlightKarmicProgram(program.matches);
    requestAnimationFrame(() => details.scrollIntoView({ behavior: "smooth", block: "start" }));
  });
  karmicProgramControls.add(details);
  details.append(summary, content);
  return details;
};

const renderKarmicTail = (matrixData, library) => {
  const tail = findKarmicTail(matrixData, library);
  if (!tail) return;
  const code = [matrixData.tail.first, matrixData.tail.second, matrixData.bottom]
    .sort((left, right) => left - right)
    .join("-");
  const title = document.createElement("h3");
  title.className = "matrix-karmic-title";
  title.textContent = `Кармический хвост: ${code}`;
  const intro = document.createElement("p");
  intro.className = "matrix-karmic-intro";
  intro.textContent = "Главная задача души, с которой человек приходит в эту жизнь.";
  const list = document.createElement("div");
  list.className = "matrix-karmic-list";
  list.append(createKarmicCard({ ...tail, matches: [{ nodes: ["tailFirst", "tailSecond", "bottom"] }] }, "ОСНОВНАЯ КАРМИЧЕСКАЯ ЗАДАЧА"));
  reading.append(title, intro, list);
};

const renderKarmicPrograms = (matrixData, library) => {
  const programs = findKarmicPrograms(matrixData, library);
  const title = document.createElement("h3");
  title.className = "matrix-karmic-title";
  title.textContent = "Кармические программы";
  const intro = document.createElement("p");
  intro.className = "matrix-karmic-intro";
  intro.textContent = programs.length
    ? "В матрице нашлись повторяющиеся связки энергий."
    : "Для этой даты среди уже подготовленных программ совпадений пока нет.";
  const list = document.createElement("div");
  list.className = "matrix-karmic-list";
  programs.forEach((program) => {
    list.append(createKarmicCard(program, repeatLabel(program.repeats)));
  });
  reading.append(title, intro, list);
};

birthDateInput.addEventListener("input", () => {
  const digits = birthDateInput.value.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  birthDateInput.value = parts.join(".");
  error.hidden = true;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const date = parseBirthDate(birthDateInput.value);
  if (!date) {
    showError("Введите существующую дату в формате ДД.ММ.ГГГГ.");
    birthDateInput.focus();
    return;
  }

  error.hidden = true;
  const formattedDate = birthDateInput.value;
  const matrixData = calculateMatrix(date);
  renderMatrix(matrixData, formattedDate);
  resultTitle.textContent = `Матрица для ${formattedDate}`;
  result.hidden = false;
  showReadingStatus("Подбираю ключи вашего полного расчёта…");
  result.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const [knowledge, karmicPrograms, karmicTails] = await Promise.all([
      loadFullReportKnowledge(),
      loadKarmicPrograms(),
      loadKarmicTails()
    ]);
    renderReading(buildFullReportPreview(date, matrixData, knowledge));
    reportPreviewControls = new Map(
      [...reading.querySelectorAll("[data-preview-key]")]
        .map((card) => [card.dataset.previewKey, card])
    );
    karmicProgramControls = new Set();
    activeFullReport = { formattedDate, matrixData, karmicPrograms, karmicTails };
    reading.append(createFullReportPdfButton("top"));
    renderKarmicTail(matrixData, karmicTails);
    renderKarmicPrograms(matrixData, karmicPrograms);
    renderFullSections(matrixData);
    reading.append(createFullReportPdfButton("bottom"));
    if (pendingMatrixTarget) {
      const target = pendingMatrixTarget;
      pendingMatrixTarget = undefined;
      openMatrixTarget(target);
    }
  } catch {
    showReadingStatus("Матрица рассчитана. Расшифровка временно не загрузилась - попробуйте обновить страницу.");
  }
});

backButton.addEventListener("click", () => {
  matrix.classList.remove("is-active");
  home.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
});

export const openMatrix = () => {
  home.classList.remove("is-active");
  matrix.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
  window.setTimeout(() => birthDateInput.focus(), 220);
};

export const openMatrixForDate = (date, target) => {
  pendingMatrixTarget = target;
  openMatrix();
  birthDateInput.value = date;
  form.requestSubmit();
};
