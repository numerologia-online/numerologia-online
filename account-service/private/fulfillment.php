<?php
declare(strict_types=1);
/** Existing entitlements are the only authority. Source paths never come from the browser. */
function naMaterialRead(string $path,?string $root=null): string {
    static $cache=[];
    $root??=__DIR__.'/store-content';
    $key=$root.'|'.$path;if(isset($cache[$key]))return $cache[$key];
    $manifest=json_decode((string)file_get_contents(__DIR__.'/store-assets.json'),true,32,JSON_THROW_ON_ERROR);
    $expected=$manifest['files'][$path]??null;
    if (!is_string($expected)) throw new RuntimeException('MATERIAL_NOT_READY');
    $base=realpath($root);$file=realpath($root.'/'.$path);
    if (!$base||!$file||!str_starts_with($file,$base.'/')||!is_file($file)||is_link($root.'/'.$path)||filesize($file)>8_000_000)
        throw new RuntimeException('MATERIAL_NOT_READY');
    $raw=(string)file_get_contents($file);
    if (!hash_equals($expected,hash('sha256',$raw))) throw new RuntimeException('MATERIAL_VERSION_MISMATCH');
    return $cache[$key]=$raw;
}
function naMaterialJson(string $path,?string $root=null): array {
    $raw=naMaterialRead($path,$root);if(str_starts_with($raw,"\xEF\xBB\xBF"))$raw=substr($raw,3);
    $value=json_decode($raw,true,64,JSON_THROW_ON_ERROR);
    if(!is_array($value))throw new RuntimeException('MATERIAL_NOT_READY');return $value;
}
function naReduce(int $n,int $limit=22): int {while($n>$limit)$n=array_sum(str_split((string)$n));return $n?:$limit;}
function naMatrix(string $date): array {
    if(!naCatalogDate($date))throw new InvalidArgumentException('INVALID_BIRTH_DATE');
    [$y,$m,$d]=array_map('intval',explode('-',$date));$left=naReduce($d);$right=naReduce(array_sum(str_split((string)$y)));$bottom=naReduce($left+$m+$right);$center=naReduce($left+$m+$right+$bottom);
    $corners=['topLeft'=>naReduce($left+$m),'topRight'=>naReduce($m+$right),'bottomRight'=>naReduce($right+$bottom),'bottomLeft'=>naReduce($bottom+$left)];
    $spoke=fn($base)=>['near'=>naReduce($base+$center),'outer'=>naReduce($base+naReduce($base+$center))];
    $moneyEntry=naReduce($right+$center);$first=naReduce($center+$bottom);$balance=naReduce($moneyEntry+$first);
    $personal=naReduce(naReduce($m+$bottom)+naReduce($left+$right));$social=naReduce(naReduce($corners['topLeft']+$corners['bottomRight'])+naReduce($corners['topRight']+$corners['bottomLeft']));
    return ['top'=>$m,'left'=>$left,'right'=>$right,'bottom'=>$bottom,'center'=>$center,'corners'=>$corners,
        'leftSpoke'=>$spoke($left),'rightSpoke'=>$spoke($right),'topSpoke'=>$spoke($m),
        'channels'=>['moneyPoint'=>naReduce($moneyEntry+$balance),'lovePoint'=>naReduce($first+$balance)],
        'purpose'=>['personal'=>$personal,'social'=>$social,'general'=>naReduce($personal+$social)],
        'tail'=>['first'=>$first,'second'=>naReduce($bottom+$first)]];
}
function naMaterialParagraphs(mixed $value): array {
    if(is_string($value))return trim($value)!==''?[trim($value)]:[];
    if(!is_array($value))return [];
    $result=[];
    foreach($value as $k=>$v){if(in_array((string)$k,['id','schema','status','energy','energies','code','key','title','name','description'],true))continue;$result=array_merge($result,naMaterialParagraphs($v));}
    return $result;
}
function naMaterialSection(array $data,string $fallback): array {
    $paragraphs=naMaterialParagraphs($data);
    if(!$paragraphs)throw new RuntimeException('MATERIAL_NOT_READY');
    return ['title'=>$data['title']??$fallback,'paragraphs'=>$paragraphs];
}
function naYearParse(string $text): array {
    $out=[];$group=null;$field=null;
    foreach(preg_split('/\R/u',$text) as $line){
        if(str_starts_with($line,'## ')){$group=trim(substr($line,3));$field=null;continue;}
        if(str_starts_with($line,'### ')){$field=trim(substr($line,4));$out[$group][$field]='';continue;}
        if($group!==null&&$field!==null)$out[$group][$field].=$line."\n";
    }
    foreach($out as &$fields)foreach($fields as &$body)$body=trim(preg_replace('/\s+/u',' ',$body));
    return $out;
}
// A 'complete' bank is editorially approved alongside 'ready'. Draft
// labels such as 'in-progress' must NEVER become sellable by inference.
function naRedFlagPaidStatus(mixed $status): bool {
    return in_array($status,['ready','complete'],true);
}
function naMaterialBuild(string $code,string $resource,?string $root=null): array {
    $sections=[];$title='';$links=[];
    if($code==='year_full'&&preg_match('/^year:(\d{4}):(\d{4}-\d{2}-\d{2})$/D',$resource,$match)){
        $year=(int)$match[1];$date=$match[2];if(!naCatalogDate($date))throw new RuntimeException('MATERIAL_NOT_READY');
        [, $month,$day]=array_map('intval',explode('-',$date));
        $before=naReduce($day+$month+array_sum(str_split((string)($year-1))),9);$after=naReduce($day+$month+array_sum(str_split((string)$year)),9);
        $primary=[];$alternate=[];
        foreach(array_unique([$before,$after]) as $energy){
            $primary[$energy]=naYearParse(naMaterialRead('data/year/'.($year%2?'odd/':'').'energy-'.$energy.'.txt',$root));
            $alternate[$energy]=naYearParse(naMaterialRead('data/year/'.($year%2?'':'odd/').'energy-'.$energy.'.txt',$root));
        }
        foreach([[$before,'До дня рождения'],[$after,'После дня рождения']] as [$energy,$phase]){
            $part=$primary[$energy]['Год']??[];if(empty($part['Описание'])||empty($part['Название']))throw new RuntimeException('MATERIAL_NOT_READY');
            $sections[]=['title'=>$phase.' · '.$part['Название'],'paragraphs'=>[$part['Описание']]];
        }
        $months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];$seen=[];
        for($cal=1;$cal<=12;$cal++)foreach($cal===$month?[$before,$after]:[$cal<$month?$before:$after] as $energy){
            $me=naReduce($energy+$cal,9);$key=$energy.'-'.$me;$bank=isset($seen[$key])?$alternate:$primary;$seen[$key]=true;
            $part=$bank[$energy]['Связка '.$key]??[];
            $required=['Название','Основной текст','Деньги','Работа и дело','Отношения','Здоровье и ресурс','Опасность','Что очень важно сделать','Чего категорически не делать','Главный совет'];
            foreach($required as $field)if(empty($part[$field]))throw new RuntimeException('MATERIAL_NOT_READY');
            $paragraphs=[];foreach($part as $field=>$body)if($field!=='Название')$paragraphs[]=$field.': '.$body;
            $sections[]=['title'=>$months[$cal-1].($cal===$month?($energy===$before?' · до дня рождения':' · после дня рождения'):'').' · '.$part['Название'],'paragraphs'=>$paragraphs];
        }
        $title='Полный разбор '.$year.' года · '.$date;
    } elseif($code==='redflag_question'&&preg_match('/^redflag:([a-z-]+):([a-z0-9-]+):(\d{4}-\d{2}-\d{2})$/D',$resource,$m)){
        if(!naCatalogDate($m[3]))throw new RuntimeException('MATERIAL_NOT_READY');
        $data=naMaterialJson('data/redflag/'.$m[1].'/'.$m[2].'.json',$root);
        [, $month,$day]=array_map('intval',explode('-',$m[3]));$text=$data['entries'][$day.'-'.$month]??null;
        // Both editorial approvals mean a validated, paid-ready bank. A draft
        // ('in-progress') is still blocked, regardless of how many keys exist.
        if(!naRedFlagPaidStatus($data['status']??null)||($data['section']??'')!==$m[1]||($data['questionId']??'')!==$m[2]||!is_string($text)||trim($text)==='')throw new RuntimeException('MATERIAL_NOT_READY');
        $title=$data['question'];$sections[]=['title'=>$title,'paragraphs'=>[$text]];
    } elseif($code==='yesno_question'&&preg_match('/^yesno:(yn-(man|love|work|money|choice|future|home)-\d{3}):([0-2]\d:[0-5]\d)$/D',$resource,$m)){
        if(!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D',$m[3]))throw new RuntimeException('MATERIAL_NOT_READY');
        $data=naMaterialJson('moment/yes-no/answers/'.$m[2].'/'.$m[1].'.json',$root);$sum=naReduce(array_sum(str_split(str_replace(':','',$m[3]))),9);if($m[3]==='00:00')$sum=0;
        if(($data['status']??'')!=='approved'||($data['question_id']??'')!==$m[1]||($data['calculation_version']??'')!=='time-digit-sum-v1'||!is_string($data['answers'][(string)$sum]??null))throw new RuntimeException('MATERIAL_NOT_READY');
        $title='Да или нет? · '.$m[1].' · '.$m[3];$sections[]=['title'=>$title,'paragraphs'=>[$data['answers'][(string)$sum]]];
    } elseif($code==='life_full'&&preg_match('/^life:(\d{4}-\d{2}-\d{2})$/D',$resource,$m)){
        $matrix=naMatrix($m[1]);$c=$matrix['corners'];$ch=$matrix['channels'];
        $positions=['impression'=>$matrix['left'],'trueSelf'=>$matrix['center'],'growth'=>$c['bottomRight'],'character'=>$matrix['left'],'parentsPain'=>$c['topLeft'],'familyError'=>$matrix['bottom'],'trueLove'=>$ch['lovePoint'],'partner'=>$ch['lovePoint'],'moneyBlock'=>$matrix['rightSpoke']['outer'],'moneyFlow'=>$matrix['rightSpoke']['near'],'earning'=>$ch['moneyPoint'],'energyLeak'=>$matrix['center'],'health'=>$matrix['center'],'lifeLesson'=>$matrix['bottom']];
        foreach($positions as $key=>$energy){$data=naMaterialJson('knowledge/full-report/sections/energy-'.$energy.'.json',$root);$sections[]=naMaterialSection($data['sections'][$key]??[],$key);}
        $title='Полный разбор жизни · '.$m[1];
    } elseif($code==='compatibility_full'&&preg_match('/^pair:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/D',$resource,$m)){
        $a=naMatrix($m[1]);$b=naMatrix($m[2]);$points=[];foreach(['center','top','bottom','right']as$key)$points[$key]=naReduce($a[$key]+$b[$key]);foreach($a['corners']as$key=>$n)$points[$key]=naReduce($n+$b['corners'][$key]);
        $bottomMid=naReduce(naReduce($a['bottom']+$a['center'])+naReduce($b['bottom']+$b['center']));
        $money=naReduce(naReduce($a['right']+$a['center'])+naReduce($b['right']+$b['center']));
        $nearBottom=naReduce(naReduce($a['bottom']+naReduce($a['bottom']+$a['center']))+naReduce($b['bottom']+naReduce($b['bottom']+$b['center'])));
        $lesson=naReduce(naReduce(naReduce($a['corners']['topLeft']+$a['center'])+naReduce($b['corners']['topLeft']+$b['center']))+naReduce(naReduce($a['corners']['topRight']+$a['center'])+naReduce($b['corners']['topRight']+$b['center'])));
        $positions=['pairEssence'=>$points['center'],'meetingMeaning'=>$points['top'],'attraction'=>$points['bottomLeft'],'emotions'=>naReduce($points['topLeft']+$points['topRight']),'realLife'=>$points['bottom'],'sex'=>naReduce($points['bottomLeft']+$points['bottomRight']),'money'=>$money,'conflict'=>$nearBottom,'lesson'=>$lesson,'swings'=>naReduce($points['bottomLeft']+$bottomMid),'future'=>naReduce($points['right']+naReduce($a['purpose']['social']+$b['purpose']['social'])),'actions'=>$points['center'],'honestFinal'=>$points['center']];
        $titles=['pairEssence'=>'Что между вами на самом деле','meetingMeaning'=>'Зачем вы встретились','attraction'=>'Почему тянет друг к другу','emotions'=>'Как вы чувствуете друг друга','realLife'=>'Совместимость в обычной жизни','sex'=>'Страсть и близость','money'=>'Деньги вдвоём','conflict'=>'Из-за чего ссоритесь','lesson'=>'Чему учите друг друга','swings'=>'Любовь или эмоциональные качели','future'=>'Есть ли у отношений будущее','actions'=>'Как вывести отношения в плюс','honestFinal'=>'Честный итог: что делать дальше'];
        foreach($positions as$key=>$energy){$data=naMaterialJson('data/compatibility/deep/energy-'.$energy.'.json',$root);$sections[]=naMaterialSection($data['blocks'][$key]??[],$titles[$key]);}
        $title='Совместимость · '.$m[1].' и '.$m[2];
    } elseif($code==='child_full_v1'&&preg_match('/^child:(\d{4}-\d{2}-\d{2})$/D',$resource,$m)){
        $a=naMatrix($m[1]);$c=$a['corners'];$positions=['character'=>$a['left'],'comfort'=>$a['center'],'talents'=>$a['top'],'learning'=>$a['left'],'parenting'=>$c['topLeft'],'activities'=>$a['right'],'recovery'=>$a['bottom'],'emotions'=>$c['topRight'],'purpose'=>$a['purpose']['personal'],'mistakes'=>$a['leftSpoke']['outer'],'lifeLessons'=>$a['purpose']['general'],'parentMistakes'=>$c['topLeft'],'gifts'=>$a['left'],'games'=>$a['topSpoke']['near'],'parentChildLessons'=>$c['bottomLeft'],'familyFeelings'=>$c['bottomLeft'],'independence'=>$c['bottomRight'],'learningHelp'=>$a['leftSpoke']['near'],'interests'=>$a['rightSpoke']['near'],'money'=>$a['channels']['moneyPoint']];
        foreach($positions as$key=>$energy){$data=naMaterialJson('child/data/matrix/sections/energy-'.$energy.'.json',$root);if(!in_array($data['status']??'',['ready','complete'],true))throw new RuntimeException('MATERIAL_NOT_READY');$sections[]=naMaterialSection($data['sections'][$key]??[],$key);}
        $tail=$a['tail']['first'].'-'.$a['tail']['second'].'-'.$a['bottom'];$data=naMaterialJson('child/data/matrix/karmic-tail/'.$tail.'.json',$root);if(!in_array($data['status']??'',['ready','complete'],true))throw new RuntimeException('MATERIAL_NOT_READY');$sections[]=naMaterialSection($data,'Кармический хвост');
        $title='Детский разбор · '.$m[1];
    } elseif($code==='club_month'&&$resource==='club'){
        $rituals=naMaterialJson('data/money-rituals.json',$root);foreach($rituals as$ritual)$sections[]=naMaterialSection($ritual,'Денежный ритуал');$title='Материалы клуба';
    } elseif($code==='school_week'&&$resource==='school'){
        $list=naMaterialJson('school-allowlist.json',$root);if(count($list)<20)throw new RuntimeException('MATERIAL_NOT_READY');
        foreach($list as$path)naMaterialRead($path,$root);
        $title='Школа нумерологии';$sections[]=['title'=>$title,'paragraphs'=>['Уроки доступны во время оплаченной подписки.']];$links[]=['title'=>'Открыть школу','url'=>'/pro/schools/'];
    }else throw new RuntimeException('MATERIAL_NOT_READY');
    if(!$sections)throw new RuntimeException('MATERIAL_NOT_READY');
    return ['title'=>$title,'sections'=>$sections,'links'=>$links,'pdf_available'=>!in_array($code,['school_week','club_month'],true)];
}
function naMaterialEntitlement(PDO $db,array $account,string $id): ?array {
    // Once REAL mode is selected, sandbox entitlements must not open paid content.
    $providerOnly=function_exists('naLiveWalletModeSelected')&&naLiveWalletModeSelected()
        ?" AND o.provider IN ('real_wallet','real_subscription')":"";
    $q=$db->prepare("SELECT e.* FROM numi_entitlements e
        JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id
        WHERE e.id=? AND e.account_id=? AND e.status='active'
          AND (e.expires_at IS NULL OR e.expires_at>UTC_TIMESTAMP())
          AND o.status='paid' AND o.verified_at IS NOT NULL $providerOnly");
    $q->execute([$id,$account['id']]);return $q->fetch()?:null;
}
function naMaterialServe(PDO $db,array $body): never {
    $account=naCurrent($db);if(!$account)naReply(401,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
    $id=$body['entitlement_id']??null;if(!is_string($id)||!preg_match('/^[a-f0-9-]{36}$/D',$id))naReply(400,['ok'=>false,'error'=>'INVALID_ENTITLEMENT']);
    $entitlement=naMaterialEntitlement($db,$account,$id);if(!$entitlement)naReply(403,['ok'=>false,'error'=>'ACCESS_REQUIRED']);
    try{$doc=naMaterialBuild($entitlement['product_code'],$entitlement['resource_id']);
        if($entitlement['product_code']==='club_month'){
            $birth=$account['birth_date']??null;
            if(!is_string($birth)||!naCatalogDate($birth))naReply(409,['ok'=>false,'error'=>'PROFILE_BIRTH_REQUIRED']);
            [$y,$m,$d]=array_map('intval',explode('-',$birth));$code=naReduce($d,9).naReduce($m,9).naReduce(array_sum(str_split((string)$y)),9).naReduce(array_sum(str_split(str_replace('-','',$birth))),9);
            foreach($doc['sections']as&$section)foreach($section['paragraphs']as&$paragraph)$paragraph=str_replace('{code}',$code,$paragraph);unset($section,$paragraph);
        }
        naReply(200,['ok'=>true,'material'=>$doc,'entitlement_id'=>$id]);}
    catch(Throwable $e){naReply(409,['ok'=>false,'error'=>'MATERIAL_NOT_READY']);}
}
