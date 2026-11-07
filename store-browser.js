/* One basket for the existing account/order API. No local flag grants access. */
(() => {
  'use strict';
  if(window.NumiStore)return;
  const KEY='numi-cart-v1', API='/api/numi-account.php';
  const money=n=>(n/100).toLocaleString('ru-RU')+' ₽';
  const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  let cart=[],catalog,quote,busy=false,sequence=0;
  try {const saved=JSON.parse(sessionStorage.getItem(KEY)||'[]');if(Array.isArray(saved))cart=saved.slice(0,20);} catch (_) {}
  const dialog=node('dialog');dialog.id='numi-store';dialog.setAttribute('aria-labelledby','numi-store-title');
  const title=node('h2','Покупки и корзина');title.id='numi-store-title';
  const close=node('button','Закрыть');close.type='button';close.onclick=()=>dialog.close();
  const status=node('p');status.setAttribute('role','status');
  // Sandbox-only wallet: never displays for normal clients until its private flag is enabled.
  const walletPanel=node('section');walletPanel.id='numi-wallet-panel';walletPanel.hidden=true;
  const walletHeading=node('h3','Мой баланс');const walletAmount=node('strong','0 ₽');
  walletAmount.setAttribute('aria-live','polite');
  const walletHelp=node('p','Пополнение в тестовом режиме. Настоящие деньги не списываются.');
  const walletActions=node('div');
  const walletHistory=node('details'),walletSummary=node('summary','История операций'),walletList=node('ul');
  walletHistory.append(walletSummary,walletList);
  walletPanel.append(walletHeading,walletAmount,walletHelp,walletActions,walletHistory);
  let walletAvailable=false,walletBalance=0;
  const form=node('form'),select=node('select');select.setAttribute('aria-label','Товар');
  const date=node('input');date.type='date';date.setAttribute('aria-label','Дата рождения');
  const second=node('input');second.type='date';second.setAttribute('aria-label','Дата рождения партнёра');
  const year=node('input');year.type='number';year.min='1900';year.max='2050';year.value=String(new Date().getFullYear());year.setAttribute('aria-label','Год разбора');
  const question=node('select');question.setAttribute('aria-label','Вопрос');
  const time=node('input');time.type='time';time.setAttribute('aria-label','Время вопроса');
  const add=node('button','Добавить в корзину');add.type='submit';
  const list=node('ul'),total=node('p'),notice=node('p'),confirm=node('button','Подтвердить заказ');confirm.type='button';confirm.disabled=true;
  const consent=node('label');consent.hidden=true;const autoRenew=node('input');autoRenew.type='checkbox';autoRenew.checked=false;
  consent.append(autoRenew,node('span',' Разрешаю автопродление выбранных подписок: клуб 490 ₽ в месяц, школа 149 ₽ в неделю, до отмены в кабинете. Способ оплаты хранится в ЮKassa.'));
  autoRenew.onchange=()=>{try{sessionStorage.removeItem(KEY+'-request');}catch(_){}};
  const signIn=node('button','Войти в личный кабинет');signIn.type='button';
  signIn.onclick=()=>{dialog.close();const login=document.querySelector('[data-account-open="profile"]');if(login)login.click();else location.assign('/?store=1');};
  const refresh=node('button','Обновить цены и покупки');refresh.type='button';
  const materialPanel=node('section');materialPanel.setAttribute('aria-label','Приобретённый материал');
  const history=node('section');history.setAttribute('aria-label','История заказов и подписки');
  form.append(select,date,second,year,question,time,add);
  dialog.append(close,title,status,walletPanel,form,list,total,notice,consent,signIn,confirm,refresh,history,materialPanel);document.body.append(dialog);
  const css=node('style');css.textContent=`#numi-store{width:min(560px,calc(100vw - 32px));max-height:90dvh;overflow:auto;box-sizing:border-box;border:1px solid #c7bfb6;border-radius:18px;padding:22px;background:#f6f3ef;color:#343a35;font:15px/1.5 system-ui}#numi-store::backdrop{background:#17211bcc}#numi-store h2{font:28px Georgia,serif}#numi-store form{display:grid;gap:10px}#numi-store select,#numi-store input{width:100%;box-sizing:border-box;padding:10px;font:16px system-ui;background:white;color:#343a35;border:1px solid #a9aaa2;border-radius:8px}#numi-store button{padding:10px 14px;margin:5px 4px 5px 0;border:1px solid #6a7469;border-radius:8px;background:#343e35;color:white;font:inherit;cursor:pointer}#numi-store button:disabled{opacity:.5;cursor:default}#numi-store ul{list-style:none;padding:0}#numi-store li{padding:12px 0;border-bottom:1px solid #d8d4cc}#numi-store [hidden]{display:none!important}`;document.head.append(css);
  const label=code=>catalog?.products.find(p=>p.code===code)?.title||code;
  function walletRender(){
    walletPanel.hidden=!walletAvailable;
    walletAmount.textContent=money(walletBalance);
    walletActions.replaceChildren();
    if(!walletAvailable)return;
    for(const amount of [100,300,500]){
      const button=node('button','Пополнить на '+amount+' ₽');button.type='button';button.disabled=busy;
      button.onclick=async()=>{
        if(busy)return;busy=true;button.disabled=true;
        try{
          const key=crypto.randomUUID();
          const data=await api('wallet_topup',{amount_rub:amount,request_key:key});
          if(data.credited){await walletRefresh();status.textContent='Тестовый баланс пополнен.';return;}
          const url=new URL(data.confirmation_url);
          if(url.protocol!=='https:'||!['yookassa.ru','yoomoney.ru'].includes(url.hostname))throw new Error('INVALID_CONFIRMATION_URL');
          try{sessionStorage.setItem('numi-wallet-topup-pending',data.topup_id);}catch(_){}
          location.assign(url.href);
        }catch(e){error(e);}finally{busy=false;button.disabled=false;}
      };
      walletActions.append(button);
    }
  }
  async function walletRefresh(){
    try{
      const data=await api('wallet_status');
      if(data.test!==true)throw new Error('TEST_MODE_REQUIRED');
      walletAvailable=true;walletBalance=Number(data.balance_kopeks)||0;
      walletList.replaceChildren();
      for(const op of data.operations||[]){
        const row=node('li',((Number(op.delta_kopeks)>=0)?'+':'')+money(Number(op.delta_kopeks))+' · '+op.created_at);
        walletList.append(row);
      }
    }catch(e){walletAvailable=false;walletBalance=0;}
    walletRender();render();
    window.dispatchEvent(new Event('numi:wallet-updated'));
  }
  async function api(action,extra={}) {
    const response=await fetch(API,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extra})});
    const data=await response.json();
    if(!response.ok||!data.ok){const error=new Error(data.error||'SERVICE_UNAVAILABLE');error.data=data;throw error;}return data;
  }
  const messages={INVALID_CART:'Добавьте хотя бы один товар.',DUPLICATE_CART_ITEM:'Этот товар уже есть в корзине.',CHECKOUT_NOT_READY:'Оплата пока недоступна для выбранных товаров.',LOGIN_REQUIRED:'Войдите в личный кабинет. Корзина сохранена.',INVALID_BIRTH_DATE:'Укажите дату рождения.',INVALID_YEAR_SUBJECT:'Укажите дату рождения и год.',INVALID_PAIR:'Укажите обе даты рождения.',INVALID_CHILD_DATE:'Укажите дату рождения ребёнка.',INVALID_QUESTION_SUBJECT:'Выберите вопрос и заполните его данные.',ITEM_ALREADY_ORDERED:'Товар уже куплен или ожидает оплаты. Проверьте историю заказов.'};
  function error(e){status.textContent=messages[e.message]||'Не удалось обновить данные. Попробуйте ещё раз.';}
  function save(){try{sessionStorage.setItem(KEY,JSON.stringify(cart));sessionStorage.removeItem(KEY+'-request');}catch(_){}quote=null;confirm.disabled=true;}
  function fields(){
    const code=select.value;
    date.hidden=!['year_full','life_full','compatibility_full','child_full_v1','redflag_question'].includes(code);date.required=!date.hidden;
    second.hidden=code!=='compatibility_full';second.required=!second.hidden;
    year.hidden=code!=='year_full';year.required=!year.hidden;
    question.hidden=!['redflag_question','yesno_question','moment_question'].includes(code);
    time.hidden=!['yesno_question','moment_question'].includes(code);time.required=!time.hidden;
    question.replaceChildren();
    for(const q of catalog[code==='redflag_question'?'redflag':code==='yesno_question'?'yesno':'moment']||[]){const option=node('option',q.title);option.value=q.id;option.dataset.category=q.category;question.append(option);}
    add.disabled=['moment_question','money_rituals','wallet_topup'].includes(code);
    status.textContent=code==='moment_question'?'Раздел готовится. Продажи закрыты.':code==='money_rituals'?'Материалы входят в клуб.':code==='wallet_topup'?'Пополнение пока не подключено.':'';
  }
  select.onchange=fields;
  function render(){
    list.replaceChildren();cart.forEach((item,i)=>{
      const row=node('li',label(item.product_code)+' · '+(item.birth_date||item.question_time||''));
      const priced=quote?.items[i];if(priced){row.append(node('p',money(priced.price_kopeks)+(priced.access_active?' · Уже доступно':!priced.sale_ready?' · Выдача ещё подключается':'')));}
      if(priced?.member_included&&item.product_code==='yesno_question'){
        const read=node('button','Открыть ответ, включённый в клуб');read.type='button';read.onclick=async()=>{
          try{const response=await fetch('/api/numi-yesno-answer.php',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:item.question_id,time:item.question_time})});const data=await response.json();if(!response.ok||!data.ok||typeof data.answer!=='string')throw new Error(data.error||'ANSWER_UNAVAILABLE');materialPanel.replaceChildren(node('h3','Да или нет?'),node('p',data.answer));}catch(e){error(e);}
        };row.append(read);
      }
      if(walletAvailable && quote?.checkout_enabled===true && priced?.sale_ready===true
          && !priced?.access_active && ['redflag_question','yesno_question'].includes(item.product_code)){
        const pay=node('button','Списать '+money(priced.price_kopeks)+' с баланса и читать');pay.type='button';
        pay.disabled=busy;
        pay.onclick=async()=>{
          if(busy)return;
          if(walletBalance<Number(priced.price_kopeks)){status.textContent='На балансе недостаточно средств. Пополните его выше.';return;}
          busy=true;pay.disabled=true;
          try{
            const key=crypto.randomUUID();
            const result=await api('wallet_buy',{item,request_key:key});
            if(result.test!==true||!result.entitlement_id)throw new Error('INVALID_WALLET_RESULT');
            walletBalance=Number(result.balance_kopeks)||0;
            cart.splice(i,1);save();
            walletRender();
            await showMaterial(result.entitlement_id);
            status.textContent='Оплачено с баланса. Ответ открыт ниже.';
            await walletRefresh();await update();await orders();
          }catch(e){error(e);}finally{busy=false;render();}
        };
        row.append(pay);
      }
      const remove=node('button','Удалить');remove.type='button';remove.onclick=()=>{cart.splice(i,1);save();update();};row.append(remove);list.append(row);
    });
    total.textContent=quote?'Итого: '+money(quote.total_kopeks):cart.length?'Уточняем цену на сервере…':'Корзина пуста';
    notice.textContent=quote?.discount_note||'Клубные цены применяются после подтверждённой активации клуба. Автоматическое продление не подключено.';
    consent.hidden=quote?.recurring_enabled!==true||!cart.some(i=>['club_month','school_week'].includes(i.product_code));if(consent.hidden)autoRenew.checked=false;
    signIn.hidden=quote?.authenticated===true;confirm.disabled=busy||quote?.checkout_enabled!==true;
  }
  async function update(){
    const revision=++sequence;quote=null;render();
    if(!cart.length)return;
    try{const result=await api('cart_quote',{items:cart});if(revision!==sequence)return;quote=result;render();if(!result.checkout_enabled)status.textContent=!result.authenticated?'Войдите в кабинет. Корзина сохранена.':!result.fulfillment_ready?'Некоторые позиции уже доступны или ещё не готовы к продаже. Откройте доступные материалы и удалите недоступные позиции перед оплатой.':'Тестовая оплата пока не включена для этого аккаунта.';}catch(e){if(revision===sequence)error(e);}
  }
  form.onsubmit=e=>{
    e.preventDefault();if(cart.length>=20){status.textContent='В корзине может быть до 20 товаров.';return;}
    const item={product_code:select.value};
    if(!date.hidden)item.birth_date=date.value;if(!second.hidden)item.partner_birth_date=second.value;if(!year.hidden)item.year=Number(year.value);
    if(!question.hidden)item.question_id=question.value;if(select.value==='redflag_question')item.category=question.selectedOptions[0]?.dataset.category;if(!time.hidden)item.question_time=time.value;
    if(cart.some(x=>JSON.stringify(x)===JSON.stringify(item))){status.textContent='Этот товар уже в корзине.';return;}
    cart.push(item);save();update();
  };
  async function orders(){
    history.replaceChildren();try{
      let result=await api('order_history');
      const pending=[...new Set(result.orders.filter(o=>o.status==='pending'&&o.checkout_id).map(o=>o.checkout_id))].slice(0,5);
      if(pending.length){await Promise.allSettled(pending.map(id=>api('order_status',{checkout_id:id})));result=await api('order_history');}
      history.append(node('h3','Заказы и подписки'));
      for(const s of result.subscriptions){
        const row=node('div');row.append(node('p',label(s.product_code)+' · '+(s.status==='active'?'Действует':'Срок истёк')+' · до '+s.expires_at+' UTC · '+(s.auto_renew?(s.processing_enabled?'автопродление включено':'автопродление приостановлено'):'продление вручную')));
        const renew=node('button','Продлить');renew.type='button';renew.onclick=()=>open({item:{product_code:s.product_code},addItems:[{product_code:s.product_code}]});row.append(renew);
        if(s.auto_renew){const cancel=node('button','Отключить автопродление');cancel.type='button';cancel.onclick=async()=>{try{await api('cancel_renewal',{product_code:s.product_code});await orders();}catch(e){error(e);}};row.append(cancel);}history.append(row);
      }
      const states={pending:'Ожидает оплаты',paid:'Оплачен',refunded:'Возвращён',cancelled:'Отменён'};
      if(!result.orders.length)history.append(node('p','Заказов пока нет.'));
      for(const order of result.orders){
        const row=node('div');row.append(node('p',label(order.product_code)+' · '+money(order.amount_kopeks)+' · '+(states[order.status]||order.status)+' · '+order.created_at+' UTC'));
        if(order.entitlement_id&&order.status==='paid'){
          const read=node('button','Открыть материал и PDF');read.type='button';read.onclick=()=>showMaterial(order.entitlement_id);row.append(read);
        }
        if(order.status==='pending'&&order.checkout_id){const resume=node('button','Проверить / продолжить оплату');resume.type='button';resume.onclick=async()=>{try{const data=await api('order_status',{checkout_id:order.checkout_id});if(data.items.some(o=>o.status==='pending')&&data.confirmation_url){const url=new URL(data.confirmation_url);if(url.protocol==='https:'&&['yoomoney.ru','yookassa.ru'].includes(url.hostname))location.assign(url.href);}else await orders();}catch(e){error(e);}};row.append(resume);}
        history.append(row);
      }
    }catch(e){if(e.message!=='LOGIN_REQUIRED')error(e);}
  }
  refresh.onclick=()=>{update();orders();walletRefresh();};
  confirm.onclick=async()=>{
    if(busy||!quote?.checkout_enabled)return;busy=true;render();
    try{
      let key=sessionStorage.getItem(KEY+'-request');if(!key){key=crypto.randomUUID();sessionStorage.setItem(KEY+'-request',key);}
      const result=await api('checkout',{items:cart,request_key:key,auto_renew_consent:autoRenew.checked===true});
      if(result.test!==true)throw new Error('UNEXPECTED_PAYMENT_MODE');
      if(result.completed){await orders();await update();status.textContent='Статус платежа подтверждён. Купленные материалы доступны ниже.';return;}
      const url=new URL(result.confirmation_url);if(url.protocol!=='https:'||!['yoomoney.ru','yookassa.ru'].includes(url.hostname))throw new Error('INVALID_CONFIRMATION_URL');
      location.assign(url.href);
    }catch(e){error(e);}finally{busy=false;render();}
  };
  async function showMaterial(id){const {openMaterial}=await import('/store-material.js?v=2');await openMaterial(materialPanel,id);}
  async function open(options={}){
    if(!dialog.open)dialog.showModal();
    try{if(!catalog){const response=await fetch('/store-catalog.json');if(!response.ok)throw new Error('CATALOG_UNAVAILABLE');catalog=await response.json();for(const p of catalog.products){const o=node('option',p.title);o.value=p.code;select.append(o);}fields();}
      if(options.item){select.value=options.item.product_code;fields();const item=options.item;
        if(item.birth_date)date.value=item.birth_date;if(item.partner_birth_date)second.value=item.partner_birth_date;
        if(item.year)year.value=item.year;if(item.question_id)question.value=item.question_id;if(item.question_time)time.value=item.question_time;
      }
      for(const item of options.addItems||[]){
        const valid=(!['year_full','life_full','compatibility_full','child_full_v1','redflag_question'].includes(item.product_code)||item.birth_date)
          &&(item.product_code!=='compatibility_full'||item.partner_birth_date)
          &&(!['redflag_question','yesno_question','moment_question'].includes(item.product_code)||item.question_id)
          &&(!['yesno_question','moment_question'].includes(item.product_code)||item.question_time);
        if(valid&&!cart.some(x=>JSON.stringify(x)===JSON.stringify(item))&&cart.length<20){cart.push(item);save();}
      }
      await walletRefresh();await update();await orders();if(options.entitlement_id)await showMaterial(options.entitlement_id);}catch(e){error(e);}
  }
  for(const parent of [document.getElementById('account-overview'),document.querySelector('main')]){
    if(!parent)continue;const button=node('button','Покупки и корзина');button.type='button';button.className='account-secondary';button.onclick=open;parent.append(button);
  }
  window.NumiStore=Object.freeze({open});
  window.addEventListener('numi:account-logged-out',()=>{quote=null;walletAvailable=false;walletBalance=0;walletRender();history.replaceChildren();materialPanel.replaceChildren();render();});
  if(new URL(location.href).searchParams.get('store')==='1')open();
  const walletTopup=new URL(location.href).searchParams.get('wallet_topup');
  if(walletTopup&&/^[a-f0-9-]{36}$/i.test(walletTopup)){
    open().then(async()=>{
      try{
        const result=await api('wallet_sync',{topup_id:walletTopup});
        await walletRefresh();
        status.textContent=result.status==='credited'?'Тестовое пополнение подтверждено. Баланс обновлён.':'Платёж пока не завершён.';
        if(result.status==='credited'||result.status==='canceled'){
          try{sessionStorage.removeItem('numi-wallet-topup-pending');}catch(_){}
        }
      }catch(e){error(e);}
      const u=new URL(location.href);u.searchParams.delete('wallet_topup');history.replaceState(null,'',u.pathname+u.search+u.hash);
    });
  }
  const checkout=new URL(location.href).searchParams.get('checkout');
  if(checkout&&/^[a-f0-9-]{36}$/.test(checkout)){
    open().then(async()=>{try{const result=await api('order_status',{checkout_id:checkout});if(cart.length){const priced=await api('cart_quote',{items:cart});cart=cart.filter((_,i)=>!result.items.some(o=>o.status==='paid'&&o.product_code===priced.items[i].product_code&&o.resource_id===priced.items[i].resource_id));save();}await orders();await update();
      const paid=await api('order_history');
      const unlocked=(paid.orders||[]).filter(o=>o.checkout_id===checkout&&o.status==='paid'&&o.entitlement_id);
      if(unlocked.length===1){await showMaterial(unlocked[0].entitlement_id);status.textContent='Оплата подтверждена. Ваш ответ открыт ниже.';}
      else status.textContent='Оплата проверена. Купленные ответы можно открыть в списке заказов ниже.';}catch(e){error(e);}});
  }
})();
