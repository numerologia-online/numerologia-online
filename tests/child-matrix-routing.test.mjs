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
    // All 22 energy files now contain the complete 19-topic reading plus money.
    // Keep the original completeness guard, but do not treat approved chapters as pending.
    const expectedSections = [
      "character", "talents", "learning", "parenting", "activities", "recovery",
      "emotions", "purpose", "mistakes", "lifeLessons", "parentMistakes",
      "comfort", "gifts", "games", "parentChildLessons", "familyFeelings",
      "independence", "learningHelp", "interests", "money"
    ];
    assert.deepEqual(Object.keys(reading.sections).sort(), expectedSections.sort(),
      `energy ${n} must contain all 19 chapters plus money`);
    for (const [key, section] of Object.entries(reading.sections)) {
      assert.ok(Array.isArray(section.paragraphs) &&
        section.paragraphs.some(line => typeof line === "string" && line.trim()),
        `empty ${n}.${key}`);
    }
  }
});

test("Each authored topic maps to its own number in the child matrix", async () => {
  const script = await source("child/child.js");
  const core = await source("numerology-core.js");
  const calculate = new Function(core.replace(/^export /gm, "") + "\nreturn calculateMatrix;")();
  const start = script.indexOf("const matrixDefinitions = (matrix) => [");
  assert.ok(start >= 0, "matrixDefinitions is present");
  const end = script.indexOf("\n];", start);
  assert.ok(end > start, "matrixDefinitions array is closed");
  // Isolate the function only: the next section sets up DOM elements and is
  // deliberately not executable without the full page.
  const fragment = script.slice(start, end + 3);
  assert.ok(fragment.startsWith("const matrixDefinitions"));
  const sampleMatrix = calculate({day:1,month:2,year:2022});
  const definitions = new Function("matrix", fragment + "\nreturn matrixDefinitions(matrix);")(sampleMatrix);
  const keys = Object.keys((await bank(1)).sections);
  assert.deepEqual([...new Set(definitions.filter(x => x.id !== "tail").map(x => x.section || x.id))].sort(), keys.sort());
  assert.equal(definitions.find(x => x.id === "talents").number, 2);
  assert.equal(definitions.find(x => x.id === "learning").number, 1);
  assert.equal(definitions.find(x => x.id === "character").number, 1);
  assert.equal(definitions.find(x => x.id === "innerNature").number, 18);
  assert.equal(definitions.find(x => x.id === "innerNature").section, "character");
  // This is the money-channel point (21 for this sample), not the centre (18).
  assert.equal(sampleMatrix.channels.moneyPoint, 21);
  assert.equal(definitions.find(x => x.id === "money").number, sampleMatrix.channels.moneyPoint);
  // The child's birth-day energy describes the character first, same as adult matrix.
  const another = new Function("matrix", fragment + "\nreturn matrixDefinitions(matrix);")(calculate({day:9,month:9,year:2024}));
  assert.equal(another[0].id, "character");
  assert.equal(another[0].number, 9);
  assert.equal(another.find(x => x.id === "innerNature").number, 7);
  assert.equal(another.find(x => x.id === "learning").number, 9);
  assert.equal(another.find(x => x.id === "learning").x, undefined);
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
    querySelectorAll() { return []; }
    scrollIntoView() {}
  }
  const elems = Object.fromEntries(["child-insight-number","child-insight-title","child-insight-text"].map(id => [id, new Element("div")]));
  const insight = new Element("aside");
  insight.hidden = true;
  const fetchLocal = async (url) => {
    const energy = Number(url.match(/energy-(\d+)\.json/)?.[1]);
    return { ok: true, json: () => bank(energy) };
  };
  const matrixVisual = new Element("div");
  const matrixSections = new Element("div");
  const childGuide = { hidden: false };
  const mockWindow = { requestAnimationFrame: callback => callback() };
  const { openPointReading } = new Function(
    "fetch", "document", "byId", "insight", "matrixVisual", "matrixSections", "childGuide", "window",
    `let selectedPoint=null,selectedElements=[],insightRequestId=0;\n${fragment}\nreturn {openPointReading};`
  )(fetchLocal, { createElement: tag => new Element(tag), addEventListener() {} },
    id => elems[id], insight, matrixVisual, matrixSections, childGuide, mockWindow);
  for (const {n,key,title,section} of [
    {n:9,key:"character",title:"Характер и темперамент"},
    {n:7,key:"innerNature",section:"character",title:"Внутренние особенности ребёнка"},
    {n:2,key:"talents",title:"Таланты и сильные стороны"},
    {n:1,key:"activities",title:"Спорт, кружки и увлечения"},
    {n:18,key:"money",title:"Отношения с деньгами"},
    {n:13,key:"money",title:"Отношения с деньгами"},
    {n:13,key:"talents",title:"Таланты и сильные стороны"},
    {n:22,key:"character",title:"Характер и темперамент"}
  ]) {
    await openPointReading({id:key,number:n,title,section});
    assert.equal(elems["child-insight-number"].textContent, String(n));
    assert.equal(elems["child-insight-title"].textContent, title);
    assert.deepEqual(elems["child-insight-text"].children.map(x => x.textContent), (await bank(n)).sections[section || key].paragraphs);
  }
  assert.equal(childGuide.hidden, true, "onboarding is hidden after opening a reading");
  assert.equal(insight.hidden, false, "the reading card is shown");
  // A truly missing topic still gets an honest fallback, without suppressing authored texts.
  await openPointReading({id:"not-authored",number:13,title:"Отсутствующий раздел"});
  assert.match(elems["child-insight-text"].textContent, /пока не написана/);
});

test("No numeric energy labels are exposed inside child reading paragraphs", async () => {
  // Explicit numbered labels are internal metadata, not prose for parents.
  // Words like "энергия" in a metaphor or "другие энергии матрицы" are legitimate.
  const forbiddenTerms = /(?:энерги[а-яё]*|аркан[а-яё]*)\s*(?:№\s*)?\d{1,2}(?!\d)|(?:^|[^\d])\d{1,2}(?:-?(?:я|й|ая|ый))?\s+(?:энерги[а-яё]*|аркан[а-яё]*)/iu;
  for (let n = 1; n <= 22; n++) {
    const reading = await bank(n);
    for (const [sectionKey, section] of Object.entries(reading.sections)) {
      for (const paragraph of section.paragraphs || []) {
        assert.doesNotMatch(paragraph, forbiddenTerms, `energy ${n}, section ${sectionKey}`);
        if (n === 10) {
          assert.doesNotMatch(paragraph, /десятк[а-яё]*/iu, `numeric nickname in energy ${n}, section ${sectionKey}`);
        }
      }
    }
  }
});
