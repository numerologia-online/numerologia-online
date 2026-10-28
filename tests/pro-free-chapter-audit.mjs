import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const get = p => JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8").replace(/^\uFEFF/,""));
for(let i=1;i<=22;i++){
  const full=get("knowledge/full-report/sections/energy-"+i+".json");
  const free=get("knowledge/full-report/free/impression/energy-"+i+".json");
  assert.equal(free.id,i);
  assert.deepEqual(Object.keys(free.sections),["impression"]);
  assert.deepEqual(free.sections.impression,full.sections.impression);
}
console.log("PASS 22 energies: isolated free chapter exactly matches original authored source");

const browser=await chromium.launch({headless:true});
const cases=[{date:"09.09.1986",energy:9},{date:"01.02.2024",energy:1},{date:"22.02.1999",energy:22}];
let failures=[];
try{
 for(const sample of cases){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[],paidUrls=[];
  page.on("pageerror",e=>errors.push(String(e)));
  page.on("request",req=>{
    if(/\/knowledge\/full-report\/sections\/energy-\d+\.json/.test(req.url()))paidUrls.push(req.url());
  });
  try{
    await page.goto("http://127.0.0.1:8765/pro/",{waitUntil:"domcontentloaded",timeout:25000});
    await page.locator("#pro-birth-date").fill(sample.date);
    await page.locator("#pro-form button[type=submit]").click();
    await page.locator("#pro-question-impression").waitFor({state:"visible",timeout:35000});
    // A refreshed page must preserve the last calculated date and reopen the result.
    await page.reload({waitUntil:"domcontentloaded",timeout:25000});
    await page.locator("#pro-results").waitFor({state:"visible",timeout:35000});
    assert.equal(await page.locator("#pro-birth-date").inputValue(),sample.date,
      "date should survive reload after opening a calculation");
    assert.equal(await page.locator("#pro-diagram .pro-node").count(),31,
      "restored calculation should regenerate all matrix points");
    const compactLayout = await page.evaluate(() => {
      const form = document.querySelector("#pro-form").getBoundingClientRect();
      const paper = document.querySelector("#pro-results > .pro-paper").getBoundingClientRect();
      const title = document.querySelector("#pro-matrix-title");
      return {
        gap: paper.top - form.bottom,
        titleFont: Number.parseFloat(getComputedStyle(title).fontSize),
        titleHeight: title.getBoundingClientRect().height
      };
    });
    assert.ok(compactLayout.gap <= 15,
      "mobile result must start right below the form, without a giant gap");
    assert.ok(compactLayout.titleFont <= 24 && compactLayout.titleHeight <= 60,
      "calculator title should stay small and not dominate the mobile screen");
    await page.locator("#pro-question-impression").click();
    await page.locator("#pro-answer-impression .pro-inline-reading-title, #pro-answer-impression h3").first().waitFor({state:"visible",timeout:20000});
    const first=await page.locator("#pro-answer-impression").innerText();
    assert.ok(first.includes("Как видят вас другие"),"free question has correct title");
    assert.ok(first.length>300,"free interpretation must be complete");
    const shownEnergy=(await page.locator("#pro-answer-impression .pro-chips").innerText());
    assert.ok(shownEnergy.includes("Энергия "+sample.energy),"free number must match birth date");

    await page.locator("#pro-question-trueSelf").click();
    await page.locator("#pro-answer-trueSelf .pro-paid-lock").waitFor({state:"visible"});
    // Both new discoverability controls must open the exact same free authored chapter.
    const freeSphereButton = page.locator("#pro-free-impression");
    await freeSphereButton.waitFor({state:"visible"});
    await freeSphereButton.click();
    await page.locator("#pro-point-details .pro-inline-reading-title").waitFor({state:"visible",timeout:20000});
    assert.ok((await page.locator("#pro-point-details").innerText()).includes("Как видят вас другие"),
      "free entry next to locked spheres must open original left chapter");
    assert.match(await page.locator("#pro-matrix-title").innerText(), /Ваш личный калькулятор жизни/);
    assert.match(await page.locator("#pro-matrix-start").innerText(), /НАЧНИТЕ ЗДЕСЬ/);
    assert.equal(await page.locator(".pro-free-node-guide").count(), 0,
      "matrix is unobstructed by the old green note");
    assert.equal(await page.locator(".pro-quick-nav").count(), 0,
      "redundant top section-navigation chips must be removed");
    const freeGuide = page.locator(".pro-free-start-arrow");
    await freeGuide.waitFor({state:"visible"});
    assert.equal(await freeGuide.evaluate(el => getComputedStyle(el).pointerEvents), "none",
      "decorative arrow must not intercept any matrix taps");
    const arrowLine = await freeGuide.locator("path").first().getAttribute("d");
    assert.equal(arrowLine, "M 14 6 L 14 260 L 28 293",
      "visible straight arrow must reach the free left circle");
    assert.equal(await freeGuide.locator("polygon").getAttribute("points"),
      "28,294 9,284 31,272",
      "large filled triangular arrow head must point to the free circle");
    assert.ok(!/[CQ]/.test(arrowLine),
      "the arrow must not contain unwanted curves");
    assert.equal(await page.locator(".pro-matrix-free-label").innerText(),"БЕСПЛАТНО",
      "a contrasting red free label belongs next to Start Here");
    const layout=await page.locator("#pro-diagram svg").evaluate(svg => {
      const labels=[...svg.querySelectorAll(".pro-sector-tag")].map(el => {
        const key=el.getAttribute("data-zone");
        const box=el.querySelector("rect:not(.pro-sector-hitbox)");
        return {key,y:Number(box.getAttribute("y"))+Number(box.getAttribute("height"))/2};
      });
      return {viewHeight:svg.viewBox.baseVal.height,nodeCount:svg.querySelectorAll(".pro-node").length,labels};
    });
    assert.equal(layout.viewHeight,727,"matrix should not include the old third row's empty height");
    assert.equal(layout.nodeCount,31,"no matrix numbers may be removed while compacting labels");
    assert.equal(layout.labels.length,13,"all thirteen topic labels must remain");
    for(const key of ["lessons","growth"]){
      assert.equal(layout.labels.find(x=>x.key===key)?.y,620,"first compact lower row must remain grouped");
    }
    for(const key of ["purpose","career"]){
      assert.equal(layout.labels.find(x=>x.key===key)?.y,681,"second compact lower row must remain grouped");
    }
    const left=page.locator('.pro-node[data-node-key="left"]');
    await left.click();
    // Matrix UI deliberately opens a small preview first, then full reading.
    await page.locator(".pro-point-preview").waitFor({state:"visible",timeout:10000});
    await page.locator(".pro-point-preview").click();
    await page.locator("#pro-point-details .pro-inline-reading-title").waitFor({state:"visible",timeout:20000});
    assert.ok((await page.locator("#pro-point-details").innerText()).includes("Как видят вас другие"),"left point should open public first chapter");
    await page.locator('.pro-node[data-node-key="right"]').click();
    await page.locator(".pro-point-preview").waitFor({state:"visible"});
    await page.locator(".pro-point-preview").click();
    await page.locator("#pro-point-details .pro-paid-lock").waitFor({state:"visible"});
    await page.locator("#pro-pdf-buttons .pro-pdf-button").first().waitFor({state:"visible",timeout:20000});
    await page.locator("#pro-pdf-buttons .pro-pdf-button").first().click();
    await page.locator("#pro-paywall-dialog").waitFor({state:"visible"});
    await page.locator('#pro-paywall-dialog form button[type="submit"]').click();
    if (sample.date === "09.09.1986") {
      // Recalculation for a different birthday must replace (not mix) saved data.
      await page.locator("#pro-birth-date").fill("15.08.1992");
      await page.locator("#pro-form button[type=submit]").click();
      await page.locator("#pro-results").waitFor({state:"visible",timeout:35000});
      await page.reload({waitUntil:"domcontentloaded",timeout:25000});
      await page.locator("#pro-results").waitFor({state:"visible",timeout:35000});
      assert.equal(await page.locator("#pro-birth-date").inputValue(),"15.08.1992",
        "later calculation should replace the remembered birthday");
    }
    assert.deepEqual(errors,[],"no JavaScript exceptions");
    assert.deepEqual(paidUrls,[],"free visitor must not fetch full paid energy files");
    console.log("PASS "+sample.date+": first question, left circle open; paid answer, right circle and PDF locked; no full paid bank requests");
  }catch(e){
    failures.push({date:sample.date,error:String(e),errors,paidUrls});
    console.error("FAIL "+sample.date+": "+String(e)+" "+JSON.stringify({errors,paidUrls}));
  }finally{await page.close()}
 }
}finally{await browser.close()}
if(failures.length)process.exitCode=1;
