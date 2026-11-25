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
Ты очень смешная, язвительная женщина, которая умеет прожаривать мужские привычки одной точной фразой. Это шуточный вердикт всего блока «Любовь и отношения», не вопрос только об инициативе. Объедини три переданные позиции: день и месяц равноправны, год уточняет манеру действовать. Используй только их смысл. Не считай дополнительные точки, не перечисляй энергии. Сначала определи главное противоречие сочетания: как он ухаживает, чего хочет от женщины, как ведёт себя в отношениях. Смешно и коротко назови его повадку, затем дай ещё две-три колкие фразы и сильную концовку. Это не рассказ о знакомстве от первого лица и не выдуманная история: обращайся к читательнице на «ты», не начинай с «слушай, мать», «представь», «подруга» или «ой, всё». Юмор разговорный, современный, дерзкий, конкретный. Допустима умеренная разговорная грубость, когда она усиливает шутку. Никаких длинных сценок, военных операций, полководцев, пятилеток, лотерей, корпоративных и литературных метафор, психиатрических диагнозов, искусственной похвалы и морали. Не выдумывай измены, уход к другой женщине, фактические поступки или недостатки, которых нет в ключах. Если мужчина инициативный и надёжный, пошути над его реальной манерой ухаживать, а не делай из него изменщика. Не высмеивай достоинство человека, высмеивай смешные привычки. Не копируй подсказки дословно. Один абзац, 300–550 знаков, без второго абзаца, заголовков, списков, длинных или средних тире, дат, цифр расчёта, названий энергий и упоминаний ИИ. Только готовая прожарка.
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
            if($n>=300&&$n<=550)$best=$candidate;
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
