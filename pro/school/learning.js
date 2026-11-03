import { calculateMatrix } from '../../numerology-core.js?v=5';
import { BASIC_KEYS, EXAMPLE_DATES, LESSON_SKILLS, constructionSteps, purposeSteps, reductionTasks, learningBirthDate } from './construction-model.js?v=20261102learn1';

const element=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const button=(text,action,cls='learning-secondary')=>{const n=element('button',cls,text);n.type='button';n.addEventListener('click',action);return n;};
const appendText=(root,text,cls)=>{const p=element('p',cls,text);root.append(p);return p;};
const svgNS='http://www.w3.org/2000/svg';
const svg=(tag,attrs)=>{const n=document.createElementNS(svgNS,tag);for(const[k,v]of Object.entries(attrs||{}))n.setAttribute(k,String(v));return n;};

export function bindStepSwipe(node,{previous,next}){
  let start=null;
  node.addEventListener('touchstart',event=>{
    start=null;
    let target=event.target;
    while(target&&target!==node){if(['INPUT','TEXTAREA','BUTTON','SELECT','A','LABEL','SUMMARY'].includes(String(target.tagName).toUpperCase()))return;target=target.parentNode;}
    if(event.touches?.length!==1){start=null;return;}
    start={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  node.addEventListener('touchend',event=>{
    if(!start||event.changedTouches?.length!==1)return;
    const dx=event.changedTouches[0].clientX-start.x,dy=event.changedTouches[0].clientY-start.y;start=null;
    if(Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy)*1.5)return;
    if(dx<0)next();else previous();
  },{passive:true});
  node.addEventListener('touchcancel',()=>{start=null;},{passive:true});
}

export function renderStepStrip(root,{titles,active,onSelect,allowed=()=>true,prefix='Шаг',panelId='lesson-current-step'}){
  root.replaceChildren();root.classList.add('lesson-step-strip');root.setAttribute('role','tablist');root.setAttribute('aria-label',prefix==='Вопрос'?'Вопросы проверки':'Шаги урока');
  titles.forEach((title,i)=>{
    const tab=button(prefix+' '+(i+1),()=>onSelect(i),'lesson-step-tab');tab.id=panelId+'-tab-'+i;tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(active===i));tab.setAttribute('aria-controls',panelId);tab.setAttribute('aria-label',prefix+' '+(i+1)+' из '+titles.length+'. '+title);tab.tabIndex=active===i?0:-1;tab.disabled=!allowed(i);
    if(active===i)tab.classList.add('is-active');
    tab.addEventListener('keydown',event=>{
      let next=event.key==='ArrowRight'?i+1:event.key==='ArrowLeft'?i-1:event.key==='Home'?0:event.key==='End'?titles.length-1:null;
      if(next===null)return;event.preventDefault();next=Math.min(titles.length-1,Math.max(0,next));if(allowed(next))onSelect(next);
    });root.append(tab);
  });
}

function addDiagramZoom(root,draw){
  const enlarge=button('⤢ Увеличить',()=>{
    const dialog=element('dialog','lesson-zoom-dialog');dialog.setAttribute('aria-label','Увеличенная интерактивная схема');
    const close=button('Закрыть ×',()=>{dialog.close();dialog.remove();enlarge.focus({preventScroll:true});},'lesson-zoom-close');
    const body=element('div','lesson-zoom-body');draw(body);dialog.append(close,body);root.append(dialog);
    dialog.addEventListener('cancel',()=>dialog.remove());
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  },'lesson-zoom-button');root.append(enlarge);
}

function guideFigure(root,lesson,step){
  const birth=learningBirthDate('14.07.1990'),all=constructionSteps(birth),spec=LESSON_SKILLS[lesson.id];
  const figure=element('figure','lesson-figure'),frame=element('div','lesson-figure-drawing');
  const caption=element('figcaption','lesson-point-detail');caption.hidden=true;caption.setAttribute('role','status');caption.setAttribute('aria-live','polite');
  if(lesson.id==='reduce'){
    const task=reductionTasks()[Math.min(step,reductionTasks().length-1)],row=element('div','lesson-number-rule');
    row.append(element('span','',task.raw),element('b','','→'),element('span','',task.value));frame.append(row,element('p','lesson-number-trace',task.expression));figure.append(frame);root.append(figure);return;
  }
  let keys=spec?.keys||all.map(n=>n.id),active=[];
  if(lesson.id==='start')keys=step===0?BASIC_KEYS.slice(0,4):step===1?BASIC_KEYS.filter(k=>k!=='center'):BASIC_KEYS;
  if(lesson.id==='base')active=[BASIC_KEYS[Math.min(step,4)]];
  if(lesson.id==='corners')active=step<4?[BASIC_KEYS[step+5]]:BASIC_KEYS.slice(5);
  if(lesson.id==='internal')active=spec.keys.slice(Math.max(0,step-1)*3,Math.max(0,step-1)*3+3);
  if(lesson.id==='diagonals')active=spec.keys.slice(Math.max(0,step-1)*2,Math.max(0,step-1)*2+2);
  if(lesson.id==='tail')active=spec.keys;
  if(lesson.id==='channels')active=spec.keys;
  if(lesson.id==='purpose')keys=BASIC_KEYS;
  if(lesson.id==='money-practice')active=['rightNear','wellbeing','moneyPoint'];
  if(lesson.id==='love-practice')active=['tailFirst','wellbeing','loveHeart'];
  if(lesson.id==='lineage-practice')active=['topLeft','topRight','bottomRight','bottomLeft','center'];
  if(lesson.id==='talents-practice')active=['top','topNear','topOuter','topCore'];
  const visible=new Set([...BASIC_KEYS,...keys]);if(lesson.id==='start')visible.clear(),keys.forEach(k=>visible.add(k));
  const draw=target=>{
    const canvas=svg('svg',{viewBox:'0 0 620 620',role:'group',class:'learning-canvas'+(visible.size<=9?' is-basic':''),'aria-label':'Интерактивная схема урока'});
    canvas.append(svg('polygon',{points:'310,52 568,310 310,568 52,310',class:'learning-outline'}));
    if(lesson.id!=='start'||step>0)canvas.append(svg('rect',{x:128,y:128,width:364,height:364,class:'learning-outline'}));
    if(lesson.id!=='start'||step>1)for(const[x1,y1,x2,y2]of[[310,52,310,568],[52,310,568,310],[128,128,492,492],[492,128,128,492]])canvas.append(svg('line',{x1,y1,x2,y2,class:'learning-line'}));
    for(const n of all.filter(n=>visible.has(n.id))){
      const group=svg('g',{class:'learning-node'+(active.includes(n.id)?' is-target':''),role:'button',tabindex:'0','aria-label':n.title+'. '+n.position});
      group.append(svg('circle',{cx:n.x,cy:n.y,r:32,class:'learning-node-hit',style:'fill:transparent;stroke:none;pointer-events:all'}),svg('circle',{cx:n.x,cy:n.y,r:n.kind==='center'?27:23}));
      const value=svg('text',{x:n.x,y:n.y+6,'text-anchor':'middle',class:'learning-node-value'});value.textContent=lesson.id==='start'?'':lesson.id==='build-independent'?'?':n.value;group.append(value);
      const choose=()=>{
        for(const item of canvas.querySelectorAll('g'))item.classList.remove('is-selected');group.classList.add('is-selected');
        const text=lesson.id==='start'?n.title+'. '+n.position:lesson.id==='build-independent'?n.title+'. '+n.position:n.title+': '+n.expression;
        caption.textContent=text;caption.hidden=false;
        const inDialog=target.parentNode?.tagName?.toLowerCase()==='dialog';if(inDialog){target.parentNode.close();target.parentNode.remove();}
      };
      group.addEventListener('click',choose);group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();}});canvas.append(group);
    }
    if(lesson.id!=='start'||step>=3)for(const[x,y,text]of[[310,19,'МЕСЯЦ'],[590,280,'ГОД'],[310,606,'НИЖНЯЯ'],[25,280,'ДЕНЬ']]){const label=svg('text',{x,y,'text-anchor':'middle',class:'learning-diagram-label'});label.textContent=text;canvas.append(label);}
    target.append(canvas);
  };
  draw(frame);figure.append(frame,caption);addDiagramZoom(figure,draw);root.append(figure);
}

