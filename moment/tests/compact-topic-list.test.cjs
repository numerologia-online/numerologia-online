"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
class Element {
 constructor(id){this.id=id;this.hidden=id==="questions-panel"||id==="show-all";this.value="";this.style={};this.listeners={};this.children=[];this.textContent="";this.attributes={};}
 addEventListener(type,handler){(this.listeners[type]||=[]).push(handler)}
 fire(type,event={}){for(const fn of this.listeners[type]||[])fn(event)}
 setAttribute(name,value){this.attributes[name]=value}
 append(...children){this.children.push(...children)}
 replaceChildren(...children){this.children=children}
 scrollIntoView(){this.scrolled=true}
 focus(){}
 reset(){}
}
const ids=["category-grid","question-list","question-search","clear-search","results-title","results-message","show-more","show-all","questions-panel","question-dialog","moment-form","partner-field","event-field","custom-question-wrap","custom-mode-field","form-error","close-dialog","ask-own","birth-one","birth-two","event-date","moment-confirmation","question-title","question-topic","moment-clock-label","ask-another","confirmed-question","confirmed-time","custom-question"];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
const headings=Object.fromEntries([".explore .section-heading",".moment-back-button"].map(s=>[s,new Element(s)]));
const doc={getElementById:id=>elements[id],querySelector:selector=>headings[selector],createElement:tag=>new Element(tag),body:new Element("body")};
const catalog=JSON.parse(fs.readFileSync("moment/questions.json","utf8"));
const source=fs.readFileSync("moment/moment.js","utf8");
const ctx={document:doc,window:{matchMedia:()=>({matches:true})},fetch:async()=>({ok:true,json:async()=>catalog}),URLSearchParams,location:{search:""},Date,Intl,console};
vm.runInNewContext(source,ctx,{filename:"moment.js"});
(async()=>{
  await new Promise(resolve=>setImmediate(resolve));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(elements["category-grid"].children.length,12,"Exactly 12 selectable topics, no All Topics");
  assert(!elements["category-grid"].children.some(x=>x.children.some(y=>y.textContent==="Все темы")),"All topics tile absent");
  assert.equal(elements["questions-panel"].hidden,true,"All questions hidden before selection");
  elements["category-grid"].children[0].fire("click");
  assert.equal(elements["questions-panel"].hidden,false,"Selected topic reveals questions");
  assert.equal(elements["category-grid"].hidden,true,"Topic grid hidden when answering");
  assert.equal(elements["question-list"].children.length,12,"First 12 of 25 topic questions shown");
  assert.equal(elements["show-all"].hidden,false,"Back button shown");
  elements["show-all"].fire("click");
  assert.equal(elements["questions-panel"].hidden,true,"Back hides question panel");
  assert.equal(elements["category-grid"].hidden,false,"Back restores topic list");
  assert.equal(catalog.questions.length,300,"All 300 source questions are intact");
  console.log("PASS: 12 stacked topics, no All Topics, questions only on selection, Back restores list");
})().catch(error=>{console.error(error);process.exitCode=1});
