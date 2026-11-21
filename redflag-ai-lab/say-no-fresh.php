<?php
declare(strict_types=1);
// Independent owner-only test. Does not modify payment or customer-facing Red Flags.
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
if(!naTestOwner(naCurrent(naDB()))){
 http_response_code(403);
 echo '<!doctype html><meta charset="utf-8"><p>Только для владелицы сайта после авторизации.</p>';
 exit;
}
?><!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Красные флаги — свободный ИИ-тест</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f4f0f0;color:#2b252a;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:760px;margin:auto;padding:24px 16px 80px}
h1{font-size:24px;line-height:1.25;margin:9px 0 14px}
h2{font-size:19px}small,.hint{color:#6d6169}
form,section{background:#fff;border:1px solid #e0d3da;border-radius:17px;padding:19px;margin-top:15px}
form{display:grid;gap:15px}
.dates{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:8px}
label{display:grid;gap:4px;font-size:14px;font-weight:600}
input{width:100%;padding:10px;border:1px solid #cbbac4;border-radius:9px;font-size:17px;min-height:46px}
button{border:0;background:#30292d;color:#fff;border-radius:10px;padding:13px 18px;font-size:16px;font-weight:650;cursor:pointer}
button:disabled{opacity:.55;cursor:wait}
#loading{display:none}#error{color:#9b1d3a}
article{white-space:pre-wrap;font-size:18px;line-height:1.7}
summary{cursor:pointer;font-weight:650}
li{margin:7px 0}
</style></head><body><main>
<small>Только тебе · закрытый ИИ-тест · без оплаты и публикации</small>
<h1>Уважает женское «нет» или начинает давить?</h1>
<p class="hint">Новый принцип: <b>нет 366 готовых трактовок</b>. Полная дата, 31 рассчитанная точка и знания 22 арканов. Sonnet сама формирует вывод и пишет живой текст. Предыдущие ответы покупателей не меняются.</p>
<form id="test">
<div class="dates">
<label>День<input id="day" type="number" value="9" min="1" max="31" required></label>
<label>Месяц<input id="month" type="number" value="9" min="1" max="12" required></label>
<label>Год<input id="year" type="number" value="1986" min="1900" max="<?=date('Y')?>" required></label>
</div>
<button id="send">Получить новый ответ</button>
<small>Один запрос — одна генерация Cloud.ru. Никаких фоновых серий и массовых расходов.</small>
</form>
<p id="loading">Нейросеть анализирует матрицу и пишет ответ…</p>
<p id="error" role="alert"></p>
<section id="result" hidden>
<h2>Новый ответ <small>(никому не опубликован)</small></h2>
<article id="answer"></article>
<small id="meta"></small>
</section>
<section id="proof" hidden>
<details><summary>Проверка: какие арканы она действительно использовала</summary>
<ol id="points"></ol>
<p><b>Взаимодействие:</b> <span id="logic"></span></p>
<p><b>Вывод:</b> <span id="verdict"></span></p>
</details>
</section>
</main>
<script>
const form=document.querySelector('#test'),err=document.querySelector('#error'),
 loading=document.querySelector('#loading'),btn=document.querySelector('#send'),
 result=document.querySelector('#result'),proof=document.querySelector('#proof');
form.addEventListener('submit',async e=>{
 e.preventDefault();result.hidden=true;proof.hidden=true;err.textContent='';
 btn.disabled=true;loading.style.display='block';
 try{
   const body={day:Number(document.querySelector('#day').value),
    month:Number(document.querySelector('#month').value),
    year:Number(document.querySelector('#year').value)};
   const response=await fetch('./say-no-fresh-api.php',{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify(body)});
   const j=await response.json();
   if(!response.ok||j.ok!==true)throw new Error('Модель не вернула проверяемый ответ. Оплаты и сайт не затронуты.');
   document.querySelector('#answer').textContent=j.answer;
   document.querySelector('#meta').textContent=j.full_date+' · '+j.answer_chars+' знаков · '+j.model;
   const ol=document.querySelector('#points');ol.replaceChildren();
   for(const p of j.points_used){const li=document.createElement('li');
     li.textContent=p.position+': '+p.number+' ('+p.arcana+'). '+p.relevance;ol.append(li);}
   document.querySelector('#logic').textContent=j.logic;
   document.querySelector('#verdict').textContent=j.verdict;
   result.hidden=false;proof.hidden=false;
 }catch(ex){err.textContent=ex.message||'Не удалось получить ответ'}
 finally{btn.disabled=false;loading.style.display='none'}
});
</script></body></html>