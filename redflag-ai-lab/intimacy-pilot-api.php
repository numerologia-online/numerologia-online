<?php
declare(strict_types=1);
// Isolated, owner-only experiment. No billing, public catalog writes, or customer answers.
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
function ipReply(int $status,array $data): never {
 http_response_code($status);
 echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 exit;
}
function ip22(int $v): int {
 $v=abs($v);
 while($v>22)$v=array_sum(array_map('intval',str_split((string)$v)));
 return $v===0?22:$v;
}
function ipPoints(int $day,int $month,int $year): array {
 $r='ip22';
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
 if(!naTestOwner(naCurrent(naDB())))ipReply(403,['ok'=>false,'error'=>'OWNER_ONLY']);
 ipReply(410,['ok'=>false,'error'=>'LEGACY_INTIMACY_PREVIEW_RETIRED']);
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST')ipReply(405,['ok'=>false,'error'=>'POST_ONLY']);
 if(!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
   ipReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
 $raw=file_get_contents('php://input',false,null,0,3500);
 $req=json_decode((string)$raw,true,12,JSON_THROW_ON_ERROR);
 if(!is_array($req))ipReply(400,['ok'=>false,'error'=>'BAD_INPUT']);
 $id=$req['question_id']??null;
 $day=$req['day']??null;$month=$req['month']??null;$year=$req['year']??null;
 if(!is_string($id)||!preg_match('/^[a-z][a-z0-9-]{1,40}$/D',$id)
 ||!is_int($day)||!is_int($month)||!is_int($year)
 ||$year<1900||$year>(int)date('Y')||!checkdate($month,$day,$year))
   ipReply(400,['ok'=>false,'error'=>'INVALID_DATE']);
 if(!naAdultBirthDate(sprintf('%04d-%02d-%02d',$year,$month,$day)))ipReply(400,['ok'=>false,'error'=>'REDFLAG_AGE_RESTRICTED']);
 $kb=json_decode((string)file_get_contents(__DIR__.'/intimacy-knowledge-v1.json'),true,24,JSON_THROW_ON_ERROR);
 if(($kb['schema']??'')!=='numi-owner-intimacy-matrix-knowledge-v1'
 ||count($kb['arcana']??[])!==22||count($kb['questions']??[])!==9)
   throw new RuntimeException('KNOWLEDGE_NOT_READY');
 $q=$kb['questions'][$id]??null;
 if(!is_array($q))ipReply(400,['ok'=>false,'error'=>'UNKNOWN_QUESTION']);
 $full=ipPoints($day,$month,$year);
 $inputs=[];$reference=[];
 foreach($q['points'] as $pos) {
  if(!isset($full[$pos],$kb['pointDescriptions'][$pos]))
    throw new RuntimeException('POINT_NOT_FOUND');
  $arc=(string)$full[$pos];$data=$kb['arcana'][$arc]??null;
  if(!is_array($data))throw new RuntimeException('ARCANA_NOT_FOUND');
  $inputs[]=['point'=>$pos,'position'=>$kb['pointDescriptions'][$pos],
    'number'=>$full[$pos],'arcana'=>$data['name']];
  $reference[$arc]=$data;
 }
 $follow=[];
 foreach($kb['questions'] as $qId=>$entry)if($qId!==$id)$follow[]=$entry['title'];
 $system=<<<'PROMPT'
Ты опытный нумеролог Матрицы судьбы на основе 22 Старших арканов. Вопрос касается мужчины, дата его рождения рассчитана сайтом. Отвечаешь женщине на один конкретный вопрос из раздела «Секс и близость».

Обязательное правило: опирайся на переданную НАШУ БАЗУ ЗНАНИЙ. Сайт математически вычислил все точки полной матрицы из дня, месяца и года, выбрал подходящие вопросу позиции и передал значения арканов. Не пересчитывай эти числа, не придумывай их. Сравни НЕ МЕНЕЕ ТРЁХ разных позиций с их реальными значениями и определениями из базы. Определи, какие качества усиливаются, какие вступают в противоречие, к чему это ведёт ИМЕННО в данном вопросе. Не пересказывай арканы один за другим. Не подменяй анализ общими догадками. Для разных вопросов делай действительно разные выводы.

Пиши как умная, наблюдательная и немного дерзкая подруга. В первой же фразе ДАЙ ЧЁТКИЙ ОТВЕТ на поставленный вопрос. Без уклончивости, комплиментарной воды, сахарных оправданий и лекций. Если в трактовке есть эгоизм, давление, холодность или безразличие к желаниям женщины, называй это прямо. Если данные указывают на уважение и нежность, называй их уверенно, не придумывая негатив. Уместны колкие наблюдения и лёгкий юмор над поведением мужчины, но не над женщиной; без мата, пошлости и надуманных сценок. Не вводи противоположный типаж ради баланса. Не выдавай возможные склонности за совершённые поступки. Не выводи биологические сексуальные свойства, гарантированную верность или конкретную частоту секса из чисел. Согласие и отказ женщины всегда обязательны к уважению.

Первый абзац: прямой вердикт, затем 2–3 характерных проявления именно по вопросу и конкретное неудобство или достоинство для женщины. Второй абзац: 1–2 коротких предложения с естественным переходом к ОДНОМУ следующему вопросу, сохрани его название из списка точно. Оба абзаца вместе примерно 1000–1200 знаков. Не пиши в ответе даты, цифры, арканы, методику и расчёты даже словами. Никаких заголовков, Markdown, списков и длинных тире.

Для проверки владелицей сначала сделай внутреннюю структурированную запись анализа с минимум тремя разными точками. Верни только JSON без обрамления и пояснений в структуре:
{"analysis":{"points":[{"key":"имя позиции","number":12,"meaning":"влияние на этот вопрос"}],"interaction":"почему именно сочетание меняет вывод","verdict":"главный вывод"},"answer":"Первый абзац.\n\nВторой абзац."}
Число 12 выше — лишь пример структуры. Подставляй реальные числа входных точек, не придумывай.
PROMPT;
 $user=json_encode([
  'question'=>$q['title'],'specific_focus'=>$q['goal'],
  'computed_full_date_matrix_relevant_points'=>$inputs,
  'our_knowledge_base_22_arcana'=>$reference,
  'available_exact_followup_questions'=>$follow
 ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 $key=base64_decode('__INTIMACY_KEY_PLACEHOLDER__',true);
 if(!is_string($key)||$key==='')throw new RuntimeException('KEY_MISSING');
 $curl=curl_init('https://foundation-models.api.cloud.ru/v1/chat/completions');
 curl_setopt_array($curl,[
  CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,
  CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>70,
  CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$key,'Content-Type: application/json'],
  CURLOPT_POSTFIELDS=>json_encode([
   'model'=>'anthropic/claude-sonnet-4.6',
   'messages'=>[['role'=>'system','content'=>$system],['role'=>'user','content'=>$user]],
   'max_tokens'=>2200,'stream'=>false
  ],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)
 ]);
 $reply=curl_exec($curl);$http=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);
 $errno=curl_errno($curl);curl_close($curl);
 if($errno!==0||$http!==200||!is_string($reply))
  throw new RuntimeException('CLOUDRU_ERROR_'.(string)$http);
 $json=json_decode($reply,true,30,JSON_THROW_ON_ERROR);
 $content=$json['choices'][0]['message']['content']??null;
 if(!is_string($content))throw new RuntimeException('EMPTY_RESPONSE');
 $output=json_decode(trim($content),true,30,JSON_THROW_ON_ERROR);
 $analysis=$output['analysis']??null;$answer=$output['answer']??null;
 if(!is_array($analysis)||!is_array($analysis['points']??null)
 ||!is_string($analysis['interaction']??null)||!is_string($analysis['verdict']??null)
 ||!is_string($answer))throw new RuntimeException('ANALYSIS_NOT_VALID');
 $seen=[];$checked=[];
 foreach($analysis['points'] as $point){
  $name=$point['key']??null;$value=$point['number']??null;
  if(!is_string($name)||in_array($name,$seen,true)||!in_array($name,$q['points'],true)
  ||($full[$name]??null)!==$value||!is_string($point['meaning']??null)
  ||mb_strlen($point['meaning'],'UTF-8')<10)
   throw new RuntimeException('ANALYSIS_POINTS_MISMATCH');
  $seen[]=$name;
  $checked[]=['position'=>$name,'number'=>$value,'meaning'=>$point['meaning']];
 }
 if(count($seen)<3)throw new RuntimeException('ANALYSIS_INCOMPLETE');
 $answer=trim(str_replace(["\r\n","\r"],"\n",$answer));
 $parts=preg_split('/\n\s*\n/u',$answer);
 if(!is_array($parts)||count($parts)!==2||mb_strlen($answer,'UTF-8')<650
 ||mb_strlen($answer,'UTF-8')>1700)throw new RuntimeException('ANSWER_SHAPE_INVALID');
 session_write_close();
 ipReply(200,['ok'=>true,'owner_only'=>true,'draft_only'=>true,'published'=>false,
 'question_id'=>$id,'date'=>sprintf('%02d.%02d.%04d',$day,$month,$year),
 'model'=>'anthropic/claude-sonnet-4.6','full_matrix_points'=>31,
 'selected_points'=>$inputs,'checked_points'=>$checked,
 'interaction'=>$analysis['interaction'],'verdict'=>$analysis['verdict'],
 'answer'=>$answer]);
} catch(Throwable $e) {
 if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
 error_log('INTIMACY_PILOT:'.get_class($e).':'.$e->getMessage());
 ipReply(503,['ok'=>false,'error'=>'PREVIEW_GENERATION_UNAVAILABLE']);
}
