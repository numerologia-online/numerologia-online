import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const banks = ["money-questions", "love", "flags", "infidelity", "intimacy", "family", "language", "verdict"];
const calendarDates = Array.from({ length: 12 }, (_, i) => {
  const month = i + 1;
  const days = new Date(Date.UTC(2024, month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, day) => `${day + 1}-${month}`);
}).flat();
const expected = new Set(calendarDates);

test("80 core Red Flag questions plus the recorded bonus have unique identities", async () => {
  const ids = new Set();
  for (const bank of banks) {
    const data = JSON.parse(await source(`data/redflag/banks/${bank}.json`));
    assert.equal(data.questions?.length, bank === "money-questions" ? 11 : 10, bank);
    for (const question of data.questions) {
      assert.ok(question.id && question.title, bank);
      assert.ok(!ids.has(question.id), "Duplicate question: " + question.id);
      ids.add(question.id);
      assert.equal(Object.hasOwn(question, "status"), false,
        "Duplicate editorial status found in question index: " + question.id);
      // Unpublished questions may have draft files without public textFile links.
      // Sale readiness is validated separately against the actual reviewed bank.
    }
  }
  assert.equal(ids.size, 81);
});

test("Completed date-based Red Flag banks have exactly 366 distinct answers", async (t) => {
  assert.equal(calendarDates.length, 366, "Leap day needs its own unique answer");
  let complete = 0;
  let migrating = 0;
  for (const bank of banks) {
    const data = JSON.parse(await source(`data/redflag/banks/${bank}.json`));
    for (const question of data.questions.filter((x) => x.textFile)) {
      const name = question.textFile.split("?")[0];
      const file = JSON.parse(await source(`data/redflag/${name}`));
      assert.equal(file.questionId, question.id, name);
      const entries = file.entries || {};
      const keys = Object.keys(entries);
      if (question.id === "gift" && file.keyRule === "reduce22(day)-month") {
        // One old bank is explicitly in migration; never silently declare it ready.
        assert.equal(file.status, "in-progress");
        assert.equal(file.targetKeyRule, "day-month");
        assert.ok(keys.length > 264 && keys.length < 366,
          "Gift migration must be tracked explicitly until complete");
        assert.ok(entries["23-1"] && entries["23-2"]);
        migrating++;
        continue;
      }
      // Drafts may be partially filled. They must stay unpublished; only
      // editorially approved full banks are required to cover all 366 dates.
      if (!["ready", "complete"].includes(file.status)) {
        assert.ok(keys.length <= 366, "Draft exceeds calendar range: " + name);
        assert.ok(keys.every(key => expected.has(key)), "Draft has an invalid date key: " + name);
        continue;
      }
      assert.equal(file.keyRule, "day-month", "Legacy reduced-date lookup forbidden: " + name);
      assert.equal(keys.length, 366, "Missing calendar interpretations: " + name);
      assert.equal(new Set(keys).size, 366);
      assert.ok(keys.every((key) => expected.has(key)), "Unexpected calendar key: " + name);
      assert.ok(calendarDates.every((key) => typeof entries[key] === "string" && entries[key].trim().length > 200),
        "Empty or unfinished text: " + name);
      assert.equal(new Set(Object.values(entries)).size, 366, "Duplicated interpretations: " + name);
      if (question.id === "family-load") {
        assert.ok(calendarDates.every((key) => entries[key].split(/\n\s*\n/).filter(Boolean).length >= 2),
          "Family-load must have a full answer and a separate next-question paragraph");
      }
      complete++;
    }
  }
  assert.ok(migrating === 0 || migrating === 1, "Only the documented gift bank may migrate");
  // New completed banks must not break the test just because an old total was hardcoded.
  // The full validation above still checks every registered date-based bank.
  assert.ok(complete >= 7, "All seven approved money banks (including free gift) must have 366 full interpretations");
  t.diagnostic(`Complete: ${complete}, in documented migration: ${migrating}, target: 80 × 366`);
});


