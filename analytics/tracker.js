/* Optional, consent-based analytics. Independent of calculations and PDF generation.
   Set the data-endpoint attribute when the dedicated Worker has been deployed. */
(() => {
  "use strict";
  const script = document.currentScript;
  const api = (script?.dataset.endpoint || "").replace(/\/$/, "");
  const key = "noa_analytics_consent";
  const events = new Set([
    "page_view","redflag_open","redflag_category_open","redflag_question_open",
    "redflag_share_click","redflag_save_click","pdf_download","telegram_link_click",
    "cta_impression","cta_click","subscription_offer_view","subscription_cta_click","checkout_started"
  ]);
  let sessionId = "";
  function consented() {
    try { return localStorage.getItem(key) === "yes"; } catch { return false; }
  }
  function value(v,limit=80) {
    return String(v || "").replace(/[^a-zA-Z0-9_\-.:/]/g,"").slice(0,limit);
  }
  function acquisition() {
    // First-touch acquisition for this browser tab. Only used with consent.
    try {
      const saved = sessionStorage.getItem("noa_analytics_attribution");
      if(saved) return JSON.parse(saved);
      const u = new URL(location.href);
      const referer = document.referrer ? new URL(document.referrer).hostname : "";
      const source = value(u.searchParams.get("utm_source") || referer || "direct");
      const medium = value(u.searchParams.get("utm_medium") || (source === "direct" ? "direct" : "referral"));
      const campaign = value(u.searchParams.get("utm_campaign") || "");
      const attribution = {source,medium,campaign};
      sessionStorage.setItem("noa_analytics_attribution",JSON.stringify(attribution));
      return attribution;
    } catch {return {source:"direct",medium:"",campaign:""};}
  }
  function track(event, details={}) {
    if(!api || !consented() || !events.has(event)) return;
    if(!sessionId) {
      try {
        sessionId = sessionStorage.getItem("noa_session") || crypto.randomUUID();
        sessionStorage.setItem("noa_session",sessionId);
      }catch {sessionId="";}
    }
    const payload = JSON.stringify({
      event,
      item:value(details.item || ""),
      label:String(details.label || "").slice(0,120),
      section:value(details.section || (location.pathname.includes("/pro/") ? "pro" : "home")),
      ...acquisition(),
      session:value(sessionId)
    });
    try {
      const data = new Blob([payload],{type:"text/plain"});
      // Beacon is used for navigation away from the site; no cookies are sent.
      if(navigator.sendBeacon && navigator.sendBeacon(api+"/api/event",data)) return;
      fetch(api+"/api/event",{
        method:"POST",mode:"cors",keepalive:true,credentials:"omit",
        headers:{"Content-Type":"text/plain"},body:payload
      }).catch(()=>{});
    }catch {}
  }
  window.NumerologiaAnalytics = Object.freeze({track});
  if(!api) return;
  function makeConsent() {
    if(localStorage.getItem(key) !== null) return;
    const box = document.createElement("div");
    box.setAttribute("role","dialog");
    box.setAttribute("aria-label","Настройки статистики");
    Object.assign(box.style,{
      position:"fixed",zIndex:"99999",bottom:"14px",left:"14px",right:"14px",
      maxWidth:"460px",margin:"0 auto",padding:"16px",background:"#fff",
      color:"#262532",border:"1px solid #e7dfeb",borderRadius:"16px",
      boxShadow:"0 5px 24px #2223",font:"13px/1.5 sans-serif"
    });
    const text = document.createElement("p");
    text.textContent="Разрешить анонимную статистику? Она помогает улучшать сайт. Мы не отправляем даты рождения, переписки или личные ответы.";
    text.style.margin="0 0 12px";
    const buttons=document.createElement("div");
    buttons.style.display="flex";buttons.style.gap="9px";
    const accept=document.createElement("button");
    const deny=document.createElement("button");
    accept.textContent="Разрешить";deny.textContent="Не сейчас";
    for(const btn of [accept,deny]) {
      Object.assign(btn.style,{border:"1px solid #d8cbd8",borderRadius:"9px",padding:"9px 12px",background:"#f6f0f6",color:"#352d37"});
      buttons.append(btn);
    }
    accept.addEventListener("click",()=>{
      localStorage.setItem(key,"yes");box.remove();track("page_view");
      setupImpressionObserver();
    });
    deny.addEventListener("click",()=>{
      localStorage.setItem(key,"no");box.remove();
    });
    box.append(text,buttons);
    document.body.append(box);
  }
  let observer;
  const seen = new WeakSet();
  const observed = new WeakSet();
  function setupImpressionObserver() {
    if(!consented() || observer || typeof IntersectionObserver === "undefined") return;
    observer = new IntersectionObserver((entries) => {
      entries.forEach(({target,isIntersecting,intersectionRatio}) => {
        if(!isIntersecting || intersectionRatio < 0.5 || seen.has(target)) return;
        seen.add(target);observer.unobserve(target);
        const item = value(target.dataset.analyticsCta || "");
        if(item) track("cta_impression", {item,label:target.dataset.analyticsLabel || "", section:target.dataset.analyticsSection || ""});
        if(target.dataset.analyticsSubscriptionCta === "yes") track("subscription_offer_view", {item,label:target.dataset.analyticsLabel || "",section:target.dataset.analyticsSection || ""});
      });
    },{threshold:0.5});
    const register=()=>{
      document.querySelectorAll("[data-analytics-cta]").forEach(node=>{
        if(observed.has(node)) return;
        observed.add(node);observer.observe(node);
      });
    };
    register();
    if(typeof MutationObserver !== "undefined") {
      const changes = new MutationObserver(register);
      changes.observe(document.body,{childList:true,subtree:true});
    }
  }
  const start=()=>{
    try {makeConsent();} catch{}
    track("page_view");
    setupImpressionObserver();
    document.addEventListener("click",(e)=>{
      const target=e.target.closest("a,button");
      if(!target)return;
      const id=value(target.dataset.analyticsCta || "");
      if(id) {
        const params={item:id,label:target.dataset.analyticsLabel||"",section:target.dataset.analyticsSection||""};
        track("cta_click",params);
        if(target.dataset.analyticsSubscriptionCta === "yes") track("subscription_cta_click",params);
      }
      const href=target.getAttribute("href") || "";
      if(/(?:t\.me|telegram\.me)\//i.test(href)) track("telegram_link_click",{item:"telegram"});
      if(target.matches("#pdf-download-button, a[download], .pdf-download-button")) {
        track("pdf_download",{item:value(target.id || "pdf"),section:location.pathname.includes("/pro/")?"pro":"home"});
      }
    },{capture:true});
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
