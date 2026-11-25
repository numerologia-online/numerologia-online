<?php
declare(strict_types=1);
require_once __DIR__.'/intimacy-practical-engine.php';
function scvKeys(): array {
    $data=json_decode((string)file_get_contents(__DIR__.'/intimacy-comic-verdict.json'),true,20,JSON_THROW_ON_ERROR);
    $keys=$data['keys']??null;
    if(($data['question_id']??null)!=='comic-verdict-intimacy'||!is_array($keys)||array_keys($keys)!==range(1,22)||count(array_unique($keys))!==22)throw new RuntimeException('INTIMACY_COMIC_KEYS_INVALID');
    foreach($keys as $key)if(!is_string($key)||trim($key)===''||mb_strlen($key,'UTF-8')>190)throw new RuntimeException('INTIMACY_COMIC_KEY_INVALID');
    return $keys;
}
function scvPrompt(): string {
    return <<<'PROMPT'
Ты остроумная, раскрепощённая взрослая подруга с талантом женского стендапа. Это самостоятельный шуточный вердикт раздела «Секс и близость» для взрослых, не дополнение к другим вопросам. Весь текст — комедийная прожарка про темперамент, романтическую обстановку, взаимность, инициативу, нежность и мужское самомнение. Из четырёх переданных подсказок и смысловых характеристик собери одну смешную узнаваемую сцену. День и месяц равноправны; год и точка близости уточняют проявления. Не пересчитывай числа. Не перечисляй ключи и не повторяй их дословно. Первая фраза сразу вызывает улыбку. Дальше дерзкие реплики, взрослые двусмысленности, бытовой абсурд, неожиданные метафоры, ирония и плотные панчлайны. Пиши так, как женщина рассказывает подруге про нелепое романтическое свидание. Не уходи в пошлость ради пошлости, не описывай интимные действия графически, не оценивай тело, физиологию, длительность, сексуальную функцию или реальный опыт по дате рождения. Не утверждай выдуманные поступки. Если сочетание указывает на нежность, взаимность и внимательность, обыграй это смешно без искусственного негатива. Согласие и личные границы обязательны; отказ и принуждение не превращай в шутку. Высмеивай привычки, самомнение и неловкие ситуации, не унижай людей. Ровно два абзаца, первый 700–950 знаков, второй 220–300 знаков с сильным финальным панчлайном. Без рекламы, морали, заголовков, списков, Markdown, длинных тире, арканов, цифр расчёта, дат и упоминаний ИИ. Только готовая прожарка по-русски.
PROMPT;
}
function scvMessages(int $d,int $m,int $y): array {
    if(!checkdate($m,$d,$y)||!niAdultBirthDate(sprintf('%04d-%02d-%02d',$y,$m,$d)))throw new InvalidArgumentException('INTIMACY_AGE_RESTRICTED');
    $matrix=ni31($d,$m,$y);$keys=scvKeys();$kb=ipKnowledge();$titles=ipPointTitles();$selected=[];
    foreach(ipPointMap('fire') as $point){
        $n=$matrix[$point];
        if(!isset($keys[$n],$kb[$n],$titles[$point]))throw new RuntimeException('INTIMACY_COMIC_POINT_INVALID');
        $selected[]=['роль'=>$titles[$point],'темперамент'=>$kb[$n]['fire'],'взаимность'=>$kb[$n]['her-pleasure'],'подсказка'=>$keys[$n]];
    }
    return [['role'=>'system','content'=>scvPrompt()],['role'=>'user','content'=>json_encode(['вопрос'=>'Шуточный вердикт: секс и близость','четыре_позиции'=>$selected],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]];
}
function scvGenerate(int $d,int $m,int $y): string {
    $text=niValidateGeneratedText(niCloudCall(scvMessages($d,$m,$y),2800,'google/gemini-3-flash-preview'),'stop');
    if(mb_strlen($text,'UTF-8')>1800)throw new RuntimeException('INTIMACY_COMIC_LENGTH');
    return $text;
}
