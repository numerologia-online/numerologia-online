<?php
declare(strict_types=1);
/** Isolated owner-only Intimacy question-specific engine; existing production untouched. */
require_once __DIR__.'/intimacy-live.php';
function ipQuestionIds(): array {return ['fire','her-pleasure','pace','desire-talk','tenderness','boundaries','closeness','initiative','compatibility','after'];}
function ipQuestions(): array {
    $data=json_decode((string)file_get_contents(__DIR__.'/intimacy-live-questions.json'),true,20,JSON_THROW_ON_ERROR);
    if(($data['id']??null)!=='intimacy'||count($data['questions']??[])!==10
       ||array_column($data['questions'],'id')!==ipQuestionIds())
        throw new RuntimeException('INTIMACY_PRACTICAL_QUESTIONS_INVALID');
    return $data['questions'];
}
function ipKnowledge(): array {
    static $all=null;
    if($all!==null)return $all;
    $raw=@file_get_contents(__DIR__.'/intimacy-practical-knowledge.txt');
    if(!is_string($raw)||mb_strlen($raw,'UTF-8')>16000)
        throw new RuntimeException('INTIMACY_PRACTICAL_KB_UNAVAILABLE');
    $lines=preg_split('/\R/u',trim($raw));
    if(!is_array($lines)||count($lines)!==23)
        throw new RuntimeException('INTIMACY_PRACTICAL_KB_22_INVALID');
    $ids=ipQuestionIds();
    if(array_shift($lines)!=='energy|'.implode('|',$ids))
        throw new RuntimeException('INTIMACY_PRACTICAL_KB_COLUMNS_INVALID');
    $found=[];
    foreach($lines as $line){
        $parts=explode('|',$line);
        $num=array_shift($parts);
        if(count($parts)!==count($ids)||!ctype_digit($num))
            throw new RuntimeException('INTIMACY_PRACTICAL_KB_ENTRY_INVALID');
        $number=(int)$num;
        if($number<1||$number>22||isset($found[$number]))
            throw new RuntimeException('INTIMACY_PRACTICAL_KB_NUMBER_INVALID');
        $values=array_map('trim',$parts);
        foreach($values as $v)if($v===''||mb_strlen($v,'UTF-8')>160)
            throw new RuntimeException('INTIMACY_PRACTICAL_KB_KEY_INVALID');
        $found[$number]=array_combine($ids,$values);
    }
    for($i=1;$i<=22;$i++)if(!isset($found[$i]))
        throw new RuntimeException('INTIMACY_PRACTICAL_KB_INCOMPLETE');
    return $all=$found;
}
function ipPointMap(string $id): array {
    $themes=[
      'fire'=>'loveHeart',
      'her-pleasure'=>'center',
      'pace'=>'tailSecond',
      'desire-talk'=>'topLeft',
      'tenderness'=>'bottom',
      'boundaries'=>'tailFirst',
      'closeness'=>'bottomLeft',
      'initiative'=>'rightNear',
      'compatibility'=>'wellbeing',
      'after'=>'bottomRight'
    ];
    if(!isset($themes[$id]))throw new RuntimeException('INTIMACY_PRACTICAL_POINT_MAP_MISSING');
    return ['left','top','right',$themes[$id]];
}
function ipPointTitles(): array {
    return [
      'left'=>'День рождения: привычная манера проявляться',
      'top'=>'Месяц рождения: потребности и эмоциональные мотивы',
      'right'=>'Год рождения: стиль действий',
      'loveHeart'=>'Близость и партнёрство',
      'center'=>'Базовая реакция личности',
      'tailSecond'=>'Повторяющаяся привычка и её изменение',
      'topLeft'=>'Соединение исходных мотивов',
      'bottom'=>'Устойчивость и взросление',
      'tailFirst'=>'Сценарии отношений',
      'bottomLeft'=>'Эмоциональные привычки',
      'rightNear'=>'Воплощение инициативы в действия',
      'wellbeing'=>'Устойчивый ритм отношений',
      'bottomRight'=>'Поведение в практических ситуациях'
    ];
}
function ipQuestionFocus(string $id): string {
    $focus=[
      'fire'=>'Ответь именно про манеру проявлять темперамент в отдельном эпизоде близости: быстрое или постепенное возбуждение, спешка или неторопливость, интенсивность. Не повторяй ответ о внимательности к женщине или интересе спустя месяцы. Не предсказывай реальную длительность, физиологическую выносливость или сексуальную функцию по дате.',
      'her-pleasure'=>'Ответь только о взаимности: замечает ли её обратную связь, готов ли менять свой сценарий, или больше занят собственной оценкой. Отличай искреннее внимание от желания получить похвалу. Не описывай частоту секса, длительность и темперамент.',
      'pace'=>'Ответь про устойчивость интереса со временем: что может поддерживать желание и что способно охладить его в длительном союзе. Различай новизну, эмоциональный контакт, однообразие и поиск признания. Не пересказывай темп отдельного эпизода и не объявляй человека изменщиком.',
      'desire-talk'=>'Ответь именно про то, как выражает желание, насколько прямо может говорить о предпочтениях и несовпадении темпераментов. Отличай способность обсуждать от интенсивности влечения. Не предсказывай сексуальную функцию.',
      'tenderness'=>'Ответь о нежности отдельно от страсти: проявляет ли спокойную ласку, тепло, физическую близость вне сексуального контекста. Не путай интенсивное желание с нежностью, не обещай реальные поступки.',
      'boundaries'=>'Ответь о реакции на отказ, остановку или несовпадение желаний. Покажи отличие уважительной реакции, обиды, попытки уговорить и давления; согласие должно быть свободным и его можно отозвать в любой момент. Не смягчай и не превращай принуждение в шутку. Не утверждай насилие как факт по дате.',
      'closeness'=>'Ответь о возможном мотиве близости: эмоциональная связь, удовольствие, признание, контроль или подтверждение самооценки. Не подменяй мотив техникой, частотой и длительностью, не делай заключение о любви как доказанном факте.',
      'initiative'=>'Ответь о том, кто проявляет инициативу, кто предлагает время и обстановку, умеет ли согласовать её с женщиной или ожидает от неё организации. Не путай инициативность с напором и не описывай физические подробности.',
      'compatibility'=>'Ответь про возможный ритм желания в повседневных отношениях: регулярность, колебания, условия и несовпадение с партнёршей. Не повторяй манеру отдельного контакта. Не обещай конкретную частоту и не диагностируй либидо по дате.',
      'after'=>'Ответь о поведении после близости: стремление к контакту, разговору, ласке, уединению или переключению. Различай желание пространства и потерю интереса. Не обещай привязанность, верность или исчезновение как неизбежный результат.'
    ];
    if(!isset($focus[$id]))throw new RuntimeException('INTIMACY_PRACTICAL_FOCUS_INVALID');
    return $focus[$id];
}
function ipFollowups(string $id): array {
    $m=[
      'fire'=>[['Язык любви мужчины','Язык любви - как понять по поступкам, что у него есть чувства?'],['Итоговый вердикт','Чем он способен порадовать в любви?']],
      'her-pleasure'=>[['Любовь и отношения','Умеет любить или только позволяет себя любить?'],['Семья и быт','Он заботится в быту или ждёт, что любовь всё сама устроит?']],
      'pace'=>[['Любовь и отношения','Способен быть с одной женщиной или его тянет в любовные треугольники?'],['Измены и флирт','Уходит навсегда или возвращается ко всем бывшим?']],
      'desire-talk'=>[['Язык любви мужчины','Как не промахнуться с ним в конфликте?'],['Красные флаги','С ним спокойно или тебя ждут эмоциональные качели?']],
      'tenderness'=>[['Язык любви мужчины','Какая поддержка для него правда работает?'],['Итоговый вердикт','Какой формат отношений с ним будет самым здоровым?']],
      'boundaries'=>[['Красные флаги','Какой тревожный сигнал нельзя пропустить в начале знакомства?'],['Красные флаги','После ссоры извинится или виноватой сделает тебя?']],
      'closeness'=>[['Деньги и щедрость','Будет ли мужчина жить за твой счёт?'],['Красные флаги','Какая его слабость может разрушить ваши отношения?']],
      'initiative'=>[['Семья и быт','Умеет ли он создавать опору для дома, а не только говорить о будущем?'],['Красные флаги','Будет твоей опорой или сам доведёт до слёз?']],
      'compatibility'=>[['Язык любви мужчины','Что его ранит сильнее всего в отношениях?'],['Итоговый вердикт','Как понять, что пора выбрать себя, а не ждать его?']],
      'after'=>[['Любовь и отношения','Почему он исчезает без объяснений?'],['Измены и флирт','Говорит о себе правду или скрывает половину своей жизни?']]
    ];
    if(!isset($m[$id]))throw new RuntimeException('INTIMACY_PRACTICAL_FOLLOWUPS_MISSING');
    return array_map(static fn(array $v):array=>['раздел'=>$v[0],'вопрос'=>$v[1]],$m[$id]);
}
function ipPrompt(): string {
    return <<<'PROMPT'
Ты наблюдательная, умная, дерзкая подруга и знаешь авторскую систему Матрицы судьбы. Раздел «Секс и близость» для взрослых. Отвечай только на открытый вопрос, не составляй общий портрет.

СМЫСЛ. Соедини день и месяц как равноправную основу. Год уточняет проявление, четвёртая позиция уточняет вопрос. Не перечисляй позиции, не считай плюсы, не пересчитывай матрицу. При противоречии найди совместимое проявление, не позволяй одной дополнительной черте перечеркнуть основу. Избирательность не означает медлительность; азарт не означает короткую близость; желание восхищения может сочетаться с вниманием к женщине. Не путай темперамент, регулярность, интерес со временем, взаимность, нежность, инициативу и границы. Учитывай точную задачу вопроса. Не выдумывай факты, минуты, физиологические возможности, измену, насилие или любовь по дате. Это символическая трактовка возможного поведения. Не подменяй её диагнозом или обещанием.

ТОН. Пиши как женщина женщине за чашкой чая: прямо, живо, немного ехидно, с обычными словами и конкретными житейскими наблюдениями. Первая фраза сразу отвечает. Дальше одна-две бытовые детали, которые раскрывают смысл. Например, про человека, любящего распорядок, можно сказать: «Если любишь, когда всё по расписанию, кажется, вы нашли друг друга». Это пример интонации, не шаблон. Не надо придумывать шутку в каждом ответе. Не начинай с «этот мужчина, воплощение…», не украшай каждую фразу метафорами, не пиши про марафоны, шоу, двигатели, пьедесталы, резонанс и триумф. Не повторяй один вывод разными словами. Не льсти и не назначай мужчине обязательный недостаток. Не делай женщину ответственной за его верность, настроение или желание. Отказ обязателен к уважению, согласие свободное и взаимное; не шути о давлении и не советуй терпеть его. Не выдавай возможную теневую реакцию за неизбежность.

ФОРМАТ. Ровно два абзаца. Первый примерно 500–700 знаков, без воды, с конкретным ответом и живой деталью. Второй примерно 150–200 знаков: естественная зацепка и точное название одного из переданных вопросов другого раздела. Если передан приоритетный вопрос «Измены и флирт», выбирай его, но не объявляй измену фактом и не подменяй им основной ответ. Не повторяй первый абзац и не отвечай на новый вопрос. Без заголовков, списка, Markdown, длинных тире, двоеточий, смайликов, названий энергий, цифр расчёта, дат, цен и упоминаний ИИ. Пиши о поведении и желаниях без графических описаний.
PROMPT;
}
function ipFollowupsForMatrix(string $id,array $matrix): array {
    $base=ipFollowups($id);
    // A core fifteenth-energy tendency may invite a separate look at fidelity;
    // a single auxiliary position is not enough to imply it.
    if($matrix['left']!==15&&$matrix['top']!==15)return $base;
    $title=in_array($id,['pace','after','compatibility','closeness'],true)
        ?'Уходит навсегда или возвращается ко всем бывшим?'
        :'Говорит о себе правду или скрывает половину своей жизни?';
    $priority=['раздел'=>'Измены и флирт','вопрос'=>$title];
    foreach($base as $item)if($item['вопрос']!==$title)return [$priority,$item];
    return $base;
}
function ipMessages(array $question,int $day,int $month,int $year): array {
    $id=$question['id'];
    if(!checkdate($month,$day,$year))throw new InvalidArgumentException('INTIMACY_PRACTICAL_INVALID_DATE');
    if(!niAdultBirthDate(sprintf('%04d-%02d-%02d',$year,$month,$day)))throw new InvalidArgumentException('INTIMACY_AGE_RESTRICTED');
    $matrix=ni31($day,$month,$year);
    $titles=ipPointTitles();
    $knowledge=ipKnowledge();
    $selected=[];
    foreach(ipPointMap($id) as $i=>$point){
        if(!isset($matrix[$point],$titles[$point],$knowledge[$matrix[$point]]))
            throw new RuntimeException('INTIMACY_PRACTICAL_POINT_MISSING');
        $key=$knowledge[$matrix[$point]][$id];
        $selected[]=['роль'=>$titles[$point],
            'смысловой_ключ'=>$key,
            'назначение'=>$i===3?'Тематическое уточнение именно этого вопроса':'Смысловой ключ по этому же вопросу'];
    }
    $payload=json_encode([
      'вопрос'=>$question['title'],
      'точная_задача'=>ipQuestionFocus($id),
      'четыре_значимые_позиции'=>$selected,
      'два_вопроса_для_подводки'=>ipFollowupsForMatrix($id,$matrix),
      'приоритетная_подводка'=>($matrix['left']===15||$matrix['top']===15)?'Первый предложенный вопрос раздела Измены и флирт; не делать вывод о факте измены':null
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    return [['role'=>'system','content'=>ipPrompt()],['role'=>'user','content'=>$payload]];
}
function ipFormatAnswer(string $text,string $id,?array $offered=null): string {
    $text=niValidateGeneratedText($text,'stop');
    $paragraphs=explode("\n\n",$text);
    $first=trim(preg_replace('/[ \t]*[—–―][ \t]*/u',', ',$paragraphs[0])??$paragraphs[0]);
    $second=trim(preg_replace('/[ \t]*[—–―][ \t]*/u',', ',$paragraphs[1])??$paragraphs[1]);
    // Verify exact title without adding a second paid request. If a title was
    // omitted, supply one permitted continuation; do not invent a purchase link.
    $follow=$offered??ipFollowups($id);
    $found=false;
    foreach($follow as $item)if(mb_stripos($second,$item['вопрос'],0,'UTF-8')!==false){$found=true;break;}
    if(!$found)$second.=' Ещё один интересный вопрос: '.$follow[0]['вопрос'];
    $out=niValidateGeneratedText($first."\n\n".$second,'stop');
    if(mb_strlen($out,'UTF-8')>1800)throw new RuntimeException('INTIMACY_PRACTICAL_TEXT_TOO_LONG');
    return $out;
}
function ipGenerateText(array $question,int $day,int $month,int $year): string {
    // One request through the existing Cloud.ru Gemini transport; no fallback,
    // automatic retries or ready-made answers.
    $messages=ipMessages($question,$day,$month,$year);
    $payload=json_decode($messages[1]['content'],true,30,JSON_THROW_ON_ERROR);
    $text=niCloudCall($messages,2800,'google/gemini-3-flash-preview');
    return ipFormatAnswer($text,$question['id'],$payload['два_вопроса_для_подводки']);
}
