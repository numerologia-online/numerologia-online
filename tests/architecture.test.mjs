// Проверки архитектуры без npm, браузера и платных сервисов.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = file => readFile(join(root, file), "utf8");
const loadPlainFunctions = (js, returnName) => new Function(
  js.replace(/^export /gm, "") + "\nreturn " + returnName + ";"
)();
const birth = {day:9,month:9,year:1986};

test("Общее ядро и 31 точка", async () => {
  const calc = loadPlainFunctions(await source("numerology-core.js"), "calculateMatrix");
  const points = loadPlainFunctions(await source("pro/pro-points.js"), "nodesFor");
  const matrix = calc(birth);
  assert.deepEqual([matrix.left,matrix.top,matrix.right,matrix.bottom,matrix.center],[9,9,6,6,3]);
  assert.deepEqual(matrix.channels,{moneyEntry:9,loveEntry:9,balance:18,moneyPoint:9,lovePoint:9});
  const positions = points(birth,matrix);
  assert.equal(positions.length,31);
  assert.equal(new Set(positions.map(p=>p.key)).size,31);
  assert.equal(positions.find(p=>p.key==="moneyPoint").value,9);
  assert.equal(positions.find(p=>p.key==="wellbeing").value,18);
  for(const date of [{day:25,month:11,year:2002},{day:14,month:7,year:1991},{day:31,month:12,year:2020}]) {
    const all = points(date,calc(date));
    assert.equal(all.length,31);
    assert.ok(all.every(p=>p.value>=1&&p.value<=22));
  }
});

test("Все 13 зон ссылаются на реальные позиции", async () => {
  const calc = loadPlainFunctions(await source("numerology-core.js"), "calculateMatrix");
  const points = loadPlainFunctions(await source("pro/pro-points.js"), "nodesFor");
  const keys = new Set(points(birth,calc(birth)).map(p=>p.key));
  const zones = JSON.parse(await source("pro/zones.json")).zones;
  assert.equal(zones.length,13);
  assert.equal(new Set(zones.map(z=>z.id)).size,13);
  for(const zone of zones) {
    assert.ok(zone.title && zone.points.length);
    for(const key of zone.points) assert.ok(keys.has(key),zone.id+" : "+key);
  }
});

test("Все 22 энергии имеют отдельные подсказки", async () => {
  const data = JSON.parse(await source("pro/point-previews.json"));
  assert.equal(Object.keys(data.titles).length,31);
  assert.equal(Object.keys(data.energies).length,22);
  for(let i=1;i<=22;i++) {
    const row = data.energies[String(i)];
    assert.ok(row?.self && row?.money && row?.love,"Энергия "+i);
  }
});

test("PDF, схема и озвучка разделены", async () => {
  const matrix = await source("matrix-feature.js");
  const pdf = await source("full-report-pdf.js");
  const pro = await source("pro/pro.js");
  const voice = await source("pro/pro-voice.js");
  const diagram = await source("pro/pro-diagram.js");
  assert.ok(matrix.includes("createFullReportPdfController"));
  assert.ok(!matrix.includes("const buildPdfMatrixSvg"));
  assert.ok(pdf.includes("const buildPdfMatrixSvg") && pdf.includes("const buildFullReportPdf"));
  assert.ok(!pro.includes("function makeSoulAmbient"));
  assert.ok(!pro.includes("function renderDiagram("));
  assert.ok(voice.includes("export function speakSoulLines"));
  assert.ok(diagram.includes("export function createProDiagram"));
});

async function gatherJs(dir, list=[]) {
  for(const entry of await readdir(join(root,dir),{withFileTypes:true})) {
    const name=join(dir,entry.name);
    if(entry.isDirectory()&&!entry.name.startsWith(".")) await gatherJs(name,list);
    else if(entry.isFile()&&entry.name.endsWith(".js")) list.push(name);
  }
  return list;
}
test("Все локальные импорты указывают на существующие файлы", async () => {
  for(const file of await gatherJs(".")) {
    const code=await source(file);
    for(const match of code.matchAll(/\bfrom\s+["'](\.[^"']+)["']|\bimport\(\s*["'](\.[^"']+)["']/g)) {
      const spec=(match[1]||match[2]).split("?")[0];
      const target=resolve(root,dirname(file),spec);
      assert.ok(!relative(root,target).startsWith(".."),file+" : "+spec);
      await access(target).catch(()=>assert.fail(file+" : "+spec+" не найден"));
    }
  }
});
