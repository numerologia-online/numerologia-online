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
  assert.match(school, /Создать клиентский PDF/);
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
  assert.match(home, /href="\.\/pro\/schools\/"/);
  assert.match(pro, /beforeDownload: schoolClientMode \?/);
  assert.match(pro, /customizeDocument: schoolClientMode \?/);
  assert.match(pro, /import\("\.\/school\/client-pdf\.js\?v=2"\)/);
  assert.match(sitePdf, /src="pro\/pro\.js\?v=20261103schoolpdf1"/);
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

test("Школьный PDF требует подтверждённого владельца REG.RU и не открывает обычный разбор", async () => {
  const pro = await source("pro/pro.js");
  const main = await source("pro/index.html");
  const school = await source("pro/school/index.html");
  assert.match(pro, /schoolClientMode\s*\?\s*verifiedSchoolClientOwner/);
  assert.match(pro, /fetch\("\/api\/numi-school\.php"/);
  assert.match(pro, /action: "session"/);
  assert.match(pro, /result\?\.ok !== true \|\| result\?\.owner !== true/);
  assert.match(pro, /if \(schoolClientMode\) void verifySchoolClientOwner\(\)/);
  assert.match(pro, /if \(!schoolClientMode\) restoreCalculatedBirth\(\)/);
  assert.match(pro, /document\.body\.classList\.add\("pro-school-client-mode"\)/);
  assert.match(school, /href="pro\/\?from=school"/);
  assert.doesNotMatch(main, /data-owner-grant=/);
});
