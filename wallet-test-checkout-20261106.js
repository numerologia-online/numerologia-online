/* Dedicated on-site owner-only TEST checkout. No card numbers/CVC ever processed by us. */
(() => {
"use strict";
const api="/api/numi-wallet-test.php";
const $=id=>document.getElementById(id);
const key="numi-test-dedicated-ref-20261106";
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
let started=false, widget=null, paymentRef=null, completion=false, isOwner=false, hasWidget=false;
const params=new URLSearchParams(location.search);
const amount=Number(params.get("amount")||100);
function status(message,bad=false){$("status").textContent=message;$("status").classList.toggle("error",bad);}
function money(v){return Number(v).toLocaleString("ru-RU",{maximumFractionDigits:2})+" ₽";}
function safeCode(e){let v=typeof e==="string"?e:e&&typeof e==="object"?(e.code||e.type||e.message):"unknown";
 return typeof v==="string"&&/^[A-Za-z0-9_-]{1,60}$/.test(v)?v:"unknown";
}
async function req(action,extra={}){
 const r=await fetch(api,{method:"POST",cache:"no-store",credentials:"same-origin",
  headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...extra})});
 const d=await r.json().catch(()=>null);
 if(!r.ok||d?.ok!==true)throw Error(d?.error||"SERVICE_UNAVAILABLE");
 return d;
}
function store(ref){try{sessionStorage.setItem(key,ref);}catch(_){}}
function forget(){try{sessionStorage.removeItem(key);}catch(_){}}
async function showBalance(){
 const s=await req("status");
 if(s.test!==true)throw Error("OWNER_TEST_ONLY");
 isOwner=true;
 $("balance").textContent=money((s.balance_kopeks||0)/100);
}
function finishWidget(){
 if(widget){try{widget.destroy();}catch(_){}widget=null;}
 $("widget-frame").replaceChildren();
 $("widget-section").hidden=true;
}
async function reconcile(){
 if(!paymentRef){status("Незавершённого платежа на этой странице нет.");return;}
 $("check").disabled=true;
 try {
  const d=await req("sync",{payment_ref:paymentRef});
  await showBalance();
  if(d.payment_status==="succeeded"){
   finishWidget();forget();paymentRef=null;
   $("check").hidden=true;$("start").hidden=true;
   status("Оплата подтверждена ЮKassa! Тестовый баланс обновлён.");
  }else if(d.payment_status==="canceled"){
   finishWidget();forget();paymentRef=null;
   $("check").hidden=true;$("start").hidden=false;$("start").disabled=!hasWidget;
   started=false;
   status("ЮKassa отменила этот тестовый платёж. Деньги не зачислены.",true);
  }else{
   status("ЮKassa ещё не подтвердила этот тестовый платёж. Не создавай новую оплату, повтори проверку статуса.");
  }
 }catch(e){status("Не удалось запросить статус платежа: "+safeCode(e)+". Повторную оплату не создавай.",true);}
 finally{$("check").disabled=false;}
}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function complete(){
 if(completion)return;
 completion=true;
 finishWidget();
 status("Оплата завершена в форме ЮKassa. Подтверждаем результат на сервере…");
 for(let i=0;i<5;i++){
  await reconcile();
  if(!paymentRef)break;
  if(i<4)await wait(1800);
 }
 completion=false;
}
async function create(){
 if(started||!isOwner||!hasWidget||paymentRef)return;
 started=true;$("start").disabled=true;
 status("Создаём один тестовый платёж и открываем виджет…");
 try{
  const d=await req("topup_widget",{amount_rub:amount});
  if(d.test!==true||d.checkout!=="embedded"||!uuid.test(d.payment_ref)
    ||typeof d.confirmation_token!=="string"||!/^ct-[A-Za-z0-9-]{10,500}$/.test(d.confirmation_token))
    throw Error("INVALID_TEST_RESPONSE");
  paymentRef=d.payment_ref;store(paymentRef);
  $("check").hidden=false;$("start").hidden=true;
  $("widget-section").hidden=false;
  widget=new window.YooMoneyCheckoutWidget({
   confirmation_token:d.confirmation_token,
   customization:{payment_methods:["bank_card"]},
   error_callback:e=>status("Ошибка виджета ЮKassa: "+safeCode(e)+". Повторную оплату не создавай.",true)
  });
  widget.on("complete",()=>{void complete();});
  widget.on("success",()=>{void complete();});
  widget.on("fail",()=>{void reconcile();});
  // The widget is placed in an ordinary, top-level page (not a nested <dialog>).
  let timer;
  try{
   await Promise.race([widget.render("widget-frame"),
     new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("WIDGET_RENDER_TIMEOUT")),20000)})]);
  }finally{clearTimeout(timer);}
  if(paymentRef)status("Платёжная форма открыта прямо на сайте. После оплаты нажми «Проверить статус», если баланс не обновился.");
 }catch(e){
  finishWidget();
  status("Не удалось загрузить платёжную форму: "+safeCode(e)+
   (paymentRef?". Тестовый платёж уже создан, новую оплату не начинай.":" Попробуй позже."),true);
  if(!paymentRef){started=false;$("start").hidden=false;$("start").disabled=!hasWidget;}
 }
}
function preloadWidget(){
 return new Promise((resolve,reject)=>{
  if(typeof window.YooMoneyCheckoutWidget==="function"){resolve();return;}
  let tag=document.createElement("script"),timer=setTimeout(()=>reject(Error("WIDGET_SCRIPT_TIMEOUT")),15000);
  tag.src="https://yookassa.ru/checkout-widget/v1/checkout-widget.js";
  tag.onload=()=>{clearTimeout(timer);
   typeof window.YooMoneyCheckoutWidget==="function"?resolve():reject(Error("WIDGET_SCRIPT_UNAVAILABLE"));};
  tag.onerror=()=>{clearTimeout(timer);reject(Error("WIDGET_SCRIPT_BLOCKED"));};
  document.head.appendChild(tag);
 });
}
async function init(){
 if(!Number.isInteger(amount)||amount<100||amount>10000){
  status("Некорректная тестовая сумма.",true);return;
 }
 $("amount").textContent=money(amount);
 $("start").addEventListener("click",()=>{void create();});
 $("check").addEventListener("click",()=>{void reconcile();});
 let saved=null;
 try{saved=sessionStorage.getItem(key);}catch(_){}
 if(saved&&uuid.test(saved)){paymentRef=saved;started=true;$("start").hidden=true;$("check").hidden=false;}
 try{
  await showBalance();
  if(paymentRef)await reconcile();
  // Readiness comes before payment creation: no pending charge if widget cannot load.
  await preloadWidget();hasWidget=true;
  if(!paymentRef){$("start").disabled=false;status("Виджет ЮKassa доступен. Нажми «Открыть оплату картой».");}
 }catch(e){
  status("Не удалось подготовить оплату: "+safeCode(e)+". Новая оплата не создавалась.",true);
 }
}
void init();
})();