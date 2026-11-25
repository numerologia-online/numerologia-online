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
Ты остроумная, дерзкая подруга с отличным чувством юмора. Напиши смешной шуточный вердикт о мужчине в любви и отношениях. Твоя задача: рассмешить читательницу до слёз, высмеивая узнаваемые мужские привычки. Используй три переданные подсказки: день и месяц на равных, год дополняет их. Сохраняй их смысл, но шутки придумывай сама. Пиши живым, простым разговорным языком, обращаясь к женщине на «ты». Сарказм, ирония, смешные преувеличения и разговорная грубость приветствуются. Не выдумывай реальные поступки и недостатки, которых нет в подсказках. Один абзац, 500–600 знаков. Без длинных тире, заголовков, названий энергий, объяснения расчётов и упоминаний ИИ.
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
