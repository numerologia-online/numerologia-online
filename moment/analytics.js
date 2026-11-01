/* Lightweight aggregate event counts. No cookies, storage, user ID or raw search text. */
"use strict";
(() => {
  if (window.NumiAnalytics) return;
  const dnt=navigator.globalPrivacyControl===true ||
    navigator.doNotTrack==="1" || window.doNotTrack==="1";
  // Partner attribution survives navigation within the same browser tab.
  // Only a validated short campaign tag is retained; no visitor identifier.
  const campaign=(()=>{
    const p=new URLSearchParams(location.search);
    const entered=p.get("utm_campaign")||p.get("utm_source")||p.get("campaign")||"";
    const safe=t=>/^[a-z0-9_-]{1,48}$/i.test(t)?t.toLowerCase():null;
    if(dnt)return "-";
    if(entered&&safe(entered)){
      try{sessionStorage.setItem("numi_campaign",safe(entered));}catch(_){}
      return safe(entered);
    }
    try{return safe(sessionStorage.getItem("numi_campaign")||"")||"-";}catch(_){return "-";}
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
  if(campaign!=="-" && /(?:utm_campaign|utm_source|campaign)=/.test(location.search))send("campaign","entry");
})();
