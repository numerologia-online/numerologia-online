import { readProJson } from "./secure-reader.js?v=life-content-20261116";

export { findKarmicPrograms, findKarmicTail, getMatrixTriples } from "../karmic-programs.js?v=31";

const keyFor = values => [...values].map(Number).sort((left, right) => left - right).join("-");

function parseProgramLibrary(source) {
  const entries = [...source.matchAll(/^## ([\d-]+) «(.+)»\s*\n+### Незакрытая история прошлой жизни\s*\n+([^]+?)\s*\n+### Как это влияет на эту жизнь\s*\n+([^]+?)\s*\n+### Главная задача души\s*\n+([^]+?)(?=\n+## |\s*$)/gm)];
  return entries.map(([, code, title, past, present, task]) => ({
    key: keyFor(code.split("-")),
    code,
    title,
    parts: [
      {title: "Незакрытая история прошлой жизни", text: past.trim()},
      {title: "Как это влияет на эту жизнь", text: present.trim()},
      {title: "Главная задача души", text: task.trim()}
    ]
  }));
}

export async function loadKarmicReport(birth) {
  const report = await readProJson("karma", birth);
  return {
    programs: report.programs.map(entry => ({...entry, key: keyFor(entry.code.split("-"))})),
    tails: parseProgramLibrary(report.tails),
    deepening: report.deepening
  };
}
