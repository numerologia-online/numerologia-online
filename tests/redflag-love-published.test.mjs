import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dates = ["31-1", "1-2", "2-2", "3-2", "4-2", "5-2", "6-2", "7-2", "8-2", "9-2", "10-2";
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

    const legacy = await bank.QUESTIONS.find((x) => x.id === "romance").answer({
      classic: { birthDate: { day: 11, month: 2 } },
      affection: "warm"
    });
    assert.ok(legacy.answer.length > 20, "Other dates still receive the original answer");
    assert.equal(requests.length, 2, "Other dates do not download published Love files");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
