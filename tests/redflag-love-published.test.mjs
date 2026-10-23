import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dates = ["31-1", "1-2", "2-2", "3-2", "4-2", "5-2", "6-2", "7-2", "8-2", "9-2", "10-2", "11-2", "12-2", "13-2", "15-2", "16-2", "17-2", "18-2", "23-2", "24-2", "25-2", "26-2", "27-2", "28-2"];
const load = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Each published love date has ten distinct, two-paragraph readings", async () => {
  const bank = JSON.parse(await load("data/redflag/banks/love.json"));
  const ids = bank.questions.map((question) => question.id);
  assert.equal(ids.length, 10);
  for (const dateKey of dates) {
    const page = JSON.parse(await load("data/redflag/love/published/" + dateKey + ".json"));
    assert.equal(page.schemaVersion, 1);
    assert.equal(page.dateKey, dateKey);
    assert.deepEqual(Object.keys(page.entries), ids);
    for (const id of ids) {
      const text = page.entries[id];
      assert.ok(text.length > 700, dateKey + " " + id + " too short");
      assert.equal(text.split(/\n\s*\n/).length, 2, dateKey + " " + id);
    }
  }
});

test("Opening approved Love questions loads one date, without the 366-entry base", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.protocol, "file:");
    requests.push(url.pathname);
    const content = JSON.parse(await readFile(url, "utf8"));
    return { ok: true, json: async () => content };
  };

  try {
    const { loadQuestionBank } = await import("../redflag-text-bank.js?smoke=approved-love");
    const bank = await loadQuestionBank("love");
    assert.equal(requests.length, 1, "Only question metadata loads on category open");
    const profile = { classic: { birthDate: { day: 5, month: 2 } } };
    const first = await bank.QUESTIONS.find((x) => x.id === "romance").answer(profile);
    const expected = JSON.parse(await load("data/redflag/love/published/5-2.json"));
    assert.equal(first.answer, expected.entries.romance);
    const second = await bank.QUESTIONS.find((x) => x.id === "first-step").answer(profile);
    assert.equal(second.answer, expected.entries["first-step"]);
    assert.equal(requests.length, 2, "The same day is downloaded only once");
    assert.match(requests[1], /love\/published\/5-2\.json$/);

    const newProfile = { classic: { birthDate: { day: 18, month: 2 } } };
    const recent = await bank.QUESTIONS.find((x) => x.id === "family-or-triangle").answer(newProfile);
    const recentExpected = JSON.parse(await load("data/redflag/love/published/18-2.json"));
    assert.equal(recent.answer, recentExpected.entries["family-or-triangle"]);
    assert.equal(requests.length, 3, "Recently approved date is fetched exactly once");
    assert.match(requests[2], /love\/published\/18-2\.json$/);

    const profile26 = { classic: { birthDate: { day: 26, month: 2 } } };
    const justPublished = await bank.QUESTIONS.find((x) => x.id === "love-or-attention").answer(profile26);
    const expected26 = JSON.parse(await load("data/redflag/love/published/26-2.json"));
    assert.equal(justPublished.answer, expected26.entries["love-or-attention"]);
    assert.equal(requests.length, 4, "Approved February 26 loads exactly once");
    assert.match(requests[3], /love\/published\/26-2\.json$/);

    const profile27 = { classic: { birthDate: { day: 27, month: 2 } } };
    const published27 = await bank.QUESTIONS.find((x) => x.id === "first-step").answer(profile27);
    const expected27 = JSON.parse(await load("data/redflag/love/published/27-2.json"));
    assert.equal(published27.answer, expected27.entries["first-step"]);
    assert.equal(requests.length, 5, "Approved February 27 loads exactly once");
    assert.match(requests[4], /love\/published\/27-2\.json$/);

    const profile28 = { classic: { birthDate: { day: 28, month: 2 } } };
    const published28 = await bank.QUESTIONS.find((x) => x.id === "family-or-triangle").answer(profile28);
    const expected28 = JSON.parse(await load("data/redflag/love/published/28-2.json"));
    assert.equal(published28.answer, expected28.entries["family-or-triangle"]);
    assert.equal(requests.length, 6, "Approved February 28 loads exactly once");
    assert.match(requests[5], /love\/published\/28-2\.json$/);

    const legacy = await bank.QUESTIONS.find((x) => x.id === "romance").answer({
      classic: { birthDate: { day: 14, month: 2 } },
      affection: "warm"
    });
    assert.ok(legacy.answer.length > 20, "Other dates still receive the original answer");
    assert.equal(requests.length, 6, "Unpublished date does not download a Love file");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
