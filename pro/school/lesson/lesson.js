import { calculateMatrix, parseBirthDate } from "../../../numerology-core.js?v=4";
import { nodesFor } from "../../pro-points.js?v=2";

const $ = (id) => document.getElementById(id);
const make = (tag, className, value) => {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (value !== undefined) item.textContent = String(value);
  return item;
};
const svgNS = "http://www.w3.org/2000/svg";
const makeSvg = (tag, attrs = {}) => {
  const item = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attrs)) item.setAttribute(name, String(value));
  return item;
};
const storeKey = "numerologia-online-pro-school-v1";
let lesson, manifest, index = -1, currentBirth = {day:14,month:7,year:1990}, step = 0;
const params = new URLSearchParams(location.search);
const id = params.get("id") || "start";
const diagram = $("lesson-diagram");
const stepTitles = [
  "Нарисуйте ромб и квадрат",
  "Впишите день, месяц и год",
  "Найдите нижнюю опору",
  "Посчитайте центральную энергию",
  "Заполните четыре угла"
];
const stepDescriptions = [
  "На листе нарисуйте ромб: вершины сверху, справа, снизу и слева. Наложите на ромб прямой квадрат и проведите вертикальную и горизонтальную линии через центр. Девять кружков пока пустые.",
  "Число дня рождения ставим слева, месяца - сверху, сумму цифр года - справа. Большие числа приводим к диапазону 1-22 сложением цифр.",
  "Нижняя опора - сумма трёх уже записанных чисел: левого, верхнего и правого. Если получилось больше 22, сложите цифры результата.",
  "Центр - сумма четырёх опор: левой, верхней, правой и нижней. Не путайте с центром родового квадрата.",
  "Каждый угол квадрата - сумма двух соседних вершин ромба. Теперь у вас заполнены все девять основных мест."
];

const firstLessonSteps=[
 {title:"Нарисуйте большой ромб",text:"Отметьте сверху, справа, снизу и слева по одной точке. Соедините их линиями. Получился ромб.",hint:"На этом шаге никаких цифр. Только четыре вершины."},
 {title:"Добавьте прямой квадрат",text:"Между вершинами ромба отметьте ещё четыре точки: сверху слева, сверху справа, снизу справа и снизу слева. Соедините их в квадрат.",hint:"Теперь снаружи восемь точек: четыре у ромба и четыре у квадрата."},
 {title:"Найдите центр",text:"Проведите линию слева направо и линию сверху вниз. На пересечении нарисуйте девятый кружок.",hint:"Появился центр. Сами числа научимся считать в следующих уроках."},
 {title:"Подпишите места",text:"Сверху подпишите «месяц рождения», слева «день рождения», справа «год рождения», снизу «сумма». Четыре угла и центр пока оставьте пустыми. Всего девять кружков.",hint:"На схеме пока нет ни одного числа. В следующем уроке научимся их вычислять. Теперь можно открыть тест."}
];
function drawFirstLessonOutline(){
  const svg=makeSvg("svg",{viewBox:"0 0 400 400",role:"img","aria-label":"Пошаговая пустая матрица"});
  svg.append(makeSvg("polygon",{points:"200,42 358,200 200,358 42,200","class":"school-diagram-outline"}));
  if(step>=1)svg.append(makeSvg("rect",{x:88,y:88,width:224,height:224,"class":"school-diagram-outline"}));
  if(step>=2){
    [[200,42,200,358],[42,200,358,200]].forEach(([x1,y1,x2,y2])=>
      svg.append(makeSvg("line",{x1,y1,x2,y2,"class":"school-diagram-line"})));
  }
  const points=[
    [200,42,"Месяц рождения",0],[358,200,"Год рождения",0],[200,358,"Сумма",0],[42,200,"День рождения",0],
    [88,88,"Угол",1],[312,88,"Угол",1],[312,312,"Угол",1],[88,312,"Угол",1],
    [200,200,"Центр",2]
  ];
  for(const [x,y,label,minStep]of points){
    if(step<minStep)continue;
    const group=makeSvg("g",{"class":"school-graph-node is-revealed"+(label==="Центр"?" is-center":"")});
    group.append(makeSvg("circle",{cx:x,cy:y,r:label==="Центр"?22:17}));
    const title=makeSvg("title");title.textContent=label+" - место для числа";
    group.append(title);svg.append(group);
  }
  diagram.replaceChildren(svg);
  // Подписи вынесены ЗА пределы SVG, а не лежат поверх линий матрицы.
  if(step===3){
    const legend=make("div","school-position-key");
    legend.setAttribute("aria-label","Расположение четырёх опорных позиций");
    for(const [arrow,label] of [
      ["↑","Месяц рождения"],
      ["←","День рождения"],
      ["→","Год рождения"],
      ["↓","Сумма"]
    ]){
      const chip=make("div","school-position-chip");
      chip.append(make("span","school-position-arrow",arrow),make("span","",label));
      legend.append(chip);
    }
    diagram.append(legend);
  }
}

