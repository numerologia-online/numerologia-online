import test from "node:test";
import assert from "node:assert/strict";
import { freeYearMonthLimit, isFreeYearMonth } from "../year-access.js";
const at = (y, m, day=15) => new Date(y, m-1, day, 12, 0, 0);
test("October 2026: all months through September free, October through December locked", () => {
  const now = at(2026,10,28);
  assert.equal(freeYearMonthLimit(2026, now), 9);
  for (let m=1;m<=12;m++) assert.equal(isFreeYearMonth(2026,m,now), m<=9);
});
test("November 2026: October unlocks but November remains paid", () => {
  const now=at(2026,11,1);
  assert.equal(freeYearMonthLimit(2026,now),10);
  assert.equal(isFreeYearMonth(2026,10,now),true);
  assert.equal(isFreeYearMonth(2026,11,now),false);
});
test("January: nothing in the current year is finished yet", () => {
  assert.equal(freeYearMonthLimit(2027,at(2027,1,1)),0);
  assert.equal(isFreeYearMonth(2027,1,at(2027,1)),false);
});
test("Past report years are fully readable, future years are locked", () => {
  const now=at(2026,10,28);
  assert.equal(freeYearMonthLimit(2025,now),12);
  assert.equal(freeYearMonthLimit(2027,now),0);
  assert.equal(isFreeYearMonth(2025,12,now),true);
  assert.equal(isFreeYearMonth(2027,1,now),false);
  assert.equal(isFreeYearMonth(2026,0,now),false);
});
