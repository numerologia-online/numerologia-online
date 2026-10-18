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
  } finally {
    globalThis.fetch = originalFetch;
  }
});
