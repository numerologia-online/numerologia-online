import { chromium } from 'playwright';
import { calculateMatrix } from '../numerology-core.js';
const expected = new Map();
for (let year=1900;year<=2026;year++) for(let month=1;month<=12;month++) for(let day=1;day<=31;day++){
 const date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year || date.getUTCMonth()!==month-1 || date.getUTCDate()!==day) continue;
 if(year===2026 && (month>10 || month===10 && day>28)) continue;
 const m=calculateMatrix({day,month,year});
 const key=[m.tail.first,m.tail.second,m.bottom].join('-');
 if(!expected.has(key)) expected.set(key, String(day).padStart(2,'0')+'.'+String(month).padStart(2,'0')+'.'+year);
}
const catalog = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../child/data/matrix/karmic-tail/index.json', import.meta.url),'utf8'));
const bank=Object.keys(catalog.available);
if(expected.size!==26 || bank.length!==26 || [...expected.keys()].some(k=>!bank.includes(k)))throw new Error('Catalog does not cover calculated tails');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
for(const [code,birth] of expected){
 try{
  await page.goto('https://numerologia-online.github.io/numerologia-online/child/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#child-date').fill(birth);
  await page.locator('#child-form button[type=submit]').click();
  const target=page.locator('[data-child-topic="tail"]');
  await target.waitFor({state:'visible',timeout:25000});
  if(!(await target.innerText()).includes(code.replaceAll('-', ' - ')))throw new Error('Wrong displayed tail code');
  await target.click();
  await page.locator('#child-insight-text h4').first().waitFor({state:'visible',timeout:25000});
  const title=await page.locator('#child-insight-title').innerText();
  const paragraphs=await page.locator('#child-insight-text p').count();
  if(paragraphs<6)throw new Error('Too few paragraphs: '+paragraphs);
  const expectedBank=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../child/data/matrix/karmic-tail/'+code+'.json',import.meta.url),'utf8'));
  if(title.trim()!==expectedBank.title.trim())throw new Error('Wrong title: '+title);
  console.log('PASS',code,birth,title);
 }catch(e){errors.push({code,birth,error:String(e)});console.error('FAIL',code,birth,String(e))}
}
await browser.close();
console.log(JSON.stringify({total:expected.size,passed:expected.size-errors.length,failed:errors},null,2));
if(errors.length)process.exitCode=1;
