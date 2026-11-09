/* Legacy links now open ONE selected material directly; no cart is loaded. */
import {showInlinePurchase,renderInlineMaterial,walletRequest,walletMaterial} from "./wallet-client.js?v=redflag-status-fix-20261109";
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
      host.replaceChildren(text);
      if(target.product_code==="club_month")window.dispatchEvent(new Event("numi:club-activated"));
      return;
    }
    try{
      const {openMaterial}=await import("/store-material.js?v=2");
      await openMaterial(host,id);
    }catch(_){renderInlineMaterial(host,material);}
  });
}

// Recognize an account-owned report by its exact server-calculated resource
// (birth date / report year / both partner dates). Never cache access in the
// browser; each recalculation and revisit verifies the still-active entitlement.
const REPORTS=new Set(["year_full","life_full","compatibility_full","child_full_v1"]);
export async function recognizePurchasedReport(item,region){
  if(!region||!REPORTS.has(item?.product_code))return null;
  const key=JSON.stringify(item);
  region.dataset.numiReportKey=key;
  region.hidden=true;
  region.replaceChildren();
  try{
    const quote=await walletRequest("wallet_quote",{item});
    if(region.dataset.numiReportKey!==key)return null;
    if(quote.owned!==true || quote.product_code!==item.product_code ||
       !/^[a-f0-9-]{36}$/i.test(String(quote.entitlement_id||"")))return null;
    const doc=await walletMaterial(quote.entitlement_id);
    if(region.dataset.numiReportKey!==key)return null;
    if(!Array.isArray(doc.sections)||doc.sections.length<1)return null;
    region.hidden=false;
    const line=document.createElement("p");
    line.style.cssText="margin:15px 0;padding:14px;border:1px solid #ab926b;border-radius:12px;background:#f6f1e6;color:#354536;text-align:center;font:700 16px/1.5 system-ui";
    const expiry=typeof quote.expires_at==="string" ? new Date(quote.expires_at.replace(" ","T")+"Z") : null;
    const valid=expiry&&Number.isFinite(expiry.getTime());
    line.textContent="✓ Этот разбор уже оплачен"+(valid?". Доступ до "+expiry.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"})+".":".");
    const content=document.createElement("section");
    content.style.cssText="margin:12px 0 24px;max-width:100%;overflow-wrap:anywhere";
    region.replaceChildren(line,content);
    // The original page now shows the server-protected purchased material,
    // with its own PDF action. No personal report or entitlement is persisted.
    const {openMaterial}=await import("/store-material.js?v=2");
    if(region.dataset.numiReportKey!==key)return null;
    await openMaterial(content,quote.entitlement_id);
    if(region.dataset.numiReportKey!==key)return null;
    return {entitlement_id:quote.entitlement_id,expires_at:quote.expires_at,material:doc};
  }catch(_){
    if(region.dataset.numiReportKey===key)region.hidden=true;
    return null;
  }
}
