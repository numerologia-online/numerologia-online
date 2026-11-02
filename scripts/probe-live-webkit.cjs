/* Read-only public live-site smoke test. Never submits forms or purchases. */
const { webkit } = require('playwright');
const fs = require('fs');
const origin = 'https://xn--c1adkkdfjbp1a4l.online/';
const actions = [
  {name:'redflag',button:'[data-open-redflag]',target:'#redflag'},
  {name:'compatibility',button:'[data-open-compatibility]',target:'#compatibility'},
  {name:'money',button:'[data-open-destiny-code]',target:'#destiny-code'},
  {name:'year',button:'[data-open-year]',target:'#year'},
  {name:'matrix',button:'[data-open-matrix]',target:'#matrix'},
  {name:'day',button:'[data-open-personal-day]',target:'#personal-day'},
  {name:'account',button:"[data-account-open='profile']",target:'#account-dialog'}
];
(async()=>{
 const browser=await webkit.launch({headless:true});
 const output={kind:'read-only browser smoke test',engine:'WebKit',cases:[]};
 try {
   for(const action of actions){
     const page=await browser.newPage({viewport:{width:390,height:844},locale:'ru-RU',isMobile:true,hasTouch:true});
     const errors=[],responses=[],alerts=[];
     page.on('pageerror',e=>errors.push(String(e.message||e).slice(0,600)));
     page.on('console',m=>{if(m.type()==='error')errors.push(('console:'+m.text()).slice(0,500));});
     page.on('response',r=>{if(r.status()>=400 && r.url().startsWith(origin))responses.push({status:r.status(),path:new URL(r.url()).pathname});});
     page.on('dialog', async d=>{alerts.push({type:d.type(),message:d.message().slice(0,300)});await d.dismiss();});
     const item={name:action.name,button:action.button,target:action.target};
     try{
       const start=Date.now();
       const response=await page.goto(origin+'?numi_smoke='+action.name+'_'+Date.now(),{waitUntil:'domcontentloaded',timeout:35000});
       item.pageStatus=response?.status();
       item.pageElapsedMs=Date.now()-start;
       await page.waitForTimeout(1200);
       item.buttonCount=await page.locator(action.button).count();
       if(item.buttonCount){
         await page.locator(action.button).first().evaluate(el=>el.click());
         await page.waitForTimeout(2400);
       }
       item.targetCount=await page.locator(action.target).count();
       item.open=await page.evaluate(sel=>{
         const el=document.querySelector(sel);if(!el)return false;
         const style=getComputedStyle(el);
         return !el.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&(el.tagName!=='DIALOG'||el.open);
       },action.target);
       item.homeHidden=await page.evaluate(()=>document.querySelector('#home')?.hidden);
     }catch(e){item.testError=String(e.message||e).slice(0,450);}
     item.errors=errors.slice(0,12);
     item.httpErrors=responses.slice(0,12);
     item.alerts=alerts.slice(0,6);
     output.cases.push(item);
     await page.close();
   }
 }finally{await browser.close();}
 fs.mkdirSync('diagnostics',{recursive:true});
 fs.writeFileSync('diagnostics/regru-webkit.json',JSON.stringify(output,null,2)+'\n');
 for(const item of output.cases)console.log('CASE',item.name,'opened='+item.open,'errors='+item.errors.length,'httpErrors='+item.httpErrors.length,'alerts='+item.alerts.length);
})().catch(e=>{console.error(String(e));process.exit(1)});
