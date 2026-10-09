import { findKarmicPrograms, findKarmicTail, getMatrixTriples } from "../karmic-programs.js?v=5";
import { buildFullReportSections } from "../full-report-library.js?v=4";

// The professional matrix adds printable chapters without changing the original
// full-report PDF, its typography, cover, calculations, or narrative sources.
export async function buildProPdfChapters(report) {
  if (!report) throw new Error("Данные для полного разбора не готовы");
  const {matrixData: matrix, points, zones, previews, knowledge, karmicPrograms, karmicTails, deepening} = report;
  if (!matrix || !points?.length || !zones?.length || !previews?.details || !knowledge?.energies) {
    throw new Error("Расшифровка матрицы для PDF неполная");
  }
  const content = [];
  const add = (text, options = {}) => {
    if (!text || !String(text).trim()) return;
    content.push({text: String(text), font: "Roboto", color: "#344b5a", fontSize: 17, lineHeight: 1.32, margin: [0, 0, 0, 12], ...options});
  };
  const chapter = (title, lead) => {
    add("НУМЕРОЛОГИЯ ОНЛАЙН · ПЕРСОНАЛЬНЫЙ РАЗБОР", {
      fontSize: 11, color: "#9d7e49", bold: true, characterSpacing: 1.3,
      pageBreak: "before", margin: [0, 10, 0, 12]
    });
    add(title, {fontSize: 34, bold: true, color: "#19364e", lineHeight: 1.15, margin: [0, 0, 0, 17]});
    add(lead, {fontSize: 18, color: "#607887", margin: [0, 0, 0, 24]});
  };
  const heading = (title, prefix = "") => {
    add(prefix ? prefix + " · " + title : title, {
      fontSize: 23, bold: true, color: "#19364e", margin: [0, 22, 0, 11]
    });
  };
  const minor = (title, text) => {
    if (!text) return;
    add(title, {fontSize: 18, bold: true, color: "#956f37", margin: [0, 13, 0, 6]});
    add(text, {margin: [0, 0, 0, 12]});
  };
  const energyOf = number => knowledge.energies[String(number)] || {};
  const contextFor = key => previews.groups?.money?.includes(key) ? "money"
    : previews.groups?.love?.includes(key) ? "love" : "self";

  // These are the same personalized seven-day action/results shown in the site's
  // fourteen consultation answers. Keep older energies' original advice unchanged.
  const applicable = new Set([4, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
  const definitions = buildFullReportSections(matrix);
  const distinct = [...new Set(definitions.map(item => item.energy).filter(n => applicable.has(n)))];
  const practicalBanks = new Map(await Promise.all(distinct.map(async energy => {
    try {
      const response = await fetch("pro/guidance/energy-" + energy + ".json?v=1");
      if (!response.ok) return [energy, null];
      const bank = await response.json();
      return [energy, bank.energy === energy ? bank.sections : null];
    } catch {
      return [energy, null];
    }
  })));
  const practicalItems = definitions.map(item => ({
    title: item.title, energy: item.energy,
    reading: practicalBanks.get(item.energy)?.[item.key]
  })).filter(item => item.reading?.action && item.reading?.result);
  if (practicalItems.length) {
    chapter("Практика на ближайшие семь дней",
      "Персональные упражнения по вашим основным жизненным вопросам. Выбирайте одно действие, а не пытайтесь выполнить всё сразу.");
    practicalItems.forEach(item => {
      heading(item.title, "ЭНЕРГИЯ " + item.energy);
      minor("Что сделать", item.reading.action);
      minor("Как понять, что энергия выходит в плюс", item.reading.result);
    });
  }

  chapter("31 точка вашей матрицы",
    "Каждое число рассматривается в своей позиции. Именно расположение объясняет, почему одна энергия может по-разному проявляться в деньгах, любви и жизненных задачах.");
  points.forEach((point, index) => {
    const detail = previews.details[point.key];
    const energy = energyOf(point.value);
    heading(previews.titles?.[point.key] || point.label, "ТОЧКА " + (index + 1) + " · ЭНЕРГИЯ " + point.value);
    if (energy.name) add(energy.name, {fontSize: 15, bold: true, color: "#967449"});
    minor("Что означает эта точка", detail?.meaning);
    minor("Как проявляется ваша энергия", previews.energies?.[String(point.value)]?.[contextFor(point.key)]);
    minor("В плюсе", energy.plus || energy.mainStrength);
    minor("В минусе", energy.minus || energy.mainBlock);
    minor("Что сделать на практике", detail?.action);
  });

  chapter("13 сфер вашей жизни",
    "Числа одной линии работают вместе. Здесь показаны конкретные энергии, смысл каждой позиции и практические действия для выбранной сферы.");
  zones.forEach((zone, index) => {
    heading(zone.title, "СФЕРА " + (index + 1));
    add(zone.reading.lead);
    for (const key of zone.points) {
      const point = points.find(item => item.key === key);
      const role = zone.reading.roles?.[key];
      if (!point || !role) continue;
      const energy = energyOf(point.value);
      minor(role.title + " · энергия " + point.value + (energy.name ? " · " + energy.name : ""), role.meaning);
      const energyText = energy[zone.reading.energyField] || energy.shortEssence || energy.mainStrength;
      if (energyText) add(energyText, {fontSize: 16, color: "#5b6d78"});
    }
    minor("Как читать сочетание", zone.reading.bridge);
    const selected = zone.points.map(key => points.find(item => item.key === key)?.value).filter(Number.isInteger);
    const repeats = [...new Set(selected.filter((n, i) => selected.indexOf(n) !== i))];
    if (repeats.length) add("Повторяются энергии: " + repeats.join(", ") + ". Смотрите на их роль в каждой позиции.", {fontSize: 15, italics: true, color: "#806c4a"});
    minor("Что можно сделать в жизни", zone.reading.practice);
  });

  chapter("Ваше предназначение",
    "Четыре направления предназначения помогают разобраться в личных задачах, проявлении среди людей и более широком жизненном пути.");
  const purpose = [
    ["Личное предназначение",matrix.purpose.personal,"Что важно развивать в себе и как соединить внутренние потребности с реальными делами."],
    ["Социальное предназначение",matrix.purpose.social,"Как вы можете приносить пользу другим людям через собственные способности и опыт."],
    ["Общее предназначение",matrix.purpose.general,"Направление, в котором личные качества и участие в жизни людей соединяются."],
    ["Планетарное предназначение",matrix.purpose.planetary,"Как объединить знания и жизненный опыт в дело, полезное не только ближайшему окружению."]
  ];
  purpose.forEach(([title, number, description]) => {
    const energy = energyOf(number);
    heading(title + " · энергия " + number);
    add(description);
    minor("Основной смысл", energy.shortEssence);
    minor("Сила", energy.mainStrength);
    minor("Что мешает", energy.mainBlock);
    minor("Совет", energy.advice);
  });
  heading("Три центра силы матрицы");
  add("Личный центр · энергия " + matrix.center + ". Ваша внутренняя опора и привычные реакции.");
  add("Родовой центр · энергия " + matrix.lineage.ancestralCenter + ". Общий итог родовых диагоналей.");
  add("Общий центр силы · энергия " + matrix.lineage.overallCenter + ". Соединение личного и родового центров.");

  chapter("Кармические программы",
    "Возможные истоки, проявления, сильные стороны и конкретные действия. Название программы не определяет судьбу и не заменяет ваш собственный выбор.");
  const tail = findKarmicTail(matrix, karmicTails);
  const programs = findKarmicPrograms(matrix, karmicPrograms);
  const tailCode = [matrix.tail.first, matrix.tail.second, matrix.bottom].join("-");
  const sectionLabels = [
    ["origins", "Другие возможные истории происхождения"],
    ["minus", "Как программа уводит жизнь в минус"],
    ["plus", "Как выглядит программа в плюсе"],
    ["practice", "Что конкретно делать"]
  ];
  const card = (title, entry, guidance) => {
    heading(title);
    for (const part of (entry?.parts || [])) minor(part.title, part.text);
    if (guidance) for (const [key, label] of sectionLabels) minor(label, guidance[key]);
  };
  add("Ваш кармический хвост: " + tailCode, {fontSize: 23, bold: true, color: "#19364e"});
  if (tail) card(tail.title, tail, deepening?.tail?.[tailCode] || deepening?.tail?.[tail.code]);
  else add("Отдельная расшифровка кармического хвоста не найдена.");
  const unique = programs.filter(program => program.key !== tail?.key);
  if (unique.length) {
    heading("Другие программы по сферам жизни");
    unique.forEach(program => {
      const type = program.karmicPlacement ? "Кармическая программа" : "Программа";
      card(type + " · " + program.code + " · " + program.title, program,
        deepening?.program?.[program.code] || deepening?.tail?.[program.code]);
      const places = (program.matches || []).map(match => match.label).filter(Boolean);
      if (places.length) add("Где обнаружена: " + places.join("; ") + ".", {fontSize: 15, color: "#6a7680"});
    });
  }
  heading("Все десять сочетаний матрицы");
  add("Не каждое сочетание имеет отдельное название или обозначает тяжёлую кармическую задачу.");
  getMatrixTriples(matrix).forEach(triple => {
    add(triple.label + " · " + triple.values.join("-"), {fontSize: 16, margin: [0, 0, 0, 9]});
  });

  chapter("Ваш первый шаг",
    "Вернитесь к той сфере, которая откликнулась сильнее всего. Не нужно менять всё сразу.");
  add("Выберите одну практическую рекомендацию из этого разбора и применяйте её ближайшие семь дней.");
  add("Затем оцените не ощущения от красивых слов, а конкретные поступки и изменения. Именно так знания превращаются в опыт.");
  add("Нумерология Онлайн", {fontSize: 22, bold: true, color: "#9c7c44", margin: [0, 25, 0, 8]});
  return content;
}
