import { calculateMatrix, parseBirthDate, reduce22 } from "../numerology-core.js?v=1";
import { buildFullReportSections, loadFullReportKnowledge, loadFullReportSection } from "../full-report-library.js?v=3";
import { findKarmicPrograms, findKarmicTail, loadKarmicPrograms, loadKarmicTails } from "../karmic-programs.js?v=2";

const form = document.querySelector("#pro-form");
const input = document.querySelector("#pro-birth-date");
const error = document.querySelector("#pro-error");
const results = document.querySelector("#pro-results");
const diagram = document.querySelector("#pro-diagram");
const zoneButtons = document.querySelector("#pro-zone-buttons");
const zoneGuide = document.querySelector("#pro-zone-guide");
const positionButtons = document.querySelector("#pro-position-buttons");
const positionDetail = document.querySelector("#pro-position-detail");
const questionButtons = document.querySelector("#pro-question-buttons");
const answer = document.querySelector("#pro-answer");
const karmic = document.querySelector("#pro-karma");
const namespace = "http://www.w3.org/2000/svg";
let current = null;
let requestId = 0;
let zoneLibraryRequest;

function loadZoneLibrary() {
  if (!zoneLibraryRequest) {
    zoneLibraryRequest = fetch("pro/zones.json?v=1")
      .then((response) => {
        if (!response.ok) throw new Error("Не удалось загрузить обучающие зоны");
        return response.json();
      })
      .then((source) => {
        if (!Array.isArray(source.zones) || source.zones.length !== 8) {
          throw new Error("Неполная база обучающих зон");
        }
        return source.zones;
      })
      .catch((err) => {
        zoneLibraryRequest = null;
        throw err;
      });
  }
  return zoneLibraryRequest;
}

const category = {
  impression: "Личность", trueSelf: "Личность", growth: "Личность", character: "Личность",
  parentsPain: "Семья и род", familyError: "Семья и род",
  trueLove: "Любовь", partner: "Любовь",
  moneyBlock: "Деньги", moneyFlow: "Деньги", earning: "Деньги",
  energyLeak: "Состояние", health: "Состояние", lifeLesson: "Уроки жизни"
};

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function paragraph(text, className) {
  return element("p", text, className);
}

function appendParagraph(parent, text, className) {
  if (text) parent.append(paragraph(text, className));
}

