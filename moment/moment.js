"use strict";
(() => {
  const $=id=>document.getElementById(id);
  const grid=$("category-grid"),list=$("question-list"),search=$("question-search"),clear=$("clear-search");
  const resultsTitle=$("results-title"),resultsMsg=$("results-message"),showMore=$("show-more"),showAll=$("show-all");
  const dialog=$("question-dialog"),form=$("moment-form"),partnerField=$("partner-field"),eventField=$("event-field");
  const customWrap=$("custom-question-wrap"),customModeField=$("custom-mode-field"),error=$("form-error");
  let catalog=null,active="all",visibleCount=12,selected=null,custom=false,mode="self";
  const norm=t=>String(t||"").toLocaleLowerCase("ru-RU").replace(/ё/g,"е").replace(/[^а-яa-z0-9 ]/gi," ").replace(/\s+/g," ").trim();
  const safeDate=(v)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const [y,m,d]=v.split("-").map(Number);const date=new Date(Date.UTC(y,m-1,d));return y>=1900&&y<=2100&&date.getUTCFullYear()===y&&date.getUTCMonth()+1===m&&date.getUTCDate()===d;};
  const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
  const html=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el;};
  const track=(type,item="-")=>window.NumiAnalytics?.send(type,"moment",item);
  let searched=false;
  track("page");
  function renderCategories(){
    grid.replaceChildren();
    const all=[{id:"all",title:"Все темы",icon:"✧",description:"",count:catalog.questions.length},...catalog.categories];
    all.forEach(cat=>{
      const b=html("button","category"+(active===cat.id?" active":"" ));b.type="button";b.setAttribute("aria-pressed",String(active===cat.id));
      b.append(html("span","category-icon",cat.icon),html("strong","category-title",cat.title),html("span","category-count",cat.count+" вопросов"));
      b.addEventListener("click",()=>{
        if(cat.id!=="all")track("category",cat.id);
        active=cat.id;visibleCount=12;renderCategories();renderQuestions();$("questions-panel").scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
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
    showAll.hidden=active==="all";
    clear.hidden=!search.value;
    list.replaceChildren();
    found.slice(0,visibleCount).forEach((q,i)=>{
      const b=html("button","question-entry");b.type="button";b.append(html("span","question-index",String(i+1).padStart(2,"0")),html("span","question-name",q.title),html("span","arrow","↗"));
      b.addEventListener("click",()=>openQuestion(q));list.append(b);
    });
    showMore.hidden=visibleCount>=found.length;
  }
  function updateModeFields(){
    partnerField.hidden=mode!=="partner";eventField.hidden=mode!=="event";
    $("birth-two").required=mode==="partner";$("event-date").required=mode==="event";
    if(mode!=="partner")$("birth-two").value="";
    if(mode!=="event")$("event-date").value="";
  }
  function openQuestion(question){
    selected=question||null;custom=!question;mode=custom?"self":question.mode;
    track("question",question?.id||"custom");
    form.reset();$("form-error").hidden=true;$("moment-confirmation").hidden=true;form.hidden=false;
    $("question-title").textContent=custom?"Задайте свой вопрос":question.title;
    const category=question?catalog.categories.find(c=>c.id===question.category):null;
    $("question-topic").textContent=category?category.title:"ВАШ ЛИЧНЫЙ ВОПРОС";
    customWrap.hidden=!custom;customModeField.hidden=!custom;updateModeFields();
    $("moment-clock-label").textContent="Дата и время зафиксируются при подтверждении.";
    dialog.showModal();document.body.style.overflow="hidden";
    (custom?$("custom-question"):$("birth-one")).focus({preventScroll:true});
  }
  $("close-dialog").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{document.body.style.overflow="";});
  dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
  $("ask-own").addEventListener("click",()=>openQuestion(null));
  $("show-all").addEventListener("click",()=>{active="all";visibleCount=12;renderCategories();renderQuestions();});
  $("show-more").addEventListener("click",()=>{visibleCount+=12;renderQuestions();});
  search.addEventListener("input",()=>{if(!searched&&search.value.trim().length>=3){searched=true;track("search");}visibleCount=12;renderQuestions();});
  clear.addEventListener("click",()=>{search.value="";searched=false;visibleCount=12;renderQuestions();search.focus();});
  customModeField.addEventListener("change",e=>{if(e.target.name==="custom-mode"){mode=e.target.value;updateModeFields();}});
  form.addEventListener("submit",e=>{
    e.preventDefault();const q=custom?$("custom-question").value.trim():selected.title;
    const birth=$("birth-one").value;
    let message="";
    if(!q||q.length<8)message="Сформулируйте вопрос хотя бы в нескольких словах.";
    else if(!safeDate(birth)||birth>today())message="Укажите корректную дату своего рождения.";
    else if(mode==="partner"&&(!safeDate($("birth-two").value)||$("birth-two").value>today()))message="Укажите корректную дату рождения второго человека.";
    else if(mode==="event"&&!safeDate($("event-date").value))message="Укажите дату планируемого события.";
    if(message){error.textContent=message;error.hidden=false;return;}
    error.hidden=true;
    // Capture the specific instant on confirmation, not at initial page load.
    const instant=new Date();
    const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"Часовой пояс устройства";
    const time=Intl.DateTimeFormat("ru-RU",{dateStyle:"full",timeStyle:"long"}).format(instant);
    // No client-side purchase, speculative predictions, server submission, or sensitive local storage.
    $("confirmed-question").textContent=q;
    $("confirmed-time").textContent="Момент вопроса: "+time+" · "+timezone;
    $("moment-clock-label").textContent=time;
    form.hidden=true;$("moment-confirmation").hidden=false;$("moment-confirmation").focus({preventScroll:true});
  });
  $("ask-another").addEventListener("click",()=>{dialog.close();$("questions-panel").scrollIntoView({behavior:"smooth",block:"start"});});
  async function start(){
    resultsMsg.textContent="Загружаем библиотеку вопросов…";
    try{
      const response=await fetch("./questions.json?v=1",{cache:"no-store"});
      if(!response.ok)throw Error("catalog response "+response.status);
      const data=await response.json();
      if(!Array.isArray(data.categories)||data.categories.length!==12||!Array.isArray(data.questions)||data.questions.length!==300)throw Error("catalog incomplete");
      const seen=new Set();
      for(const q of data.questions){if(!q.id||seen.has(q.id)||!["self","partner","event"].includes(q.mode)||!data.categories.some(c=>c.id===q.category))throw Error("catalog validation");seen.add(q.id);}
      catalog=data;renderCategories();renderQuestions();
      const params=new URLSearchParams(location.search),topic=params.get("category");
      if(topic&&data.categories.some(c=>c.id===topic)){active=topic;renderCategories();renderQuestions();}
    }catch(err){
      resultsTitle.textContent="Каталог временно недоступен";
      resultsMsg.textContent="Не удалось загрузить вопросы. Попробуйте обновить страницу.";
      showMore.hidden=true;grid.replaceChildren();
      console.error("NUMI_MOMENT_CATALOG",err);
    }
  }
  start();
})();
