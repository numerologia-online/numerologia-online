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
  assert.match(professional, /href="pro\/schools\/"/);
  assert.match(professional, /id="pro-pdf-controls"/);
  assert.match(feature, /createFullReportPdfController/);
  assert.match(feature, /get\("from"\) === "school"/);
});

test("Персональный PDF доступен только в режиме школы", async () => {
  const publicPdf = await source("full-report-pdf.js");
  const schoolForm = await source("pro/school/client-pdf.js");
  const clientStyles = await source("pro/school/client-pdf.css");
  const home = await source("index.html");
  const pro = await source("pro/pro.js");
  const sitePdf = await source("pro/index.html");
  assert.match(home, /href="\.\/pro\/schools\/"/);
  assert.match(home, /Вход для нумерологов/);
  assert.match(pro, /beforeDownload: schoolClientMode \?/);
  assert.match(pro, /customizeDocument: schoolClientMode \?/);
  assert.match(pro, /import\("\.\/school\/client-pdf\.js\?v=2"\)/);
  assert.match(sitePdf, /src="pro\/pro\.js\?v=84"/);
  assert.match(publicPdf, /beforeDownload = null, customizeDocument = null/);
  assert.match(publicPdf, /if \(typeof beforeDownload === "function"\) return;/);
  assert.match(schoolForm, /Имя клиента/);
  assert.match(schoolForm, /Имя и фамилия нумеролога/);
  assert.match(schoolForm, /Instagram/);
  assert.match(schoolForm, /Telegram/);
  assert.match(schoolForm, /Другой контакт/);
  assert.doesNotMatch(schoolForm, /Главная тема консультации/);
  assert.doesNotMatch(schoolForm, /Моё личное обращение к клиенту/);
  assert.ok(!schoolForm.includes("documentDefinition.content.splice(1"));
  assert.match(schoolForm, /pageBreak: "after"/);
  assert.ok(schoolForm.includes('text: `для ${d.client}`'));
  assert.match(schoolForm, /documentDefinition\.background =/);
  assert.match(schoolForm, /documentDefinition\.footer =/);
  assert.match(clientStyles, /school-client-dialog/);
});
