import { reduce22 } from "./numerology-core.js?v=1";

const keyFor = (values) => [...values].sort((left, right) => left - right).join("-");

const parseProgramLibrary = (source) => {
  const entries = [...source.matchAll(/^## ([\d-]+) «(.+)»\s*\n+### Незакрытая история прошлой жизни\s*\n+([^]+?)\s*\n+### Как это влияет на эту жизнь\s*\n+([^]+?)\s*\n+### Главная задача души\s*\n+([^]+?)(?=\n+## |\s*$)/gm)];
  return entries.map(([, code, title, past, present, task]) => ({
    key: keyFor(code.split("-").map(Number)),
    code,
    title,
    parts: [
      { title: "Незакрытая история прошлой жизни", text: past.trim() },
      { title: "Как это влияет на эту жизнь", text: present.trim() },
      { title: "Главная задача души", text: task.trim() }
    ]
  }));
};

const loadLibrary = async (path) => {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error("Karmic library was not loaded");
  return parseProgramLibrary(await response.text());
};

// The single active catalog contains all 72 existing and new programs,
 // plus earlier supplemental interpretations. Tail data remains independent.
let activeProgramsRequest;
function loadActiveProgramsBank() {
  if (!activeProgramsRequest) {
    activeProgramsRequest = fetch(
      new URL("./pro/karmic-programs.json?v=12", import.meta.url),
      { cache: "no-store" }
    ).then(async response => {
      if (!response.ok) throw new Error("Не удалось загрузить кармические программы");
      const bank = await response.json();
      if (bank.schema !== "pro-karmic-programs-v2" ||
          !Array.isArray(bank.entries) || bank.entries.length !== 72 ||
          !bank.guidanceByCode || typeof bank.guidanceByCode !== "object") {
        throw new Error("Неполная база кармических программ");
      }
      return bank;
    }).catch(error => {
      activeProgramsRequest = null;
      throw error;
    });
  }
  return activeProgramsRequest;
}
export const loadKarmicPrograms = async () => {
  const bank = await loadActiveProgramsBank();
  const keys = new Set();
  return bank.entries.map(entry => {
    const numbers = String(entry.code || "").split("-").map(Number);
    if (numbers.length !== 3 || numbers.some(n => !Number.isInteger(n) || n < 1 || n > 22)
      || typeof entry.title !== "string" || !entry.title.trim()
      || !Array.isArray(entry.parts) || !entry.parts.length
      || entry.parts.some(part => typeof part.title !== "string" || !part.title.trim()
        || typeof part.text !== "string" || !part.text.trim())) {
      throw new Error("Некорректная программа в общем каталоге");
    }
    const key = keyFor(numbers);
    if (keys.has(key)) throw new Error("Повторяющаяся кармическая программа: " + key);
    keys.add(key);
    return { key, code: entry.code, title: entry.title, parts: entry.parts };
  });
};
export const loadKarmicProgramGuidance = async () =>
  (await loadActiveProgramsBank()).guidanceByCode;

export const loadKarmicTails = () => loadLibrary("./karmic-tails.md");

export const findKarmicTail = (matrixData, library) => {
  // A karmic tail has an ordered reading. The 9-9-18, 18-9-9
  // and 9-18-9 tails share the same numbers but not the same placement.
  const ordered = [matrixData.tail.first, matrixData.tail.second, matrixData.bottom].join("-");
  const exact = library.find((tail) => tail.code === ordered);
  if (exact) return { ...exact, calculatedCode: ordered, exactOrder: true };
  const matching = library.find((tail) => tail.key === keyFor([matrixData.tail.first, matrixData.tail.second, matrixData.bottom]));
  return matching ? { ...matching, calculatedCode: ordered, exactOrder: false } : null;
};

export const getMatrixTriples = (data) => {
  const moneyStart = data.channels.moneyEntry;
  const relationshipStart = data.channels.loveEntry;
  const balance = data.channels.balance;
  const moneyResult = data.channels.moneyPoint;
  const relationshipResult = data.channels.lovePoint;

  return [
    { id: "talents", label: "Линия талантов", values: [data.top, data.topSpoke.outer, data.topSpoke.near], nodes: ["top", "topOuter", "topNear"] },
    { id: "parents", label: "Детство и родители", values: [data.left, data.leftSpoke.outer, data.leftSpoke.near], nodes: ["left", "leftOuter", "leftNear"] },
    { id: "material", label: "Материальная карма", values: [data.right, data.rightSpoke.outer, data.rightSpoke.near], nodes: ["right", "rightOuter", "rightNear"] },
    { id: "tail", label: "Кармический хвост", values: [data.tail.first, data.tail.second, data.bottom], nodes: ["tailFirst", "tailSecond", "bottom"] },
    { id: "fatherTop", label: "Мужской род. Верхняя часть", values: [data.corners.topLeft, data.diagonals.topLeft.outer, data.diagonals.topLeft.near], nodes: ["topLeft", "topLeftOuter", "topLeftNear"] },
    { id: "motherTop", label: "Женский род. Верхняя часть", values: [data.corners.topRight, data.diagonals.topRight.outer, data.diagonals.topRight.near], nodes: ["topRight", "topRightOuter", "topRightNear"] },
    { id: "fatherBottom", label: "Мужской род. Нижняя часть", values: [data.corners.bottomRight, data.diagonals.bottomRight.outer, data.diagonals.bottomRight.near], nodes: ["bottomRight", "bottomRightOuter", "bottomRightNear"] },
    { id: "motherBottom", label: "Женский род. Нижняя часть", values: [data.corners.bottomLeft, data.diagonals.bottomLeft.outer, data.diagonals.bottomLeft.near], nodes: ["bottomLeft", "bottomLeftOuter", "bottomLeftNear"] },
    { id: "money", label: "Линия денег", values: [moneyStart, moneyResult, balance], nodes: ["rightNear", "moneyPoint", "wellbeing"] },
    { id: "love", label: "Линия отношений", values: [relationshipStart, relationshipResult, balance], nodes: ["tailFirst", "loveHeart", "wellbeing"] }
  ];
};

export const findKarmicPrograms = (matrixData, library) => {
  const repeats = new Map();
  getMatrixTriples(matrixData).forEach((triple) => {
    const key = keyFor(triple.values);
    const matched = repeats.get(key) ?? [];
    matched.push(triple);
    repeats.set(key, matched);
  });

  return library
    .filter((program) => repeats.has(program.key))
    .map((program) => ({
      ...program,
      repeats: repeats.get(program.key).length,
      matches: repeats.get(program.key),
      // Only the lower tail and right material ray are called karmic in this
      // interpretation. Other triads are talents, relationship or lineage programs.
      karmicPlacement: repeats.get(program.key).some(match => ["tail", "material"].includes(match.id))
    }))
    .sort((left, right) => Number(right.karmicPlacement) - Number(left.karmicPlacement)
      || right.repeats - left.repeats || left.title.localeCompare(right.title, "ru"));
};
