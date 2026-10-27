import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const js = await source("year-content.js");
const { parseEnergyText, createMonthlyLinkSelector } = new Function(
  js.replace(/^export /gm, "") + "\nreturn { parseEnergyText, createMonthlyLinkSelector };"
)();
const banks = { even: {}, odd: {} };
for (let energy = 1; energy <= 9; energy++) {
  for (const variant of ["even", "odd"]) {
    banks[variant][energy] = parseEnergyText(
      await source(`data/year/${variant === "odd" ? "odd/" : ""}energy-${energy}.txt`),
      energy
    );
  }
}
const fields = ["title", "general", "money", "work", "relationships", "health", "danger", "do", "dont", "advice"];
const reduce = n => { let x = Math.abs(n); while (x > 9) x = [...String(x)].reduce((s, d) => s + Number(d), 0); return x || 9; };
const personalYear = (date, year) => reduce(date.getUTCDate() + date.getUTCMonth() + 1 + [...String(year)].reduce((s, d) => s + Number(d), 0));
const entries = (date, year) => {
  const birthdayMonth = date.getUTCMonth() + 1;
  const before = personalYear(date, year - 1), after = personalYear(date, year);
  const result = [];
  for (let m = 1; m <= 12; m++) {
    const energies = m === birthdayMonth ? [before, after] : [m < birthdayMonth ? before : after];
    for (const yearEnergy of energies) result.push({ month: m, yearEnergy, monthEnergy: reduce(yearEnergy + m) });
  }
  return result;
};

test("All 81 combinations have two complete, non-identical text variants", () => {
  for (let i = 1; i <= 9; i++) for (let j = 1; j <= 9; j++) {
    const a = banks.even[i].links[j], b = banks.odd[i].links[j];
    assert.ok(a && b, `${i}-${j}`);
    for (const field of fields) {
      assert.ok(a[field] && b[field], `Missing ${i}-${j} ${field}`);
      assert.notEqual(a[field], b[field], `Same ${i}-${j} ${field}`);
    }
  }
});

test("08.01.1981: repeat months receive distinct text in both 2026 and 2027", () => {
  for (const year of [2026, 2027]) {
    const primary = banks[year % 2 ? "odd" : "even"];
    const secondary = banks[year % 2 ? "even" : "odd"];
    const select = createMonthlyLinkSelector(primary, secondary);
    const signatures = new Set(), pairs = new Map();
    for (const {month, yearEnergy, monthEnergy} of entries(new Date(Date.UTC(1981, 0, 8)), year)) {
      const key = `${yearEnergy}-${monthEnergy}`;
      const link = select(yearEnergy, monthEnergy);
      assert.ok(link, key);
      const signature = fields.map(field => link[field]).join("\n");
      assert.ok(!signatures.has(signature), `Duplicate ${year}, month ${month}`);
      signatures.add(signature);
      pairs.set(key, (pairs.get(key) || 0) + 1);
    }
    assert.equal([...pairs.values()].filter(count => count > 1).length, 3);
  }
});

test("No duplicate full monthly texts for all birthdays in 2026 and 2027", () => {
  for (const year of [2026, 2027]) {
    const primary = banks[year % 2 ? "odd" : "even"];
    const secondary = banks[year % 2 ? "even" : "odd"];
    for (const birthYear of [1981, 2000]) {
      for (let month = 0; month < 12; month++) {
        const days = new Date(Date.UTC(birthYear, month + 1, 0)).getUTCDate();
        for (let day = 1; day <= days; day++) {
          const select = createMonthlyLinkSelector(primary, secondary);
          const seen = new Set();
          for (const entry of entries(new Date(Date.UTC(birthYear, month, day)), year)) {
            const link = select(entry.yearEnergy, entry.monthEnergy);
            assert.ok(link);
            const signature = fields.map(field => link[field]).join("\n");
            assert.ok(!seen.has(signature), `${day}.${month + 1}.${birthYear}, ${year}`);
            seen.add(signature);
          }
        }
      }
    }
  }
});
