import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const cases = [
  { today:"2026-10-28T12:00:00Z", year:2026, free:9, locked:3 },
  { today:"2026-11-01T12:00:00Z", year:2026, free:10, locked:2 },
  { today:"2026-10-28T12:00:00Z", year:2025, free:12, locked:0 },
  { today:"2026-10-28T12:00:00Z", year:2027, free:0, locked:12 }
];
try {
  for (const item of cases) {
    const page = await browser.newPage({ viewport:{ width:390, height:844 } });
    const errors = [];
    const pdfRequests = [];
    page.on("pageerror", e => errors.push(String(e)));
    page.on("request", req => { if (/pdfmake|vfs_fonts/.test(req.url())) pdfRequests.push(req.url()); });
    try {
      await page.goto("http://127.0.0.1:8765/year/", { waitUntil:"domcontentloaded", timeout:30000 });
      await page.clock.setFixedTime(new Date(item.today));
      await page.locator("#birth-date").fill("09.09.1986");
      await page.locator("#report-year").fill(String(item.year));
      await page.locator('#year-form button[type="submit"]').click();
      await page.locator("#report").waitFor({state:"visible",timeout:35000});
      assert.equal(await page.locator("#months details").count(),12);
      assert.equal(await page.locator("#months .month-card--locked").count(),item.locked);
      assert.equal(await page.locator("#months .month-card:not(.month-card--locked)").count(),item.free);
      assert.equal(await page.locator("#year-paywall-dialog").isVisible(), false);
      // Only one month may remain open: previous long forecast collapses.
      const firstMonth = page.locator("#months details.month-card").nth(0);
      const secondMonth = page.locator("#months details.month-card").nth(1);
      await firstMonth.locator("summary").click();
      assert.equal(await firstMonth.evaluate(el => el.open), true);
      await secondMonth.locator("summary").click();
      await page.waitForFunction(() => document.querySelectorAll("#months > details.month-card[open]").length === 1);
      assert.equal(await firstMonth.evaluate(el => el.open), false, "first month must collapse");
      assert.equal(await secondMonth.evaluate(el => el.open), true, "second month must remain open");
      await secondMonth.locator("summary").click();
      if (item.locked > 0) {
        const locked = page.locator("#months .month-card--locked").first();
        await locked.locator("summary").click();
        await locked.locator(".year-paywall-open").click();
        await page.locator("#year-paywall-dialog").waitFor({state:"visible"});
        await page.locator("#year-paywall-close").click();
        assert.equal(await page.locator("#year-paywall-dialog").isVisible(),false);
      }
      if (item.free > 0) {
        const free = page.locator("#months .month-card:not(.month-card--locked)").first();
        await free.locator("summary").click();
        assert.ok((await free.locator(".month-content").innerText()).length > 200,"free authored month missing");
      }
      await page.locator("#pdf-button-top").click();
      await page.locator("#year-paywall-dialog").waitFor({state:"visible"});
      await page.locator(".year-paywall-back").click();
      await page.locator("#pdf-button").click();
      await page.locator("#year-paywall-dialog").waitFor({state:"visible"});
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#year-paywall-dialog").isVisible(),false);
      assert.deepEqual(pdfRequests,[],"paid PDF library was fetched in preview");
      assert.deepEqual(errors,[],"browser JS errors");
      console.log("PASS: "+item.today+" report "+item.year+" free "+item.free+" locked "+item.locked+" PDF gated");
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
