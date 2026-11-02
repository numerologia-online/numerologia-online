import { LESSON_SKILLS, readLearningProgress, markLearningLesson } from "../construction-model.js?v=20261102learn1";
import { mountConstruction } from "../learning.js?v=20261102learn1";

const $ = (id) => document.getElementById(id);
const make = (tag, className, value) => {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (value !== undefined) item.textContent = String(value);
  return item;
};
const readCompleted=readLearningProgress;
let lesson,manifest,index=-1,practiceComplete=false;
const params=new URLSearchParams(location.search);
const id=params.get("id")||"start";
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
 mountConstruction(root,{lessonId:id,onComplete:complete=>{practiceComplete=complete;syncPracticeGate();}});
 syncPracticeGate();
}
function renderQuiz(data) {
  const root=$("lesson-quiz");
  root.replaceChildren();
  root.append(make("h2","","Проверьте, что запомнили"));
  root.append(make("p","school-quiz-intro","Ответьте на вопросы - после правильных ответов урок отметится как пройденный."));
  const form=make("form","school-quiz-form");
  form.noValidate=true;
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
  form.append(submit);
  const feedback=make("p","school-quiz-result");
  feedback.setAttribute("role","status");
  feedback.setAttribute("aria-live","polite");
  form.append(feedback);
  const review=make("div","school-quiz-review");
  review.hidden=true;
  form.append(review);

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
    root.querySelectorAll("fieldset").forEach(fieldset=>fieldset.classList.remove("is-wrong","is-right"));
    root.scrollIntoView({behavior:"smooth",block:"start"});
  });
  form.append(retry);
  form.addEventListener("submit",event=>{
    event.preventDefault();
    if(practiceRequired()&&!practiceComplete){feedback.textContent="Сначала завершите самостоятельную практику на схеме выше.";$("lesson-drawing").scrollIntoView({behavior:"smooth",block:"start"});return;}
    const answers=data.questions.map((_,i)=>form.querySelector(`input[name="quiz-${i}"]:checked`));
    if(answers.some(a=>!a)){const missing=answers.findIndex(a=>!a);feedback.textContent="Остался вопрос "+(missing+1)+". Выберите ответ, чтобы проверить весь урок.";form.querySelectorAll("fieldset")[missing].querySelector("input").focus();return;}
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
        item.append(make("strong","","Вопрос "+(i+1)+": "),document.createTextNode(question.explain));
        review.append(item);
      });
      review.hidden=false;
      retry.hidden=false;
    }
  });
  root.append(form);
  if(practiceRequired()){
    const notice=make("p","school-quiz-practice-note","Сначала завершите режим «Теперь я сам» в практике выше. Затем проверим понимание правил.");notice.id="lesson-quiz-lock";root.insertBefore(notice,form);
  }
  syncPracticeGate();
}
function renderNavigation() {
  const nav=$("lesson-navigation");
  nav.replaceChildren();
  const prev=manifest[index-1],next=manifest[index+1];
  const link=(item,txt,cl)=>{
    const a=make("a",cl,txt);
    a.href="pro/school/lesson/?id="+encodeURIComponent(item.id);
    return a;
  };
  if(prev)nav.append(link(prev,"← Предыдущий урок","school-secondary school-lesson-prev"));
  if(next)nav.append(link(next,readCompleted().has(id)?"Следующий урок →":"Посмотреть следующий урок →","school-primary school-lesson-next"));
  const all=make("a","school-lesson-all","Вся программа");
  all.href="pro/school/";
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
function renderLesson(data) {
  document.title=data.title+" | Самоучитель по матрице судьбы";
  $("lesson-count").textContent="УРОК "+(index+1)+" ИЗ "+manifest.length+" · "+data.level;
  $("lesson-title").textContent=id==="start"?"Рисуем матрицу с нуля":data.title;
  $("lesson-lead").textContent=data.lead;
  const mainRule=$("lesson-main-rule");
  mainRule.replaceChildren();
  if(data.mainRule&&Array.isArray(data.mainRule.lines)&&data.mainRule.lines.length){
    mainRule.append(make("p","school-main-rule-label","✦ "+data.mainRule.title));
    const lines=make("div","school-main-rule-lines");
    data.mainRule.lines.forEach(line=>lines.append(make("p","school-main-rule-line",line)));
    mainRule.append(lines);
    if(data.mainRule.note)mainRule.append(make("p","school-main-rule-note",data.mainRule.note));
    mainRule.hidden=false;
  }else{
    mainRule.hidden=true;
  }
  const skill=LESSON_SKILLS[id];
  const outcomes=make("aside","school-outcomes");
  if(skill){outcomes.append(make("p","","После урока: "+skill.outcome),make("p","","Как подтвердить навык: завершить практику и правильно ответить на вопросы."));}
  else{const outcome=manifest[index].outcome;if(outcome)outcomes.append(make("p","","После урока: "+outcome));outcomes.append(make("p","","Порядок работы: прочитайте материал, выполните упражнение и проверьте понимание."));}
  $("lesson-hero").append(outcomes);
  const route=make("nav","school-route-nav");route.setAttribute("aria-label","Этапы урока");
  for(const[key,text]of[["lesson-content","1. Разобраться"],...(skill?[["lesson-drawing","2. Попробовать"]]:[]),["lesson-quiz",skill?"3. Проверить":"2. Проверить"]]){const a=make("a","",text);a.href="pro/school/lesson/?id="+encodeURIComponent(id)+"#"+key;route.append(a);}$("lesson-hero").append(route);
  const root=$("lesson-content");
  root.hidden=false;
  root.replaceChildren();
  {
    data.sections.forEach(section=>{
      const key=section.heading.toLowerCase();
      if(id==="case-independent"&&key.includes("контрольный ключ")){
        const details=make("details","school-answer-key");
        details.append(make("summary","","Проверить свой расчёт"));
        details.append(make("p","",section.text));
        if(section.example)details.append(make("p","school-example",section.example));
        root.append(details);
        return;
      }
      const wrapper=make("section","school-topic");
      wrapper.append(make("h2","school-topic-title",section.heading));
      wrapper.append(make("p","",section.text));
      if(section.example)wrapper.append(make("p","school-example",section.example));
      root.append(wrapper);
    });
    const takeaway=make("section","school-takeaway");
    takeaway.append(make("strong","","Главное, что нужно запомнить"));
    takeaway.append(make("p","",data.takeaway));
    root.append(takeaway);
    if(data.practice){
      const work=make("section","school-workbook");
      work.append(make("h2","school-topic-title","Практика в тетради"));
      work.append(make("p","",data.practice));
      if(["case-clinic","case-independent","final"].includes(data.id))renderCaseWorkbook(work,data.id);
      const details=make("details","school-workbook-editor");
      details.append(make("summary","","Мои заметки к упражнению"));
      const notes=make("textarea","school-workbook-textarea");
      notes.rows=5;
      notes.maxLength=8000;
      notes.placeholder="Запишите свои расчёты, вопросы и выводы...";
      notes.setAttribute("aria-label","Мои заметки к уроку");
      const saveInfo=make("p","school-workbook-save","Черновик хранится только в этом браузере. Не записывайте реальные личные данные клиентов.");
      const noteKey="numerologia-online-school-notes-"+data.id;
      try{notes.value=localStorage.getItem(noteKey)||""}
      catch{saveInfo.textContent="Сохранение в браузере недоступно. Скопируйте заметки перед выходом."}
      notes.addEventListener("input",()=>{
        try{localStorage.setItem(noteKey,notes.value);saveInfo.textContent="Черновик сохранён в этом браузере."}
        catch{saveInfo.textContent="Сохранение недоступно. Скопируйте текст перед выходом."}
      });
      details.append(notes,saveInfo);
      work.append(details);
      if(Array.isArray(data.rubric)&&data.rubric.length){
        const check=make("details","school-workbook-checklist");
        check.append(make("summary","","Самопроверка перед тестом"));
        const list=make("div","school-workbook-checklist-items");
        data.rubric.forEach(item=>{
          const label=make("label","school-workbook-check");
          const box=make("input");
          box.type="checkbox";
          label.append(box,make("span","",item));
          list.append(label);
        });
        check.append(list);
        work.append(check);
      }
      root.append(work);
    }
  }
  renderQuiz(data);
  renderNavigation();
  setupDiagram();
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
      const notice=make("aside","school-prereq-note");notice.append(document.createTextNode("Для этого урока пригодится: "+firstMissing.title+". "));const a=make("a","","Повторить →");a.href="pro/school/lesson/?id="+encodeURIComponent(firstMissing.id);notice.append(a);$("lesson-hero").before(notice);
    }
    const response=await fetch(manifest[index].file+"?v=20261102learn1");
    if(!response.ok)throw Error("Материал урока не найден");
    lesson=await response.json();
    if(lesson.id!==id||!Array.isArray(lesson.sections)||!Array.isArray(lesson.questions))
      throw Error("Материал урока неполный");
    renderLesson(lesson);
  }catch(error){
    console.error("Школа: урок",error);
    const notice=$("lesson-error");
    notice.hidden=false;
    notice.textContent="Не получилось загрузить урок. Проверьте интернет и попробуйте открыть его снова.";
    $("lesson-title").textContent="Урок временно недоступен";
  }
}
start();
