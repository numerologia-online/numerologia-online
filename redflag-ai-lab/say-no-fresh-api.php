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
 $positions=['left','right','center','loveHeart','tailFirst','bottom'];
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
Ты опытный нумеролог Матрицы судьбы, разбираешь мужскую дату рождения по системе 22 арканов. Тебе задали один вопрос: «Уважает женское „нет“ или начинает давить?»

Работай как живой автор интересного нумерологического разбора, а не как вежливый психолог, который повторяет одну мысль пятнадцать раз. У тебя НЕТ готового вывода и НЕТ заранее написанной трактовки даты. Сайт рассчитал полную матрицу мужчины из дня, месяца и года рождения и передал нужные для вопроса позиции плюс значения соответствующих арканов ИЗ НАШЕЙ БАЗЫ ЗНАНИЙ. Используй эту базу как фактическую основу внутри символической системы; никаких выдуманных энергий, позиций и расчётов. Самостоятельно соедини как минимум три позиции, включая энергию года или точку отношений. Сначала выбери конкретный тип реакции на отказ из комбинации точек, затем раскрой именно его, а не перечисляй абстрактные достоинства и недостатки.

Нас интересует, ЧТО МОЖЕТ ПРОИЗОЙТИ, когда женщина говорит «нет»: примет границу; начнёт расспрашивать и спорить; обидится и замкнётся; воспримет как укол самолюбию; станет настойчиво уговаривать; отойдёт спокойно — или другой обоснованный базой вариант. Не подставляй один ответ для всех дат. Не приписывай мужчине реально совершённых поступков и не выдавай символическую склонность за доказательство поведения. Уважение согласия — обязательная норма, а не награда за «правильную энергию». НЕ оправдывай давление словами «он не со зла», «он просто такой», «его надо понять», не выдавай его за страсть.

Пиши обыкновенным человеческим русским языком. Прямо, смело, конкретно, местами дерзко и с точным подколом. Первая фраза — вердикт, а не вступление. Дай узнаваемую мысль, от которой читательница скажет «Вот!». Допускаются цепкие образы вроде «устроит экзамен на право отказать», но НЕ копируй этот пример и не повторяй одни и те же фразы для разных дат. Не пиши «границы являются важным аспектом», «для него близость — это», «это может выражаться в», «в целом», «важно понимать», «внутренняя потребность», «просто нуждается», «если ты умеешь спокойно объяснить». Меньше отвлечённой психологии, больше точного механизма реакции и того, чем она обернётся для женщины. Никакого мата, унижения женщины, шаблонных диалогов, воды и натянутых комплиментов. Не добавляй противоположный типаж «для баланса».

Первый абзац — разбор с 2–3 разными конкретными наблюдениями вокруг одного вердикта. Второй — одно короткое предложение, естественно ведущее к ОДНОМУ точному названию другого вопроса из переданного списка. Два абзаца, ориентир 700–1100 знаков: лучше 780 живых знаков, чем 1200 пустых. Заканчивай мысль, когда она раскрыта. Не называй в ответе дату, числа, арканы, энергии, расчёты и источники. Никаких заголовков, Markdown, длинных тире.

Для проверки верни JSON БЕЗ markdown:
{"analysis":{"points":[{"key":"позиция из входных данных","number":12,"relevance":"что именно внесла в вердикт"}],"logic":"как точки изменили итог","verdict":"конкретный итог по вопросу"},"answer":"Первый абзац.\n\nКороткое предложение с точным названием другого вопроса."}
12 в примере — произвольное число. Для analysis используй минимум три РАЗНЫЕ переданные позиции и точно их числа. Раздел answer — только готовый текст.
INSTRUCTION;
 $payload=[
 'model'=>'anthropic/claude-sonnet-4.6',
 'messages'=>[
  ['role'=>'system','content'=>$system],
  ['role'=>'user','content'=>json_encode([
    'question'=>'Уважает женское «нет» или начинает давить?',
    'calculated_matrix_points'=>$selected,
    'arcana_descriptions_from_our_knowledge_base'=>$knowledge,
    'exact_followup_titles'=>$followups
  ],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]
 ],
 'max_tokens'=>1750,'stream'=>false
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
  'model'=>'anthropic/claude-sonnet-4.6','question_id'=>'say-no',
  'matrix_points_calculated'=>count($points),'points_used'=>$verified,
  'logic'=>$analysis['logic'],'verdict'=>$analysis['verdict'],
  'answer'=>$answer,'answer_chars'=>mb_strlen($answer)]);
} catch(Throwable $e) {
 if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
 error_log('SAY_NO_FRESH_OWNER_TEST:'.get_class($e).':'.$e->getMessage());
 sfReply(503,['ok'=>false,'error'=>'TEST_GENERATION_UNAVAILABLE']);
}
