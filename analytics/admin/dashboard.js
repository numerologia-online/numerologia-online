"use strict";
(()=>{
  const $=id=>document.getElementById(id);
  const sum=(rows)=>rows.reduce((v,r)=>v+Number(r.event_count||0),0);
  function drawRows(id,rows,empty){
    const target=$(id);target.replaceChildren();
    if(!rows.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=2;td.textContent=empty;tr.append(td);target.append(tr);return;}
    for(const [title,n] of rows.slice(0,40)){const tr=document.createElement("tr"),a=document.createElement("td"),b=document.createElement("td");a.textContent=title;b.textContent=n.toLocaleString("ru-RU");tr.append(a,b);target.append(tr);}
  }
  function aggregate(rows,fn){
    const map=new Map();for(const row of rows){const key=fn(row);if(!key)continue;map.set(key,(map.get(key)||0)+Number(row.event_count||0));}
    return [...map].sort((a,b)=>b[1]-a[1]);
  }
  async function refresh(){
    $("status").textContent="Обновляем статистику…";
    try{
      const res=await fetch("/api/numi-analytics.php?days="+encodeURIComponent($("days").value),{credentials:"same-origin",cache:"no-store"});
      const data=await res.json();
      if(!res.ok||!data.ok)throw Error(res.status===403?"Доступ только владельцу. Войдите в личный кабинет владельца.":"Статистика пока недоступна.");
      const rows=data.rows;
      $("status").textContent="Период: "+data.period_days+" дн. · Обновлено";
      const cards=[["Открытия страниц",sum(rows.filter(r=>r.event_type==="page"))],["Выборы тем",sum(rows.filter(r=>r.event_type==="category"))],["Открытия вопросов",sum(rows.filter(r=>r.event_type==="question"))],["Поиски",sum(rows.filter(r=>r.event_type==="search"))]];
      $("totals").replaceChildren(...cards.map(([label,val])=>{const card=document.createElement("div"),value=document.createElement("div"),name=document.createElement("div");card.className="card";value.className="value";value.textContent=val.toLocaleString("ru-RU");name.textContent=label;card.append(value,name);return card;}));
      drawRows("sections",aggregate(rows.filter(r=>r.event_type==="category"),r=>r.section+":"+r.item),"Нет данных");
      drawRows("questions",aggregate(rows.filter(r=>r.event_type==="question"),r=>r.section+":"+r.item),"Нет данных");
      drawRows("campaigns",aggregate(rows.filter(r=>r.event_type==="campaign"),r=>r.campaign),"Нет данных");
      drawRows("events",aggregate(rows,r=>r.event_type),"Нет данных");
    }catch(e){$("status").textContent=e.message;}
  }
  $("refresh").addEventListener("click",refresh);$("days").addEventListener("change",refresh);refresh();
})();