function svgElement(tag, attributes) {
  const node = document.createElementNS(namespace, tag);
  Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function sumDigits(number) {
  return String(number).split("").reduce((sum, digit) => sum + Number(digit), 0);
}

function expression(values, result) {
  const sum = values.reduce((a, b) => a + b, 0);
  return values.join(" + ") + " = " + sum + (sum === result ? "" : " → " + result);
}

function nodesFor(birth, matrix) {
  const m = matrix;
  const points = [];
  const add = (key, label, x, y, value, formula, kind, topic, hint) => {
    points.push({key, label, x, y, value, formula, kind:kind || "", topic:topic || "", hint:hint || ""});
  };
  const baseHint = "Основная позиция: её значение используется для персональной расшифровки.";
  const extraHint = "Вспомогательная точка. Для полного вывода сопоставляйте её с соседними числами и основной позицией.";
  add("top","Месяц рождения",310,52,m.top,"Месяц рождения: " + birth.month,"major","",baseHint);
  add("right","Энергия года рождения",568,310,m.right,"Сумма цифр года " + birth.year + ": " + sumDigits(birth.year) + " → " + m.right,"major","earning",baseHint);
  add("bottom","Главный урок",310,568,m.bottom,expression([m.left,m.top,m.right],m.bottom),"major","lifeLesson",baseHint);
  add("left","День рождения / внешний образ",52,310,m.left,"День рождения: " + birth.day + " → " + m.left,"major","impression",baseHint);
  add("topLeft","Родительская тема",128,128,m.corners.topLeft,expression([m.left,m.top],m.corners.topLeft),"","parentsPain",baseHint);
  add("topRight","Партнёрство",492,128,m.corners.topRight,expression([m.top,m.right],m.corners.topRight),"","partner",baseHint);
  add("bottomRight","Реализация и рост",492,492,m.corners.bottomRight,expression([m.right,m.bottom],m.corners.bottomRight),"","growth",baseHint);
  add("bottomLeft","Любовь и близость",128,492,m.corners.bottomLeft,expression([m.bottom,m.left],m.corners.bottomLeft),"","trueLove",baseHint);
  add("topOuter","Верхняя ось / внешняя точка",310,108,m.topSpoke.outer,expression([m.top,m.topSpoke.near],m.topSpoke.outer),"","",extraHint);
  add("topNear","Верхняя ось / средняя точка",310,158,m.topSpoke.near,expression([m.top,m.center],m.topSpoke.near),"","",extraHint);
  add("topCore","Верхняя ось / внутренняя точка",310,216,m.topSpoke.core,expression([m.topSpoke.near,m.center],m.topSpoke.core),"","",extraHint);
  add("leftOuter","Левая ось / внешняя точка",108,310,m.leftSpoke.outer,expression([m.left,m.leftSpoke.near],m.leftSpoke.outer),"","",extraHint);
  add("leftNear","Левая ось / средняя точка",158,310,m.leftSpoke.near,expression([m.left,m.center],m.leftSpoke.near),"","",extraHint);
  add("leftCore","Левая ось / внутренняя точка",216,310,m.leftSpoke.core,expression([m.leftSpoke.near,m.center],m.leftSpoke.core),"","",extraHint);
  add("rightOuter","Что блокирует деньги",432,310,m.rightSpoke.outer,expression([m.right,m.rightSpoke.near],m.rightSpoke.outer),"","moneyBlock",baseHint);
  add("rightNear","Как включить денежный поток",382,310,m.rightSpoke.near,expression([m.right,m.center],m.rightSpoke.near),"","moneyFlow",baseHint);
  add("rightCore","Где легче зарабатывать",356,356,m.rightSpoke.core,expression([m.rightSpoke.near,m.center],m.rightSpoke.core),"","earning",baseHint);
  add("tailFirst","Кармический хвост / начало",310,388,m.tail.first,expression([m.center,m.bottom],m.tail.first),"","lifeLesson",baseHint);
  add("tailSecond","Кармический хвост / продолжение",310,442,m.tail.second,expression([m.bottom,m.tail.first],m.tail.second),"","familyError",baseHint);
  const diag = [
    ["topLeft",m.corners.topLeft,m.diagonals.topLeft,186,186,230,230,"Верхняя левая диагональ"],
    ["topRight",m.corners.topRight,m.diagonals.topRight,434,186,390,230,"Верхняя правая диагональ"],
    ["bottomRight",m.corners.bottomRight,m.diagonals.bottomRight,434,434,390,390,"Нижняя правая диагональ"],
    ["bottomLeft",m.corners.bottomLeft,m.diagonals.bottomLeft,186,434,230,390,"Нижняя левая диагональ"]
  ];
  diag.forEach(([key,base,part,ox,oy,nx,ny,label]) => {
    add(key + "Outer",label + " / внешняя",ox,oy,part.outer,expression([base,part.near],part.outer),"","",extraHint);
    add(key + "Near",label + " / внутренняя",nx,ny,part.near,expression([base,m.center],part.near),"","",extraHint);
  });
  add("center","Центральная энергия",310,310,m.center,expression([m.left,m.top,m.right,m.bottom],m.center),"center","trueSelf",baseHint);
  return points;
}


function renderZones(zones) {
  const fragment = document.createDocumentFragment();
  zones.forEach((zone) => {
    const button = element("button", null, "pro-zone-button");
    button.type = "button";
    button.dataset.zone = zone.id;
    button.style.setProperty("--zone-color", zone.color);
    button.setAttribute("aria-pressed", "false");
    button.append(element("span", "", "pro-zone-dot"));
    const labels = element("span", null, "pro-zone-labels");
    labels.append(element("strong", zone.title));
    labels.append(element("small", zone.subtitle));
    button.append(labels);
    button.addEventListener("click", () => selectZone(zone.id, true));
    fragment.append(button);
  });
  zoneButtons.replaceChildren(fragment);
}

function paintZone(zone) {
  if (!current) return;
  const layer = diagram.querySelector(".pro-zone-highlights");
  const svg = diagram.querySelector("svg");
  if (!layer || !svg) return;
  layer.replaceChildren();
  svg.style.setProperty("--zone-color", zone?.color || "#b89966");
  const selected = new Set(zone?.points || []);
  const points = current.points.filter((point) => selected.has(point.key));

  // Подсветка только тематических точек - структура и формулы матрицы неизменны.
  if (points.length) {
    const anchor = points[0];
    points.slice(1).forEach((point) => {
      if (Math.hypot(point.x - anchor.x, point.y - anchor.y) <= 175) {
        layer.append(svgElement("line", {
          x1:anchor.x,y1:anchor.y,x2:point.x,y2:point.y
        }));
      }
    });
    points.forEach((point) => {
      layer.append(svgElement("circle",{
        cx:point.x,cy:point.y,r:(point.kind === "center" ? 46 : point.kind === "major" ? 41 : 31)
      }));
    });
  }
  diagram.querySelectorAll(".pro-node").forEach((node) => {
    node.classList.toggle("in-zone", selected.has(node.dataset.nodeKey));
    node.classList.toggle("out-of-zone",Boolean(zone) && !selected.has(node.dataset.nodeKey));
  });
  // Подсветить и соответствующие кнопки в списках точек и вопросов.
  // Зона остаётся цветовой подсказкой, а не меняет расчёты.
  positionButtons.style.setProperty("--zone-color", zone?.color || "#698c91");
  questionButtons.style.setProperty("--zone-color", zone?.color || "#698c91");
  positionButtons.querySelectorAll("button[data-key]").forEach((button) => {
    button.classList.toggle("in-zone", selected.has(button.dataset.key));
  });
  const zoneQuestions = new Set(zone?.questions || []);
  questionButtons.querySelectorAll("button[data-question]").forEach((button) => {
    button.classList.toggle("in-zone", zoneQuestions.has(button.dataset.question));
  });
  zoneButtons.querySelectorAll("button[data-zone]").forEach((button) => {
    button.setAttribute("aria-pressed",String(button.dataset.zone === zone?.id));
  });
  diagram.querySelectorAll(".pro-sector-tag").forEach((tag) => {
    const isActive = tag.dataset.zone === zone?.id;
    tag.classList.toggle("selected", isActive);
    tag.setAttribute("aria-pressed", String(isActive));
  });
}

function clearZone() {
  if (!current || !current.activeZone) return;
  current.activeZone = null;
  zoneGuide.hidden = true;
  zoneGuide.replaceChildren();
  paintZone(null);
}

function renderZoneGuide(zone) {
  if (!current) return;
  zoneGuide.hidden = false;
  zoneGuide.replaceChildren();
  zoneGuide.style.setProperty("--zone-color",zone.color);
  zoneGuide.append(paragraph("ИЗУЧАЕМ ЗОНУ","pro-eyebrow"));
  zoneGuide.append(element("h3",zone.title));
  zoneGuide.append(paragraph(zone.description));
  zoneGuide.append(paragraph(zone.guide,"pro-zone-lesson"));
  const pointHeader=element("h4","Изучите выделенные точки");
  zoneGuide.append(pointHeader);
  const pointLinks=element("div",null,"pro-zone-point-links");
  zone.points.forEach((key) => {
    const point=current.points.find((item)=>item.key===key);
    if (!point) return;
    const button=element("button",point.label+" · "+point.value);
    button.type="button";
    button.addEventListener("click",()=>selectPoint(key,true));
    pointLinks.append(button);
  });
  zoneGuide.append(pointLinks);
  const availableQuestions=zone.questions.map(key=>current.definitions.find(def=>def.key===key)).filter(Boolean);
  if (availableQuestions.length) {
    zoneGuide.append(element("h4","Развёрнутые ответы по теме"));
    const questions=element("div",null,"pro-zone-question-links");
    availableQuestions.forEach((definition)=>{
      const button=element("button",definition.title+" →");
      button.type="button";
      button.addEventListener("click",()=>selectQuestion(definition.key,true));
      questions.append(button);
    });
    zoneGuide.append(questions);
  }
}

function selectZone(id, scrollToDiagram = false) {
  if (!current) return;
  const zone=current.zones.find((item)=>item.id===id);
  if (!zone) return;
  if (current.activeZone?.id === id) {
    clearZone();
    return;
  }
  current.activeZone=zone;
  paintZone(zone);
  renderZoneGuide(zone);
  const first=zone.points.find(key=>current.points.some(point=>point.key===key));
  if(first)selectPoint(first,false);
  if (scrollToDiagram) {
    diagram.scrollIntoView({behavior:"smooth",block:"start"});
  }
}

// Аккуратные подписи вокруг самой схемы. Координаты относятся только к
// расположению надписей, а не меняют алгоритм и не добавляют новых расчётов.
const sectorLabelPositions = {
  spirit:        {x:165,y:43,width:200},
  talents:       {x:449,y:43,width:202},
  lineage:       {x:108,y:245,width:190},
  relationships: {x:537,y:205,width:150},
  money:         {x:538,y:404,width:116},
  resource:      {x:128,y:553,width:192},
  family:        {x:487,y:555,width:160},
  purpose:       {x:310,y:628,width:195}
};

function renderDiagramSectorLabels(svg, zones) {
  const layer = svgElement("g",{"class":"pro-sector-labels","aria-label":"Названия зон матрицы"});
  zones.forEach((zone) => {
    const p = sectorLabelPositions[zone.id];
    if (!p) return;
    const tag = svgElement("g",{
      "class":"pro-sector-tag","data-zone":zone.id,
      role:"button",tabindex:"0","aria-label":"Подсветить зону: "+zone.title,
      "aria-pressed":"false"
    });
    tag.style.setProperty("--sector-color",zone.color);
    tag.append(svgElement("rect",{
      x:p.x-p.width/2,y:p.y-19,width:p.width,height:38,rx:19
    }));
    tag.append(svgElement("circle",{
      cx:p.x-p.width/2+18,cy:p.y,r:5
    }));
    const name = svgElement("text",{
      x:p.x+10,y:p.y+1,"text-anchor":"middle","dominant-baseline":"middle"
    });
    name.textContent = zone.title;
    tag.append(name);
    // Прозрачная область для нажатия поверх всей подписи.
    // Без неё Safari может не передавать касания группе SVG.
    tag.append(svgElement("rect",{
      "class":"pro-sector-hitbox",
      x:p.x-p.width/2,y:p.y-29,width:p.width,height:58,rx:24,
      fill:"transparent"
    }));
    const activate = () => selectZone(zone.id);
    tag.addEventListener("click",activate);
    tag.addEventListener("keydown",(event)=>{
      if(event.key==="Enter" || event.key===" "){event.preventDefault();activate();}
    });
    layer.append(tag);
  });
  svg.append(layer);
}

function renderDiagram(points) {
  const svg = svgElement("svg",{viewBox:"0 0 620 660",role:"group","aria-label":"Интерактивная матрица с нажимаемыми названиями сфер и 28 точками"});
  const frame = svgElement("g",{fill:"none",stroke:"#b4aba0","stroke-width":"1.9"});
  [
    ["polygon",{points:"310,34 506,114 586,310 506,506 310,586 114,506 34,310 114,114"}],
    ["rect",{x:114,y:114,width:392,height:392}],
    ["polygon",{points:"310,34 586,310 310,586 34,310"}],
    ["polygon",{points:"310,104 516,310 310,516 104,310"}],
    ["circle",{cx:310,cy:310,r:156}]
  ].forEach(([tag,attrs]) => frame.append(svgElement(tag,attrs)));
  [
    [310,68,310,552,"#b4aba0"],[68,310,552,310,"#b4aba0"],
    [142,478,478,142,"#9baeb9"],[142,142,478,478,"#ceabb0"]
  ].forEach(([x1,y1,x2,y2,stroke])=>frame.append(svgElement("line",{x1,y1,x2,y2,stroke})));
  svg.append(frame);
  svg.append(svgElement("g",{"class":"pro-zone-highlights","aria-hidden":"true"}));
  points.forEach((point) => {
    const g = svgElement("g",{"class":"pro-node "+point.kind,"data-node-key":point.key,role:"button",tabindex:"0","aria-label":point.label + ": " + point.value});
    const radius = point.kind === "center" ? 34 : point.kind === "major" ? 29 : 20;
    g.append(svgElement("circle",{cx:point.x,cy:point.y,r:radius}));
    const text = svgElement("text",{x:point.x,y:point.y + 1});
    text.textContent = String(point.value);
    g.append(text);
    const activate = () => selectPoint(point.key,true);
    g.addEventListener("click",activate);
    g.addEventListener("keydown",(event) => {if(event.key==="Enter"||event.key===" "){event.preventDefault();activate();}});
    svg.append(g);
  });
  renderDiagramSectorLabels(svg, current?.zones || []);
  diagram.replaceChildren(svg);
}

function selectPoint(key, scroll) {
  if(!current)return;
  const point = current.points.find(item => item.key === key);
  if(!point)return;
  if(current.activeZone && !current.activeZone.points.includes(key))clearZone();
  diagram.querySelectorAll(".pro-node").forEach(node => node.classList.toggle("active",node.dataset.nodeKey===key));
  positionButtons.querySelectorAll("button").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.key===key)));
  const energy = current.knowledge.energies[String(point.value)];
  positionDetail.replaceChildren();
  positionDetail.append(element("p","ПОЗИЦИЯ И ЕЁ РАСЧЁТ","pro-eyebrow"));
  positionDetail.append(element("h3",point.label + " · " + point.value));
  positionDetail.append(paragraph("Формула: " + point.formula,"pro-equation"));
  if(energy){
    positionDetail.append(element("h4",energy.name || "Энергия " + point.value));
    appendParagraph(positionDetail,energy.shortEssence);
    appendParagraph(positionDetail,"Сильная сторона: " + (energy.plus || energy.mainStrength || "Нет описания."));
    appendParagraph(positionDetail,"Сложность: " + (energy.minus || energy.mainBlock || "Нет описания."));
    appendParagraph(positionDetail,"Практический ориентир: " + (energy.advice || "Сопоставьте эту точку с остальной картой."));
  }
  appendParagraph(positionDetail,point.hint,"pro-muted");
  if(point.topic){
    const definition=current.definitions.find(item=>item.key===point.topic);
    if(definition){
      const button=element("button","Подробно: " + definition.title + " →","pro-detail-link");
      button.type="button";
      button.addEventListener("click",()=>selectQuestion(definition.key,true));
      positionDetail.append(button);
    }
  }
  if(scroll)positionDetail.scrollIntoView({behavior:"smooth",block:"nearest"});
}