const stageKeys = [
  [], ["left","top","right"], ["left","top","right","bottom"],
  ["left","top","right","bottom","center"],
  ["left","top","right","bottom","center","topLeft","topRight","bottomLeft","bottomRight"]
];

function drawBasic(matrix) {
  const svg = makeSvg("svg",{viewBox:"0 0 400 400",role:"img","aria-label":"Матрица: девять опорных мест с числами по выбранному шагу"});
  svg.append(makeSvg("polygon",{points:"200,35 365,200 200,365 35,200","class":"school-diagram-outline"}));
  svg.append(makeSvg("rect",{x:83,y:83,width:234,height:234,"class":"school-diagram-outline"}));
  [[200,35,200,365],[35,200,365,200],[83,83,317,317],[317,83,83,317]].forEach(([x1,y1,x2,y2]) =>
    svg.append(makeSvg("line",{x1,y1,x2,y2,"class":"school-diagram-line"})));
  const nodes = [
    ["top",200,35,matrix.top,"Месяц"],["right",365,200,matrix.right,"Год"],
    ["bottom",200,365,matrix.bottom,"Низ"],["left",35,200,matrix.left,"День"],
    ["center",200,200,matrix.center,"Центр"],
    ["topLeft",83,83,matrix.corners.topLeft,"Угол"],["topRight",317,83,matrix.corners.topRight,"Угол"],
    ["bottomRight",317,317,matrix.corners.bottomRight,"Угол"],["bottomLeft",83,317,matrix.corners.bottomLeft,"Угол"]
  ];
  for (const [key,x,y,value,label] of nodes) {
    const shown=stageKeys[step].includes(key);
    const group=makeSvg("g",{"class":shown?"school-graph-node is-revealed":"school-graph-node"});
    group.append(makeSvg("circle",{cx:x,cy:y,r:key==="center"?24:20}));
    const text=makeSvg("text",{x,y:y+1,"text-anchor":"middle","dominant-baseline":"middle"});
    text.textContent=shown?String(value):"?";
    group.append(text);
    const title=makeSvg("title");title.textContent=label+(shown?": "+value:" - пока пусто");group.append(title);
    svg.append(group);
  }
  diagram.replaceChildren(svg);
}

function drawAllPositions(matrix) {
  const svg=makeSvg("svg",{viewBox:"0 0 620 806",role:"img","aria-label":"Все 31 позиции рассчитанной матрицы"});
  svg.append(makeSvg("polygon",{points:"310,34 506,114 586,310 506,506 310,586 114,506 34,310 114,114","class":"school-diagram-outline"}));
  svg.append(makeSvg("rect",{x:114,y:114,width:392,height:392,"class":"school-diagram-outline"}));
  svg.append(makeSvg("polygon",{points:"310,34 586,310 310,586 34,310","class":"school-diagram-outline"}));
  [[310,68,310,552],[68,310,552,310],[114,114,506,506],[506,114,114,506]].forEach(([x1,y1,x2,y2]) =>
    svg.append(makeSvg("line",{x1,y1,x2,y2,"class":"school-diagram-line"})));
  for(const point of nodesFor(currentBirth,matrix)){
    const group=makeSvg("g",{"class":"school-graph-node is-revealed"+(point.kind==="center"?" is-center":"")});
    const radius=point.kind==="center"?28:point.kind==="major"?25:15;
    group.append(makeSvg("circle",{cx:point.x,cy:point.y,r:radius}));
    const text=makeSvg("text",{x:point.x,y:point.y+1,"text-anchor":"middle","dominant-baseline":"middle","font-size":radius<=15?17:22});
    text.textContent=String(point.value);
    group.append(text);
    const title=makeSvg("title");title.textContent=point.label+": "+point.value;group.append(title);
    svg.append(group);
  }
  diagram.replaceChildren(svg);
}

