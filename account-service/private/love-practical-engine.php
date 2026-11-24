<?php
declare(strict_types=1);
/** Independent verdict question-specific four-point engine. Owner preview first. */
require_once __DIR__.'/intimacy-live.php';
function lvpQuestionIds(): array { return ['first-step','romance','relationship-or-comfort','adult-partner','near-him','hard-moment','relationship-format','family-or-triangle','honest-or-disappear','love-or-attention']; }
function lvpQuestions(): array {
    $data=json_decode((string)file_get_contents(__DIR__.'/love-live-questions.json'),true,20,JSON_THROW_ON_ERROR);
    if(($data['id']??null)!=='love'||count($data['questions']??[])!==10
       ||array_column($data['questions'],'id')!==lvpQuestionIds())
        throw new RuntimeException('LOVE_PRACTICAL_QUESTIONS_INVALID');
    return $data['questions'];
}
function lvpKnowledge(): array {
    static $all=null;
    if($all!==null)return $all;
    $raw=@file_get_contents(__DIR__.'/love-practical-knowledge.txt');
    if(!is_string($raw)||mb_strlen($raw,'UTF-8')>36000)
        throw new RuntimeException('LOVE_PRACTICAL_KB_UNAVAILABLE');
    $lines=preg_split('/\R/u',trim($raw));
    if(!is_array($lines)||count($lines)!==23)
        throw new RuntimeException('LOVE_PRACTICAL_KB_22_INVALID');
    $ids=lvpQuestionIds();
    if(array_shift($lines)!=='energy|'.implode('|',$ids))
        throw new RuntimeException('LOVE_PRACTICAL_KB_COLUMNS_INVALID');
    $found=[];
    foreach($lines as $line){
        $parts=explode('|',$line);
        $num=array_shift($parts);
        if(count($parts)!==count($ids)||!ctype_digit($num))
            throw new RuntimeException('LOVE_PRACTICAL_KB_ENTRY_INVALID');
        $number=(int)$num;
        if($number<1||$number>22||isset($found[$number]))
            throw new RuntimeException('LOVE_PRACTICAL_KB_NUMBER_INVALID');
        $values=array_map('trim',$parts);
        foreach($values as $v)if($v===''||mb_strlen($v,'UTF-8')>160)
            throw new RuntimeException('LOVE_PRACTICAL_KB_KEY_INVALID');
        $found[$number]=array_combine($ids,$values);
    }
    for($i=1;$i<=22;$i++)if(!isset($found[$i]))
        throw new RuntimeException('LOVE_PRACTICAL_KB_INCOMPLETE');
    return $all=$found;
}
function lvpPointMap(string $id): array {
    $themes=[
      'first-step'=>'leftNear',
      'romance'=>'rightNear',
      'relationship-or-comfort'=>'loveHeart',
      'adult-partner'=>'bottomRight',
      'near-him'=>'bottomLeft',
      'hard-moment'=>'tailFirst',
      'relationship-format'=>'wellbeing',
      'family-or-triangle'=>'topRight',
      'honest-or-disappear'=>'tailSecond',
      'love-or-attention'=>'center',
    ];
    if(!isset($themes[$id]))throw new RuntimeException('LOVE_POINT_MAP_MISSING');
    return ['left','top','right',$themes[$id]];
}
function lvpPointTitles(): array { return [
      'left'=>'День рождения: привычная манера проявляться',
      'top'=>'Месяц рождения: потребности и эмоциональные мотивы',
      'right'=>'Год рождения: стиль действий и решений',
      'leftNear'=>'Способ проявлять инициативу',
      'rightNear'=>'Переход намерений в поступки',
      'loveHeart'=>'Отношение к близкому союзу',
      'bottomRight'=>'Ответственность в совместной жизни',
      'bottomLeft'=>'Влияние эмоциональных привычек на партнёршу',
      'tailFirst'=>'Поведение в повторяющихся трудностях',
      'wellbeing'=>'Устойчивость общего уклада',
      'topRight'=>'Соотношение желания и решений',
      'tailSecond'=>'Привычная реакция на неприятные ситуации',
      'center'=>'Базовое проявление личности',
    ]; }
