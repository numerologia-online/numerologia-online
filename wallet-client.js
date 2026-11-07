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
function openAccount(){document.querySelector('[data-account-open="profile"]')?.click();}
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
function keyFor(item){return JSON.stringify(item);}
export async function showInlinePurchase(item,container,onMaterial){
  if(!container||typeof onMaterial!=="function")throw new Error("INVALID_PURCHASE_TARGET");
  note(container,"Проверяем доступ и баланс…");
  let quote;
  try{quote=await walletRequest("wallet_quote",{item});}catch(e){explain(container,e);return;}
  if(quote.test!==true){note(container,"Покупка пока недоступна.");return;}
  if(quote.owned===true&&quote.entitlement_id){
    try{const material=await walletMaterial(quote.entitlement_id);onMaterial(material);}catch(e){explain(container,e);}
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
    action(container,"Пополнить баланс",openAccount);return;
  }
  container.replaceChildren(el("p","Стоимость ответа: "+rub(amount)+"."));
  action(container,"Открыть за "+rub(amount),async function(){
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
      onMaterial(material);
    }catch(e){
      explain(container,e);
      // On ambiguous failure, preserve idempotency key to prevent duplicate charges.
      if(e.message==="SERVICE_UNAVAILABLE"||e.message==="MATERIAL_NOT_READY"){
        action(container,"Повторить без нового списания",()=>showInlinePurchase(item,container,onMaterial));
      }
    }
  });
}
export function renderInlineMaterial(container,material){
  container.replaceChildren();
  for(const section of material.sections||[]){
    if(section.title)container.append(el("strong",section.title));
    for(const paragraph of section.paragraphs||[])container.append(el("p",paragraph));
  }
}
