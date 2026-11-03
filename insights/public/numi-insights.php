<?php
declare(strict_types=1);
/* First-party analytics v2. Client events never create orders or grant access. */
const NI_VERSION='2.1.0';
const NI_OWNER_HASH='f289c5906895cbbd1b42d74e4e2e07d531fc1af4e91bcf7e5700835856003d29';
const NI_SECTIONS=['home','day','year','full','redflag','compatibility','children','money','moment','yes-no','school','club','other'];
const NI_TYPES=['page','impression','click','open','category','offer','checkout_once','checkout_club','search'];
function niReply(int $status,array $data): never {
    http_response_code($status);header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);exit;
}
function niOrigin(): bool {
    $origin=$_SERVER['HTTP_ORIGIN']??'';
    $host=$_SERVER['HTTP_HOST']??'';
    return in_array($host,['xn--c1adkkdfjbp1a4l.online','www.xn--c1adkkdfjbp1a4l.online'],true)
        && $origin==='https://'.$host;
}
function niSchema(PDO $db): void {
    try {$db->query('SELECT id FROM numi_insights_events LIMIT 0');$db->query('SELECT id FROM numi_insights_intents LIMIT 0');return;}
    catch(PDOException $e) {if(!in_array($e->getCode(),['42S02','42P01'],true))throw $e;}
    $db->exec("CREATE TABLE IF NOT EXISTS numi_insights_events (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      event_type VARCHAR(24) CHARACTER SET ascii NOT NULL,
      section VARCHAR(24) CHARACTER SET ascii NOT NULL,
      item VARCHAR(80) CHARACTER SET ascii NOT NULL DEFAULT '-',
      title VARCHAR(180) NOT NULL DEFAULT '',
      source VARCHAR(96) CHARACTER SET ascii NOT NULL DEFAULT 'direct',
      campaign VARCHAR(64) CHARACTER SET ascii NOT NULL DEFAULT '-',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY ix_ni_event_time(created_at),KEY ix_ni_row(section,item,created_at),
      KEY ix_ni_session(session_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS numi_insights_intents (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
      section VARCHAR(24) CHARACTER SET ascii NOT NULL,
      item VARCHAR(80) CHARACTER SET ascii NOT NULL,
      title VARCHAR(180) NOT NULL DEFAULT '',
      plan VARCHAR(16) CHARACTER SET ascii NOT NULL,
      source VARCHAR(96) CHARACTER SET ascii NOT NULL,
      campaign VARCHAR(64) CHARACTER SET ascii NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY ix_ni_intent_account(account_id,created_at),KEY ix_ni_intent_session(session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function niOwner(?array $user): bool {
    return $user!==null&&!empty($user['email_verified_at'])&&is_string($user['email']??null)
        &&hash_equals(NI_OWNER_HASH,hash('sha256',strtolower($user['email'])));
}
function niUuid(mixed $v): bool {return is_string($v)&&preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/Di',$v)===1;}
function niEvent(array $e): array {
    if(!niUuid($e['id']??null)||!niUuid($e['session']??null)
      ||!in_array($e['type']??null,NI_TYPES,true)||!in_array($e['section']??null,NI_SECTIONS,true))throw new InvalidArgumentException('EVENT');
    foreach(['item'=>80,'source'=>96,'campaign'=>64] as $key=>$length){
        $value=$e[$key]??($key==='source'?'direct':'-');
        if(!is_string($value)||strlen($value)>$length||!preg_match('/^[a-zA-Z0-9_.:-]+$/D',$value))throw new InvalidArgumentException('TAG');
        $e[$key]=$value;
    }
    $title=$e['title']??'';
    if(!is_string($title)||strlen($title)>720||preg_match_all('/./us',$title)>180||preg_match('/[\x00-\x1f<>@]|\d{2}[.\/-]\d{2}[.\/-]\d{4}/u',$title))throw new InvalidArgumentException('TITLE');
    $e['title']=$title;
    return $e;
}
function niSection(string $code): string {
    $code=strtolower($code);
    foreach(['redflag'=>'redflag','compat'=>'compatibility','child'=>'children','year'=>'year','moment'=>'moment','yes-no'=>'yes-no','money'=>'money','wealth'=>'money','full'=>'full','matrix'=>'full','club'=>'club','subscription'=>'club','membership'=>'club'] as $match=>$section){if(str_contains($code,$match))return $section;}
    return 'other';
}
function niIsClub(string $code): bool {return preg_match('/club|subscription|membership/i',$code)===1;}
function niRow(string $section,string $item,string $title=''): array {
    return ['section'=>$section,'item'=>$item,'title'=>$title,'impressions'=>0,'clicks'=>0,'opens'=>0,'offers'=>0,'checkout_once'=>0,'checkout_club'=>0,'orders'=>0,'subscriptions'=>0,'revenue'=>0,'subscription_revenue'=>0,'ctr'=>null,'conversion'=>null,'club_conversion'=>null,'_impressed'=>0,'_clicked'=>0,'_opened'=>0,'_buyers'=>[]];
}
function niReport(PDO $db,string $from,string $to): array {
    $start=$from.' 00:00:00';$end=(new DateTimeImmutable($to,new DateTimeZone('Europe/Samara')))->modify('+1 day')->format('Y-m-d').' 00:00:00';
    // Store UTC, interpret date controls in Samara time (UTC+4).
    $start=(new DateTimeImmutable($start,new DateTimeZone('Europe/Samara')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $end=(new DateTimeImmutable($end,new DateTimeZone('Europe/Samara')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $q=$db->prepare("SELECT section,item,MAX(title) title,
      SUM(event_type='impression') impressions,SUM(event_type='click') clicks,SUM(event_type IN ('open','page')) opens,
      SUM(event_type='offer') offers,SUM(event_type='checkout_once') checkout_once,SUM(event_type='checkout_club') checkout_club,
      COUNT(DISTINCT CASE WHEN event_type='impression' THEN session_id END) _impressed,
      COUNT(DISTINCT CASE WHEN event_type='click' THEN session_id END) _clicked,
      COUNT(DISTINCT CASE WHEN event_type IN ('open','page') THEN session_id END) _opened
      FROM numi_insights_events WHERE created_at>=? AND created_at<? GROUP BY section,item");$q->execute([$start,$end]);
    $rows=[];
    foreach($q->fetchAll(PDO::FETCH_ASSOC) as $r){$key=$r['section'].':'.$r['item'];$row=niRow($r['section'],$r['item'],$r['title']);foreach($r as $k=>$v)if(is_int($row[$k]??null))$row[$k]=(int)$v;$rows[$key]=$row;}
    $q=$db->prepare("SELECT source,campaign,COUNT(DISTINCT session_id) sessions,SUM(event_type='page') pages,SUM(event_type='click') clicks,SUM(event_type IN ('checkout_once','checkout_club')) checkouts FROM numi_insights_events WHERE created_at>=? AND created_at<? GROUP BY source,campaign");$q->execute([$start,$end]);
    $sources=[];foreach($q->fetchAll(PDO::FETCH_ASSOC) as $r){foreach(['sessions','pages','clicks','checkouts'] as $k)$r[$k]=(int)$r[$k];$r+=['orders'=>0,'subscriptions'=>0,'revenue'=>0];$sources[$r['source'].':'.$r['campaign']]=$r;}
    $q=$db->prepare("SELECT DATE(DATE_ADD(created_at,INTERVAL 4 HOUR)) day,COUNT(DISTINCT session_id) sessions,SUM(event_type='click') clicks FROM numi_insights_events WHERE created_at>=? AND created_at<? GROUP BY day ORDER BY day");$q->execute([$start,$end]);$days=$q->fetchAll(PDO::FETCH_ASSOC);
    $q=$db->prepare("SELECT id,product_code,resource_id,amount_kopeks,currency,created_at,verified_at FROM numi_orders WHERE status='paid' AND verified_at IS NOT NULL AND verified_at>=? AND verified_at<? AND amount_kopeks>0 AND currency='RUB' AND provider IS NOT NULL AND provider<>'test' AND provider<>'sandbox' ORDER BY verified_at LIMIT 10000");$q->execute([$start,$end]);
    $orders=$q->fetchAll(PDO::FETCH_ASSOC);$attributed=0;$clubTotal=0;$revenue=0;
    $dayMap=[];foreach($days as $d){$d['sessions']=(int)$d['sessions'];$d['clicks']=(int)$d['clicks'];$d['orders']=0;$dayMap[$d['day']]=$d;}
    foreach($orders as $o){
        $club=niIsClub($o['product_code']);$clubTotal+=(int)$club;$amount=(int)$o['amount_kopeks']/100;$revenue+=$amount;$section=niSection($o['product_code']);$plan=$club?'club':'once';
        $paidDay=(new DateTimeImmutable($o['verified_at'],new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Europe/Samara'))->format('Y-m-d');
        if(!isset($dayMap[$paidDay]))$dayMap[$paidDay]=['day'=>$paidDay,'sessions'=>0,'clicks'=>0,'orders'=>0];$dayMap[$paidDay]['orders']++;
        // Until checkout passes anonymous order context, report payments only by product.
        $a=['section'=>$section,'item'=>'-','title'=>'','source'=>'unattributed','campaign'=>'-'];
        $key=$a['section'].':'.$a['item'];if(!isset($rows[$key]))$rows[$key]=niRow($a['section'],$a['item'],$a['title']);
        $rows[$key]['orders']++;$rows[$key]['subscriptions']+=(int)$club;$rows[$key]['revenue']+=$amount;if($club)$rows[$key]['subscription_revenue']+=$amount;
        $sk=$a['source'].':'.$a['campaign'];if(!isset($sources[$sk]))$sources[$sk]=['source'=>$a['source'],'campaign'=>$a['campaign'],'sessions'=>0,'pages'=>0,'clicks'=>0,'checkouts'=>0,'orders'=>0,'subscriptions'=>0,'revenue'=>0];
        $sources[$sk]['orders']++;$sources[$sk]['subscriptions']+=(int)$club;$sources[$sk]['revenue']+=$amount;
    }
    foreach($rows as &$r){$r['ctr']=$r['_impressed']>0?round(100*$r['_clicked']/$r['_impressed'],2):null;
        // Orders/session is a conversion ratio, not unique-person conversion.
        $den=max($r['_opened'],$r['_clicked']);$r['conversion']=$den>0?round(100*$r['orders']/$den,2):null;$r['club_conversion']=$den>0?round(100*$r['subscriptions']/$den,2):null;
        unset($r['_impressed'],$r['_clicked'],$r['_opened'],$r['_buyers']);}unset($r);
    $q=$db->prepare('SELECT COUNT(DISTINCT session_id) FROM numi_insights_events WHERE created_at>=? AND created_at<?');$q->execute([$start,$end]);$sessions=(int)$q->fetchColumn();
    ksort($dayMap);
    return ['ok'=>true,'version'=>NI_VERSION,'from'=>$from,'to'=>$to,'timezone'=>'Europe/Samara','rows'=>array_values($rows),'sources'=>array_values($sources),'days'=>array_values($dayMap),
      'totals'=>['sessions'=>$sessions,'orders'=>count($orders),'subscriptions'=>$clubTotal,'revenue'=>$revenue,'attributed'=>$attributed,'unattributed'=>count($orders)-$attributed],
      'payment_status'=>'waiting_for_provider','attribution'=>'aggregate_product_only','generated_at'=>gmdate('c')];
}
function niMain(): never {
    header('Cache-Control: no-store, private, max-age=0');header('X-Content-Type-Options: nosniff');header('X-Frame-Options: DENY');header('Referrer-Policy: no-referrer');
    try {
        require_once dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
        $db=naDB();$db->exec("SET time_zone='+00:00'");niSchema($db);
        $method=$_SERVER['REQUEST_METHOD']??'GET';$action=$_GET['action']??'';
        if($method==='GET'&&$action==='health')niReply(200,['ok'=>true,'version'=>NI_VERSION,'database'=>true]);
        if($method==='POST'){
            if(!niOrigin())niReply(403,['ok'=>false,'error'=>'ORIGIN_DENIED']);
            if((int)($_SERVER['CONTENT_LENGTH']??0)>24000)niReply(413,['ok'=>false,'error'=>'TOO_LARGE']);
            $raw=file_get_contents('php://input',false,null,0,24001);if(!is_string($raw)||strlen($raw)>24000)niReply(413,['ok'=>false,'error'=>'TOO_LARGE']);
            $data=json_decode($raw,true,12,JSON_THROW_ON_ERROR);$events=$data['events']??null;
            if(!is_array($events)||count($events)<1||count($events)>20)niReply(400,['ok'=>false,'error'=>'BAD_BATCH']);
            $events=array_map(fn($e)=>is_array($e)?niEvent($e):throw new InvalidArgumentException('EVENT'),$events);
            $sid=$events[0]['session'];foreach($events as $e)if($e['session']!==$sid)throw new InvalidArgumentException('SESSION');
            $limit=$db->prepare('SELECT COUNT(*) FROM numi_insights_events WHERE session_id=? AND created_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE)');$limit->execute([$sid]);
            if((int)$limit->fetchColumn()>240)niReply(429,['ok'=>false,'error'=>'RATE_LIMIT']);
            // Aggregate collection does not read visitor accounts or cookies.
            $account=null;
            $insert=$db->prepare('INSERT IGNORE INTO numi_insights_events(id,session_id,event_type,section,item,title,source,campaign) VALUES(?,?,?,?,?,?,?,?)');
            $save=$db->prepare('INSERT IGNORE INTO numi_insights_intents(id,session_id,account_id,section,item,title,plan,source,campaign) VALUES(?,?,?,?,?,?,?,?,?)');
            $db->beginTransaction();
            foreach($events as $e){$insert->execute([$e['id'],$sid,$e['type'],$e['section'],$e['item'],$e['title'],$e['source'],$e['campaign']]);
                if(in_array($e['type'],['checkout_once','checkout_club'],true))$save->execute([$e['id'],$sid,$account,$e['section'],$e['item'],$e['title'],$e['type']==='checkout_club'?'club':'once',$e['source'],$e['campaign']]);}
            $db->commit();niReply(200,['ok'=>true,'accepted'=>count($events)]);
        }
        if($method!=='GET')niReply(405,['ok'=>false,'error'=>'METHOD']);
        $owner=niOwner(naCurrent($db));
        if($action==='session')niReply(200,['ok'=>true,'owner'=>$owner]);
        if(!$owner)niReply(401,['ok'=>false,'error'=>'OWNER_LOGIN_REQUIRED']);
        $today=(new DateTimeImmutable('now',new DateTimeZone('Europe/Samara')))->format('Y-m-d');
        $from=$_GET['from']??$today;$to=$_GET['to']??$today;
        foreach([$from,$to] as $day)if(!is_string($day)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$day)||(new DateTimeImmutable($day))->format('Y-m-d')!==$day)niReply(400,['ok'=>false,'error'=>'BAD_DATE']);
        if($from>$to||$to>$today||(strtotime($to)-strtotime($from))>366*86400)niReply(400,['ok'=>false,'error'=>'BAD_RANGE']);
        niReply(200,niReport($db,$from,$to));
    } catch(JsonException|InvalidArgumentException $e){niReply(400,['ok'=>false,'error'=>'BAD_REQUEST']);}
    catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();error_log('NUMI_INSIGHTS_V2 '.get_class($e).' '.preg_replace('/[^a-zA-Z0-9_ .:-]/',' ',substr($e->getMessage(),0,180)));niReply(503,['ok'=>false,'error'=>'INSIGHTS_UNAVAILABLE']);}
}
if(!defined('NI_TEST'))niMain();
