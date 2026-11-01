/* Lightweight aggregate event counts. No cookies, storage, user ID or raw search text. */
"use strict";
(() => {
  if (window.NumiAnalytics) return;
  const dnt=navigator.globalPrivacyControl===true ||
    navigator.doNotTrack==="1" || window.doNotTrack==="1";
  const campaign=(()=>{
    const p=new URLSearchParams(location.search);
    const tag=p.get("utm_campaign")||p.get("campaign")||"";
    return /^[a-z0-9_-]{1,48}$/i.test(tag)?tag.toLowerCase():"-";
  })();
  function send(type,section,item="-"){
    if(dnt||!["page","category","question","search","campaign"].includes(type))return;
    if(!/^[a-z0-9_-]{1,48}$/i.test(section)||!/^[a-z0-9_-]{1,72}$/i.test(item))return;
    const payload=JSON.stringify({type,section,item,campaign});
    try{
      fetch("/api/numi-analytics.php",{method:"POST",mode:"same-origin",credentials:"omit",keepalive:true,
        headers:{"Content-Type":"application/json"},body:payload}).catch(()=>{});
    }catch(_){}
  }
  window.NumiAnalytics={send};
  if(campaign!=="-")send("campaign","entry","-",campaign);
})();
