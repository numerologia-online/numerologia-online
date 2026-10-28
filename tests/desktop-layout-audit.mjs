import { chromium } from "playwright";
const browser=await chromium.launch({headless:true});
let failures=0;
const pages=[
 ["home","/"],
 ["child","/child/"],
 ["year","/year/"],
 ["pro","/pro/"]
];
for(const [name,path] of pages){
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errs=[];
 page.on("pageerror",e=>errs.push(String(e)));
 try {
   await page.goto("https://numerologia-online.github.io/numerologia-online"+path+"?desktop-audit=20261028",{waitUntil:"domcontentloaded",timeout:35000});
   await page.waitForTimeout(1500);
   const metrics=await page.evaluate(()=>{
      const els=[...document.querySelectorAll("body *")].filter(x=>{
        const r=x.getBoundingClientRect(),st=getComputedStyle(x);
        return st.display!=="none"&&st.visibility!=="hidden"&&r.width>2&&r.height>2;
      });
      const over=els.filter(x=>x.getBoundingClientRect().left< -5||x.getBoundingClientRect().right>innerWidth+5)
        .filter(x=>getComputedStyle(x).position!=="fixed").slice(0,15).map(x=>({tag:x.tagName,cls:String(x.className).slice(0,60),left:Math.round(x.getBoundingClientRect().left),right:Math.round(x.getBoundingClientRect().right)}));
      const shell=document.querySelector(".app-shell,.child-page,.pro-shell");
      const bounds=shell?.getBoundingClientRect();
      return {viewport:innerWidth,shellWidth:Math.round(bounds?.width??0),shellLeft:Math.round(bounds?.left??0),scrollWidth:document.documentElement.scrollWidth,over,images:[...document.images].slice(0,8).map(x=>({src:x.src.split("/").pop(),loaded:x.complete&&x.naturalWidth>0}))};
   });
   console.log("METRIC:"+name+":"+JSON.stringify({ ...metrics,errors:errs }));
   const jpeg=await page.screenshot({type:"jpeg",quality:47});
   const b64=jpeg.toString("base64");
   for(let pos=0,i=0;pos<b64.length;pos+=4600,i++) console.log("SCREEN:"+name+":"+i+":"+b64.slice(pos,pos+4600));
 } catch(err){failures++;console.log("ERROR:"+name+":"+String(err))}
 finally{await page.close()}
}
await browser.close();
if(failures)process.exitCode=1;
