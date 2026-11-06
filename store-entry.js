/* All existing offers enter the same basket. No payment or access is granted here. */
let loading;
export function storeDate(value){
  if(typeof value!=='string')return undefined;
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  return match?`${match[3]}-${match[2]}-${match[1]}`:undefined;
}
export async function openStore(item,plan='once'){
  if(!window.NumiStore){
    loading ||= new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='/store-browser.js?v=2';
      script.onload=resolve;script.onerror=()=>{loading=null;script.remove();reject(new Error('STORE_UNAVAILABLE'));};document.head.append(script);
    });
    await loading;
  }
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  const items=plan==='club'?[{product_code:'club_month'},...(item?.product_code&&item.product_code!=='club_month'?[item]:[])]:item?[item]:[];
  return window.NumiStore.open({item:items[0],addItems:items});
}
