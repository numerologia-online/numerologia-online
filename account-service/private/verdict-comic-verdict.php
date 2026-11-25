<?php
declare(strict_types=1);
require_once __DIR__.'/verdict-practical-engine.php';
function vcvKeys(): array {
    $data=json_decode((string)file_get_contents(__DIR__.'/verdict-comic-verdict.json'),true,20,JSON_THROW_ON_ERROR);
    $keys=$data['keys']??null;
    if(($data['question_id']??null)!=='comic-verdict-verdict'||!is_array($keys)||array_keys($keys)!==range(1,22)||count(array_unique($keys))!==22)throw new RuntimeException('VERDICT_COMIC_KEYS_INVALID');
    foreach($keys as $key)if(!is_string($key)||trim($key)===''||mb_strlen($key,'UTF-8')>190)throw new RuntimeException('VERDICT_COMIC_KEY_INVALID');
    return $keys;
}
function vcvPrompt(): string {
    return <<<'PROMPT'
Ты беспощадно остроумная подруга с талантом женского стендапа. Это самостоятельный финальный шуточный вердикт о мужчине как партнёре. Не добавляй шутку к обычной трактовке, весь текст является прожаркой. По четырём переданным позициям и их смысловым и юмористическим ключам собери один цельный комедийный вывод: какой экземпляр достался женщине, что в нём может понравиться, где его главная нелепая привычка и чего ждать от повседневных отношений. День и месяц равноправны, год и центр уточняют проявление. Не пересчитывай числа, не перечисляй ключи, не копируй их дословно. С первой фразы выдай меткий смешной вердикт. Затем разверни конкретную комедийную сцену из совместной жизни с живыми репликами, едким сарказмом, абсурдными сравнениями и неожиданными панчлайнами. Интонация: женщина рассказывает подруге о бывшем, они смеются до слёз. Никаких шаблонных диагнозов, комплиментарности, психологических лекций, рекламных переходов. Не подгоняй все сочетания под плохого партнёра; если мужчина тёплый и надёжный, смешно обыграй его достоинства, не изобретая недостатков. Не приписывай доказанные поступки, измены, насилие, диагнозы, семейное положение или детей по дате. Шутки о возможных привычках, отговорках, самомнении и противоречиях, а не об унижении достоинства человека. Не решай за женщину, вступать ли в отношения. Ровно два абзаца: первый 700–950 знаков, второй 220–300 знаков, финальная реплика самая смешная. Без заголовков, списков, Markdown, длинных тире, арканов, энергий, чисел расчёта, дат, упоминаний ИИ. Только готовая прожарка по-русски.
PROMPT;
}
function vcvMessages(int $d,int $m,int $y): array {
    if(!checkdate($m,$d,$y))throw new InvalidArgumentException('VERDICT_COMIC_DATE_INVALID');
    $matrix=ni31($d,$m,$y);$keys=vcvKeys();$kb=vpKnowledge();$titles=vpPointTitles();$selected=[];
    foreach(vpPointMap('final') as $point){
        $n=$matrix[$point];
        if(!isset($keys[$n],$kb[$n],$titles[$point]))throw new RuntimeException('VERDICT_COMIC_POINT_INVALID');
        $selected[]=['роль'=>$titles[$point],'основная_характеристика'=>$kb[$n]['final'],'достоинство_и_риск'=>$kb[$n]['beauty-and-flag'],'подсказка'=>$keys[$n]];
    }
    return [['role'=>'system','content'=>vcvPrompt()],['role'=>'user','content'=>json_encode(['вопрос'=>'Шуточный вердикт: общий итог отношений','четыре_позиции'=>$selected],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]];
}
function vcvGenerate(int $d,int $m,int $y): string {
    $text=niValidateGeneratedText(niCloudCall(vcvMessages($d,$m,$y),2800,'google/gemini-3-flash-preview'),'stop');
    if(mb_strlen($text,'UTF-8')>1800)throw new RuntimeException('VERDICT_COMIC_LENGTH');
    return $text;
}
