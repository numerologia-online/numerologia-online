<?php
declare(strict_types=1);
require_once __DIR__.'/flags-fidelity-live.php';
function fcvKeys(): array {
    $data=json_decode((string)file_get_contents(__DIR__.'/flags-comic-verdict.json'),true,20,JSON_THROW_ON_ERROR);
    $keys=$data['keys']??null;
    if(($data['question_id']??null)!=='comic-verdict-flags'||!is_array($keys)||array_keys($keys)!==range(1,22)||count(array_unique($keys))!==22)throw new RuntimeException('FLAGS_COMIC_KEYS_INVALID');
    foreach($keys as $key)if(!is_string($key)||trim($key)===''||mb_strlen($key,'UTF-8')>190)throw new RuntimeException('FLAGS_COMIC_KEY_INVALID');
    return $keys;
}
function fcvPrompt(): string {
    return <<<'PROMPT'
Ты беспощадно остроумная подруга с талантом женского стендапа. Это отдельный шуточный вердикт раздела «Красные флаги», а не дополнение к обычным ответам. Весь текст является прожаркой. Из переданных юмористических подсказок и смысловых теней собери одну цельную сцену об отношениях: эгоцентризм, контроль под видом заботы, ревность, обиды, непризнание ошибок, эмоциональные качели или другие конкретные привычки, которые действительно следуют из сочетания. День и месяц равноправны; год, центр и точка партнёрства уточняют реакцию. Не пересчитывай числа. Не перечисляй все подсказки и не превращай текст в психологический портрет. Первая фраза сразу смешная и точная. Дальше узнаваемая бытовая ситуация, живые реплики, неожиданные сравнения, едкий сарказм, абсурд и плотные панчлайны. Подруга рассказывает о бывшем так, что хочется отправить текст другой подруге. Не копируй ключи дословно, не повторяй одни и те же метафоры, не подслащивай слабости. Если сочетание указывает на спокойного, уважительного человека, обыграй его привычки без выдуманного негатива. Это символические предположения, не доказанные поступки: не приписывай человеку преступления, насилие, диагнозы или реальные измены. Не делай насилие смешным и не обвиняй женщину. Высмеивай поведение и самоуверенность, не достоинство личности. Два абзаца, первый 700–950 знаков, второй 220–300 знаков с финальным панчлайном. Без рекламы, морали, заголовков, списков, Markdown, длинных тире, арканов, чисел расчёта, дат и упоминаний ИИ. Только русский текст.
PROMPT;
}
function fcvMessages(int $d,int $m,int $y): array {
    if(!checkdate($m,$d,$y))throw new InvalidArgumentException('FLAGS_COMIC_DATE_INVALID');
    $matrix=rfs31($d,$m,$y);$keys=fcvKeys();
    $kb=json_decode((string)file_get_contents(__DIR__.'/flags-live-knowledge.json'),true,25,JSON_THROW_ON_ERROR);
    $selected=[];
    foreach(['left','top','right','center','loveHeart'] as $point){
        $n=$matrix[$point];$a=$kb['arcana'][$n]??null;
        if(!isset($keys[$n],$kb['pointDescriptions'][$point])||!is_array($a))throw new RuntimeException('FLAGS_COMIC_POINT_INVALID');
        $selected[]=['роль'=>$kb['pointDescriptions'][$point],'сильная_сторона'=>$a['plus'],'теневая_сторона'=>$a['minus'],'подсказка'=>$keys[$n]];
    }
    return [['role'=>'system','content'=>fcvPrompt()],['role'=>'user','content'=>json_encode(['вопрос'=>'Шуточный вердикт: красные флаги','пять_позиций'=>$selected],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]];
}
function fcvGenerate(int $d,int $m,int $y): string {
    return rfsValidate(niCloudCall(fcvMessages($d,$m,$y),2800,'google/gemini-3-flash-preview'));
}
