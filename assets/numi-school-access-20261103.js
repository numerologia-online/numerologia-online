// One server-verified owner exception; public flags and URL parameters never grant access.
let access;
export function schoolAccess() {
  if (!access) access = fetch('/api/numi-school.php', {
    method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'session',init_data:window.Telegram?.WebApp?.initData||''})
  }).then(async response => {if(!response.ok) throw Error('ACCESS_CHECK_FAILED');const value=await response.json();return value.ok===true&&(value.owner===true||value.access===true);}).catch(()=>false);
  return access;
}
async function showOffer() {
  let dialog=document.getElementById('school-subscription-dialog');
  if (!dialog) {
    const response=await fetch('/api/numi-school.php?offer=1',{cache:'no-store',credentials:'same-origin'});
    if (!response.ok) throw Error('OFFER_UNAVAILABLE');
    const source=new DOMParser().parseFromString(await response.text(),'text/html').querySelector('.school-subscription-offer');
    if (!source) throw Error('OFFER_UNAVAILABLE');
    dialog=document.createElement('dialog');dialog.id='school-subscription-dialog';dialog.className='school-access-dialog';dialog.setAttribute('aria-labelledby','school-subscription-title');
    const close=document.createElement('button');close.type='button';close.className='school-access-close';close.textContent='×';close.setAttribute('aria-label','Закрыть окно');close.addEventListener('click',()=>dialog.close());
    dialog.append(close,document.importNode(source,true));document.body.append(dialog);
    const back=dialog.querySelector('.school-access-back');back.addEventListener('click',event=>{event.preventDefault();dialog.close();});
  }
  if(!dialog.querySelector('[data-school-purchase]')){const buy=document.createElement('button');buy.type='button';buy.dataset.schoolPurchase='1';buy.textContent='Подписка 149 ₽ в неделю';buy.onclick=async()=>{const {openStore}=await import('/store-entry.js?v=2');await openStore({product_code:'school_week'});};dialog.append(buy);}
  if (!dialog.open) dialog.showModal();
}
const owner=schoolAccess();
if (document.body.classList.contains('school-access-page')) {
  owner.then(allowed=>{if(allowed&&location.pathname!=='/api/numi-school.php')location.reload();});
}
for (const link of document.querySelectorAll('a[data-school-entry]')) {
  link.addEventListener('click',async event=>{
    event.preventDefault();
    if (await owner) {location.assign(link.href);return;}
    try {await showOffer();}catch {location.assign(link.href);}
  });
}
owner.then(allowed=>{
  if (!allowed) return;
  for (const label of document.querySelectorAll('[data-school-lock]')) label.textContent='Открыть уроки →';
});
