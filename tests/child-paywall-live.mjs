import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
let failures=[];
for(const date of ['01.02.2024','09.09.1986','19.07.2018']){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try {
    await page.goto('https://numerologia-online.github.io/numerologia-online/child/?audit=paywall-v1',{waitUntil:'networkidle',timeout:60000});
    await page.locator('#child-date').fill(date);
    await page.locator('#child-form button[type=submit]').click();
    await page.locator('[data-child-topic="character"]').waitFor({state:'visible',timeout:20000});
    await page.locator('[data-child-topic="character"]').click();
    await page.locator('#child-insight-text p').first().waitFor({state:'visible',timeout:20000});
    const free=await page.locator('#child-insight-text').innerText();
    if(!free || free.includes('🔒') || free.includes('Не удалось'))throw Error('First chapter not free');
    await page.locator('[data-child-topic="innerNature"]').click();
    await page.locator('.child-locked-note').waitFor({state:'visible'});
    await page.locator('[data-child-topic="tail"]').click();
    await page.locator('.child-locked-note').waitFor({state:'visible'});
    await page.locator('#child-pdf-top-open').click();
    if(!(await page.locator('#child-pdf-save').isDisabled()))throw Error('Guest can download PDF');
    await page.locator('#child-pdf-close').click();
    await page.locator('#child-tab-day').click();
    await page.locator('#child-day-text').waitFor({state:'visible'});
    console.log('PASS',date,'first chapter free; paid topics and PDF locked; Day tab available');
  }catch(e){failures.push({date,error:String(e)});console.error('FAIL',date,String(e))}
  finally{await page.close()}
}
await browser.close();
console.log(JSON.stringify({total:3,passed:3-failures.length,failures},null,2));
if(failures.length)process.exitCode=1;
