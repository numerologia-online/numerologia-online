import { LESSON_SKILLS, readLearningProgress, markLearningLesson } from "../construction-model.js?v=20261102learn1";
import { mountConstruction, mountLessonGuide, renderStepStrip, bindStepSwipe } from "../learning.js?v=20261103mobile1";

const $ = (id) => document.getElementById(id);
const make = (tag, className, value) => {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (value !== undefined) item.textContent = String(value);
  return item;
};
const readCompleted=readLearningProgress;
let lesson,manifest,index=-1,practiceComplete=false,lessonView="lesson";
const params=new URLSearchParams(location.search);
const id=params.get("id")||"start";
async function loadLessonContent(item){
  const initData=window.Telegram?.WebApp?.initData||"";
  const response=await fetch("/api/numi-school.php",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"content",init_data:initData,path:item.file})});
  if(response.status===401||response.status===403)throw Object.assign(Error("Доступ не подтверждён"),{code:response.status===401?"AUTH_REQUIRED":"ACCESS_REQUIRED"});
  if(!response.ok)throw Error("Сервис уроков временно недоступен");
  const result=await response.json();if(result.ok!==true||!result.content||typeof result.content!=="object")throw Error("Некорректный ответ сервиса уроков");
  return result.content;
}
function renderAccessRequired(code){
  const item=manifest[index];
  document.title=item.title+" | Самоучитель по матрице судьбы";
  document.body.classList.add("school-compact-lesson");
  $("lesson-count").textContent="УРОК "+(index+1)+" ИЗ "+manifest.length+" · "+item.level;
  $("lesson-title").textContent=item.title;
  $("lesson-lead").textContent=LESSON_SKILLS[id]?.goal||item.outcome||"Учебный материал самоучителя.";
  const root=$("lesson-content");root.hidden=false;root.replaceChildren();
  const card=make("section","school-access-card");
  card.append(make("h2","",code==="AUTH_REQUIRED"?"Откройте урок через свой аккаунт":"Проверьте доступ к самоучителю"),make("p","",code==="AUTH_REQUIRED"?"Текст этого урока открывается через аккаунт в мини-приложении Telegram. Перейдите в приложение, чтобы проверить доступ к материалам.":"Сервер пока не подтвердил доступ к материалам этого урока для вашего аккаунта. Проверьте его в мини-приложении Telegram."));
  const actions=make("div","learning-actions"),telegram=make("a","school-primary","Открыть в Telegram");telegram.href="https://t.me/Numerologiaonline_bot?startapp";telegram.target="_blank";telegram.rel="noopener";actions.append(telegram);
  const retry=make("button","learning-secondary","Проверить доступ ещё раз");retry.type="button";retry.addEventListener("click",()=>location.reload());actions.append(retry);card.append(actions);
  const trainer=make("a","school-access-practice","Потренироваться в построении →");trainer.href="pro/school/?v=20261103mobile1#school-trainer";card.append(trainer);root.append(card);
  $("lesson-drawing").hidden=true;$("lesson-quiz").hidden=true;renderNavigation();
}
const practiceRequired=()=>Boolean(LESSON_SKILLS[id]);
function syncPracticeGate(){
 const root=$("lesson-quiz"),blocked=practiceRequired()&&!practiceComplete;
 root.classList.toggle("is-locked",blocked);root.setAttribute("aria-disabled",String(blocked));
 const notice=$("lesson-quiz-lock");if(notice)notice.hidden=!blocked;
 root.querySelectorAll("fieldset").forEach(f=>f.disabled=blocked);
 const submit=root.querySelector('button[type="submit"]');if(submit)submit.disabled=blocked;
}
function setupDiagram(){
 const root=$("lesson-drawing");
 if(!practiceRequired()){root.hidden=true;return;}
 practiceComplete=false;
 mountConstruction(root,{lessonId:id,embedded:true,onQuiz:()=>setLessonView("quiz"),onComplete:complete=>{practiceComplete=complete;syncPracticeGate();}});
 syncPracticeGate();
}
function renderQuiz(data) {
  const root=$("lesson-quiz");
  root.replaceChildren();
  root.append(make("h2","","Проверьте, что запомнили"));
  root.append(make("p","school-quiz-intro","Ответьте на вопросы - после правильных ответов урок отметится как пройденный."));
  const form=make("form","school-quiz-form");
  form.noValidate=true;
  let questionAt=0;
  const questionStrip=make("nav","school-question-strip");
  data.questions.forEach((question,index)=>{
    const fieldset=make("fieldset","school-question");
    fieldset.append(make("legend","",`${index+1}. ${question.prompt}`));
    question.options.forEach((option,optionIndex)=>{
      const label=make("label");
      const input=make("input");
      input.type="radio";input.name="quiz-"+index;input.value=String(optionIndex);
      label.append(input,make("span","",option));
      fieldset.append(label);
    });
    form.append(fieldset);
  });
  const submit=make("button","school-primary","Проверить знания");
  submit.type="submit";
  const questionNavigation=make("div","lesson-slide-navigation"),questionBack=make("button","learning-secondary","← Назад"),questionNext=make("button","school-primary","Далее →"),questionCount=make("span","lesson-slide-count");
  questionBack.type="button";questionNext.type="button";questionBack.addEventListener("click",()=>showQuestion(questionAt-1));questionNext.addEventListener("click",()=>showQuestion(questionAt+1));questionNavigation.append(questionBack,questionCount,questionNext);form.append(questionNavigation);
  form.append(submit);
  const feedback=make("p","school-quiz-result");
  feedback.setAttribute("role","status");
  feedback.setAttribute("aria-live","polite");
  form.append(feedback);
  const review=make("div","school-quiz-review");
  review.hidden=true;
  form.append(review);
  function showQuestion(at){
    questionAt=Math.min(data.questions.length-1,Math.max(0,at));
    form.querySelectorAll("fieldset").forEach((fieldset,i)=>fieldset.hidden=i!==questionAt);
    renderStepStrip(questionStrip,{titles:data.questions.map(q=>q.prompt),active:questionAt,onSelect:showQuestion,prefix:"Вопрос",panelId:"lesson-current-question"});
    form.id="lesson-current-question";form.setAttribute("role","tabpanel");form.setAttribute("aria-labelledby","lesson-current-question-tab-"+questionAt);
    questionBack.disabled=questionAt===0;questionNext.hidden=questionAt===data.questions.length-1;submit.hidden=questionAt!==data.questions.length-1;questionCount.textContent=(questionAt+1)+" / "+data.questions.length;
    review.querySelectorAll("[data-review-index]").forEach(item=>item.hidden=Number(item.getAttribute("data-review-index"))!==questionAt);
  }
  bindStepSwipe(form,{previous:()=>showQuestion(questionAt-1),next:()=>showQuestion(questionAt+1)});

  const retry=make("button","school-quiz-retry","↻ Ответить на вопросы заново");
  retry.type="button";
  retry.hidden=true;
  retry.addEventListener("click",()=>{
    form.querySelectorAll('input[type="radio"]').forEach(input=>{input.checked=false});
    feedback.textContent="";
    review.hidden=true;
    review.replaceChildren();
    feedback.classList.remove("is-incorrect","is-correct");
    retry.hidden=true;
    submit.textContent="Проверить знания";
    showQuestion(0);
    root.querySelectorAll("fieldset").forEach(fieldset=>fieldset.classList.remove("is-wrong","is-right"));
    root.scrollIntoView({behavior:"smooth",block:"start"});
  });
  form.append(retry);
  form.addEventListener("submit",event=>{
    event.preventDefault();
    if(practiceRequired()&&!practiceComplete){feedback.textContent="Сначала завершите самостоятельную практику на схеме выше.";$("lesson-drawing").scrollIntoView({behavior:"smooth",block:"start"});return;}
    const answers=data.questions.map((_,i)=>form.querySelector(`input[name="quiz-${i}"]:checked`));
    if(answers.some(a=>!a)){const missing=answers.findIndex(a=>!a);feedback.textContent="Остался вопрос "+(missing+1)+". Выберите ответ, чтобы проверить весь урок.";showQuestion(missing);form.querySelectorAll("fieldset")[missing].querySelector("input").focus();return;}
    const score=answers.filter((a,i)=>Number(a.value)===data.questions[i].correct).length;
    if(score===data.questions.length){
      const saved=markLearningLesson(data.id);
      review.hidden=true;
      review.replaceChildren();
      feedback.classList.remove("is-incorrect");
      feedback.classList.add("is-correct");
      feedback.textContent=saved
        ?"Отлично! Урок пройден. Можно переходить к следующему."
        :"Ответы правильные! Прогресс не удалось сохранить, но обучение можно продолжить. При необходимости запишите номер урока.";
      retry.hidden=true;
      submit.textContent=saved?"✓ Урок пройден":"✓ Ответы правильные";
      renderNavigation();
      if(saved==="sessionStorage")feedback.textContent+=" Прогресс сохранён только до закрытия этой вкладки.";
      feedback.scrollIntoView({behavior:"smooth",block:"center"});
    }else{
      feedback.classList.remove("is-correct");
      feedback.classList.add("is-incorrect");
      feedback.textContent="Правильно "+score+" из "+data.questions.length+". Посмотрите разбор ошибок и попробуйте снова.";
      review.replaceChildren();
      data.questions.forEach((question,i)=>{
        const correct=Number(answers[i].value)===question.correct;
        const fieldset=form.querySelectorAll("fieldset")[i];fieldset.classList.toggle("is-right",correct);fieldset.classList.toggle("is-wrong",!correct);
        if(correct)return;
        const item=make("p","school-quiz-review-item");
        item.setAttribute("data-review-index",String(i));
        item.append(make("strong","","Вопрос "+(i+1)+": "),document.createTextNode(question.explain));
        review.append(item);
      });
      review.hidden=false;
      retry.hidden=false;
      showQuestion(answers.findIndex((answer,i)=>Number(answer.value)!==data.questions[i].correct));
    }
  });
  root.append(questionStrip,form);
  if(practiceRequired()){
    const notice=make("p","school-quiz-practice-note","Сначала завершите режим «Теперь я сам» в практике выше. Затем проверим понимание правил.");notice.id="lesson-quiz-lock";root.insertBefore(notice,form);
  }
  showQuestion(0);
  syncPracticeGate();
}
function renderNavigation() {
  const nav=$("lesson-navigation");
  nav.replaceChildren();
  const prev=manifest[index-1],next=manifest[index+1];
  const link=(item,txt,cl)=>{
    const a=make("a",cl,txt);
    a.href="pro/school/lesson/?id="+encodeURIComponent(item.id)+"&v=20261103mobile1";
    return a;
  };
  if(prev)nav.append(link(prev,"← Предыдущий урок","school-secondary school-lesson-prev"));
  if(next)nav.append(link(next,"Следующий урок →","school-primary school-lesson-next"));
  const all=make("a","school-lesson-all","Вся программа");
  all.href="pro/school/?v=20261103mobile1";
  nav.append(all);
}
function renderCaseWorkbook(root,lessonId){
  const key="numerologia-online-school-case-"+lessonId,fields=[
    ["request","1. Запрос","Какой один вопрос разбираем? Какой результат нужен человеку?"],
    ["calculation","2. Проверенные расчёты","Учебная дата, названия позиций, исходные числа, суммы и результаты."],
    ["versions","3. Две возможные версии","Какие трактовки вы предлагаете? Что может подтвердить или опровергнуть каждую?"],
    ["questions","4. Три открытых вопроса","Вопросы об опыте человека, которые помогут проверить ваши предположения."],
    ["action","5. Один практический шаг","Что можно попробовать, в какой срок и как оценить результат?"],
  ];
  let draft={};try{const saved=JSON.parse(localStorage.getItem(key)||"{}");if(saved&&typeof saved==="object"&&!Array.isArray(saved))draft=saved;}catch{}
  const details=make("details","school-case-workbook");details.append(make("summary","","Моя учебная запись: от запроса к действию"));
  details.append(make("p","school-storage-note","Пишите на примере вымышленного клиента. Этот черновик хранится в вашем браузере; он помогает оформить работу, а качество трактовки проверьте по самопроверке урока."));
  const info=make("p","school-workbook-save"),editors=[];
  const status=()=>"Заполнено "+editors.filter(n=>n.value.trim()).length+" из "+fields.length+" частей. ";
  fields.forEach(([field,title,placeholder])=>{
    const label=make("label","school-case-field",title),input=make("textarea","school-workbook-textarea");input.rows=3;input.maxLength=4000;input.placeholder=placeholder;input.value=typeof draft[field]==="string"?draft[field]:"";input.setAttribute("aria-label",title);editors.push(input);
    input.addEventListener("input",()=>{draft[field]=input.value;try{localStorage.setItem(key,JSON.stringify(draft));info.textContent=status()+"Черновик сохранён.";}catch{info.textContent=status()+"Сохранение недоступно. Скопируйте текст перед выходом.";}});label.append(input);details.append(label);
  });
  info.textContent=status()+"После заполнения проверьте работу по критериям урока.";details.append(info);root.append(details);
}
function renderWorkbook(root,data){
  root.append(make("p","",data.practice));
  if(["case-clinic","case-independent","final"].includes(data.id))renderCaseWorkbook(root,data.id);
  const details=make("details","school-workbook-editor");details.append(make("summary","","Мои заметки"));
  const notes=make("textarea","school-workbook-textarea");notes.rows=4;notes.maxLength=8000;notes.placeholder="Мои расчёты, вопросы и выводы…";notes.setAttribute("aria-label","Мои заметки к уроку");
  const info=make("p","school-workbook-save","Черновик хранится в этом браузере. Используйте учебные данные.");
  const noteKey="numerologia-online-school-notes-"+data.id;
  try{notes.value=localStorage.getItem(noteKey)||"";}catch{info.textContent="Сохранение недоступно. Скопируйте заметки перед выходом.";}
  notes.addEventListener("input",()=>{try{localStorage.setItem(noteKey,notes.value);info.textContent="Черновик сохранён.";}catch{info.textContent="Скопируйте заметки перед выходом: сохранение недоступно.";}});
  details.append(notes,info);root.append(details);
  if(data.rubric?.length){
    const check=make("details","school-workbook-checklist");check.append(make("summary","","Самопроверка"));
    for(const item of data.rubric){const label=make("label","school-workbook-check"),box=make("input");box.type="checkbox";label.append(box,make("span","",item));check.append(label);}root.append(check);
  }
}
function setLessonView(view){
  if(view==="practice"&&!practiceRequired())return;
  lessonView=view;
  $("lesson-content").hidden=view!=="lesson";
  $("lesson-drawing").hidden=view!=="practice";
  $("lesson-quiz").hidden=view!=="quiz";
  $("lesson-hero").querySelectorAll("[data-lesson-view]").forEach(button=>button.setAttribute("aria-pressed",String(button.getAttribute("data-lesson-view")===view)));
}
function renderLesson(data) {
  document.title=data.title+" | Самоучитель по матрице судьбы";
  document.body.classList.add("school-compact-lesson");
  $("lesson-count").textContent="УРОК "+(index+1)+" ИЗ "+manifest.length;
  $("lesson-title").textContent=id==="start"?"Рисуем матрицу с нуля":data.title;
  $("lesson-lead").hidden=true;$("lesson-main-rule").hidden=true;
  const about=make("details","school-lesson-about");about.append(make("summary","","Об уроке"),make("p","",data.lead));
  const skill=LESSON_SKILLS[id],outcome=skill?.outcome||manifest[index].outcome;
  if(outcome)about.append(make("p","","После урока: "+outcome));
  if(data.mainRule?.lines?.length){about.append(make("strong","",data.mainRule.title));for(const line of data.mainRule.lines)about.append(make("p","",line));if(data.mainRule.note)about.append(make("p","",data.mainRule.note));}
  const prerequisite=document.body.querySelector(".school-prereq-note");if(prerequisite)about.append(prerequisite);
  $("lesson-hero").append(about);
  const route=make("nav","school-route-nav");route.setAttribute("aria-label","Режим урока");
  const views=[["lesson","Урок"],...(skill?[["practice","Практика"]]:[]),["quiz","Проверка"]];
  for(const[view,title]of views){const button=make("button","",title);button.type="button";button.setAttribute("data-lesson-view",view);button.setAttribute("aria-pressed",String(view==="lesson"));button.addEventListener("click",()=>setLessonView(view));route.append(button);}$("lesson-hero").append(route);
  mountLessonGuide($("lesson-content"),{lesson:data,renderWorkbook:root=>renderWorkbook(root,data),onPractice:()=>setLessonView("practice"),onQuiz:()=>setLessonView("quiz")});
  renderQuiz(data);renderNavigation();setupDiagram();setLessonView("lesson");
}

