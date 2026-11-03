import { calculateMatrix } from "../../numerology-core.js?v=5";
import { constructionSteps, purposeSteps, learningBirthDate, readLearningProgress, LESSON_SKILLS } from "./construction-model.js?v=20261102learn1";
import { mountConstruction } from "./learning.js?v=20261103mobile1";
const byId=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const addParagraph=(root,value,cls)=>{if(value)root.append(make("p",cls,value));};
const error=byId("school-error"),lessonList=byId("school-lesson-list"),progressLabel=byId("school-progress"),arcanaButtons=byId("school-arcana-buttons"),arcanaContent=byId("school-arcana-content");
const formulaForm=byId("school-formula-form"),formulaDate=byId("school-formula-date"),formulaError=byId("school-formula-error"),formulaList=byId("school-formula-list");
const tabButtons=[...document.querySelectorAll("[data-school-panel]")];
let lessons=[],arcana=[],activeArcanaIndex=0;
const lessonLink=item=>"pro/school/lesson/?id="+encodeURIComponent(item.id)+"&v=20261103mobile1";
function showPanel(key){for(const section of document.querySelectorAll(".school-panel"))section.hidden=section.id!=="school-"+key;tabButtons.forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.schoolPanel===key)));if(key==="trainer"&&!byId("school-construction-trainer").childElementCount)mountConstruction(byId("school-construction-trainer"),{lessonId:byId("school-trainer-skill").value,standalone:true});}
tabButtons.forEach(b=>b.addEventListener("click",()=>{showPanel(b.dataset.schoolPanel);document.querySelector(".school-tabs").scrollIntoView({block:"start",behavior:"smooth"});}));
function renderLessonList(){
 const completed=readLearningProgress(),next=lessons.find(l=>!completed.has(l.id));
 progressLabel.textContent=lessons.filter(l=>completed.has(l.id)).length+" из "+lessons.length+" пройдено";
 const resume=byId("school-resume-link");resume.href=next?lessonLink(next):"pro/school/lesson/?id=build-independent&v=20261103mobile1";
 resume.replaceChildren(make("span","",next?(completed.size?"Продолжить обучение →":"Начать с первого урока →"):"Повторить самостоятельное построение →"));
 resume.append(make("small","",next?next.title:"Соберите матрицу на новой дате"));
 byId("school-route-progress").textContent=lessons.filter(l=>l.track==="construction"&&completed.has(l.id)).length+" из "+lessons.filter(l=>l.track==="construction").length+" навыков построения подтверждено";
 lessonList.replaceChildren();const groups=[];
 lessons.forEach((lesson,position)=>{const title=lesson.module||"Программа";let g=groups.at(-1);if(!g||g.title!==title){g={title,items:[]};groups.push(g);}g.items.push({lesson,position});});
 for(const group of groups){const section=make("section","school-lesson-module");section.append(make("h3","school-lesson-module-title",group.title),make("p","school-module-progress",group.items.filter(({lesson})=>completed.has(lesson.id)).length+" из "+group.items.length+" уроков пройдено"));const list=make("div","school-lesson-module-list");
 for(const{lesson,position}of group.items){const passed=completed.has(lesson.id),link=make("a","school-lesson-link"+(passed?" completed":"")+(lesson.id===next?.id?" is-recommended":""));link.href=lessonLink(lesson);const summary=make("span","school-lesson-summary");summary.append(make("strong","",lesson.title),make("small","",lesson.level+" · "+lesson.minutes+" мин"));
 const outcome=LESSON_SKILLS[lesson.id]?.outcome||lesson.outcome;if(outcome)summary.append(make("small","school-skill-outcome",outcome));
 link.append(make("span","school-lesson-number",passed?"✓":position+1),summary,make("span","school-lesson-arrow","→"));list.append(link);}
 section.append(list);lessonList.append(section);}
}
function buildFormulaSheet(birth){
 const steps=constructionSteps(birth);formulaList.replaceChildren();
 for(const group of [...new Set(steps.map(n=>n.group))]){const section=make("section","school-formula-group");section.append(make("h3","",group));const cards=make("div","school-formula-cards");
 for(const point of steps.filter(n=>n.group===group)){const card=make("article","school-formula-card"),head=make("div","school-formula-title");head.append(make("span","",point.number+". "+point.title),make("strong","",point.value));card.append(head,make("p","school-equation",point.expression),make("p","school-reference-location",point.position),make("p","school-reference-location",point.rule));cards.append(card);}section.append(cards);formulaList.append(section);}
 const details=make("details","school-formula-group");details.append(make("summary","","Предназначение и показатели рода — отдельно от 31 точки"));purposeSteps(calculateMatrix(birth)).forEach(p=>{details.append(make("h3","",p.title),make("p","school-equation",p.expression),make("p","school-reference-location",p.rule));});formulaList.append(details);
}
formulaDate.addEventListener("input",()=>{const d=formulaDate.value.replace(/\D/g,"").slice(0,8);formulaDate.value=[d.slice(0,2),d.slice(2,4),d.slice(4,8)].filter(Boolean).join(".");formulaError.hidden=true;});
formulaForm.addEventListener("submit",e=>{e.preventDefault();const birth=learningBirthDate(formulaDate.value);if(!birth){formulaError.textContent="Введите существующую дату ДД.ММ.ГГГГ от 1900 года до сегодня.";formulaError.hidden=false;return;}formulaError.hidden=true;buildFormulaSheet(birth);});
byId("school-trainer-skill").addEventListener("change",()=>mountConstruction(byId("school-construction-trainer"),{lessonId:byId("school-trainer-skill").value,standalone:true}));
function renderArcanaButtons() {
  arcanaButtons.replaceChildren();
  arcana.forEach((item,index)=>{
    const button = make("button", "", item.id);
    button.type = "button";
    button.title = item.name;
    button.setAttribute("aria-label",`${item.id}. ${item.name}`);
    button.setAttribute("aria-pressed",String(index===activeArcanaIndex));
    button.addEventListener("click",()=>{
      activeArcanaIndex=index;
      renderArcanaButtons();
      renderArcana();
    });
    arcanaButtons.append(button);
  });
}
function renderArcana() {
  const item=arcana[activeArcanaIndex];
  if (!item) return;
  arcanaContent.replaceChildren();
  arcanaContent.append(make("p","school-overline",`ЭНЕРГИЯ ${item.id} ИЗ 22`));
  arcanaContent.append(make("h3","school-arcana-title",item.name));
  addParagraph(arcanaContent,item.core,"school-arcana-core");
  const dl=make("dl");
  [["В сильном проявлении",item.plus],["В сложном проявлении",item.minus],["В отношениях",item.love],["В деньгах и работе",item.money]].forEach(([name,desc])=>{
    const section=make("div");
    section.append(make("dt","",name),make("dd","",desc));
    dl.append(section);
  });
  arcanaContent.append(dl);
}

async function startSchool(){
 const lessonResponse=await fetch("pro/school/lessons-manifest.json?v=20261102learn1",{cache:"no-cache"});
 if(!lessonResponse.ok)throw Error("Программа недоступна");const data=await lessonResponse.json();if(!Array.isArray(data.lessons)||!data.lessons.length)throw Error("Нет уроков");lessons=data.lessons;renderLessonList();buildFormulaSheet({day:14,month:7,year:1990});if(location.hash==="#school-trainer")showPanel("trainer");
 try{const response=await fetch("pro/school/arcana.json?v=1");if(!response.ok)throw Error();const data=await response.json();if(data.arcana?.length!==22)throw Error();arcana=data.arcana;renderArcanaButtons();renderArcana();}catch{arcanaContent.textContent="Справочник энергий временно не загрузился. Уроки и тренажёр доступны; попробуйте обновить страницу.";}
}
window.addEventListener("pageshow",()=>{if(lessons.length)renderLessonList();});window.addEventListener("storage",()=>{if(lessons.length)renderLessonList();});
startSchool().catch(()=>{error.hidden=false;error.textContent="Не удалось загрузить программу. Проверьте соединение и обновите страницу.";lessonList.textContent="Уроки временно недоступны.";});
