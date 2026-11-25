const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const listeners={};
const frames=[];
class Input {
  constructor(value){this.value=value;this.type="text";this.placeholder="ДД.ММ.ГГГГ";this.selectionStart=0;this.selectionEnd=0;this.selectionDirection="none";}
  setSelectionRange(a,b,d="none"){this.selectionStart=a;this.selectionEnd=b;this.selectionDirection=d;}
  setRangeText(s,a,b){this.value=this.value.slice(0,a)+s+this.value.slice(b);this.setSelectionRange(a+s.length,a+s.length);}
  dispatchEvent(e){e.target=this;listeners[e.type](e);this.value=this.value.replace(/\D/g,"").match(/.{1,2}/g).slice(0,2).join(".")+"."+this.value.replace(/\D/g,"").slice(4);this.setSelectionRange(this.value.length,this.value.length);}
}
const document={addEventListener:(type,fn)=>listeners[type]=fn,activeElement:null};
const window={};
vm.runInNewContext(fs.readFileSync("assets/numi-date-fields.js","utf8"),{window,document,HTMLInputElement:Input,Event:class{constructor(type){this.type=type;}},requestAnimationFrame:fn=>frames.push(fn),Intl,Date,Number,Object,WeakMap});
const {isAdult,isChild}=window.numiDateFields;
const t=new Date("2026-11-25T09:00:00Z");
for(const [b,a,c] of [
 [{year:2008,month:11,day:24},true,false],
 [{year:2008,month:11,day:25},true,false],
 [{year:2008,month:11,day:26},false,true],
 [{year:2026,month:11,day:25},false,true],
 [{year:2026,month:11,day:26},false,false],
 [{year:2008,month:2,day:30},false,false]
]){assert.equal(isAdult(b,t),a);assert.equal(isChild(b,t),c);}
const input=new Input("09.09.1986");document.activeElement=input;input.setSelectionRange(4,4);
let prevented=false;
listeners.beforeinput({target:input,cancelable:true,inputType:"insertText",data:"8",preventDefault(){prevented=true;}});
while(frames.length)frames.shift()();
assert.equal(prevented,true);assert.equal(input.value,"09.08.1986");assert.equal(input.selectionStart,6);
console.log("AGE_BOUNDARY_AND_MIDDLE_DIGIT_PASS");
