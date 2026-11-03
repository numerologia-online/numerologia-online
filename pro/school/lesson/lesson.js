import { calculateMatrix, parseBirthDate } from "../../../numerology-core.js?v=5";
import { nodesFor } from "../../pro-points.js?v=3";

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
function readCompleted(){
  try{
    const items=JSON.parse(localStorage.getItem(storeKey)||"[]");
    return new Set(Array.isArray(items)?items.filter(item=>typeof item==="string"):[]);
  }catch{return new Set()}
}
let lesson, manifest, index = -1, currentBirth = null, step = 0;
let internalDetail = 0; // Selected axis, diagonal or channel within one of the five existing lesson steps.
const params = new URLSearchParams(location.search);
const id = params.get("id") || "start";
const diagram = $("lesson-diagram");
const stepTitles = [
  "Нарисуйте ромб и квадрат",
  "Впишите день, месяц и год",
  "Рассчитайте нижнюю точку",
  "Посчитайте центральную энергию",
  "Заполните четыре угла"
];
const stepDescriptions = [
  "На листе нарисуйте ромб: вершины сверху, справа, снизу и слева. Наложите на ромб прямой квадрат и проведите вертикальную и горизонтальную линии через центр. Девять кружков пока пустые.",
  "Слева - число дня рождения, сверху - месяца, справа - сумма цифр года. Ниже показан расчёт каждого числа именно по вашей дате.",
  "Нижняя точка - сумма трёх уже записанных чисел: левого, верхнего и правого. Сначала найдите полную сумму, затем проверьте: если она больше 22, сложите её цифры.",
  "Чтобы получить центральное число, сложите четыре числа в кружках: слева, сверху, справа и снизу. Если сумма больше 22, сложите её цифры.",
  "Число в каждом углу квадрата - сумма двух ближайших чисел ромба. Если результат больше 22, сложите его цифры."
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
  // На четвёртом шаге подписываем места рождения прямо у кружков внутри рисунка.
  // Без отдельной легенды: расположение понятно с первого взгляда.
  if(step===3){
    const positions=[
      {x:200,y:15,anchor:"middle",lines:["Месяц рождения"]},
      {x:12,y:155,anchor:"start",lines:["День","рождения"]},
      {x:388,y:155,anchor:"end",lines:["Год","рождения"]},
      {x:200,y:392,anchor:"middle",lines:["Сумма"]}
    ];
    for(const {x,y,anchor,lines} of positions){
      const text=makeSvg("text",{x,y,"text-anchor":anchor,"class":"school-diagram-anchor-label"});
      lines.forEach((line,index)=>{
        const span=makeSvg("tspan",{x,dy:index?16:0});
        span.textContent=line;
        text.append(span);
      });
      svg.append(text);
    }
  }
  diagram.replaceChildren(svg);
}

const stageKeys = [
  [], ["left","top","right"], ["left","top","right","bottom"],
  ["left","top","right","bottom","center"],
  ["left","top","right","bottom","center","topLeft","topRight","bottomLeft","bottomRight"]
];