function renderPointList(points) {
  const frag=document.createDocumentFragment();
  points.forEach((point)=>{
    const button=element("button",point.label+" · "+point.value);
    button.type="button";
    button.dataset.key=point.key;
    button.setAttribute("aria-pressed","false");
    button.addEventListener("click",()=>selectPoint(point.key,false));
    frag.append(button);
  });
  positionButtons.replaceChildren(frag);
}

function renderQuestions(definitions) {
  const frag=document.createDocumentFragment();
  definitions.forEach((definition)=>{
    const button=element("button");
    button.type="button";
    button.dataset.question=definition.key;
    button.setAttribute("aria-pressed","false");
    button.append(element("small",category[definition.key] || "Расшифровка"));
    button.append(element("span",definition.title));
    button.addEventListener("click",()=>selectQuestion(definition.key,true));
    frag.append(button);
  });
  questionButtons.replaceChildren(frag);
}

function isSubheading(text) {
  if(text.length>68 || text.includes("\n"))return false;
  return /^(Что это значит|Как проявляется|Где уходит|Что делать|Чего не делать|Стратегия|В плюсе|В минусе|Главный совет|Ваши сильные|Ваши слабые|Как включить|Где легче)/i.test(text) && !/[.!?]$/.test(text);
}

async function selectQuestion(key, scroll) {
  if(!current)return;
  const definition = current.definitions.find(item=>item.key===key);
  if(!definition)return;
  const id=current.id;
  current.selected=key;
  questionButtons.querySelectorAll("button").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.question===key)));
  answer.replaceChildren(paragraph("Загружаю подробную расшифровку…","pro-muted"));
  if(scroll)answer.scrollIntoView({behavior:"smooth",block:"start"});
  try {
    const bank=await loadFullReportSection(definition.energy);
    if(!current || current.id!==id || current.selected!==key)return;
    const source=bank?.sections?.[key];
    if(!source?.paragraphs?.length)throw new Error("Нет описания этой позиции");
    answer.replaceChildren();
    answer.append(paragraph("ОТВЕТ ПО ВАШЕЙ МАТРИЦЕ","pro-eyebrow"));
    answer.append(element("h3",source.title || definition.title));
    const chips=element("div",null,"pro-chips");
    chips.append(element("span","Энергия " + definition.energy));
    chips.append(element("span","Тема: " + (category[key] || "Расшифровка")));
    const energy=current.knowledge.energies[String(definition.energy)];
    if(energy?.name)chips.append(element("span",energy.name));
    answer.append(chips);
    const match = current.points.find(point=>point.topic===key);
    if(match)answer.append(paragraph("Точка матрицы: " + match.label + ". Формула: " + match.formula,"pro-equation"));
    source.paragraphs.filter(Boolean).forEach((text)=>{
      answer.append(isSubheading(text)?element("h4",text,"pro-paragraph-title"):paragraph(text));
    });
  }catch(err){
    if(!current || current.id!==id)return;
    answer.replaceChildren(paragraph("Не удалось загрузить расшифровку. Проверьте соединение и попробуйте выбрать вопрос снова.","pro-muted"));
  }
}

