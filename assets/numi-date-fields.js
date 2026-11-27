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
    (/^ДД[.\s]ММ[.\s]ГГГГ$/i.test(t.placeholder||"")||t.autocomplete==="bday");
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
  // A full date is a fixed-width field. Replace a single digit in place,
  // instead of inserting a ninth digit that maxlength silently rejects.
  function overwrite(el, value) {
    if(!field(el)||!/^\d$/.test(value)||!/^\d{2}\.\d{2}\.\d{4}$/.test(el.value))return false;
    let a=el.selectionStart,b=el.selectionEnd;
    if(a===null||b===null||a>=el.value.length)return false;
    if(a===b&&el.value[a]==="."){a++;b++;}
    if(a>=el.value.length||!/^\d$/.test(el.value[a]))return false;
    if(a!==b&&b-a!==1)return false;
    el.setRangeText(value,a,a+1,"end");
    let next=a+1;
    if(el.value[next]===".")next++;
    const expected=el.value;
    el.setSelectionRange(next,next);
    el.dispatchEvent(new Event("input",{bubbles:true}));
    if(el.value===expected)el.setSelectionRange(next,next);
    requestAnimationFrame(()=>{
      if(document.activeElement===el&&el.value===expected)el.setSelectionRange(next,next);
    });
    return true;
  }
  document.addEventListener("beforeinput",event=>{
    if(!event.cancelable||event.isComposing||!["insertText","insertReplacementText"].includes(event.inputType))return;
    if(overwrite(event.target,event.data||""))event.preventDefault();
  },true);
  // Desktop hardware keyboards can block beforeinput on a maxlength field.
  document.addEventListener("keydown",event=>{
    if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||!event.cancelable)return;
    if(overwrite(event.target,event.key||""))event.preventDefault();
  },true);
  window.numiDateFields=Object.freeze({isAdult,isChild});
})();