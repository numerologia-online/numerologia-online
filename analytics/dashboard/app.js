(() => {
"use strict";
const $ = (id) => document.getElementById(id);
const state = {api:"",token:"",data:null};
const number = (x) => (Number(x) || 0).toLocaleString("ru-RU");
const money = (kopecks) => new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB",maximumFractionDigits:0}).format((Number(kopecks)||0)/100);
const names = {
  page_view:"Просмотры страниц", redflag_open:"Вход в Red Flag",
  redflag_category_open:"Категории Red Flag", redflag_question_open:"Открытия вопросов",
  redflag_share_click:"Нажатия «Поделиться»", redflag_save_click:"Нажатия «Отправить в бот»",
  pdf_download:"Нажатия «Скачать PDF»", telegram_link_click:"Переходы в Telegram",
  bot_start:"Запуски бота", bot_button:"Нажатия в боте", bot_active:"Активность бота",
  payment_success:"Подтверждённые оплаты"
};
function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}
function empty(root, message = "Данных за период пока нет") {
  root.replaceChildren(el("p","empty",message));
}
function renderBars(id, rows, valueField, labelField) {
  const root=$(id); root.replaceChildren();
  const filtered=(Array.isArray(rows)?rows:[]).filter(x=>Number(x[valueField])>0);
  if(!filtered.length) return empty(root);
  const max=Math.max(...filtered.map(x=>Number(x[valueField])));
  filtered.slice(0,12).forEach(entry => {
    const box=el("div","bar-item");
    const head=el("div","bar-head");
    const label=el("span","bar-label",entry[labelField] || entry.item || "Другое");
    const count=el("span","bar-num",number(entry[valueField]));
    head.append(label,count);
    const bg=el("div","bar-bg"); const fill=el("div","bar-fill");
    fill.style.width=Math.max(1,100*Number(entry[valueField])/max)+"%";
    bg.append(fill);box.append(head,bg);root.append(box);
  });
}
function metric(name,value,note) {
  const box=el("article","metric");
  box.append(el("div","metric-name",name),el("div","metric-value",value),el("div","metric-note",note));
  return box;
}
function render(data) {
  const counts=new Map((data.counts||[]).map(x=>[x.event,x]));
  const total=(name)=>Number(counts.get(name)?.total||0);
  const sessions=(name)=>Number(counts.get(name)?.sessions||0);
  const metrics=$("metrics");
  metrics.replaceChildren(
    metric("Просмотры страниц",number(total("page_view")),"Открытия, не уникальные люди"),
    metric("Сессии сайта",number(sessions("page_view")),"Анонимные сессии с согласием"),
    metric("Открытия вопросов",number(total("redflag_question_open")),"Раздел «Мужчина или Red Flag»"),
    metric("Пересылки (клики)",number(total("redflag_share_click")),"Нажатия, не подтверждённые отправки"),
    metric("Клики «Скачать PDF»",number(total("pdf_download")),"Не подтверждают успешное скачивание"),
    metric("Переходы в бот",number(total("telegram_link_click")),"С сайта в Telegram"),
    metric("Запуски бота",number(total("bot_start")),"Не уникальные люди; сервер ещё не подключён"),
    metric("Выручка",total("payment_success") ? money(data.payments?.revenue_kopecks) : "—","Нужно подключить подтверждённые оплаты; заказов: "+number(data.payments?.orders))
  );
  renderBars("questions",data.questions,"opens","label");
  renderBars("shares",data.shares,"total","label");
  renderBars("sections",data.sections,"visits","section");
  renderBars("sources",data.sources,"visits","source");
  const chart=$("trend");chart.replaceChildren();
  const trend=data.trend||[];
  if (!trend.length) empty(chart); else {
    const max=Math.max(1,...trend.map(x=>Number(x.visits)||0));
    trend.forEach(day=>{
      const col=el("div","trend-col"); const bar=el("div","trend-bar");
      bar.style.height=Math.max(2,100*(Number(day.visits)||0)/max)+"px";
      bar.title=(day.date||"")+" • "+number(day.visits)+" просмотров";
      col.append(bar,el("div","trend-day",(day.date||"").slice(5)));chart.append(col);
    });
  }
  const events=$("events");events.replaceChildren();
  (data.counts||[]).forEach(x=>{
    const row=el("div","event");
    row.append(el("span","",names[x.event]||x.event),el("strong","",number(x.total)));
    events.append(row);
  });
  if(!(data.counts||[]).length) empty(events);
  $("updated").textContent="Данные на "+new Date(data.collected_at).toLocaleString("ru-RU");
}
async function load() {
  $("message").textContent="Загружаю реальные данные…";
  const api = state.api.replace(/\/$/,"");
  const res=await fetch(api+"/api/overview?days="+encodeURIComponent($("period").value),{
    headers:{"Authorization":"Bearer "+state.token},cache:"no-store"
  });
  if(!res.ok) throw new Error(res.status===401 ? "Неверный секрет или нет доступа." :
    res.status===503 ? "База данных ещё не подключена." :
    "Сервер ответил ошибкой "+res.status+".");
  state.data=await res.json();
  render(state.data);
  $("connect").hidden=true;$("dashboard").hidden=false;
  $("message").textContent="";
}
$("api").value=localStorage.getItem("noa_owner_analytics_url")||"";
$("login").addEventListener("submit",async e=>{
  e.preventDefault();
  const url=$("api").value.trim();
  if(!/^https:\/\//i.test(url)){ $("message").textContent="Нужен защищённый адрес https://";return;}
  state.api=url;state.token=$("token").value;
  $("login").querySelector("button").disabled=true;
  try{
    await load();
    localStorage.setItem("noa_owner_analytics_url",state.api);
    $("token").value="";
  }catch(err){$("message").textContent=err.message;}
  finally{$("login").querySelector("button").disabled=false;}
});
$("period").addEventListener("change",()=>load().catch(err=>{ $("updated").textContent=err.message; }));
$("refresh").addEventListener("click",()=>load().catch(err=>{ $("updated").textContent=err.message; }));
$("logout").addEventListener("click",()=>{
  state.token="";state.data=null;
  $("dashboard").hidden=true;$("connect").hidden=false;
  $("message").textContent="Доступ завершён. Секрет не сохранён.";
});
function csvCell(x) {
  let s=String(x??"");
  // Avoid formula injection in spreadsheet applications.
  if (/^[\s]*[=+@\-]/.test(s)) s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
$("csv").addEventListener("click",()=>{
  if(!state.data) return;
  const data=state.data;
  const lines=[["Раздел","Название","Значение"], ...((data.counts||[]).map(x=>["События",names[x.event]||x.event,x.total]))];
  [["questions","Вопросы","opens"],["shares","Поделились","total"],["sources","Источники","visits"],["sections","Разделы","visits"]].forEach(([key,name,field])=>{
    (data[key]||[]).forEach(x=>lines.push([name,x.label||x.item||x.source||x.section||"",x[field]]));
  });
  lines.push(["Продажи","Выручка в рублях",(Number(data.payments?.revenue_kopecks)||0)/100]);
  lines.push(["Продажи","Заказы",data.payments?.orders||0]);
  const blob=new Blob(["\ufeff"+lines.map(row=>row.map(csvCell).join(";")).join("\r\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="numerologia-analytics-"+data.period+"d.csv";
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
})();
