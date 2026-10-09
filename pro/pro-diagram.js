// SVG, интерактивные точки и тематические подсветки профессиональной матрицы.
export function createProDiagram({getCurrent, diagram, zoneButtons, questionButtons, element, svgElement, onSelectQuestion}) {
// Компактная карточка выбранного числа. Переход вниз только при нажатии на карточку.
const pointPreview = document.createElement("button");
pointPreview.type = "button";
pointPreview.className = "pro-point-preview";
pointPreview.hidden = true;
pointPreview.setAttribute("aria-label", "Перейти к разбору выбранной точки");
function hidePointPreview() {
  pointPreview.hidden = true;
  delete pointPreview.dataset.key;
}
function showPointPreview(key) {
  if (!getCurrent()) return;
  const point = getCurrent().points.find(item => item.key === key);
  if (!point) return;
  const energy = getCurrent().knowledge.energies[String(point.value)];
  pointPreview.replaceChildren();
  const previews = getCurrent().previews;
  const context = previews.groups.money.includes(point.key) ? "money" : previews.groups.love.includes(point.key) ? "love" : "self";
  const message = previews.energies[String(point.value)]?.[context] || energy?.advice;
  pointPreview.append(element("span", "ВАША МАТРИЦА · ЧИСЛО " + point.value, "pro-point-preview-eyebrow"));
  pointPreview.append(element("strong", previews.titles[point.key] || point.label, "pro-point-preview-title"));
  if (message) pointPreview.append(element("span", message, "pro-point-preview-excerpt"));
  pointPreview.append(element("span", "↓", "pro-point-preview-arrow"));
  pointPreview.dataset.key = key;
  pointPreview.hidden = false;
  const svg = diagram.querySelector("svg");
  if (!svg) return;
  const scale = svg.getBoundingClientRect().width / 620;
  const width = pointPreview.getBoundingClientRect().width;
  const height = pointPreview.getBoundingClientRect().height;
  const svgBounds = svg.getBoundingClientRect();
  const diagramBounds = diagram.getBoundingClientRect();
  const px = svgBounds.left - diagramBounds.left + point.x * scale;
  const py = svgBounds.top - diagramBounds.top + point.y * scale;
  const x = Math.max(8, Math.min(px - width / 2, diagram.clientWidth - width - 8));
  const above = point.y > 315;
  const wantedY = above ? py - height - 21 : py + 25;
  const y = Math.max(8, Math.min(wantedY, diagram.clientHeight - height - 8));
  pointPreview.style.left = x + "px";
  pointPreview.style.top = y + "px";
}
pointPreview.addEventListener("click", () => {
  const key = pointPreview.dataset.key;
  if (!key) return;
  hidePointPreview();
  const point = getCurrent()?.points.find(item => item.key === key);
  if (point?.topic && getCurrent()?.definitions.some(item => item.key === point.topic)) {
    onSelectQuestion(point.topic, true);
  } else {
    // Не выдаём трактовку другой позиции за ответ по выбранному числу.
    questionButtons.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
  }
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") hidePointPreview();
});
window.addEventListener("resize", hidePointPreview);

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
  if (!getCurrent()) return;
  const layer = diagram.querySelector(".pro-zone-highlights");
  const svg = diagram.querySelector("svg");
  if (!layer || !svg) return;
  layer.replaceChildren();
  svg.style.setProperty("--zone-color", zone?.color || "#b89966");
  const selected = new Set(zone?.points || []);
  const points = getCurrent().points.filter((point) => selected.has(point.key));

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
  // Подсветка соответствующих развёрнутых вопросов без повторяющих инструкций.
  questionButtons.style.setProperty("--zone-color", zone?.color || "#698c91");
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
  hidePointPreview();
  if (!getCurrent() || !getCurrent().activeZone) return;
  getCurrent().activeZone = null;
  paintZone(null);
}

function selectZone(id, scrollToDiagram = false) {
  if (!getCurrent()) return;
  hidePointPreview();
  const zone=getCurrent().zones.find((item)=>item.id===id);
  if (!zone) return;
  if (getCurrent().activeZone?.id === id) {
    clearZone();
    return;
  }
  getCurrent().activeZone=zone;
  paintZone(zone);
  diagram.querySelectorAll(".pro-node").forEach(node => node.classList.remove("active"));
  if (scrollToDiagram) {
    diagram.scrollIntoView({behavior:"smooth",block:"start"});
  }
}

// Все 13 тематических подписей видны одновременно, без переключателей.
// Мужскую и женскую линии помещаем над верхними темами, а три других
// дополнительные подписи - под матрицей. Числа и геометрия не изменены.
const sectorLabelPositions = {
  // Верхний ряд: мужская и женская линии рода.
  maleLine:      {x:151,y:29,width:220},
  femaleLine:    {x:469,y:29,width:220},
  // Чуть ниже: внутренний мир и сильные стороны.
  spirit:        {x:165,y:90,width:200},
  talents:       {x:449,y:90,width:202},
  lineage:       {x:108,y:245,width:190},
  relationships: {x:537,y:205,width:150},
  money:         {x:538,y:404,width:116},
  resource:      {x:128,y:553,width:192},
  family:        {x:487,y:555,width:160},
  purpose:       {x:310,y:628,width:216},
  // Три дополнительные темы остаются ниже матрицы, в двух свободных рядах.
  lessons:       {x:166,y:700,width:232},
  growth:        {x:454,y:700,width:208},
  career:        {x:310,y:763,width:202}
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
    // У двух внутренних верхних подписей компактнее область касания:
    // иначе её невидимый край перекрывает ближайшие кружки числа.
    const hitPadding = (zone.id === "spirit" || zone.id === "talents") ? 20
      : (zone.id === "lineage" || zone.id === "relationships") ? 24 : 29;
    tag.append(svgElement("rect",{
      "class":"pro-sector-hitbox",
      x:p.x-p.width/2,y:p.y-hitPadding,width:p.width,height:hitPadding*2,rx:20,
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
  const svg = svgElement("svg",{viewBox:"0 0 620 806",role:"group","aria-label":"Интерактивная матрица с нажимаемыми названиями сфер и 31 точкой"});
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
    const activate = () => { markPointActive(point.key); showPointPreview(point.key); };
    g.addEventListener("click",activate);
    g.addEventListener("keydown",(event) => {if(event.key==="Enter"||event.key===" "){event.preventDefault();activate();}});
    svg.append(g);
  });
  renderDiagramSectorLabels(svg, getCurrent()?.zones || []);
  svg.addEventListener("click", event => {
    if (!event.target.closest(".pro-node, .pro-sector-tag")) hidePointPreview();
  });
  hidePointPreview();
  diagram.replaceChildren(svg, pointPreview);
}

function markPointActive(key) {
  if (!getCurrent()) return;
  if (getCurrent().activeZone && !getCurrent().activeZone.points.includes(key)) clearZone();
  diagram.querySelectorAll(".pro-node").forEach(node =>
    node.classList.toggle("active", node.dataset.nodeKey === key)
  );
}


  return {hidePointPreview, renderZones, renderDiagram};
}