function renderKarmic(matrix, programsBank, tailsBank) {
  const tail=findKarmicTail(matrix,tailsBank);
  const programs=findKarmicPrograms(matrix,programsBank);
  karmic.replaceChildren();
  const code=[matrix.tail.first,matrix.tail.second,matrix.bottom].join("-");
  karmic.append(paragraph("Кармический хвост: " + code));
  function card(title,source){
    const details=element("details");
    const summary=element("summary",title);
    details.append(summary);
    (source.parts||[]).forEach(part=>{
      details.append(element("h4",part.title));
      details.append(paragraph(part.text));
    });
    return details;
  }
  if(tail)karmic.append(card("Описание кармического хвоста",tail));
  else karmic.append(paragraph("Для этой комбинации развёрнутая программа пока не найдена.","pro-muted"));
  if(programs.length){
    programs.forEach(program=>karmic.append(card(program.code+" · "+program.title+" (повторов: "+program.repeats+")",program)));
  }else{
    karmic.append(paragraph("Среди подготовленных кармических программ дополнительных совпадений не найдено.","pro-muted"));
  }
}

input.addEventListener("input",()=>{
  const digits=input.value.replace(/\D/g,"").slice(0,8);
  input.value=[digits.slice(0,2),digits.slice(2,4),digits.slice(4,8)].filter(Boolean).join(".");
  error.hidden=true;
});

