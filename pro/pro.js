import { calculateMatrix, parseBirthDate, reduce22 } from "../numerology-core.js?v=2";
import { buildFullReportSections, loadFullReportKnowledge, loadFullReportSection } from "../full-report-library.js?v=4";
import { findKarmicPrograms, findKarmicTail, loadKarmicPrograms, loadKarmicTails } from "../karmic-programs.js?v=3";

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
    zoneLibraryRequest = fetch("pro/zones.json?v=2")
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
  add("right","Энергия года рождения",568,310,m.right,"Сумма цифр года " + birth.year + ": " + sumDigits(birth.year) + " → " + m.right,"major","",baseHint);
  add("bottom","Главный урок",310,568,m.bottom,expression([m.left,m.top,m.right],m.bottom),"major","lifeLesson",baseHint);
  add("left","День рождения / внешний образ",52,310,m.left,"День рождения: " + birth.day + " → " + m.left,"major","impression",baseHint);
  add("topLeft","Родительская тема",128,128,m.corners.topLeft,expression([m.left,m.top],m.corners.topLeft),"","parentsPain",baseHint);
  add("topRight","Женская линия рода / верхний угол",492,128,m.corners.topRight,expression([m.top,m.right],m.corners.topRight),"","",baseHint);
  add("bottomRight","Реализация и рост",492,492,m.corners.bottomRight,expression([m.right,m.bottom],m.corners.bottomRight),"","growth",baseHint);
  add("bottomLeft","Женская линия рода / нижний угол",128,492,m.corners.bottomLeft,expression([m.bottom,m.left],m.corners.bottomLeft),"","",baseHint);
  add("topOuter","Верхняя ось / внешняя точка",310,108,m.topSpoke.outer,expression([m.top,m.topSpoke.near],m.topSpoke.outer),"","",extraHint);
  add("topNear","Верхняя ось / средняя точка",310,158,m.topSpoke.near,expression([m.top,m.center],m.topSpoke.near),"","",extraHint);
  add("topCore","Верхняя ось / внутренняя точка",310,216,m.topSpoke.core,expression([m.topSpoke.near,m.center],m.topSpoke.core),"","",extraHint);
  add("leftOuter","Левая ось / внешняя точка",108,310,m.leftSpoke.outer,expression([m.left,m.leftSpoke.near],m.leftSpoke.outer),"","",extraHint);
  add("leftNear","Левая ось / средняя точка",158,310,m.leftSpoke.near,expression([m.left,m.center],m.leftSpoke.near),"","",extraHint);
  add("leftCore","Левая ось / внутренняя точка",216,310,m.leftSpoke.core,expression([m.leftSpoke.near,m.center],m.leftSpoke.core),"","",extraHint);
  add("rightOuter","Материальная карма / правый луч",512,310,m.rightSpoke.outer,expression([m.right,m.rightSpoke.near],m.rightSpoke.outer),"","moneyBlock",baseHint);
  add("rightNear","Вход в денежный канал",462,310,m.channels.moneyEntry,expression([m.right,m.center],m.channels.moneyEntry),"","moneyFlow",baseHint);
  add("rightCore","Внутренняя точка материальной оси",404,310,m.rightSpoke.core,expression([m.rightSpoke.near,m.center],m.rightSpoke.core),"","",extraHint);
  add("tailFirst","Вход в канал отношений / кармический хвост",310,462,m.channels.loveEntry,expression([m.center,m.bottom],m.channels.loveEntry),"","",baseHint);
  add("tailSecond","Кармический хвост / середина",310,512,m.tail.second,expression([m.bottom,m.tail.first],m.tail.second),"","",baseHint);
  add("loveHeart","Под сердцем / партнёр",348,424,m.channels.lovePoint,expression([m.channels.loveEntry,m.channels.balance],m.channels.lovePoint),"","partner","Точка любви на диагонали денег и отношений.");
  add("wellbeing","Баланс денег и отношений",386,386,m.channels.balance,expression([m.channels.moneyEntry,m.channels.loveEntry],m.channels.balance),"","","Общая точка любви и денег.");
  add("moneyPoint","Под долларом / профессия и доход",424,348,m.channels.moneyPoint,expression([m.channels.moneyEntry,m.channels.balance],m.channels.moneyPoint),"","earning","Точка под знаком доллара на денежном канале.");
  const diag = [
    ["topLeft",m.corners.topLeft,m.diagonals.topLeft,160,160,202,202,"Верхняя левая диагональ"],
    ["topRight",m.corners.topRight,m.diagonals.topRight,460,160,418,202,"Верхняя правая диагональ"],
    ["bottomRight",m.corners.bottomRight,m.diagonals.bottomRight,460,460,418,418,"Нижняя правая диагональ"],
    ["bottomLeft",m.corners.bottomLeft,m.diagonals.bottomLeft,160,460,202,418,"Нижняя левая диагональ"]
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
  if (zone.id === "purpose") {
    const d = current.matrix.purpose;
    zoneGuide.append(paragraph(
      "Предназначение: Небо " + d.sky + ", Земля " + d.earth + ", личное " + d.personal +
      "; мужская линия " + current.matrix.lineage.male + ", женская " + current.matrix.lineage.female +
      ", социальное " + d.social + ", общее " + d.general + ".","pro-zone-lesson"));
  }
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
    [142,142,478,478,"#9baeb9"],[142,478,478,142,"#ceabb0"]
  ].forEach(([x1,y1,x2,y2,stroke])=>frame.append(svgElement("line",{x1,y1,x2,y2,stroke})));
  svg.append(frame);
  svg.append(svgElement("line",{"class":"pro-wellbeing-line",x1:310,y1:462,x2:462,y2:310,"aria-hidden":"true"}));
  const heart = svgElement("text",{"class":"pro-wellbeing-icon pro-wellbeing-heart",x:325,y:411,"aria-hidden":"true"});
  heart.textContent="♥";
  const dollar = svgElement("text",{"class":"pro-wellbeing-icon pro-wellbeing-money",x:446,y:354,"aria-hidden":"true"});
  dollar.textContent="$";
  svg.append(heart,dollar);
  svg.append(svgElement("g",{"class":"pro-zone-highlights","aria-hidden":"true"}));
  points.forEach((point) => {
    const g = svgElement("g",{"class":"pro-node "+point.kind,"data-node-key":point.key,role:"button",tabindex:"0","aria-label":point.label + ": " + point.value});
    const radius = point.kind === "center" ? 34 : point.kind === "major" ? 29 : ["loveHeart","moneyPoint","wellbeing"].includes(point.key) ? 18 : 17;
    if (["loveHeart","moneyPoint","wellbeing"].includes(point.key)) g.classList.add("pro-channel-node");
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


let activeSoulSpeech = null;

// Фоновая мелодия синтезируется на устройстве: никаких аудиофайлов и внешних сервисов.
function makeSoulAmbient() {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return null;
  try {
    const context = new AudioEngine();
    const sequence = [392, 440, 523.25, 440, 349.23, 392, 329.63, 349.23];
    let cursor = 0;
    let timer = null;
    let closed = false;

    function note(frequency, amplitude, seconds) {
      if (closed || context.state !== "running") return;
      const now = context.currentTime + 0.025;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0.00001, now);
      envelope.gain.exponentialRampToValueAtTime(amplitude, now + 0.18);
      envelope.gain.exponentialRampToValueAtTime(0.00001, now + seconds);
      oscillator.connect(envelope);
      envelope.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + seconds + 0.03);
    }

    function step() {
      note(sequence[cursor % sequence.length], 0.008, 3.6);
      if (cursor % 4 === 0) note(cursor % 8 === 0 ? 196 : 174.61, 0.003, 6.3);
      cursor++;
    }

    function resume() {
      if (closed || timer !== null) return;
      context.resume().then(() => {
        if (closed) return;
        step();
        timer = window.setInterval(step, 2300);
      }).catch(() => {});
    }
    function pause() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      if (!closed && context.state === "running") context.suspend().catch(() => {});
    }
    function stop() {
      if (closed) return;
      closed = true;
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      context.close().catch(() => {});
    }
    resume();
    return { resume, pause, stop };
  } catch {
    return null;
  }
}

