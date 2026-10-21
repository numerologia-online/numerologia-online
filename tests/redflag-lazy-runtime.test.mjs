import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Opening one Red Flag question never downloads the other big banks", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    requests.push(address.pathname);
    if (address.protocol !== "file:") throw new Error("Test tried external network: " + address);
    const content = await readFile(address, "utf8");
    return { ok: true, json: async () => JSON.parse(content) };
  };

  try {
    const money = await import("../data/redflag/categories/money-questions.js?smoke=lazy");
    assert.equal(requests.length, 1, "Opening category should load only question metadata");
    assert.match(requests[0], /money-questions\.json$/);
    assert.equal(money.QUESTIONS.length, 10);
    assert.deepEqual(money.QUESTIONS.map((question) => question.priceRub),
      [10, 10, 10, 29, 29, 29, 29, 49, 49, 49],
      "Money questions must retain the approved tier order");
    assert.deepEqual(money.QUESTIONS.slice(0, 3).map((question) => question.id),
      ["gift", "generosity", "courtship"],
      "Existing finished answer banks must remain attached to their question ids");
    const words = money.QUESTIONS.find((q) => q.id === "words-or-deeds");
    const profile = { classic: { birthDate: { day: 29, month: 2 } } };
    const result = await words.answer(profile);
    assert.ok(result.paragraphs?.[0]?.length > 100);
    assert.equal(requests.length, 2, "Only the chosen question bank should load");
    assert.match(requests[1], /words-or-deeds\.json$/);
    await words.answer(profile);
    assert.equal(requests.length, 2, "Reopening must reuse the same bank");

    const gift = money.QUESTIONS.find((q) => q.id === "gift");
    await gift.answer(profile);
    assert.equal(requests.length, 3, "A second bank loads only when its question opens");
    assert.match(requests[2], /gift\.json$/);

    // Legacy categorical answers must not depend on the birth year:
    // a man's day and month always select the same Red Flag profile.
    const { buildRelationshipProfile } = await import("../redflag-engine.js?smoke=day-month");
    const aspects = ["initiative", "affection", "commitment", "communication", "support",
      "money", "boundaries", "intimacy", "family", "language"];
    // Check the actual 366 calendar combinations, not just a few examples.
    // Both test years are leap years, so February 29 stays valid.
    let checkedDates = 0;
    for (let month = 1; month <= 12; month++) {
      const days = new Date(Date.UTC(2024, month, 0)).getUTCDate();
      for (let day = 1; day <= days; day++) {
        const first = buildRelationshipProfile({ day, month, year: 2000 });
        const second = buildRelationshipProfile({ day, month, year: 2024 });
        for (const aspect of aspects) {
          assert.equal(first[aspect], second[aspect],
            `Different Red Flag answer for ${day}-${month}, aspect ${aspect}`);
        }
        checkedDates++;
      }
    }
    assert.equal(checkedDates, 366);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
