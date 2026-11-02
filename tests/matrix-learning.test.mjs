import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateMatrix, reduce22 } from '../numerology-core.js';
import { nodesFor } from '../pro/pro-points.js';
import { constructionSteps, purposeSteps, reductionTasks, BUILD_ORDER, LESSON_SKILLS, learningBirthDate, readLearningProgress, markLearningLesson } from '../pro/school/construction-model.js';
import { mountConstruction } from '../pro/school/learning.js';

// Small DOM event harness: exercises public controls without a browser dependency.
class Node {
  constructor(tag='div',text=''){this.tagName=tag;this.children=[];this.parentNode=null;this.attributes={};this.events={};this.value='';this.disabled=false;this.checked=false;this._text=text;this.className='';}
  set textContent(v){this._text=String(v);this.children=[];}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  get classList(){const node=this;return {add(...v){node.className=[...new Set([...node.className.split(' ').filter(Boolean),...v])].join(' ');},remove(...v){node.className=node.className.split(' ').filter(c=>!v.includes(c)).join(' ');},contains(v){return node.className.split(' ').includes(v);},toggle(v,force){const add=force??!this.contains(v);if(add)this.add(v);else this.remove(v);return add;}};}
  get lastChild(){return this.children.at(-1);}
  get childElementCount(){return this.children.length;}
  append(...nodes){for(let node of nodes){if(typeof node==='string')node=new Node('#text',node);node.parentNode=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
  before(node){const p=this.parentNode;p.children.splice(p.children.indexOf(this),0,node);node.parentNode=p;}
  insertBefore(node,before){this.children.splice(this.children.indexOf(before),0,node);node.parentNode=this;}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='class')this.className=String(v);}
  getAttribute(k){return k==='class'?this.className:this.attributes[k]??this[k]??null;}
  removeAttribute(k){delete this.attributes[k];}
  addEventListener(k,fn){(this.events[k]??=[]).push(fn);}
  emit(k){for(const fn of this.events[k]||[])fn({preventDefault(){},target:this});}
  focus(){document.activeElement=this;}
  scrollIntoView(){}
  setCustomValidity(v){this.validationMessage=v;}
  reportValidity(){return !this.validationMessage;}
  matches(selector){
    if(this.tagName==='#text')return false;
    const tag=selector.match(/^[a-zA-Z0-9-]+/);if(tag&&this.tagName!==tag[0])return false;
    for(const c of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(c[1]))return false;
    for(const a of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)){const value=this.getAttribute(a[1]);if(value===null||(a[2]!==undefined&&String(value)!==a[2]))return false;}
    if(selector.includes(':checked')&&!this.checked)return false;
    return true;
  }
  querySelectorAll(selector){const out=[],parts=selector.split(' ');const matches=n=>{if(!n.matches(parts.at(-1)))return false;let p=n.parentNode;for(let i=parts.length-2;i>=0;i--){while(p&&!p.matches(parts[i]))p=p.parentNode;if(!p)return false;p=p.parentNode;}return true;};const visit=n=>{for(const child of n.children){if(matches(child))out.push(child);visit(child);}};visit(this);return out;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),clear:()=>map.clear()};};
function setup(){
  const body=new Node('body');
  globalThis.document={body,createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag),createTextNode:v=>new Node('#text',v),getElementById:id=>body.querySelectorAll('[id]').find(n=>n.id===id)||null};
  globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.window={localStorage,sessionStorage};return body;
}
const click=(root,text)=>{const n=root.querySelectorAll('button').find(n=>n.textContent===text);assert.ok(n,'Button '+text);assert.ok(!n.disabled);n.emit('click');};
const input=(n,value)=>{n.value=String(value);n.emit('input');};
function solveOne(root,api,spec,{wrong=false}={}){
  const state=api.getState(),birth=learningBirthDate(state.date),all=constructionSteps(birth);
  const tasks=spec.kind==='reduction'?reductionTasks():spec.kind==='purpose'?purposeSteps(calculateMatrix(birth)):spec.keys.map(id=>all.find(p=>p.id===id));
  const task=tasks[state.at];
  if(!['purpose','reduction'].includes(spec.kind)){
    const number=wrong?(task.number===1?2:1):task.number;
    root.querySelectorAll('g').find(n=>n.getAttribute('aria-label').startsWith('Позиция '+number+'.')).emit('click');
  }
  const answer=root.querySelector('.learning-answer input');if(answer)input(answer,wrong?(task.value===1?2:1):task.value);
  root.querySelector('.learning-answer').emit('submit');return task;
}

