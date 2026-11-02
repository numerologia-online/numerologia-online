/* Numi Insights v2: asynchronous, first-party, no navigation interception. */
(() => {
  'use strict';
  try {
    if (window.NumiInsights || navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
    const endpoint = '/api/numi-insights.php';
    const labels = {home:'Главная',day:'Личный день',year:'Разбор года',full:'Полный разбор жизни',redflag:'Мужчина или Red Flag',compatibility:'Совместимость',children:'Для мам',money:'Код богатства',moment:'300 вопросов', 'yes-no':'Да или нет',school:'Школа',club:'Клуб'};
    const uuid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=crypto.getRandomValues(new Uint8Array(1))[0]&15;return(c==='x'?r:(r&3)|8).toString(16);});
    const get = key => {try{return sessionStorage.getItem(key);}catch(_){return null;}};
    const put = (key,value) => {try{sessionStorage.setItem(key,value);}catch(_){}};
    const validId = value => /^[a-f0-9-]{36}$/i.test(value || '');
    let session = get('ni2_session');if(!validId(session)){session=uuid();put('ni2_session',session);}
    const tag = (v,max=64) => typeof v==='string'&&new RegExp('^[a-z0-9_.:-]{1,'+max+'}$','i').test(v)?v.toLowerCase():null;
    const params=new URLSearchParams(location.search);
    let source=tag(params.get('utm_source'),96),campaign=tag(params.get('utm_campaign'));
    if(!source){try{source=tag(new URL(document.referrer).hostname.replace(/^www\./,''),96);}catch(_){}}
    if(source && source===location.hostname)source=null;
    source=source||get('ni2_source')||(window.Telegram?.WebApp?.initData?'telegram':'direct');
    campaign=campaign||get('ni2_campaign')||'-';put('ni2_source',source);put('ni2_campaign',campaign);
    const hash = text => {let h=2166136261;for(const ch of text){h^=ch.codePointAt(0);h=Math.imul(h,16777619);}return 'q_'+(h>>>0).toString(16);};
    const clean = text => String(text||'').replace(/\s+/g,' ').replace(/[<>@\x00-\x1f]/g,'').replace(/\d{2}[.\/-]\d{2}[.\/-]\d{4}/g,'').trim().slice(0,170);
    const safe = fn => (...args) => {try{return fn(...args);}catch(_){return undefined;}};
    let queue=[],timer=0,sending=false,failures=0,currentSection='',lastQuestion=null;
    const seen=new Set();
    const row=(section,item='-',title='')=>({section,item,title:clean(title||labels[section]||section)});
    const pageSection=()=>{
      const p=location.pathname;
      if(p.startsWith('/moment/yes-no'))return 'yes-no';if(p.startsWith('/moment'))return 'moment';
      if(p.startsWith('/child'))return 'children';if(p.startsWith('/pro/schools'))return 'school';if(p.startsWith('/pro'))return 'full';if(p.startsWith('/year'))return 'year';
      if(document.body.classList.contains('personal-day-reading'))return 'day';
      const id=document.querySelector('.screen.is-active:not([hidden])')?.id;
      return ({redflag:'redflag',compatibility:'compatibility',year:'year',matrix:'full','destiny-code':'money','money-rituals':'money','personal-day':'day'})[id]||'home';
    };
    function send(type,context){
      if(queue.length>=100||failures>=3)return;
      queue.push({id:uuid(),session,type,...context,source,campaign});
      if(!timer)timer=setTimeout(flush,1200);
    }
    async function flush(){
      clearTimeout(timer);timer=0;if(sending||!queue.length||failures>=3)return;
      sending=true;const batch=queue.splice(0,20);const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),2500);
      try{const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({events:batch}),signal:controller.signal});if(!response.ok)throw Error('collector');failures=0;}
      catch(_){failures++;queue.unshift(...batch);}
      finally{clearTimeout(timeout);sending=false;if(queue.length&&failures<3)timer=setTimeout(flush,failures?5000:1500);}
    }
    const once=(type,context)=>{const key=[type,context.section,context.item].join(':');if(seen.has(key))return;seen.add(key);send(type,context);};
    function contextFor(el){
      if(!(el instanceof Element))return null;
      const card=el.closest('.product-card,.school-home-button');
      if(card){let section=null;const attrs={'data-open-personal-day':'day','data-open-year':'year','data-open-matrix':'full','data-open-redflag':'redflag','data-open-compatibility':'compatibility','data-open-destiny-code':'money'};
        for(const [attr,value] of Object.entries(attrs))if(card.hasAttribute(attr))section=value;
        const href=card.getAttribute('href')||'';if(href.includes('/pro/'))section='full';if(href.includes('/schools/'))section='school';if(href.includes('/child/'))section='children';if(href.includes('/moment/'))section='moment';return section?row(section):null;}
      const section=pageSection();
      const rf=el.closest('.redflag-question');if(rf){const title=rf.querySelector('.redflag-question-label')?.textContent;return row('redflag',tag(rf.dataset.questionId,80)||hash(title||''),title);}
      const q=el.closest('.question-entry');if(q){const title=q.querySelector('.question-name')?.textContent;return row(section,hash(title||''),title);}
      const c=el.closest('.compatibility-topic');if(c){const title=c.querySelector('.compatibility-topic-title')?.textContent;return row('compatibility',hash(title||''),title);}
      const pro=el.closest('[data-question]');if(pro)return row('full',tag(pro.dataset.question,80)||hash(pro.textContent),pro.querySelector('span')?.textContent||pro.textContent);
      const child=el.closest('[data-child-topic]');if(child)return row('children',tag(child.dataset.childTopic,80)||hash(child.textContent),child.querySelector('.child-topic-label')?.textContent||child.textContent);
      const category=el.closest('.category,.redflag-category-toggle,[data-child-start],[data-zone]');if(category){const title=category.querySelector('strong,.category-title')?.textContent||category.textContent;return row(section,'cat:'+hash(clean(title)),title);}
      return null;
    }
    document.addEventListener('click',safe(event=>{
      const el=event.target instanceof Element?event.target.closest('button,a,summary,[role="button"]'):null;if(!el)return;
      const context=el.matches('.product-card,.school-home-button,.redflag-question-toggle,.question-entry,.compatibility-topic-toggle,[data-question],[data-child-topic],.category,.redflag-category-toggle,[data-child-start],[data-zone]')?contextFor(el):null;
      if(context){once('impression',context);send('click',context);if(context.item!=='-'&&!context.item.startsWith('cat:')){lastQuestion=context;send('open',context);}else if(context.item.startsWith('cat:'))send('category',context);}
      const id=el.id||'';
      if(/paywall-one-time$|checkout-once/.test(id)){send('checkout_once',lastQuestion||row(pageSection()));return;}
      if(/paywall-club$|money-club-join$|checkout-club/.test(id)){send('checkout_club',lastQuestion||row(pageSection()));return;}
      if(/paywall-buy|pdf-button|pdf-buy|club-join/.test(id)||el.matches('.compatibility-pdf-button,.redflag-buy-button'))send('offer',lastQuestion||row(pageSection()));
    }),{capture:true,passive:true});
    let searchTimer=0;
    document.addEventListener('input',safe(event=>{if(!event.target.matches('input[type="search"]'))return;clearTimeout(searchTimer);searchTimer=setTimeout(safe(()=>{if(event.target.value.trim())once('search',row(pageSection(),'search','Поиск по каталогу'));}),700);}),{passive:true});
    const observed=new WeakSet(),contexts=new WeakMap();
    const observer='IntersectionObserver' in window?new IntersectionObserver(safe(entries=>{for(const entry of entries)if(entry.isIntersecting&&entry.intersectionRatio>=0.5){const c=contexts.get(entry.target);if(c)once('impression',c);}}),{threshold:[0.5]}):null;
    const dialogs=new WeakSet();
    function scan(){
      const section=pageSection();if(section!==currentSection){currentSection=section;lastQuestion=null;send('page',row(section));if(section!=='home')once('open',row(section));}
      for(const el of document.querySelectorAll('.product-card,.school-home-button,.redflag-question,.question-entry,.compatibility-topic,[data-question],[data-child-topic],.category,.redflag-category-toggle,[data-child-start],[data-zone]')){
        const context=contextFor(el);if(!context)continue;contexts.set(el,context);
        if(observer&&!observed.has(el)){observed.add(el);observer.observe(el);}
      }
      for(const dialog of document.querySelectorAll('dialog[open]'))if(/paywall|club/.test(dialog.id)&&!dialogs.has(dialog)){dialogs.add(dialog);send('offer',lastQuestion||row(section));}
      for(const dialog of document.querySelectorAll('dialog:not([open])'))dialogs.delete(dialog);
    }
    let scheduled=false;const schedule=safe(()=>{if(scheduled)return;scheduled=true;setTimeout(safe(()=>{scheduled=false;scan();}),160);});
    new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open']});
    window.addEventListener('pageshow',schedule,{passive:true});
    document.addEventListener('visibilitychange',safe(()=>{if(document.visibilityState==='hidden'&&queue.length){const batch=queue.splice(0,20);if(!navigator.sendBeacon(endpoint,new Blob([JSON.stringify({events:batch})],{type:'application/json'})))queue.unshift(...batch);}}));
    window.NumiInsights=Object.freeze({version:'2.0.0',checkout:plan=>send(plan==='club'?'checkout_club':'checkout_once',lastQuestion||row(pageSection()))});
    scan();
  } catch(_) { /* Analytics must never interrupt the site. */ }
})();