async function start() {
  try{
    const res=await fetch("pro/school/lessons-manifest.json?v=20261102learn1");
    if(!res.ok)throw Error("Список уроков не найден");
    const meta=await res.json();
    if(meta.schema!=="pro-school-lessons-manifest-v1"||!Array.isArray(meta.lessons))throw Error("Некорректная программа");
    manifest=meta.lessons;
    index=manifest.findIndex(item=>item.id===id);
    if(index<0)throw Error("Урок не найден");
    const completed=readCompleted();
    const current=manifest[index];
    const firstMissing=(current.prerequisites||[]).map(key=>manifest.find(item=>item.id===key)).find(item=>item&&!completed.has(item.id));
    if(firstMissing){
      const notice=make("aside","school-prereq-note");notice.append(document.createTextNode("Для этого урока пригодится: "+firstMissing.title+". "));const a=make("a","","Повторить →");a.href="pro/school/lesson/?id="+encodeURIComponent(firstMissing.id)+"&v=20261103mobile1";notice.append(a);$("lesson-hero").before(notice);
    }
    lesson=await loadLessonContent(manifest[index]);
    if(lesson.id!==id||!Array.isArray(lesson.sections)||!Array.isArray(lesson.questions))
      throw Error("Материал урока неполный");
    renderLesson(lesson);
  }catch(error){
    if(error.code==="AUTH_REQUIRED"||error.code==="ACCESS_REQUIRED"){renderAccessRequired(error.code);return;}
    console.error("Школа: урок",error);
    const notice=$("lesson-error");
    notice.hidden=false;
    notice.textContent="Не получилось загрузить урок. Проверьте интернет и попробуйте открыть его снова.";
    $("lesson-title").textContent="Урок временно недоступен";
  }
}
start();

