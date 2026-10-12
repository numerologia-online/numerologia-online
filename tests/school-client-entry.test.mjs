import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (file) => readFile(new URL("../" + file, import.meta.url), "utf8");

test("Школа использует полный разбор и PDF основного сайта", async () => {
  const school = await source("pro/school/index.html");
  const professional = await source("pro/index.html");
  const feature = await source("pro/pro.js");
  const lessonBank = JSON.parse(await source("pro/school/lessons.json"));
  const energyBank = JSON.parse(await source("pro/school/arcana.json"));
  assert.equal(lessonBank.lessons.length, 12);
  assert.equal(energyBank.arcana.length, 22);
  assert.match(school, /href="pro\/\?from=school"/);
  assert.match(school, /Рассчитать для клиента/);
  assert.match(professional, /href="pro\/school\/"/);
  assert.match(professional, /id="pro-pdf-controls"/);
  assert.match(feature, /createFullReportPdfController/);
  assert.match(feature, /get\("from"\) === "school"/);
});