function drawBasic(matrix) {
  const svg = makeSvg("svg",{viewBox:"0 0 400 400",role:"img","aria-label":"Матрица: девять основных кружков с числами по выбранному шагу"});
  svg.append(makeSvg("polygon",{points:"200,35 365,200 200,365 35,200","class":"school-diagram-outline"}));
  svg.append(makeSvg("rect",{x:83,y:83,width:234,height:234,"class":"school-diagram-outline"}));
  [[200,35,200,365],[35,200,365,200],[83,83,317,317],[317,83,83,317]].forEach(([x1,y1,x2,y2]) =>
    svg.append(makeSvg("line",{x1,y1,x2,y2,"class":"school-diagram-line"})));
  const nodes = [
    ["top",200,35,matrix?.top,"Месяц"],["right",365,200,matrix?.right,"Год"],
    ["bottom",200,365,matrix?.bottom,"Нижняя точка"],["left",35,200,matrix?.left,"День"],
    ["center",200,200,matrix?.center,"Центр"],
    ["topLeft",83,83,matrix?.corners?.topLeft,"Угол"],["topRight",317,83,matrix?.corners?.topRight,"Угол"],
    ["bottomRight",317,317,matrix?.corners?.bottomRight,"Угол"],["bottomLeft",83,317,matrix?.corners?.bottomLeft,"Угол"]
  ];
  for (const [key,x,y,value,label] of nodes) {
    const cornerOrder=["topLeft","topRight","bottomRight","bottomLeft"];
    const visible=id==="corners"
      ?["left","top","right","bottom","center",...cornerOrder.slice(0,step+1)]
      :stageKeys[id==="reduce"?1:step];
    const shown=Boolean(matrix)&&visible.includes(key);
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
  const svg=makeSvg("svg",{viewBox:"0 0 620 620",role:"img","aria-label":"Все 31 позиции рассчитанной матрицы"});
  svg.append(makeSvg("polygon",{points:"310,34 506,114 586,310 506,506 310,586 114,506 34,310 114,114","class":"school-diagram-outline"}));
  svg.append(makeSvg("rect",{x:114,y:114,width:392,height:392,"class":"school-diagram-outline"}));
  svg.append(makeSvg("polygon",{points:"310,34 586,310 310,586 34,310","class":"school-diagram-outline"}));
  [[310,68,310,552],[68,310,552,310],[114,114,506,506],[506,114,114,506]].forEach(([x1,y1,x2,y2]) =>
    svg.append(makeSvg("line",{x1,y1,x2,y2,"class":"school-diagram-line"})));
  const focus=id==="internal"?getInternalFocus():[];
  for(const point of nodesFor(currentBirth,matrix)){
    const muted=id==="internal"&&!focus.includes(point.key);
    const group=makeSvg("g",{"class":"school-graph-node is-revealed"+(point.kind==="center"?" is-center":"")+(muted?" is-muted":"")});
    const radius=point.kind==="center"?28:point.kind==="major"?25:15;
    group.append(makeSvg("circle",{cx:point.x,cy:point.y,r:radius}));
    const text=makeSvg("text",{x:point.x,y:point.y+1,"text-anchor":"middle","dominant-baseline":"middle","font-size":radius<=15?17:22});
    text.textContent=String(point.value);
    group.append(text);
    const title=makeSvg("title");title.textContent=point.label+": "+point.value;group.append(title);
    svg.append(group);
    if(id==="internal"&&step===4&&(point.key==="moneyPoint"||point.key==="loveHeart")){
      const isMoney=point.key==="moneyPoint";
      const marker=makeSvg("text",{
        x:point.x+(isMoney?25:-24),y:point.y+(isMoney?-17:29),
        "text-anchor":"middle","font-size":24,"font-weight":900,
        fill:isMoney?"#947041":"#9a5971",stroke:"#fcfaf6",
        "stroke-width":4,"paint-order":"stroke fill",
        opacity:muted?.48:1
      });
      marker.textContent=isMoney?"$":"♥";
      const title=makeSvg("title");title.textContent=isMoney?"Под долларом — точка денег":"Под сердцем — точка отношений";
      marker.append(title);
      svg.append(marker);
    }
  }
  diagram.replaceChildren(svg);
}


function reduce22Formula(number){
  let value=number;
  const steps=[];
  while(value>22){
    const digits=String(value).split("").map(Number);
    const next=digits.reduce((sum,digit)=>sum+digit,0);
    steps.push(digits.join(" + ")+" = "+next);
    value=next;
  }
  return steps;
}
// Все формулы ниже строятся из даты самого ученика, а не из готового примера.
function showFirstThreeCalculations(root,matrix,birth){
  root.replaceChildren();
  root.classList.remove("is-bottom-explanation");
  root.classList.add("is-calculation-breakdown");
  const daySteps=reduce22Formula(birth.day);
  const dayFormula=daySteps.length?daySteps.join(" → ")
    :String(birth.day).padStart(2,"0")+(birth.day<10?" → "+birth.day:" - оставляем как есть");
  const monthFormula=String(birth.month).padStart(2,"0")+(birth.month<10?" → "+birth.month:" - оставляем как есть");
  const yearDigits=String(birth.year).split("").map(Number);
  const yearSum=yearDigits.reduce((sum,digit)=>sum+digit,0);
  const yearFormula=[yearDigits.join(" + ")+" = "+yearSum,...reduce22Formula(yearSum)].join(" → ");
  const rows=[
    ["Слева (день):",dayFormula],
    ["Сверху (месяц):",monthFormula],
    ["Справа (год):",yearFormula]
  ];
  const list=make("div","school-calc-list");
  rows.forEach(([place,formula])=>{
    const row=make("div","school-calc-row");
    row.append(make("span","school-calc-place",place));
    row.append(make("span","school-calc-equation",formula));
    list.append(row);
  });
  root.append(list);
}
// Показываем и первоначальную сумму, и причину повторного сложения цифр.
function showBottomCalculation(root,matrix){
  root.replaceChildren();
  root.classList.remove("is-calculation-breakdown");
  root.classList.add("is-bottom-explanation");
  const total=matrix.left+matrix.top+matrix.right;
  root.append(make("strong","school-bottom-math",
    matrix.left+" + "+matrix.top+" + "+matrix.right+" = "+total));
  const reason=total>22
    ?"Так как "+total+" больше 22, мы снова складываем его цифры: "+
      String(total).split("").join(" + ")+" = "+matrix.bottom+"."
    :"Так как "+total+" не больше 22, оставляем его без сокращения. Внизу пишем "+matrix.bottom+".";
  root.append(make("p","school-bottom-reason",reason));
}

// Три следующих примера используются и в шагах с центром, и в углах матрицы.
function showCompactCalculations(root,rows){
  root.replaceChildren();
  root.classList.remove("is-bottom-explanation");
  root.classList.add("is-calculation-breakdown");
  const list=make("div","school-calc-list");
  rows.forEach(([label,formula])=>{
    const line=make("div","school-calc-row");
    line.append(make("span","school-calc-place",label),make("span","school-calc-equation",formula));
    list.append(line);
  });
  root.append(list);
}
function compactSumFormula(values,result){
  const total=values.reduce((sum,value)=>sum+value,0);
  const base=values.join(" + ")+" = "+total;
  return total>22?base+" → "+reduce22Formula(total).join(" → "):base;
}
function showCenterCalculation(root,matrix){
  const values=[matrix.left,matrix.top,matrix.right,matrix.bottom];
  const total=values.reduce((sum,value)=>sum+value,0);
  showCompactCalculations(root,[["Четыре числа:",compactSumFormula(values,matrix.center)]]);
  root.append(make("p","school-bottom-reason",total>22
    ?"Так как "+total+" больше 22, складываем цифры и получаем "+matrix.center+"."
    :"Сумма не больше 22 - в центре оставляем "+matrix.center+"."));
}
function showCornerCalculations(root,matrix){
  const c=matrix.corners;
  showCompactCalculations(root,[
    ["Сверху слева:",compactSumFormula([matrix.left,matrix.top],c.topLeft)],
    ["Сверху справа:",compactSumFormula([matrix.top,matrix.right],c.topRight)],
    ["Снизу справа:",compactSumFormula([matrix.right,matrix.bottom],c.bottomRight)],
    ["Снизу слева:",compactSumFormula([matrix.bottom,matrix.left],c.bottomLeft)]
  ]);
}
function showInternalCalculations(root,matrix){
  // Короткие конкретные примеры к схеме: не выдаём формулы углов за внутренние линии.
  showCompactCalculations(root,[
    ["Левая ось:",compactSumFormula([matrix.left,matrix.center],matrix.leftSpoke.near)],
    ["Родовая диагональ:",compactSumFormula([matrix.corners.topLeft,matrix.center],matrix.diagonals.topLeft.near)],
    ["Нижняя линия:",compactSumFormula([matrix.center,matrix.bottom],matrix.tail.first)]
  ]);
}

const cornerStages=[
  {title:"Верхний левый угол",text:"Сложите числа слева и сверху. Если сумма больше 22, сложите её цифры."},
  {title:"Верхний правый угол",text:"Теперь сложите числа сверху и справа. Запишите промежуточную сумму, прежде чем сокращать."},
  {title:"Нижний правый угол",text:"Здесь складываются числа справа и снизу. Применяйте то же правило 22 энергий."},
  {title:"Нижний левый угол",text:"Остаются числа снизу и слева. Проверьте, что все четыре угла рассчитаны по соседним точкам."}
];
const internalStages=[
  {title:"Проверьте девять основных точек",text:"На схеме много маленьких кружков. Сначала убедитесь, что известны девять основных чисел. От них строятся другие позиции."},
  {title:"Рассчитайте три оси",text:"Выберите верхнюю, левую или правую ось над схемой. На каждой оси посчитайте по порядку три числа: среднее (вершина + центр), внешнее (вершина + среднее), ближайшее к центру (среднее + центр). Формулы показаны для вашей даты."},
  {title:"Разберите родовые диагонали",text:"Выбирайте диагонали над схемой по очереди: верхнюю левую, верхнюю правую, нижнюю правую и нижнюю левую. Для каждой сначала найдите внутреннюю точку (угол + центр), затем внешнюю (угол + внутренняя)."},
  {title:"Постройте нижнюю линию",text:"Два дополнительных нижних числа рассчитываются последовательно из центра и нижней точки."},
  {title:"Считайте денежную и любовную линии",text:"Выбирайте пять позиций над схемой по порядку. На рисунке подсвечиваются числа, участвующие в расчёте. Значки $ и ♥ отмечают денежную и любовную точки."}
];
const internalFocus=[
 ["top","right","bottom","left","center","topLeft","topRight","bottomRight","bottomLeft"],
 ["top","left","right","center","topOuter","topNear","topCore","leftOuter","leftNear","leftCore","rightOuter","rightNear","rightCore"],
 ["topLeft","topRight","bottomRight","bottomLeft","center","topLeftNear","topLeftOuter","topRightNear","topRightOuter","bottomLeftNear","bottomLeftOuter","bottomRightNear","bottomRightOuter"],
 ["center","bottom","tailFirst","tailSecond"],
 ["right","bottom","center","rightNear","tailFirst","wellbeing","moneyPoint","loveHeart"]
];
const internalSelections={
  1:[
    {label:"Верхняя ось",keys:["top","center","topNear","topOuter","topCore"],base:"top",spoke:"topSpoke"},
    {label:"Левая ось",keys:["left","center","leftNear","leftOuter","leftCore"],base:"left",spoke:"leftSpoke"},
    {label:"Правая ось",keys:["right","center","rightNear","rightOuter","rightCore"],base:"right",spoke:"rightSpoke"}
  ],
  2:[
    {label:"Сверху слева",keys:["topLeft","center","topLeftNear","topLeftOuter"],corner:"topLeft"},
    {label:"Сверху справа",keys:["topRight","center","topRightNear","topRightOuter"],corner:"topRight"},
    {label:"Снизу справа",keys:["bottomRight","center","bottomRightNear","bottomRightOuter"],corner:"bottomRight"},
    {label:"Снизу слева",keys:["bottomLeft","center","bottomLeftNear","bottomLeftOuter"],corner:"bottomLeft"}
  ],
  4:[
    {label:"1. Вход в деньги",keys:["right","center","rightNear"]},
    {label:"2. Вход в отношения",keys:["bottom","center","tailFirst"]},
    {label:"3. Баланс",keys:["rightNear","tailFirst","wellbeing"]},
    {label:"4. Под долларом $",keys:["rightNear","wellbeing","moneyPoint"]},
    {label:"5. Под сердцем ♥",keys:["tailFirst","wellbeing","loveHeart"]}
  ]
};
function getInternalSelection(){
  const choices=internalSelections[step]||[];
  return choices[internalDetail]||choices[0]||null;
}
function getInternalFocus(){
  return getInternalSelection()?.keys||internalFocus[step]||[];
}
// A small choice inside the existing step, not another lesson or screen.
function updateInternalPicker(){
  let root=$("school-internal-picker");
  const options=internalSelections[step];
  if(!options){
    if(root)root.style.display="none";
    return;
  }
  if(!root){
    root=make("div","school-internal-picker");
    root.id="school-internal-picker";
    root.style.cssText="padding:12px 14px;margin:8px 0 14px;border:1px solid #e1d8ca;border-radius:14px;background:#f8f5ef";
    $("lesson-drawing").querySelector(".school-visual-grid").before(root);
  }
  root.style.display="block";
  root.replaceChildren();
  const title=make("p","","На схеме сейчас показана:");
  title.style.cssText="margin:0 0 8px;font-size:13px;color:#536a76;font-weight:750";
  if(step===4)title.textContent="Выберите расчёт: ";
  if(step===2)title.textContent="Выберите родовую диагональ:";
  root.append(title);
  const controls=make("div","");
  controls.setAttribute("role","group");
  controls.setAttribute("aria-label",step===1?"Выберите ось":step===2?"Выберите диагональ":"Выберите денежную или любовную точку");
  controls.style.cssText="display:flex;flex-wrap:wrap;gap:8px";
  options.forEach((option,i)=>{
    const active=i===internalDetail;
    const button=make("button","",option.label);
    button.type="button";
    button.setAttribute("aria-pressed",String(active));
    button.style.cssText="flex:1 1 120px;min-height:44px;min-width:0;padding:9px 10px;border-radius:11px;border:1px solid "+
      (active?"#29495b":"#c7d8d6")+";background:"+(active?"#29495b":"#fffefa")+
      ";color:"+(active?"#fff":"#29495b")+";font-size:13px;font-weight:800;cursor:pointer";
    button.addEventListener("click",()=>{
      internalDetail=i;
      drawCurrent();
    });
    controls.append(button);
  });
  root.append(controls);
}
function showCornerStep(root,matrix){
  const pairs=[
    ["Сверху слева:",[matrix.left,matrix.top],matrix.corners.topLeft],
    ["Сверху справа:",[matrix.top,matrix.right],matrix.corners.topRight],
    ["Снизу справа:",[matrix.right,matrix.bottom],matrix.corners.bottomRight],
    ["Снизу слева:",[matrix.bottom,matrix.left],matrix.corners.bottomLeft]
  ];
  const [label,values,result]=pairs[step];
  showCompactCalculations(root,[[label,compactSumFormula(values,result)]]);
}
function showInternalStep(root,m){
  const selected=getInternalSelection();
  if(step===1&&selected){
    const base=m[selected.base],part=m[selected.spoke];
    showCompactCalculations(root,[
      ["1. Средняя:",compactSumFormula([base,m.center],part.near)],
      ["2. Внешняя:",compactSumFormula([base,part.near],part.outer)],
      ["3. Ближе к центру:",compactSumFormula([part.near,m.center],part.core)]
    ]);
    return;
  }
  if(step===2&&selected){
    const base=m.corners[selected.corner],part=m.diagonals[selected.corner];
    showCompactCalculations(root,[
      ["1. Внутренняя:",compactSumFormula([base,m.center],part.near)],
      ["2. Внешняя:",compactSumFormula([base,part.near],part.outer)]
    ]);
    return;
  }
  if(step===4&&selected){
    const channels=[
      ["Вход в деньги:",compactSumFormula([m.right,m.center],m.channels.moneyEntry)],
      ["Вход в отношения:",compactSumFormula([m.bottom,m.center],m.channels.loveEntry)],
      ["Баланс:",compactSumFormula([m.channels.moneyEntry,m.channels.loveEntry],m.channels.balance)],
      ["Под долларом $:",compactSumFormula([m.channels.moneyEntry,m.channels.balance],m.channels.moneyPoint)],
      ["Под сердцем ♥:",compactSumFormula([m.channels.loveEntry,m.channels.balance],m.channels.lovePoint)]
    ];
    showCompactCalculations(root,[channels[internalDetail]||channels[0]]);
    return;
  }
  const examples=[
    [["Центр:",compactSumFormula([m.left,m.top,m.right,m.bottom],m.center)],
      ["Верхний левый угол:",compactSumFormula([m.left,m.top],m.corners.topLeft)]],
    [["Верхняя ось:",compactSumFormula([m.top,m.center],m.topSpoke.near)],
      ["Левая ось:",compactSumFormula([m.left,m.center],m.leftSpoke.near)],
      ["Правая ось:",compactSumFormula([m.right,m.center],m.rightSpoke.near)]],
    [["Слева сверху / внутренняя:",compactSumFormula([m.corners.topLeft,m.center],m.diagonals.topLeft.near)],
      ["Слева сверху / внешняя:",compactSumFormula([m.corners.topLeft,m.diagonals.topLeft.near],m.diagonals.topLeft.outer)]],
    [["Нижняя первая:",compactSumFormula([m.center,m.bottom],m.tail.first)],
      ["Нижняя вторая:",compactSumFormula([m.bottom,m.tail.first],m.tail.second)]],
    [["Вход в деньги:",compactSumFormula([m.right,m.center],m.channels.moneyEntry)],
      ["Вход в отношения:",compactSumFormula([m.bottom,m.center],m.channels.loveEntry)],
      ["Баланс:",compactSumFormula([m.channels.moneyEntry,m.channels.loveEntry],m.channels.balance)],
      ["Под долларом:",compactSumFormula([m.channels.moneyEntry,m.channels.balance],m.channels.moneyPoint)],
      ["Под сердцем:",compactSumFormula([m.channels.loveEntry,m.channels.balance],m.channels.lovePoint)]]
  ];
  showCompactCalculations(root,examples[step]);
}
// У каждого урока своя траектория: правило 22, основные числа, углы, внутренние числа.
function guidedStart(){
  return id==="start"?0:(id==="reduce"||id==="base"?1:0);
}
function guidedEnd(){
  return id==="start"?firstLessonSteps.length-1:id==="reduce"?2:id==="base"?3:id==="corners"?3:4;
}
function guidedCount(){
  const first=guidedStart();
  return "ШАГ "+(step-first+1)+" ИЗ "+(guidedEnd()-first+1);
}
function guidedTitle(isFull){
  if(id==="reduce")return step===1?"Какие числа оставляем, а какие сокращаем":"Разбираем дату 31.10.1988";
  if(id==="corners")return cornerStages[step].title;
  if(id==="internal")return internalStages[step].title;
  return isFull?"Разберите внутренние числа":stepTitles[step];
}
function guidedText(isFull){
  if(id==="reduce"){
    return step===1
      ?"В матрице судьбы используются числа от 1 до 22 включительно. Любое число в этом диапазоне оставляем как есть: 11, 15 и 22 тоже не сокращаем. Если число больше 22, складываем его цифры. Если снова получилось больше 22, повторяем сложение. Не вычитаем 22 из числа."
      :"Посмотрим на дату 31.10.1988. Слева записываем день рождения, сверху — месяц, справа — сумму цифр года. Если полученное число больше 22, сокращаем его сложением цифр. На схеме показан результат каждого расчёта.";
  }
  if(id==="corners")return cornerStages[step].text;
  if(id==="internal"&&step===1&&currentBirth){
    const selected=getInternalSelection();
    if(selected){
      const m=calculateMatrix(currentBirth);
      const edge=m[selected.base];
      const middle=m[selected.spoke].near;
      const outer=m[selected.spoke].outer;
      const inner=m[selected.spoke].core;
      return "Выбрана "+selected.label.toLowerCase()+". На её краю стоит "+edge+", а в центре матрицы — "+m.center+". "+
        "1. Складываем "+compactSumFormula([edge,m.center],middle)+". Записываем "+middle+" между крайним числом "+edge+" и центром. "+
        "2. Складываем "+compactSumFormula([edge,middle],outer)+". Записываем "+outer+" между "+edge+" и "+middle+". "+
        "3. Складываем "+compactSumFormula([middle,m.center],inner)+". Записываем "+inner+" между "+middle+" и центром. "+
        "Теперь от края линии к центру числа идут так: "+[edge,outer,middle,inner,m.center].join(" → ")+". "+
        "Выберите другую ось кнопками над схемой, чтобы разобрать её точно так же.";
    }
  }
  if(id==="internal")return internalStages[step].text;
  return stepDescriptions[step];
}
function showRulePractice(root){
  showCompactCalculations(root,[
    ["Оставляем без изменений:","Все числа от 1 до 22 включительно."],
    ["Складываем цифры:","Все числа больше 22 (начиная с 23)."],
    ["Повторяем при необходимости:","Если сумма цифр снова больше 22, складываем её цифры ещё раз."]
  ]);
}
function showRuleDateExample(root){
  showCompactCalculations(root,[
    ["Слева — день 31:","31 больше 22, поэтому 3 + 1 = 4."],
    ["Сверху — месяц 10:","10 не больше 22, поэтому оставляем 10."],
    ["Справа — год 1988:","1 + 9 + 8 + 8 = 26. 26 больше 22, поэтому 2 + 6 = 8."]
  ]);
}
function drawCurrent() {
  if(id==="reduce"){
    // В этом уроке сначала объясняем правило, затем показываем одну учебную дату.
    // Не просим вводить дату и не подменяем учебный пример данными другого ученика.
    const exampleStep=step===2;
    const frame=diagram.parentElement;
    frame.hidden=!exampleStep;
    const grid=frame.parentElement;
    grid.style.gridTemplateColumns=exampleStep?"":"minmax(0,1fr)";
    if(exampleStep)drawBasic(calculateMatrix({day:31,month:10,year:1988}));
    else diagram.replaceChildren();
    $("lesson-step-count").textContent=guidedCount();
    $("lesson-step-title").textContent=guidedTitle(false);
    $("lesson-step-text").textContent=guidedText(false);
    $("lesson-step-formula").hidden=false;
    if(exampleStep)showRuleDateExample($("lesson-step-formula"));
    else showRulePractice($("lesson-step-formula"));
    $("lesson-step-back").disabled=step<=guidedStart();
    $("lesson-step-next").disabled=false;
    $("lesson-step-next").textContent=exampleStep?"К тесту →":"Следующий шаг →";
    return;
  }
  if(id==="start"){
    const info=firstLessonSteps[step];
    drawFirstLessonOutline();
    $("lesson-step-count").textContent="ШАГ "+(step+1)+" ИЗ "+firstLessonSteps.length;
    $("lesson-step-title").textContent=info.title;
    $("lesson-step-text").textContent=info.text;
    // В первом уроке нет блока примеров: всё нужное видно на рисунке и в шаге.
    $("lesson-step-formula").hidden=true;
    $("lesson-step-back").disabled=step<=guidedStart();
    const next=$("lesson-step-next");
    next.disabled=false;
    next.textContent=step===firstLessonSteps.length-1?"Открыть тест ✓":"Следующий шаг →";
    return;
  }
  if(!currentBirth){
    if(id==="internal"){
      const picker=$("school-internal-picker");
      if(picker)picker.style.display="none";
    }
    // Пока ученик не выбрал свою дату, показываем только пустую схему без чужого расчёта.
    drawBasic(null);
    $("lesson-step-count").textContent=guidedCount();
    $("lesson-step-title").textContent=guidedTitle(id==="internal");
    $("lesson-step-text").textContent=guidedText(id==="internal");
    $("lesson-step-formula").hidden=false;
    $("lesson-step-formula").classList.remove("is-calculation-breakdown","is-bottom-explanation");
    $("lesson-step-formula").textContent="Введите дату рождения выше и нажмите «Использовать», чтобы начать расчёт.";
    $("lesson-step-back").disabled=true;
    $("lesson-step-next").disabled=true;
    $("lesson-step-next").textContent="Следующий шаг →";
    return;
  }
  $("lesson-step-formula").hidden=false;
  const m=calculateMatrix(currentBirth);
  const full=id==="internal";
  if(full)updateInternalPicker();
  if(full) drawAllPositions(m);
  else drawBasic(m);
  $("lesson-step-count").textContent=guidedCount();
  $("lesson-step-title").textContent=guidedTitle(full);
  $("lesson-step-text").textContent=guidedText(full);
  const formulaBlock=$("lesson-step-formula");
  if((id==="reduce"||id==="base")&&step===1){
    showFirstThreeCalculations(formulaBlock,m,currentBirth);
  }else if(id==="reduce"&&step===2){
    showRulePractice(formulaBlock);
  }else if(id==="corners"){
    showCornerStep(formulaBlock,m);
  }else if(id==="internal"){
    showInternalStep(formulaBlock,m);
  }else if(step===2){
    showBottomCalculation(formulaBlock,m);
  }else if(step===3){
    showCenterCalculation(formulaBlock,m);
  }else if(full){
    showInternalCalculations(formulaBlock,m);
  }else if(step===4){
    showCornerCalculations(formulaBlock,m);
  }else{
    formulaBlock.classList.remove("is-calculation-breakdown","is-bottom-explanation");
    const examples=[
      "Пока ничего не считаем - рисуем девять мест.",
      "Слева "+m.left+", сверху "+m.top+", справа "+m.right+".",
      m.left+" + "+m.top+" + "+m.right+" → "+m.bottom+".",
      m.left+" + "+m.top+" + "+m.right+" + "+m.bottom+" → "+m.center+".",
      "Углы: "+m.corners.topLeft+", "+m.corners.topRight+", "+m.corners.bottomRight+", "+m.corners.bottomLeft+"."
    ];
    formulaBlock.textContent=full?"Готовая основа. Теперь показаны все 31 позиции нашей интерактивной матрицы.":examples[step];
  }
  $("lesson-step-back").disabled=step<=guidedStart();
  $("lesson-step-next").disabled=false;
  $("lesson-step-next").textContent=step===guidedEnd()?"К тесту →":"Следующий шаг →";
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
  }else if(id==="reduce"){
    $("lesson-drawing-title").textContent="Сначала правило, затем пример";
    $("lesson-drawing-description").textContent="На первом шаге изучим правило 22 энергий. На втором разберём дату 31.10.1988 и заполним три основных кружка.";
    $("lesson-date-form").hidden=true;
  }
  step=id==="start"?0:([0,1,1,0,0][index]??0);
  $("lesson-step-back").addEventListener("click",()=>{
    step=Math.max(guidedStart(),step-1);
    if(id==="internal")internalDetail=0;
    drawCurrent();
  });
  $("lesson-step-next").addEventListener("click",()=>{
    const max=guidedEnd();
    if(step===max){
      if(id==="start")unlockFirstLessonQuiz();
      else $("lesson-quiz").scrollIntoView({behavior:"smooth",block:"start"});
      return;
    }
    step=Math.min(max,step+1);
    if(id==="internal")internalDetail=0;
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
    if(id!=="start"){
      currentBirth=null;
      drawCurrent();
    }
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
    if(id==="internal")internalDetail=0;
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
  const review=make("div","school-quiz-review");
  review.hidden=true;
  form.append(review);

  const retry=make("button","school-quiz-retry","↻ Пройти урок ещё раз");
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
    }else if(index<=4){
      // У этих уроков обучение проходит на схеме, а не в повторяющейся статье.
      step=[0,1,1,0,0][index];
      drawCurrent();
      $("lesson-drawing").scrollIntoView({behavior:"smooth",block:"start"});
    }else{
      $("lesson-content").scrollIntoView({behavior:"smooth",block:"start"});
    }
  });
  form.append(retry);
  form.addEventListener("submit",event=>{
    event.preventDefault();
    const answers=data.questions.map((_,i)=>form.querySelector(`input[name="quiz-${i}"]:checked`));
    if(answers.some(a=>!a)){feedback.textContent="Выберите ответ на каждый вопрос.";return}
    const score=answers.filter((a,i)=>Number(a.value)===data.questions[i].correct).length;
    if(score===data.questions.length){
      let saved=false;
      try{
        const done=readCompleted();
        done.add(data.id);
        localStorage.setItem(storeKey,JSON.stringify([...done]));
        saved=readCompleted().has(data.id);
      }catch{/* Без сохранения следующий урок остаётся закрытым. */}
      review.hidden=true;
      review.replaceChildren();
      feedback.classList.remove("is-incorrect");
      feedback.classList.add("is-correct");
      feedback.textContent=saved
        ?"Отлично! Урок пройден. Можно переходить к следующему."
        :"Ответы правильные, но браузер не сохранил прогресс. Разрешите сохранение данных сайта, чтобы открыть следующий урок.";
      retry.hidden=true;
      submit.textContent=saved?"✓ Урок пройден":"✓ Ответы правильные";
      renderNavigation();
      feedback.scrollIntoView({behavior:"smooth",block:"center"});
    }else{
      feedback.classList.remove("is-correct");
      feedback.classList.add("is-incorrect");
      feedback.textContent="Правильно "+score+" из "+data.questions.length+". Посмотрите разбор ошибок и попробуйте снова.";
      review.replaceChildren();
      data.questions.forEach((question,i)=>{
        if(Number(answers[i].value)===question.correct)return;
        const item=make("p","school-quiz-review-item");
        item.append(make("strong","","Вопрос "+(i+1)+": "),document.createTextNode(question.explain));
        review.append(item);
      });
      review.hidden=false;
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
  if(prev)nav.append(link(prev,"← Предыдущий урок","school-secondary school-lesson-prev"));
  if(next&&readCompleted().has(id))nav.append(link(next,"Следующий урок →","school-primary school-lesson-next"));
  else if(next){
    const locked=make("span","school-lesson-locked-next school-lesson-next","🔒 Следующий урок");
    locked.setAttribute("aria-disabled","true");
    locked.title="Правильно ответьте на все вопросы, чтобы открыть следующий урок";
    nav.append(locked);
  }
  const all=make("a","school-lesson-all","Вся программа");
  all.href="pro/school/";
  nav.append(all);
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
  if(id==="start"){
    // Объяснение начинается непосредственно в шагах: два вступления подряд не нужны.
    $("lesson-hero").classList.add("is-compact");
    $("lesson-drawing").classList.add("is-first-lesson");
  }
  const root=$("lesson-content");
  // Первые пять уроков проходят по интерактивным шагам матрицы.
  // После них сразу идёт тест, без повторной статьи с теми же шагами.
  // В остальных уроках текст сохраняем: интерактивного объяснения там ещё нет.
  const hasInteractiveSteps=index<=4;
  root.hidden=hasInteractiveSteps;
  root.replaceChildren();
  if(!hasInteractiveSteps){
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
    const res=await fetch("pro/school/lessons-manifest.json?v=4");
    if(!res.ok)throw Error("Список уроков не найден");
    const meta=await res.json();
    if(meta.schema!=="pro-school-lessons-manifest-v1"||!Array.isArray(meta.lessons))throw Error("Некорректная программа");
    manifest=meta.lessons;
    index=manifest.findIndex(item=>item.id===id);
    if(index<0)throw Error("Урок не найден");
    const completed=readCompleted();
    const firstMissing=manifest.slice(0,index).find(item=>!completed.has(item.id));
    if(firstMissing){
      document.title="Урок закрыт | Самоучитель по матрице судьбы";
      $("lesson-count").textContent="УРОК "+(index+1)+" ИЗ "+manifest.length;
      $("lesson-title").textContent="Этот урок пока закрыт";
      $("lesson-lead").textContent="Уроки открываются по порядку после правильных ответов на тест предыдущего урока.";
      $("lesson-content").hidden=true;
      $("lesson-quiz").hidden=true;
      const notice=$("lesson-error");
      notice.hidden=false;
      notice.textContent="🔒 Сначала успешно пройдите урок «"+firstMissing.title+"».";
      const nav=$("lesson-navigation");
      nav.replaceChildren();
      const back=make("a","school-primary","Открыть нужный урок →");
      back.href="pro/school/lesson/?id="+encodeURIComponent(firstMissing.id);
      nav.append(back);
      return;
    }
    // Lesson text remains owner-only on REG.RU. Never fetch private lesson JSON publicly.
    const response=await fetch("/api/numi-school.php",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        action:"content",
        init_data:window.Telegram?.WebApp?.initData||"",
        path:manifest[index].file
      })
    });
    if(!response.ok)throw Error(response.status===403?"Доступ к самоучителю не подтверждён":"Материал урока не найден");
    const payload=await response.json();
    if(payload?.ok!==true||!payload.content||typeof payload.content!=="object")throw Error("Ответ сервера уроков некорректен");
    lesson=payload.content;
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
