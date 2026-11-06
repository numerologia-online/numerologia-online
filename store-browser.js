/* One basket for the existing account/order API. No local flag grants access. */
(() => {
  'use strict';
  const KEY='numi-cart-v1', API='/api/numi-account.php';
  const money=n=>(n/100).toLocaleString('ru-RU')+' ₽';
  const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  let cart=[],catalog,quote,busy=false,sequence=0;
  try {const saved=JSON.parse(sessionStorage.getItem(KEY)||'[]');if(Array.isArray(saved))cart=saved.slice(0,20);} catch (_) {}
  const dialog=node('dialog');dialog.id='numi-store';dialog.setAttribute('aria-labelledby','numi-store-title');
  const title=node('h2','Покупки и корзина');title.id='numi-store-title';
  const close=node('button','Закрыть');close.type='button';close.onclick=()=>dialog.close();
  const status=node('p');status.setAttribute('role','status');
  const form=node('form'),select=node('select');select.setAttribute('aria-label','Товар');
  const date=node('input');date.type='date';date.setAttribute('aria-label','Дата рождения');
  const second=node('input');second.type='date';second.setAttribute('aria-label','Дата рождения партнёра');
  const year=node('input');year.type='number';year.min='1900';year.max='2050';year.value=String(new Date().getFullYear());year.setAttribute('aria-label','Год разбора');
  const question=node('select');question.setAttribute('aria-label','Вопрос');
  const time=node('input');time.type='time';time.setAttribute('aria-label','Время вопроса');
  const add=node('button','Добавить в корзину');add.type='submit';
  const list=node('ul'),total=node('p'),notice=node('p'),confirm=node('button','Подтвердить заказ');confirm.type='button';confirm.disabled=true;
  const signIn=node('button','Войти в личный кабинет');signIn.type='button';
  signIn.onclick=()=>{dialog.close();document.querySelector('[data-account-open="profile"]')?.click();};
  const refresh=node('button','Обновить цены и покупки');refresh.type='button';
  const history=node('section');history.setAttribute('aria-label','История заказов и подписки');
  form.append(select,date,second,year,question,time,add);
  dialog.append(close,title,status,form,list,total,notice,signIn,confirm,refresh,history);document.body.append(dialog);
  const css=node('style');css.textContent=`#numi-store{width:min(560px,calc(100vw - 32px));max-height:90dvh;overflow:auto;box-sizing:border-box;border:1px solid #c7bfb6;border-radius:18px;padding:22px;background:#f6f3ef;color:#343a35;font:15px/1.5 system-ui}#numi-store::backdrop{background:#17211bcc}#numi-store h2{font:28px Georgia,serif}#numi-store form{display:grid;gap:10px}#numi-store select,#numi-store input{width:100%;box-sizing:border-box;padding:10px;font:16px system-ui;background:white;color:#343a35;border:1px solid #a9aaa2;border-radius:8px}#numi-store button{padding:10px 14px;margin:5px 4px 5px 0;border:1px solid #6a7469;border-radius:8px;background:#343e35;color:white;font:inherit;cursor:pointer}#numi-store button:disabled{opacity:.5;cursor:default}#numi-store ul{list-style:none;padding:0}#numi-store li{padding:12px 0;border-bottom:1px solid #d8d4cc}#numi-store [hidden]{display:none!important}`;document.head.append(css);
  const label=code=>catalog?.products.find(p=>p.code===code)?.title||code;
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
      const remove=node('button','Удалить');remove.type='button';remove.onclick=()=>{cart.splice(i,1);save();update();};row.append(remove);list.append(row);
    });
    total.textContent=quote?'Итого: '+money(quote.total_kopeks):cart.length?'Уточняем цену на сервере…':'Корзина пуста';
    notice.textContent=quote?.discount_note||'Клубные цены применяются после подтверждённой активации клуба. Автоматическое продление не подключено.';
    signIn.hidden=quote?.authenticated===true;confirm.disabled=busy||quote?.checkout_enabled!==true;
  }
  async function update(){
    const revision=++sequence;quote=null;render();
    if(!cart.length)return;
    try{const result=await api('cart_quote',{items:cart});if(revision!==sequence)return;quote=result;render();if(!result.checkout_enabled)status.textContent='Корзина сохранена. Приём оплаты пока не включён.';}catch(e){if(revision===sequence)error(e);}
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
      const result=await api('order_history');history.append(node('h3','Заказы и подписки'));
      for(const s of result.subscriptions)history.append(node('p',label(s.product_code)+' · доступ до '+s.expires_at+' UTC · продление вручную'));
      const states={pending:'Ожидает оплаты',paid:'Оплачен',refunded:'Возвращён',cancelled:'Отменён'};
      if(!result.orders.length)history.append(node('p','Заказов пока нет.'));
      for(const order of result.orders)history.append(node('p',label(order.product_code)+' · '+money(order.amount_kopeks)+' · '+(states[order.status]||order.status)+' · '+order.created_at+' UTC'));
    }catch(e){if(e.message!=='LOGIN_REQUIRED')error(e);}
  }
  refresh.onclick=()=>{update();orders();};
  confirm.onclick=async()=>{
    if(busy||!quote?.checkout_enabled)return;busy=true;render();
    try{
      let key=sessionStorage.getItem(KEY+'-request');if(!key){key=crypto.randomUUID();sessionStorage.setItem(KEY+'-request',key);}
      const result=await api('checkout',{items:cart,request_key:key});
      if(result.test!==true)throw new Error('UNEXPECTED_PAYMENT_MODE');
      if(result.completed){await orders();await update();status.textContent='Статус платежа проверен. Посмотрите историю заказов.';return;}
      const url=new URL(result.confirmation_url);if(url.protocol!=='https:'||!['yoomoney.ru','yookassa.ru'].includes(url.hostname))throw new Error('INVALID_CONFIRMATION_URL');
      location.assign(url.href);
    }catch(e){error(e);}finally{busy=false;render();}
  };
  async function open(){
    if(!dialog.open)dialog.showModal();
    try{if(!catalog){const response=await fetch('/store-catalog.json');if(!response.ok)throw new Error('CATALOG_UNAVAILABLE');catalog=await response.json();for(const p of catalog.products){const o=node('option',p.title);o.value=p.code;select.append(o);}fields();}await update();await orders();}catch(e){error(e);}
  }
  for(const parent of [document.getElementById('account-overview'),document.querySelector('main')]){
    if(!parent)continue;const button=node('button','Покупки и корзина');button.type='button';button.className='account-secondary';button.onclick=open;parent.append(button);
  }
  window.NumiStore=Object.freeze({open});
  window.addEventListener('numi:account-logged-out',()=>{quote=null;history.replaceChildren();render();});
  const checkout=new URL(location.href).searchParams.get('checkout');
  if(checkout&&/^[a-f0-9-]{36}$/.test(checkout)){
    open().then(async()=>{try{await api('order_status',{checkout_id:checkout});await orders();await update();status.textContent='Статус платежа проверен на сервере. Результат указан в истории заказов.';}catch(e){error(e);}});
  }
})();
