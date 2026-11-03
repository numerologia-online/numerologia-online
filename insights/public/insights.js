/* Dashboard and pure report transforms, without third-party dependencies. */
(() => {
  'use strict';
  const labels={home:'Главная',day:'Личный день',year:'Разбор года',full:'Полный разбор жизни',redflag:'Мужчина или Red Flag',compatibility:'Совместимость',children:'Для мам',money:'Код богатства',moment:'300 вопросов','yes-no':'Да или нет',school:'Школа',club:'Клуб',other:'Другие покупки'};
  const number=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});
  const money=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
  const pct=v=>v===null||v===undefined?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:1})+'%';
  const title=r=>r.title||labels[r.section]||r.section||r.source||r.day;
  const kind=r=>r.item==='-'?'section':r.item?.startsWith('cat:')?'category':'question';
  const mainSections=['day','year','full','redflag','compatibility','children','money','moment','yes-no','school','club'];
  function completeSections(rows){
    const result=rows.map(r=>({...r}));
    for(const section of mainSections)if(!result.some(r=>r.section===section&&r.item==='-')){
      result.push({section,item:'-',title:labels[section],impressions:0,clicks:0,opens:0,offers:0,checkout_once:0,checkout_club:0,orders:0,subscriptions:0,revenue:0,subscription_revenue:0,ctr:null,conversion:null,club_conversion:null,_no_events:true});
    }
    return result;
  }
  const columns={interest:[['impressions','Показы'],['clicks','Нажатия'],['ctr','CTR'],['one_time_orders','Разовые оплаты'],['subscriptions','Подписки']],sales:[['offers','К покупке'],['orders','Оплаты'],['conversion','Конверсия']],club:[['checkout_club','Выбор клуба'],['subscriptions','Подписки'],['club_conversion','Конверсия']],sources:[['sessions','Посещения страниц'],['orders','Оплаты'],['revenue','Выручка, ₽']],days:[['sessions','Посещения страниц'],['clicks','Нажатия'],['orders','Оплаты']]};
  const metrics={impressions:'Показы карточки',clicks:'Нажатия',opens:'Открытия',ctr:'CTR по просмотрам',offers:'Открытия предложения',checkout_once:'Выбор разовой покупки',checkout_club:'Выбор подписки',orders:'Подтверждённые оплаты',subscriptions:'Из них подписки',revenue:'Выручка, ₽',conversion:'Заказы / просмотры строки',club_conversion:'Подписки / просмотры строки',subscription_revenue:'Выручка от подписок, ₽',sessions:'Посещения страниц',pages:'Открытия страниц',checkouts:'Выбор покупки'};
  function oneTimeOrders(row){return Math.max(0,Number(row.orders||0)-Number(row.subscriptions||0));}
  function filteredRows(report,view,filters={}){
    let rows=(view==='sources'?report.sources:view==='days'?report.days:report.rows)||[];
    if(!['sources','days'].includes(view))rows=completeSections(rows);
    rows=rows.map(r=>({...r,one_time_orders:oneTimeOrders(r),title:view==='sources'?(r.source==='unattributed'?'Без источника покупки':r.source==='direct'?'Прямой вход':r.source==='telegram'?'Telegram':r.source):view==='days'?r.day:title(r)}));
    const q=String(filters.search||'').toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
    if(!['sources','days'].includes(view))rows=rows.filter(r=>(!filters.section||filters.section==='all'||r.section===filters.section)&&(!filters.kind||filters.kind==='all'||kind(r)===filters.kind));
    if(q)rows=rows.filter(r=>(r.title+' '+(labels[r.section]||'')+' '+(r.campaign||'')).toLocaleLowerCase('ru').replace(/ё/g,'е').includes(q));
    const key=filters.sort||(view==='sources'?'sessions':view==='days'?'day':'clicks');
    return rows.sort((a,b)=>{if(!['sources','days'].includes(view)&&(!filters.kind||filters.kind==='all')&&kind(a)!==kind(b)){const rank={section:0,question:1,category:2};return rank[kind(a)]-rank[kind(b)];}const x=a[key],y=b[key];if(x==null)return y==null?a.title.localeCompare(b.title,'ru'):1;if(y==null)return-1;return typeof x==='string'?String(y).localeCompare(x):Number(y)-Number(x)||a.title.localeCompare(b.title,'ru');});
  }
  function csv(rows){
    const keys=['title','section','item','source','campaign','impressions','clicks','opens','ctr','offers','checkout_once','checkout_club','orders','one_time_orders','subscriptions','revenue','conversion','sessions','pages','checkouts'];
    const names=['Название','Раздел','Код вопроса','Источник','Кампания','Показы','Нажатия','Открытия','CTR, %','Предложения покупки','Выбор разовой покупки','Выбор клуба','Все оплаты','Разовые оплаты','Оплаченные подписки','Выручка, ₽','Конверсия, %','Сеансы','Открытия страниц','Выбор покупки'];
    const escape=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
    return '\ufeff'+[names,...rows.map(r=>keys.map(k=>r[k]))].map(row=>row.map(escape).join(';')).join('\r\n');
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={filteredRows,csv,kind,pct,completeSections,oneTimeOrders};
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id);
  let report=null,view='interest',visible=50,rows=[],requestId=0,controller=null;
  const setStatus=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);$('status').hidden=!text;};
  const format=(key,value)=>['ctr','conversion','club_conversion'].includes(key)?pct(value):['revenue','subscription_revenue'].includes(key)?money.format(Number(value||0)):value===null||value===undefined?'—':number.format(Number(value));
  const dateISO=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Samara',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  async function api(url,options={}){
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});let data;
    try{data=await response.json();}catch(_){throw Error('Сервер вернул страницу вместо данных. Код '+response.status+'.');}
    if(!response.ok||!data.ok){const e=Error(({OWNER_LOGIN_REQUIRED:'Нужен вход с подтверждённой почтой владельца.',INSIGHTS_UNAVAILABLE:'Сервер аналитики временно недоступен.',INVALID_CREDENTIALS:'Проверьте почту и пароль.',EMAIL_NOT_VERIFIED:'Подтвердите почту по ссылке из письма.',TOO_MANY_ATTEMPTS:'Слишком много попыток входа. Попробуйте позже.',BAD_RANGE:'Выберите период до одного года, без будущих дат.'})[data.error]||'Не удалось получить данные. Код '+response.status+'.');e.code=data.error;throw e;}return data;
  }
  function loginVisible(){$('login-panel').hidden=false;$('dashboard').hidden=true;$('refresh').hidden=true;}
  function dashboardVisible(){$('login-panel').hidden=true;$('dashboard').hidden=false;$('refresh').hidden=false;}
  function setDates(days){const end=new Date(),start=new Date(end);start.setUTCDate(start.getUTCDate()-days+1);$('date-from').value=dateISO(start);$('date-to').value=dateISO(end);document.querySelectorAll('[data-days]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.days)===days));}
  function detail(row){
    $('detail-title').textContent=title(row);$('detail-section').textContent=view==='sources'?(row.campaign==='-'?'Без рекламной метки':'Кампания '+row.campaign):labels[row.section]||'';
    const dl=$('detail-metrics');dl.replaceChildren();for(const [key,label] of Object.entries(metrics)){if(!(key in row))continue;const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=format(key,row[key]);div.append(dt,dd);dl.append(div);} $('row-dialog').showModal();
  }
  function render(){
    if(!report)return;
    const cols=columns[view];$('analytics-table').classList.toggle('full-metrics',view==='interest');rows=filteredRows(report,view,{section:$('section').value,kind:$('kind').value,search:$('search').value,sort:$('sort').value});
    const headings={interest:['РАЗДЕЛЫ И ВОПРОСЫ','На что нажимают чаще'],sales:['ОТ ИНТЕРЕСА К ПОКУПКЕ','Что приносит оплаты'],club:['ИСТОЧНИКИ ПОДПИСОК','Из каких вопросов идут в клуб'],sources:['КАНАЛЫ И БЛОГЕРЫ','Откуда приходят покупатели'],days:['ДИНАМИКА','Как меняются посещения']};
    $('table-kicker').textContent=headings[view][0];$('table-heading').textContent=headings[view][1];
    const filterDisabled=['sources','days'].includes(view);$('section').disabled=filterDisabled;$('kind').disabled=filterDisabled;
    $('result-count').textContent=rows.length+' '+(view==='sources'?'источников':view==='days'?'дней':'строк')+(['sources','days'].includes(view)?'':' · сначала разделы, затем вопросы и темы')+' · нажмите название для подробностей';
    const head=document.createElement('tr');const name=document.createElement('th');name.scope='col';name.textContent=view==='sources'?'Источник':view==='days'?'Дата':'Раздел / вопрос';head.append(name);
    for(const [key,label]of cols){const th=document.createElement('th');th.scope='col';const button=document.createElement('button');button.textContent=label+($('sort').value===key?' ↓':'');button.addEventListener('click',()=>{const option=[...$('sort').options].find(o=>o.value===key);if(!option)$('sort').add(new Option(label,key));$('sort').value=key;render();});th.append(button);head.append(th);} $('table-head').replaceChildren(head);
    const body=$('table-body');body.replaceChildren();for(const [i,r]of rows.slice(0,visible).entries()){
      const tr=document.createElement('tr'),td=document.createElement('td'),button=document.createElement('button'),meta=document.createElement('span');button.className='row-name';button.textContent=(i+1)+'. '+r.title;button.addEventListener('click',()=>detail(r));meta.className='row-meta';meta.textContent=view==='sources'?(r.campaign==='-'?'Без кампании':r.campaign):view==='days'?'Самара':r._no_events?'Раздел · пока нет данных по этой строке':(labels[r.section]||r.section)+' · '+({section:'Раздел',question:'Вопрос',category:'Тема'})[kind(r)];td.append(button,meta);if(kind(r)==='section')tr.classList.add('section-row');tr.append(td);
      for(const [key,label] of cols){const cell=document.createElement('td');cell.dataset.label=label;cell.textContent=format(key,r[key]);if(r[key]===null||r[key]===undefined)cell.className='muted';else if(['orders','one_time_orders','subscriptions','revenue'].includes(key)&&r[key]>0)cell.className='positive';tr.append(cell);}body.append(tr);
    }
    $('empty').hidden=rows.length>0;$('analytics-table').hidden=!rows.length;$('show-more').hidden=rows.length<=visible;
    $('empty').querySelector('h3').textContent=report.rows.length?'По этим условиям пока нет строк':'Здесь появятся первые цифры';
  }
  async function refresh(){
    const id=++requestId;controller?.abort();controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);$('refresh').disabled=true;setStatus('Обновляем показатели…');
    try{const data=await api('/api/numi-insights.php?from='+encodeURIComponent($('date-from').value)+'&to='+encodeURIComponent($('date-to').value),{signal:controller.signal});if(id!==requestId)return;report=data;dashboardVisible();
      $('total-sessions').textContent=number.format(data.totals.sessions);$('total-clicks').textContent=number.format(data.rows.reduce((n,r)=>n+r.clicks,0));$('total-orders').textContent=number.format(data.totals.orders);$('total-club').textContent='из них подписок — '+number.format(data.totals.subscriptions);$('total-revenue').textContent=money.format(data.totals.revenue);
      $('updated').textContent='Обновлено '+new Date(data.generated_at).toLocaleString('ru-RU',{timeZone:'Europe/Samara'})+' · Самара · Оплат без связи с вопросом: '+data.totals.unattributed+'.';
      setStatus('');render();
    }catch(e){if(id!==requestId)return;if(e.code==='OWNER_LOGIN_REQUIRED')loginVisible();setStatus(e.name==='AbortError'?'Сервер не ответил за 15 секунд. Можно повторить кнопкой «Обновить».':e.message,true);}
    finally{clearTimeout(timeout);if(id===requestId)$('refresh').disabled=false;}
  }
  $('login-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;setStatus('Проверяем вход…');try{await api('/api/numi-account.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',email:$('email').value,password:$('password').value})});$('password').value='';await refresh();}catch(e){setStatus(e.message,true);}finally{button.disabled=false;}});
  $('refresh').addEventListener('click',refresh);$('period-form').addEventListener('submit',event=>{event.preventDefault();document.querySelectorAll('[data-days]').forEach(b=>b.classList.remove('selected'));refresh();});
  document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{setDates(Number(b.dataset.days));refresh();}));
  for(const id of ['search','section','kind','sort'])$(id).addEventListener(id==='search'?'input':'change',()=>{visible=50;render();});
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;visible=50;document.querySelectorAll('[data-view]').forEach(t=>t.classList.toggle('selected',t===b));const key=({interest:'clicks',sales:'orders',club:'subscriptions',sources:'sessions',days:'day'})[view];if(![...$('sort').options].some(o=>o.value===key))$('sort').add(new Option(key==='day'?'Сначала новые даты':'Больше посещений',key));$('sort').value=key;render();}));
  $('show-more').addEventListener('click',()=>{visible+=50;render();});
  $('export').addEventListener('click',()=>{if(!report)return;const blob=new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='numi-analytics-'+$('date-from').value+'-'+$('date-to').value+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('link-form').addEventListener('submit',event=>{event.preventDefault();const tag=$('campaign').value.trim().toLowerCase();if(!/^[a-z0-9_.:-]{1,64}$/.test(tag))return;const url=new URL('/',location.origin);url.searchParams.set('utm_source','blogger');url.searchParams.set('utm_campaign',tag);$('generated-link').textContent=url.href;$('copy-link').hidden=false;});
  $('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('generated-link').textContent);$('copy-link').textContent='Скопировано ✓';}catch(_){$('copy-link').textContent='Выделите и скопируйте ссылку выше';}});
  const close=()=>$('row-dialog').close();$('close-detail').addEventListener('click',close);$('back-table').addEventListener('click',close);$('row-dialog').addEventListener('click',e=>{if(e.target===$('row-dialog'))close();});
  $('logout').addEventListener('click',async()=>{try{await api('/api/numi-account.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});report=null;$('table-body').replaceChildren();loginVisible();setStatus('Вы вышли из аккаунта.');}catch(e){setStatus(e.message,true);}});
  setDates(7);$('date-from').max=dateISO(new Date());$('date-to').max=dateISO(new Date());
  const initial=new AbortController(),initialTimeout=setTimeout(()=>initial.abort(),12000);
  api('/api/numi-insights.php?action=session',{signal:initial.signal}).then(data=>{if(data.owner)return refresh();loginVisible();setStatus('');}).catch(e=>{loginVisible();setStatus(e.name==='AbortError'?'Сервер не ответил. Попробуйте обновить страницу.':e.message,true);}).finally(()=>clearTimeout(initialTimeout));
})();
