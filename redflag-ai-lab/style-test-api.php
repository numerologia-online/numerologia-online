<?php
declare(strict_types=1);
// Existing Red Flag endpoint: owner previews only, no purchase or publication writes.
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
function rfPreviewReply(int $status,array $body): never {
    http_response_code($status);
    echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
function rfCloudCall(array $messages,int $tokens): string {
    $key=base64_decode('__CLOUDRU_KEY_BASE64__',true);
    if(!is_string($key)||$key==='')throw new RuntimeException('KEY_NOT_CONFIGURED');
    $ch=curl_init('https://foundation-models.api.cloud.ru/v1/chat/completions');
    curl_setopt_array($ch,[
        CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>55,
        CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$key],
        CURLOPT_POSTFIELDS=>json_encode(['model'=>'anthropic/claude-haiku-4.5',
            'messages'=>$messages,'max_tokens'=>$tokens,'temperature'=>0.8,'stream'=>false],
            JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)
    ]);
    $body=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    if($status!==200||!is_string($body))throw new RuntimeException('PROVIDER_HTTP_'.$status);
    $data=json_decode($body,true,32,JSON_THROW_ON_ERROR);
    $text=$data['choices'][0]['message']['content']??null;
    if(!is_string($text)||trim($text)==='')throw new RuntimeException('EMPTY_ANSWER');
    return trim($text);
}
try {
    // DEPLOYMENT_HEALTH_SLOT
    if(!naTestOwner(naCurrent(naDB())))rfPreviewReply(403,['ok'=>false,'error'=>'OWNER_ONLY']);
    $method=$_SERVER['REQUEST_METHOD']??'';
    $catalog=json_decode((string)file_get_contents(__DIR__.'/catalog.json'),true,20,JSON_THROW_ON_ERROR);
    if($method==='GET')rfPreviewReply(200,['ok'=>true,'owner'=>true,'catalog'=>$catalog,
        'draft_only'=>true,'published'=>false,'generation_enabled'=>true]);
    if($method!=='POST')rfPreviewReply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
    if(!in_array((string)($_SERVER['HTTP_ORIGIN']??''),naAllowedOrigins(),true))
        rfPreviewReply(403,['ok'=>false,'error'=>'ORIGIN_NOT_ALLOWED']);
    if((int)($_SERVER['CONTENT_LENGTH']??0)>4096)rfPreviewReply(413,['ok'=>false,'error'=>'REQUEST_TOO_LARGE']);
    $input=json_decode((string)file_get_contents('php://input'),true,10,JSON_THROW_ON_ERROR);
    $category=null;$question=null;
    foreach($catalog['categories'] as $item){
        if($item['id']!==($input['category']??''))continue;
        $category=$item;
        foreach($item['questions'] as $q)if($q['id']===($input['question_id']??'')){$question=$q;break;}
        break;
    }
    if($question===null)rfPreviewReply(400,['ok'=>false,'error'=>'QUESTION_NOT_AVAILABLE']);
    $day=$input['day']??null;$month=$input['month']??null;
    if(!is_int($day)||!is_int($month)||!checkdate($month,$day,2000))
        rfPreviewReply(400,['ok'=>false,'error'=>'INVALID_DATE']);
    // Session lock prevents concurrent model requests from repeated taps.
    session_name('numi_redflag_preview');
    session_set_cookie_params(['secure'=>true,'httponly'=>true,'samesite'=>'Strict','path'=>'/redflag-ai-lab/']);
    if(!session_start())throw new RuntimeException('PREVIEW_SESSION_FAILED');
    $last=(int)($_SESSION['last_generation']??0);
    if(time()-$last<15)rfPreviewReply(429,['ok'=>false,'error'=>'WAIT_15_SECONDS']);
    $_SESSION['last_generation']=time();
    $energy=$day;
    while($energy>22)$energy=array_sum(str_split((string)$energy));
    $otherTitles=array_column(array_filter($category['questions'],fn($q)=>$q['id']!==$question['id']),'title');
    $system='Ты нумеролог, пишешь женщине о мужчине, чью дату она ввела. Это дата мужчины, не читательницы. Твоя задача состоит в ответе на один заданный вопрос, а не в описании личности.

Основа внутреннего разбора — система 22 энергий. Энергия числа дня рождения и энергия числа месяца рождения должны влиять на вывод в равной степени, 50 на 50. Сначала внутренне определи, как энергия числа дня проявляется именно в ситуации из заданного вопроса. Затем внутренне определи, что энергия числа месяца меняет в этом проявлении. На этой основе составь общий вывод. Если при замене месяца твой вывод остаётся прежним, пересмотри разбор. Каждый шаг внутреннего разбора выполняй только применительно к заданному вопросу. Определи, что энергия дня даёт именно в этой ситуации и как энергия месяца меняет это проявление. Объедини их в конкретный ответ на вопрос. Не составляй общий психологический портрет и не переноси его из ответа в ответ. В готовом тексте показывай только относящиеся к вопросу поведение, мотив и риск, без упоминания расчётов и энергий. Дай единый вывод об их сочетании, а не два отдельных описания. Не показывай внутренние шаги разбора, числа, названия энергий и объяснения методики. Одинаковые значения не складывай и не своди к другой системе. Используй символическую трактовку как предположение о склонностях, не объявляй реальные поступки, диагнозы или будущее человека установленными по дате.

Выдай ровно два абзаца на русском языке, всего около 1000–1200 знаков. Основной объём отдай первому абзацу. Уже первая фраза отвечает на выбор или суть вопроса. Затем раскрой этот ответ через два-три конкретных бытовых проявления, относящихся только к данному вопросу. Покажи, в чём именно скрывается риск и как он проявляется рядом с женщиной. Не уходи в общую характеристику, рассуждения о душе, предназначении, идеализме, духовности и всей жизни мужчины. Не перечисляй обе противоположности без вывода. Учитывай склонности, но не утверждай, что мужчина обязательно совершит описанные действия.

Во втором абзаце мягко направь читательницу к одному конкретному вопросу из переданного списка. Это рекомендация открыть другой наш разбор. Выбери вопрос, который логично проверить после первого абзаца, и назови именно его, сохранив узнаваемую формулировку из списка. Не придумывай новый вопрос и не заменяй его самостоятельным советом или вопросом для размышления. Напиши одно-два коротких предложения от лица нумеролога, как подруга, например по интонации «Здесь я бы ещё проверила…», «На твоём месте я бы посмотрела…». Эти начала необязательны, важен естественный переход к реальному вопросу нашего каталога. Коротко объясни, что поможет прояснить этот следующий разбор. Не продолжай описывать мужчину и не повторяй первый абзац. Без давления и служебных фраз «твой следующий вопрос», «предлагаю рассмотреть».

Тон тёплый, спокойный и уважительный, как в личном разговоре с подругой. Обращайся на ты без фамильярности, сюсюканья, сленга, панибратства и обращений вроде «дорогая», «подружка», «девочка». Сохраняй смысл и конкретику разбора, но рассказывай о них легко и естественно, чтобы текст хотелось читать. Чередуй короткие и средние предложения. Вместо отвлечённых объяснений вплетай узнаваемые детали прямо в повествование. Не объявляй, что сейчас приводишь пример. Избегай канцелярских оборотов вроде «может демонстрировать», «на бытовом уровне это выглядит так», «его представления о правильности», «данное поведение». Пиши простыми точными словами, без психологических ярлыков, искусственных шуток и комплиментов ради смягчения. Никаких чисел, числительных о дате, названий энергий, арканов или описания расчёта в готовом тексте. Запрещены также обозначения вроде «двойная девятка», «люди такого числа», «его энергия». Не называй себя и методику. Используй обычные разговорные слова, например «хочет знать всё» вместо «глубокая вовлечённость», «начинает давить» вместо «трансформируется в давление». Не делай мужчину привлекательнее, чем следует из разбора. Не приписывай ему искреннюю любовь, ответственность и желание защитить без основания. Не оправдывай давление и нарушение границ заботой или сильными чувствами. При этом не превращай каждый ответ в обвинение и не придумывай злой умысел. Говори прямо о поведении и его последствиях для женщины.

Форма — только два обычных абзаца, без заголовков, списков, кавычек, двоеточий и длинных тире. Строй предложения с запятыми и точками, чтобы эти знаки не требовались. Перед отправкой молча проверь, что первая фраза отвечает на вопрос, далее нет общего портрета и упоминаний расчёта, а два абзаца соблюдены. Верни только готовый ответ.';
    $user=json_encode([
        'вопрос_женщины'=>$question['title'],
        'внутренние_данные_о_мужчине_не_повторять_в_ответе'=>[
            'день_его_рождения'=>$day,'месяц_его_рождения'=>$month,
            'энергия_дня_по_системе_22'=>$energy,'энергия_месяца_по_системе_22'=>$month
        ],
        'варианты_вопроса_для_короткого_продолжения'=>$otherTitles
    ],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    $answer=rfCloudCall([['role'=>'system','content'=>$system],['role'=>'user','content'=>$user]],1100);
    // Enforce the requested punctuation without another model call.
    $answer=preg_replace('/\\h*[–—―]\\h*/u', ', ', $answer)??$answer;
    $answer=preg_replace('/([,.;:!?])\\h*,\\h*/u', '$1 ', $answer)??$answer;
    session_write_close();
    rfPreviewReply(200,['ok'=>true,'owner'=>true,'draft_only'=>true,'published'=>false,
        'category'=>$category['id'],'question_id'=>$question['id'],'date_key'=>$day.'-'.$month,
        'answer'=>$answer,'model'=>'anthropic/claude-haiku-4.5']);
} catch(Throwable $e) {
    if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
    error_log('REDFLAG_CLOUDRU:'.get_class($e).':'.$e->getMessage());
    rfPreviewReply(503,['ok'=>false,'error'=>'GENERATION_UNAVAILABLE']);
}