function stopSoulSpeech() {
  const session = activeSoulSpeech;
  activeSoulSpeech = null;
  if (session) {
    session.ambient?.stop();
    session.play.textContent = session.label;
    session.stop.disabled = true;
    session.status.textContent = "Чтение остановлено.";
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function chooseSoulVoice(synth) {
  const voices = synth.getVoices().filter(voice => /^ru/i.test(voice.lang));
  // Имена зависят от ОС: женский голос выбирается, когда он доступен.
  const feminine = /milena|anna|анна|алёна|алена|elena|елена|irina|ирина|maria|mariya|мария|svetlana|светлана|tatiana|татьяна|daria|дарья|yulia|юлия|katya|катя|katerina|екатерина|female|женский|alisa|алиса/i;
  return voices.find(voice => feminine.test(voice.name))
    || voices.find(voice => voice.localService)
    || voices[0] || null;
}

function speakSoulLines(lines, play, stop, status, musicEnabled = () => true) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    status.textContent = "На этом устройстве нет системной озвучки. Рассказ можно прочитать ниже.";
    return;
  }
  const synth = window.speechSynthesis;
  if (activeSoulSpeech?.play === play) {
    const session = activeSoulSpeech;
    if (synth.paused) {
      synth.resume();
      session.ambient?.resume();
      play.textContent = "⏸ Пауза";
      status.textContent = "Продолжаю чтение.";
    } else {
      synth.pause();
      session.ambient?.pause();
      play.textContent = "▶ Продолжить";
      status.textContent = "На паузе.";
    }
    return;
  }
  stopSoulSpeech();
  const chunks = lines.map(item => typeof item === "string" ? item : item?.text).filter(text => typeof text === "string" && text.trim());
  if (!chunks.length) return;
  const session = { play, stop, status, label: play.textContent, ambient: musicEnabled() ? makeSoulAmbient() : null };
  activeSoulSpeech = session;
  play.textContent = "⏸ Пауза";
  stop.disabled = false;
  status.textContent = "Спокойное чтение. Звучание голоса зависит от настроек телефона.";
  let index = 0;
  const voice = chooseSoulVoice(synth);
  const next = () => {
    if (activeSoulSpeech !== session) return;
    if (index >= chunks.length) {
      stopSoulSpeech();
      status.textContent = "Рассказ окончен. Возвращайтесь к нему, когда захочется.";
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index++]);
    utterance.lang = "ru-RU";
    utterance.rate = 0.86;
    utterance.pitch = 1.06;
    utterance.volume = 1;
    if (voice) utterance.voice = voice;
    utterance.onend = next;
    utterance.onerror = () => {
      if (activeSoulSpeech !== session) return;
      stopSoulSpeech();
      status.textContent = "Чтение прервалось. Можно нажать «Слушать» ещё раз.";
    };
    synth.speak(utterance);
  };
  next();
}

