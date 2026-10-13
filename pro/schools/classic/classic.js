import { numberMeaning,parseClassicDate,lifePath,birthdayNumber,personalYear,personalMonth,analyzeName } from "./classic-core.js?v=1";

const $=id=>document.getElementById(id);
const item=(tag,cls,text)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=String(text);
  return node;
};
const progressKey="numerologia-online-classic-progress-v1";
function readProgress(){
  try{const value=JSON.parse(localStorage.getItem(progressKey)||"[]");return new Set(Array.isArray(value)?value:[])}
  catch{return new Set()}
}
let completed=readProgress();

function renderNumbers(selected=1){
  const root=$("classic-number-grid");
  root.replaceChildren();
  Object.entries(numberMeaning).forEach(([raw,meaning])=>{
    const n=Number(raw);
    const button=item("button","classic-number-btn");
    button.type="button";
    button.setAttribute("aria-pressed",String(n===selected));
    button.setAttribute("aria-label","Число "+n+": "+meaning.name);
    button.append(item("span","digit",n),item("span","tiny",meaning.emoji+" "+(n>9?"мастер":meaning.name)));
    button.addEventListener("click",()=>renderNumbers(n));
    root.append(button);
  });
  const value=numberMeaning[selected],answer=$("classic-number-answer");
  answer.replaceChildren();
  answer.append(item("div","classic-number-symbol",selected));
  const details=item("div");
  details.append(item("h3","",selected+" - "+value.name));
  const row=(label,text)=>{const p=item("p");p.append(item("strong","",label+" "),document.createTextNode(text));return p;};
  details.append(row("Сильная сторона:",value.plus),row("Что может мешать:",value.shadow),row("Попробуйте:",value.tip));
  answer.append(details);
}

