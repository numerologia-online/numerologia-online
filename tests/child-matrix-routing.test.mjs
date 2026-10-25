// Checks adult-style routing of children's matrix: point -> energy file -> section.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const bank = async (n) => JSON.parse(await source(`child/data/matrix/sections/energy-${n}.json`));

test("There is only one reading bank per child energy; short bank is removed", async () => {
  await assert.rejects(access(new URL("../child/data/matrix.json", import.meta.url)));
  const script = await source("child/child.js");
  assert.doesNotMatch(script, /data\/matrix\.json|banks\.matrix|firstEnergyBank|appendOtherChildSections/);
  assert.match(script, /energy-\$\{number\}\.json/);
  for (let n = 1; n <= 22; n++) {
    const reading = await bank(n);
    assert.equal(reading.id, n);
    assert.ok(reading.sections.money?.paragraphs.length, `missing money in energy ${n}`);
    assert.ok(!Object.hasOwn(reading, "money"), `legacy duplicate in energy ${n}`);
    if (n <= 12) {
      assert.equal(Object.keys(reading.sections).length, 20, `energy ${n} must contain 19 chapters plus money`);
      for (const [key, section] of Object.entries(reading.sections)) {
        assert.ok(section.paragraphs.length, `empty ${n}.${key}`);
      }
    } else {
      assert.deepEqual(Object.keys(reading.sections), ["money"], `energy ${n} pending chapters must not be invented`);
    }
  }
});

test("Each authored topic maps to its own number in the child matrix", async () => {
  const script = await source("child/child.js");
  const core = await source("numerology-core.js");
  const calculate = new Function(core.replace(/^export /gm, "") + "\nreturn calculateMatrix;")();
  const fragment = script.slice(script.indexOf("const matrixDefinitions = (matrix) => ["), script.indexOf("const renderMatrix = (matrix) =>"));
  assert.ok(fragment.startsWith("const matrixDefinitions"));
  const definitions = new Function("matrix", fragment + "\nreturn matrixDefinitions(matrix);")(calculate({day:1,month:2,year:2022}));
  const keys = Object.keys((await bank(1)).sections);
  assert.deepEqual([...definitions.map(x => x.id).filter(id => id !== "tail")].sort(), keys.sort());
  assert.equal(definitions.find(x => x.id === "talents").number, 2);
  assert.equal(definitions.find(x => x.id === "learning").number, 1);
  assert.equal(definitions.find(x => x.id === "character").number, 18);
  assert.equal(definitions.find(x => x.id === "money").number, 18);
});

test("The open reading keeps the point title, number and full matching text together", async () => {
  const script = await source("child/child.js");
  const fragment = script.slice(script.indexOf("const energyBankRequests = new Map();"), script.indexOf("const currentDate = () =>"));
  assert.ok(fragment.includes("const openPointReading"));
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.value = ""; this.hidden = false;
      this.classList = { add() {}, remove() {} }; }
    set textContent(v) { this.value = String(v); this.children = []; }
    get textContent() { return this.value + this.children.map(x => x.textContent).join(""); }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.value = ""; this.children = items; }
    addEventListener() {}
    querySelector() { return new Element("button"); }
  }
  const elems = Object.fromEntries(["child-insight-number","child-insight-title","child-insight-text"].map(id => [id, new Element("div")]));
  const insight = new Element("aside");
  insight.hidden = true;
  const fetchLocal = async (url) => {
    const energy = Number(url.match(/energy-(\d+)\.json/)?.[1]);
    return { ok: true, json: () => bank(energy) };
  };
  const { openPointReading } = new Function("fetch","document","byId","insight",
    `let selectedPoint=null,insightRequestId=0;\n${fragment}\nreturn {openPointReading};`
  )(fetchLocal, { createElement: tag => new Element(tag), addEventListener() {} }, id => elems[id], insight);
  for (const {n,key,title} of [
    {n:2,key:"talents",title:"Таланты и сильные стороны"},
    {n:1,key:"activities",title:"Спорт, кружки и увлечения"},
    {n:18,key:"money",title:"Отношения с деньгами"},
    {n:13,key:"money",title:"Отношения с деньгами"}
  ]) {
    await openPointReading({id:key,number:n,title});
    assert.equal(elems["child-insight-number"].textContent, String(n));
    assert.equal(elems["child-insight-title"].textContent, title);
    assert.deepEqual(elems["child-insight-text"].children.map(x => x.textContent), (await bank(n)).sections[key].paragraphs);
  }
  await openPointReading({id:"talents",number:13,title:"Таланты и сильные стороны"});
  assert.match(elems["child-insight-text"].textContent, /пока не написана/);
});
