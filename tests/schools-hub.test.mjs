import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Главная ведёт в каталог школ, а Матрица судьбы открывает действующую школу", async () => {
  const home = await source("index.html");
  const hub = await source("pro/schools/index.html");
  const school = await source("pro/school/index.html");
  const report = await source("pro/index.html");
  const styles = await source("pro/schools/schools.css");
  assert.ok(home.includes('href="./pro/schools/"'));
  assert.ok(hub.includes('<base href="../../">'));
  assert.ok(hub.includes('href="pro/school/" class="academy-school academy-school--ready"'));
  assert.ok(hub.includes('>Матрица судьбы</h3>'));
  assert.ok(school.includes('href="pro/schools/" class="school-back"'));
  assert.ok(report.includes('href="pro/schools/"'));
  assert.ok(styles.includes('@media(max-width:640px)'));
});

test("Две школы открыты, остальные направления в разработке", async () => {
  const hub = await source("pro/schools/index.html");
  const schools = [
    "Квадрат Пифагора",
    "Кармическая нумерология",
    "Арканическая нумерология",
    "Ведическая нумерология",
    "Китайская нумерология Ло Шу",
    "Халдейская нумерология"
  ];
  for (const name of schools) assert.ok(hub.includes('<h3>' + name + '</h3>'), name);
  assert.equal((hub.match(/class="academy-school academy-school--future"/g) || []).length, schools.length);
  assert.equal((hub.match(/В разработке/g) || []).length, schools.length);
  assert.equal((hub.match(/href="pro\/school\/"/g) || []).length, 1);
  assert.equal((hub.match(/href="pro\/schools\/classic\/"/g) || []).length, 1);
  assert.equal((hub.match(/class="academy-school academy-school--ready/g) || []).length, 2);
  assert.ok(hub.includes('<meta name="robots" content="noindex,nofollow">'));
});

test("Каталог школ: короткий заголовок и компактный список для телефона", async () => {
  const hub = await source("pro/schools/index.html");
  const css = await source("pro/schools/schools.css");
  assert.ok(hub.includes('<h1 id="academy-title">Школа <em>нумерологии</em></h1>'));
  assert.ok(hub.includes("ОБУЧЕНИЕ И ПРАКТИКА"));
  assert.ok(hub.includes("Выберите направление, которое хотите изучать самостоятельно."));
  assert.ok(!hub.includes("Выберите свою школу"));
  assert.ok(!hub.includes("Первая школа уже открыта"));
  assert.ok(!hub.includes('class="academy-school-top"'));
  assert.ok(!hub.includes('class="academy-school-bottom"'));
  assert.ok(hub.includes('href="pro/schools/schools.css?v=4"'));
  assert.equal((hub.match(/class="academy-school academy-school--/g) || []).length, 8);
  assert.match(css, /\.academy-school\s*\{/);
  assert.match(css, /min-height:65px/);
  assert.match(css, /@media\(max-width:480px\)/);
  assert.match(css, /min-height:61px/);
  assert.ok(!css.includes("min-height:242px"));
});

test("Старый HTML с новыми стилями не ломает карточки школ", async () => {
  const css = await source("pro/schools/schools.css");
  const html = await source("pro/schools/index.html");
  assert.ok(css.includes(".academy-school-top{display:contents}"));
  assert.ok(css.includes(".academy-school>p,.academy-school-bottom{display:none}"));
  assert.ok(css.includes(".academy-headline,.academy-ending{display:none}"));
  assert.ok(css.includes(".academy-school-number{order:0}"));
  assert.ok(css.includes(".academy-school h3{order:1;overflow-wrap:anywhere}"));
  assert.ok(css.includes(".academy-status{order:2}"));
  assert.ok(css.includes('.academy-intro h1:not([id])::before'));
  assert.ok(html.includes('href="pro/schools/schools.css?v=4"'));
});
