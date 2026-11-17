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
  let catalog=null, active=null, visibleCount=12, ownerMode=false;
  // The 25 "Любовь и чувства" answers expand inside the catalogue for the verified owner.
  // The public purchase gate and all other questions remain unchanged.
  let openLoveId=null, loveRequestVersion=0;
  const loveAnswers=new Map();
  const pairKey='numi-moment-pair-session-v1';
  const pairWrap=$('moment-pair-dates'), pairSelf=$('moment-pair-self'), pairOther=$('moment-pair-other');
  const pairError=$('moment-pair-error'), pairChange=$('moment-pair-change');
  function validDate(value){
    const match=String(value||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if(!match)return false;
    const d=Number(match[1]),m=Number(match[2]),y=Number(match[3]);
    const check=new Date(Date.UTC(y,m-1,d));
    return y>=1900&&y<=2099&&check.getUTCFullYear()===y&&check.getUTCMonth()+1===m&&check.getUTCDate()===d;
  }
  function formatDate(raw){
    const v=String(raw||'').replace(/\D/g,'').slice(0,8);
    return v.slice(0,2)+(v.length>2?'.'+v.slice(2,4):'')+(v.length>4?'.'+v.slice(4):'');
  }
  function readPair(){
    try{const o=JSON.parse(sessionStorage.getItem(pairKey)||'null');return o&&validDate(o.self)&&validDate(o.other)?o:null;}catch{return null;}
  }
  function invalidateLoveAnswers(){
    loveRequestVersion++;
    openLoveId=null;
    loveAnswers.clear();
    if(list)list.querySelectorAll('.moment-inline-item').forEach(item=>{
      item.classList.remove('is-open');
      const card=item.querySelector('.moment-inline-answer');
      const trigger=item.querySelector('.question-entry');
      if(card)card.hidden=true;
      if(trigger)trigger.setAttribute('aria-expanded','false');
    });
  }
  function storePair(){
    if(validDate(pairSelf.value)&&validDate(pairOther.value)){
      try{sessionStorage.setItem(pairKey,JSON.stringify({self:pairSelf.value,other:pairOther.value}));}catch(_){}
      pairError.hidden=true;pairChange.hidden=false;return true;
    }
    pairError.hidden=false;return false;
  }
  const oldPair=readPair();
  if(oldPair){pairSelf.value=oldPair.self;pairOther.value=oldPair.other;pairChange.hidden=false;}
  for(const el of [pairSelf,pairOther]){
    el.addEventListener('input',()=>{
      el.value=formatDate(el.value);
      pairError.hidden=true;
      try{sessionStorage.removeItem(pairKey);}catch(_){}
      pairChange.hidden=true;
      invalidateLoveAnswers();
    });
    el.addEventListener('change',()=>{if(validDate(pairSelf.value)&&validDate(pairOther.value))storePair();});
  }
  pairChange.addEventListener('click',()=>{
    pairSelf.focus();pairSelf.select();pairError.hidden=true;
  });
  function showPairEntry(){
    const applicable=active&&catalog?.questions.some(q=>q.category===active&&q.mode==='partner');
    pairWrap.hidden=!applicable;
  }
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
  const isoDate=raw=>raw.slice(6,10)+'-'+raw.slice(3,5)+'-'+raw.slice(0,2);
  function localQuestionMoment(){
    const d=new Date(),p=n=>String(n).padStart(2,'0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
  }
  const siteLink='https://нумерология-онлайн.рф/moment/';
  const botLink='https://t.me/Numerologiaonline_bot';
  function openTelegramLink(url){
    if(typeof window.Telegram?.WebApp?.openTelegramLink==='function'){
      window.Telegram.WebApp.openTelegramLink(url);
    }else{
      window.location.assign(url);
    }
  }
  function addLoveAnswerActions(container,q,answer,self,other){
    const report='✨ 300 вопросов о жизни\nВопрос: '+q.title+'\nВаша дата рождения: '+self+
      '\nДата рождения мужчины: '+other+'\n\n'+answer+
      '\n\n✨ Нумерология онлайн\n🌐 '+siteLink+'\n🤖 '+botLink;
    const controls=elem('div','moment-answer-actions');
    const heading=elem('strong','moment-answer-actions-heading','Не потеряй свой ответ ❤️');
    const save=elem('button','moment-answer-action moment-answer-save','❤️ Сохранить в бот');
    const share=elem('button','moment-answer-action moment-answer-share','💌 Переслать подруге');
    const notice=elem('p','moment-answer-action-feedback');
    notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.hidden=true;
    controls.append(heading,save,share,notice);
    container.append(controls);
    let ticketLink=null;
    save.addEventListener('click',async()=>{
      if(ticketLink){openTelegramLink(ticketLink);return;}
      if(report.length>3800){
        notice.textContent='Ответ слишком длинный для сохранения одним сообщением Telegram.';
        notice.hidden=false;return;
      }
      save.disabled=true;
      notice.hidden=false;notice.textContent='Готовлю сохранение в Telegram…';
      const controller=new AbortController();
      const timer=window.setTimeout(()=>controller.abort(),14000);
      try{
        // Reuse the same saving-ticket flow as "Мужчина или Red Flag".
        const response=await fetch('/api/redflag-save.php',{
          method:'POST',mode:'cors',cache:'no-store',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'create',text:report}),
          signal:controller.signal
        });
        const data=await response.json();
        if(!response.ok||data?.ok!==true||!/^r_[A-Za-z0-9_-]{32}$/.test(data?.ticket||'')){
          throw new Error('TICKET_UNAVAILABLE');
        }
        ticketLink=botLink+'?start='+encodeURIComponent(data.ticket);
        save.textContent='🤖 Открыть бота с ответом';
        notice.textContent='Ссылка готова. В боте нажми «Начать», чтобы сохранить ответ.';
        openTelegramLink(ticketLink);
      }catch(_){
        notice.textContent='Не получилось подготовить ссылку. Попробуй ещё раз.';
      }finally{
        window.clearTimeout(timer);save.disabled=false;
      }
    });
    share.addEventListener('click',async()=>{
      if(navigator.share){
        try{await navigator.share({title:q.title,text:report});return;}
        catch(error){if(error?.name==='AbortError')return;}
      }
      openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(siteLink)+'&text='+encodeURIComponent(report));
    });
  }
  function closeLovePanels(){
    list.querySelectorAll('.moment-inline-item').forEach(item=>{
      item.classList.remove('is-open');
      const body=item.querySelector('.moment-inline-answer');
      const trigger=item.querySelector('.question-entry');
      if(body)body.hidden=true;
      if(trigger)trigger.setAttribute('aria-expanded','false');
    });
  }
  async function toggleLoveAnswer(q,item,body,trigger){
    if(openLoveId===q.id&&!body.hidden){
      closeLovePanels();openLoveId=null;loveRequestVersion++;return;
    }
    if(!storePair()){
      pairWrap.scrollIntoView({behavior:'smooth',block:'center'});
      pairSelf.focus();return;
    }
    closeLovePanels();
    openLoveId=q.id;
    item.classList.add('is-open');
    trigger.setAttribute('aria-expanded','true');
    body.hidden=false;
    body.replaceChildren();
    const self=pairSelf.value,other=pairOther.value;
    const key=q.id+'|'+self+'|'+other;
    const cached=loveAnswers.get(key);
    if(cached){
      body.append(elem('div','moment-answer-text',cached));
      addLoveAnswerActions(body,q,cached,self,other);return;
    }
    const requestId=++loveRequestVersion;
    const feedback=elem('p','moment-answer-loading','Идёт расчёт…');
    feedback.setAttribute('role','status');
    body.append(feedback);
    try{
      const response=await fetch('./owner-ai.php',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({
          question_id:q.id,birth_date:isoDate(self),other_date:isoDate(other),
          moment:localQuestionMoment()
        })
      });
      const data=await response.json();
      if(!response.ok||data?.ok!==true||data.question_id!==q.id||
          typeof data.answer!=='string'||!data.answer.trim())throw Error('ANSWER_UNAVAILABLE');
      if(requestId!==loveRequestVersion||openLoveId!==q.id||!body.isConnected||
          pairSelf.value!==self||pairOther.value!==other)return;
      loveAnswers.set(key,data.answer.trim());
      body.replaceChildren(elem('div','moment-answer-text',data.answer.trim()));
      addLoveAnswerActions(body,q,data.answer.trim(),self,other);
    }catch(_){
      if(requestId!==loveRequestVersion||openLoveId!==q.id||!body.isConnected)return;
      body.replaceChildren();
      const error=elem('p','moment-answer-error','Не удалось получить ответ. Повтори попытку.');
      const retry=elem('button','moment-answer-retry','Попробовать ещё раз');
      retry.type='button';
      retry.addEventListener('click',()=>{openLoveId=null;void toggleLoveAnswer(q,item,body,trigger);});
      body.append(error,retry);
    }
  }
  function renderQuestions(){
    const found=filtered(),cat=catalog.categories.find(c=>c.id===active);
    resultsTitle.textContent=cat?cat.title:"Все вопросы";
    showPairEntry();
    resultsMsg.textContent=found.length?"49 ₽ за вопрос · В разработке · "+found.length+" вопросов":"Вопросов не найдено";
    showAll.hidden=false;
    clear.hidden=!search.value;
    loveRequestVersion++;
    openLoveId=null;
    list.replaceChildren();
    found.slice(0,visibleCount).forEach((q,i)=>{
      const b=elem("button","question-entry moment-soon-question");
      b.type="button";
      // Still no public purchase or paid answer. A verified site owner may review
      // the chosen item in the separate protected editor; everyone else sees
      // a clear "Скоро" explanation rather than a dead disabled button.
      b.setAttribute("aria-label",q.title);
      b.append(
        elem("span","question-index",String(i+1).padStart(2,"0")),
        elem("span","question-name",q.title),
        elem("span","moment-question-chevron","›")
      );
      if(ownerMode && q.category==='love' && q.mode==='partner'){
        const item=elem('div','moment-inline-item');
        const body=elem('div','moment-inline-answer');
        body.hidden=true;
        body.id='moment-answer-'+q.id;
        b.setAttribute('aria-controls',body.id);
        b.setAttribute('aria-expanded','false');
        b.addEventListener('click',()=>{void toggleLoveAnswer(q,item,body,b);});
        item.append(b,body);
        list.append(item);
      }else{
        b.addEventListener("click",()=>{
          if(ownerMode){
            if(q.mode==='partner'&&!storePair()){pairWrap.scrollIntoView({behavior:'smooth',block:'center'});return;}
            location.assign("./owner-preview.html?question="+encodeURIComponent(q.id));
            return;
          }
          showComingSoon(q.title);
        });
        list.append(b);
      }
    });
    showMore.hidden=visibleCount>=found.length;
  }
  function showComingSoon(questionTitle){
    let dialog=$("moment-question-coming-soon");
    if(!dialog){
      dialog=elem("dialog","moment-question-info");
      dialog.id="moment-question-coming-soon";
      const heading=elem("h3","","Вопрос готовится к запуску");
      const question=elem("p","moment-question-modal-title");
      question.id="moment-question-modal-title";
      const description=elem("p","","Ответ пока недоступен. После запуска вопрос будет стоить 49 ₽. Сейчас деньги не списываются.");
      const close=elem("button","moment-question-modal-close","Понятно");
      close.type="button";
      close.addEventListener("click",()=>dialog.close());
      dialog.append(heading,question,description,close);
      document.body.append(dialog);
    }
    $("moment-question-modal-title").textContent=questionTitle;
    if(typeof dialog.showModal==="function")dialog.showModal();
    else alert("Вопрос в разработке. Покупка пока недоступна.");
  }
  async function verifyOwner(){
    try{
      const response=await fetch("./owner-ai.php",{credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json"}});
      if(!response.ok)return;
      const result=await response.json();
      if(result?.ok===true&&result?.owner===true&&result?.question_count===300){
        ownerMode=true;
        if(catalog&&!$("questions-panel").hidden)renderQuestions();
      }
    }catch(_){
      // The public catalogue remains viewable; never grant owner access on errors.
    }
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
      void verifyOwner();
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
