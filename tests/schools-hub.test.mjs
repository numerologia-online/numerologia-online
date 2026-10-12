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
