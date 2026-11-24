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
      'fire'=>[['Измены и флирт','Верный или у него каждая вторая «просто подруга»?'],['Деньги и щедрость','Щедрый мужчина или считает каждую копейку?'],['Семья и быт','Обещает и делает или просто король планов?']],
      'her-pleasure'=>[['Деньги и щедрость','Щедрый мужчина или считает каждую копейку?'],['Семья и быт','Он заботится в быту или ждёт, что любовь всё сама устроит?'],['Язык любви мужчины','Как он реагирует на критику и неудобную правду?']],
      'pace'=>[['Измены и флирт','Верный или у него каждая вторая «просто подруга»?'],['Семья и быт','При первых семейных проблемах будет бороться или соберёт чемодан?'],['Деньги и щедрость','Держит слово или опять одни красивые разговоры?']],
      'desire-talk'=>[['Язык любви мужчины','Как он реагирует на критику и неудобную правду?'],['Деньги и щедрость','Держит слово или опять одни красивые разговоры?'],['Семья и быт','Будет партнёром или начальником в семье?']],
      'tenderness'=>[['Семья и быт','Он заботится в быту или ждёт, что любовь всё сама устроит?'],['Деньги и щедрость','Будет красиво ухаживать или максимум кофе и прогулка?'],['Измены и флирт','Верный или у него каждая вторая «просто подруга»?']],
      'boundaries'=>[['Язык любви мужчины','Как он реагирует на критику и неудобную правду?'],['Семья и быт','Будет партнёром или начальником в семье?'],['Деньги и щедрость','Будет опорой для семьи или всё снова окажется на твоих плечах?']],
      'closeness'=>[['Измены и флирт','Верный или у него каждая вторая «просто подруга»?'],['Деньги и щедрость','Будет ли мужчина жить за твой счёт?'],['Семья и быт','Семья для него главное или дома его не дождёшься?']],
      'initiative'=>[['Деньги и щедрость','Будет красиво ухаживать или максимум кофе и прогулка?'],['Семья и быт','Самостоятельный мужчина или мамина корзиночка?'],['Деньги и щедрость','Будет опорой для семьи или всё снова окажется на твоих плечах?']],
      'compatibility'=>[['Семья и быт','Семья для него главное или дома его не дождёшься?'],['Деньги и щедрость','Будет опорой для семьи или всё снова окажется на твоих плечах?'],['Измены и флирт','Верный или у него каждая вторая «просто подруга»?']],
      'after'=>[['Язык любви мужчины','Язык любви - как понять по поступкам, что у него есть чувства?'],['Измены и флирт','Верный или у него каждая вторая «просто подруга»?'],['Семья и быт','При первых семейных проблемах будет бороться или соберёт чемодан?']],
    ];
    if(!isset($m[$id]))throw new RuntimeException('INTIMACY_PRACTICAL_FOLLOWUPS_MISSING');
    return array_map(static fn(array $v):array=>['раздел'=>$v[0],'вопрос'=>$v[1]],$m[$id]);
}
function ipPrompt(): string {
    return <<<'PROMPT'
Ты нумеролог и близкая подруга женщины. Отвечаешь на один вопрос раздела «Секс и близость» (18+) так, как две взрослые женщины обсуждают нового мужчину за чашкой кофе. Говори с читательницей на «ты».

СИНТЕЗ. Расчёт готов. Соедини день и месяц на равных, год и четвёртую позицию используй для уточнения. Все четыре смысловых ключа относятся к этому вопросу. Не перечисляй их. Сделай один конкретный вывод по вопросу. Это символическая трактовка возможных склонностей, не знание реальных поступков или интимной жизни мужчины.

ЧЕСТНОСТЬ. Говори о хороших и неприятных сторонах только тогда, когда они следуют из ключей. Не превращай инициативу в давление, а давление в достоинство. Не обещай сексуальных способностей, длительности, верности или чувств по дате. Отказ и просьбу остановиться необходимо уважать.

ПЕРВАЯ ФРАЗА. Сразу дай конкретный ответ на заданный вопрос обычными словами. Дальше покажи, что именно женщина может заметить, услышать или увидеть в интимных отношениях. Не повторяй вопрос и не начинай с общего портрета.

СТИЛЬ. Ты умная, сексуально раскрепощённая, дерзкая подруга с острым языком и чувством юмора. Ты не стесняешься говорить о сексе, мужских желаниях, привычках и слабостях. Пиши откровенно, пикантно, местами ехидно, с женской иронией. Не сглаживай неудобную правду. Если сочетание указывает на привлекательные качества, скажи об этом с удовольствием. Если есть над чем посмеяться, не упускай возможность. Разоблачай через конкретные поступки, желания и возможные реакции. Используй обычные слова, которыми взрослые женщины обсуждают мужчин между собой. Не используй пафос, литературные метафоры, психологические лекции и искусственные сравнения. Юмор должен рождаться из индивидуальной трактовки, а не из готовых шуток. Не выдумывай недостатки ради эффектности. Женщине должно быть интересно заглянуть за внешнее впечатление о мужчине. Каждую трактовку пиши с нуля, без заготовок и повторяющихся речевых сценариев. Обсуждай интимные отношения без графических подробностей.

ФОРМАТ. Два абзаца. Первый 550–750 знаков: ответ, один-два конкретных проявления и короткий живой вывод. Второй 220–300 знаков: продолжи разговор подруг, добавь новую любопытную мысль о том, что ещё стоило бы проверить в этом мужчине вне спальни. Выбери по смыслу ОДИН из предложенных вопросов о верности, щедрости, ответственности или другой подходящей теме. Объясни, почему тебе захотелось бы это выяснить, не отвечая на следующий вопрос. Заверши точным названием выбранного вопроса, один раз. Формулируй подводку каждый раз своими словами, без обязательной одинаковой фразы. Не повторяй вопрос заранее и не приписывай измены ради интриги. Без заголовков, списков, названий энергий, дат и упоминаний ИИ.
PROMPT;
}
function ipFollowupsForMatrix(string $id,array $matrix): array {
    return ipFollowups($id);
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
      'вопросы_для_подводки'=>ipFollowupsForMatrix($id,$matrix)
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    return [['role'=>'system','content'=>ipPrompt()],['role'=>'user','content'=>$payload]];
}
function ipFormatAnswer(string $text,string $id,?array $offered=null): string {
    $text=niValidateGeneratedText($text,'stop');
    $paragraphs=explode("\n\n",$text);
    $first=trim(preg_replace('/[ \t]*[—–―][ \t]*/u',', ',$paragraphs[0])??$paragraphs[0]);
    $second=trim(preg_replace('/[ \t]*[—–―][ \t]*/u',', ',$paragraphs[1])??$paragraphs[1]);
    // Recognize indirect questions too, then render the selected title once.
    $follow=$offered??ipFollowups($id);
    $normalize=static function(string $v): string {
        $v=mb_strtolower(str_replace(['ё','Ё'],['е','Е'],$v),'UTF-8');
        $v=preg_replace('/[^\p{L}\p{N}]+/u',' ',$v)??$v;
        $v=preg_replace('/\b(?:ли|он)\b/u',' ',$v)??$v;
        return trim(preg_replace('/\s+/u',' ',$v)??$v);
    };
    $sentences=preg_split('/(?<=[.!?])\s+/u',$second,-1,PREG_SPLIT_NO_EMPTY)?:[$second];
    $selected=null;$bridge=[];
    foreach($sentences as $sentence){
        $match=null;
        foreach($follow as $item){
            if(str_contains($normalize($sentence),$normalize($item['вопрос']))){$match=$item;break;}
        }
        if($match!==null){if($selected===null)$selected=$match;continue;}
        $bridge[]=$sentence;
    }
    $selected=$selected??$follow[0];
    $second=trim(implode(' ',$bridge).' '.$selected['вопрос']);
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
    return ipFormatAnswer($text,$question['id'],$payload['вопросы_для_подводки']);
}
