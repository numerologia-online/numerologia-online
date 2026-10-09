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

test("После выбора точки нет повторяющих блоков", async () => {
  const html = await source("pro/index.html");
  const pro = await source("pro/pro.js");
  const diagram = await source("pro/pro-diagram.js");
  assert.ok(!html.includes('id="pro-zone-guide"'));
  assert.ok(!html.includes('id="pro-position-detail"'));
  assert.ok(!html.includes('class="pro-all-points"'));
  assert.ok(!pro.includes('renderPointList('));
  assert.ok(diagram.includes('pointPreview.addEventListener("click"'));
  assert.ok(diagram.includes('onSelectQuestion(point.topic, true)'));
  assert.ok(diagram.includes('questionButtons.scrollIntoView('));
  assert.ok(diagram.includes('renderZones(zones)'));
  assert.ok(diagram.includes('paintZone(zone)'));
  assert.ok(html.includes('id="pro-question-buttons"'));
  assert.ok(html.includes('id="pro-karma"'));
});

test("Все 13 тем видны вокруг матрицы, без переключателя и перекрытий", async () => {
  const code = await source("pro/pro-diagram.js");
  const html = await source("pro/index.html");
  const css = await source("pro/pro.css");
  const zones = JSON.parse(await source("pro/zones.json")).zones;
  const section = code.match(/const sectorLabelPositions = \{([\s\S]*?)\n\};/);
  assert.ok(section,"Список координат подписей существует");
  const labels = [...section[1].matchAll(/(\w+):\s*\{x:(\d+),y:(\d+),width:(\d+)\}/g)]
    .map(match => ({id:match[1],x:+match[2],y:+match[3],w:+match[4]}));
  assert.equal(labels.length,13);
  for (const zone of zones) assert.ok(labels.some(label => label.id===zone.id),zone.id);
  for (const label of labels) {
    assert.ok(label.x-label.w/2>=0 && label.x+label.w/2<=620,label.id+" за пределами SVG");
    assert.ok(label.y>=29 && label.y<=777,label.id+" по вертикали");
  }
  for(let i=0;i<labels.length;i++) for(let j=i+1;j<labels.length;j++) {
    const a=labels[i],b=labels[j];
    assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2+2 || Math.abs(a.y-b.y)>=60,
      a.id+" перекрывает "+b.id);
  }
  assert.ok(code.includes('viewBox:"0 0 620 806"'));
  // Подписи не должны закрывать рассчитанные кружки даже на компактной схеме.
  const calc = loadPlainFunctions(await source("numerology-core.js"), "calculateMatrix");
  const getPoints = loadPlainFunctions(await source("pro/pro-points.js"), "nodesFor");
  const points = getPoints(birth,calc(birth));
  for(const label of labels) for(const point of points) {
    const radius = point.kind==="center" ? 34 : point.kind==="major" ? 29
      : ["loveHeart","moneyPoint","wellbeing"].includes(point.key) ? 18 : 17;
    const px = Math.max(label.x-label.w/2,Math.min(point.x,label.x+label.w/2));
    const hit = ["spirit","talents"].includes(label.id) ? 20
      : ["lineage","relationships"].includes(label.id) ? 24 : 29;
    const py = Math.max(label.y-hit,Math.min(point.y,label.y+hit));
    assert.ok(Math.hypot(px-point.x,py-point.y)>=radius+1,
      label.id+" перекрывает число "+point.key);
  }
  const at = Object.fromEntries(labels.map(label=>[label.id,label]));
  assert.ok(at.maleLine.y < at.spirit.y, "Мужская линия должна быть выше внутреннего мира");
  assert.ok(at.femaleLine.y < at.talents.y, "Женская линия должна быть выше сильных сторон");
  for(const id of ["lessons","growth","career"]) assert.ok(at[id].y > at.purpose.y,id+" должен быть ниже матрицы");
  assert.ok(!html.includes('id="pro-label-tabs"'));
  assert.ok(css.includes('.pro-diagram .pro-node.out-of-zone{opacity:.88}'));
});

test("Вопросы раскрываются каждый внутри своей карточки, без прокрутки вниз", async () => {
  const script = await source("pro/pro.js");
  const html = await source("pro/index.html");
  const css = await source("pro/pro.css");
  const block = script.slice(script.indexOf("async function selectQuestion("),script.indexOf("function renderKarmic("));
  assert.ok(script.includes('const card = element("div", null, "pro-question-item")'));
  assert.ok(script.includes('panel.hidden = true'));
  assert.ok(block.includes('panel.hidden = !open'));
  assert.ok(block.includes('alreadyOpen && !scroll ? null : key'));
  assert.ok(block.includes("await loadFullReportSection(definition.energy)"));
  assert.ok(block.includes("current.selected !== key"));
  assert.ok(block.includes("answerRequestId !== request"));
  assert.ok(script.includes('trigger.setAttribute("aria-expanded", String(open))'));
  assert.ok(!block.includes("answer.scrollIntoView"));
  assert.ok(!html.includes('id="pro-answer"'));
  assert.ok(css.includes('.pro-question-item.expanded'));
});

test("Развёрнутые ответы не дублируют формулы и технические позиции матрицы", async () => {
  const js = await source("pro/pro.js");
  const css = await source("pro/pro.css");
  const html = await source("pro/index.html");
  assert.ok(!js.includes("pro-equation"));
  assert.ok(!js.includes('answer.append(paragraph("Точка матрицы:'));
  assert.ok(!css.includes(".pro-equation"));
  assert.ok(html.includes('src="pro/pro.js?v=21"'));
  assert.ok(html.includes('pro/pro.css?v=16'));
  assert.ok(js.includes('loadFullReportSection(definition.energy)'));
});

test("Все 308 разборов вопросов заполнены для всех 22 энергий", async () => {
  const sectionKeys = ["impression","trueSelf","growth","character","parentsPain","familyError",
    "trueLove","partner","moneyBlock","moneyFlow","earning","energyLeak","health","lifeLesson"];
  for (let energy=1;energy<=22;energy++) {
    const raw = await source("knowledge/full-report/sections/energy-"+energy+".json");
    const sections = JSON.parse(raw.replace(/^\uFEFF/, "")).sections;
    for (const key of sectionKeys) {
      const paragraphs = sections?.[key]?.paragraphs;
      assert.ok(Array.isArray(paragraphs) && paragraphs.some(text => typeof text==="string" && text.trim().length>=50),
        "Энергия "+energy+", вопрос "+key+" не заполнен");
    }
  }
});
