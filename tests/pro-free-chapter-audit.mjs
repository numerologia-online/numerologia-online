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
