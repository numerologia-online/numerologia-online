<?php
declare(strict_types=1);
/* Owner-only, independent Red Flag "no" experiment. NO 366 bank, NO public writes. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
function sfReply(int $status,array $body): never {
 http_response_code($status);
 echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 exit;
}
function sf22(int $v): int {
 $v=abs($v);
 while($v>22)$v=array_sum(array_map('intval',str_split((string)$v)));
 return $v===0?22:$v;
}
function sfPoints(int $day,int $month,int $year): array {
 $r='sf22';
 $left=$r($day);$top=$month;
 $right=$r(array_sum(array_map('intval',str_split((string)$year))));
 $bottom=$r($left+$top+$right);$center=$r($left+$top+$right+$bottom);
 $tl=$r($left+$top);$tr=$r($top+$right);
 $br=$r($right+$bottom);$bl=$r($bottom+$left);
 $nt=$r($top+$center);$nl=$r($left+$center);$nr=$r($right+$center);
 $tail=$r($center+$bottom);$cash=$r($right+$center);
 $balance=$r($cash+$tail);
 $p=[
 'left'=>$left,'top'=>$top,'right'=>$right,'bottom'=>$bottom,'center'=>$center,
 'topLeft'=>$tl,'topRight'=>$tr,'bottomRight'=>$br,'bottomLeft'=>$bl,
 'topOuter'=>$r($top+$nt),'topNear'=>$nt,'topCore'=>$r($nt+$center),
 'leftOuter'=>$r($left+$nl),'leftNear'=>$nl,'leftCore'=>$r($nl+$center),
 'rightOuter'=>$r($right+$nr),'rightNear'=>$cash,'rightCore'=>$r($nr+$center),
 'tailFirst'=>$tail,'tailSecond'=>$r($bottom+$tail),
 'loveHeart'=>$r($tail+$balance),'wellbeing'=>$balance,'moneyPoint'=>$r($cash+$balance)
 ];
 foreach(['topLeft'=>$tl,'topRight'=>$tr,'bottomRight'=>$br,'bottomLeft'=>$bl] as $k=>$v){
  $n=$r($v+$center);$p[$k.'Outer']=$r($v+$n);$p[$k.'Near']=$n;
 }
 if(count($p)!==31)throw new RuntimeException('CALCULATION_INVALID');
 return $p;
}
try {
 if(!naTestOwner(naCurrent(naDB())))sfReply(403,['ok'=>false,'error'=>'OWNER_ONLY']);
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST')sfReply(405,['ok'=>false,'error'=>'POST_ONLY']);
 if(!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
  sfReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
 if((int)($_SERVER['CONTENT_LENGTH']??0)>3000)sfReply(413,['ok'=>false,'error'=>'REQUEST_TOO_LARGE']);
 $input=json_decode((string)file_get_contents('php://input',false,null,0,3100),true,12,JSON_THROW_ON_ERROR);
 if(!is_array($input))sfReply(400,['ok'=>false,'error'=>'INVALID_REQUEST']);
 $d=$input['day']??null;$m=$input['month']??null;$y=$input['year']??null;
 if(!is_int($d)||!is_int($m)||!is_int($y)||$y<1900||$y>(int)gmdate('Y')
    ||!checkdate($m,$d,$y))sfReply(400,['ok'=>false,'error'=>'INVALID_DATE']);
 $kb=json_decode((string)file_get_contents(__DIR__.'/intimacy-knowledge-v1.json'),true,22,JSON_THROW_ON_ERROR);
 if(($kb['schema']??null)!=='numi-owner-intimacy-matrix-knowledge-v1'
  ||count($kb['arcana']??[])!==22)throw new RuntimeException('ARCANA_KNOWLEDGE_NOT_READY');
 $points=sfPoints($d,$m,$y);
 // Full Matrix calculation, but only question-relevant positions and energy meanings
 // are provided to the model. There are NO fixed judgments or date-specific answers.
 $positions=['left','top','right','center','loveHeart','tailFirst','bottom'];
 $selected=[];$knowledge=[];
 foreach($positions as $pos){
  $number=$points[$pos];
  $data=$kb['arcana'][(string)$number]??null;
  if(!is_array($data))throw new RuntimeException('ARCANA_NOT_FOUND');
  $selected[]=['key'=>$pos,'role'=>$kb['pointDescriptions'][$pos],
               'arcana'=>$number,'name'=>$data['name']];
  $knowledge[(string)$number]=$data;
 }
 $catalog=json_decode((string)file_get_contents(__DIR__.'/catalog.json'),true,20,JSON_THROW_ON_ERROR);
 $followups=[];
 foreach(($catalog['categories']??[]) as $category){
  if(($category['id']??null)!=='flags')continue;
  foreach(($category['questions']??[]) as $q){
   if(($q['id']??null)!=='say-no')$followups[]=$q['title'];
  }
 }
 if(count($followups)<8)throw new RuntimeException('FOLLOWUPS_NOT_READY');
 $system=<<<'INSTRUCTION'
Ты опытный нумеролог по Матрице судьбы, 22 аркана. Один вопрос: «Уважает женское „нет“ или начинает давить?» Читательница спрашивает про мужчину. Это символическая трактовка склонностей, а не проверенные факты.

ИСТОЧНИК СМЫСЛА. Наш сайт уже рассчитал полную матрицу из дня, месяца и года. Получишь названия относящихся к вопросу позиций и сведения по соответствующим арканам ИЗ НАШЕЙ БАЗЫ ЗНАНИЙ. Не пересчитывай. Не используй готовый ответ или заготовленный сценарий. Интерпретируй самостоятельно, но не придумывай новые арканы или несуществующие значения.

ГЛАВНОЕ ПРАВИЛО: не усредняй арканы. Сначала установи, какая позиция и какая сторона аркана особенно важна ДЛЯ РЕАКЦИИ НА ОТКАЗ. День рождения (left) описывает непосредственную манеру поведения, центр (center) — внутренний способ реагировать, точка под сердцем (loveHeart) и вход в отношения (tailFirst) — поведение при близости. Позиции года (right) и жизненного урока (bottom) помогают понять способ проявления, но не должны механически обнулять острую тень другого важного аркана. Сопоставь минимум три позиции и зафиксируй один главный тип реакции. Остальные позиции могут уточнить ЕГО ФОРМУ, а не превратить давление в достоинство. Год и месяц должны иметь содержательное влияние там, где реально меняют сочетание.

КОНКРЕТИКА ПО ТЕНЯМ АРКАНОВ, когда они занимают релевантную точку и не смягчены убедительно другими: 15 Дьявол — желание власти, собственничество, самолюбие, попытки подчинить, манипулировать, резко отвечать на сопротивление; это может быть открытый напор и злость, а НЕ обязательно деликатные переговоры. 9 Отшельник — холодное превосходство, недоверие к чужим аргументам, критический допрос или отстранённость. 4 Император — жёсткое «я лучше знаю», контроль решений и нетерпимость к несогласию. 16 Башня — резкая реакция, конфликт, готовность обострить ситуацию. 14 Умеренность в плюсе — выдержка и уважение к решению другого; не выдумывай ему токсичность. Эти ориентиры относятся к ВОЗМОЖНЫМ проявлениям арканов: не изображай всякого носителя 15-й энергии агрессором и не приписывай реальных скандалов, угроз, насилия. Для остальных арканов самостоятельно находи конкретный характер реакций из переданной базы. Если центральное взаимодействие даёт действительно мягкий ответ — говори это уверенно, но не ради красивого баланса.

ПРОЦЕДУРА. 1) Сделай внутренний нумерологический вывод на основании минимум трёх РАЗНЫХ переданных позиций: принимает отказ; спорит и проверяет аргументы; обижается и давит молчанием; взрывается от уязвлённой гордости; пытается продавить решение; спокойно отходит — либо другой отчётливый вариант. 2) Определи, как выглядит именно эта реакция словами и действиями, и чем она оборачивается для женщины. 3) Оставь только самое цепкое; не повторяй вердикт пять раз и не вставляй абзац о том, что «всё зависит от тебя». Нарушение согласия не оправдывается никакой энергией.

СТИЛЬ ПЛАТНОГО РАЗБОРА. Пиши как наблюдательная, умная, дерзкая подруга: разговорный русский, ясные прямые слова, точное наблюдение, при необходимости короткий колкий подкол. Не как психолог, не как пресс-служба и не как литературный гороскоп из тумана. Сразу назови его слабое место или уверенно скажи, что уважает отказ. Не замазывай реальное давление дипломатическими смягчениями. Запрещены: «не из злого умысла», «он просто так устроен», «если ты умеешь объяснять», «не про истерики, а про темп», «потребность в признании», «границы имеют значение», «важно понимать», «в целом», «это не грубое давление», «скорее это», «ему нужно лишь», «ты должна спокойно». Не переноси ответственность за мужское давление на женщину. Не навязывай противоположную черту ради комплимента. Не пиши, будто он уже совершил описанное.

ОБРАЗЦЫ ЖИВОГО ЯЗЫКА. Это только стилистические ориентиры, не готовые ответы и не характеристики всех обладателей соответствующего аркана. Не копируй конструкции, метафоры или конкретные слова. Каждый пример показывает РАЗНЫЙ тип реакции, разное действие и последствия. Не пытайся подгонять дату под один из них.
<examples>
<example theme="властный, демонстративный, теневая 15-я энергия">«Его задевает не столько отказ, сколько сам факт, что ты можешь решить что-то без него. Отсюда вспышка злости, попытка перехватить управление и показать, чьё здесь слово последнее. Для него это спор за власть, а для тебя — лишняя борьба там, где достаточно одного „нет“.»</example>
<example theme="холодное превосходство, теневая 9-я энергия">«Скандал может и не устроить. Вместо этого разберёт твой отказ так, будто ищет ошибку в чужом отчёте. Тебя не слышат — тебя проверяют. И самое неприятное, что он может искренне считать своё недоверие умом.»</example>
<example theme="уважение, плюсовая 14-я энергия">«Сказала „нет“ — он остановился. Без комиссии по пересмотру твоего решения и обид на три дня. Если хочет уточнить причину, спросит один раз и примет ответ. Тут уважение не надо выбивать, оно уже есть.»</example>
</examples>
ВЫВОД, КОТОРЫЙ ОБЯЗАТЕЛЕН ПЕРЕД НАПИСАНИЕМ: характер реакции выбирается по конкретному взаимодействию разных значимых точек. Не назначай автоматически каждому 15-му аркану скандал или каждому 9-му допрос. Не маскируй конфликт фразами «он просто страстный», «не из злого умысла», «любит победить», и не описывай нарушение границ как ухаживание.

ЭТАЛОН ИНТОНАЦИИ, НЕ ОБРАЗЕЦ ДЛЯ КОПИРОВАНИЯ. Плохой текст: «Его отказ задевает, потому что ему важно ощущать внимание, но он может научиться уважать границы». Нужный уровень прямоты: «Он может принять отказ за личный вызов. Вместо того чтобы остановиться, начнёт доказывать, что ты неправильно решила. Это уже не ухаживание, а попытка выиграть спор, в котором вообще не должно быть победителя». НИКОГДА не копируй эти фразы и ситуацию; это только пример силы языка. Для спокойной трактовки говори так же уверенно, не добавляя искусственной угрозы.

ФОРМАТ. Первый абзац, почти весь текст: первая фраза — вердикт без вступления, затем 2–3 РАЗНЫХ узнаваемых проявления, конкретные последствия и одна меткая формулировка, если она естественна. Второй абзац: одно короткое живое предложение с точным названием ОДНОГО реального следующего вопроса из списка. Два абзаца общим объёмом приблизительно 750–1050 знаков, не растягивай ради лимита. Никаких чисел, дат, арканов, энергии и расчётов в покупательском тексте, никакой эзотерической воды, заголовков и Markdown.

Для частной проверки владелицей верни только валидный JSON-объект. Структура:
{"analysis":{"points":[{"key":"код из входных данных","number":12,"relevance":"что конкретно меняет в выводе"}],"logic":"как сочетание точек определило именно этот тип реакции","verdict":"прямой вывод в одном предложении"},"answer":"Первый абзац.\n\nКороткое предложение со следующим точным вопросом."}
Число 12 дано только как пример формы. Используй не менее трёх разных переданных позиций с РЕАЛЬНЫМИ числами. Не добавляй Markdown-обрамление.
INSTRUCTION;
 $payload=[
 'model'=>'zai-org/GLM-5.1',
 'messages'=>[
  ['role'=>'system','content'=>$system],
  ['role'=>'user','content'=>json_encode([
    'question'=>'Уважает женское «нет» или начинает давить?',
    'calculated_matrix_points'=>$selected,
    'arcana_descriptions_from_our_knowledge_base'=>$knowledge,
    'exact_followup_titles'=>$followups
  ],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]
 ],
 'max_tokens'=>1800,'stream'=>false
 ];
 $key=base64_decode('__SAY_NO_FRESH_CLOUD_KEY__',true);
 if(!is_string($key)||$key==='')throw new RuntimeException('MODEL_CREDENTIAL_NOT_CONFIGURED');
 $curl=curl_init('https://foundation-models.api.cloud.ru/v1/chat/completions');
 curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,
  CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>75,
  CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$key],
  CURLOPT_POSTFIELDS=>json_encode($payload,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE)]);
 $response=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);
 $error=curl_errno($curl);curl_close($curl);
 if($status!==200||$error!==0||!is_string($response))throw new RuntimeException('CLOUD_CALL_FAILED');
 $obj=json_decode($response,true,30,JSON_THROW_ON_ERROR);
 $content=$obj['choices'][0]['message']['content']??null;
 if(!is_string($content)||trim($content)==='')throw new RuntimeException('EMPTY_RESULT');
 $content=trim($content);
 // Accept code-fenced JSON while validating every source point as before.
 $fence=str_repeat(chr(96),3);
 if(str_starts_with($content,$fence)){
  $content=trim(substr($content,3));
  if(str_starts_with($content,'json'))$content=ltrim(substr($content,4));
  if(str_ends_with($content,$fence))$content=trim(substr($content,0,-3));
 }
 $parsed=json_decode(trim($content),true,30,JSON_THROW_ON_ERROR);
 $analysis=$parsed['analysis']??null;$answer=$parsed['answer']??null;
 if(!is_array($analysis)||!is_array($analysis['points']??null)||!is_string($answer)
   ||!is_string($analysis['logic']??null)||!is_string($analysis['verdict']??null))
   throw new RuntimeException('INVALID_ANALYSIS_SHAPE');
 $seen=[];$verified=[];
 foreach($analysis['points'] as $item){
  $p=$item['key']??null;
  if(!is_string($p)||in_array($p,$seen,true)||!in_array($p,$positions,true)
  ||($points[$p]??null)!==($item['number']??null)
  ||!is_string($item['relevance']??null)||mb_strlen($item['relevance'])<10)
   throw new RuntimeException('NUMERIC_ANALYSIS_NOT_VERIFIED');
  $seen[]=$p;$verified[]=['position'=>$p,'number'=>$points[$p],
     'arcana'=>$kb['arcana'][(string)$points[$p]]['name'],'relevance'=>$item['relevance']];
 }
 if(count($seen)<3)throw new RuntimeException('TOO_FEW_VALIDATED_POSITIONS');
 $answer=trim(str_replace(["\r\n","\r"],"\n",$answer));
 $pars=preg_split('/\n\s*\n/u',$answer);
 if(!is_array($pars)||count($pars)!==2||mb_strlen($answer)<400||mb_strlen($answer)>1600)
   throw new RuntimeException('ANSWER_FORMAT_INVALID');
 $followok=false;foreach($followups as $t){if(mb_strpos($pars[1],$t)!==false){$followok=true;break;}}
 if(!$followok)throw new RuntimeException('FOLLOWUP_NOT_IN_CATALOG');
 session_write_close();
 sfReply(200,['ok'=>true,'owner_only'=>true,'draft_only'=>true,'published'=>false,
  'no_predefined_date_meanings'=>true,'full_date'=>sprintf('%02d.%02d.%04d',$d,$m,$y),
  'model'=>'zai-org/GLM-5.1','question_id'=>'say-no',
  'matrix_points_calculated'=>count($points),'points_used'=>$verified,
  'logic'=>$analysis['logic'],'verdict'=>$analysis['verdict'],
  'answer'=>$answer,'answer_chars'=>mb_strlen($answer)]);
} catch(Throwable $e) {
 if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
 error_log('SAY_NO_FRESH_OWNER_TEST:'.get_class($e).':'.$e->getMessage());
 sfReply(503,['ok'=>false,'error'=>'TEST_GENERATION_UNAVAILABLE']);
}
