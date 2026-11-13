"use strict";
(() => {
  // Preview-only Moment catalog. The separate 100 Yes/No questions retain their own subscription rules.
  // Every one of the 300 Moment questions is a 49 RUB one-time purchase AFTER launch.
  // No question is openable or payable while its content is under development.
  const $ = id => document.getElementById(id);
  const grid=$("category-grid"), list=$("question-list"), search=$("question-search"), clear=$("clear-search");
  const resultsTitle=$("results-title"), resultsMsg=$("results-message");
  const showMore=$("show-more"), showAll=$("show-all");
  const catalogStatus=$("moment-catalog-status"), catalogRetry=$("moment-catalog-retry");
  let catalog=null, active=null, visibleCount=12;
  const norm=t=>String(t||"").toLocaleLowerCase("ru-RU").replace(/ё/g,"е").replace(/[^а-яa-z0-9 ]/gi," ").replace(/\s+/g," ").trim();
  const elem=(tag,cls,value)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(value!==undefined)el.textContent=value;
    return el;
  };
  function renderCategories(){
    grid.replaceChildren();
    catalog.categories.forEach(cat=>{
      const b=elem("button","category"+(active===cat.id?" active":""));
      b.type="button";b.setAttribute("aria-pressed",String(active===cat.id));
      b.append(elem("span","category-icon",cat.icon),elem("strong","category-title",cat.title),elem("span","category-count",cat.count+" вопросов · Скоро"));
      b.addEventListener("click",()=>{
        active=cat.id;visibleCount=12;
        renderCategories();
        grid.hidden=true;
        document.querySelector(".explore .section-heading").hidden=true;
        $("questions-panel").hidden=false;
        renderQuestions();
        $("questions-panel").scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
      });
      grid.append(b);
    });
  }
  function filtered(){
    const query=norm(search.value),words=query.split(" ").filter(Boolean);
    return catalog.questions.filter(q=>{
      if(active!=="all"&&active!==q.category)return false;
      if(!words.length)return true;
      const c=catalog.categories.find(c=>c.id===q.category);
      const text=norm(q.title+" "+c.title+" "+(c.description||""));
      return words.every(w=>text.includes(w));
    });
  }
  function renderQuestions(){
    const found=filtered(),cat=catalog.categories.find(c=>c.id===active);
    resultsTitle.textContent=cat?cat.title:"Все вопросы";
    resultsMsg.textContent=found.length?"49 ₽ за вопрос · В разработке · "+found.length+" вопросов":"Вопросов не найдено";
    showAll.hidden=false;
    clear.hidden=!search.value;
    list.replaceChildren();
    found.slice(0,visibleCount).forEach((q,i)=>{
      const b=elem("button","question-entry moment-soon-question");
      b.type="button";
      b.disabled=true;
      b.setAttribute("aria-label",q.title+". Скоро. Стоимость после запуска 49 рублей.");
      const meta=elem("span","moment-question-status","49 ₽ · Скоро");
      b.append(elem("span","question-index",String(i+1).padStart(2,"0")),elem("span","question-name",q.title),meta);
      list.append(b);
    });
    showMore.hidden=visibleCount>=found.length;
  }
  function backToTopics(){
    active=null;visibleCount=12;search.value="";
    $("questions-panel").hidden=true;
    grid.hidden=false;
    document.querySelector(".explore .section-heading").hidden=false;
    renderCategories();
    grid.scrollIntoView({behavior:"auto",block:"start"});
  }
  showAll.addEventListener("click",backToTopics);
  document.querySelector(".moment-back-button").addEventListener("click",event=>{
    if(active){event.preventDefault();backToTopics();}
  });
  showMore.addEventListener("click",()=>{visibleCount+=12;renderQuestions();});
  search.addEventListener("input",()=>{if(catalog){visibleCount=12;renderQuestions();}});
  clear.addEventListener("click",()=>{search.value="";visibleCount=12;if(catalog)renderQuestions();search.focus();});
  async function start(){
    try{
      const response=await fetch("./questions.json?v=1",{cache:"no-store"});
      if(!response.ok)throw Error("catalog response "+response.status);
      const data=await response.json();
      if(!Array.isArray(data.categories)||data.categories.length!==12||!Array.isArray(data.questions)||data.questions.length!==300)throw Error("catalog incomplete");
      const seen=new Set();
      for(const q of data.questions){
        if(!q.id||seen.has(q.id)||!["self","partner","event"].includes(q.mode)||!data.categories.some(c=>c.id===q.category))throw Error("catalog validation");
        seen.add(q.id);
      }
      catalog=data;
      renderCategories();
      if(catalogStatus)catalogStatus.hidden=true;
      const topic=new URLSearchParams(location.search).get("category");
      if(topic&&data.categories.some(c=>c.id===topic)){
        active=topic;renderCategories();grid.hidden=true;
        document.querySelector(".explore .section-heading").hidden=true;
        $("questions-panel").hidden=false;
        renderQuestions();
      }
    }catch(error){
      // The static 300-question catalog stays accessible even if JS/JSON fails.
      if(catalogStatus)catalogStatus.hidden=false;
      console.error("NUMI_MOMENT_CATALOG",error);
    }
  }
  if(catalogRetry)catalogRetry.addEventListener("click",()=>{catalogStatus.hidden=true;void start();});
  void start();
})();
