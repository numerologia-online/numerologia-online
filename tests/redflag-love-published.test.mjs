import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dates = ["31-1", "1-2", "2-2", "3-2", "4-2", "5-2", "6-2", "7-2", "8-2", "9-2", "10-2", "11-2", "12-2", "13-2", "15-2", "16-2", "17-2", "18-2", "23-2", "24-2", "25-2", "26-2", "27-2", "28-2", "29-2", "1-3", "2-3", "3-3", "4-3", "5-3", "6-3", "7-3", "8-3", "9-3", "10-3", "11-3", "12-3", "13-3", "14-3", "15-3", "16-3", "17-3", "18-3", "19-3", "20-3", "21-3", "22-3", "23-3", "24-3", "25-3", "26-3"];
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

    const profile29 = { classic: { birthDate: { day: 29, month: 2 } } };
    const published29 = await bank.QUESTIONS.find((x) => x.id === "love-or-attention").answer(profile29);
    const expected29 = JSON.parse(await load("data/redflag/love/published/29-2.json"));
    assert.equal(published29.answer, expected29.entries["love-or-attention"]);
    assert.equal(requests.length, 7, "Leap day February 29 loads exactly once");
    assert.match(requests[6], /love\/published\/29-2\.json$/);

    const march1Profile = { classic: { birthDate: { day: 1, month: 3 } } };
    const march1Answer = await bank.QUESTIONS.find((x) => x.id === "first-step").answer(march1Profile);
    const march1Expected = JSON.parse(await load("data/redflag/love/published/1-3.json"));
    assert.equal(march1Answer.answer, march1Expected.entries["first-step"]);
    assert.equal(requests.length, 8, "Approved March 1 loads exactly once");
    assert.match(requests[7], /love\/published\/1-3\.json$/);

    const march2Profile = { classic: { birthDate: { day: 2, month: 3 } } };
    const march2Answer = await bank.QUESTIONS.find((x) => x.id === "romance").answer(march2Profile);
    const march2Expected = JSON.parse(await load("data/redflag/love/published/2-3.json"));
    assert.equal(march2Answer.answer, march2Expected.entries["romance"]);
    assert.equal(requests.length, 9, "Approved March 2 loads exactly once");
    assert.match(requests[8], /love\/published\/2-3\.json$/);

    const march3Profile = { classic: { birthDate: { day: 3, month: 3 } } };
    const march3Answer = await bank.QUESTIONS.find((x) => x.id === "relationship-or-comfort").answer(march3Profile);
    const march3Expected = JSON.parse(await load("data/redflag/love/published/3-3.json"));
    assert.equal(march3Answer.answer, march3Expected.entries["relationship-or-comfort"]);
    assert.equal(requests.length, 10, "Approved March 3 loads exactly once");
    assert.match(requests[9], /love\/published\/3-3\.json$/);

    const march4Profile = { classic: { birthDate: { day: 4, month: 3 } } };
    const march4Answer = await bank.QUESTIONS.find((x) => x.id === "adult-partner").answer(march4Profile);
    const march4Expected = JSON.parse(await load("data/redflag/love/published/4-3.json"));
    assert.equal(march4Answer.answer, march4Expected.entries["adult-partner"]);
    assert.equal(requests.length, 11, "Approved March 4 loads exactly once");
    assert.match(requests[10], /love\/published\/4-3\.json$/);

    const march5Profile = { classic: { birthDate: { day: 5, month: 3 } } };
    const march5Answer = await bank.QUESTIONS.find((x) => x.id === "near-him").answer(march5Profile);
    const march5Expected = JSON.parse(await load("data/redflag/love/published/5-3.json"));
    assert.equal(march5Answer.answer, march5Expected.entries["near-him"]);
    assert.equal(requests.length, 12, "Approved March 5 loads exactly once");
    assert.match(requests[11], /love\/published\/5-3\.json$/);

    const march6Profile = { classic: { birthDate: { day: 6, month: 3 } } };
    const march6Answer = await bank.QUESTIONS.find((x) => x.id === "first-step").answer(march6Profile);
    const march6Expected = JSON.parse(await load("data/redflag/love/published/6-3.json"));
    assert.equal(march6Answer.answer, march6Expected.entries["first-step"]);
    assert.equal(requests.length, 13, "Approved March 6 loads exactly once");
    assert.match(requests[12], /love\/published\/6-3\.json$/);

    const march7Profile = { classic: { birthDate: { day: 7, month: 3 } } };
    const march7Answer = await bank.QUESTIONS.find((x) => x.id === "romance").answer(march7Profile);
    const march7Expected = JSON.parse(await load("data/redflag/love/published/7-3.json"));
    assert.equal(march7Answer.answer, march7Expected.entries["romance"]);
    assert.equal(requests.length, 14, "Approved March 7 loads exactly once");
    assert.match(requests[13], /love\/published\/7-3\.json$/);

    const march8Profile = { classic: { birthDate: { day: 8, month: 3 } } };
    const march8Answer = await bank.QUESTIONS.find((x) => x.id === "relationship-or-comfort").answer(march8Profile);
    const march8Expected = JSON.parse(await load("data/redflag/love/published/8-3.json"));
    assert.equal(march8Answer.answer, march8Expected.entries["relationship-or-comfort"]);
    assert.equal(requests.length, 15, "Approved March 8 loads exactly once");
    assert.match(requests[14], /love\/published\/8-3\.json$/);

    const march9Profile = { classic: { birthDate: { day: 9, month: 3 } } };
    const march9Answer = await bank.QUESTIONS.find((x) => x.id === "adult-partner").answer(march9Profile);
    const march9Expected = JSON.parse(await load("data/redflag/love/published/9-3.json"));
    assert.equal(march9Answer.answer, march9Expected.entries["adult-partner"]);
    assert.equal(requests.length, 16, "Approved March 9 loads exactly once");
    assert.match(requests[15], /love\/published\/9-3\.json$/);

    const march10Profile = { classic: { birthDate: { day: 10, month: 3 } } };
    const march10Answer = await bank.QUESTIONS.find((x) => x.id === "first-step").answer(march10Profile);
    const march10Expected = JSON.parse(await load("data/redflag/love/published/10-3.json"));
    assert.equal(march10Answer.answer, march10Expected.entries["first-step"]);
    assert.equal(requests.length, 17, "Approved March 10 loads exactly once");
    assert.match(requests[16], /love\/published\/10-3\.json$/);

    const march11Profile = { classic: { birthDate: { day: 11, month: 3 } } };
    const march11Answer = await bank.QUESTIONS.find((x) => x.id === "romance").answer(march11Profile);
    const march11Expected = JSON.parse(await load("data/redflag/love/published/11-3.json"));
    assert.equal(march11Answer.answer, march11Expected.entries["romance"]);
    assert.equal(requests.length, 18, "Approved March 11 loads exactly once");
    assert.match(requests[17], /love\/published\/11-3\.json$/);

    const march12Profile = { classic: { birthDate: { day: 12, month: 3 } } };
    const march12Answer = await bank.QUESTIONS.find((x) => x.id === "relationship-or-comfort").answer(march12Profile);
    const march12Expected = JSON.parse(await load("data/redflag/love/published/12-3.json"));
    assert.equal(march12Answer.answer, march12Expected.entries["relationship-or-comfort"]);
    assert.equal(requests.length, 19, "Approved March 12 loads exactly once");
    assert.match(requests[18], /love\/published\/12-3\.json$/);

    const march13Profile = { classic: { birthDate: { day: 13, month: 3 } } };
    const march13Answer = await bank.QUESTIONS.find((x) => x.id === "adult-partner").answer(march13Profile);
    const march13Expected = JSON.parse(await load("data/redflag/love/published/13-3.json"));
    assert.equal(march13Answer.answer, march13Expected.entries["adult-partner"]);
    assert.equal(requests.length, 20, "Approved March 13 loads exactly once");
    assert.match(requests[19], /love\/published\/13-3\.json$/);

    const march14Profile = { classic: { birthDate: { day: 14, month: 3 } } };
    const march14Answer = await bank.QUESTIONS.find((x) => x.id === "relationship-or-comfort").answer(march14Profile);
    const march14Expected = JSON.parse(await load("data/redflag/love/published/14-3.json"));
    assert.equal(march14Answer.answer, march14Expected.entries["relationship-or-comfort"]);
    assert.equal(requests.length, 21, "Approved March 14 loads exactly once");
    assert.match(requests[20], /love\/published\/14-3\.json$/);

    const march15Profile = { classic: { birthDate: { day: 15, month: 3 } } };
    const march15Answer = await bank.QUESTIONS.find((x) => x.id === "first-step").answer(march15Profile);
    const march15Expected = JSON.parse(await load("data/redflag/love/published/15-3.json"));
    assert.equal(march15Answer.answer, march15Expected.entries["first-step"]);
    assert.equal(requests.length, 22, "Approved March 15 loads exactly once");
    assert.match(requests[21], /love\/published\/15-3\.json$/);

    const march16Profile = { classic: { birthDate: { day: 16, month: 3 } } };
    const march16Answer = await bank.QUESTIONS.find((x) => x.id === "honest-or-disappear").answer(march16Profile);
    const march16Expected = JSON.parse(await load("data/redflag/love/published/16-3.json"));
    assert.equal(march16Answer.answer, march16Expected.entries["honest-or-disappear"]);
    assert.equal(requests.length, 23, "Approved March 16 loads exactly once");
    assert.match(requests[22], /love\/published\/16-3\.json$/);

    const march17Profile = { classic: { birthDate: { day: 17, month: 3 } } };
    const march17Answer = await bank.QUESTIONS.find((x) => x.id === "adult-partner").answer(march17Profile);
    const march17Expected = JSON.parse(await load("data/redflag/love/published/17-3.json"));
    assert.equal(march17Answer.answer, march17Expected.entries["adult-partner"]);
    assert.equal(requests.length, 24, "Approved March 17 loads exactly once");
    assert.match(requests[23], /love\/published\/17-3\.json$/);

    const march18Profile = { classic: { birthDate: { day: 18, month: 3 } } };
    const march18Answer = await bank.QUESTIONS.find((x) => x.id === "love-or-attention").answer(march18Profile);
    const march18Expected = JSON.parse(await load("data/redflag/love/published/18-3.json"));
    assert.equal(march18Answer.answer, march18Expected.entries["love-or-attention"]);
    assert.equal(requests.length, 25, "Approved March 18 loads exactly once");
    assert.match(requests[24], /love\/published\/18-3\.json$/);

    const march19Profile = { classic: { birthDate: { day: 19, month: 3 } } };
    const march19Answer = await bank.QUESTIONS.find((x) => x.id === "near-him").answer(march19Profile);
    const march19Expected = JSON.parse(await load("data/redflag/love/published/19-3.json"));
    assert.equal(march19Answer.answer, march19Expected.entries["near-him"]);
    assert.equal(requests.length, 26, "Approved March 19 loads exactly once");
    assert.match(requests[25], /love\/published\/19-3\.json$/);

    const march20Profile = { classic: { birthDate: { day: 20, month: 3 } } };
    const march20Answer = await bank.QUESTIONS.find((x) => x.id === "adult-partner").answer(march20Profile);
    const march20Expected = JSON.parse(await load("data/redflag/love/published/20-3.json"));
    assert.equal(march20Answer.answer, march20Expected.entries["adult-partner"]);
    assert.equal(requests.length, 27, "Approved March 20 loads exactly once");
    assert.match(requests[26], /love\/published\/20-3\.json$/);

    const march21Profile = { classic: { birthDate: { day: 21, month: 3 } } };
    const march21Answer = await bank.QUESTIONS.find((x) => x.id === "family-or-triangle").answer(march21Profile);
    const march21Expected = JSON.parse(await load("data/redflag/love/published/21-3.json"));
    assert.equal(march21Answer.answer, march21Expected.entries["family-or-triangle"]);
    assert.equal(requests.length, 28, "Approved March 21 loads exactly once");
    assert.match(requests[27], /love\/published\/21-3\.json$/);

    const march22Profile = { classic: { birthDate: { day: 22, month: 3 } } };
    const march22Answer = await bank.QUESTIONS.find((x) => x.id === "love-or-attention").answer(march22Profile);
    const march22Expected = JSON.parse(await load("data/redflag/love/published/22-3.json"));
    assert.equal(march22Answer.answer, march22Expected.entries["love-or-attention"]);
    assert.equal(requests.length, 29, "Approved March 22 loads exactly once");
    assert.match(requests[28], /love\/published\/22-3\.json$/);

    const legacy = await bank.QUESTIONS.find((x) => x.id === "romance").answer({
      classic: { birthDate: { day: 14, month: 2 } },
      affection: "warm"
    });
    assert.ok(legacy.answer.length > 20, "Other dates still receive the original answer");
    assert.equal(requests.length, 29, "Unpublished date does not download a Love file");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