assert.equal(new Set(BUILD_ORDER).size,31);
let dates=0;
for(let year=1900;year<=2025;year+=3)for(let month=1;month<=12;month++)for(const day of [1,14,22,28]){
  const birth={day,month,year},m=calculateMatrix(birth),steps=constructionSteps(birth,m),live=nodesFor(birth,m);
  assert.equal(steps.length,31);
  for(const [i,s]of steps.entries()){
    assert.equal(s.value,reduce22(s.raw),s.id+' arithmetic');assert.equal(s.value,live.find(n=>n.key===s.id).value);
    for(const dep of s.dependencies)assert.ok(BUILD_ORDER.indexOf(dep)<i,s.id+' dependency');
  }
  for(const s of purposeSteps(m))assert.equal(s.value,reduce22(s.raw),s.id);
  assert.equal(new Set(steps.map(s=>s.x+':'+s.y)).size,31);dates++;
}
assert.deepEqual(constructionSteps({day:14,month:7,year:1990}).map(p=>p.value),[14,7,19,4,8,21,8,5,18,15,22,5,22,9,3,9,10,17,11,5,16,6,13,18,8,8,12,16,21,6,3]);
assert.ok(learningBirthDate('29.02.2000'));for(const value of ['29.02.2001','31.04.2000','01.01.1899','31.12.2099'])assert.equal(learningBirthDate(value),null);
assert.deepEqual([11,22,23,33,59,99,1990].map(reduce22),[11,22,5,6,14,18,19]);

for(const [id,spec]of Object.entries(LESSON_SKILLS)){
  const root=setup();let passed=false;const api=mountConstruction(root,{lessonId:id,onComplete:v=>passed=v});
  if(!spec.independent)click(root,'2. Теперь я сам');
  solveOne(root,api,spec,{wrong:true});assert.equal(api.getState().solved.length,0,id+' rejects wrong answer');
  while(root.querySelector('.learning-answer')){
    solveOne(root,api,spec);assert.ok(root.querySelector('.learning-next'),id+' next control');
    // A click on the solved diagram must not lose the next control or completion.
    root.querySelector('g')?.emit('click');assert.ok(root.querySelector('.learning-next'));
    root.querySelector('.learning-next').emit('click');
  }
  assert.ok(passed,id+' completed');
}

