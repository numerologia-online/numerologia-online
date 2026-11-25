<?php
declare(strict_types=1);
require_once __DIR__.'/flags-fidelity-live.php';
function icvKeys(): array {
    $data=json_decode((string)file_get_contents(__DIR__.'/infidelity-comic-verdict.json'),true,20,JSON_THROW_ON_ERROR);
    $keys=$data['keys']??null;
    if(($data['question_id']??null)!=='comic-verdict-infidelity'||!is_array($keys)||array_keys($keys)!==range(1,22)||count(array_unique($keys))!==22)throw new RuntimeException('INFIDELITY_COMIC_KEYS_INVALID');
    foreach($keys as $key)if(!is_string($key)||trim($key)===''||mb_strlen($key,'UTF-8')>190)throw new RuntimeException('INFIDELITY_COMIC_KEY_INVALID');
    return $keys;
}
function icvPrompt(): string {
    return <<<'PROMPT'
Ты беспощадно остроумная подруга с талантом женского стендапа. Это отдельный шуточный вердикт блока «Измены и флирт», а не дополнение к обычным ответам. Весь текст является прожаркой: тайные переписки, запасные варианты, бывшие, любовь к комплиментам, нелепые оправдания, двойные стандарты, виртуальные романы или, если сочетание указывает на верность, смешная история про то, как он отбивается от соблазнов. Выбирай только то, что вытекает из сочетания ключей. День и месяц равноправны, остальные три позиции уточняют поведение в близости и отношения к соблазнам. Не пересчитывай числа. Не копируй ключи дословно и не перечисляй их. Первая фраза сразу смешная и конкретная. Дальше цельная сценка как рассказ подруги о бывшем: диалоги, едкий сарказм, бытовой абсурд, гиперболы и неожиданные панчлайны. Не оправдывай двойные стандарты и не превращай любой флирт или общительность в измену. Не приписывай реальному человеку доказанную неверность, скрытые контакты или уже совершённые поступки: это шуточное описание возможных привычек, а не проверка фактов. Высмеивай отговорки и поведение, не достоинство человека; женщину не обвиняй. Если ключи показывают верность, не выдумывай измену ради шутки. Два абзаца: первый 700–950 знаков, второй 220–300 знаков с сильным финальным панчлайном. Никакой рекламы, морали, психологических лекций, заголовков, списков, Markdown, длинных тире, названий энергий, чисел расчёта, дат и упоминаний ИИ. Только готовая прожарка на русском.
PROMPT;
}
function icvMessages(int $d,int $m,int $y): array {
    if(!checkdate($m,$d,$y))throw new InvalidArgumentException('INFIDELITY_COMIC_DATE_INVALID');
    $matrix=rfs31($d,$m,$y);$keys=icvKeys();
    $kb=json_decode((string)file_get_contents(__DIR__.'/fidelity-live-knowledge.json'),true,25,JSON_THROW_ON_ERROR);
    $selected=[];
    foreach(['left','top','loveHeart','center','tailFirst'] as $point){
        $n=$matrix[$point];$a=$kb['arcana'][$n]??null;
        if(!isset($keys[$n],$kb['pointDescriptions'][$point])||!is_array($a))throw new RuntimeException('INFIDELITY_COMIC_POINT_INVALID');
        $selected[]=['роль'=>$kb['pointDescriptions'][$point],'сильная_сторона'=>$a['plus'],'теневая_сторона'=>$a['minus'],'подсказка'=>$keys[$n]];
    }
    return [['role'=>'system','content'=>icvPrompt()],['role'=>'user','content'=>json_encode(['вопрос'=>'Шуточный вердикт: измены и флирт','пять_позиций'=>$selected],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]];
}
function icvGenerate(int $d,int $m,int $y): string {
    return rfsValidate(niCloudCall(icvMessages($d,$m,$y),2800,'google/gemini-3-flash-preview'));
}
