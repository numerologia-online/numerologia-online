<?php
declare(strict_types=1);
/**
 * Family and household: native Gemini 3 Flash with NO interpretive 22-arcana bank.
 * Reuses the approved private Cloud.ru transport, 31-point arithmetic and validation.
 */
require_once __DIR__.'/intimacy-live.php';

function nfQuestionIds(): array {
    return ['independent','household','vacation','plans','children','roles','home','conflict','money-at-home','care'];
}
function nfQuestions(): array {
    $path=__DIR__.'/family-live-questions.json';
    $data=json_decode((string)file_get_contents($path),true,20,JSON_THROW_ON_ERROR);
    if(($data['id']??null)!=='family'||count($data['questions']??[])!==10)
        throw new RuntimeException('FAMILY_QUESTIONS_UNAVAILABLE');
    if(array_column($data['questions'],'id')!==nfQuestionIds())
        throw new RuntimeException('FAMILY_QUESTION_IDS_INVALID');
    return $data['questions'];
}
function nfSupportedPaidResource(string $code,string $resource): bool {
    if($code!=='redflag_question' || preg_match('/^redflag:family:([a-z-]+):((?:19|20)\d\d-\d\d-\d\d)$/D',$resource,$m)!==1)
        return false;
    return $m[1]!=='independent'&&in_array($m[1],nfQuestionIds(),true)&&naCatalogDate($m[2])!==null;
}
function nfEngineInstalled(): bool {
    if(!is_file(__DIR__.'/family-live.php') || !is_file(__DIR__.'/family-live-questions.json')
       || !is_file(__DIR__.'/family-live-followups.json') || !is_file(__DIR__.'/intimacy-live-config.php'))
        return false;
    $config=require __DIR__.'/intimacy-live-config.php';
    return is_array($config)&&is_string($config['cloudru_key']??null)
       &&strlen($config['cloudru_key'])>12;
}
function nfPointTitles(): array {
    return [
      'left'=>'День рождения: как проявляется в обычной жизни',
      'top'=>'Месяц рождения: привычные стремления и потребности',
      'right'=>'Год рождения: стиль действий и решений',
      'bottom'=>'Задачи взросления и ответственности',
      'center'=>'Центр личности: базовая реакция',
      'topLeft'=>'Соединение дня и месяца',
      'topRight'=>'Соединение месяца и года',
      'bottomRight'=>'Практическое действие в сложных обстоятельствах',
      'bottomLeft'=>'Эмоциональные привычки',
      'loveHeart'=>'Как строит близкий союз',
      'tailFirst'=>'Повторяющийся сценарий в отношениях',
      'tailSecond'=>'Как меняет старые привычки',
      'moneyPoint'=>'Деньги, практическая устойчивость',
      'wellbeing'=>'Баланс повседневной жизни',
      'rightNear'=>'Воплощение решений в действия'
    ];
}
function nfQuestionPoints(string $id): array {
    $maps=[
      'independent'=>['left','top','center','right','tailFirst','bottom'],
      'household'=>['left','top','center','bottom','rightNear','moneyPoint'],
      'vacation'=>['left','top','center','tailFirst','topLeft','bottomLeft'],
      'plans'=>['left','top','right','center','bottomRight','tailSecond'],
      'children'=>['left','top','loveHeart','center','bottom','tailFirst'],
      'roles'=>['left','top','center','loveHeart','right','bottomLeft'],
      'home'=>['left','top','loveHeart','center','bottom','tailFirst'],
      'conflict'=>['left','top','center','tailFirst','tailSecond','bottom'],
      'money-at-home'=>['left','top','right','moneyPoint','center','bottomRight'],
      'care'=>['left','top','center','loveHeart','bottomLeft','rightNear']
    ];
    if(!isset($maps[$id]))throw new RuntimeException('FAMILY_QUESTION_MAP_MISSING');
    return $maps[$id];
}
function nfGenerateText(array $question,int $day,int $month,int $year): string {
    $id=$question['id'];
    $matrix=ni31($day,$month,$year);
    $titles=nfPointTitles();
    $selected=[];
    foreach(nfQuestionPoints($id) as $key){
        if(!isset($matrix[$key],$titles[$key]))throw new RuntimeException('FAMILY_MATRIX_POINT_MISSING');
        $selected[]=['роль'=>$titles[$key],'число_аркана'=>$matrix[$key]];
    }
    $raw=json_decode((string)file_get_contents(__DIR__.'/family-live-followups.json'),true,20,JSON_THROW_ON_ERROR);
    if(($raw['version']??null)!==1||count($raw['questions']??[])<65)
        throw new RuntimeException('FAMILY_FOLLOWUPS_UNAVAILABLE');
    $followups=[];
    foreach(nfQuestions() as $q){
        if($q['id']!==$id&&!($q['isFree']??false))
            $followups[]=['раздел'=>'Семья и быт','вопрос'=>$q['title'],'тип'=>'платный'];
    }
    foreach($raw['questions'] as $next){
        if(($next['раздел']??null)==='Семья и быт'&&($next['вопрос']??null)===$question['title'])continue;
        $followups[]=$next;
    }
    $unique=[];
    foreach($followups as $option){
        if(!is_string($option['раздел']??null)||!is_string($option['вопрос']??null))continue;
        $unique[$option['раздел'].'|'.$option['вопрос']]=$option;
    }
    $followups=array_values($unique);
    if(count($followups)<65)throw new RuntimeException('FAMILY_FOLLOWUPS_NOT_READY');
    $system=<<<'PROMPT'
Ты опытный нумеролог, работающий с Матрицей судьбы по системе 22 Старших арканов. Ты говоришь с женщиной о конкретном мужчине. Раздел «Семья и быт»: взрослость, домашние дела, самостоятельность, дети, ответственность, деньги семьи, совместные решения и поведение в трудностях. Отвечай на ОДИН вопрос, а не составляй общий гороскоп или характеристику всей его жизни.

Эксперимент БЕЗ НАШЕЙ БАЗЫ ТРАКТОВОК. Сайт уже математически рассчитал 31 позицию Матрицы судьбы из полной даты рождения. Тебе даны рассчитанные номера и смысл ролей наиболее важных для этого вопроса точек. САМОСТОЯТЕЛЬНО интерпретируй их в привычной системе 22 арканов: 8 это Справедливость, 11 это Сила, 22 это Шут. Никаких готовых авторских характеристик тебе не передано. Не пересчитывай и не изменяй числа; не смешивай с астрологией, жизненным путём из другой школы, MBTI и психологической диагностикой. Сначала сопоставь минимум три точки. ОБЯЗАТЕЛЬНО учитывай И ДЕНЬ, И МЕСЯЦ рождения как равноправные исходные влияния, а остальные точки используй для уточнения: почему он именно так действует. Выбери одну ведущую склонность; не выдавай шаблонный компромисс «может так, а может иначе». Не делай одинаковые выводы для разных дат и разных вопросов.

СТИЛЬ. Пиши как близкая умная подруга, которая видит суть и умеет говорить простым живым языком. Уверенно, наблюдательно, слегка дерзко, иногда с тонкой иронией и бытовым юмором, но не грубо и не зло. Твой ответ должен вызывать узнавание: «Вот это мой муж!», «Вот почему он так делает» или «Как хорошо, что я это узнала». Понятные бытовые поступки сильнее абстрактных черт. Не превращай текст в торжественную речь, литературный рассказ, рекламу или нравоучение. Запрещены завуалированные формулы «его пространство смыслов», «динамика системы», «внутренний ресурс», «путь осознанности», «он проживает сценарий». Говори по-человечески: кто закупает продукты, моет посуду, договаривается, выполняет обещания, не сбегает от трудных решений, участвует в заботе о ребёнке. Но эти примеры не надо перечислять механически, выбирай только действительно относящееся к вопросу.

С ПЕРВОЙ ФРАЗЫ прямо ответь на сформулированный вопрос. Назови два-три РАЗНЫХ и конкретных проявления именно этой склонности. Если мужчина способен поддерживать семью, решать вопросы и быть равноправным партнёром, скажи это ясно, без обязательного подвоха. Если ждёт обслуживания, обещает вместо действий, перекладывает ответственность или пытается командовать, называй это точно и без смягчений. Нельзя превращать любое неудобство в тяжёлую патологию, приписывать ему реальные поступки, объявлять гарантированную измену или делать выводы об истинной пригодности человека к родительству. Нумерология описывает символические склонности, а не доказанные события. Не обвиняй женщину в поступках мужчины и не оправдывай нарушение границ.

ФОРМАТ. Ровно два русских абзаца, всего ориентировочно 850–1100 знаков. Первый примерно 680–850: конкретный ответ и узнаваемые поступки без повторов. Второй примерно 150–230: естественный, остроумный и интригующий переход к ОДНОМУ другому платному вопросу из списка. Лучше вопрос из другого раздела, который раскрывает новую, действительно связанную сторону мужчины; допускается вопрос из «Семья и быт». В конце второго абзаца напиши название выбранного вопроса ТОЧНО по списку. Не пересказывай название вместо подводки и не отвечай заранее на следующий вопрос. Не используй штампы «а теперь давай узнаем», «проверь ещё», «следующий вопрос», «не менее интересно». Не обещай, что вопрос уже опубликован или доступен прямо сейчас.

КЛИЕНТУ НЕЛЬЗЯ ПОКАЗЫВАТЬ даты, номера, названия арканов, энергию, матрицу, методику, технические точки и расчёты. Никаких заголовков, списков, Markdown, эмодзи. Не используй длинные или средние тире «—», «–», «―». Верни только готовый русский текст в двух абзацах.
PROMPT;
    $payload=json_encode([
      'вопрос'=>$question['title'],
      'важные_числовые_точки_для_данного_вопроса'=>$selected,
      'полная_рассчитанная_матрица_для_контекста'=>$matrix,
      'точные_названия_для_перехода'=>$followups
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $text=niCloudCall([['role'=>'system','content'=>$system],['role'=>'user','content'=>$payload]],2800,'google/gemini-3-flash-preview');
    $text=preg_replace('/[ \t]*[—–―][ \t]*/u',': ',$text)??$text;
    $text=preg_replace('/:[ \t]*:/u',':',$text)??$text;
    return preg_replace('/[ \t]{2,}/u',' ',$text)??$text;
}
function nfCacheDirectory(): string {
    $path=__DIR__.'/family-answer-cache';
    if(!is_dir($path)&&!@mkdir($path,0700,true)&&!is_dir($path))
        throw new RuntimeException('FAMILY_CACHE_UNAVAILABLE');
    return $path;
}
function nfCacheFile(string $id,string $date): string {
    if(!in_array($id,nfQuestionIds(),true)||naCatalogDate($date)===null)
        throw new InvalidArgumentException('FAMILY_INVALID_REQUEST');
    return nfCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).'-nokb-v1.json';
}
function nfCachedAnswer(string $id,string $date): ?string {
    $path=nfCacheFile($id,$date);
    if(!is_file($path))return null;
    $raw=file_get_contents($path);
    if(!is_string($raw)||strlen($raw)>12000)return null;
    $v=json_decode($raw,true);
    $answer=is_array($v)&&($v['version']??null)===1
        &&($v['question']??null)===$id&&($v['date']??null)===$date ? ($v['answer']??null):null;
    return is_string($answer)&&mb_strlen($answer,'UTF-8')>=450?$answer:null;
}
function nfEnsureAnswer(string $id,string $date): string {
    if(!nfEngineInstalled())throw new RuntimeException('FAMILY_ENGINE_UNAVAILABLE');
    $existing=nfCachedAnswer($id,$date);
    if($existing!==null)return $existing;
    $path=nfCacheFile($id,$date);
    $lock=@fopen($path.'.lock','c');
    if($lock===false)throw new RuntimeException('FAMILY_LOCK_UNAVAILABLE');
    try {
        if(!flock($lock,LOCK_EX))throw new RuntimeException('FAMILY_LOCK_UNAVAILABLE');
        $existing=nfCachedAnswer($id,$date);
        if($existing!==null)return $existing;
        $q=null;
        foreach(nfQuestions() as $candidate)if($candidate['id']===$id){$q=$candidate;break;}
        if($q===null)throw new RuntimeException('FAMILY_QUESTION_NOT_FOUND');
        [$y,$m,$d]=array_map('intval',explode('-',$date));
        $text=nfGenerateText($q,$d,$m,$y);
        $text=niValidateGeneratedText($text,'stop');
        if(mb_strlen($text,'UTF-8')>1800)throw new RuntimeException('FAMILY_TEXT_TOO_LONG');
        $blob=json_encode(['version'=>1,'question'=>$id,'date'=>$date,'answer'=>$text],
            JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
        $tmp=$path.'.'.bin2hex(random_bytes(6)).'.tmp';
        if(file_put_contents($tmp,$blob,LOCK_EX)===false)throw new RuntimeException('FAMILY_CACHE_WRITE_FAILED');
        @chmod($tmp,0600);
        if(!rename($tmp,$path)){@unlink($tmp);throw new RuntimeException('FAMILY_CACHE_WRITE_FAILED');}
        return $text;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function nfEnsurePaidResource(string $resource): string {
    if(!nfSupportedPaidResource('redflag_question',$resource))
        throw new InvalidArgumentException('INVALID_FAMILY_RESOURCE');
    if(!preg_match('/^redflag:family:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m))
        throw new RuntimeException('FAMILY_RESOURCE_INVALID');
    return nfEnsureAnswer($m[1],$m[2]);
}
function nfMaterialFromCache(string $resource): array {
    if(!nfSupportedPaidResource('redflag_question',$resource))
        throw new RuntimeException('MATERIAL_NOT_READY');
    preg_match('/^redflag:family:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m);
    $answer=nfCachedAnswer($m[1],$m[2]);
    if($answer===null)throw new RuntimeException('MATERIAL_NOT_READY');
    $title='';
    foreach(nfQuestions() as $q)if($q['id']===$m[1]){$title=$q['title'];break;}
    return ['title'=>$title,'sections'=>[['title'=>$title,
        'paragraphs'=>preg_split('/\n\s*\n/u',$answer)]],
        'links'=>[],'pdf_available'=>false];
}
function nfPermitFree(string $date,?array $owner,callable $generate): string {
    if($owner!==null&&naTestOwner($owner))return $generate();
    $cached=nfCachedAnswer('independent',$date);
    if($cached!==null)return $cached;
    $day=gmdate('Ymd');
    $addr=(string)($_SERVER['REMOTE_ADDR']??'');
    $hash=hash('sha256',$day.'|'.$addr.'|family-free-nokb-v1');
    $path=nfCacheDirectory().'/free-'.$hash.'.quota';
    $handle=@fopen($path,'c+');
    if($handle===false)throw new RuntimeException('FREE_RATE_LIMIT_STORAGE_UNAVAILABLE');
    try {
        if(!flock($handle,LOCK_EX))throw new RuntimeException('FREE_RATE_LIMIT_STORAGE_UNAVAILABLE');
        rewind($handle);$existing=trim((string)stream_get_contents($handle));
        if($existing!==''&&$existing!==$date)throw new RuntimeException('FREE_DAILY_LIMIT');
        $answer=$generate();
        rewind($handle);ftruncate($handle,0);fwrite($handle,$date);fflush($handle);
        return $answer;
    }finally{flock($handle,LOCK_UN);fclose($handle);}
}
