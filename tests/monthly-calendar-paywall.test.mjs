import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const feature = readFileSync(new URL("../personal-day-feature.js", import.meta.url), "utf8");
const dayPage = readFileSync(new URL("../day.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("Daily authored reading remains free and unchanged", () => {
  assert.match(feature, /const item = await loadPersonalDay\(birth\)/);
  assert.match(feature, /item\.todayNeed/);
  assert.match(feature, /item\.todayAvoid/);
});
test("Important dates show a subscriber preview, not actual dates", () => {
  assert.match(feature, /Важные числа месяца/);
  assert.match(feature, /ТВОЙ КАЛЕНДАРЬ · ПО ПОДПИСКЕ/);
  assert.match(feature, /Месячная подписка ещё готовится/);
  assert.match(feature, /const subscriptionInfo = result\.querySelector\("\.personal-month-subscription"\)/);
  assert.doesNotMatch(feature, /class="personal-month-content"/);
  assert.doesNotMatch(feature, /class="personal-month-day personal-month-/);
  assert.doesNotMatch(feature, /\$\{cells\.join\("…"\)\}/);
  assert.doesNotMatch(feature, /monthMarkedDays\(birth, date\)/);
});
test("All public entries load the same updated day module", () => {
  assert.match(dayPage, /personal-day-feature\.js\?v=58/);
  assert.match(app, /personal-day-feature\.js\?v=58/);
});
