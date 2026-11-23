<?php
declare(strict_types=1);

function niProviderTag(mixed $value): ?string {
    return is_string($value)&&preg_match('~\A[A-Za-z0-9_.:/-]{1,128}\z~',$value)===1
        ?$value:null;
}


function niCloudFailure(string $reason,string $model,int $status,array $data=[],?string $requestId=null): never {
    $usage=$data['usage']??[];
    $tokens=static fn(mixed $value): ?int=>is_int($value)&&$value>=0?$value:null;
    error_log('INTIMACY_PROVIDER '.json_encode([
        'error'=>$reason,
        'http_status'=>$status,
        'requested_model'=>$model,
        'returned_model'=>niProviderTag($data['model']??null),
        'request_id'=>$requestId??niProviderTag($data['request_id']??$data['id']??null),
        'finish_reason'=>niProviderTag($data['choices'][0]['finish_reason']??null),
        'prompt_tokens'=>$tokens($usage['prompt_tokens']??null),
        'completion_tokens'=>$tokens($usage['completion_tokens']??null),
        'reasoning_tokens'=>$tokens($usage['completion_tokens_details']['reasoning_tokens']??null)
    ],JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
    throw new RuntimeException($reason);
}


function niProviderNotice(string $text): ?string {
    $text=trim($text);
    // Some providers put infrastructure failures in message.content with HTTP 200.
    if(preg_match('/\A(?:error:\s*)?(?:model|gemini|claude|glm)\b[^\r\n]{0,120}?\b(?:no longer available|not available|unavailable|not found|not supported|deprecated|retired|discontinued)\b/i',$text)===1
       ||preg_match('/\A(?:ошибка:\s*)?модель[ \t]+[^\r\n]{0,100}?(?:недоступна|не найдена|больше не поддерживается)/iu',$text)===1)
        return 'PROVIDER_MODEL_UNAVAILABLE';

    if(preg_match('/\A(?:\[\s*error\s*\]|(?:error|api error|upstream error)(?: \d{3})?:|service (?:temporarily )?unavailable\b|internal server error\b|bad gateway\b|rate limit exceeded\b|too many requests\b|сервис временно недоступен|слишком много запросов)/iu',$text)===1)
        return 'PROVIDER_SERVICE_MESSAGE';
    return null;
}


function niValidateGeneratedText(string $text,string $finish): string {
    $text=trim(str_replace(["\r\n","\r"],"\n",$text));
    $fence=str_repeat(chr(96),3);
    if(str_starts_with($text,$fence)&&str_ends_with($text,$fence)){
        $text=trim(substr($text,3,-3));
        if(str_starts_with($text,"text\n"))$text=ltrim(substr($text,5));
    }
    $text=trim(str_replace(['**','__'],'',$text));
    $notice=niProviderNotice($text);
    if($notice!==null)throw new RuntimeException($notice);
    if(in_array($finish,['length','max_tokens'],true))
        throw new RuntimeException('PROVIDER_OUTPUT_LIMIT');
    if($text==='')throw new RuntimeException('EMPTY_ANSWER');
    if(preg_match('/[а-яё]/iu',$text)!==1)
        throw new RuntimeException('INTIMACY_TEXT_LANGUAGE_INVALID');
    if(mb_strlen($text,'UTF-8')<450)
        throw new RuntimeException('INTIMACY_TEXT_LENGTH_INVALID');

    $paragraphs=preg_split('/\n\s*\n/u',$text);
    if(is_array($paragraphs)&&count($paragraphs)===1)$paragraphs=explode("\n",$text);
    if(!is_array($paragraphs)||count($paragraphs)!==2)throw new RuntimeException('INTIMACY_TEXT_PARAGRAPHS_INVALID');
    foreach($paragraphs as $paragraph){
        $letters=preg_match_all('/\p{L}/u',$paragraph);
        $russian=preg_match_all('/[а-яё]/iu',$paragraph);
        if($russian===0||$russian<=$letters/2)
            throw new RuntimeException('INTIMACY_TEXT_LANGUAGE_INVALID');
    }
    return implode("\n\n",array_map('trim',$paragraphs));
}


function niCloudAnswer(mixed $body,int $status,string $model,?string $requestId=null): string {
    $data=is_string($body)?json_decode($body,true,32):null;
    try {
        $error=$data['error']??null;
        $code=is_array($error)&&is_string($error['code']??null)?strtolower($error['code']):'';
        if(in_array($code,['model_not_found','model_not_available','model_unavailable','model_not_supported','model_deprecated','model_retired'],true))
            throw new RuntimeException('PROVIDER_MODEL_UNAVAILABLE');
        $message=is_string($error)?$error:($error['message']??null);
        if(!is_array($data)&&is_string($body))$message=is_string($data)?$data:$body;
        $notice=is_string($message)?niProviderNotice($message):null;
        if($notice!==null)throw new RuntimeException($notice);
        if($status!==200)throw new RuntimeException('PROVIDER_HTTP_'.$status);
        if(!is_array($data))throw new RuntimeException('PROVIDER_INVALID_JSON');
        if($error!==null)throw new RuntimeException('PROVIDER_SERVICE_MESSAGE');

        $choice=$data['choices'][0]??[];
        $finish=$choice['finish_reason']??null;
        $finish=is_string($finish)?strtolower($finish):'';
        $answer=$choice['message']??[];
        if(!empty($answer['refusal'])||in_array($finish,['content_filter','safety','blocked','refusal'],true))
            throw new RuntimeException('PROVIDER_REFUSAL');
        $text=$answer['content']??null;
        if(is_array($text)){
            $parts=[];
            foreach($text as $part){
                if(!is_array($part))continue;
                if(($part['type']??null)==='refusal')throw new RuntimeException('PROVIDER_REFUSAL');
                if(is_string($part['text']??null))$parts[]=$part['text'];
            }
            $text=implode('',$parts);
        }
        return niValidateGeneratedText(is_string($text)?$text:'',$finish);
    } catch(RuntimeException $e) {
        niCloudFailure($e->getMessage(),$model,$status,is_array($data)?$data:[],$requestId);
    }
}


function niCloudCall(array $messages,int $tokens,string $model='anthropic/claude-sonnet-4.6'): string {
    $key=(static function(){ $cfg=require __DIR__.'/intimacy-live-config.php';return $cfg['cloudru_key']??null;})();
    if(!is_string($key)||$key==='')throw new RuntimeException('KEY_NOT_CONFIGURED');
    $ch=curl_init('https://foundation-models.api.cloud.ru/v1/chat/completions');
    if($ch===false)niCloudFailure('PROVIDER_NETWORK_ERROR',$model,0);
    $requestId=null;
    curl_setopt_array($ch,[
        CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>$model==='zai-org/GLM-5.1'?82:($model==='google/gemini-3-flash-preview'?95:55),
        CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$key],
        CURLOPT_HEADERFUNCTION=>static function($handle,string $header)use(&$requestId): int {
            if(strncasecmp($header,'x-request-id:',13)===0)
                $requestId=niProviderTag(trim(substr($header,13)));
            return strlen($header);
        },
        CURLOPT_POSTFIELDS=>json_encode(array_merge(
            ['model'=>$model,'messages'=>$messages,'max_tokens'=>$tokens,'stream'=>false],
            // GLM-5.1 can exhaust a short answer budget in reasoning_content.
            // Avoid billed hidden reasoning; keep the complete authoring prompt.
            $model==='zai-org/GLM-5.1'
                ? ['chat_template_kwargs'=>['enable_thinking'=>false]]
                : []
          ),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)
    ]);
    $body=curl_exec($ch);
    $status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
    $curlCode=curl_errno($ch);
    curl_close($ch);
    if($curlCode===28)niCloudFailure('PROVIDER_TIMEOUT',$model,$status,[],$requestId);
    if($curlCode!==0)niCloudFailure('PROVIDER_NETWORK_ERROR',$model,$status,[],$requestId);
    return niCloudAnswer($body,$status,$model,$requestId);
}


function ni22(int $v): int {
    $v=abs($v);
    while($v>22)$v=array_sum(array_map('intval',str_split((string)$v)));
    return $v?:22;
}


function ni31(int $d,int $m,int $y): array {
    $r='ni22';
    $left=$r($d);$top=$m;$right=$r(array_sum(array_map('intval',str_split((string)$y))));
    $bottom=$r($left+$top+$right);$center=$r($left+$top+$right+$bottom);
    $tl=$r($left+$top);$tr=$r($top+$right);$br=$r($right+$bottom);$bl=$r($bottom+$left);
    $nt=$r($top+$center);$nl=$r($left+$center);$nr=$r($right+$center);
    $tail=$r($center+$bottom);$cash=$r($right+$center);$bal=$r($cash+$tail);
    $p=[
      'left'=>$left,'top'=>$top,'right'=>$right,'bottom'=>$bottom,'center'=>$center,
      'topLeft'=>$tl,'topRight'=>$tr,'bottomRight'=>$br,'bottomLeft'=>$bl,
      'topOuter'=>$r($top+$nt),'topNear'=>$nt,'topCore'=>$r($nt+$center),
      'leftOuter'=>$r($left+$nl),'leftNear'=>$nl,'leftCore'=>$r($nl+$center),
      'rightOuter'=>$r($right+$nr),'rightNear'=>$cash,'rightCore'=>$r($nr+$center),
      'tailFirst'=>$tail,'tailSecond'=>$r($bottom+$tail),
      'loveHeart'=>$r($tail+$bal),'wellbeing'=>$bal,'moneyPoint'=>$r($cash+$bal)
    ];
    foreach(['topLeft'=>$tl,'topRight'=>$tr,'bottomRight'=>$br,'bottomLeft'=>$bl] as $k=>$v){
       $n=$r($v+$center);$p[$k.'Outer']=$r($v+$n);$p[$k.'Near']=$n;
    }
    if(count($p)!==31)throw new RuntimeException('INTIMACY_MATRIX_POINTS_INVALID');
    return $p;
}


function niGenerateText(array $question,int $day,int $month,int $year,array $catalog): string {
   $maps=[
     'fire'=>['left','top','loveHeart','center','tailFirst'],
     'her-pleasure'=>['left','loveHeart','center','top','tailFirst'],
     'pace'=>['left','tailSecond','center','tailFirst','loveHeart'],
     'desire-talk'=>['top','center','left','loveHeart','tailSecond'],
     'tenderness'=>['loveHeart','top','center','left','bottom'],
     'boundaries'=>['center','left','right','top','loveHeart'],
     'closeness'=>['loveHeart','center','left','tailFirst','top'],
     'initiative'=>['left','right','center','top','loveHeart'],
     'compatibility'=>['left','top','loveHeart','tailFirst','tailSecond'],
     'after'=>['loveHeart','center','bottom','left','tailSecond']
   ];
   $id=$question['id']??null;
   if(!is_string($id)||!isset($maps[$id]))throw new RuntimeException('INTIMACY_Q_MAP_MISSING');
   $kb=json_decode((string)file_get_contents(__DIR__.'/intimacy-live-knowledge.json'),true,25,JSON_THROW_ON_ERROR);
   if(($kb['schema']??null)!=='numi-owner-sexuality-matrix-knowledge-v1'
     ||count($kb['arcana']??[])!==22)throw new RuntimeException('INTIMACY_KB_UNAVAILABLE');
   $calculated=ni31($day,$month,$year);
   $positionData=[];
   foreach($maps[$id] as $key){
      $n=$calculated[$key];$a=$kb['arcana'][(string)$n]??null;
      if(!is_array($a)||!is_string($kb['pointDescriptions'][$key]??null))
         throw new RuntimeException('INTIMACY_KB_POSITION_UNAVAILABLE');
      // Model gets only human-readable traits, never arcana names or numbers.
      $positionData[]=[
        'роль_точки'=>$kb['pointDescriptions'][$key],
        'ведущий_мотив'=>$a['core'],
        'сильная_сторона'=>$a['plus'],
        'теневая_сторона'=>$a['minus'],
        'в_отношениях'=>$a['love']
      ];
   }
   // Full storefront catalogue, including questions scheduled to become available.
   // Do not filter by today's 'ready' flag: this is a textual recommendation, not checkout.
   $followups=[];
   foreach(($catalog['categories']??[]) as $group){
      if(($group['id']??null)!=='intimacy')continue;
      foreach(($group['questions']??[]) as $next){
         if(($next['id']??null)===$id||($next['id']??null)==='fire')continue;
         $followups[]=['раздел'=>'Секс и близость','вопрос'=>$next['title'],'тип'=>'платный'];
      }
   }
   // These exact titles are synchronized with data/redflag/banks/*.json in this release.
   // Copying this menu into the live private file avoids dependency on public bank paths.
   $externalJson=<<<'FOLLOWUP_CATALOG'
[{"раздел":"Деньги и щедрость","вопрос":"Щедрый мужчина или считает каждую копейку?","тип":"платный"},{"раздел":"Деньги и щедрость","вопрос":"Будет красиво ухаживать или максимум кофе и прогулка?","тип":"платный"},{"раздел":"Деньги и щедрость","вопрос":"Умеет зарабатывать или всю жизнь будет искать себя?","тип":"платный"},{"раздел":"Деньги и щедрость","вопрос":"Держит слово или опять одни красивые разговоры?","тип":"платный"},{"раздел":"Деньги и щедрость","вопрос":"Будет опорой для семьи или всё снова окажется на твоих плечах?","тип":"платный"},{"раздел":"Деньги и щедрость","вопрос":"Рядом с ним ты будешь жить лучше или начнёшь экономить на себе?","тип":"платный"},{"раздел":"Деньги и щедрость","вопрос":"Есть ли у него потенциал стать богатым мужчиной?","тип":"платный"},{"раздел":"Деньги и щедрость","вопрос":"Будет ли мужчина жить за твой счёт?","тип":"платный"},{"раздел":"Деньги и щедрость","вопрос":"Он приумножит ваши деньги или может оставить тебя с долгами?","тип":"платный"},{"раздел":"Деньги и щедрость","вопрос":"😂 Шуточный вердикт","тип":"платный"},{"раздел":"Любовь и отношения","вопрос":"Романтик в жизни или только в переписке?","тип":"платный"},{"раздел":"Любовь и отношения","вопрос":"Ищет любовь или просто удобную женщину?","тип":"платный"},{"раздел":"Любовь и отношения","вопрос":"Мужчина для семьи или вечный мальчик?","тип":"платный"},{"раздел":"Любовь и отношения","вопрос":"Рядом с ним женщина расцветает или гаснет?","тип":"платный"},{"раздел":"Любовь и отношения","вопрос":"Поддержит в беде или исчезнет первым?","тип":"платный"},{"раздел":"Любовь и отношения","вопрос":"Готов к серьёзным отношениям или вечно «я не готов»?","тип":"платный"},{"раздел":"Любовь и отношения","вопрос":"Способен быть с одной женщиной или его тянет в любовные треугольники?","тип":"платный"},{"раздел":"Любовь и отношения","вопрос":"Почему он исчезает без объяснений?","тип":"платный"},{"раздел":"Любовь и отношения","вопрос":"Умеет любить или только позволяет себя любить?","тип":"платный"},{"раздел":"Красные флаги","вопрос":"Заботится или будет контролировать каждый твой шаг?","тип":"платный"},{"раздел":"Красные флаги","вопрос":"Скромный мужчина или считает себя подарком судьбы?","тип":"платный"},{"раздел":"Красные флаги","вопрос":"Ревнует от любви или устроит допрос за каждый лайк?","тип":"платный"},{"раздел":"Красные флаги","вопрос":"Умеет говорить о проблемах или наказывает молчанием?","тип":"платный"},{"раздел":"Красные флаги","вопрос":"Какой тревожный сигнал нельзя пропустить в начале знакомства?","тип":"платный"},{"раздел":"Красные флаги","вопрос":"Будет твоей опорой или сам доведёт до слёз?","тип":"платный"},{"раздел":"Красные флаги","вопрос":"После ссоры извинится или виноватой сделает тебя?","тип":"платный"},{"раздел":"Красные флаги","вопрос":"Какая его слабость может разрушить ваши отношения?","тип":"платный"},{"раздел":"Красные флаги","вопрос":"С ним спокойно или тебя ждут эмоциональные качели?","тип":"платный"},{"раздел":"Измены и флирт","вопрос":"Верный или постоянно ищет запасные варианты?","тип":"платный"},{"раздел":"Измены и флирт","вопрос":"Флиртует по привычке или ему правда важна одна женщина?","тип":"платный"},{"раздел":"Измены и флирт","вопрос":"Ему можно доверять или лучше снять розовые очки?","тип":"платный"},{"раздел":"Измены и флирт","вопрос":"Если напишет бывшая — поставит точку или приоткроет дверь?","тип":"платный"},{"раздел":"Измены и флирт","вопрос":"Как он ведёт себя, когда появляется соблазн?","тип":"платный"},{"раздел":"Измены и флирт","вопрос":"Любитель крутить тайные романы в своей голове?","тип":"платный"},{"раздел":"Измены и флирт","вопрос":"Говорит о себе правду или скрывает половину своей жизни?","тип":"платный"},{"раздел":"Измены и флирт","вопрос":"Уходит навсегда или возвращается ко всем бывшим?","тип":"платный"},{"раздел":"Измены и флирт","вопрос":"Если поймаешь на измене, признается или сделает виноватой тебя?","тип":"платный"},{"раздел":"Семья и быт","вопрос":"Хозяйственный или из серии «мама всё делала»?","тип":"платный"},{"раздел":"Семья и быт","вопрос":"С ним в отпуск кайф или нервный квест на выживание?","тип":"платный"},{"раздел":"Семья и быт","вопрос":"Обещает и делает или просто король планов?","тип":"платный"},{"раздел":"Семья и быт","вопрос":"Готов ли он к ребёнку или пока сам ещё растёт?","тип":"платный"},{"раздел":"Семья и быт","вопрос":"Будет партнёром или начальником в семье?","тип":"платный"},{"раздел":"Семья и быт","вопрос":"Семья для него главное или дома его не дождёшься?","тип":"платный"},{"раздел":"Семья и быт","вопрос":"При первых семейных проблемах будет бороться или соберёт чемодан?","тип":"платный"},{"раздел":"Семья и быт","вопрос":"Умеет ли он создавать опору для дома, а не только говорить о будущем?","тип":"платный"},{"раздел":"Семья и быт","вопрос":"Он заботится в быту или ждёт, что любовь всё сама устроит?","тип":"платный"},{"раздел":"Язык любви мужчины","вопрос":"Как с ним говорить, чтобы не биться в стену?","тип":"платный"},{"раздел":"Язык любви мужчины","вопрос":"Как он принимает любовь и заботу, чтобы не было мимо?","тип":"платный"},{"раздел":"Язык любви мужчины","вопрос":"Язык любви - как понять по поступкам, что у него есть чувства?","тип":"платный"},{"раздел":"Язык любви мужчины","вопрос":"Как он реагирует на критику и неудобную правду?","тип":"платный"},{"раздел":"Язык любви мужчины","вопрос":"Как у него лучше просить, а не ждать телепатии?","тип":"платный"},{"раздел":"Язык любви мужчины","вопрос":"Что делать, когда он отдаляется?","тип":"платный"},{"раздел":"Язык любви мужчины","вопрос":"Что его ранит сильнее всего в отношениях?","тип":"платный"},{"раздел":"Язык любви мужчины","вопрос":"Как не промахнуться с ним в конфликте?","тип":"платный"},{"раздел":"Язык любви мужчины","вопрос":"Какая поддержка для него правда работает?","тип":"платный"},{"раздел":"Итоговый вердикт","вопрос":"С ним вообще стоит связываться или лучше не тратить время?","тип":"платный"},{"раздел":"Итоговый вердикт","вопрос":"Красивый мужчина или Red Flag с красивыми глазами?","тип":"платный"},{"раздел":"Итоговый вердикт","вопрос":"Его ещё проверять поступками или уже всё понятно?","тип":"платный"},{"раздел":"Итоговый вердикт","вопрос":"Какой главный совет женщине рядом с ним?","тип":"платный"},{"раздел":"Итоговый вердикт","вопрос":"Что ему нужно от женщины, чтобы правда раскрыться?","тип":"платный"},{"раздел":"Итоговый вердикт","вопрос":"Где его главный риск в отношениях?","тип":"платный"},{"раздел":"Итоговый вердикт","вопрос":"Чем он способен порадовать в любви?","тип":"платный"},{"раздел":"Итоговый вердикт","вопрос":"Какой формат отношений с ним будет самым здоровым?","тип":"платный"},{"раздел":"Итоговый вердикт","вопрос":"Как понять, что пора выбрать себя, а не ждать его?","тип":"платный"}]
FOLLOWUP_CATALOG;
   foreach(json_decode($externalJson,true,25,JSON_THROW_ON_ERROR) as $next){
      $followups[]=$next;
   }
   if(count($followups)<70)throw new RuntimeException('INTIMACY_FOLLOWUPS_NOT_READY');
   $system=<<<'PROMPT'
Ты опытный нумеролог по системе 22 энергий. Пишешь женщине о мужчине в разделе «Секс и близость». Отвечай только на конкретный заданный вопрос, а не составляй общий портрет.

Матрица уже рассчитана по полной дате рождения. Тебе переданы словесные трактовки пяти важных точек. Сопоставь не меньше трёх: найди ведущую склонность и покажи, как другие её усиливают или меняют. Это возможные особенности мужчины, а не доказанные факты из его жизни. Не делай одинаковые выводы для всех дат и вопросов.

СТИЛЬ: разговор двух взрослых подруг, которые умеют говорить об интимном свободно и с характером. Пиши просто, уверенно, современно, с живой интонацией. Можно быть дерзкой, немного ехидной, нежной или смешной, смотря что подходит конкретному ответу. Подмечай забавные противоречия в его привычках так, будто вы с подругой только что его раскусили и не можете сдержать улыбку. Позволь себе короткую, дерзкую, чуть ехидную шутку прямо по делу: чтобы женщина хихикнула и узнала знакомую ситуацию. Никакого старомодного эстрадного юмора, театральных монологов, вычурных сравнений и историй ради красного словца.

ВАЖНО: в исходных трактовках встречаются образные выражения. Бери из них смысл, а не сами образы. Не превращай «страсть», «магнит», «скорость» и «контроль» в рассказы про пожар, автомобили, спортивные соревнования или спектакль. Интересны поступки мужчины и его отношение к женщине, а не метафоры. Говори простыми человеческими словами, без литературной воды и псевдопсихологии.

С ПЕРВОЙ ФРАЗЫ ответь прямо, что вероятнее всего: как он проявляет желание и ведёт себя в близости. Затем назови два-три конкретных проявления именно по этому вопросу: что делает, что любит, как реагирует, чего может не замечать. Не подменяй наблюдения красивыми обещаниями и не придумывай ситуации, которые якобы уже случились. Если он заботливый, скажи это без обязательного подвоха. Если эгоистичный или напористый, тоже говори прямо.

ФОРМАТ: только два абзаца. Первый, основной, ориентировочно 650–800 знаков: прямой вывод, конкретика и естественный характер речи. Второй, ориентировочно 140–220 знаков: короткая, живая интрига, которая логично продолжает именно этот ответ и вызывает желание прочитать ещё один разбор. Не пересказывай первый абзац и не повторяй одинаковые рекламные обороты.

Для второго абзаца выбери ровно один вопрос из полного списка всех разделов. Все эти вопросы предусмотрены для будущей продажи; не отсеивай вопрос только потому, что прямо сейчас он ещё не опубликован. Приоритет: платный вопрос в другом разделе, если он логично раскрывает новую сторону мужчины; иначе другой платный вопрос из «Секс и близость». Выбирай не по порядку списка, а по самой интересной связи с особенностями конкретного ответа. Разнообразь направления: измены, характер, отношения, быт, деньги, язык любви и другие темы; не предлагай всем одно и то же. Если проявилась тяга к соблазнам, можно подвести к вопросу о верности, но нельзя заранее объявлять мужчину изменщиком. Если заметны контроль, самолюбование или нежность, ищи действительно связанную тему.

Сделай плавную, человеческую подводку, как подруга, которая только что заметила важный нюанс: подхвати конкретную мысль из первого абзаца, добавь короткую интригу, а потом естественно предложи следующий вопрос. Не делай сухое объявление «Проверь ...» без перехода, не начинай каждый раз с одинаковой фразы и не превращай текст в рекламу. В конце назови выбранный вопрос точно как в списке, можно с названием раздела. Не обещай, что он уже доступен, и не выдавай его результат заранее. Всего ориентировочно 800–1050 знаков.

Не упоминай числа, арканы, энергии, матрицу и расчёты. Уважай согласие и личные границы. Без заголовков, списков, Markdown. Верни только два абзаца.
PROMPT;
   $data=json_encode([
      'вопрос'=>$question['title'],
      'трактовки_значимых_позиций_полной_матрицы'=>$positionData,
      'допустимые_точные_названия_следующего_вопроса'=>$followups
   ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
   $text=niCloudCall([['role'=>'system','content'=>$system],['role'=>'user','content'=>$data]],2800,'google/gemini-3-flash-preview');
   // Preserve the editorial typography used by these cards.
   $text=preg_replace('/[ \t]*[—–―][ \t]*/u', ': ', $text)??$text;
   $text=preg_replace('/:[ \t]*:/u', ':', $text)??$text;
   return preg_replace('/[ \t]{2,}/u',' ',$text)??$text;
}


/** Production-only engine. No editor/session bypass and no public source of provider secrets. */
function niQuestions(): array {
    $path=__DIR__.'/intimacy-live-questions.json';
    $bank=json_decode((string)file_get_contents($path),true,25,JSON_THROW_ON_ERROR);
    if(($bank['id']??null)!=='intimacy'||count($bank['questions']??[])!==10)
        throw new RuntimeException('INTIMACY_QUESTIONS_UNAVAILABLE');
    return $bank['questions'];
}
function niMapIds(): array {
    return ['her-pleasure','pace','desire-talk','tenderness','boundaries','closeness','initiative','compatibility','after'];
}
function niSupportedPaidResource(string $code,string $resource): bool {
    if($code!=='redflag_question'||preg_match('/^redflag:intimacy:([a-z-]+):((?:19|20)\d\d-\d\d-\d\d)$/D',$resource,$m)!==1)
        return false;
    return in_array($m[1],niMapIds(),true)&&naCatalogDate($m[2])!==null;
}
function niEngineInstalled(): bool {
    if(!is_file(__DIR__.'/intimacy-live.php')||!is_file(__DIR__.'/intimacy-live-config.php')
       ||!is_file(__DIR__.'/intimacy-live-knowledge.json')
       ||!is_file(__DIR__.'/intimacy-live-questions.json'))return false;
    $cfg=require __DIR__.'/intimacy-live-config.php';
    return is_array($cfg)&&is_string($cfg['cloudru_key']??null)
        && strlen($cfg['cloudru_key'])>12;
}
function niCacheDirectory(): string {
    $dir=__DIR__.'/intimacy-answer-cache';
    if(!is_dir($dir) && !@mkdir($dir,0700,true)&&!is_dir($dir))
        throw new RuntimeException('INTIMACY_CACHE_UNAVAILABLE');
    return $dir;
}
function niCacheFile(string $id,string $date): string {
    if(!in_array($id,array_merge(['fire'],niMapIds()),true)||naCatalogDate($date)===null)
        throw new InvalidArgumentException('INVALID_INTIMACY_REQUEST');
    // Free test date must receive the new voice; purchased, cached responses remain unchanged.
    return niCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).($id==='fire'?'-laugh-v10':'').'.json';
}
function niCachedAnswer(string $id,string $date): ?string {
    $file=niCacheFile($id,$date);
    if(!is_file($file))return null;
    $raw=file_get_contents($file);
    if(!is_string($raw)||strlen($raw)>12000)return null;
    $data=json_decode($raw,true);
    $answer=is_array($data)&&($data['question']??null)===$id
        &&($data['date']??null)===$date &&($data['version']??null)===1
        ?($data['answer']??null):null;
    return is_string($answer)&&strlen($answer)>450?$answer:null;
}
function niEnsureAnswer(string $id,string $date): string {
    if(!niEngineInstalled())throw new RuntimeException('INTIMACY_ENGINE_UNAVAILABLE');
    $path=niCacheFile($id,$date);
    $existing=niCachedAnswer($id,$date);
    if($existing!==null)return $existing;
    $lock=@fopen($path.'.lock','c');
    if($lock===false)throw new RuntimeException('INTIMACY_LOCK_UNAVAILABLE');
    try{
        if(!flock($lock,LOCK_EX))throw new RuntimeException('INTIMACY_LOCK_UNAVAILABLE');
        $existing=niCachedAnswer($id,$date);
        if($existing!==null)return $existing;
        [$y,$m,$d]=array_map('intval',explode('-',$date));
        $questions=niQuestions();
        $selected=null;$cat=['categories'=>[['id'=>'intimacy','questions'=>[]]]];
        foreach($questions as $q){
            $cat['categories'][0]['questions'][]=['id'=>$q['id'],'title'=>$q['title']];
            if($q['id']===$id)$selected=['id'=>$q['id'],'title'=>$q['title']];
        }
        if($selected===null)throw new RuntimeException('INTIMACY_QUESTION_NOT_FOUND');
        $text=niGenerateText($selected,$d,$m,$y,$cat);
        $text=niValidateGeneratedText($text,'stop');
        if(mb_strlen($text,'UTF-8')>1800)throw new RuntimeException('INTIMACY_TEXT_TOO_LONG');
        $blob=json_encode(['version'=>1,'question'=>$id,'date'=>$date,'answer'=>$text],
            JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
        $tmp=$path.'.'.bin2hex(random_bytes(6)).'.tmp';
        if(file_put_contents($tmp,$blob,LOCK_EX)===false)throw new RuntimeException('INTIMACY_CACHE_WRITE_FAILED');
        @chmod($tmp,0600);
        if(!rename($tmp,$path)){@unlink($tmp);throw new RuntimeException('INTIMACY_CACHE_WRITE_FAILED');}
        return $text;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function niEnsurePaidResource(string $resource): string {
    if(!niSupportedPaidResource('redflag_question',$resource))
        throw new InvalidArgumentException('INVALID_INTIMACY_RESOURCE');
    if(!preg_match('/^redflag:intimacy:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m))
        throw new RuntimeException('INTIMACY_RESOURCE_INVALID');
    return niEnsureAnswer($m[1],$m[2]);
}
function niMaterialFromCache(string $resource): array {
    if(!niSupportedPaidResource('redflag_question',$resource))
        throw new RuntimeException('MATERIAL_NOT_READY');
    preg_match('/^redflag:intimacy:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m);
    $answer=niCachedAnswer($m[1],$m[2]);
    if($answer===null)throw new RuntimeException('MATERIAL_NOT_READY');
    $title='';
    foreach(niQuestions() as $q)if($q['id']===$m[1]){$title=$q['title'];break;}
    return ['title'=>$title,'sections'=>[['title'=>$title,'paragraphs'=>preg_split('/\n\s*\n/u',$answer)]],
        'links'=>[],'pdf_available'=>false];
}
function niPermitFree(string $date,?array $owner,callable $generate): string {
    if($owner!==null && naTestOwner($owner))return $generate();
    // One newly calculated free birth date per IP/day; cached answers do not
    // incur any provider cost. All client dates are served by the same engine.
    $cached=niCachedAnswer('fire',$date);
    if($cached!==null)return $cached;
    $day=gmdate('Ymd');
    $addr=(string)($_SERVER['REMOTE_ADDR']??'');
    $hash=hash('sha256',$day.'|'.$addr.'|intimacy-free-v1');
    $path=niCacheDirectory().'/free-'.$hash.'.quota';
    $handle=@fopen($path,'c+');
    if($handle===false)throw new RuntimeException('FREE_RATE_LIMIT_STORAGE_UNAVAILABLE');
    try {
        if(!flock($handle,LOCK_EX))throw new RuntimeException('FREE_RATE_LIMIT_STORAGE_UNAVAILABLE');
        rewind($handle);$existing=trim((string)stream_get_contents($handle));
        if($existing!==''&&$existing!==$date)
            throw new RuntimeException('FREE_DAILY_LIMIT');
        $answer=$generate();
        rewind($handle);ftruncate($handle,0);fwrite($handle,$date);fflush($handle);
        return $answer;
    }finally{flock($handle,LOCK_UN);fclose($handle);}
}
