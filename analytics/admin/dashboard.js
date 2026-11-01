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
  async function post(payload){
    const response=await fetch("/api/numi-analytics.php",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store",signal:AbortSignal.timeout(20000)});
    const data=await response.json();if(!response.ok||!data.ok)throw Error(data?.error||"LOGIN_FAILED");return data;
  }
  function showLogin(){ $("login").hidden=false;$("dashboard").hidden=true; }
  function showDashboard(){ $("login").hidden=true;$("dashboard").hidden=false; }
  async function checkLogin(){
    try{
      const response=await fetch("/api/numi-analytics.php?action=session",{credentials:"same-origin",cache:"no-store"});
      const data=await response.json();
      if(response.ok&&data.authenticated){showDashboard();await refresh();}
      else{showLogin();$("status").textContent="";}
    }catch(_){showLogin();$("login-error").textContent="Сервер аналитики пока недоступен.";}
  }
  $("login").addEventListener("submit",async e=>{
    e.preventDefault();const email=$("email").value.trim(),password=$("password").value;
    $("login-error").textContent="Проверяем вход…";
    try{
      await post({action:"admin_login",email,password});
      $("password").value="";$("login-error").textContent="";showDashboard();await refresh();
    }catch(e){$("password").value="";$("login-error").textContent=e.name==="TimeoutError"?"Сервер слишком долго отвечает. Попробуйте обновить страницу.":e.message==="TOO_MANY_ATTEMPTS"?"Временно ограничено число попыток. Подождите несколько минут.":e.message==="ANALYTICS_UNAVAILABLE"?"Сервер аналитики временно недоступен.":"Вход не выполнен. Проверьте пароль или воспользуйтесь восстановлением ниже."; }
  });
  $("reset-access").addEventListener("click",async()=>{
    const email=$("email").value.trim();
    if(!email||!$("email").checkValidity()){$("reset-info").textContent="Сначала укажи свой email выше.";return;}
    $("reset-info").textContent="Отправляем ссылку…";
    try{
      const response=await fetch("/api/numi-account.php",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"request_reset",email})
      });
      if(response.status===429){$("reset-info").textContent="Слишком много запросов. Попробуй чуть позже.";return;}
      if(!response.ok){$("reset-info").textContent="Письмо сейчас отправить не удалось.";return;}
      $("reset-info").textContent="Если почта подтверждена в аккаунте, ссылка для смены пароля придёт на этот email. Проверь входящие и спам.";
    }catch(_){$("reset-info").textContent="Не удалось связаться с сервером. Попробуй чуть позже.";}
  });
  $("logout").addEventListener("click",async()=>{try{await post({action:"admin_logout"});}catch(_){}showLogin();$("status").textContent="";});
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
    }catch(e){if(String(e.message).includes("Доступ только владельцу"))showLogin();$("status").textContent=e.message;}
  }
  $("refresh").addEventListener("click",refresh);$("days").addEventListener("change",refresh);checkLogin();
})();
