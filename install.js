(() => {
"use strict";
const modal=document.getElementById("install-nudge");if(!modal)return;
const action=document.getElementById("install-action"),close=document.getElementById("install-dismiss"),later=document.getElementById("install-later"),guide=document.getElementById("install-guide"),visual=document.getElementById("install-visual"),progress=document.getElementById("install-progress"),caption=document.getElementById("install-step-caption"),title=document.getElementById("install-title"),copy=document.getElementById("install-copy");
const ua=navigator.userAgent||"",ios=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1),safari=ios&&/Safari/.test(ua)&&!/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua),key="numerologia-install-invite-v2";
let promptEvent=null,step=0,visible=false,previousFocus=null;
const installed=()=>window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const expires=()=>{try{const v=localStorage.getItem(key);return v==="installed"?Infinity:Number(v||0)}catch{return 0}};
const mute=days=>{try{localStorage.setItem(key,days===Infinity?"installed":String(Date.now()+days*86400000))}catch{}};
function hide(days=21){mute(days);modal.hidden=true;visible=false;if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true})}
function canShow(){return !installed()&&Date.now()>=expires()&&(!location.hash||location.hash==="#home")&&(navigator.maxTouchPoints>0||/iPhone|iPad|Android/.test(ua))&&innerWidth<=1100}
const shareIcon='<svg viewBox="0 0 80 80" class="install-share-icon" aria-hidden="true"><rect x="15" y="26" width="50" height="47" rx="11" fill="#e5f0ff" stroke="#4a83cc" stroke-width="3"/><path d="M40 51V8m0 0L27 21M40 8l13 13" fill="none" stroke="#347ed8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const houseIcon='<svg viewBox="0 0 45 45" width="36" height="36" aria-hidden="true" fill="none" stroke="#3b618a" stroke-width="2.3" stroke-linejoin="round"><path d="M7 21 22 9l16 12v18H7V21z"/><path d="M18 39V26h9v13M35 4v11M29 9h12"/></svg>';
function draw(){
guide.hidden=step===0;visual.replaceChildren();progress.replaceChildren();
if(step===0){title.textContent="Добавь меня на экран Домой ♡";copy.textContent="Матрица, прогнозы и добрые подсказки всегда под рукой.";action.textContent=promptEvent?"Добавить на телефон":"Показать, как добавить";later.textContent="Не сейчас";return}
title.textContent="Шаг "+step+" из 3";copy.textContent="";action.textContent=step===3?"Понятно ♡":"Дальше";later.textContent="Позже";
for(let n=1;n<=3;n++){const d=document.createElement("span");d.className="install-progress-dot"+(n<=step?" is-on":"");progress.append(d)}
if(step===1){visual.innerHTML=ios?shareIcon:'<span class="install-menu-dots">⋮</span>';caption.textContent=safari?'Нажми «Поделиться» в Safari':ios?'Открой сайт в Safari и нажми «Поделиться»':'Открой меню браузера ⋮';return}
if(step===2){const row=document.createElement("div");row.className="install-menu-preview";row.innerHTML=ios?houseIcon:'<span class="install-menu-dots">+</span>';const lbl=document.createElement("strong");lbl.textContent=ios?"На экран Домой":"Установить приложение";row.append(lbl);visual.append(row);caption.textContent="Выбери этот пункт";return}
const pane=document.createElement("div");pane.className="install-final-preview";pane.innerHTML='<img src="favicon.svg?v=2" width="43" height="43" alt=""><span>Нумерология Онлайн</span><b>Добавить</b>';visual.append(pane);caption.textContent="Нажми «Добавить» вверху экрана";
}
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();promptEvent=event;if(visible&&step===0)draw()});
window.addEventListener("appinstalled",()=>{promptEvent=null;visible?hide(Infinity):mute(Infinity)});
function show(){if(!canShow()||visible)return;visible=true;step=0;previousFocus=document.activeElement;draw();modal.hidden=false;close.focus({preventScroll:true})}
action.addEventListener("click",async()=>{if(step===0&&promptEvent){const p=promptEvent;promptEvent=null;try{await p.prompt();const response=await p.userChoice;hide(response.outcome==="accepted"?Infinity:21)}catch{step=1;draw()}return}if(step===3){hide();return}step++;draw();action.focus({preventScroll:true})});
close.addEventListener("click",()=>hide());later.addEventListener("click",()=>hide());modal.addEventListener("click",e=>{if(e.target===modal)hide()});
document.addEventListener("keydown",e=>{if(!visible)return;if(e.key==="Escape"){hide();return}if(e.key!=="Tab")return;const a=[close,action,later].filter(el=>el.offsetParent!==null);if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a[a.length-1].focus()}else if(!e.shiftKey&&document.activeElement===a[a.length-1]){e.preventDefault();a[0].focus()}});
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}),{once:true});
window.addEventListener("load",()=>setTimeout(show,1500),{once:true});
})();
