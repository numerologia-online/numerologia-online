import { buildFullReportSections, loadFullReportSection } from "./full-report-library.js?v=3";
import { findKarmicPrograms, findKarmicTail } from "./karmic-programs.js?v=2";

let pdfMakeLoading;
const loadScript = (src) => new Promise((resolve, reject) => {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    if (window.pdfMake) resolve();
    else existing.addEventListener("load", resolve, { once: true });
    return;
  }
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.onload = resolve;
  script.onerror = () => reject(new Error("Не удалось загрузить модуль PDF"));
  document.head.append(script);
});

const getPdfMake = () => {
  if (window.pdfMake) return Promise.resolve(window.pdfMake);
  if (!pdfMakeLoading) {
    pdfMakeLoading = loadScript("https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/pdfmake.min.js")
      .then(() => loadScript("https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/vfs_fonts.js"))
      .then(() => window.pdfMake);
  }
  return pdfMakeLoading;
};

const paragraphs = (items = []) => items.filter(Boolean).map((text) => ({ text, style: "paragraph" }));

const sectionBlock = (definition, source) => ({
  stack: [
    { text: `${definition.eyebrow.toUpperCase()} · ЭНЕРГИЯ ${definition.energy}`, style: "eyebrow" },
    { text: source?.title || definition.title, style: "sectionTitle" },
    ...paragraphs(source?.paragraphs || [])
  ],
  unbreakable: (source?.paragraphs || []).join(" ").length < 900,
  margin: [0, 0, 0, 28]
});

const ageFromDate = (formattedDate) => {
  const [day, month, year] = formattedDate.split(".").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age;
};

