/* One Club checkout for every section. Uses the existing verified account and wallet API. */
import {walletRequest} from "/wallet-client.js?v=club-balance-20261126";
const PRODUCT=Object.freeze({product_code:"club_month"});
const RETURN_KEY="numi-club-topup-return-v1";
const ID=/^[a-f0-9-]{36}$/i;
const rub=n=>(n/100).toLocaleString("ru-RU",{maximumFractionDigits:2})+" ₽";
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const signed=()=>{const value=window.Telegram?.WebApp?.initData;if(typeof value==="string"&&value)return value;try{return new URLSearchParams(location.hash.slice(1)).get("tgWebAppData")||"";}catch(_){return "";}};
const isTelegram=()=>Boolean(signed()||window.TelegramWebviewProxy||window.webkit?.messageHandlers?.TelegramWebviewProxy||(window.Telegram?.WebApp?.platform&&window.Telegram.WebApp.platform!=="unknown"));
function storageGet(key){try{return sessionStorage.getItem(key);}catch(_){return null;}}
function storageSet(key,value){try{sessionStorage.setItem(key,value);}catch(_){}}
function storageRemove(key){try{sessionStorage.removeItem(key);}catch(_){}}
const pending=new Map();
function purchaseKey(accountId){const key="numi-club-wallet-purchase-"+accountId;let value=pending.get(key)||storageGet(key);if(!ID.test(value||""))value=crypto.randomUUID();pending.set(key,value);storageSet(key,value);return {key,value};}
function clearKey(key){pending.delete(key);storageRemove(key);}
export async function readClub(request=walletRequest){
  // When Telegram provides launch credentials, the server verifies them. Never use an unsigned ID.
  const raw=signed();
  if(raw)await request("telegram",{init_data:raw});
  const session=await request("session");
  if(session.authenticated!==true||!session.account?.id)throw Error("LOGIN_REQUIRED");
  const accountId=String(session.account.id);
  const wallet=await request("wallet_status");
  const balance=Number(wallet.balance_kopeks);
  if(typeof wallet.test!=="boolean"||!integer(balance)||typeof wallet.club_active!=="boolean")throw Error("WALLET_UNAVAILABLE");
  const expires=wallet.club_expires_at||wallet.subscriptions?.find(s=>s.product_code==="club_month"&&s.active===true)?.expires_at||null;
  if(wallet.club_active)return {accountId,balance,active:true,expires,test:wallet.test};
  const quote=await request("wallet_quote",{item:PRODUCT});
  if(quote.test!==wallet.test||quote.kind!=="subscription"||quote.product_code!=="club_month")throw Error("QUOTE_UNAVAILABLE");
  const amount=Number(quote.price_kopeks),available=Number(quote.balance_kopeks);
  if(!integer(available))throw Error("WALLET_UNAVAILABLE");
  if(quote.club_active===true)return {accountId,balance:available,active:true,expires,test:wallet.test};
  if(quote.ready!==true||!integer(amount)||amount===0)throw Error("QUOTE_UNAVAILABLE");
  return {accountId,balance:available,amount,missing:Math.max(0,amount-available),active:false,test:wallet.test};
}
export async function confirmClub(state,request=walletRequest){
  if(!state||state.active||state.missing!==0||!integer(state.amount)||state.amount===0||state.balance<state.amount)throw Error("NOT_CONFIRMED");
  const session=await request("session");
  if(session.authenticated!==true||String(session.account?.id)!==state.accountId)throw Error("ACCOUNT_CHANGED");
  const {key,value}=purchaseKey(state.accountId);
  try{
    const result=await request("wallet_buy",{item:PRODUCT,request_key:value,expected_price_kopeks:state.amount});
    if(result.test!==state.test||!result.entitlement_id)throw Error("PURCHASE_UNCONFIRMED");
    clearKey(key);
    return result;
  }catch(e){
    if(["REAL_PRICE_CHANGED","REAL_INSUFFICIENT_BALANCE","INSUFFICIENT_BALANCE","REAL_ALREADY_PURCHASED","ITEM_ALREADY_OWNED"].includes(e.message))clearKey(key);
    throw e;
  }
}
let modal,body,close,version=0,busy=false;
function ensureModal(){
  if(modal?.isConnected)return;
  const style=el("style");style.textContent="#numi-club-checkout{box-sizing:border-box;width:min(420px,calc(100vw - 28px));max-width:100%;max-height:calc(100dvh - 28px);margin:auto;padding:20px;border:1px solid #d6c6a5;border-radius:22px;background:#fffefa;color:#173e31;font:400 15px/1.5 system-ui;overflow:auto;text-align:left}#numi-club-checkout::backdrop{background:#173e3177}#numi-club-checkout *{box-sizing:border-box}#numi-club-checkout .ncc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px}#numi-club-checkout h2{color:#173e31;font:400 33px/1.1 Georgia,serif;margin:0}#numi-club-checkout .ncc-close{display:grid;place-items:center;width:44px;height:44px;min-width:44px;padding:0;border:1px solid #d1dbcc;border-radius:50%;background:#fff;color:#173e31;font:400 28px/1 system-ui}#numi-club-checkout p{margin:0 0 12px;color:#234839}#numi-club-checkout .ncc-price{font:650 21px/1.3 system-ui}#numi-club-checkout .ncc-balance{display:grid;gap:2px;background:#edf3eb;border:1px solid #d6e0d2;border-radius:13px;padding:13px 15px;margin:0 0 15px}#numi-club-checkout .ncc-balance small{color:#526f60;font-size:13px}#numi-club-checkout .ncc-balance strong{font:650 26px/1.25 system-ui}#numi-club-checkout .ncc-primary{width:100%;min-height:48px;padding:12px;border:0;border-radius:11px;background:#214b39;color:white;font:650 15px/1.35 system-ui;cursor:pointer}#numi-club-checkout .ncc-primary:disabled{opacity:.6}#numi-club-checkout .ncc-muted{font-size:12px;color:#526f60}";
  document.head.append(style);
  modal=el("dialog");modal.id="numi-club-checkout";modal.setAttribute("aria-labelledby","ncc-title");
  const head=el("div");head.className="ncc-head";
  const title=el("h2","Клуб");title.id="ncc-title";
  close=el("button","×");close.type="button";close.className="ncc-close";close.setAttribute("aria-label","Закрыть");
  close.addEventListener("click",()=>{if(!busy)modal.close();});
  modal.addEventListener("cancel",e=>{if(busy)e.preventDefault();});
  modal.addEventListener("close",()=>{version++;});
  body=el("div");body.setAttribute("aria-live","polite");head.append(title,close);modal.append(head,body);document.body.append(modal);
}
function button(label,fn){const b=el("button",label);b.type="button";b.className="ncc-primary";b.addEventListener("click",fn);body.append(b);return b;}
function text(message,cls){const p=el("p",message);if(cls)p.className=cls;body.append(p);return p;}
function showBalance(balance){const box=el("div");box.className="ncc-balance";box.append(el("small","Ваш текущий баланс"),el("strong",rub(balance)));body.append(box);}
function expiryLabel(raw){if(typeof raw!=="string")return "";const value=raw.includes("T")?raw:raw.replace(" ","T")+"Z";const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString("ru-RU",{timeZone:"UTC",day:"numeric",month:"long",year:"numeric"}):"";}
function openTopup(state){
  const amountRub=Math.ceil(state.missing/100);
  const event=new CustomEvent("numi:club-topup-open",{cancelable:true,detail:{accountId:state.accountId,amountRub}});
  if(!window.dispatchEvent(event)){modal.close();return;}
  // Existing standalone top-up screen for pages without the cabinet. No main-page redirect or credential in URL.
  storageSet(RETURN_KEY,JSON.stringify({accountId:state.accountId,path:location.pathname,amountRub,expires:Date.now()+30*60*1000}));
  location.assign("/wallet-topup.html?club=1");
}
function render(state){
  body.replaceChildren();
  if(state.test)text("Тестовый режим · без настоящих списаний","ncc-muted");
  if(state.active){
    showBalance(state.balance);
    const until=expiryLabel(state.expires);
    text("Клуб уже подключён"+(until?" до "+until:"")+".");
    button("Готово",()=>modal.close());return;
  }
  text(rub(state.amount)+" в месяц","ncc-price");showBalance(state.balance);
  if(state.missing>0){
    text("Для подключения Клуба необходимо пополнить баланс ещё на "+rub(state.missing)+".");
    button("Пополнить баланс",()=>openTopup(state));return;
  }
  text("На балансе достаточно средств для подключения Клуба.");
  text("Оплата с баланса за один месяц. Автопродление не включается.","ncc-muted");
  button("Подключить Клуб за "+rub(state.amount),async()=>{
    if(busy)return;busy=true;close.disabled=true;
    const token=version;body.replaceChildren(el("p","Подключаем Клуб…"));
    try{
      await confirmClub(state);
      window.dispatchEvent(new Event("numi:wallet-updated"));
      window.dispatchEvent(new Event("numi:club-activated"));
      if(token!==version||!modal.open)return;
      body.replaceChildren(el("p","Подписка оплачена. Проверяем срок действия…"));
      try{const updated=await readClub();if(token===version&&modal.open)render(updated);}
      catch(_){if(token===version&&modal.open){body.replaceChildren(el("p","Подписка оплачена. Статус можно проверить в личном кабинете."));button("Готово",()=>modal.close());}}
    }catch(e){
      if(token!==version||!modal.open)return;
      if(["REAL_PRICE_CHANGED","REAL_INSUFFICIENT_BALANCE","INSUFFICIENT_BALANCE","REAL_ALREADY_PURCHASED","ITEM_ALREADY_OWNED","ACCOUNT_CHANGED"].includes(e.message)){
        await load(token);return;
      }
      body.replaceChildren(el("p","Не удалось подтвердить результат оплаты. Повторная проверка не создаст новое списание."));
      button("Проверить подписку и баланс",()=>load(token));
    }finally{busy=false;close.disabled=false;}
  });
}
async function load(token){
  body.replaceChildren(el("p","Проверяем подписку и баланс…"));
  try{const state=await readClub();if(token===version&&modal.open)render(state);}
  catch(e){
    if(token!==version||!modal.open)return;
    body.replaceChildren();
    if(e.message==="LOGIN_REQUIRED"&&!isTelegram()){
      text("Войдите в личный кабинет, чтобы проверить баланс.");
      button("Войти в личный кабинет",()=>{modal.close();const b=document.querySelector('[data-account-open="profile"]');if(b)b.click();else location.assign("/?account=1");});
      return;
    }
    text(isTelegram()&&(e.message==="LOGIN_REQUIRED"||e.message==="TELEGRAM_INVALID")?"Не удалось подтвердить вход через Telegram. Откройте мини-приложение заново или повторите проверку.":"Не удалось проверить баланс. Деньги не списаны при проверке.");
    button("Повторить проверку",()=>load(token));
  }
}
export async function openClubCheckout(){
  ensureModal();if(modal.open)return;
  const token=++version;modal.showModal();await load(token);
}
// Keep old links and cached buttons working without a navigation away from the product.
document.addEventListener("click",event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const target=event.target?.closest?.("a,button");if(!target)return;
  let match=target.matches("[data-numi-club-checkout],#pro-paywall-club,#money-club-join");
  if(target.tagName==="A"){try{const u=new URL(target.href,location.href);match=match||(u.origin===location.origin&&u.searchParams.get("club_offer")==="1");}catch(_){}}
  if(target.matches(".numi-inline-purchase-button,#account-dialog [data-account-content='prices'] .account-primary")){
    match=match||/^(Подключить Клуб|Вступить в клуб)(?:\s*·.*)?$/i.test(target.textContent.trim());
  }
  if(!match)return;
  event.preventDefault();event.stopImmediatePropagation();void openClubCheckout();
},true);
if(new URLSearchParams(location.search).get("club_offer")==="1"){
  const url=new URL(location.href);url.searchParams.delete("club_offer");url.searchParams.delete("account");
  history.replaceState(null,"",url.pathname+url.search+url.hash);
  void openClubCheckout();
}
