/* Legacy links now open ONE selected material directly; no cart is loaded. */
import {showInlinePurchase,renderInlineMaterial} from "./wallet-client.js?v=direct1";
export function storeDate(value){
  if(typeof value!=="string")return undefined;
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  return match?match[3]+"-"+match[2]+"-"+match[1]:undefined;
}
export async function openStore(item,plan="once"){
  const target=plan==="club"?{product_code:"club_month"}:item;
  if(!target?.product_code)throw new Error("INVALID_ITEM");
  let offer=document.querySelector("#shared-paywall-dialog[open],#pro-paywall-dialog[open]");
  let host=offer?.querySelector("#numi-direct-offer");
  if(offer&&!host){
    host=document.createElement("section");host.id="numi-direct-offer";
    host.style.cssText="margin:12px 0;padding:12px;border:1px solid #d5cdc8;border-radius:12px;font:14px/1.5 system-ui";
    (offer.querySelector("#pro-paywall-checkout-note")||offer).insertAdjacentElement("afterend",host);
  }
  if(!host){
    // For older report buttons without an existing offer, use one small access dialog.
    offer=document.getElementById("numi-direct-access-dialog");
    if(!offer){
      offer=document.createElement("dialog");offer.id="numi-direct-access-dialog";
      offer.style.cssText="width:min(420px,calc(100vw - 30px));max-height:85dvh;overflow:auto;border-radius:15px;border:1px solid #d3c8c0;padding:18px;background:#f4f1f0;color:#343b39";
      const close=document.createElement("button");close.type="button";close.textContent="Закрыть";
      close.onclick=()=>offer.close();offer.append(close);document.body.append(offer);
    }
    host=document.createElement("section");offer.querySelector("section")?.remove();offer.append(host);
    if(!offer.open)offer.showModal();
  }
  await showInlinePurchase(target,host,async(material,id)=>{
    if(target.product_code==="club_month"||target.product_code==="school_week"){
      const text=document.createElement("p");
      text.textContent="Подписка активирована. Продление с баланса выполняется только вручную.";
      host.replaceChildren(text);return;
    }
    try{
      const {openMaterial}=await import("/store-material.js?v=2");
      await openMaterial(host,id);
    }catch(_){renderInlineMaterial(host,material);}
  });
}
