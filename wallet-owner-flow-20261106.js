/* One Red Flag question, owner-only test wallet. Does not expose real paid content. */
(() => {
"use strict";
const API="/api/numi-wallet-test.php", ID="numi-wallet-owner-overlay-20261106";
const $=id=>document.getElementById(id);
let owner=false, busy=false, balance=0, purchased=false, ready=false, selected=false;
let paymentRef=new URL(location.href).searchParams.get("payment");
if(paymentRef && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(paymentRef))paymentRef=null;
const money=k=>(Number(k)/100).toLocaleString("ru-RU",{maximumFractionDigits:2})+" ₽";
async function request(action,extra={}){
 const response=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify({action,...extra})});
 const data=await response.json().catch(()=>null);
 if(!response.ok||!data?.ok){const e=new Error(data?.error||"SERVICE_UNAVAILABLE");throw e;}
 return data;
}
function msg(text,error=false){
 const target=$("numi-ow-message");
 if(target){target.textContent=text;target.style.color=error?"#a1374e":"#625c56";}
}
function controls(){
 if(!$("numi-ow-buy"))return;
 $("numi-ow-buy").disabled=!ready||busy||purchased||balance<2000||!selected;
 $("numi-ow-topup").disabled=!ready||busy;
 $("numi-ow-refresh").disabled=!ready||busy;
}
function panel(){
 let dialog=$(ID);if(dialog)return dialog;
 const st=document.createElement("style");st.id="numi-ow-css";
 st.textContent=[
 '#'+ID+'{position:fixed;box-sizing:border-box;width:min(550px,calc(100vw - 18px));max-height:calc(100dvh - 18px);overflow:auto;',
 'margin:auto;padding:10px;border:0;border-radius:16px;background:#e9e7e4;color:#303330;font:12px/1.4 -apple-system,BlinkMacSystemFont,Arial,sans-serif;',
 'box-shadow:0 12px 50px #17191677}',
 '#'+ID+'::backdrop{background:#10151199}',
 '#'+ID+' *{box-sizing:border-box}',
 '#'+ID+' .ow-head{padding:14px;border-radius:13px;background:#373a38;color:white;position:relative}',
 '#'+ID+' .ow-head h2{font:400 25px/1.14 Georgia,serif;color:white;margin:5px 40px 4px 0}',
 '#'+ID+' .ow-head small{color:#edd3a8;font-size:9px;font-weight:800;letter-spacing:.1em}',
 '#'+ID+' .ow-head p{font-size:11px;color:#e3dfd8;margin:4px 0}',
 '#'+ID+' .ow-card{background:white;border:1px solid #dedbd7;border-radius:13px;padding:12px;margin-top:8px}',
 '#'+ID+' .ow-card h3{font:400 18px/1.2 Georgia,serif;margin:4px 0 8px;color:#303330}',
 '#'+ID+' .ow-label{font-size:9px;font-weight:800;color:#877d71;text-transform:uppercase;letter-spacing:.1em}',
 '#'+ID+' .ow-balance{font-size:30px;font-weight:800;letter-spacing:-.05em;padding:5px 0}',
 '#'+ID+' .ow-note{font-size:11px;color:#777671;line-height:1.4}',
 '#'+ID+' button{font:650 11px/1.2 -apple-system,BlinkMacSystemFont,Arial,sans-serif;border:1px solid #464641;border-radius:9px;',
 'background:#464641;color:white;min-height:35px;padding:8px 11px;cursor:pointer}',
 '#'+ID+' button:disabled{opacity:.45;cursor:default}',
 '#'+ID+' .ow-secondary{background:white;color:#47453f;border-color:#cecac4}',
 '#'+ID+' .ow-actions{display:flex;gap:7px;margin-top:8px;flex-wrap:wrap}',
 '#'+ID+' .ow-status{padding:8px;margin-top:8px;border-radius:9px;background:#f1f0ec;font-size:11px;color:#625c56}',
 '#'+ID+' .ow-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
 '#'+ID+' .ow-grid strong{display:block;font-size:19px;margin:4px 0}',
 '#'+ID+' .ow-grid strong span{display:block;color:#777;font-size:10px;font-weight:400}',
 '#'+ID+' ul{padding:0;margin:7px 0;list-style:none}',
 '#'+ID+' li{border-top:1px solid #eeece9;padding:7px 0;display:flex;justify-content:space-between;gap:8px;font-size:11px}',
 '#'+ID+' li strong{white-space:nowrap}',
 '#'+ID+' #numi-ow-close{position:absolute;top:10px;right:10px;border:0;background:#565a56;font-size:22px;min-width:35px;padding:5px}',
 '@media(max-width:340px){#'+ID+' .ow-grid{grid-template-columns:1fr}}'
 ].join("");
 document.head.append(st);
 dialog=document.createElement("dialog");dialog.id=ID;
 dialog.setAttribute("aria-label","Тестовый кошелёк на сайте");
 dialog.innerHTML=[
 '<div class="ow-head"><button id="numi-ow-close" type="button" aria-label="Закрыть">×</button>',
 '<small>НУМЕРОЛОГИЯ ОНЛАЙН · ТЕСТ</small><h2>Мой личный кабинет</h2>',
 '<p>Тестовый кошелёк и покупка вопроса прямо на сайте.</p></div>',
 '<p class="ow-status">Только тест ЮKassa: реальные деньги не списываются, платные ответы не открываются.</p>',
 '<section class="ow-card"><div class="ow-label">Мой кошелёк</div>',
 '<div id="numi-ow-balance" class="ow-balance">—</div>',
 '<div class="ow-note">Баланс хранится на сервере, отдельно от настоящих покупок.</div>',
 '<div class="ow-actions"><button id="numi-ow-topup" disabled>Пополнить 100 ₽ · тест</button>',
 '<button class="ow-secondary" id="numi-ow-refresh" disabled>Обновить баланс</button></div></section>',
 '<section class="ow-card"><div class="ow-label">Выбранный вопрос · Red Flag</div>',
 '<h3>Щедрый мужчина или считает каждую копейку?</h3>',
 '<div class="ow-note">Без подписки: 20 ₽. Повторная покупка не списывает деньги.</div>',
 '<div class="ow-actions"><button id="numi-ow-buy" disabled>Купить тестовый вопрос за 20 ₽</button></div>',
 '<p id="numi-ow-result" class="ow-status">Открой этот вопрос в разделе Red Flag.</p></section>',
 '<div class="ow-grid">',
 '<section class="ow-card"><div class="ow-label">Подписка № 1</div><h3>Клуб сайта</h3>',
 '<strong>490 ₽ <span>/ месяц</span></strong><button disabled>Подключить · скоро</button></section>',
 '<section class="ow-card"><div class="ow-label">Подписка № 2</div><h3>Школа нумерологии</h3>',
 '<strong>149 ₽ <span>/ неделю</span></strong><button disabled>Подключить · скоро</button></section></div>',
 '<section class="ow-card"><div class="ow-label">История операций</div><ul id="numi-ow-history"><li>Пока пусто</li></ul></section>',
 '<p class="ow-status" id="numi-ow-message" role="status">Проверка подключения…</p>'
 ].join("");
 document.body.append(dialog);
 $("numi-ow-close").addEventListener("click",()=>dialog.close());
 $("numi-ow-refresh").addEventListener("click",()=>work(async()=>{await load();msg("Баланс обновлён.")}));
 $("numi-ow-topup").addEventListener("click",()=>work(async()=>{
  msg("Создаём тестовый платёж ЮKassa…");
  const r=await request("topup");
  const url=new URL(r.confirmation_url);
  if(r.test!==true || url.protocol!=="https:" || !/(^|\.)yookassa\.ru$|(^|\.)yoomoney\.ru$/.test(url.hostname))throw Error("INVALID_TEST_URL");
  location.assign(url.href);
 }));
 $("numi-ow-buy").addEventListener("click",()=>work(async()=>{
  await request("buy");await load();msg("Покупка записана. Списание 20 тестовых рублей выполнено один раз.");
 }));
 return dialog;
}
function render(data){
 ready=true;balance=Number(data.balance_kopeks)||0;purchased=Boolean(data.question_unlocked);
 panel();$("numi-ow-balance").textContent=money(balance);
 $("numi-ow-buy").textContent=purchased?"Уже куплен · тест":"Купить тестовый вопрос за 20 ₽";
 $("numi-ow-result").textContent=purchased
  ?"Покупка подтверждена. Настоящий текст не выдаётся в тестовом режиме."
  :selected?"Вопрос выбран. Пополни баланс и купи его за 20 ₽.":"Сначала выбери этот вопрос на сайте.";
 const ul=$("numi-ow-history");ul.replaceChildren();
 const items=Array.isArray(data.operations)?data.operations:[];
 if(!items.length){const li=document.createElement("li");li.textContent="Операций пока нет";ul.append(li);}
 for(const item of items){
  const li=document.createElement("li"),left=document.createElement("span"),right=document.createElement("strong");
  left.textContent=String(item.description||"Операция");
  const value=Number(item.delta_kopeks)||0;right.textContent=(value>0?"+":"")+money(value);
  li.append(left,right);ul.append(li);
 }
 controls();
}
async function load(){
 if(paymentRef){
  const result=await request("sync",{payment_ref:paymentRef});
  if(result.payment_status==="pending")msg("Тестовый платёж ещё обрабатывается, нажми «Обновить».");else{
   paymentRef=null;const url=new URL(location.href);url.searchParams.delete("payment");
   history.replaceState(history.state,"",url.pathname+url.search+url.hash);
  }
 }
 render(await request("status"));
}
async function work(fn){
 if(busy)return;
 busy=true;controls();
 try{await fn()}catch(e){const m={LOGIN_REQUIRED:"Войди в аккаунт на этом сайте.",
 OWNER_TEST_ONLY:"Тест доступен только владельцу.",
 INSUFFICIENT_TEST_BALANCE:"Недостаточно тестовых рублей.",
 WALLET_TEST_TEMPORARILY_UNAVAILABLE:"Сервис пока недоступен."};
 msg(m[e?.message]||"Не удалось выполнить тестовую операцию.",true)}
 finally{busy=false;controls()}
}
async function open(){
 const d=panel();if(!d.open)d.showModal();
 await work(async()=>{await load();msg("Тестовый кошелёк готов.")});
}
async function identify(){
 try{const data=await request("status");owner=data.test===true;if(owner)render(data)}catch(_){owner=false;}
 let tile=$("numi-owner-wallet-tile");
 if(owner && !tile){
  const nav=document.querySelector("#account-overview .account-tiles.account-navigation");
  if(nav){
   tile=document.createElement("button");tile.id="numi-owner-wallet-tile";tile.type="button";tile.className="account-tile";
   const i=document.createElement("span");i.className="account-tile-icon";i.textContent="₽";
   const b=document.createElement("strong");b.textContent="Тестовый кошелёк";
   const s=document.createElement("small");s.textContent="Баланс и покупки";
   tile.append(i,b,s);nav.append(tile);
   tile.addEventListener("click",()=>{selected=false;void open()});
  }
 }
 if(tile)tile.hidden=!owner;
 return owner;
}
document.addEventListener("click",event=>{
 const target=event.target.closest?.('#redflag article.redflag-question.is-calculated[data-question-id="generosity"] > button.redflag-question-toggle');
 if(!owner || !target)return;
 event.preventDefault();event.stopImmediatePropagation();selected=true;void open();
},true);
document.addEventListener("click",event=>{
 if(event.target.closest?.("[data-open-redflag]"))void identify();
});
const profile=$("account-profile");
if(profile)new MutationObserver(()=>{if(!profile.hidden)void identify()})
 .observe(profile,{attributes:true,attributeFilter:["hidden"]});
void identify().then(ok=>{
 if(ok && paymentRef){
  selected=new URL(location.href).searchParams.get("question")==="money:generosity";
  void open();
 }
});
})();
