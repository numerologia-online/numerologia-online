<?php
declare(strict_types=1);
require_once __DIR__.'/family-practical-engine.php';
function hcvKeys(): array {
    $data=json_decode((string)file_get_contents(__DIR__.'/family-comic-verdict.json'),true,20,JSON_THROW_ON_ERROR);
    $keys=$data['keys']??null;
    if(($data['question_id']??null)!=='comic-verdict-family'||!is_array($keys)||array_keys($keys)!==range(1,22)||count(array_unique($keys))!==22)throw new RuntimeException('FAMILY_COMIC_KEYS_INVALID');
    foreach($keys as $key)if(!is_string($key)||trim($key)===''||mb_strlen($key,'UTF-8')>190)throw new RuntimeException('FAMILY_COMIC_KEY_INVALID');
    return $keys;
}
function hcvPrompt(): string {
    return <<<'PROMPT'
Ты беспощадно остроумная подруга с талантом женского стендапа. Это отдельный шуточный вердикт «Семья и быт», не дополнение к обычному ответу. Весь текст — прожарка про совместную жизнь: бытовая самостоятельность, посуда, носки, уборка, участие в заботе, родительские привычки, семейные решения и мужские подвиги. Синтезируй четыре позиции из расчёта и их юмористические ключи. День и месяц равноправны, год и домашняя тематическая точка уточняют конкретное поведение. Не пересчитывай, не перечисляй ключи и не копируй их дословно. Первая фраза сразу смешная и конкретная. Затем узнаваемая сценка семейной жизни, женский сарказм, смешные бытовые реплики, нелепые оправдания и неожиданные панчлайны. Как будто женщина рассказывает подруге про бывшего и они смеются до слёз. Не путай любовь к чистоте с личной уборкой, командование с хозяйственностью, разовый подвиг с регулярной работой. Если мужчина по сочетанию действительно самостоятелен и заботлив, обыграй его достоинства смешно и метко без придуманной лени. Не выдумывай реальные поступки, семейное положение или детей. Не обвиняй женщину и не унижай человеческое достоинство: мишень — привычки, отговорки, самомнение и бытовые противоречия. Не делай принуждение смешным. Ровно два абзаца: первый 700–950 знаков, второй 220–300 с финальным панчлайном. Без рекламы, морали, лекций, заголовков, списков, Markdown, длинных тире, арканов, цифр расчёта, дат и упоминаний ИИ. Только готовая прожарка по-русски.
PROMPT;
}
function hcvMessages(int $d,int $m,int $y): array {
    if(!checkdate($m,$d,$y))throw new InvalidArgumentException('FAMILY_COMIC_DATE_INVALID');
    $matrix=ni31($d,$m,$y);$keys=hcvKeys();$kb=fpKnowledge();$titles=fpPointTitles();$selected=[];
    foreach(fpPointMap('household') as $point){
        $n=$matrix[$point];
        if(!isset($keys[$n],$kb[$n],$titles[$point]))throw new RuntimeException('FAMILY_COMIC_POINT_INVALID');
        $selected[]=['роль'=>$titles[$point],'самостоятельность'=>$kb[$n]['independent'],'быт'=>$kb[$n]['household'],'забота'=>$kb[$n]['care'],'подсказка'=>$keys[$n]];
    }
    return [['role'=>'system','content'=>hcvPrompt()],['role'=>'user','content'=>json_encode(['вопрос'=>'Шуточный вердикт: семья и быт','четыре_позиции'=>$selected],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]];
}
function hcvGenerate(int $d,int $m,int $y): string {
    $text=niValidateGeneratedText(niCloudCall(hcvMessages($d,$m,$y),2800,'google/gemini-3-flash-preview'),'stop');
    if(mb_strlen($text,'UTF-8')>1800)throw new RuntimeException('FAMILY_COMIC_LENGTH');
    return $text;
}
