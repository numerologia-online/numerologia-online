import {numberMeaning,lifePath,parseClassicDate,analyzeName,personalYear} from "../classic-core.js?v=1";
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(text!==undefined)el.textContent=String(text);
 return el;
};
const ns="http://www.w3.org/2000/svg";
const S=(tag,attrs={})=>{
 const el=document.createElementNS(ns,tag);
 for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));
 return el;
};
const progressKey="numerologia-online-classic-progress-v1";
const id=new URLSearchParams(location.search).get("id")||"hello";
let manifest=[],activeIndex=-1;
function visual(data){
 const stage=data.id;
 const root=$("classic-lesson-visual");
 root.replaceChildren();
 const svg=S("svg",{viewBox:"0 0 720 220",role:"img"});
 const label=(x,y,text,size=18,color="#385477")=>{
   const el=S("text",{x,y,"text-anchor":"middle","dominant-baseline":"middle","font-size":size,"font-family":"system-ui","font-weight":750,fill:color});
   el.textContent=String(text);svg.append(el);
 };
 const rect=(x,y,w,h,color,rx=18)=>svg.append(S("rect",{x,y,width:w,height:h,rx,fill:color}));
 const circle=(x,y,r,color)=>svg.append(S("circle",{cx:x,cy:y,r,fill:color}));
 const bubble=(x,y,n,background,labelText)=>{
   circle(x,y,34,background);label(x,y+1,n,27);
   if(labelText)label(x,y+54,labelText,13,"#73808e");
 };
 if(stage==="hello"){
   for(let i=1;i<=9;i++){
     const x=46+(i-1)*78;circle(x,79,31,["#e4efff","#ffe9e5","#fff0d5","#e5f2e9","#ede8ff"][i%5]);
     label(x,80,i,33);label(x,151,numberMeaning[i].name,11,"#647487");
   }
 }else if(stage==="masters"){
   bubble(136,89,11,"#fce7e3","вдохновение");bubble(360,89,22,"#dff0eb","большое дело");bubble(584,89,33,"#ede8fa","наставничество");
 }else if(stage==="alphabet"||stage==="expression"||stage==="soul"||stage==="personality"){
   const name=analyzeName("АННА");
   const chars=name.letters;
   chars.forEach(({letter,number,vowel},i)=>{
     const x=120+i*135;
     rect(x-54,38,108,99,vowel?"#fcebd7":"#e9f0fb",19);
     label(x,70,letter,30);label(x,113,number,28);
   });
   label(360,185,stage==="soul"?"Гласные: 1 + 1 = 2":stage==="personality"?"Согласные: 6 + 6 = 12 → 3":"Все буквы: 1 + 6 + 6 + 1 = 14 → 5",16);
 }else if(stage==="reduce"){
   rect(60,39,140,108,"#e4eefb");rect(290,39,140,108,"#fff0d7");rect(520,39,140,108,"#e5f3ea");
   label(130,94,"38",48);label(360,94,"3 + 8",34);label(590,94,"11",48);
   label(245,94,"→",31);label(475,94,"→",31);
   label(590,181,"мастер-число",14,"#64778a");
 }else if(stage==="path"||stage==="birthday"){
   const result=lifePath({day:14,month:7,year:1990});
   const data=stage==="birthday"?[14,5]:[result.parts.month,result.parts.day,result.parts.year,result.value];
   data.forEach((v,i)=>{
     const x=data.length===2?220+i*270:90+i*175;
     bubble(x,90,v,["#e4eeff","#fce8df","#e8f3e9","#f8eacd"][i],stage==="birthday"?["день рождения","корень"][i]:["месяц","день","год","путь"][i]);
     if(i)data.length===2?label(355,90,"→",27):label(x-87,90,"+",23);
   });
 }else if(stage==="year"||stage==="month"){
   const cells=stage==="year"?[7,5,1,4]:[4,10,14,5];
   cells.forEach((v,i)=>{
     const x=90+i*175;
     bubble(x,90,v,["#e4eeff","#fce8df","#e8f3e9","#f8eacd"][i],stage==="year"?["месяц","день","2026","год"][i]:["личный год","октябрь","сумма","месяц"][i]);
     if(i)label(x-87,90,i===3?"→":"+",23);
   });
 }else{
   const ordered=[1,2,3,4,5,6,7,8,9];
   ordered.forEach((n,i)=>{
     const x=43+i*79;
     circle(x,85,29,["#e4edff","#ffe6e1","#e5f4ec"][i%3]);
     label(x,85,n,26);
   });
   label(360,181,"Изучаем числа и говорим человеческим языком",16);
 }
 root.append(svg);
}
function quiz(data){
 const panel=$("classic-lesson-quiz");panel.replaceChildren();
 panel.append(make("h2","","Проверьте себя"));
 const form=make("form");
 const field=make("fieldset");
 field.append(make("legend","",data.quiz.question));
 data.quiz.options.forEach((choice,i)=>{
   const label=make("label","classic-choice");
   const radio=make("input");
   radio.type="radio";radio.name="answer";radio.value=String(i);
   label.append(radio,make("span","",choice));field.append(label);
 });
 form.append(field);
 const submit=make("button","classic-quiz-check","Проверить ответ");submit.type="submit";
 const feedback=make("p","classic-quiz-feedback");feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
 form.append(submit,feedback);
 form.addEventListener("submit",event=>{
   event.preventDefault();
   const answer=form.querySelector('input[name="answer"]:checked');
   if(!answer){feedback.textContent="Сначала выберите ответ.";return}
   if(Number(answer.value)===data.quiz.correct){
     feedback.textContent="Верно! "+data.quiz.why+" Урок отмечен как пройденный.";
     submit.textContent="✓ Пройдено";
     try{const saved=JSON.parse(localStorage.getItem(progressKey)||"[]");
       const done=new Set(Array.isArray(saved)?saved:[]);
       done.add(data.id);localStorage.setItem(progressKey,JSON.stringify([...done]));
     }catch{}
   }else{
     feedback.textContent="Пока не совсем так. "+data.quiz.why+" Можете выбрать другой вариант.";
   }
 });
 panel.append(form);
}
function navigation(){
 const nav=$("classic-lesson-navigation");
 nav.replaceChildren();
 const link=(href,title)=>{
   const a=make("a","",title);a.href=href;return a;
 };
 const prev=manifest[activeIndex-1],next=manifest[activeIndex+1];
 if(prev)nav.append(link("pro/schools/classic/lesson/?id="+prev.id,"← Предыдущий"));
 nav.append(link("pro/schools/classic/","Все уроки"));
 if(next)nav.append(link("pro/schools/classic/lesson/?id="+next.id,"Следующий →"));
}
function render(data){
 document.title=data.title+" | Классическая нумерология";
 $("classic-lesson-count").textContent="УРОК "+(activeIndex+1)+" ИЗ "+manifest.length+" · "+data.stage;
 $("classic-lesson-title").textContent=data.title;
 $("classic-lesson-lead").textContent=data.lead;
 const article=$("classic-lesson-article");article.replaceChildren();
 data.sections.forEach(section=>{
   const box=make("section","classic-lesson-section");
   box.append(make("h2","",section.heading),make("p","",section.text));
   if(section.example)box.append(make("p","classic-example",section.example));
   article.append(box);
 });
 visual(data);quiz(data);navigation();
}
async function start(){
 try{
   const response=await fetch("pro/schools/classic/manifest.json?v=1");
   if(!response.ok)throw Error("Manifest unavailable");
   const data=await response.json();
   if(data.schema!=="classic-school-curriculum-v1"||!Array.isArray(data.lessons))throw Error("Invalid lessons index");
   manifest=data.lessons;
   activeIndex=manifest.findIndex(item=>item.id===id);
   if(activeIndex<0)throw Error("Unknown lesson id");
   const r=await fetch(manifest[activeIndex].file+"?v=1");
   if(!r.ok)throw Error("Lesson unavailable");
   const lesson=await r.json();
   if(lesson.id!==id||!lesson.sections?.length||!lesson.quiz)throw Error("Lesson invalid");
   render(lesson);
 }catch(error){
   console.warn("Классический урок:",error);
   $("classic-lesson-title").textContent="Урок временно недоступен";
   const msg=$("classic-lesson-error");msg.hidden=false;
   msg.textContent="Не удалось открыть урок. Проверьте интернет и попробуйте снова.";
 }
}
start();
