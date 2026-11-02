import { calculateMatrix } from '../../numerology-core.js?v=5';
import { BASIC_KEYS, EXAMPLE_DATES, LESSON_SKILLS, constructionSteps, purposeSteps, reductionTasks, learningBirthDate } from './construction-model.js?v=20261102learn1';

const element=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const button=(text,action,cls='learning-secondary')=>{const n=element('button',cls,text);n.type='button';n.addEventListener('click',action);return n;};
const appendText=(root,text,cls)=>{const p=element('p',cls,text);root.append(p);return p;};
const svgNS='http://www.w3.org/2000/svg';
const svg=(tag,attrs)=>{const n=document.createElementNS(svgNS,tag);for(const[k,v]of Object.entries(attrs||{}))n.setAttribute(k,String(v));return n;};

export function mountConstruction(root,{lessonId='base',onComplete=()=>{},standalone=false}={}) {
  const spec=LESSON_SKILLS[lessonId]||LESSON_SKILLS['build-independent'];
  const checkpointKey='numi-school-building-v2:'+lessonId;
  let date=spec.independent?'08.09.1987':EXAMPLE_DATES[0],mode=spec.independent?'practice':'example',at=0,solved=new Set(),chosen=null,hint=0,feedback='',feedbackKind='',answerValue='',assisted=new Set();
  let completedNotified=false;
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
  function drawDiagram(container,task) {
    if(spec.kind==='reduction')return;
    const m=calculateMatrix(learningBirthDate(date)),all=constructionSteps(learningBirthDate(date),m),selectedIds=new Set(tasks.map(t=>t.id));
    const contextIds=new Set();
    const visit=key=>{const n=all.find(n=>n.id===key);if(!n)return;for(const dep of n.dependencies){if(!selectedIds.has(dep))contextIds.add(dep);visit(dep);}};
    tasks.forEach(t=>visit(t.id));
    const visibleIds=new Set([...BASIC_KEYS,...selectedIds,...contextIds]);
    const pool=spec.kind==='purpose'?all.filter(n=>BASIC_KEYS.includes(n.id)):all.filter(n=>visibleIds.has(n.id));
    const canvas=svg('svg',{viewBox:'0 0 620 620',role:'group','aria-label':mode==='practice'?'Выберите место для точки на матрице':'Матрица с выделенной текущей точкой'});
    canvas.append(svg('polygon',{points:'310,52 568,310 310,568 52,310',class:'learning-outline'}),svg('rect',{x:128,y:128,width:364,height:364,class:'learning-outline'}));
    for(const[x1,y1,x2,y2]of[[310,52,310,568],[52,310,568,310],[128,128,492,492],[492,128,128,492],[310,462,462,310]])canvas.append(svg('line',{x1,y1,x2,y2,class:'learning-line'}));
    for(const n of pool){
      const known=(spec.kind==='purpose')||contextIds.has(n.id)||solved.has(n.id)||(mode==='example'&&selectedIds.has(n.id)&&tasks.findIndex(t=>t.id===n.id)<=at);
      const active=task?.id===n.id,dep=task?.dependencies?.includes(n.id);
      const interactive=mode==='practice'&&task&&spec.kind!=='purpose'&&!solved.has(task.id);
      const g=svg('g',{class:'learning-node'+(active&&mode==='example'?' is-target':'')+(dep&&mode==='example'?' is-source':'')+(chosen===n.id?' is-selected':'')+(solved.has(n.id)?' is-solved':''),role:interactive?'button':'img',...(interactive?{tabindex:'0','aria-pressed':String(chosen===n.id)}:{}),'aria-label':'Позиция '+n.number+'. '+n.position+(known&&spec.kind!=='placement'?' Значение '+n.value+'.':'')});
      const title=svg('title');title.textContent='Позиция '+n.number+': '+n.position;g.append(title);
      g.append(svg('circle',{cx:n.x,cy:n.y,r:n.kind==='center'?27:21}));
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
      if(knownTasks.length){const sheet=element('div','learning-known');sheet.append(element('h3','','Уже рассчитано'));const list=element('dl');knownTasks.forEach(t=>{list.append(element('dt','',t.title),element('dd','',t.value));});sheet.append(list);container.append(sheet);}
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
    if(!standalone&&passed)actions.append(button('Перейти к проверке знаний →',()=>document.getElementById('lesson-quiz')?.scrollIntoView({behavior:'smooth',block:'start'}),'school-primary'));
    root.append(actions);
    appendText(root,'Рассчитанные числа — это проверка арифметики и расположения. Значения энергий изучаются в отдельном разделе.','learning-muted');
  }
  function render() {
    tasks=getTasks();root.replaceChildren();root.classList.add('learning-workshop');root.hidden=false;
    appendText(root,spec.independent?'САМОСТОЯТЕЛЬНАЯ СБОРКА':'ПОСМОТРЕТЬ → ПОПРОБОВАТЬ → ПРОВЕРИТЬ','school-overline');root.append(element('h2','',spec.goal));
    const modes=element('div','learning-mode');
    if(!spec.independent)modes.append(button('1. Разобранный пример',()=>reset('example'),mode==='example'?'is-active':''));
    modes.append(button(spec.independent?'Построить самостоятельно':'2. Теперь я сам',()=>reset('practice'),mode==='practice'?'is-active':''));root.append(modes);
    if(spec.kind!=='placement'&&spec.kind!=='reduction'){
      const dateForm=element('form','learning-date');dateForm.noValidate=true;
      const label=element('label','','Дата для упражнения'),input=element('input');input.type='text';input.inputMode='numeric';input.maxLength=10;input.value=date;input.setAttribute('aria-label','Дата рождения для построения');label.append(input);
      input.addEventListener('input',()=>{const d=input.value.replace(/\D/g,'').slice(0,8);input.value=[d.slice(0,2),d.slice(2,4),d.slice(4,8)].filter(Boolean).join('.');input.setCustomValidity('');input.removeAttribute('aria-invalid');});
      const apply=element('button','learning-secondary','Использовать дату');apply.type='submit';dateForm.append(label,apply);root.append(dateForm);
      dateForm.addEventListener('submit',event=>{event.preventDefault();if(!learningBirthDate(input.value)){input.setAttribute('aria-invalid','true');input.setCustomValidity('Введите существующую дату ДД.ММ.ГГГГ от 1900 года до сегодня.');input.reportValidity();return;}date=input.value;reset(mode);});
      appendText(root,(spec.independent?'Контрольная дата: ':'Учебный пример: ')+date+'. Смена даты начинает новый расчёт.','learning-muted');
    }
    const count=mode==='practice'?solved.size:Math.min(at+1,tasks.length),progress=element('progress');progress.max=tasks.length;progress.value=count;progress.setAttribute('aria-label','Прогресс практики');root.append(progress);
    appendText(root,mode==='practice'?'Проверено '+solved.size+' из '+tasks.length:'Пример: шаг '+Math.min(at+1,tasks.length)+' из '+tasks.length,'learning-counter');
    if(at>=tasks.length){if(mode==='example'){root.append(button('Теперь построить самому →',()=>reset('practice'),'school-primary'));return;}finish();return;}
    const task=tasks[at];
    const grid=element('div','learning-grid'),image=element('div','learning-map'),panel=element('section','learning-task');
    drawDiagram(image,task);if(spec.kind!=='reduction'){const zoom=button('Увеличить схему',()=>{image.classList.toggle('is-zoomed');zoom.textContent=image.classList.contains('is-zoomed')?'Уменьшить схему':'Увеличить схему';});image.append(zoom);grid.append(image);}
    appendText(panel,task.group,'school-overline');const taskHeading=element('h3','',task.title);taskHeading.tabIndex=-1;panel.append(taskHeading);
    if(mode==='example'){
      appendText(panel,task.position||task.rule);if(spec.kind!=='placement'){appendText(panel,task.rule);appendText(panel,task.expression+' → в точке '+task.value,'learning-equation');}
      else appendText(panel,'Найдите выделенный кружок. Номера здесь обозначают места, а не энергии.','learning-equation');
      const actions=element('div','learning-actions');actions.append(button('← Назад',()=>{at=Math.max(0,at-1);render();}));actions.lastChild.disabled=at===0;
      actions.append(button(at===tasks.length-1?'Пример разобран ✓':'Следующая точка →',()=>{at++;render();},'school-primary'));panel.append(actions);
    }else{
      appendText(panel,spec.kind==='placement'?'Выберите на схеме место для этой позиции. Цифры в кружках — номера мест, а не рассчитанные значения.':spec.kind==='purpose'?'Этот показатель записывают отдельно: выбирать кружок на схеме не нужно.':spec.kind==='reduction'?'Сначала решите самостоятельно. Числа 1–22 оставляем без изменения.':'Сначала выберите кружок на схеме, затем введите рассчитанное значение. Уже известные исходные точки показаны числами.');
      const answerForm=element('form','learning-answer');answerForm.noValidate=true;
      const answer=element('input');answer.type='number';answer.min='1';answer.max='22';answer.inputMode='numeric';answer.autocomplete='off';answer.setAttribute('aria-label','Ваш результат от 1 до 22');
      answer.value=answerValue;answer.addEventListener('input',()=>{answerValue=answer.value;});answer.disabled=solved.has(task.id);
      if(spec.kind!=='placement'){const label=element('label','','Мой результат');label.append(answer);answerForm.append(label);}
      if(chosen){const n=constructionSteps(learningBirthDate(date)).find(n=>n.id===chosen);appendText(answerForm,'Выбрана позиция '+n.number+'.','learning-chosen');}
      const submit=element('button','school-primary','Проверить шаг');submit.type='submit';submit.disabled=solved.has(task.id);answerForm.append(submit);panel.append(answerForm);
      if(feedback){const msg=appendText(panel,feedback,'learning-feedback '+feedbackKind);msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');}
      const hints=element('div','learning-hints');hints.append(button(hint?'Ещё подсказка':'Подсказка',()=>{hint=Math.min(2,hint+1);render();}));
      if(hint)appendText(hints,hint===1?(spec.kind==='placement'?task.position:task.rule):((task.position?task.position+' ':'')+'Промежуточная сумма: '+(task.operands.length>1?task.operands.join(' + ')+' = ':'')+task.raw+'. Проверьте, нужно ли приводить её к 22.'));
      if(spec.kind!=='placement')hints.append(button('Показать решение',()=>{assisted.add(task.id);hint=2;feedback=task.expression+'. Повторите вычисление и введите результат сами.';feedbackKind='is-hint';save();render();}));if(!solved.has(task.id))panel.append(hints);
      if(solved.has(task.id))panel.append(button(at===tasks.length-1?'Завершить практику ✓':'Следующая точка →',()=>{at++;chosen=null;hint=0;feedback='';answerValue='';render();save();root.querySelector('.learning-task h3')?.focus({preventScroll:true});},'school-primary learning-next'));
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
    grid.append(panel);root.append(grid);
    appendText(root,'Сначала источник → затем сумма → правило 22 → нужное место. Одна точка за один шаг.','learning-muted');
  }
  render();
  return {reset:()=>reset('practice'),getState:()=>({date,mode,at,solved:[...solved],assisted:[...assisted]})};
}
