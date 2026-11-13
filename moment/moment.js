"use strict";
(() => {
  const $=id=>document.getElementById(id);
  const grid=$("category-grid"),list=$("question-list"),search=$("question-search"),clear=$("clear-search");
  const resultsTitle=$("results-title"),resultsMsg=$("results-message"),showMore=$("show-more"),showAll=$("show-all");
  const dialog=$("question-dialog"), catalogStatus=$("moment-catalog-status"), catalogRetry=$("moment-catalog-retry");
  let catalog=null,active=null,visibleCount=12,accessRequest=0;
  const norm=t=>String(t||"").toLocaleLowerCase("ru-RU").replace(/ё/g,"е").replace(/[^а-яa-z0-9 ]/gi," ").replace(/\s+/g," ").trim();
  const html=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el;};
  function renderCategories(){
    grid.replaceChildren();
    catalog.categories.forEach(cat=>{
      const b=html("button","category"+(active===cat.id?" active":"" ));b.type="button";b.setAttribute("aria-pressed",String(active===cat.id));
      b.append(html("span","category-icon",cat.icon),html("strong","category-title",cat.title),html("span","category-count",cat.count+" вопросов"));
      b.addEventListener("click",()=>{
        active=cat.id;visibleCount=12;renderCategories();$("category-grid").hidden=true;document.querySelector(".explore .section-heading").hidden=true;$("questions-panel").hidden=false;renderQuestions();$("questions-panel").scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
      });grid.append(b);
    });
  }
  function filtered(){
    const query=norm(search.value),words=query.split(" ").filter(Boolean);
    return catalog.questions.filter(q=>{
      if(active!=="all"&&active!==q.category)return false;
      if(!words.length)return true;
      const c=catalog.categories.find(c=>c.id===q.category);
      const text=norm(q.title+" "+c.title+" "+c.description);
      return words.every(w=>text.includes(w));
    });
  }
  function renderQuestions(){
    const found=filtered(),cat=catalog.categories.find(c=>c.id===active);
    resultsTitle.textContent=search.value.trim()?"Результаты поиска":cat?cat.title:"Все вопросы";
    resultsMsg.textContent=found.length?("Найдено "+found.length+" · показано "+Math.min(visibleCount,found.length)):"Совпадений нет. Можно задать свой вопрос ниже.";
    showAll.hidden=false;
    clear.hidden=!search.value;
    list.replaceChildren();
    found.slice(0,visibleCount).forEach((q,i)=>{
      const b=html("button","question-entry");b.type="button";b.append(html("span","question-index",String(i+1).padStart(2,"0")),html("span","question-name",q.title),html("span","arrow","↗"));
      b.addEventListener("click",()=>openQuestion(q));list.append(b);
    });
    showMore.hidden=visibleCount>=found.length;
  }
  const postAccount=async body=>{
    const response=await fetch("/api/numi-account.php",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
    });
    const data=await response.json();
    if(!response.ok||data?.ok!==true)throw new Error("ACCOUNT_UNAVAILABLE");
    return data;
  };
  const telegramInitData=()=>{
    const fromSdk=window.Telegram?.WebApp?.initData;
    if(typeof fromSdk==="string"&&fromSdk)return fromSdk;
    try{return new URLSearchParams(location.hash.replace(/^#/,"")).get("tgWebAppData")||"";}catch(_){return "";}
  };
  async function clubStatus(){
    // Only a real server-verified paid Club entitlement grants access.
    let result=await postAccount({action:"product_quote",product_code:"club_month"});
    if(result.authenticated===false){
      const signed=telegramInitData();
      if(signed){
        await postAccount({action:"telegram",init_data:signed});
        result=await postAccount({action:"product_quote",product_code:"club_month"});
      }
    }
    if(typeof result.club_active!=="boolean")throw new Error("UNVERIFIED_SUBSCRIPTION");
    return result.club_active;
  }
  async function checkAccess(){
    const request=++accessRequest;
    $("moment-ask-intro").hidden=true;
    for(const id of ["moment-subscription-required","moment-member-not-ready","moment-access-error"])$(id).hidden=true;
    $("moment-access-loading").hidden=false;
    try{
      const activeClub=await clubStatus();
      if(request!==accessRequest||!dialog.open)return;
      $("moment-access-loading").hidden=true;
      $("question-title").hidden=!activeClub;
      $(activeClub?"moment-member-not-ready":"moment-subscription-required").hidden=false;
    }catch(_){
      if(request!==accessRequest||!dialog.open)return;
      $("moment-access-loading").hidden=true;
      $("moment-access-error").hidden=false;
    }
  }
  function openQuestion(question){
    accessRequest++;
    $("question-title").textContent=question.title;
    $("question-title").hidden=false;
    $("moment-ask-intro").hidden=false;
    $("moment-access-loading").hidden=true;
    for(const id of ["moment-subscription-required","moment-member-not-ready","moment-access-error"])$(id).hidden=true;
    const category=catalog.categories.find(c=>c.id===question.category);
    $("question-topic").textContent=category?category.title:"НУМЕРОЛОГИЯ МОМЕНТА";
    dialog.showModal();document.body.style.overflow="hidden";
  }
  $("close-dialog").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{accessRequest++;document.body.style.overflow="";});
  dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
  $("moment-ask-now").addEventListener("click",()=>{void checkAccess();});
  $("moment-access-retry").addEventListener("click",()=>{void checkAccess();});
  function backToTopics(){active=null;visibleCount=12;search.value="";$("questions-panel").hidden=true;$("category-grid").hidden=false;document.querySelector(".explore .section-heading").hidden=false;renderCategories();$("category-grid").scrollIntoView({behavior:"auto",block:"start"});}
  $("show-all").addEventListener("click",backToTopics);
  document.querySelector(".moment-back-button").addEventListener("click",e=>{if(active){e.preventDefault();backToTopics();}});
  $("show-more").addEventListener("click",()=>{visibleCount+=12;renderQuestions();});
  search.addEventListener("input",()=>{visibleCount=12;renderQuestions();});
  clear.addEventListener("click",()=>{search.value="";visibleCount=12;renderQuestions();search.focus();});
  async function start(){
    resultsMsg.textContent="Загружаем библиотеку вопросов…";
    try{
      const response=await fetch("./questions.json?v=1",{cache:"no-store"});
      if(!response.ok)throw Error("catalog response "+response.status);
      const data=await response.json();
      if(!Array.isArray(data.categories)||data.categories.length!==12||!Array.isArray(data.questions)||data.questions.length!==300)throw Error("catalog incomplete");
      const seen=new Set();
      for(const q of data.questions){if(!q.id||seen.has(q.id)||!["self","partner","event"].includes(q.mode)||!data.categories.some(c=>c.id===q.category))throw Error("catalog validation");seen.add(q.id);}
      catalog=data;renderCategories();if(catalogStatus)catalogStatus.hidden=true;
      const params=new URLSearchParams(location.search),topic=params.get("category");
      if(topic&&data.categories.some(c=>c.id===topic)){active=topic;renderCategories();$("category-grid").hidden=true;document.querySelector(".explore .section-heading").hidden=true;$("questions-panel").hidden=false;renderQuestions();}
    }catch(err){
      resultsTitle.textContent="Каталог временно недоступен";
      resultsMsg.textContent="Не удалось загрузить вопросы. Попробуйте обновить страницу.";
      showMore.hidden=true;
      // Keep the server-rendered 300-question fallback visible on load failure.
      if(catalogStatus)catalogStatus.hidden=false;
      console.error("NUMI_MOMENT_CATALOG",err);
    }
  }
  if(catalogRetry)catalogRetry.addEventListener("click",()=>{catalogStatus.hidden=true;void start();});
  start();
})();
