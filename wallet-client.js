/* Direct paid access to one selected digital item. There is no cart. */
const API="/api/numi-account.php";
const pending=new Map();
const rub=kopeks=>(Number(kopeks)/100).toLocaleString("ru-RU",{maximumFractionDigits:2})+" ₽";
export async function walletRequest(action,payload={}){
  const response=await fetch(API,{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});
  let data;try{data=await response.json();}catch(_){throw new Error("SERVICE_UNAVAILABLE");}
  if(!response.ok||data.ok!==true)throw new Error(data.error||"SERVICE_UNAVAILABLE");
  return data;
}
export async function walletMaterial(id){
  const data=await walletRequest("material",{entitlement_id:id});
  if(!data.material||!Array.isArray(data.material.sections))throw new Error("MATERIAL_NOT_READY");
  return data.material;
}
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function action(container,label,callback){
  const b=el("button",label);b.type="button";b.className="numi-inline-purchase-button";
  b.style.cssText="margin:9px 0;padding:9px 15px;max-width:100%;background:#234d3d;color:white;border:0;border-radius:12px;font:600 14px/1.3 system-ui;cursor:pointer";
  b.addEventListener("click",callback);container.append(b);return b;
}
function note(container,message){container.replaceChildren(el("p",message));}
function openAccount(){const button=document.querySelector('[data-account-open="profile"]');if(button)button.click();else location.assign("/?account=1");}
function explain(container,err){
  const error=String(err?.message||"");
  if(error==="LOGIN_REQUIRED"){
    note(container,"Войдите в личный кабинет, чтобы открыть ответ.");
    action(container,"Войти",openAccount);return;
  }
  if(error==="INSUFFICIENT_BALANCE"){
    note(container,"Недостаточно средств на балансе.");
    action(container,"Пополнить баланс",openAccount);return;
  }
  if(error==="ITEM_ALREADY_OWNED"){
    note(container,"Ответ уже куплен. Нажмите на вопрос ещё раз.");return;
  }
  if(["MATERIAL_NOT_READY","ITEM_NOT_READY","UNKNOWN_QUESTION"].includes(error)){
    note(container,"Этот материал ещё готовится. Деньги не списаны.");return;
  }
  note(container,"Не получилось открыть ответ. Повторите попытку: повторное нажатие не создаст новое списание.");
}
// A comparison price is marketing information only; wallet_buy prices independently.
function clubOffer(container,quote,item,onMaterial){
  const regular=Number(quote.regular_price_kopeks);
  const club=Number(quote.club_price_kopeks);
  if(quote.club_active===true||quote.kind==="subscription"
    ||!Number.isSafeInteger(regular)||!Number.isSafeInteger(club)||club<=0||regular<=club)return;
  const subscription=Number(quote.club_subscription_price_kopeks);
  const message="С клубом этот материал стоит "+rub(club)+
    (Number.isSafeInteger(subscription)&&subscription>0
      ? ". Клуб — "+rub(subscription)+"/мес.":".");
  const hint=el("p",message);
  hint.style.cssText="margin:7px 0 3px;font:13px/1.5 system-ui;color:#5e6963";
  container.append(hint);
  const join=action(container,"Вступить в клуб",async()=>{
    join.disabled=true;
    try{
      const {openStore}=await import("/store-entry.js?v=club-prices1");
      await openStore({product_code:"club_month"});
    }catch(_){
      hint.textContent="Не удалось открыть подписку. Попробуйте ещё раз.";
    }finally{join.disabled=false;}
  });
  join.style.cssText="background:transparent;border:0;padding:3px 0;color:#245f47;text-decoration:underline;font:600 13px system-ui;cursor:pointer";
  // Reprice only after the subscription was confirmed, without closing this question.
  window.addEventListener("numi:club-activated",()=>{
    if(container.isConnected)void showInlinePurchase(item,container,onMaterial);
  },{once:true});
}
function keyFor(item){return JSON.stringify(item);}
export async function showInlinePurchase(item,container,onMaterial){
  if(!container||typeof onMaterial!=="function")throw new Error("INVALID_PURCHASE_TARGET");
  note(container,"Проверяем доступ и баланс…");
  let quote;
  try{quote=await walletRequest("wallet_quote",{item});}catch(e){explain(container,e);return;}
  if(quote.test!==true){note(container,"Покупка пока недоступна.");return;}
  if(quote.owned===true&&quote.entitlement_id){
    try{const material=await walletMaterial(quote.entitlement_id);onMaterial(material,quote.entitlement_id);}catch(e){explain(container,e);}
    return;
  }
  if(quote.member_included===true){
    note(container,"Ответ включён в подписку. Откройте вопрос через раздел «Да или нет».");
    return;
  }
  if(quote.ready!==true){note(container,"Этот материал ещё готовится. Деньги не списаны.");return;}
  const amount=Number(quote.price_kopeks);
  if(!Number.isSafeInteger(amount)||amount<=0){note(container,"Не удалось проверить стоимость.");return;}
  if(Number(quote.balance_kopeks)<amount){
    note(container,"Для ответа нужно "+rub(amount)+". На балансе "+rub(quote.balance_kopeks)+".");
    action(container,"Пополнить баланс",openAccount);
    clubOffer(container,quote,item,onMaterial);
    return;
  }
  const regular=Number(quote.regular_price_kopeks);
  const isClubDeal=quote.club_active===true&&regular>amount;
  container.replaceChildren(el("p",isClubDeal
    ? "Ваша цена по клубу: "+rub(amount)+" (обычно "+rub(regular)+")."
    : "Стоимость ответа: "+rub(amount)+"."));
  const buyButton=action(container,(quote.kind==="subscription"?"Подключить подписку за ":"Открыть за ")+rub(amount),async function(){
    this.disabled=true;
    const id=keyFor(item);
    let key=pending.get(id);
    if(!key){key=crypto.randomUUID();pending.set(id,key);}
    note(container,"Открываем оплаченный ответ…");
    try{
      const result=await walletRequest("wallet_buy",{item,request_key:key});
      if(result.test!==true||!result.entitlement_id)throw new Error("INVALID_PURCHASE_RESULT");
      window.dispatchEvent(new Event("numi:wallet-updated"));
      const material=await walletMaterial(result.entitlement_id);
      pending.delete(id);
      onMaterial(material,result.entitlement_id);
    }catch(e){
      explain(container,e);
      // On ambiguous failure, preserve idempotency key to prevent duplicate charges.
      if(e.message==="SERVICE_UNAVAILABLE"||e.message==="MATERIAL_NOT_READY"){
        action(container,"Повторить без нового списания",()=>showInlinePurchase(item,container,onMaterial));
      }
    }
  });
  clubOffer(container,quote,item,onMaterial);
}
export function renderInlineMaterial(container,material){
  container.replaceChildren();
  for(const section of material.sections||[]){
    if(section.title)container.append(el("strong",section.title));
    for(const paragraph of section.paragraphs||[])container.append(el("p",paragraph));
  }
}