function appendSoulStoryCard(tail, calculatedCode) {
  // История доступна только для найденной программы 6-9-15. Расчёты не изменяем.
  if (tail?.code !== "6-9-15") return;
  const shell = element("section", null, "pro-soul-card");
  shell.append(paragraph("ТИХАЯ ИСТОРИЯ ДУШИ", "pro-soul-eyebrow"));
  shell.append(element("h3", "Услышать историю своей души"));
  shell.append(paragraph("Ваш кармический хвост: " + calculatedCode + " · программа " + tail.code, "pro-soul-meta"));
  shell.append(paragraph("Представьте одну из жизней, которые могла бы прожить эта душа. Нежный рассказ о даре чувствовать, мечтать и возвращаться к себе.", "pro-soul-lead"));
  shell.append(paragraph("Это художественный образ программы, а не буквальное описание прошлой жизни.", "pro-soul-disclaimer"));

  const controls = element("div", null, "pro-soul-controls");
  const play = element("button", "▶ Слушать историю", "pro-soul-play");
  const read = element("button", "Читать историю", "pro-soul-read");
  const stop = element("button", "■ Остановить", "pro-soul-stop");
  [play, read, stop].forEach(button => { button.type = "button"; });
  play.disabled = read.disabled = stop.disabled = true;
  controls.append(play, read, stop);
  shell.append(controls);

  const musicRow = element("label", null, "pro-soul-music");
  const musicCheckbox = element("input");
  musicCheckbox.type = "checkbox";
  musicCheckbox.checked = true;
  musicRow.append(musicCheckbox, document.createTextNode("Тихая музыка на фоне"));
  musicCheckbox.addEventListener("change", () => {
    if (!activeSoulSpeech) return;
    if (!musicCheckbox.checked) {
      activeSoulSpeech.ambient?.stop();
      activeSoulSpeech.ambient = null;
    } else if (!activeSoulSpeech.ambient) {
      activeSoulSpeech.ambient = makeSoulAmbient();
    }
  });
  shell.append(musicRow);

  const status = paragraph("Готовлю рассказ…", "pro-soul-status");
  status.setAttribute("role", "status");
  shell.append(status);
  const body = element("div", null, "pro-soul-body");
  body.hidden = true;
  shell.append(body);
  karmic.append(shell);

  fetch("pro/soul-stories.json?v=2")
    .then(response => {
      if (!response.ok) throw new Error("Story unavailable");
      return response.json();
    })
    .then(data => {
      if (!shell.isConnected || !current) return;
      const story = data.stories?.[tail.code];
      if (!story?.paragraphs?.length || !story?.currentLife?.paragraphs?.length) throw new Error("Incomplete story");
      const narration = story.paragraphs;
      const interpretation = story.currentLife;
      shell.insertBefore(element("p", story.title + " · " + story.subtitle, "pro-soul-story-title"), controls);

      const article = element("article", null, "pro-soul-narrative");
      narration.forEach(item => article.append(paragraph(item)));
      body.append(article);

      const today = element("section", null, "pro-soul-today");
      today.append(element("h4", interpretation.title));
      interpretation.paragraphs.forEach(item => today.append(paragraph(item)));
      today.append(element("h5", interpretation.actionTitle));
      const list = element("ol");
      interpretation.actions.forEach(item => list.append(element("li", item)));
      today.append(list);
      const todayControls = element("div", null, "pro-soul-controls");
      const todayPlay = element("button", "▶ Слушать подсказку", "pro-soul-read");
      const todayStop = element("button", "■ Остановить", "pro-soul-stop");
      const todayStatus = paragraph("Можно читать или слушать эту подсказку.", "pro-soul-status");
      todayStatus.setAttribute("role", "status");
      todayPlay.type = todayStop.type = "button";
      todayStop.disabled = true;
      todayPlay.addEventListener("click", () => speakSoulLines(
        [...interpretation.paragraphs, interpretation.actionTitle, ...interpretation.actions],
        todayPlay, todayStop, todayStatus, () => musicCheckbox.checked
      ));
      todayStop.addEventListener("click", stopSoulSpeech);
      todayControls.append(todayPlay, todayStop);
      today.append(todayControls, todayStatus);
      body.append(today);

      const open = (listen = false) => {
        body.hidden = false;
        read.textContent = "История открыта ✓";
        if (listen) speakSoulLines(narration, play, stop, status, () => musicCheckbox.checked);
        else {
          status.textContent = "Рассказ открыт. Его можно читать или слушать.";
          body.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      };
      read.addEventListener("click", () => open(false));
      play.addEventListener("click", () => body.hidden ? open(true) : speakSoulLines(narration, play, stop, status, () => musicCheckbox.checked));
      stop.addEventListener("click", stopSoulSpeech);
      play.disabled = false;
      read.disabled = false;
      status.textContent = "Рассказ готов. Выберите чтение или прослушивание.";
    })
    .catch(() => {
      if (shell.isConnected) status.textContent = "Не получилось загрузить рассказ. Обновите страницу и попробуйте ещё раз.";
    });
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
  if(tail){
    karmic.append(card("Описание кармического хвоста",tail));
    appendSoulStoryCard(tail,code);
  }
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
  stopSoulSpeech();
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
