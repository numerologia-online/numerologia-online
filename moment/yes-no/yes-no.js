"use strict";
(() => {
  const $=id=>document.getElementById(id);
  const grid=$("yn-categories"),list=$("yn-questions"),search=$("yn-search"),clear=$("yn-clear"),title=$("yn-title"),count=$("yn-count"),more=$("yn-more"),all=$("yn-all"),dialog=$("yn-dialog");
  let catalog,active="all",visible=12;
  const normalized=s=>String(s||"").toLocaleLowerCase("ru-RU").replace(/ё/g,"е").replace(/[^а-яa-z0-9 ]/gi," ").replace(/\s+/g," ").trim();
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const track=(type,item="-")=>window.NumiAnalytics?.send(type,"yes-no",item);
  let searched=false;
  track("page");
  function renderCategories(){
    const categories=[{id:"all",title:"Все вопросы",icon:"◉",count:catalog.questions.length},...catalog.categories];
    grid.replaceChildren(...categories.map(c=>{
      const b=node("button","category"+(active===c.id?" active":"" ));b.type="button";b.setAttribute("aria-pressed",String(active===c.id));
      b.append(node("span","category-icon",c.icon),node("strong","category-title",c.title),node("span","category-count",c.count+" вопросов"));
      b.addEventListener("click",()=>{if(c.id!=="all")track("category",c.id);active=c.id;visible=12;renderCategories();render();$("yn-panel").scrollIntoView({behavior:"smooth",block:"start"});});return b;
    }));
  }
  function render(){
    const words=normalized(search.value).split(" ").filter(Boolean);
    const found=catalog.questions.filter(q=>{
      if(active!=="all"&&active!==q.category)return false;
      const c=catalog.categories.find(c=>c.id===q.category);
      const text=normalized(q.title+" "+c.title);
      return words.every(w=>text.includes(w));
    });
    const c=catalog.categories.find(c=>c.id===active);
    title.textContent=words.length?"Результаты поиска":c?c.title:"Все вопросы";
    count.textContent=found.length?"Найдено "+found.length+" · показано "+Math.min(visible,found.length):"Совпадений нет. Попробуйте другой запрос.";
    all.hidden=active==="all";clear.hidden=!search.value;more.hidden=visible>=found.length;
    list.replaceChildren(...found.slice(0,visible).map((q,i)=>{
      const b=node("button","question-entry");b.type="button";
      b.append(node("span","question-index",String(i+1).padStart(2,"0")),node("span","question-name",q.title),node("span","arrow","↗"));
      b.addEventListener("click",()=>{track("question",q.id);$("yn-dialog-title").textContent=q.title;dialog.showModal();document.body.style.overflow="hidden";});
      return b;
    }));
  }
  $("yn-close").addEventListener("click",()=>dialog.close());
  $("yn-back").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{document.body.style.overflow="";});
  dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
  search.addEventListener("input",()=>{if(!searched&&search.value.trim().length>=3){searched=true;track("search");}visible=12;render();});
  clear.addEventListener("click",()=>{search.value="";searched=false;visible=12;render();search.focus();});
  more.addEventListener("click",()=>{visible+=12;render();});
  all.addEventListener("click",()=>{active="all";visible=12;renderCategories();render();});
  (async()=>{try{
    const response=await fetch("./questions.json?v=1",{cache:"no-store"});if(!response.ok)throw Error("catalog request");
    const data=await response.json();
    if(!Array.isArray(data.categories)||data.categories.length!==7||!Array.isArray(data.questions)||data.questions.length!==100)throw Error("catalog count");
    if(new Set(data.questions.map(q=>q.id)).size!==100||new Set(data.questions.map(q=>q.title)).size!==100)throw Error("catalog duplicate");
    const catids=new Set(data.categories.map(c=>c.id));
    if(data.questions.some(q=>!catids.has(q.category)))throw Error("category mismatch");
    for(const c of data.categories){if(data.questions.filter(q=>q.category===c.id).length!==c.count)throw Error("category count mismatch");}
    catalog=data;renderCategories();render();
    const query=new URLSearchParams(location.search).get("category");
    if(query&&catids.has(query)){active=query;renderCategories();render();}
  }catch(e){count.textContent="Не удалось открыть каталог. Попробуйте обновить страницу.";console.error("NUMI_YES_NO",e);}
  })();
})();