function drawDateFlow(parts,result){
  const ns="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(ns,"svg");
  svg.setAttribute("viewBox","0 0 480 120");
  svg.setAttribute("role","img");
  svg.setAttribute("aria-label","Месяц "+parts.month+", день "+parts.day+", год "+parts.year+" дают жизненный путь "+result);
  const box=(x,label,value,color)=>{
    const rect=document.createElementNS(ns,"rect");
    for(const [k,v]of Object.entries({x,y:8,width:102,height:89,rx:18,fill:color}))rect.setAttribute(k,String(v));
    svg.append(rect);
    const add=(text,y,size,bold=false)=>{
      const t=document.createElementNS(ns,"text");
      for(const [k,v]of Object.entries({x:x+51,y,"text-anchor":"middle",fill:"#2e4a64","font-size":size,"font-weight":bold?850:550,"font-family":"system-ui"}))t.setAttribute(k,String(v));
      t.textContent=String(text);svg.append(t);
    };
    add(label,40,13);add(value,73,27,true);
  };
  box(8,"Месяц",parts.month,"#e4edfa");box(120,"День",parts.day,"#fbe8e2");box(232,"Год",parts.year,"#e6f4e9");
  const arrow=document.createElementNS(ns,"text");arrow.setAttribute("x","338");arrow.setAttribute("y","58");arrow.setAttribute("font-size","25");arrow.setAttribute("fill","#73869b");arrow.textContent="→";svg.append(arrow);
  box(367,"Путь",result,"#f7e9c7");
  return svg;
}
function resultBox(label,value,sub){
  const box=item("div","classic-result-hero");
  box.append(item("span","classic-result-big",value));
  const desc=item("div");desc.append(item("strong","",label),item("small","",sub||""));box.append(desc);return box;
}
function stepBox(title,text){
  const d=item("div","classic-result-step");d.append(item("b","",title),item("span","",text));return d;
}
function formatDateInput(input){
  input.addEventListener("input",()=>{
    const digits=input.value.replace(/\D/g,"").slice(0,8);
    input.value=[digits.slice(0,2),digits.slice(2,4),digits.slice(4,8)].filter(Boolean).join(".");
  });
}
function runDate(){
  const birth=parseClassicDate($("classic-date").value);
  const year=Number($("classic-year").value);
  const err=$("classic-date-error");
  if(!birth||!Number.isInteger(year)||year<1900||year>2200){
    err.textContent="Введите существующую дату рождения и год от 1900 до 2200.";
    err.hidden=false;return;
  }
  err.hidden=true;
  const path=lifePath(birth),bd=birthdayNumber(birth),py=personalYear(birth,year),pm=personalMonth(birth,year,10);
  const output=$("classic-date-answer");
  output.replaceChildren();
  output.append(resultBox("Число жизненного пути",path.value,"из месяца, дня и года рождения"));
  const graph=drawDateFlow(path.parts,path.value);
  graph.classList.add("classic-mini-chart");output.append(graph);
  output.append(stepBox("Сначала месяц, день, год","Месяц "+path.parts.month+" · день "+path.parts.day+" · год "+path.parts.year+" (сумма цифр года: "+path.parts.yearSum+")"));
  output.append(stepBox("Потом общий результат",path.trace.join(" → ")));
  output.append(resultBox("Число дня рождения",bd.original,"корневая тема: "+bd.root));
  output.append(resultBox("Личный год "+year,py,"календарный цикл 1-9"));
  output.append(stepBox("Пример личного месяца","Октябрь "+year+": "+py+" + 10 → "+pm));
}
function runName(){
  const report=analyzeName($("classic-name").value);
  const err=$("classic-name-error");
  if(report.error){err.textContent=report.error;err.hidden=false;return}
  err.hidden=true;
  const root=$("classic-name-answer");root.replaceChildren();
  root.append(resultBox("Число выражения",report.expression,"все буквы · сумма "+report.total));
  const chips=item("div","classic-letter-strip");
  report.letters.forEach(({letter,number})=>{
    const chip=item("span","classic-letter-chip");chip.append(item("b","",letter),item("small","",number));chips.append(chip);
  });
  root.append(chips);
  root.append(stepBox("Как считали",report.letters.map(x=>x.number).join(" + ")+" = "+report.total+" → "+report.expression));
  if(report.soul!=null)root.append(resultBox("Число сердца",report.soul,"только гласные · сумма "+report.heartTotal));
  if(report.personality!=null)root.append(resultBox("Число личности",report.personality,"остальные буквы · сумма "+report.outerTotal));
  root.append(stepBox("Наша таблица букв",report.note));
}
async function initLessons(){
  completed=readProgress();
  try{
    const response=await fetch("pro/schools/classic/manifest.json?v=2");
    if(!response.ok)throw Error("manifest unavailable");
    const bank=await response.json();
    if(bank.schema!=="classic-school-curriculum-v1"||!Array.isArray(bank.lessons))throw Error("incomplete curriculum");
    const root=$("classic-lessons-grid");root.replaceChildren();
    let lastStage="";
    bank.lessons.forEach((lesson,i)=>{
      if(lastStage!==lesson.stage){lastStage=lesson.stage;root.append(item("h3","classic-stage-title",lastStage))}
      const unlocked=bank.lessons.slice(0,i).every(previous=>completed.has(previous.id));
      const link=item(unlocked?"a":"div","classic-card"+(unlocked?"":" is-locked"));
      if(unlocked)link.href="pro/schools/classic/lesson/?id="+encodeURIComponent(lesson.id);
      else{
        link.setAttribute("aria-disabled","true");
        link.title="Откроется после прохождения предыдущих уроков";
      }
      if(completed.has(lesson.id))link.classList.add("completed");
      link.append(item("span","classic-card-index",completed.has(lesson.id)?"✓":i+1));
      const copy=item("span","classic-card-copy");
      copy.append(item("strong","",lesson.title),item("small","",lesson.minutes+" мин · "+lesson.stage.toLowerCase()));
      link.append(copy,item("span","classic-card-arrow",unlocked?"→":"🔒"));
      root.append(link);
    });
    const count=bank.lessons.filter(x=>completed.has(x.id)).length;
    $("classic-progress-label").textContent="Пройдено "+count+" из "+bank.lessons.length;
    $("classic-progress-fill").style.width=(100*count/bank.lessons.length)+"%";
  }catch(error){
    console.warn("Классическая школа:",error);
    $("classic-lessons-grid").textContent="Пока не удалось загрузить программу. Проверьте интернет и обновите страницу.";
    $("classic-progress-label").textContent="Программа временно недоступна";
  }
}
$("classic-date-form").addEventListener("submit",event=>{event.preventDefault();runDate()});
$("classic-name-form").addEventListener("submit",event=>{event.preventDefault();runName()});
formatDateInput($("classic-date"));
renderNumbers(1);
runDate();
runName();
initLessons();
window.addEventListener("pageshow",event=>{if(event.persisted)initLessons()});
window.addEventListener("storage",event=>{if(event.key===progressKey)initLessons()});