export function mountLessonGuide(root,{lesson,renderWorkbook=()=>{},onPractice=()=>{},onQuiz=()=>{}}){
  let at=0;
  const sections=lesson.sections||[],hasWorkbook=Boolean(lesson.practice);
  const titles=[...sections.map(s=>s.heading),...(hasWorkbook?['Самостоятельная работа']:[])];
  const key='numi-school-reading-step-v1:'+lesson.id;
  try{const saved=Number(localStorage.getItem(key));if(Number.isInteger(saved)&&saved>=0&&saved<titles.length)at=saved;}catch{}
  const go=index=>{at=Math.max(0,Math.min(titles.length-1,index));try{localStorage.setItem(key,String(at));}catch{}render();const active=root.querySelector('.lesson-step-tab.is-active');active?.focus({preventScroll:true});active?.scrollIntoView({block:'nearest',inline:'center'});};
  function render(){
    root.replaceChildren();root.classList.add('lesson-player');root.hidden=false;
    guideFigure(root,lesson,at);
    const strip=element('nav');renderStepStrip(strip,{titles,active:at,onSelect:go});root.append(strip);
    const panel=element('section','lesson-slide');panel.id='lesson-current-step';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','lesson-current-step-tab-'+at);
    const section=sections[at],title=section?section.heading.replace(/^Шаг\s*\d+[.:]\s*/i,''):titles[at];
    panel.append(element('h2','lesson-slide-title',title));
    const body=element('div','lesson-slide-body');
    if(section){
      if(lesson.id==='case-independent'&&section.heading.toLowerCase().includes('контрольный ключ')){
        const details=element('details','school-answer-key');details.append(element('summary','','Открыть контрольный расчёт'),element('p','',section.text));if(section.example)details.append(element('p','school-example',section.example));body.append(details);
      }else{
        appendText(body,section.text);
        if(section.example){if(section.example.length>170){const example=element('details','lesson-example');example.append(element('summary','','Пример и пояснение'),element('p','school-example',section.example));body.append(example);}else appendText(body,section.example,'school-example');}
      }
    }else renderWorkbook(body);
    if(at===titles.length-1&&lesson.takeaway){const takeaway=element('details','lesson-takeaway');takeaway.append(element('summary','','Главное из урока'),element('p','',lesson.takeaway));body.append(takeaway);}
    panel.append(body);root.append(panel);
    const footer=element('div','lesson-slide-navigation'),back=button('← Назад',()=>go(at-1));back.disabled=at===0;footer.append(back,element('span','lesson-slide-count',(at+1)+' / '+titles.length));
    footer.append(button(at<titles.length-1?'Далее →':LESSON_SKILLS[lesson.id]?'К практике →':'К проверке →',()=>{if(at<titles.length-1)go(at+1);else if(LESSON_SKILLS[lesson.id])onPractice();else onQuiz();},'school-primary'));root.append(footer);
    bindStepSwipe(panel,{previous:()=>{if(at>0)go(at-1);},next:()=>{if(at<titles.length-1)go(at+1);}});
  }
  render();return {goTo:go,getState:()=>({at,total:titles.length})};
}

