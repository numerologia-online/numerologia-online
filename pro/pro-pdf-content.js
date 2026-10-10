import { findKarmicPrograms, findKarmicTail } from "../karmic-programs.js?v=17";

// The full PDF is intentionally focused: its original cover and 14 authored
// readings come from full-report-pdf.js. Only the matched karmic programs are
// added here. Interactive points, life spheres and purpose remain on the site.
export async function buildProPdfChapters(report) {
  if (!report?.matrixData || !Array.isArray(report.karmicPrograms) ||
      !Array.isArray(report.karmicTails)) {
    throw new Error("Данные кармических программ для PDF не готовы");
  }
  const {
    matrixData: matrix,
    karmicPrograms: programsBank,
    karmicTails: tailsBank,
    deepening
  } = report;
  const content = [];
  const add = (text, options = {}) => {
    if (!text || !String(text).trim()) return;
    content.push({
      text: String(text),
      font: "Roboto",
      color: "#344b5a",
      fontSize: 17,
      lineHeight: 1.32,
      margin: [0, 0, 0, 12],
      ...options
    });
  };
  const chapter = (title, lead) => {
    add("НУМЕРОЛОГИЯ ОНЛАЙН · ПЕРСОНАЛЬНЫЙ РАЗБОР", {
      fontSize: 11, color: "#9d7e49", bold: true, characterSpacing: 1.3,
      margin: [0, 10, 0, 12]
    });
    add(title, {
      fontSize: 34, bold: true, color: "#19364e", lineHeight: 1.15,
      margin: [0, 0, 0, 17]
    });
    add(lead, {
      fontSize: 18, color: "#607887", margin: [0, 0, 0, 24]
    });
  };
  const heading = (title) => add(title, {
    fontSize: 23, bold: true, color: "#19364e", margin: [0, 22, 0, 11]
  });
  const minor = (title, text) => {
    if (!text) return;
    add(title, {
      fontSize: 18, bold: true, color: "#956f37",
      margin: [0, 13, 0, 6]
    });
    add(text);
  };

  chapter("Кармические программы",
    "Ваш кармический хвост и программы, обнаруженные в матрице: как они проявляются, где повторяются и с чем можно работать.");

  const tail = findKarmicTail(matrix, tailsBank);
  const programs = findKarmicPrograms(matrix, programsBank);
  const tailCode = [matrix.tail.first, matrix.tail.second, matrix.bottom].join("-");
  const sectionLabels = [
    ["origins", "Другие возможные истории происхождения"],
    ["minus", "Как программа уводит жизнь в минус"],
    ["plus", "Как выглядит программа в плюсе"],
    ["practice", "Какие действия принимать, чтобы правильно проживать эту программу"]
  ];
  const card = (title, entry, guidance) => {
    heading(title);
    // Approved five-section reading: no duplicate legacy sections in PDF.
    if (Array.isArray(guidance?.approvedReading) && guidance.approvedReading.length === 5) {
      for (const part of guidance.approvedReading) {
        const paragraphs = String(part.text || "").split(/\n\s*\n/).filter(Boolean);
        paragraphs.forEach((paragraph, index) => {
          if (index === 0) minor(part.title, paragraph.trim());
          else add(paragraph.trim());
        });
      }
      return;
    }
    for (const part of (entry?.parts || [])) minor(part.title, part.text);
    if (guidance) {
      for (const [key, label] of sectionLabels) minor(label, guidance[key]);
    }
  };

  add("Ваш кармический хвост: " + tailCode, {
    fontSize: 23, bold: true, color: "#19364e"
  });
  if (tail) {
    const approvedProgramReading = deepening?.program?.[tailCode]?.approvedReading?.length === 5
      ? deepening.program[tailCode] : null;
    card(tail.title, tail,
      approvedProgramReading || deepening?.tail?.[tailCode] || deepening?.tail?.[tail.code]);
  } else {
    add("Отдельная расшифровка кармического хвоста не найдена.");
  }

  const unique = programs.filter(program => program.key !== tail?.key);
  if (unique.length) {
    heading("Другие программы по сферам жизни");
    unique.forEach(program => {
      const type = program.karmicPlacement ? "Кармическая программа" : "Программа";
      card(type + " · " + program.code + " · " + program.title, program,
        deepening?.program?.[program.code] || deepening?.tail?.[program.code]);
      const places = (program.matches || []).map(match => match.label).filter(Boolean);
      if (places.length) {
        add("Где обнаружена: " + places.join("; ") + ".", {
          fontSize: 15, color: "#6a7680"
        });
      }
    });
  }
  return content;
}
