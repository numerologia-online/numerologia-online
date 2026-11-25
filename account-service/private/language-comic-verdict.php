<?php
declare(strict_types=1);
require_once __DIR__.'/language-live.php';
function wcvKeys(): array {
    $data=json_decode((string)file_get_contents(__DIR__.'/language-comic-verdict.json'),true,20,JSON_THROW_ON_ERROR);
    $keys=$data['keys']??null;
    if(($data['question_id']??null)!=='comic-verdict-language'||!is_array($keys)||array_keys($keys)!==range(1,22)||count(array_unique($keys))!==22)throw new RuntimeException('LANGUAGE_COMIC_KEYS_INVALID');
    foreach($keys as $key)if(!is_string($key)||trim($key)===''||mb_strlen($key,'UTF-8')>190)throw new RuntimeException('LANGUAGE_COMIC_KEY_INVALID');
    return $keys;
}
function wcvPrompt(): string {
    return <<<'PROMPT'
Ты беспощадно остроумная подруга с талантом женского стендапа. Это самостоятельный шуточный вердикт раздела «Язык любви мужчины». Весь текст — прожарка про то, как он понимает любовь, показывает чувства, слышит просьбы, реагирует на комплименты, критику и разговоры. Из четырёх переданных позиций, смысловых характеристик и юмористических ключей создай одну цельную смешную сцену. День и месяц равноправны; год и точка близкого союза уточняют, как это проявляется в отношениях. Не пересчитывай, не перечисляй ключи и не копируй их дословно. Первая фраза сразу смешно отвечает, на каком языке он понимает любовь и общается. Затем живые реплики, бытовой абсурд, едкий сарказм, гиперболы, неожиданные сравнения и плотные панчлайны. Как будто подруга пересказывает нелепый диалог со своим бывшим. Не подменяй реальные потребности обязательным поклонением мужчине, не предлагай женщине обслуживать его, терпеть унижение или угадывать мысли. Если сочетание указывает на простого, открытого, тёплого партнёра, обыграй его привычки с юмором без придуманной проблемы. Не приписывай реальные поступки, диагнозы или насилие. Высмеивай привычки, самомнение и нелепые ожидания, не человеческое достоинство. Два абзаца: первый 700–950 знаков, второй 220–300 с финальным панчлайном. Без рекламы, морали, лекций, заголовков, списков, Markdown, длинных тире, арканов, цифр расчёта, дат и упоминаний ИИ. Только готовая прожарка по-русски.
PROMPT;
}
function wcvMessages(int $d,int $m,int $y): array {
    if(!checkdate($m,$d,$y))throw new InvalidArgumentException('LANGUAGE_COMIC_DATE_INVALID');
    $matrix=ni31($d,$m,$y);$keys=wcvKeys();$kb=nlKnowledge();$titles=nlPointTitles();$selected=[];
    foreach(nlPointMap('love-language') as $point){
        $n=$matrix[$point];
        if(!isset($keys[$n],$kb[$n],$titles[$point]))throw new RuntimeException('LANGUAGE_COMIC_POINT_INVALID');
        $selected[]=['роль'=>$titles[$point],'язык_любви'=>$kb[$n]['love-language'],'общение'=>$kb[$n]['how-to-talk'],'критика'=>$kb[$n]['criticism'],'подсказка'=>$keys[$n]];
    }
    return [['role'=>'system','content'=>wcvPrompt()],['role'=>'user','content'=>json_encode(['вопрос'=>'Шуточный вердикт: язык любви мужчины','четыре_позиции'=>$selected],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]];
}
function wcvGenerate(int $d,int $m,int $y): string {
    $text=niValidateGeneratedText(niCloudCall(wcvMessages($d,$m,$y),2800,'google/gemini-3-flash-preview'),'stop');
    if(mb_strlen($text,'UTF-8')>1800)throw new RuntimeException('LANGUAGE_COMIC_LENGTH');
    return $text;
}