form.addEventListener("submit", async(event)=>{
  event.preventDefault();
  const birth=parseBirthDate(input.value);
  if(!birth){
    error.textContent="Введите существующую дату в формате ДД.ММ.ГГГГ.";
    error.hidden=false;
    input.focus();
    return;
  }
  error.hidden=true;
  const id=++requestId;
  current=null;
  results.hidden=true;
  const submit=form.querySelector("button[type=submit]");
  submit.disabled=true;
  submit.textContent="Подбираю ответы…";
  try{
    const matrix=calculateMatrix(birth);
    const [knowledge,zones]=await Promise.all([loadFullReportKnowledge(),loadZoneLibrary()]);
    if(id!==requestId)return;
    const points=nodesFor(birth,matrix);
    const definitions=buildFullReportSections(matrix);
    current={id,birth,matrix,knowledge,points,definitions,zones,activeZone:null,selected:null};
    renderDiagram(points);
    renderZones(zones);
    zoneGuide.hidden=true;
    zoneGuide.replaceChildren();
    document.querySelector(".pro-all-points").open=false;
    renderPointList(points);
    renderQuestions(definitions);
    answer.replaceChildren(paragraph("Выберите вопрос из списка. Подробный ответ откроется здесь.","pro-empty"));
    results.hidden=false;
    selectPoint("center",false);
    results.scrollIntoView({behavior:"smooth",block:"start"});
    karmic.replaceChildren(paragraph("Подбираю кармические программы…","pro-muted"));
    Promise.all([loadKarmicPrograms(),loadKarmicTails()])
      .then(([programs,tails])=>{if(current?.id===id)renderKarmic(matrix,programs,tails);})
      .catch(()=>{if(current?.id===id)karmic.replaceChildren(paragraph("Не получилось загрузить кармические программы. Попробуйте обновить страницу.","pro-muted"));});
  }catch(err){
    error.textContent="Не удалось загрузить расчёт. Обновите страницу и попробуйте снова.";
    error.hidden=false;
  }finally{
    submit.disabled=false;
    submit.textContent="Рассчитать →";
  }
});
