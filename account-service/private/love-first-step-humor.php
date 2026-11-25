<?php
declare(strict_types=1);
require_once __DIR__.'/love-practical-engine.php';
function lvhPrompt(): string {
    return <<<'PROMPT'
Ты наблюдательная, беспощадно остроумная подруга с талантом женского стендапа. Сначала выполни исходную задачу полностью по действующему основному промпту. Затем придумай одну самостоятельную, неожиданно смешную прожарку только на тему инициативы мужчины при знакомстве: кто пишет, флиртует, зовёт на свидание, ждёт сигнала или переводит слова в дело. Используй четыре переданные юмористические подсказки как материал, а не готовый текст. Сопоставь день и месяц на равных, учитывай год и тематическую точку; не пересчитывай. Шутка должна вытекать из уже написанного первого абзаца, не противоречить ему и не придумывать реальные поступки. Едкий бытовой сарказм, абсурд, гипербола, смешные реплики, неожиданный финал. Прожаривай привычку, а не достоинство человека; хороший сценарий тоже обыграй смешно, не выдумывай негатив. Без психологических объяснений, морали, рекомендаций и оскорблений личности. Не копируй подсказки дословно. Одна или две короткие фразы, максимум 150 символов без метки. В конце первого абзаца отдельной строкой, без пустой строки перед ней, напиши «Шуточный вердикт: » и шутку. Затем ровно одна пустая строка и обычный второй абзац с подводкой. Два абзаца сохраняются. Не добавляй иных заголовков или Markdown.
PROMPT;
}
function lvhKeys(): array {
    $data=json_decode((string)file_get_contents(__DIR__.'/love-first-step-humor.json'),true,20,JSON_THROW_ON_ERROR);
    $keys=$data['keys']??null;
    if(($data['question_id']??null)!=='first-step'||!is_array($keys)||array_keys($keys)!==range(1,22)||count(array_unique($keys))!==22)throw new RuntimeException('LOVE_HUMOR_KEYS_INVALID');
    foreach($keys as $key)if(!is_string($key)||mb_strlen($key,'UTF-8')>160||trim($key)==='')throw new RuntimeException('LOVE_HUMOR_KEY_INVALID');
    return $keys;
}
function lvhMessages(array $q,int $d,int $m,int $y): array {
    $messages=lvpMessages($q,$d,$m,$y);
    if($q['id']!=='first-step')return $messages;
    $matrix=ni31($d,$m,$y);$keys=lvhKeys();$titles=lvpPointTitles();$selected=[];
    foreach(lvpPointMap($q['id']) as $point)$selected[]=['роль'=>$titles[$point],'подсказка'=>$keys[$matrix[$point]]];
    $payload=json_decode($messages[1]['content'],true,30,JSON_THROW_ON_ERROR);
    $payload['отдельная_задача_только_для_шуточного_вердикта']=lvhPrompt();
    $payload['четыре_юмористические_подсказки']=$selected;
    $messages[1]['content']=json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    return $messages;
}
function lvhFormat(string $text): string {
    $normal=niValidateGeneratedText($text,'stop');
    $parts=explode("\n\n",$normal);
    $marker='Шуточный вердикт:';
    if(substr_count($normal,$marker)!==1)throw new RuntimeException('LOVE_HUMOR_MARKER_INVALID');
    $pos=mb_strpos($parts[0],$marker,0,'UTF-8');
    if($pos===false)throw new RuntimeException('LOVE_HUMOR_POSITION_INVALID');
    $first=trim(mb_substr($parts[0],0,$pos,'UTF-8'));
    $joke=trim(mb_substr($parts[0],$pos+mb_strlen($marker,'UTF-8'),null,'UTF-8'));
    if($joke===''||mb_strlen($joke,'UTF-8')>150||preg_match('/\R/u',$joke))throw new RuntimeException('LOVE_HUMOR_LENGTH_INVALID');
    $body=lvpFormatAnswer($first."\n\n".$parts[1],'first-step');
    [$main,$follow]=explode("\n\n",$body,2);
    $result=$main."\n".$marker.' '.$joke."\n\n".$follow;
    if(mb_strlen($result,'UTF-8')>1800)throw new RuntimeException('LOVE_HUMOR_TEXT_TOO_LONG');
    return niValidateGeneratedText($result,'stop');
}
function lvhGenerate(array $q,int $d,int $m,int $y): string {
    if($q['id']!=='first-step')return lvpGenerateText($q,$d,$m,$y);
    return lvhFormat(niCloudCall(lvhMessages($q,$d,$m,$y),2800,'google/gemini-3-flash-preview'));
}
