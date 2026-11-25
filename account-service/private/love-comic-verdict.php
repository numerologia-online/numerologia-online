<?php
declare(strict_types=1);
require_once __DIR__.'/love-practical-engine.php';
function lcvKeys(): array {
    $data=json_decode((string)file_get_contents(__DIR__.'/love-comic-verdict.json'),true,20,JSON_THROW_ON_ERROR);
    $keys=$data['keys']??null;
    if(($data['question_id']??null)!=='comic-verdict-love'||!is_array($keys)||array_keys($keys)!==range(1,22)||count(array_unique($keys))!==22)throw new RuntimeException('LOVE_COMIC_KEYS_INVALID');
    foreach($keys as $key)if(!is_string($key)||trim($key)===''||mb_strlen($key,'UTF-8')>160)throw new RuntimeException('LOVE_COMIC_KEY_INVALID');
    return $keys;
}
function lcvPrompt(): string {
    return <<<'PROMPT'
Ты беспощадно остроумная подруга с талантом женского стендапа. Это самостоятельный шуточный вердикт о том, как мужчина проявляет инициативу при знакомстве и в начале отношений. Не пиши обычную нумерологическую трактовку и не добавляй к ней отдельную шутку: весь ответ сам является прожаркой. Синтезируй четыре переданные юмористические подсказки; день и месяц равноправны, год и тематическая точка уточняют проявления. Не пересчитывай и не перечисляй ключи. С первой фразы прямо и смешно ответь, кто здесь пишет, флиртует, зовёт на свидание, ждёт знака или переводит обещания в действия. Дальше развивай одну цельную комедийную сцену, с живыми репликами, бытовым абсурдом, язвительным сарказмом, гиперболой и неожиданным панчлайном. Не копируй подсказки дословно; избегай одинаковых шаблонов и комплиментарности. Подкалывай манеру ухаживания, а не достоинство человека; не выдумывай реальные события, диагнозы, измены или насилие. Если по ключам он инициативный, обыграй это смешно, не приписывая ему плохое. Пиши по-русски, как женщина рассказывает подруге про свидание. Два абзаца: первый 700–950 знаков, второй 220–300 знаков, продолжение шутки и финальный панчлайн. Без заголовков, списков, Markdown, цифр расчёта, дат, арканов, упоминаний ИИ и длинных тире. Только готовая прожарка по теме инициативы, без рекламы и морали.
PROMPT;
}
function lcvMessages(int $d,int $m,int $y): array {
    if(!checkdate($m,$d,$y))throw new InvalidArgumentException('LOVE_COMIC_DATE_INVALID');
    $matrix=ni31($d,$m,$y);$keys=lcvKeys();$titles=lvpPointTitles();$selected=[];
    foreach(lvpPointMap('first-step') as $point){
        if(!isset($matrix[$point],$keys[$matrix[$point]],$titles[$point]))throw new RuntimeException('LOVE_COMIC_POINT_INVALID');
        $selected[]=['роль'=>$titles[$point],'подсказка'=>$keys[$matrix[$point]]];
    }
    return [['role'=>'system','content'=>lcvPrompt()],['role'=>'user','content'=>json_encode(['вопрос'=>'Шуточный вердикт: инициатива мужчины при знакомстве','четыре_юмористические_подсказки'=>$selected],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]];
}
function lcvGenerate(int $d,int $m,int $y): string {
    $text=niValidateGeneratedText(niCloudCall(lcvMessages($d,$m,$y),2800,'google/gemini-3-flash-preview'),'stop');
    if(mb_strlen($text,'UTF-8')>1800)throw new RuntimeException('LOVE_COMIC_TEXT_TOO_LONG');
    return $text;
}