function lvpQuestionFocus(string $id): string {
    $focus=[
      'first-step'=>'Начинает знакомство сам или ждёт ответного сигнала; различай переписку, реальное приглашение и дальнейшую инициативу.',
      'romance'=>'Романтика в действиях, переписке, частной или публичной жизни; покажи конкретный жест и его постоянство, не своди к деньгам.',
      'relationship-or-comfort'=>'Нужна ли ему личность женщины или комфорт, восхищение и обслуживание; различай взаимность и одностороннюю выгоду.',
      'adult-partner'=>'Готовность к взрослой семейной ответственности, рутине и договорённостям; не своди зрелость к заработку и не заменяй вопрос портретом отца.',
      'near-him'=>'Как его поступки влияют на её уверенность, развитие, самостоятельные цели и ощущение себя; не обещай предрешённого результата.',
      'hard-moment'=>'Что делает в конкретной беде, какой вид помощи даёт и остаётся ли в длительной трудности; не смешивай эмоциональную и практическую поддержку.',
      'relationship-format'=>'Переходит ли от желания семьи к конкретным решениям, включает ли партнёршу в реальную жизнь, уважает ли общие обязательства.',
      'family-or-triangle'=>'Различай верность, открытое общение, флирт, незавершённую прошлую связь и тайный роман; не объявляй измену фактом по дате.',
      'honest-or-disappear'=>'Какая возможная причина отдаления и как она проявляется; различай личное пространство, занятость, страх, избегание ответственности и давление, не оправдывай исчезновение.',
      'love-or-attention'=>'Различай влюблённость, желание быть любимым и реальную заботу, сохраняющуюся в будни; покажи конкретную взаимность без обязательной лести.',
    ];
    if(!isset($focus[$id]))throw new RuntimeException('LOVE_FOCUS_INVALID');return $focus[$id];
}
function lvpFollowups(string $id): array {
    $m=[
      'first-step'=>[['Деньги и щедрость','Будет красиво ухаживать или максимум кофе и прогулка?'],['Язык любви мужчины','Язык любви - как понять по поступкам, что у него есть чувства?']],
      'romance'=>[['Деньги и щедрость','Будет дарить подарки или даже цветы придётся выпрашивать?'],['Язык любви мужчины','На каком языке любви он вообще понимает чувства?']],
      'relationship-or-comfort'=>[['Деньги и щедрость','Будет ли мужчина жить за твой счёт?'],['Итоговый вердикт','Какой формат отношений с ним будет самым здоровым?']],
      'adult-partner'=>[['Деньги и щедрость','Будет опорой для семьи или всё снова окажется на твоих плечах?'],['Деньги и щедрость','Держит слово или опять одни красивые разговоры?']],
      'near-him'=>[['Итоговый вердикт','Какой главный совет женщине рядом с ним?'],['Язык любви мужчины','Как он реагирует на критику и неудобную правду?']],
      'hard-moment'=>[['Деньги и щедрость','Будет опорой для семьи или всё снова окажется на твоих плечах?'],['Язык любви мужчины','Язык любви - как понять по поступкам, что у него есть чувства?']],
      'relationship-format'=>[['Деньги и щедрость','Держит слово или опять одни красивые разговоры?'],['Итоговый вердикт','Какой формат отношений с ним будет самым здоровым?']],
      'family-or-triangle'=>[['Секс и близость','Близость для любви или для самоутверждения?'],['Язык любви мужчины','Как с ним говорить, чтобы не биться в стену?']],
      'honest-or-disappear'=>[['Язык любви мужчины','Что делать, когда он отдаляется?'],['Итоговый вердикт','Его ещё проверять поступками или уже всё понятно?']],
      'love-or-attention'=>[['Язык любви мужчины','Язык любви - как понять по поступкам, что у него есть чувства?'],['Секс и близость','Способен к нежности или для него важна только искра?']],
    ];
    if(!isset($m[$id]))throw new RuntimeException('LOVE_FOLLOWUPS_MISSING');return array_map(static fn(array $v):array=>['раздел'=>$v[0],'вопрос'=>$v[1]],$m[$id]);
}
function lvpPrompt(): string {
    return <<<'PROMPT'
Ты опытный нумеролог Матрицы судьбы и очень наблюдательная, умная подруга. Раздел «Любовь и отношения». Женщина открыла ОДИН конкретный вопрос. Тебе нужно ответить именно на него, как в живом разговоре о знакомстве, свиданиях и отношениях, а не описывать весь характер мужчины.

СИНТЕЗ. Расчёт уже выполнен. Переданы четыре позиции с авторскими смысловыми ключами к ЭТОМУ вопросу: день описывает привычную манеру проявляться, месяц раскрывает потребности и эмоциональные мотивы, год уточняет действия, четвёртая позиция относится именно к вопросу. Сопоставь день и месяц на равных, ни один не должен подменять другой. Затем проверь, как год и тематическая позиция меняют вывод. Не назначай веса, не считай плюсы и минусы, не пересчитывай матрицу. Соедини четыре смысла в одну конкретную индивидуальную трактовку; не перечисляй ключи по очереди. Повтор числа не является независимым доказательством. Не подменяй тематические ключи общими значениями арканов. Это символическое толкование возможных склонностей, а не установленные факты о человеке.

ЧЕСТНОСТЬ. Не льсти и не объявляй мужчину виноватым заранее. Не переименовывай контроль в заботу, инфантильность в лёгкость, холодность в глубину, высокомерие в силу. Но не превращай любое проявление энергии в проблему. Мягкость не равна слабости, общительность не равна измене, страсть не равна манипуляции, свобода не равна безответственности, подарки не равны любви. Уважай взаимность и самостоятельность обоих. Не оправдывай давление, двойные стандарты, невыполненные обещания; не советуй женщине заслуживать уважение или играть в недоступность. Если есть реальная приятная сторона, покажи её через конкретное действие; не вставляй искусственное достоинство или недостаток для баланса. Описывай неприятный сценарий как возможный, а не неизбежный. Не диагностируй и не предсказывай измены, расставание или насилие как факт по дате.

ПЕРВАЯ ФРАЗА. Сразу ответь на заданный вопрос, с учётом сочетания. Для инициативы различай первое сообщение и встречу; для романтики — красивое впечатление и живое внимание; для зрелости — намерение и повседневную ответственность; для верности — дружбу, флирт и тайные отношения; для исчезновения — возможную причину и наблюдаемый поступок. Не превращай все вопросы в одну историю о контроле или эмоциональных качелях. Покажи один-два узнаваемых бытовых примера или реплику, если она раскрывает именно это сочетание. Не выдумывай биографию и реальные события. Для разных дат меняй действия, мотивы и ситуации, а не только синонимы. Не повторяй формулы старых ответов механически.

СТИЛЬ. Как умная, наблюдательная, дерзкая подруга с опытом отношений, которая говорит по существу, иногда с лёгкой иронией, но без искусственного юмора. Обращайся на «ты». Живой современный русский. Называй чувства и желания простыми естественными словами, не заменяй их искусственными выражениями. Без пафоса, литературных метафор, психологической терминологии, лести и нравоучений. Не называй женщину виноватой за чужие поступки. Не используй «ключ к его сердцу», «в глубине души», «сложный внутренний мир», «танец двух душ», «физический драйв», «этот мужчина представляет собой». Не дублируй одну мысль разными словами.

ФОРМАТ. Ровно два абзаца. Первый ориентировочно 700–950 знаков, прямой ответ, конкретный живой разбор по заданному вопросу. Второй ориентировочно 220–300 знаков: самостоятельная тематическая зацепка, естественный переход к ОДНОМУ из двух переданных вопросов другого раздела, точное название вопроса. Не повторяй основной ответ, не отвечай на новый вопрос, не называй цену. Без заголовков, списков, Markdown, смайликов, длинных тире, названий арканов, цифр расчёта, дат рождения и упоминаний ИИ. Только готовый русский текст.
PROMPT;
}
function lvpMessages(array $question,int $day,int $month,int $year): array {
    $id=$question['id'];
    if(!checkdate($month,$day,$year))throw new InvalidArgumentException('LOVE_PRACTICAL_INVALID_DATE');
    $matrix=ni31($day,$month,$year);
    $titles=lvpPointTitles();
    $knowledge=lvpKnowledge();
    $selected=[];
    foreach(lvpPointMap($id) as $i=>$point){
        if(!isset($matrix[$point],$titles[$point],$knowledge[$matrix[$point]]))
            throw new RuntimeException('LOVE_PRACTICAL_POINT_MISSING');
        $key=$knowledge[$matrix[$point]][$id];
        $selected[]=['роль'=>$titles[$point],
            'смысловой_ключ'=>$key,
            'назначение'=>$i===3?'Тематическое уточнение именно этого вопроса':'Смысловой ключ по этому же вопросу'];
    }
    $payload=json_encode([
      'вопрос'=>$question['title'],
      'точная_задача'=>lvpQuestionFocus($id),
      'четыре_значимые_позиции'=>$selected,
      'два_вопроса_для_подводки'=>lvpFollowups($id)
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    return [['role'=>'system','content'=>lvpPrompt()],['role'=>'user','content'=>$payload]];
}
function lvpFormatAnswer(string $text,string $id): string {
    $text=niValidateGeneratedText($text,'stop');
    $paragraphs=explode("\n\n",$text);
    $first=trim(preg_replace('/[ \t]*[—–―][ \t]*/u',', ',$paragraphs[0])??$paragraphs[0]);
    $second=trim(preg_replace('/[ \t]*[—–―][ \t]*/u',', ',$paragraphs[1])??$paragraphs[1]);
    // Verify exact title without adding a second paid request. If a title was
    // omitted, supply one permitted continuation; do not invent a purchase link.
    $follow=lvpFollowups($id);
    $found=false;
    foreach($follow as $item)if(mb_stripos($second,$item['вопрос'],0,'UTF-8')!==false){$found=true;break;}
    if(!$found)$second.=' Ещё я бы посмотрела «'.$follow[0]['вопрос'].'».';
    $out=niValidateGeneratedText($first."\n\n".$second,'stop');
    if(mb_strlen($out,'UTF-8')>1800)throw new RuntimeException('LOVE_PRACTICAL_TEXT_TOO_LONG');
    return $out;
}
function lvpGenerateText(array $question,int $day,int $month,int $year): string {
    // One request through the existing Cloud.ru Gemini transport; no fallback,
    // automatic retries or ready-made answers.
    $text=niCloudCall(lvpMessages($question,$day,$month,$year),2800,'google/gemini-3-flash-preview');
    return lvpFormatAnswer($text,$question['id']);
}
