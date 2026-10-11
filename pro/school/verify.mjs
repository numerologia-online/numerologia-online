// Запуск из корня репозитория: node pro/school/verify.mjs
// Тест не публикует сайт и ничего не изменяет.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { Script } from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const get = (path) => readFileSync(resolve(here, path), "utf8");
const loadModule = (code) => import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const { calculateMatrix, reduce22 } = await loadModule(get("../../numerology-core.js"));
const { pointCatalog } = await loadModule(get("points.js"));
const { lessons } = JSON.parse(get("lessons.json"));
const { arcana } = JSON.parse(get("arcana.json"));
const html = get("index.html");
const js = get("school.js");
const checks = [];
const check = (value,message) => { if (!value) checks.push(message); };

check(lessons.length === 12, "Должно быть 12 уроков");
check(arcana.length === 22, "Должно быть 22 энергии");
check(pointCatalog.length === 28, "Должно быть 28 точек");
check(new Set(lessons.map(x => x.id)).size === lessons.length, "Повторы ID уроков");
check(new Set(arcana.map(x => x.id)).size === arcana.length, "Повторы ID энергий");
check(new Set(pointCatalog.map(x => x.id)).size === pointCatalog.length, "Повторы ID точек");
for (const lesson of lessons) {
  check(lesson.sections.length === 3, "Число блоков: " + lesson.id);
  check(lesson.questions.length === 2, "Число вопросов: " + lesson.id);
  for (const q of lesson.questions) {
    check(q.correct >= 0 && q.correct < q.options.length, "Некорректный правильный ответ: " + lesson.id);
  }
}
check(!get("lessons.json").includes("—"), "В уроках есть длинные тире");
check(!get("arcana.json").includes("—"), "В энциклопедии есть длинные тире");
try {
  new Script(js.replace(/^import[^\n]+\n/gm,""));
} catch (err) {
  checks.push("Ошибка синтаксиса JS: "+err.message);
}
for (const [,id] of js.matchAll(/byId\("([^"]+)"\)/g)) {
  check(html.includes('id="' + id + '"'), "Не найден элемент страницы: " + id);
}
check(html.includes('data-school-panel="formulas"'), "Нет вкладки формул");
check(html.includes('data-school-panel="trainer"'), "Нет тренажёра");
check(reduce22(22) === 22 && reduce22(23) === 5 && reduce22(99) === 18, "Правило 22 нарушено");
const control = calculateMatrix({day:14,month:7,year:1990});
check([control.left,control.top,control.right,control.bottom,control.center].join("-") === "14-7-19-4-8", "Контроль 14.07.1990");
check([control.corners.topLeft,control.corners.topRight,control.corners.bottomRight,control.corners.bottomLeft].join("-") === "21-8-5-18", "Контроль углов");
check([control.tail.first,control.tail.second,control.bottom].join("-") === "12-16-4", "Контроль хвоста");

const lastNumber = text => Number(text.match(/\d+/g)?.at(-1));
let dates = 0, positions = 0;
for (let year = 1900; year <= 2026; year++) {
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= new Date(year,month,0).getDate(); day++) {
      if (year === 2026 && (month > 10 || (month === 10 && day > 9))) continue;
      dates++;
      const birth = {day,month,year};
      const matrix = calculateMatrix(birth);
      for (const point of pointCatalog) {
        positions++;
        const value = point.get(matrix);
        check(Number.isInteger(value) && value >= 1 && value <= 22,
          "Значение вне диапазона: "+point.id+" "+day+"."+month+"."+year);
        check(lastNumber(point.work(matrix,birth)) === value,
          "Формула не совпадает с числом: "+point.id+" "+day+"."+month+"."+year);
      }
    }
  }
}
console.log("Учебные данные: " + lessons.length + " уроков, " +
  lessons.reduce((sum,item) => sum + item.questions.length, 0) + " тестовых вопроса, " +
  arcana.length + " энергии.");
console.log("Проверено дат: "+dates+". Проверено формул: "+positions+".");
if (checks.length) {
  console.error("ОШИБКИ ("+checks.length+"):\n"+checks.slice(0,20).join("\n"));
  process.exitCode=1;
} else {
  console.log("ПРОВЕРКА УСПЕШНА: 0 ошибок.");
}