{
  const root=setup();let passed=false;let api=mountConstruction(root,{lessonId:'base',onComplete:v=>passed=v});click(root,'2. Теперь я сам');solveOne(root,api,LESSON_SKILLS.base);
  api=mountConstruction(root,{lessonId:'base',onComplete:v=>passed=v});assert.equal(api.getState().at,1,'resume first unfinished point');
  input(root.querySelector('.learning-date input'),'29.02.2001');root.querySelector('.learning-date').emit('submit');assert.ok(root.querySelector('.learning-date input').validationMessage);
  input(root.querySelector('.learning-date input'),'29.02.2000');assert.equal(root.querySelector('.learning-date input').validationMessage,'');root.querySelector('.learning-date').emit('submit');assert.equal(api.getState().date,'29.02.2000');assert.equal(api.getState().solved.length,0);assert.equal(passed,false);
}
{
  const root=setup();let passed=false;const api=mountConstruction(root,{lessonId:'build-independent',onComplete:v=>passed=v});click(root,'Показать решение');
  while(root.querySelector('.learning-answer')){solveOne(root,api,LESSON_SKILLS['build-independent']);root.querySelector('.learning-next').emit('click');}
  assert.equal(passed,false,'revealed solution cannot pass independent control');assert.equal(api.getState().assisted.length,1);click(root,'Другая дата');assert.equal(api.getState().assisted.length,0);
}
{
  setup();localStorage.setItem('numerologia-online-pro-school-v1','["start"]');sessionStorage.setItem('numerologia-online-pro-school-v1','["base"]');
  localStorage.setItem=()=>{throw Error('blocked');};assert.equal(markLearningLesson('corners'),'sessionStorage');assert.deepEqual([...readLearningProgress()],['start','base','corners']);
  sessionStorage.setItem=()=>{throw Error('blocked');};assert.equal(markLearningLesson('internal'),null);
  const root=document.body;let passed=false;const api=mountConstruction(root,{lessonId:'base',onComplete:v=>passed=v});click(root,'2. Теперь я сам');
  while(root.querySelector('.learning-answer')){solveOne(root,api,LESSON_SKILLS.base);root.querySelector('.learning-next').emit('click');}assert.ok(passed,'storage failure does not block learning');
}

// Actual lesson module: practice gate, quiz, persistence, navigation and structured draft.
for(const lessonId of ['base','final']){
  const root=setup();for(const id of ['lesson-hero','lesson-count','lesson-title','lesson-lead','lesson-main-rule','lesson-content','lesson-drawing','lesson-quiz','lesson-navigation','lesson-error']){const n=new Node('section');n.id=id;root.append(n);}
  const manifest=JSON.parse(fs.readFileSync(new URL('../pro/school/lessons-manifest.json',import.meta.url)));
  globalThis.location={search:'?id='+lessonId};globalThis.fetch=async path=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../'+path.split('?')[0],import.meta.url)))});
  if(lessonId==='base')localStorage.setItem('numi-school-building-v2:base',JSON.stringify({date:'14.07.1990',mode:'practice',solved:[],assisted:[]}));
  await import('../pro/school/lesson/lesson.js?test='+lessonId);await new Promise(resolve=>setTimeout(resolve,0));
  const quiz=document.getElementById('lesson-quiz');assert.ok(quiz.querySelector('form'));
  if(lessonId==='base'){
    assert.ok(quiz.querySelector('fieldset').disabled);const drawing=document.getElementById('lesson-drawing');
    const api={getState:()=>JSON.parse(localStorage.getItem('numi-school-building-v2:base'))};
    for(const [i,task]of constructionSteps({day:14,month:7,year:1990}).slice(0,5).entries()){
      drawing.querySelectorAll('g').find(n=>n.getAttribute('aria-label').startsWith('Позиция '+task.number+'.')).emit('click');input(drawing.querySelector('.learning-answer input'),task.value);drawing.querySelector('.learning-answer').emit('submit');drawing.querySelector('.learning-next').emit('click');
    }
    assert.equal(quiz.querySelector('fieldset').disabled,false,'quiz unlocked after real practice');
  }else{
    const editors=root.querySelectorAll('.school-case-field textarea');assert.equal(editors.length,5);input(editors[0],'Учебный вопрос');assert.ok(localStorage.getItem('numerologia-online-school-case-final').includes('Учебный вопрос'));
  }
  const data=JSON.parse(fs.readFileSync(new URL('../pro/school/lessons/'+lessonId+'.json',import.meta.url)));
  const form=quiz.querySelector('form');form.emit('submit');assert.ok(quiz.textContent.includes('Остался вопрос'));
  data.questions.forEach((q,i)=>{form.querySelectorAll('input').find(n=>n.name==='quiz-'+i&&n.value===String(q.correct)).checked=true;});form.emit('submit');assert.ok(readLearningProgress().has(lessonId));
}
console.log('PASS: '+dates+' dates; all 10 practice flows; incorrect answers; resume; leap date; independent control; blocked storage; lesson quiz gate and draft.');
