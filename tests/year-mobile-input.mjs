import assert from "node:assert/strict";
import { chromium, webkit, devices } from "playwright";
const scenarios=[
  {label:"standalone",url:"https://numerologia-online.github.io/numerologia-online/year/?mobile-audit=20261028"},
  {label:"homepage",url:"https://numerologia-online.github.io/numerologia-online/?mobile-audit=20261028"}
];
let failures=0;
for(const [engineName,engine] of [["chromium",chromium],["webkit",webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const item of scenarios){
   const ctx=await browser.newContext({...devices["iPhone 13"],locale:"ru-RU"});
   const page=await ctx.newPage();const errors=[];const badNetwork=[];
   page.on("pageerror",e=>errors.push(String(e)));
   page.on("response",r=>{if(r.status()>=400&&(/year-feature|year-access|year-content|energy|year-paywall/.test(r.url())))badNetwork.push(r.status()+" "+r.url())});
   try{
    await page.goto(item.url,{waitUntil:"domcontentloaded",timeout:55000});
    if(item.label==="homepage"){await page.locator('[data-open-year]').click();}
    await page.locator("#birth-date").waitFor({state:"visible",timeout:20000});
    await page.locator("#birth-date").click();
    await page.locator("#birth-date").pressSequentially("09091986",{delay:60});
    const entered=await page.locator("#birth-date").inputValue();
    console.log("INPUT",engineName,item.label,entered);
    assert.equal(entered,"09.09.1986","Typing 8 digits must add dots on iPhone");
    await page.locator("#report-year").fill("2026");
    await page.locator("#year-form button[type=submit]").click();
    await page.locator("#report").waitFor({state:"visible",timeout:35000});
    assert.equal(await page.locator("#months details").count(),12);
    assert.equal(await page.locator(".month-card--locked").count(),3);
    assert.deepEqual(errors,[],"browser JS errors");
    assert.deepEqual(badNetwork,[],"broken year JS/data URL");
    console.log("PASS",engineName,item.label,"iPhone 8 digits => 09.09.1986; year report loads");
   } catch(e){
    failures++;
    console.error("FAIL",engineName,item.label,String(e),"errors",JSON.stringify(errors),"network",JSON.stringify(badNetwork));
   }finally{await ctx.close()}
  }
 } finally {await browser.close()}
}
if(failures)process.exitCode=1;