const buildDocument = ({ formattedDate, matrixData, karmicPrograms, karmicTails }, records) => {
  const age = ageFromDate(formattedDate);
  const tail = findKarmicTail(matrixData, karmicTails);
  const programs = findKarmicPrograms(matrixData, karmicPrograms);
  const keyPoints = [
    ["День рождения", matrixData.left],
    ["Месяц рождения", matrixData.top],
    ["Энергия года", matrixData.right],
    ["Центральная энергия", matrixData.center],
    ["Что блокирует деньги", matrixData.rightSpoke.outer],
    ["Как включить поток", matrixData.rightSpoke.near],
    ["Где легче заработать", matrixData.rightSpoke.core]
  ];
  const karma = [];
  if (tail) {
    karma.push({ text: `Кармический хвост: ${tail.code} ${tail.title}`, style: "sectionTitle" });
    tail.parts.forEach((part) => karma.push({ text: part.title, style: "partTitle" }, ...paragraphs([part.text])));
  }
  programs.forEach((program) => {
    karma.push({ text: `${program.code} ${program.title}`, style: "sectionTitle" });
    program.parts.forEach((part) => karma.push({ text: part.title, style: "partTitle" }, ...paragraphs([part.text])));
  });

  return {
    info: { title: `Полный разбор ${formattedDate}` },
    pageSize: "A4",
    pageMargins: [68, 92, 68, 86],
    background: () => ({
      svg: `
        <svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
          <rect width="595" height="842" fill="#FBF7EE"/>
          <rect x="18" y="18" width="559" height="806" rx="2" fill="none" stroke="#C8A45D" stroke-width="0.8"/>
          <g fill="#C8A45D" opacity="0.13" font-family="Georgia, serif" text-anchor="middle">
            <text x="74" y="106" font-size="72">9</text><text x="148" y="76" font-size="34">6</text><text x="218" y="118" font-size="26">✦</text>
            <text x="505" y="112" font-size="70">6</text><text x="444" y="78" font-size="32">9</text><text x="382" y="122" font-size="24">✦</text>
            <text x="64" y="430" font-size="30">✦</text><text x="92" y="510" font-size="46">6</text><text x="62" y="594" font-size="24">9</text>
            <text x="530" y="428" font-size="30">✦</text><text x="500" y="512" font-size="48">9</text><text x="532" y="596" font-size="24">6</text>
            <text x="92" y="770" font-size="66">6</text><text x="168" y="802" font-size="30">9</text><text x="238" y="766" font-size="24">✦</text>
            <text x="505" y="770" font-size="68">9</text><text x="430" y="802" font-size="30">6</text><text x="360" y="766" font-size="24">✦</text>
          </g>
          <g fill="#B49354" opacity="0.08" font-family="Georgia, serif" font-size="18" text-anchor="middle">
            <text x="297" y="54">9 · 9 · 6 · 6 · 9 · 9</text>
            <text x="297" y="816">6 · 6 · 9 · 9 · 6 · 6</text>
            <text x="31" y="330" transform="rotate(-90 31 330)">9 · 6 · 9 · 6 · 9</text>
            <text x="564" y="520" transform="rotate(90 564 520)">6 · 9 · 6 · 9 · 6</text>
          </g>
        </svg>`
    }),
    defaultStyle: { font: "Roboto", fontSize: 24, color: "#142C43", lineHeight: 1.52 },
    styles: {
      coverTitle: { fontSize: 72, bold: true, color: "#1D3654", alignment: "center", lineHeight: 1.04 },
      coverDate: { fontSize: 30, bold: true, color: "#80642F", alignment: "center" },
      coverAge: { fontSize: 30, bold: true, color: "#1D3654", alignment: "center" },
      title: { fontSize: 36, bold: true, color: "#1E405F", alignment: "center", margin: [0, 0, 0, 18] },
      eyebrow: { fontSize: 15, bold: true, color: "#8A6A32", characterSpacing: 1.25, alignment: "center", margin: [0, 0, 0, 16] },
      sectionTitle: { fontSize: 31, bold: true, color: "#1E405F", margin: [0, 0, 0, 18] },
      partTitle: { fontSize: 25, bold: true, color: "#60431D", margin: [0, 30, 0, 11] },
      paragraph: { fontSize: 24, bold: true, margin: [0, 0, 0, 22] },
      points: { fontSize: 22, color: "#142C43" }
    },
    content: [
      {
        stack: [
          { text: "Полный\nразбор", style: "coverTitle", margin: [0, 165, 0, 58] },
          { text: `Дата рождения: ${formattedDate}`, style: "coverDate", margin: [0, 0, 0, 18] },
          { text: `Возраст: ${age} ${age === 1 ? "год" : age >= 2 && age <= 4 ? "года" : "лет"}`, style: "coverAge" }
        ],
        pageBreak: "after"
      },
      { text: "ПОЛНЫЙ РАЗБОР", style: "eyebrow" },
      { text: `Личная карта · ${formattedDate}`, style: "title" },
      {
        table: { widths: ["*", "auto"], body: keyPoints.map(([label, value]) => [label, String(value)]) },
        layout: {
          hLineWidth: () => 0.35,
          vLineWidth: () => 0,
          hLineColor: () => "#d8cfbd",
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 7,
          paddingBottom: () => 7,
          fillColor: (row) => (row % 2 === 0 ? "#fcfaf5" : null)
        },
        style: "points"
      },
      ...records.map(({ definition, source }) => sectionBlock(definition, source)),
      ...(karma.length ? [{ stack: [{ text: "КАРМИЧЕСКИЕ ПРОГРАММЫ", style: "eyebrow" }, ...karma] }] : [])
    ],
    footer: (page, pages) => page === 1 ? null : ({ text: `${page - 1} / ${pages - 1}`, alignment: "center", color: "#9C7A42", fontSize: 10, margin: [0, 18, 0, 0] })
  };
};

export const buildNewFullReportPdf = async (report) => {
  const definitions = buildFullReportSections(report.matrixData);
  const [pdfMake, records] = await Promise.all([
    getPdfMake(),
    Promise.all(definitions.map(async (definition) => ({
      definition,
      source: (await loadFullReportSection(definition.energy))?.sections?.[definition.key]
    })))
  ]);
  const blob = await new Promise((resolve) => pdfMake.createPdf(buildDocument(report, records)).getBlob(resolve));
  return {
    url: URL.createObjectURL(blob),
    filename: `Полный разбор ${report.formattedDate}.pdf`
  };
};