export function mountConstruction(root,{lessonId='base',onComplete=()=>{},onQuiz=null,standalone=false,embedded=false}={}) {
  const spec=LESSON_SKILLS[lessonId]||LESSON_SKILLS['build-independent'];
  const checkpointKey='numi-school-building-v2:'+lessonId;
  let date=spec.independent?'08.09.1987':EXAMPLE_DATES[0],mode=spec.independent||embedded?'practice':'example',at=0,solved=new Set(),chosen=null,hint=0,feedback='',feedbackKind='',answerValue='',assisted=new Set();
  let completedNotified=false;
  let settingsOpen=false;
  try{const saved=JSON.parse(localStorage.getItem(checkpointKey)||'null');if(saved&&learningBirthDate(saved.date)&&saved.mode==='practice'&&Array.isArray(saved.solved)){date=saved.date;mode='practice';solved=new Set(saved.solved);assisted=new Set(saved.assisted||[]);}}catch{}
  const save=()=>{try{localStorage.setItem(checkpointKey,JSON.stringify({date,mode,solved:[...solved],assisted:[...assisted]}));}catch{}};
  const getTasks=()=>{
    const birth=learningBirthDate(date),m=calculateMatrix(birth);
    if(spec.kind==='reduction')return reductionTasks();
    if(spec.kind==='purpose')return purposeSteps(m);
    const all=constructionSteps(birth,m),map=new Map(all.map(n=>[n.id,n]));return spec.keys.map(k=>map.get(k));
  };
  const reset=(nextMode=mode)=>{mode=nextMode;at=0;solved.clear();assisted.clear();chosen=null;hint=0;feedback='';feedbackKind='';answerValue='';completedNotified=false;onComplete(false);save();render();};
  let tasks=getTasks();
  solved=new Set([...solved].filter(id=>tasks.some(task=>task.id===id)));
  assisted=new Set([...assisted].filter(id=>tasks.some(task=>task.id===id)));
  if(mode==='practice'){at=tasks.findIndex(t=>!solved.has(t.id));if(at<0)at=tasks.length;}
  const canVisit=i=>{const missing=tasks.findIndex(t=>!solved.has(t.id));return mode==='example'||i<=(missing<0?tasks.length-1:missing);};
  const goTo=i=>{
    if(i<0||i>=tasks.length||!canVisit(i))return;
    at=i;chosen=null;hint=0;feedback='';answerValue=solved.has(tasks[i].id)?String(tasks[i].value):'';render();save();const active=root.querySelector('.lesson-step-tab.is-active');active?.focus({preventScroll:true});active?.scrollIntoView({block:'nearest',inline:'center'});
  };
  const advance=()=>{
    if(mode==='practice'&&!solved.has(tasks[at]?.id)){feedback='Сначала проверьте ответ на этом шаге.';feedbackKind='is-hint';render();return;}
    if(at<tasks.length-1){goTo(at+1);return;}at=tasks.length;chosen=null;hint=0;feedback='';answerValue='';render();save();
  };
  function drawDiagram(container,task) {
    if(spec.kind==='reduction')return;
    const m=calculateMatrix(learningBirthDate(date)),all=constructionSteps(learningBirthDate(date),m),selectedIds=new Set(tasks.map(t=>t.id));
    const contextIds=new Set();
    const visit=key=>{const n=all.find(n=>n.id===key);if(!n)return;for(const dep of n.dependencies){if(!selectedIds.has(dep))contextIds.add(dep);visit(dep);}};
    tasks.forEach(t=>visit(t.id));
    const visibleIds=new Set([...BASIC_KEYS,...selectedIds,...contextIds]);
    const pool=spec.kind==='purpose'?all.filter(n=>BASIC_KEYS.includes(n.id)):all.filter(n=>visibleIds.has(n.id));
    const canvas=svg('svg',{viewBox:'0 0 620 620',role:'group',class:'learning-canvas'+(pool.length<=9?' is-basic':''),'aria-label':mode==='practice'?'Выберите место для точки на матрице':'Матрица с выделенной текущей точкой'});
    canvas.append(svg('polygon',{points:'310,52 568,310 310,568 52,310',class:'learning-outline'}),svg('rect',{x:128,y:128,width:364,height:364,class:'learning-outline'}));
    for(const[x1,y1,x2,y2]of[[310,52,310,568],[52,310,568,310],[128,128,492,492],[492,128,128,492],[310,462,462,310]])canvas.append(svg('line',{x1,y1,x2,y2,class:'learning-line'}));
    for(const n of pool){
      const known=(spec.kind==='purpose')||contextIds.has(n.id)||solved.has(n.id)||(mode==='example'&&selectedIds.has(n.id)&&tasks.findIndex(t=>t.id===n.id)<=at);
      const active=task?.id===n.id,dep=task?.dependencies?.includes(n.id);
      const interactive=mode==='practice'&&task&&spec.kind!=='purpose'&&!solved.has(task.id);
      const g=svg('g',{class:'learning-node'+(active&&mode==='example'?' is-target':'')+(dep&&mode==='example'?' is-source':'')+(chosen===n.id?' is-selected':'')+(solved.has(n.id)?' is-solved':''),role:interactive?'button':'img',...(interactive?{tabindex:'0','aria-pressed':String(chosen===n.id)}:{}),'aria-label':'Позиция '+n.number+'. '+n.position+(known&&spec.kind!=='placement'?' Значение '+n.value+'.':'')});
      const title=svg('title');title.textContent='Позиция '+n.number+': '+n.position;g.append(title);
      g.append(svg('circle',{cx:n.x,cy:n.y,r:32,class:'learning-node-hit',style:'fill:transparent;stroke:none;pointer-events:all'}),svg('circle',{cx:n.x,cy:n.y,r:n.kind==='center'?27:21}));
      const value=svg('text',{x:n.x,y:n.y+6,'text-anchor':'middle',class:'learning-node-value'});
      value.textContent=spec.kind==='placement'?String(n.number):known?String(n.value):'?';g.append(value);
      if(spec.kind!=='placement'&&!known){const label=svg('text',{x:n.x+23,y:n.y-19,'text-anchor':'middle',class:'learning-node-index'});label.textContent=n.number;g.append(label);}
      const choose=()=>{if(!interactive)return;chosen=n.id;feedback='';render();root.querySelector('.learning-answer input')?.focus({preventScroll:true});};
      g.addEventListener('click',choose);g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();}});canvas.append(g);
    }
    for(const[x,y,label]of[[310,19,'МЕСЯЦ'],[590,280,'ГОД'],[310,606,'НИЖНЯЯ'],[25,280,'ДЕНЬ']]){const t=svg('text',{x,y,'text-anchor':'middle',class:'learning-diagram-label'});t.textContent=label;canvas.append(t);}
    container.append(canvas);
    if(spec.kind==='purpose'){
      const knownTasks=tasks.filter((t,i)=>solved.has(t.id)||(mode==='example'&&i<at));
      if(knownTasks.length){const sheet=element('details','learning-known');sheet.append(element('summary','','Уже рассчитано · '+knownTasks.length));const list=element('dl');knownTasks.forEach(t=>{list.append(element('dt','',t.title),element('dd','',t.value));});sheet.append(list);container.append(sheet);}
    }
  }
  function finish() {
    appendText(root,spec.independent&&assisted.size?'Матрица собрана с разбором примеров. Чтобы подтвердить самостоятельный навык, возьмите другую дату и пройдите её без кнопки «Показать решение».':'Готово! Все позиции этой практики проверены.','learning-finish-title');
    const passed=mode==='practice'&&(!spec.independent||assisted.size===0);
    if(passed&&!completedNotified){completedNotified=true;onComplete(true);}
    const table=element('table','learning-results'),head=element('tr');head.append(element('th','',spec.kind==='placement'?'Место':'Точка'),element('th','',spec.kind==='placement'?'Позиция':'Значение'));table.append(head);
    tasks.forEach(t=>{const tr=element('tr');tr.append(element('td','',t.title),element('td','',spec.kind==='placement'?t.number:t.value));table.append(tr);});
    const details=element('details','learning-summary');details.append(element('summary','','Проверенный лист расчёта'));details.append(table);root.append(details);
    const actions=element('div','learning-actions');actions.append(button('Другая дата',()=>{date=EXAMPLE_DATES[(EXAMPLE_DATES.indexOf(date)+1)%EXAMPLE_DATES.length];reset('practice');}));
    if(!standalone&&passed)actions.append(button('Перейти к проверке знаний →',()=>{if(onQuiz)onQuiz();else document.getElementById('lesson-quiz')?.scrollIntoView({behavior:'smooth',block:'start'});},'school-primary'));
    root.append(actions);
    appendText(root,'Рассчитанные числа — это проверка арифметики и расположения. Значения энергий изучаются в отдельном разделе.','learning-muted');
  }
  function render() {
    tasks=getTasks();root.replaceChildren();root.classList.add('learning-workshop');root.classList.toggle('is-embedded',embedded);root.classList.toggle('is-finished',at>=tasks.length);
    if(!embedded)root.append(element('h2','learning-workshop-title',spec.goal));
    const settings=element('details','learning-settings');settings.open=settingsOpen;settings.addEventListener('toggle',()=>{settingsOpen=settings.open;});settings.append(element('summary','',(spec.kind==='placement'||spec.kind==='reduction'?'Режим':date+' · режим')+' '+(mode==='example'?'примера':'практики')));
    const modes=element('div','learning-mode');
    if(!spec.independent)modes.append(button('1. Разобранный пример',()=>reset('example'),mode==='example'?'is-active':''));
    modes.append(button(spec.independent?'Построить самостоятельно':'2. Теперь я сам',()=>reset('practice'),mode==='practice'?'is-active':''));if(embedded)settings.append(modes);else root.append(modes);
    if(spec.kind!=='placement'&&spec.kind!=='reduction'){
      const dateForm=element('form','learning-date');dateForm.noValidate=true;
      const label=element('label','','Дата для упражнения'),input=element('input');input.type='text';input.inputMode='numeric';input.maxLength=10;input.value=date;input.setAttribute('aria-label','Дата рождения для построения');label.append(input);
      input.addEventListener('input',()=>{const d=input.value.replace(/\D/g,'').slice(0,8);input.value=[d.slice(0,2),d.slice(2,4),d.slice(4,8)].filter(Boolean).join('.');input.setCustomValidity('');input.removeAttribute('aria-invalid');});
      const apply=element('button','learning-secondary','Использовать дату');apply.type='submit';dateForm.append(label,apply);settings.append(dateForm);
      dateForm.addEventListener('submit',event=>{event.preventDefault();if(!learningBirthDate(input.value)){input.setAttribute('aria-invalid','true');input.setCustomValidity('Введите существующую дату ДД.ММ.ГГГГ от 1900 года до сегодня.');input.reportValidity();return;}date=input.value;reset(mode);});
      appendText(settings,(spec.independent?'Контрольная дата: ':'Учебный пример: ')+date+'. Смена даты начинает новый расчёт.','learning-muted');
    }
    const count=mode==='practice'?solved.size:Math.min(at+1,tasks.length),progress=element('progress');progress.max=tasks.length;progress.value=count;progress.setAttribute('aria-label','Прогресс практики');
    const meter=element('div','learning-progress-meta');meter.append(progress);appendText(meter,mode==='practice'?'Проверено '+solved.size+' из '+tasks.length:'Пример: шаг '+Math.min(at+1,tasks.length)+' из '+tasks.length,'learning-counter');
    if(at>=tasks.length){if(mode==='example'){root.append(button('Теперь построить самому →',()=>reset('practice'),'school-primary'),settings);return;}const image=element('div','learning-map');drawDiagram(image,null);if(spec.kind!=='reduction'){addDiagramZoom(image,target=>drawDiagram(target,null));root.append(image);}root.append(meter);finish();root.append(settings);return;}
    const task=tasks[at];
    const grid=element('div','learning-grid'),image=element('div','learning-map'),panel=element('section','learning-task');
    drawDiagram(image,task);if(spec.kind!=='reduction'){addDiagramZoom(image,target=>drawDiagram(target,task));grid.append(image);}
    const strip=element('nav');renderStepStrip(strip,{titles:tasks.map(t=>t.title),active:at,onSelect:goTo,allowed:canVisit,panelId:'learning-current-step'});grid.append(strip,meter);panel.id='learning-current-step';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','learning-current-step-tab-'+at);
    appendText(panel,task.group,'school-overline');const taskHeading=element('h3','',task.title);taskHeading.tabIndex=-1;panel.append(taskHeading);
    let nextButton=null,answerControls=null;
    if(mode==='example'){
      appendText(panel,task.position||task.rule);if(spec.kind!=='placement'){appendText(panel,task.rule);appendText(panel,task.expression+' → в точке '+task.value,'learning-equation');}
      else appendText(panel,'Найдите выделенный кружок. Номера здесь обозначают места, а не энергии.','learning-equation');
      const actions=element('div','learning-actions');actions.append(button('← Назад',()=>goTo(at-1)));actions.lastChild.disabled=at===0;
      actions.append(button(at===tasks.length-1?'Пример разобран ✓':'Следующая точка →',advance,'school-primary'));panel.append(actions);
    }else{
      appendText(panel,spec.kind==='placement'?'Нажмите нужный кружок. Цифры на схеме — номера мест.':spec.kind==='purpose'?'Рассчитайте показатель. Кружок выбирать не нужно.':spec.kind==='reduction'?'Числа 1–22 сохраняем. Большие приводим по правилу 22.':'Выберите кружок и введите свой результат.');
      const answerForm=element('form','learning-answer');answerForm.noValidate=true;
      answerForm.classList.toggle('is-placement',spec.kind==='placement');
      const answer=element('input');answer.type='number';answer.min='1';answer.max='22';answer.inputMode='numeric';answer.autocomplete='off';answer.setAttribute('aria-label','Ваш результат от 1 до 22');
      answer.value=answerValue;answer.addEventListener('input',()=>{answerValue=answer.value;});answer.disabled=solved.has(task.id);
      if(spec.kind!=='placement'){const label=element('label','','Мой результат');label.append(answer);answerForm.append(label);}
      if(chosen){const n=constructionSteps(learningBirthDate(date)).find(n=>n.id===chosen);appendText(answerForm,'Выбрана позиция '+n.number+'.','learning-chosen');}
      const submit=element('button','school-primary','Проверить шаг');submit.type='submit';submit.disabled=solved.has(task.id);answerForm.append(submit);
      if(embedded){answerControls=element('div','learning-answer-area');if(!solved.has(task.id))answerControls.append(answerForm);else panel.append(answerForm);}else panel.append(answerForm);
      if(feedback){const msg=appendText(answerControls||panel,feedback,'learning-feedback '+feedbackKind);msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');}
      const hints=element('div','learning-hints');hints.append(button(hint?'Ещё подсказка':'Подсказка',()=>{hint=Math.min(2,hint+1);render();}));
      if(hint)appendText(hints,hint===1?(spec.kind==='placement'?task.position:task.rule):((task.position?task.position+' ':'')+'Промежуточная сумма: '+(task.operands.length>1?task.operands.join(' + ')+' = ':'')+task.raw+'. Проверьте, нужно ли приводить её к 22.'));
      if(spec.kind!=='placement')hints.append(button('Показать решение',()=>{assisted.add(task.id);hint=2;feedback=task.expression+'. Повторите вычисление и введите результат сами.';feedbackKind='is-hint';save();render();}));if(!solved.has(task.id))panel.append(hints);
      if(solved.has(task.id))nextButton=button(at===tasks.length-1?'Завершить практику ✓':'Следующая точка →',advance,'school-primary learning-next');
      answerForm.addEventListener('submit',event=>{
        event.preventDefault();if(solved.has(task.id))return;
        answerValue=answer.value;
        if(spec.kind!=='purpose'&&spec.kind!=='reduction'&&chosen!==task.id){feedback=chosen?'Это другое место на схеме. Сверьте название точки и её расположение.':'Сначала выберите место на схеме.';feedbackKind='is-error';render();return;}
        const value=Number(answer.value);
        if(spec.kind!=='placement'&&(!Number.isInteger(value)||value<1)){feedback='Введите целое число от 1 до 22.';feedbackKind='is-error';render();return;}
        if(spec.kind!=='placement'&&value!==task.value){feedback=value===task.raw&&task.raw>22?'Сумма найдена, но она больше 22. Осталось сложить её цифры.':value>22?'Число больше 22. Примените правило сложения цифр и проверьте результат.':'Пока не совпало. Проверьте исходные точки и промежуточную сумму; готовый ответ можно открыть отдельно.';feedbackKind='is-error';render();return;}
        solved.add(task.id);feedback=spec.kind==='placement'?'Верно, место найдено.':'Верно! '+task.expression+'.';feedbackKind='is-correct';save();
        render();
        root.querySelector('.learning-next')?.focus({preventScroll:true});
      });
    }
    bindStepSwipe(panel,{previous:()=>goTo(at-1),next:advance});
    grid.append(panel);root.append(grid);
    if(answerControls)root.append(answerControls);
    if(nextButton)root.append(nextButton);
    root.append(settings);
  }
  render();
  return {reset:()=>reset('practice'),getState:()=>({date,mode,at,solved:[...solved],assisted:[...assisted]})};
}