test("Published Red Flag purchase badges reflect approved 366-day banks, never just a filled draft", async () => {
  const moduleText = await source("redflag-public-catalog.js");
  const raw = moduleText.split("export const PUBLIC_QUESTIONS = ")[1]?.trim();
  assert.ok(raw?.endsWith(";"), "Generated public question catalogue must exist");
  const published = JSON.parse(raw.slice(0, -1));
  const approved = (bank, id, category) => {
    if (!bank || !["ready", "complete"].includes(bank.status)) return false;
    if (bank.questionId !== id || bank.section !== category || bank.keyRule !== "day-month") return false;
    const entries = bank.entries;
    return entries && Object.keys(entries).length === 366 &&
      calendarDates.every(date => typeof entries[date] === "string" && entries[date].trim());
  };
  for (const bankName of banks) {
    const category = bankName === "money-questions" ? "money" : bankName;
    const originals = JSON.parse(await source("data/redflag/banks/" + bankName + ".json")).questions;
    const publicBank = published[category];
    assert.equal(publicBank?.length, originals.length, category + " has duplicated or missing questions");
    for (let index = 0; index < originals.length; index++) {
      const question = originals[index];
      const view = publicBank[index];
      assert.equal(view.id, question.id, "Question order must match: " + category);
      if (index === 0) {
        assert.equal(view.status, "ready", "Existing free question must remain free");
        continue;
      }
      // A public price is only displayed when the same reviewed bank can
      // actually be served by account-service/private/fulfillment.php.
      let material = null;
      try {
        material = JSON.parse(await source("data/redflag/" + category + "/" + question.id + ".json"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      assert.equal(view.status, approved(material, question.id, category) ? "ready" : "soon",
        "Public sale state must follow material approval: " + category + "/" + question.id);
      assert.ok(!("entries" in view) && !("textFile" in view) && !("variants" in view),
        "Paid answer leaked into public catalogue: " + question.id);
    }
  }
  const feature = await source("redflag-feature.js");
  assert.match(feature, /isComingSoon:\s*question\.status !== "ready"/);
  assert.doesNotMatch(feature, /REDFLAG_SOON_BLOCKS/);
  assert.doesNotMatch(feature, /11 вопросов/);
});


test("Ten paid Money questions derive readiness from their ONLY author-approved bank", async () => {
  const list = JSON.parse(await source("data/redflag/banks/money-questions.json")).questions;
  const publicModule = await source("redflag-public-catalog.js");
  const publicBank = JSON.parse(publicModule.split("export const PUBLIC_QUESTIONS = ")[1].trim().slice(0, -1)).money;
  const protectedBank = JSON.parse(await source("account-service/private/redflag-catalog.json")).questions.money;
  const assets = JSON.parse(await source("account-service/private/store-assets.json")).files;
  assert.equal(list.length, 11);
  let complete = 0;
  for (const [index, question] of list.entries()) {
    assert.ok(!Object.hasOwn(question, "status"), "Do not duplicate source status in index");
    const bankName = "data/redflag/money/" + question.textFile.split("?")[0].split("/")[1];
    const raw = await source(bankName);
    const material = JSON.parse(raw);
    const hash = createHash("sha256").update(raw).digest("hex");
    assert.equal(assets[bankName], hash, "Protected vault hash must match: " + question.id);
    assert.equal(material.questionId, question.id);
    if (index < 11) {
      assert.ok(["ready", "complete"].includes(material.status));
      assert.equal(material.question, question.title, "Paid headline differs from catalogue");
      assert.equal(material.keyRule, "day-month");
      assert.equal(Object.keys(material.entries || {}).length, 366);
      assert.equal(new Set(Object.values(material.entries || {})).size, 366);
      assert.equal(publicBank[index].status, "ready");
      assert.equal(protectedBank[question.id].ready, true);
      complete++;
    } else {
      assert.equal(publicBank[index].status, "soon");
      assert.equal(protectedBank[question.id].ready, false);
    }
  }
  assert.equal(complete, 11);
});
