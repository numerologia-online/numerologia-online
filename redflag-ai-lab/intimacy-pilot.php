<?php
declare(strict_types=1);
// Owner-only editor: full-date intimacy AI preview, no charges/publication.
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
if(!naTestOwner(naCurrent(naDB()))){
 http_response_code(403);
 echo '<!doctype html><meta charset="utf-8"><p>Доступно только владелице сайта.</p>';
 exit;
}
$kb=json_decode((string)file_get_contents(__DIR__.'/intimacy-knowledge-v1.json'),true,20,JSON_THROW_ON_ERROR);
$questions=$kb['questions']??[];
?><!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Секс и близость — закрытый тест полной матрицы</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f0f0;color:#2b252a;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:790px;margin:auto;padding:24px 16px 70px}h1{font-size:25px;margin:8px 0}h2{font-size:19px}
small,.hint{color:#695d67}.hint{font-size:14px;margin-bottom:20px}
form{display:grid;gap:12px;padding:20px;background:#fff;border-radius:18px;border:1px solid #ded5d9}
select,input{width:100%;min-height:44px;padding:10px;font:inherit;border-radius:9px;border:1px solid #cbbfc6;background:white}
label{font-size:14px;font-weight:600;display:grid;gap:5px}
.dates{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:10px}
button{border:0;background:#30292d;color:#fff;border-radius:10px;padding:12px 20px;font-size:16px;font-weight:650;cursor:pointer}
button:disabled{opacity:.5;cursor:wait}section{background:white;border:1px solid #ded5d9;border-radius:18px;padding:19px;margin-top:16px}
article{font-size:17px;white-space:pre-wrap;line-height:1.67}summary{font-weight:600;cursor:pointer}
.pill{font-size:12px;color:#6f5667}#error{color:#aa233f;white-space:pre-wrap}#wait{display:none}
li{margin:7px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.55 inherit}
</style></head><body><main>
<small>Только для владелицы · ИИ-тест · никакой оплаты и публикации</small>
<h1>Секс и близость</h1>
<p class="hint">9 вопросов · полная дата мужчины · расчёт 31 точки · сведения из нашей базы 22 арканов · Claude Sonnet 4.6. Внизу показывается проверяемый разбор для тебя, покупательница его не увидит.</p>
<form id="f">
<label>Вопрос<select id="q">
<?php foreach($questions as $id=>$q):?>
<option value="<?=htmlspecialchars((string)$id,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8')?>"><?=htmlspecialchars((string)$q['title'],ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8')?></option>
<?php endforeach;?>
</select></label>
<div class="dates">
<label>День<input id="d" type="number" min="1" max="31" value="9" required></label>
<label>Месяц<input id="m" type="number" min="1" max="12" value="9" required></label>
<label>Год<input id="y" type="number" min="1900" max="<?=date('Y')?>" value="1986" required></label>
</div>
<button type="submit" id="go">Получить тестовый ответ</button>
<small>Один запрос расходует токены Cloud.ru. Никакого массового запуска нет.</small>
</form>
<p id="wait">Готовится индивидуальный ответ…</p>
<p id="error" role="alert"></p>
<section id="result" hidden>
<h2>Ответ покупательнице <small>(пока не опубликован)</small></h2>
<article id="answer"></article>
</section>
<section id="proof" hidden>
<details open><summary>Что модель реально использовала из матрицы</summary>
<p class="pill" id="meta"></p>
<ol id="points"></ol>
<p><strong>Взаимодействие:</strong> <span id="interaction"></span></p>
<p><strong>Главный вывод:</strong> <span id="verdict"></span></p>
</details>
</section>
</main><script>
const form=document.querySelector('#f'),result=document.querySelector('#result'),
 proof=document.querySelector('#proof'),wait=document.querySelector('#wait'),
 err=document.querySelector('#error'),go=document.querySelector('#go');
form.addEventListener('submit',async event=>{
 event.preventDefault();result.hidden=true;proof.hidden=true;err.textContent='';
 go.disabled=true;wait.style.display='block';
 const data={question_id:document.querySelector('#q').value,
 day:Number(document.querySelector('#d').value),month:Number(document.querySelector('#m').value),
 year:Number(document.querySelector('#y').value)};
 try{
  const response=await fetch('./intimacy-pilot-api.php',{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)});
  const json=await response.json();
  if(!response.ok||json.ok!==true)throw new Error('ИИ не выдала проверяемый ответ. Это не ошибка оплаты: данные сайта не изменились.');
  document.querySelector('#answer').textContent=json.answer;
  document.querySelector('#meta').textContent=json.date+' · '+json.model+' · '+json.full_matrix_points+' точки рассчитано';
  const ul=document.querySelector('#points');ul.replaceChildren();
  for(const x of json.checked_points){
    const li=document.createElement('li');
    li.textContent=x.position+' = '+x.number+'. '+x.meaning;ul.append(li);
  }
  document.querySelector('#interaction').textContent=json.interaction;
  document.querySelector('#verdict').textContent=json.verdict;
  result.hidden=false;proof.hidden=false;
 }catch(e){err.textContent=e.message||'Ответ не получен.'}
 finally{go.disabled=false;wait.style.display='none'}
});
</script></body></html>