function drawCurrent() {
  if(id==="start"){
    const info=firstLessonSteps[step];
    drawFirstLessonOutline();
    $("lesson-step-count").textContent="ШАГ "+(step+1)+" ИЗ "+firstLessonSteps.length;
    $("lesson-step-title").textContent=info.title;
    $("lesson-step-text").textContent=info.text;
    // В первом уроке нет блока примеров: всё нужное видно на рисунке и в шаге.
    $("lesson-step-formula").hidden=true;
    $("lesson-step-back").disabled=step===0;
    const next=$("lesson-step-next");
    next.disabled=false;
    next.textContent=step===firstLessonSteps.length-1?"Открыть тест ✓":"Следующий шаг →";
    return;
  }
  $("lesson-step-formula").hidden=false;
  const m=calculateMatrix(currentBirth);
  const full=id==="internal"&&step===4;
  if(full) drawAllPositions(m);
  else drawBasic(m);
  $("lesson-step-count").textContent="ШАГ "+(step+1)+" ИЗ 5";
  $("lesson-step-title").textContent=stepTitles[step];
  $("lesson-step-text").textContent=stepDescriptions[step];
  const examples=[
    "Пока ничего не считаем - рисуем девять мест.",
    "Слева "+m.left+", сверху "+m.top+", справа "+m.right+".",
    m.left+" + "+m.top+" + "+m.right+" → "+m.bottom+".",
    m.left+" + "+m.top+" + "+m.right+" + "+m.bottom+" → "+m.center+".",
    "Углы: "+m.corners.topLeft+", "+m.corners.topRight+", "+m.corners.bottomRight+", "+m.corners.bottomLeft+"."
  ];
  $("lesson-step-formula").textContent=full?"Готовая основа. Теперь показаны все 31 позиции нашей интерактивной матрицы.":examples[step];
  $("lesson-step-back").disabled=step===0;
  $("lesson-step-next").disabled=step===4;
  $("lesson-step-next").textContent="Следующий шаг →";
}
function unlockFirstLessonQuiz(){
  if(id!=="start")return;
  const root=$("lesson-quiz");
  root.classList.remove("is-locked");
  root.setAttribute("aria-disabled","false");
  const notice=$("lesson-quiz-lock");
  if(notice)notice.hidden=true;
  root.querySelectorAll("fieldset").forEach(fieldset=>{fieldset.disabled=false});
  const button=root.querySelector('button[type="submit"]');
  if(button)button.disabled=false;
  $("lesson-step-next").textContent="✓ Тест открыт";
  $("lesson-step-next").disabled=true;
  root.scrollIntoView({behavior:"smooth",block:"start"});
}
function setupDiagram(){
  if(index>4)return;
  $("lesson-drawing").hidden=false;
  if(id==="start"){
    $("lesson-drawing-title").textContent="Рисуем матрицу шаг за шагом";
    $("lesson-drawing-description").textContent="Возьмите лист бумаги. Смотрите на схему, повторяйте действие и нажимайте «Следующий шаг». Числа пока считать не нужно.";
    // Первый урок - построение ПУСТОЙ схемы. Ввод даты появится в следующих уроках.
    $("lesson-date-form").hidden=true;
  }
  step=id==="start"?0:([0,1,1,3,4][index]??0);
  $("lesson-step-back").addEventListener("click",()=>{
    step=Math.max(0,step-1);
    drawCurrent();
  });
  $("lesson-step-next").addEventListener("click",()=>{
    const max=id==="start"?firstLessonSteps.length-1:4;
    if(id==="start"&&step===max){
      unlockFirstLessonQuiz();
      return;
    }
    step=Math.min(max,step+1);
    drawCurrent();
  });
  const input=$("lesson-date");
  const error=$("lesson-date-error");
  const button=$("lesson-date-submit");
  const confirmed=$("lesson-date-confirmed");
  const resetConfirmation=()=>{
    button.textContent="Использовать";
    button.classList.remove("is-confirmed");
    button.setAttribute("aria-label","Использовать выбранную дату");
    confirmed.hidden=true;
  };
  input.addEventListener("input",()=>{
    const digits=input.value.replace(/\D/g,"").slice(0,8);
    input.value=[digits.slice(0,2),digits.slice(2,4),digits.slice(4,8)].filter(Boolean).join(".");
    error.hidden=true;
    resetConfirmation();
  });
  $("lesson-date-form").addEventListener("submit",event=>{
    event.preventDefault();
    const birth=parseBirthDate(input.value);
    if(!birth){
      error.hidden=false;
      error.textContent="Проверьте дату в формате ДД.ММ.ГГГГ.";
      resetConfirmation();
      return;
    }
    error.hidden=true;
    currentBirth=birth;
    drawCurrent();
    button.textContent="✓";
    button.classList.add("is-confirmed");
    button.setAttribute("aria-label","Дата выбрана: "+input.value);
    confirmed.textContent="✓ Дата "+input.value+" выбрана. Можно продолжать урок.";
    confirmed.hidden=false;
  });
  drawCurrent();
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

  const retry=make("button","school-quiz-retry","↻ Пройти урок ещё раз");
  retry.type="button";
  retry.hidden=true;
  retry.addEventListener("click",()=>{
    form.querySelectorAll('input[type="radio"]').forEach(input=>{input.checked=false});
    feedback.textContent="";
    feedback.classList.remove("is-incorrect","is-correct");
    retry.hidden=true;
    submit.textContent="Проверить знания";
    if(id==="start"){
      // Возвращаем к первому шагу и снова закрываем тест до его прохождения.
      step=0;
      drawCurrent();
      root.classList.add("is-locked");
      root.setAttribute("aria-disabled","true");
      const lock=$("lesson-quiz-lock");
      if(lock)lock.hidden=false;
      root.querySelectorAll("fieldset").forEach(fieldset=>{fieldset.disabled=true});
      submit.disabled=true;
      $("lesson-drawing").scrollIntoView({behavior:"smooth",block:"start"});
    }else{
      const content=$("lesson-content");
      content.scrollIntoView({behavior:"smooth",block:"start"});
    }
  });
  form.append(retry);
  form.addEventListener("submit",event=>{
    event.preventDefault();
    const answers=data.questions.map((_,i)=>form.querySelector(`input[name="quiz-${i}"]:checked`));
    if(answers.some(a=>!a)){feedback.textContent="Выберите ответ на каждый вопрос.";return}
    const score=answers.filter((a,i)=>Number(a.value)===data.questions[i].correct).length;
    if(score===data.questions.length){
      try{
        const items=JSON.parse(localStorage.getItem(storeKey)||"[]");
        const done=new Set(Array.isArray(items)?items:[]);
        done.add(data.id);
        localStorage.setItem(storeKey,JSON.stringify([...done]));
      }catch{/* Без хранилища урок всё равно работает. */}
      feedback.classList.remove("is-incorrect");
      feedback.classList.add("is-correct");
      feedback.textContent="Отлично! Урок пройден. Можно переходить к следующему.";
      retry.hidden=true;
      submit.textContent="✓ Урок пройден";
      // После успешного теста показываем поздравление и следующую ссылку,
      // а не оставляем ученика среди ответов на вопросы.
      feedback.scrollIntoView({behavior:"smooth",block:"center"});
    }else{
      feedback.classList.remove("is-correct");
      feedback.classList.add("is-incorrect");
      feedback.textContent="Пройдите ещё раз урок. Это займёт немного времени, зато вы точно усвоите материал.";
      retry.hidden=false;
    }
  });
  root.append(form);
  if(id==="start"){
    root.classList.add("is-locked");
    root.setAttribute("aria-disabled","true");
    const notice=make("p","school-quiz-locked-info","🔒 Тест станет доступен после всех четырёх шагов.");
    notice.id="lesson-quiz-lock";
    root.insertBefore(notice,form);
    root.querySelectorAll("fieldset").forEach(fieldset=>{fieldset.disabled=true});
    submit.disabled=true;
  }
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
  if(prev)nav.append(link(prev,"← Предыдущий урок","school-secondary"));
  nav.append(link({id:"",title:""},"Вся программа","school-lesson-all"));
  nav.lastElementChild.href="pro/school/";
  if(next)nav.append(link(next,"Следующий урок →","school-primary"));
}
function renderLesson(data) {
  document.title=data.title+" | Школа нумерологов";
  $("lesson-count").textContent="УРОК "+(index+1)+" ИЗ "+manifest.length+" · "+data.level;
  $("lesson-title").textContent=id==="start"?"Рисуем матрицу с нуля":data.title;
  $("lesson-lead").textContent=data.lead;
  if(id==="start"){
    // Объяснение начинается непосредственно в шагах: два вступления подряд не нужны.
    $("lesson-hero").classList.add("is-compact");
    $("lesson-drawing").classList.add("is-first-lesson");
  }
  const root=$("lesson-content");
  // Первый урок: все объяснения находятся рядом с рисунком по шагам.
  // Не повторяем ту же информацию длинной статьёй ниже.
  root.hidden=id==="start";
  root.replaceChildren();
  if(id!=="start"){
    data.sections.forEach(section=>{
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
  }
  renderQuiz(data);
  renderNavigation();
  setupDiagram();
}
async function start() {
  try{
    const res=await fetch("pro/school/lessons-manifest.json?v=1");
    if(!res.ok)throw Error("Список уроков не найден");
    const meta=await res.json();
    if(meta.schema!=="pro-school-lessons-manifest-v1"||!Array.isArray(meta.lessons))throw Error("Некорректная программа");
    manifest=meta.lessons;
    index=manifest.findIndex(item=>item.id===id);
    if(index<0)throw Error("Урок не найден");
    const response=await fetch(manifest[index].file+"?v=5");
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
