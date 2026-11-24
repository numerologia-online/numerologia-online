<?php
declare(strict_types=1);
/**
 * Native production Gemini 3 Flash for "Языки любви мужчины".
 * Independent language prompt; reuses the existing Cloud.ru transport and
 * 31-point arithmetic. Only day, month, year and a topical point reach Gemini.
 * No requests to the provider except user-initiated free/owner/buy generation.
 */
require_once __DIR__.'/intimacy-live.php';

function nlQuestionIds(): array {
    return ['love-language','how-to-talk','accept-love','show-love','criticism','ask',
            'distance','hurt','conflict-style','compliment'];
}
function nlQuestions(): array {
    $data=json_decode((string)file_get_contents(__DIR__.'/language-live-questions.json'),true,20,JSON_THROW_ON_ERROR);
    if(($data['id']??null)!=='language'||count($data['questions']??[])!==10
       ||array_column($data['questions'],'id')!==nlQuestionIds())
        throw new RuntimeException('LANGUAGE_QUESTIONS_INVALID');
    return $data['questions'];
}
function nlSupportedPaidResource(string $code,string $resource): bool {
    if($code!=='redflag_question'
       ||preg_match('/^redflag:language:([a-z-]+):((?:19|20)\d\d-\d\d-\d\d)$/D',$resource,$m)!==1)
        return false;
    return $m[1]!=='love-language'&&in_array($m[1],nlQuestionIds(),true)
        &&naCatalogDate($m[2])!==null;
}
function nlEngineInstalled(): bool {
    if(!is_file(__DIR__.'/language-live-questions.json')
       ||!is_file(__DIR__.'/language-live-knowledge.txt')
       ||!is_file(__DIR__.'/intimacy-live.php')
       ||!is_file(__DIR__.'/intimacy-live-config.php'))return false;
    $cfg=require __DIR__.'/intimacy-live-config.php';
    return is_array($cfg)&&is_string($cfg['cloudru_key']??null)
        &&strlen($cfg['cloudru_key'])>12;
}
function nlKnowledge(): array {
    static $all=null;
    if($all!==null)return $all;
    $raw=@file_get_contents(__DIR__.'/language-live-knowledge.txt');
    if(!is_string($raw)||mb_strlen($raw,'UTF-8')>5000)
        throw new RuntimeException('LANGUAGE_KB_UNAVAILABLE');
    $lines=preg_split('/\R/u',trim($raw));
    if(!is_array($lines)||count($lines)!==22)
        throw new RuntimeException('LANGUAGE_KB_22_INVALID');
    $found=[];
    foreach($lines as $line){
        $parts=explode('|',$line);
        if(count($parts)!==4||!ctype_digit(trim($parts[0]))
           ||trim($parts[1])===''||trim($parts[2])===''||trim($parts[3])==='')
            throw new RuntimeException('LANGUAGE_KB_ENTRY_INVALID');
        $number=(int)$parts[0];
        if($number<1||$number>22||isset($found[$number]))
            throw new RuntimeException('LANGUAGE_KB_NUMBER_INVALID');
        $found[$number]=['core'=>trim($parts[1]),'plus'=>trim($parts[2]),'minus'=>trim($parts[3])];
    }
    for($i=1;$i<=22;$i++)if(!isset($found[$i]))
        throw new RuntimeException('LANGUAGE_KB_INCOMPLETE');
    return $all=$found;
}
function nlPointMap(string $id): array {
    // Three stable birth-date positions plus ONE topical aspect.
    // Use the established matrix arithmetic; do not assign weights or recount.
    $themes=[
      'love-language'=>'loveHeart',
      'how-to-talk'=>'center',
      'accept-love'=>'bottomLeft',
      'show-love'=>'rightNear',
      'criticism'=>'bottomRight',
      'ask'=>'topLeft',
      'distance'=>'tailFirst',
      'hurt'=>'tailSecond',
      'conflict-style'=>'bottom',
      'compliment'=>'topRight'
    ];
    if(!isset($themes[$id]))throw new RuntimeException('LANGUAGE_POINT_MAP_MISSING');
    return ['left','top','right',$themes[$id]];
}
function nlPointTitles(): array {
    return [
      'left'=>'День рождения: привычная манера проявляться',
      'top'=>'Месяц рождения: потребности и эмоциональные мотивы',
      'right'=>'Год рождения: стиль действий и решений',
      'loveHeart'=>'Отношение к близкому союзу',
      'center'=>'Базовая реакция личности',
      'bottomLeft'=>'Эмоциональные привычки',
      'rightNear'=>'Воплощение решений в действия',
      'bottomRight'=>'Практическое действие в сложных обстоятельствах',
      'topLeft'=>'Соединение характера и потребностей',
      'tailFirst'=>'Повторяющийся сценарий в отношениях',
      'tailSecond'=>'Способ изменения прежних привычек',
      'bottom'=>'Задачи взросления и ответственности',
      'topRight'=>'Соединение потребностей и способа действия'
    ];
}
function nlQuestionFocus(string $id): string {
    $focus=[
      'love-language'=>'С первой фразы назови конкретный главный способ, через который он скорее почувствует любовь, а при необходимости второй, дополняющий. Объясни, какие действия женщины дадут ему ощущение близости и какой знак внимания может пройти мимо. Не своди все даты к стандартным пяти категориям и не перечисляй их.',
      'how-to-talk'=>'Начни с инструкции, КАК с ним разговаривать: с чего начать, какой тон и форма разговора подходят. Дай одну конкретную короткую реплику женщины, объясни вероятную реакцию на неё и на неподходящий подход. Не описывай общий характер.',
      'accept-love'=>'Начни с конкретного проявления заботы, которое он скорее оценит. Раскрой, как отличить желанную заботу от лишней опеки, когда он отвечает теплом, когда может отстраниться. Подскажи одно посильное действие, не требующее угождать.',
      'show-love'=>'Сразу назови, по какому конкретному повторяющемуся поведению можно заметить его привязанность. Различай инициативу, внимание, уважение и привлекательные слова. Не выдавай отдельный жест или расчёт за доказательство чувств. Ответ именно о его действиях, не инструкция, как его завоевать.',
      'criticism'=>'Начни с вероятной первой реакции на критику, затем покажи, что он может сделать после неё. Объясни, при каком способе обратной связи легче обсудить проблему, а при каком разговор может зайти в тупик. Дай одну естественную реплику о конкретном замечании. Не оправдывай оскорбления.',
      'ask'=>'Сразу объясни, в какой форме ему проще понять просьбу и договориться о действии. Дай одну живую фразу с конкретной просьбой; объясни, на какую реакцию рассчитывать и что мешает услышать просьбу. Не своди любой ответ к приказам или похвале и не советуй хитрить.',
      'distance'=>'Начни с того, что можно сделать, когда он отдаляется. Различи потребность в паузе и повторяющийся отказ от общения. Предложи один конкретный способ выйти на разговор без преследования, и объясни, как оценить отклик. Не обещай, что он обязательно вернётся.',
      'hurt'=>'Сразу назови, какая форма слов или поведения может особенно задеть его и почему. Объясни, как это можно заметить по реакции, и как обсуждать то же разногласие без намеренного унижения. Не заставляй женщину обходить каждую его эмоцию.',
      'conflict-style'=>'С первой фразы предложи понятную тактику разрешения разногласия именно для этого сочетания. Покажи порядок действий: начало разговора, реакция при напряжении, возвращение к теме. Укажи границу, за которой диалог прекращают ради безопасности. Не обещай, что удачная фраза исправит чужое поведение.',
      'compliment'=>'Назови конкретную форму поддержки, которую он скорее заметит: слова, внимание, практическое участие, время или пространство по смыслу сочетания. Объясни, что поддерживает его и что может звучать фальшиво. Приведи короткую естественную фразу или действие, не требуя восхищаться им.'
    ];
    if(!isset($focus[$id]))throw new RuntimeException('LANGUAGE_FOCUS_INVALID');
    return $focus[$id];
}
function nlFollowups(string $id): array {
    // Distinct 49-ruble topics from other sections. Select for semantic fit,
    // not by a fixed date hash. These are editorial titles, not checkout promises.
    $m=[
      'love-language'=>[
        ['Любовь и отношения','Умеет любить или только позволяет себя любить?'],
        ['Секс и близость','После секса привязывается или теряет интерес?']],
      'how-to-talk'=>[
        ['Красные флаги','После ссоры извинится или виноватой сделает тебя?'],
        ['Итоговый вердикт','Какой формат отношений с ним будет самым здоровым?']],
      'accept-love'=>[
        ['Красные флаги','Будет твоей опорой или сам доведёт до слёз?'],
        ['Итоговый вердикт','Чем он способен порадовать в любви?']],
      'show-love'=>[
        ['Измены и флирт','Говорит о себе правду или скрывает половину своей жизни?'],
        ['Семья и быт','Он заботится в быту или ждёт, что любовь всё сама устроит?']],
      'criticism'=>[
        ['Красные флаги','Какая его слабость может разрушить ваши отношения?'],
        ['Красные флаги','С ним спокойно или тебя ждут эмоциональные качели?']],
      'ask'=>[
        ['Секс и близость','Он внимательный инициатор или ждёт, что женщина всё организует сама?'],
        ['Деньги и щедрость','Будет ли мужчина жить за твой счёт?']],
      'distance'=>[
        ['Любовь и отношения','Почему он исчезает без объяснений?'],
        ['Измены и флирт','Уходит навсегда или возвращается ко всем бывшим?']],
      'hurt'=>[
        ['Красные флаги','Какой тревожный сигнал нельзя пропустить в начале знакомства?'],
        ['Итоговый вердикт','Как понять, что пора выбрать себя, а не ждать его?']],
      'conflict-style'=>[
        ['Семья и быт','При первых семейных проблемах будет бороться или соберёт чемодан?'],
        ['Измены и флирт','Если поймаешь на измене, признается или сделает виноватой тебя?']],
      'compliment'=>[
        ['Деньги и щедрость','Есть ли у него потенциал стать богатым мужчиной?'],
        ['Семья и быт','Умеет ли он создавать опору для дома, а не только говорить о будущем?']]
    ];
    if(!isset($m[$id]))throw new RuntimeException('LANGUAGE_FOLLOWUPS_MISSING');
    return array_map(static fn(array $v):array=>['раздел'=>$v[0],'вопрос'=>$v[1]],$m[$id]);
}
function nlPrompt(): string {
    return <<<'PROMPT'
Ты опытный нумеролог Матрицы судьбы и очень наблюдательная, остроумная подруга. Раздел «Язык любви мужчины» существует для практической пользы: женщина открыла конкретный вопрос и хочет получить понятный ответ, а не красивый психологический портрет. Пиши только об ОДНОЙ заданной теме. Не рассказывай обо всей личности, судьбе и отношениях. Это символические склонности, а не установленные факты о реальном мужчине.

КАК ДУМАТЬ. Полная матрица уже рассчитана сайтом. Ты получаешь только словесные характеристики четырёх значимых позиций: день раскрывает манеру поведения, месяц раскрывает потребности, год помогает понять способ действия. Последняя позиция уточняет именно тему вопроса. День и месяц обязательны в синтезе, год и тематическая позиция могут существенно изменить вывод. Сопоставь их, чтобы выбрать один ведущий способ общения, реакцию или действие по теме, а затем конкретные нюансы. Не пересчитывай значения, не вводи проценты, не подсчитывай плюсы и минусы и не перечисляй четыре характеристики в тексте. Повтор одного значения в разных позициях не означает четыре независимых доказательства. Не превращай теневые качества в обязательный сценарий. Если вывод благоприятный, так и скажи, не выдумывай подвох. Разные вопросы к одной дате должны различаться предметом ответа; разные сочетания могут менять саму инструкцию, а не только слова.

КАК ОТВЕЧАТЬ. Самая первая фраза отвечает на вопрос: конкретный способ говорить, просьба, форма заботы, реакция или поведение. Затем объясни, как это выглядит на практике. Если женщина спрашивает «как», дай ей понятную, выполнимую инструкцию: что сказать или сделать, когда и в какой форме, какой отклик может последовать, как заметить, что подход не работает. Если спрашивает «как он реагирует» или «что его ранит», сначала назови его вероятную реакцию, а уже потом полезный способ разговора. Если спрашивает «по каким поступкам понять», говори именно о поступках. Не выдавай гипотезу за уже случившийся факт. По необходимости вплети одну-две короткие естественные реплики, которые можно сказать вслух в конкретной ситуации; придумывай их по смыслу сочетания, не используй универсальный шаблон для всех дат. Не превращай рекомендацию в манипуляцию мужчиной, не перекладывай ответственность за его давление, оскорбления или молчание на женщину. Отказ, границы и собственные потребности женщины важны.

ЯЗЫК. Пиши будто близкая умная подруга объясняет что-то за кофе. Нормальный современный разговорный русский, короткие и средние предложения, ясные глаголы, понятные слова. Можно остро, смешно, тепло или неожиданно, если это рождается из наблюдения, а не из обязательной шутки. Не делай театральное разоблачение из любого характера. Честный прямой вывод, без завуалированности, моралей, комплиментов ради комплиментов и литературных украшений. Не начинай с вступления и не заканчивай общим «важно наладить диалог». Не повторяй одну мысль под разными метафорами. Не используй «в глубине души», «ключ к его сердцу», «зеркало его души», «сложный внутренний мир», «танец двух душ», «этот мужчина представляет собой». Не вставляй в каждую трактовку одно и то же предупреждение или одинаковое вступление. Обычная человеческая фраза лучше умной абстракции.

ФОРМАТ. Ровно два абзаца на русском. Первый ориентировочно 700–950 знаков, раскрывает конкретный ответ и практический смысл. Второй ориентировочно 150–230 знаков, меняет угол и естественно подводит к ОДНОМУ из двух предложенных вопросов другого раздела. Выбери его по связи с первым абзацем, не отвечай на него заранее, закончи точным названием вопроса. Не обещай его доступность для покупки и не упоминай цену. Если ответ уже полноценный, не растягивай его ради знаков. Без заголовков, списков, Markdown, смайликов, длинных тире, названий арканов, цифр расчёта, дат рождения и упоминаний ИИ. Только готовый живой текст.
PROMPT;
}
function nlMessages(array $question,int $day,int $month,int $year): array {
    $id=$question['id'];
    if(!checkdate($month,$day,$year))throw new InvalidArgumentException('LANGUAGE_INVALID_DATE');
    $matrix=ni31($day,$month,$year);
    $titles=nlPointTitles();
    $knowledge=nlKnowledge();
    $selected=[];
    foreach(nlPointMap($id) as $i=>$point){
        if(!isset($matrix[$point],$titles[$point],$knowledge[$matrix[$point]]))
            throw new RuntimeException('LANGUAGE_POINT_MISSING');
        $traits=$knowledge[$matrix[$point]];
        $selected[]=['роль'=>$titles[$point],
            'значение'=>$traits['core'],'ресурс'=>$traits['plus'],'тень'=>$traits['minus'],
            'назначение'=>$i===3?'Тематическое уточнение именно этого вопроса':'Исходная характеристика'];
    }
    $payload=json_encode([
      'вопрос'=>$question['title'],
      'точная_задача'=>nlQuestionFocus($id),
      'четыре_значимые_позиции'=>$selected,
      'два_вопроса_для_подводки'=>nlFollowups($id)
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    return [['role'=>'system','content'=>nlPrompt()],['role'=>'user','content'=>$payload]];
}
function nlFormatAnswer(string $text,string $id): string {
    $text=niValidateGeneratedText($text,'stop');
    $paragraphs=explode("\n\n",$text);
    $first=trim(preg_replace('/[ \t]*[—–―][ \t]*/u',', ',$paragraphs[0])??$paragraphs[0]);
    $second=trim(preg_replace('/[ \t]*[—–―][ \t]*/u',', ',$paragraphs[1])??$paragraphs[1]);
    // Verify exact title without adding a second paid request. If a title was
    // omitted, supply one permitted continuation; do not invent a purchase link.
    $follow=nlFollowups($id);
    $found=false;
    foreach($follow as $item)if(mb_stripos($second,$item['вопрос'],0,'UTF-8')!==false){$found=true;break;}
    if(!$found)$second.=' Ещё один интересный вопрос: '.$follow[0]['вопрос'];
    $out=niValidateGeneratedText($first."\n\n".$second,'stop');
    if(mb_strlen($out,'UTF-8')>1800)throw new RuntimeException('LANGUAGE_TEXT_TOO_LONG');
    return $out;
}
function nlGenerateText(array $question,int $day,int $month,int $year): string {
    // One request through the existing Cloud.ru Gemini transport; no fallback,
    // automatic retries, Family dependencies or ready-made answers.
    $text=niCloudCall(nlMessages($question,$day,$month,$year),2800,'google/gemini-3-flash-preview');
    return nlFormatAnswer($text,$question['id']);
}
function nlFreshAnswer(string $id,string $date): string {
    if(!nlEngineInstalled())throw new RuntimeException('LANGUAGE_ENGINE_UNAVAILABLE');
    if(!in_array($id,nlQuestionIds(),true)||naCatalogDate($date)===null)
        throw new InvalidArgumentException('LANGUAGE_INVALID_REQUEST');
    $question=null;
    foreach(nlQuestions() as $q)if($q['id']===$id){$question=$q;break;}
    if($question===null)throw new RuntimeException('LANGUAGE_QUESTION_NOT_FOUND');
    [$year,$month,$day]=array_map('intval',explode('-',$date));
    try {
        return nlGenerateText($question,$day,$month,$year);
    }catch(Throwable $e){
        $reason=$e instanceof RuntimeException?$e->getMessage():get_class($e);
        if(!is_string($reason)||preg_match('/\A[A-Z][A-Z0-9_]{2,79}\z/D',$reason)!==1)
            $reason='LANGUAGE_UNEXPECTED';
        error_log('LANGUAGE_RESULT_FAIL question='.$id.' reason='.$reason);
        throw $e;
    }
}
function nlOwnerMaterial(string $resource): array {
    if(!nlSupportedPaidResource('redflag_question',$resource))
        throw new InvalidArgumentException('INVALID_LANGUAGE_RESOURCE');
    if(!preg_match('/^redflag:language:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m))
        throw new RuntimeException('LANGUAGE_RESOURCE_INVALID');
    $answer=nlFreshAnswer($m[1],$m[2]);
    $title='';
    foreach(nlQuestions() as $q)if($q['id']===$m[1]){$title=$q['title'];break;}
    return ['title'=>$title,'sections'=>[['title'=>$title,
        'paragraphs'=>preg_split('/\n\s*\n/u',$answer)]],'links'=>[],'pdf_available'=>false];
}
function nlCacheDirectory(): string {
    $p=__DIR__.'/language-answer-cache';
    if(!is_dir($p)&&!@mkdir($p,0700,true)&&!is_dir($p))
        throw new RuntimeException('LANGUAGE_CACHE_UNAVAILABLE');
    return $p;
}
function nlCacheFile(string $id,string $date): string {
    if(!in_array($id,nlQuestionIds(),true)||naCatalogDate($date)===null)
        throw new InvalidArgumentException('LANGUAGE_INVALID_REQUEST');
    return nlCacheDirectory().'/'.$id.'-'.str_replace('-','',$date).($id==='love-language'?'-language-instruction-v2.json':'-language-kb-v1.json');
}
function nlCachedAnswer(string $id,string $date): ?string {
    $path=nlCacheFile($id,$date);
    if(!is_file($path))return null;
    $raw=file_get_contents($path);
    if(!is_string($raw)||strlen($raw)>12000)return null;
    $json=json_decode($raw,true);
    $answer=is_array($json)&&($json['version']??null)===1
        &&($json['question']??null)===$id&&($json['date']??null)===$date
        ?($json['answer']??null):null;
    return is_string($answer)&&mb_strlen($answer,'UTF-8')>=450?$answer:null;
}
function nlEnsureAnswer(string $id,string $date): string {
    if(!nlEngineInstalled())throw new RuntimeException('LANGUAGE_ENGINE_UNAVAILABLE');
    $cached=nlCachedAnswer($id,$date);
    if($cached!==null)return $cached;
    $path=nlCacheFile($id,$date);
    $lock=@fopen($path.'.lock','c');
    if($lock===false)throw new RuntimeException('LANGUAGE_LOCK_UNAVAILABLE');
    try {
        if(!flock($lock,LOCK_EX))throw new RuntimeException('LANGUAGE_LOCK_UNAVAILABLE');
        $cached=nlCachedAnswer($id,$date);
        if($cached!==null)return $cached;
        $text=nlFreshAnswer($id,$date);
        $json=json_encode(['version'=>1,'question'=>$id,'date'=>$date,'answer'=>$text],
            JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
        $tmp=$path.'.'.bin2hex(random_bytes(6)).'.tmp';
        if(file_put_contents($tmp,$json,LOCK_EX)===false)
            throw new RuntimeException('LANGUAGE_CACHE_WRITE_FAILED');
        @chmod($tmp,0600);
        if(!rename($tmp,$path)){@unlink($tmp);throw new RuntimeException('LANGUAGE_CACHE_WRITE_FAILED');}
        return $text;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function nlEnsurePaidResource(string $resource): string {
    if(!nlSupportedPaidResource('redflag_question',$resource))
        throw new InvalidArgumentException('INVALID_LANGUAGE_RESOURCE');
    if(!preg_match('/^redflag:language:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m))
        throw new RuntimeException('LANGUAGE_RESOURCE_INVALID');
    return nlEnsureAnswer($m[1],$m[2]);
}
function nlMaterialFromCache(string $resource): array {
    if(!nlSupportedPaidResource('redflag_question',$resource))
        throw new RuntimeException('MATERIAL_NOT_READY');
    preg_match('/^redflag:language:([a-z-]+):(\d{4}-\d\d-\d\d)$/D',$resource,$m);
    $answer=nlCachedAnswer($m[1],$m[2]);
    if($answer===null)throw new RuntimeException('MATERIAL_NOT_READY');
    $title='';
    foreach(nlQuestions() as $q)if($q['id']===$m[1]){$title=$q['title'];break;}
    return ['title'=>$title,'sections'=>[['title'=>$title,
        'paragraphs'=>preg_split('/\n\s*\n/u',$answer)]],
        'links'=>[],'pdf_available'=>false];
}
function nlPermitFree(string $date,?array $owner,callable $generate): string {
    if($owner!==null&&naTestOwner($owner))return $generate();
    $cached=nlCachedAnswer('love-language',$date);
    if($cached!==null)return $cached;
    $stamp=gmdate('Ymd');
    $addr=(string)($_SERVER['REMOTE_ADDR']??'');
    $hash=hash('sha256',$stamp.'|'.$addr.'|language-free-v1');
    $path=nlCacheDirectory().'/free-'.$hash.'.quota';
    $handle=@fopen($path,'c+');
    if($handle===false)throw new RuntimeException('FREE_RATE_LIMIT_STORAGE_UNAVAILABLE');
    try {
        if(!flock($handle,LOCK_EX))throw new RuntimeException('FREE_RATE_LIMIT_STORAGE_UNAVAILABLE');
        rewind($handle);$old=trim((string)stream_get_contents($handle));
        if($old!==''&&$old!==$date)throw new RuntimeException('FREE_DAILY_LIMIT');
        $answer=$generate();
        rewind($handle);ftruncate($handle,0);fwrite($handle,$date);fflush($handle);
        return $answer;
    }finally{flock($handle,LOCK_UN);fclose($handle);}
}
