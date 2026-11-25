/* Preserve the current DD.MM.YYYY display and existing input handlers. */
(() => {
  "use strict";
  const key = ({year,month,day}) => year*10000+month*100+day;
  function todayParts(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone:"Europe/Moscow",year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(now).map(p=>[p.type,p.value]));
    return {year:Number(parts.year),month:Number(parts.month),day:Number(parts.day)};
  }
  function valid(b) {
    if (!b || ![b.year,b.month,b.day].every(Number.isInteger) || b.year<1900 || b.year>2099) return false;
    const d=new Date(Date.UTC(b.year,b.month-1,b.day));
    return d.getUTCFullYear()===b.year&&d.getUTCMonth()+1===b.month&&d.getUTCDate()===b.day;
  }
  function isAdult(b,now) {
    if(!valid(b))return false;
    const t=todayParts(now);
    return key(b)<=key({...t,year:t.year-18});
  }
  function isChild(b,now) {
    return valid(b)&&key(b)<=key(todayParts(now))&&!isAdult(b,now);
  }
  const digits=s=>s.replace(/\D/g,"");
  function position(s,n,atEnd=false) {
    if(atEnd)return s.length;
    if(n<=0)return 0;
    let seen=0;
    for(let i=0;i<s.length;i++){
      if(/\d/.test(s[i])&&++seen===n){
        let p=i+1;
        if(s[p]===".")p++;
        return p;
      }
    }
    return s.length;
  }
  const field=t=>t instanceof HTMLInputElement&&t.type==="text"&&
    (t.placeholder==="ДД.ММ.ГГГГ"||t.autocomplete==="bday");
  const pending=new WeakMap();
  document.addEventListener("input",event=>{
    const el=event.target;
    if(!field(el)||event.isComposing||el.selectionStart===null)return;
    const raw=el.value,start=el.selectionStart,end=el.selectionEnd;
    const expected=digits(raw).slice(0,8),token={};pending.set(el,token);
    const a=digits(raw.slice(0,start)).length,b=digits(raw.slice(0,end)).length;
    const direction=el.selectionDirection||"none";
    requestAnimationFrame(()=>{
      if(pending.get(el)!==token||document.activeElement!==el||digits(el.value)!==expected)return;
      try{el.setSelectionRange(position(el.value,a,start===raw.length),position(el.value,b,end===raw.length),direction);}catch(_){}
    });
  },true);
  // On a complete date, typing at a single caret overwrites the next digit.
  // Selecting one digit and replacing it continues to use native input.
  document.addEventListener("beforeinput",event=>{
    const el=event.target;
    if(!field(el)||!event.cancelable||event.isComposing||event.inputType!=="insertText"||
       !/^\d$/.test(event.data||"")||!/^\d{2}\.\d{2}\.\d{4}$/.test(el.value)||
       el.selectionStart!==el.selectionEnd)return;
    let p=el.selectionStart;
    if(p===null||p>=el.value.length)return;
    if(el.value[p]===".")p++;
    if(p>=el.value.length)return;
    event.preventDefault();
    el.setRangeText(event.data,p,p+1,"end");
    if(el.value[el.selectionStart]===".")el.setSelectionRange(el.selectionStart+1,el.selectionStart+1);
    el.dispatchEvent(new Event("input",{bubbles:true}));
  },true);
  window.numiDateFields=Object.freeze({isAdult,isChild});
})();