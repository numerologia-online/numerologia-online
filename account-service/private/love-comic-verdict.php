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
Ты очень смешная, язвительная женщина. Твоя задача: смешно и безжалостно высмеивать нелепые привычки мужчины в любви и отношениях. Объедини три переданные подсказки: день и месяц равноправны, год уточняет манеру действовать. Используй только их смысл. Не считай дополнительные точки, не перечисляй энергии. Найди наиболее смешную черту или сочетание черт: как он ухаживает, чего хочет от женщины, как ведёт себя в отношениях. Не ищи обязательных противоречий там, где их нет. С первой фразы дай смешной вердикт, затем покажи конкретные смешные бытовые проявления и закончи сильной шуткой. Обращайся к читательнице на «ты». Пиши так, будто женщина с отличным чувством юмора рассказывает подруге, с каким мужчиной той предстоит иметь дело. Высмеивай привычки, самомнение, капризы, драматизм, нелепые ожидания и отговорки, если они следуют из переданных подсказок. Например, если ключи действительно указывают на склонность драматично обрывать отношения при конфликте, можно пошутить: «Готовься, при каждой ссоре он может драматично собирать чемоданы и объявлять, что между вами всё кончено». Если ключи указывают на чрезмерное желание устанавливать правила, смешно показать, что он готов объяснить даже какой стороной носить трусы. Это примеры интонации и степени конкретности, не универсальные характеристики; не вставляй их в неподходящие сочетания. Не придумывай реальные измены, события, уход к другой женщине, диагнозы, насилие или недостатки, которых нет в ключах. Если мужчина надёжный и тёплый, смешно обыграй его реальные привычки, не выдумывай плохое. Не пересказывай подсказки сухо и не копируй примеры автоматически. Никаких литературных монологов, длинных сценок, искусственной похвалы, морали, рекламы и психологических лекций. Не начинай с «слушай, мать», «представь», «подруга» или «ой, всё». Обычная разговорная речь, сарказм, узнаваемые бытовые мелочи, допустима умеренная грубость. Один абзац, целевой объём 500–600 знаков. Без заголовков, списков, второго абзаца, длинных и средних тире, дат, цифр расчёта, названий энергий и упоминаний ИИ. Только смешной готовый ответ.
PROMPT;
}
function lcvMessages(int $d,int $m,int $y): array {
    if(!checkdate($m,$d,$y))throw new InvalidArgumentException('LOVE_COMIC_DATE_INVALID');
    $matrix=ni31($d,$m,$y);$keys=lcvKeys();$titles=lvpPointTitles();$selected=[];
    foreach(['left','top','right'] as $point){
        if(!isset($matrix[$point],$keys[$matrix[$point]],$titles[$point]))throw new RuntimeException('LOVE_COMIC_POINT_INVALID');
        $selected[]=['роль'=>$titles[$point],'подсказка'=>$keys[$matrix[$point]]];
    }
    return [['role'=>'system','content'=>lcvPrompt()],['role'=>'user','content'=>json_encode(['вопрос'=>'Шуточный вердикт: любовь и отношения','три_юмористические_подсказки'=>$selected],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]];
}
function lcvValidate(string $text,string $finish='stop'): string {
    if(in_array($finish,['length','max_tokens'],true))throw new RuntimeException('PROVIDER_OUTPUT_LIMIT');
    $text=trim(str_replace(['**','__'],'',$text));
    $notice=niProviderNotice($text);
    if($notice!==null)throw new RuntimeException($notice);
    $text=trim(preg_replace('/\s+/u',' ',$text)??$text);
    $text=preg_replace('/\s*[—–―]\s*/u',', ',$text)??$text;
    $text=preg_replace('/,\s*,/u',',',$text)??$text;
    // Length is an editorial target, not a reason to discard usable output.
    $len=mb_strlen($text,'UTF-8');
    if($len>700){
        // Keep the longest complete sentence sequence within the target range.
        // Do not generate again or cut a punchline in the middle of a word.
        preg_match_all('/[.!?…]+[»”"]?(?=\s|$)/u',$text,$ends,PREG_OFFSET_CAPTURE);
        $best=null;$fallback=null;
        foreach($ends[0]??[] as [$end,$offset]){
            $candidate=trim(substr($text,0,$offset+strlen($end)));
            $n=mb_strlen($candidate,'UTF-8');
            if($n>700)break;
            if($n>=220)$fallback=$candidate;
            if($n>=500&&$n<=600)$best=$candidate;
        }
        if($best!==null||$fallback!==null)$text=$best??$fallback;
        // If no natural boundary exists, preserve the coherent response
        // rather than reporting a false service failure.
        $len=mb_strlen($text,'UTF-8');
    }
    if($len<80||$len>1800)throw new RuntimeException('LOVE_COMIC_TEXT_LENGTH_INVALID');
    $letters=preg_match_all('/\p{L}/u',$text);$ru=preg_match_all('/[а-яё]/iu',$text);
    if(!$ru||$ru<=$letters/2)throw new RuntimeException('LOVE_COMIC_TEXT_LANGUAGE_INVALID');
    return $text;
}
function lcvGenerate(int $d,int $m,int $y): string {
    return niCloudCall(lcvMessages($d,$m,$y),2800,'google/gemini-3-flash-preview','lcvValidate');
}
