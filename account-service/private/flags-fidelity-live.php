<?php
declare(strict_types=1);
// Exact approved editorial matrix, point maps, prompt and knowledge. No HTTP entrypoint.
require_once __DIR__.'/intimacy-live.php';
function rfs22(int $v): int {
    $v=abs($v);
    while($v>22)$v=array_sum(array_map('intval',str_split((string)$v)));
    return $v?:22;
}
function rfs31(int $d,int $m,int $y): array {
    $r='rfs22';
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
    if(count($p)!==31)throw new RuntimeException('OWNER_MATRIX_POINTS_INVALID');
    return $p;
}
function rfsFlagsMessages(array $question,int $day,int $month,int $year,array $catalog): array {
   $maps=[
     'say-no'=>['left','center','loveHeart','right','tailFirst'],
     'care-or-control'=>['left','center','right','top','loveHeart'],
     'hero'=>['left','center','right','top','bottom'],
     'jealousy'=>['loveHeart','tailFirst','center','bottom','left'],
     'argument'=>['center','left','tailSecond','top','loveHeart'],
     'abuse-signal'=>['center','left','tailFirst','bottom','right'],
     'support-or-cause'=>['loveHeart','center','left','right','top'],
     'apology'=>['center','bottom','tailSecond','left','right'],
     'weak-place'=>['bottom','center','tailFirst','right','loveHeart'],
     'calm-or-swings'=>['center','left','bottom','loveHeart','tailSecond']
   ];
   $id=$question['id']??null;
   if(!is_string($id)||!isset($maps[$id]))throw new RuntimeException('OWNER_Q_MAP_MISSING');
   $kb=json_decode((string)file_get_contents(__DIR__.'/flags-live-knowledge.json'),true,25,JSON_THROW_ON_ERROR);
   if(($kb['schema']??null)!=='numi-owner-intimacy-matrix-knowledge-v1'
     ||count($kb['arcana']??[])!==22)throw new RuntimeException('OWNER_KB_UNAVAILABLE');
   $calculated=rfs31($day,$month,$year);
   $positionData=[];
   foreach($maps[$id] as $key){
      $n=$calculated[$key];$a=$kb['arcana'][(string)$n]??null;
      if(!is_array($a)||!is_string($kb['pointDescriptions'][$key]??null))
         throw new RuntimeException('OWNER_KB_POSITION_UNAVAILABLE');
      // Model gets only human-readable traits, never arcana names or numbers.
      $positionData[]=[
        'роль_точки'=>$kb['pointDescriptions'][$key],
        'ведущий_мотив'=>$a['core'],
        'сильная_сторона'=>$a['plus'],
        'теневая_сторона'=>$a['minus'],
        'в_отношениях'=>$a['question_traits'][$id]??$a['love']
      ];
   }
   $followups=[];
   foreach(($catalog['categories']??[]) as $group){
      if(($group['id']??null)!=='flags')continue;
      foreach(($group['questions']??[]) as $next){
        if(($next['id']??null)!==$id)$followups[]=$next['title'];
      }
   }
   if(count($followups)<8)throw new RuntimeException('OWNER_FOLLOWUPS_NOT_READY');
   $system=<<<'PROMPT'
Ты опытный нумеролог Матрицы судьбы (22 Старших аркана), пишешь женщине о мужчине. Это раздел «Красные флаги». Отвечай на ОДИН заданный вопрос, не на всю жизнь мужчины.

У тебя НЕТ готовых выводов или банка трактовок. Сайт уже математически рассчитал полную матрицу мужчины по дню, месяцу и году рождения. Ты получаешь только ПОНЯТНЫЕ СЛОВЕСНЫЕ ХАРАКТЕРИСТИКИ значимых для вопроса позиций из нашей базы знаний, без номеров и названий арканов. Объединяй именно эти характеристики, ничего не пересчитывай. Нельзя переносить формулировки из технических данных в клиентский текст. Перед тем как писать, самостоятельно сопоставь минимум три переданные точки, выбери одну ведущую конкретную реакцию и уточни, как другие энергии изменяют её форму. Не превращай противоречие в бессмысленную золотую середину. Для разных вопросов меняй сам вывод, а не только слова.

Не дипломатничай там, где переданные теневые характеристики указывают на конкретную слабость. Жажда власти, вспышки злости, ревность, манипуляции и борьба с возражениями не становятся безобидными переговорами или просто «темпераментом». Холодное превосходство, придирчивость и обесценивание чужого мнения тоже называй прямо. Если основной риск — резкая реакция на несогласие, так и пиши. Но не делай мужчину агрессивным автоматически: сопоставляй значимые позиции и их противоречия. Если сочетание указывает на зрелое уважение и надёжность, говори это уверенно, не выдумывая отрицательный типаж. Это символические возможные склонности, не проверенные факты.

Пиши как умная, дерзкая, наблюдательная подруга. Чётко, ярко, нормальными словами, заметно острее и смелее, чем вежливый психолог, с узнаваемыми поступками. В ПЕРВОЙ ФРАЗЕ прямой ответ на вопрос. Затем два-три РАЗНЫХ конкретных проявления и чем это оборачивается для женщины. Не бойся назвать высокомерие высокомерием, манипуляции манипуляциями, давление давлением, если это вытекает из переданных характеристик. Одна меткая, неожиданная формулировка лучше трёх дипломатичных объяснений. Но никакой грубости к женщине, искусственного драматизма и обвинений без оснований. Никакой воды, пафоса, нравоучений, повторов или необязательных похвал. Не смягчай жёсткий вывод и не заставляй женщину отвечать за мужское поведение. Нельзя: «он не со зла», «это не злой умысел», «он просто такой», «ему нужно понять», «не про истерики, а про темп», «если ты умеешь объяснять», «на самом деле ему важно», «в целом», «зато». Не выдумывай уже совершённых поступков. Нарушение согласия не оправдывает никакой аркан.

Три коротких ОБРАЗЦА только уровня языка, НЕ для копирования и НЕ для обязательного распределения дат:
Властный: «Ему мало высказать своё мнение. Ему нужно, чтобы ты признала его правоту. И спор быстро перестаёт быть разговором».
Холодный: «Вместо скандала устроит тебе экзамен на право иметь своё мнение. Даже твой отказ он сначала захочет проверить на ошибки».
Уважительный: «Сказала нет — он остановился. Без обиженного спектакля и комиссии по пересмотру твоего решения».
Это примеры интонации, а не автоматические трактовки арканов. Выбирай проявление по реальному символическому сочетанию.

ФОРМАТ. Ровно два абзаца, вместе ориентировочно 950–1200 знаков. Первый, основной, примерно 730–950 знаков: главный вывод, два-три РАЗНЫХ признака и конкретный риск или достоинство, без воды и повторов. Второй, примерно 150–230 знаков, это НЕ голая ссылка и НЕ пересказ названия. Он должен оставить лёгкое напряжение и вызвать желание открыть следующий вопрос. Напиши две-три живые фразы: сначала конкретная неожиданная зацепка, вытекающая именно из вывода ПЕРВОГО абзаца, затем поверни разговор к ДРУГОЙ стороне отношений, закончите ОДНИМ ТОЧНЫМ названием следующего вопроса из переданного списка. Не отвечай на следующий вопрос вместо того, чтобы заинтересовать. Не называй следующий вопрос случайно, выбирай содержательную связь. Избегай шаблонов «раз уж мы разобрались», «а теперь давай узнаем», «интересно, что будет дальше», «не менее важный вопрос», «следующий вопрос», «логично спросить». Каждая подводка должна быть самостоятельной, цепкой и отличаться от подводок к другим ответам. Если текст уже насыщен, не растягивай его ради количества знаков. Не называй в тексте покупательнице арканы, числа, энергию, дату, методику, внутренние расчёты. В ГОТОВОМ ТЕКСТЕ НЕЛЬЗЯ УПОМИНАТЬ НИ ОДНОГО НАЗВАНИЯ АРКАНА, НИ ЕГО НОМЕРА, НИ НАЗВАНИЯ ТОЧКИ РАСЧЁТА. НЕЛЬЗЯ ИСПОЛЬЗОВАТЬ СЛОВА «энергия», «аркан» И «матрица» ВМЕСТО ОПИСАНИЯ ПОСТУПКОВ. Объясняй только по-человечески: что он склонен делать, как реагировать и что это значит для женщины. Нужны исключительно человеческие черты и поступки. НЕЛЬЗЯ ИСПОЛЬЗОВАТЬ ДЛИННОЕ ИЛИ СРЕДНЕЕ ТИРЕ: «—», «–», «―». Перестрой предложения через точку, двоеточие или союз. Вычитай собственный ответ на эти два запрета перед отправкой. Без заголовков, списков и Markdown. Верни только два русских абзаца.
PROMPT;
   $data=json_encode([
      'вопрос'=>$question['title'],
      'трактовки_значимых_позиций_полной_матрицы'=>$positionData,
      'допустимые_точные_названия_следующего_вопроса'=>$followups
   ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
   return [['role'=>'system','content'=>$system],['role'=>'user','content'=>$data]];
}
function rfsFidelityMessages(array $question,int $day,int $month,int $year,array $catalog): array {
   $maps=[
     'faithful'=>['left','top','loveHeart','center','tailFirst'],
     'options'=>['left','top','loveHeart','tailSecond','center'],
     'flirt'=>['left','top','loveHeart','tailFirst','right'],
     'trust'=>['left','top','center','right','tailSecond'],
     'ex'=>['left','top','loveHeart','tailFirst','bottom'],
     'temptation'=>['left','top','center','loveHeart','tailFirst'],
     'physical-or-emotional'=>['left','top','loveHeart','tailSecond','center'],
     'secrecy'=>['left','top','center','right','tailSecond'],
     'return'=>['left','top','tailFirst','tailSecond','loveHeart'],
     'after-mistake'=>['left','top','center','bottom','tailSecond'],
   ];
   $id=$question['id']??null;
   if(!is_string($id)||!isset($maps[$id]))throw new RuntimeException('OWNER_Q_MAP_MISSING');
   $kb=json_decode((string)file_get_contents(__DIR__.'/fidelity-live-knowledge.json'),true,25,JSON_THROW_ON_ERROR);
   if(($kb['schema']??null)!=='numi-owner-infidelity-matrix-knowledge-v1'
     ||count($kb['arcana']??[])!==22)throw new RuntimeException('OWNER_KB_UNAVAILABLE');
   $calculated=rfs31($day,$month,$year);
   $positionData=[];
   foreach($maps[$id] as $key){
      $n=$calculated[$key];$a=$kb['arcana'][(string)$n]??null;
      if(!is_array($a)||!is_string($kb['pointDescriptions'][$key]??null))
         throw new RuntimeException('OWNER_KB_POSITION_UNAVAILABLE');
      // Model gets only human-readable traits, never arcana names or numbers.
      $positionData[]=[
        'роль_точки'=>$kb['pointDescriptions'][$key],
        'ведущий_мотив'=>$a['core'],
        'сильная_сторона'=>$a['plus'],
        'теневая_сторона'=>$a['minus'],
        'в_отношениях'=>$a['question_traits'][$id]??$a['love']
      ];
   }
   $followups=[];
   foreach(($catalog['categories']??[]) as $group){
      if(($group['id']??null)!=='infidelity')continue;
      foreach(($group['questions']??[]) as $next){
        if(($next['id']??null)!==$id)$followups[]=$next['title'];
      }
   }
   if(count($followups)<8)throw new RuntimeException('OWNER_FOLLOWUPS_NOT_READY');
   $system=<<<'PROMPT'
Ты опытный нумеролог Матрицы судьбы (22 Старших аркана), пишешь женщине о мужчине. Это раздел «Измены и флирт». Отвечай на ОДИН заданный вопрос, не на всю жизнь мужчины.

У тебя НЕТ готовых выводов или банка трактовок. Сайт уже математически рассчитал полную матрицу мужчины по дню, месяцу и году рождения. Ты получаешь только ПОНЯТНЫЕ СЛОВЕСНЫЕ ХАРАКТЕРИСТИКИ значимых для вопроса позиций из нашей базы знаний, без номеров и названий арканов. Объединяй именно эти характеристики, ничего не пересчитывай. Нельзя переносить формулировки из технических данных в клиентский текст. Перед тем как писать, самостоятельно сопоставь минимум три переданные точки, выбери одну ведущую конкретную реакцию и уточни, как другие энергии изменяют её форму. Не превращай противоречие в бессмысленную золотую середину. Для разных вопросов меняй сам вывод, а не только слова.

Не дипломатничай там, где переданные теневые характеристики указывают на конкретную слабость. Жажда власти, вспышки злости, ревность, манипуляции и борьба с возражениями не становятся безобидными переговорами или просто «темпераментом». Холодное превосходство, придирчивость и обесценивание чужого мнения тоже называй прямо. Если основной риск — резкая реакция на несогласие, так и пиши. Но не делай мужчину агрессивным автоматически: сопоставляй значимые позиции и их противоречия. Если сочетание указывает на зрелое уважение и надёжность, говори это уверенно, не выдумывая отрицательный типаж. Это символические возможные склонности, не проверенные факты.

Пиши как умная, дерзкая, наблюдательная подруга. Чётко, ярко, нормальными словами, заметно острее и смелее, чем вежливый психолог, с узнаваемыми поступками. В ПЕРВОЙ ФРАЗЕ прямой ответ на вопрос. Затем два-три РАЗНЫХ конкретных проявления и чем это оборачивается для женщины. Не бойся назвать высокомерие высокомерием, манипуляции манипуляциями, давление давлением, если это вытекает из переданных характеристик. Одна меткая, неожиданная формулировка лучше трёх дипломатичных объяснений. Но никакой грубости к женщине, искусственного драматизма и обвинений без оснований. Никакой воды, пафоса, нравоучений, повторов или необязательных похвал. Не смягчай жёсткий вывод и не заставляй женщину отвечать за мужское поведение. Нельзя: «он не со зла», «это не злой умысел», «он просто такой», «ему нужно понять», «не про истерики, а про темп», «если ты умеешь объяснять», «на самом деле ему важно», «в целом», «зато». Не выдумывай уже совершённых поступков. Нарушение согласия не оправдывает никакой аркан.

Три коротких ОБРАЗЦА только уровня языка, НЕ для копирования и НЕ для обязательного распределения дат:
Властный: «Ему мало высказать своё мнение. Ему нужно, чтобы ты признала его правоту. И спор быстро перестаёт быть разговором».
Холодный: «Вместо скандала устроит тебе экзамен на право иметь своё мнение. Даже твой отказ он сначала захочет проверить на ошибки».
Уважительный: «Сказала нет — он остановился. Без обиженного спектакля и комиссии по пересмотру твоего решения».
Это примеры интонации, а не автоматические трактовки арканов. Выбирай проявление по реальному символическому сочетанию.

ФОРМАТ. Ровно два абзаца, вместе ориентировочно 950–1200 знаков. Первый, основной, примерно 730–950 знаков: главный вывод, два-три РАЗНЫХ признака и конкретный риск или достоинство, без воды и повторов. Второй, примерно 150–230 знаков, это НЕ голая ссылка и НЕ пересказ названия. Он должен оставить лёгкое напряжение и вызвать желание открыть следующий вопрос. Напиши две-три живые фразы: сначала конкретная неожиданная зацепка, вытекающая именно из вывода ПЕРВОГО абзаца, затем поверни разговор к ДРУГОЙ стороне отношений, закончите ОДНИМ ТОЧНЫМ названием следующего вопроса из переданного списка. Не отвечай на следующий вопрос вместо того, чтобы заинтересовать. Не называй следующий вопрос случайно, выбирай содержательную связь. Избегай шаблонов «раз уж мы разобрались», «а теперь давай узнаем», «интересно, что будет дальше», «не менее важный вопрос», «следующий вопрос», «логично спросить». Каждая подводка должна быть самостоятельной, цепкой и отличаться от подводок к другим ответам. Если текст уже насыщен, не растягивай его ради количества знаков. Не называй в тексте покупательнице арканы, числа, энергию, дату, методику, внутренние расчёты. В ГОТОВОМ ТЕКСТЕ НЕЛЬЗЯ УПОМИНАТЬ НИ ОДНОГО НАЗВАНИЯ АРКАНА, НИ ЕГО НОМЕРА, НИ НАЗВАНИЯ ТОЧКИ РАСЧЁТА. НЕЛЬЗЯ ИСПОЛЬЗОВАТЬ СЛОВА «энергия», «аркан» И «матрица» ВМЕСТО ОПИСАНИЯ ПОСТУПКОВ. Объясняй только по-человечески: что он склонен делать, как реагировать и что это значит для женщины. Нужны исключительно человеческие черты и поступки. НЕЛЬЗЯ ИСПОЛЬЗОВАТЬ ДЛИННОЕ ИЛИ СРЕДНЕЕ ТИРЕ: «—», «–», «―». Перестрой предложения через точку, двоеточие или союз. Вычитай собственный ответ на эти два запрета перед отправкой. Без заголовков, списков и Markdown. Верни только два русских абзаца.
PROMPT;
   $data=json_encode([
      'вопрос'=>$question['title'],
      'трактовки_значимых_позиций_полной_матрицы'=>$positionData,
      'допустимые_точные_названия_следующего_вопроса'=>$followups
   ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
   return [['role'=>'system','content'=>$system],['role'=>'user','content'=>$data]];
}
function rfsCatalog(): array {
    $c=json_decode((string)file_get_contents(__DIR__.'/flags-fidelity-live-questions.json'),true,24,JSON_THROW_ON_ERROR);
    if(array_column($c['categories']??[],'id')!==['flags','infidelity'])throw new RuntimeException('REDFLAG_LIVE_CATALOG');
    foreach($c['categories'] as $g)if(count($g['questions']??[])!==10)throw new RuntimeException('REDFLAG_LIVE_CATALOG');
    return $c;
}
function rfsQuestion(string $category,string $id): ?array {
    if($category==='flags'&&$id==='comic-verdict-flags')return ['id'=>$id,'title'=>'😂 Шуточный вердикт'];
    if($category==='infidelity'&&$id==='comic-verdict-infidelity')return ['id'=>$id,'title'=>'😂 Шуточный вердикт'];
    foreach(rfsCatalog()['categories'] as $g)if($g['id']===$category)foreach($g['questions'] as $q)if($q['id']===$id)return $q;
    return null;
}
function rfsFreeId(string $category): ?string {return ['flags'=>'say-no','infidelity'=>'faithful'][$category]??null;}
function rfsDate(string $date): bool {return naCatalogDate($date)!==null&&$date<=gmdate('Y-m-d');}
function rfsParsePaid(string $code,string $resource): ?array {
    if($code!=='redflag_question'||preg_match('/^redflag:(flags|infidelity):([a-z-]+):((?:19|20)\d\d-\d\d-\d\d)$/D',$resource,$m)!==1)return null;
    if(!rfsDate($m[3])||$m[2]===rfsFreeId($m[1])||rfsQuestion($m[1],$m[2])===null)return null;
    return [$m[1],$m[2],$m[3]];
}
function rfsSupportedPaidResource(string $code,string $resource): bool {return rfsParsePaid($code,$resource)!==null;}
function rfsEngineInstalled(): bool {
    foreach(['flags-live-knowledge.json','fidelity-live-knowledge.json','flags-fidelity-live-questions.json','intimacy-live-config.php'] as $n)if(!is_file(__DIR__.'/'.$n))return false;
    $cfg=require __DIR__.'/intimacy-live-config.php';
    return is_array($cfg)&&is_string($cfg['cloudru_key']??null)&&strlen($cfg['cloudru_key'])>12;
}
function rfsMessages(string $category,string $id,string $date): array {
    $q=rfsQuestion($category,$id);if($q===null||!rfsDate($date))throw new InvalidArgumentException('REDFLAG_LIVE_REQUEST');
    [$y,$m,$d]=array_map('intval',explode('-',$date));$c=rfsCatalog();
    if($category==='flags'&&$id==='comic-verdict-flags'){
        require_once __DIR__.'/flags-comic-verdict.php';
        return fcvMessages($d,$m,$y);
    }
    if($category==='infidelity'&&$id==='comic-verdict-infidelity'){
        require_once __DIR__.'/infidelity-comic-verdict.php';
        return icvMessages($d,$m,$y);
    }
    return $category==='flags'?rfsFlagsMessages($q,$d,$m,$y,$c):rfsFidelityMessages($q,$d,$m,$y,$c);
}
function rfsCacheDir(): string {
    $p=__DIR__.'/flags-fidelity-answer-cache';if(!is_dir($p)&&!@mkdir($p,0700,true)&&!is_dir($p))throw new RuntimeException('REDFLAG_LIVE_CACHE');return $p;
}
function rfsCacheFile(string $category,string $id,string $date): string {
    if(!rfsDate($date)||rfsQuestion($category,$id)===null)throw new InvalidArgumentException('REDFLAG_LIVE_REQUEST');
    return rfsCacheDir().'/'.$category.'-'.$id.'-'.str_replace('-','',$date).'-v1.json';
}
function rfsValidate(string $text): string {
    $text=preg_replace('/[ \t]*[—–―][ \t]*/u', ': ', $text)??$text;
    $text=preg_replace('/:[ \t]*:/u', ':', $text)??$text;
    $text=preg_replace('/[ \t]{2,}/u',' ',$text)??$text;
    $text=niValidateGeneratedText($text,'stop');
    if(mb_strlen($text,'UTF-8')>1900)throw new RuntimeException('REDFLAG_LIVE_LENGTH');return $text;
}
function rfsCached(string $category,string $id,string $date): ?string {
    $p=rfsCacheFile($category,$id,$date);
    if(!is_file($p)||filesize($p)>14000)return null;
    $v=json_decode((string)file_get_contents($p),true);
    if(!is_array($v)||($v['version']??null)!==1||($v['category']??null)!==$category||($v['question']??null)!==$id||($v['date']??null)!==$date||!is_string($v['answer']??null))return null;
    try{return rfsValidate($v['answer']);}catch(Throwable $e){return null;}
}
function rfsEnsure(string $category,string $id,string $date): string {
    if(!rfsEngineInstalled())throw new RuntimeException('REDFLAG_LIVE_UNAVAILABLE');
    $file=rfsCacheFile($category,$id,$date);$cached=rfsCached($category,$id,$date);if($cached!==null)return $cached;
    $lock=@fopen($file.'.lock','c');if($lock===false)throw new RuntimeException('REDFLAG_LIVE_LOCK');
    try{
        if(!flock($lock,LOCK_EX))throw new RuntimeException('REDFLAG_LIVE_LOCK');
        $cached=rfsCached($category,$id,$date);if($cached!==null)return $cached;
        $text=rfsValidate(niCloudCall(rfsMessages($category,$id,$date),2800,'google/gemini-3-flash-preview'));
        $data=json_encode(['version'=>1,'category'=>$category,'question'=>$id,'date'=>$date,'answer'=>$text],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        $tmp=$file.'.'.bin2hex(random_bytes(8)).'.tmp';
        if(file_put_contents($tmp,$data,LOCK_EX)!==strlen($data)){@unlink($tmp);throw new RuntimeException('REDFLAG_LIVE_WRITE');}
        @chmod($tmp,0600);
        if(!rename($tmp,$file)){@unlink($tmp);throw new RuntimeException('REDFLAG_LIVE_WRITE');}
        if(rfsCached($category,$id,$date)!==$text)throw new RuntimeException('REDFLAG_LIVE_READBACK');
        return $text;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function rfsEnsurePaidResource(string $resource): string {
    $p=rfsParsePaid('redflag_question',$resource);if($p===null)throw new InvalidArgumentException('INVALID_REDFLAG_RESOURCE');return rfsEnsure(...$p);
}
function rfsMaterialFromCache(string $resource): array {
    $p=rfsParsePaid('redflag_question',$resource);if($p===null)throw new RuntimeException('MATERIAL_NOT_READY');
    [$c,$id,$date]=$p;$a=rfsCached($c,$id,$date);if($a===null)throw new RuntimeException('MATERIAL_NOT_READY');
    $t=rfsQuestion($c,$id)['title'];return ['title'=>$t,'sections'=>[['title'=>$t,'paragraphs'=>explode("\n\n",$a)]],'links'=>[],'pdf_available'=>false];
}
function rfsPermitFree(string $category,string $id,string $date,?array $account): string {
    if($id!==rfsFreeId($category)||!rfsDate($date))throw new InvalidArgumentException('INVALID_FREE_QUESTION');
    $a=rfsCached($category,$id,$date);if($a!==null)return $a;
    if($account!==null&&naTestOwner($account))return rfsEnsure($category,$id,$date);
    $identity=$account['id']??('ip:'.($_SERVER['REMOTE_ADDR']??''));
    $file=rfsCacheDir().'/free-'.hash('sha256',$category.'|'.gmdate('Ymd').'|'.$identity).'.quota';
    $l=@fopen($file,'c+');if($l===false)throw new RuntimeException('FREE_QUOTA_UNAVAILABLE');
    try{if(!flock($l,LOCK_EX))throw new RuntimeException('FREE_QUOTA_UNAVAILABLE');
        rewind($l);$used=trim((string)stream_get_contents($l));if($used!==''&&$used!==$date)throw new RuntimeException('FREE_DAILY_LIMIT');
        $a=rfsEnsure($category,$id,$date);rewind($l);ftruncate($l,0);fwrite($l,$date);fflush($l);return $a;
    }finally{flock($l,LOCK_UN);fclose($l);}
}
