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

export const loadKarmicPrograms = () => loadLibrary("./karmic-programs.md");

export const loadKarmicTails = () => loadLibrary("./karmic-tails.md");

export const findKarmicTail = (matrixData, library) => {
  const key = keyFor([matrixData.tail.first, matrixData.tail.second, matrixData.bottom]);
  return library.find((tail) => tail.key === key) ?? null;
};

const getMatrixTriples = (data) => {
  const moneyStart = data.channels.moneyEntry;
  const relationshipStart = data.channels.loveEntry;
  const balance = data.channels.balance;
  const moneyResult = data.channels.moneyPoint;
  const relationshipResult = data.channels.lovePoint;

  return [
    { values: [data.top, data.topSpoke.outer, data.topSpoke.near], nodes: ["top", "topOuter", "topNear"] },
    { values: [data.left, data.leftSpoke.outer, data.leftSpoke.near], nodes: ["left", "leftOuter", "leftNear"] },
    { values: [data.right, data.rightSpoke.outer, data.rightSpoke.near], nodes: ["right", "rightOuter", "rightNear"] },
    { values: [data.tail.first, data.tail.second, data.bottom], nodes: ["tailFirst", "tailSecond", "bottom"] },
    { values: [data.corners.topLeft, data.diagonals.topLeft.outer, data.diagonals.topLeft.near], nodes: ["topLeft", "topLeftOuter", "topLeftNear"] },
    { values: [data.corners.topRight, data.diagonals.topRight.outer, data.diagonals.topRight.near], nodes: ["topRight", "topRightOuter", "topRightNear"] },
    { values: [data.corners.bottomRight, data.diagonals.bottomRight.outer, data.diagonals.bottomRight.near], nodes: ["bottomRight", "bottomRightOuter", "bottomRightNear"] },
    { values: [data.corners.bottomLeft, data.diagonals.bottomLeft.outer, data.diagonals.bottomLeft.near], nodes: ["bottomLeft", "bottomLeftOuter", "bottomLeftNear"] },
    { values: [moneyStart, moneyResult, balance], nodes: ["rightNear", "moneyPoint", "wellbeing"] },
    { values: [relationshipStart, relationshipResult, balance], nodes: ["tailFirst", "loveHeart", "wellbeing"] }
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
    .map((program) => ({ ...program, repeats: repeats.get(program.key).length, matches: repeats.get(program.key) }))
    .sort((left, right) => right.repeats - left.repeats || left.title.localeCompare(right.title, "ru"));
};
