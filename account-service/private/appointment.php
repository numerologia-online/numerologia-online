<?php
declare(strict_types=1);
/** Separate bookings; no existing wallet balances/orders/configuration changed. */
require_once __DIR__.'/wallet-real-payment.php';
function apServices(): array {
    return ['life'=>['Полный разбор жизни',1000000],
        'couple'=>['Полный разбор совместимости',1000000],
        'child'=>['Полный разбор ребёнка',1000000],
        'year'=>['Персональный разбор года',300000]];
}
function apWindow(?DateTimeImmutable $now=null): array {
    $tz=new DateTimeZone('Europe/Samara');
    $now=($now??new DateTimeImmutable('now',$tz))->setTimezone($tz)->setTime(0,0);
    return [max('2026-12-08',$now->modify('+1 day')->format('Y-m-d')),$now->modify('+90 days')->format('Y-m-d')];
}
function apWeekend(string $date): bool {
    return (int)(new DateTimeImmutable($date,new DateTimeZone('Europe/Samara')))->format('N')>=6;
}
function apConfig(): array {
    $path=dirname(__DIR__).'/numi-appointment/config.local.php';
    $c=is_file($path)?require $path:[];
    return is_array($c)?$c:[];
}
function apEnabled(array $a,array $w): bool {
    return naRealWalletGate($w)&&($a['enabled']??false)===true
       &&($a['fiscal_reviewed']??false)===true&&($a['webhook_verified']??false)===true
       &&($a['delivery_and_refunds_reviewed']??false)===true
       &&is_int($a['vat_code']??null)&&$a['vat_code']>=1&&$a['vat_code']<=12
       &&naEmail($a['owner_email']??null)!==null;
}
function apSchema(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS numi_appointments (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      slot_date DATE NOT NULL, active_date DATE NULL, service VARCHAR(16) NOT NULL,
      kopeks INT UNSIGNED NOT NULL, email VARCHAR(191) NOT NULL, telegram VARCHAR(33) NULL,
      vat_code TINYINT UNSIGNED NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      provider_payment_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
      confirmation_url TEXT NULL, notified_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY ap_one_slot(active_date), UNIQUE KEY ap_payment(provider_payment_id),
      KEY ap_account(account_id,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $q=$db->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='numi_appointments' AND COLUMN_NAME='telegram'");
    if(!(int)$q->fetchColumn()){
        try{$db->exec("ALTER TABLE numi_appointments ADD COLUMN telegram VARCHAR(33) NULL AFTER email");}
        catch(PDOException $e){if((int)($e->errorInfo[1]??0)!==1060)throw $e;}
    }
}
function apRow(PDO $db,string $id): ?array {
    $q=$db->prepare('SELECT * FROM numi_appointments WHERE id=?');
    $q->execute([$id]);return $q->fetch()?:null;
}
function apTelegram(mixed $input): ?string {
    if(!is_string($input))return null;
    $input=trim($input);
    if(!preg_match('/^@?[A-Za-z][A-Za-z0-9_]{3,30}[A-Za-z0-9]$/D',$input))return null;
    return '@'.strtolower(ltrim($input,'@'));
}
function apAmount(int $k): string {return sprintf('%d.%02d',intdiv($k,100),$k%100);}
function apPayload(array $r): array {
    $title=apServices()[$r['service']][0];
    $amount=['value'=>apAmount((int)$r['kopeks']),'currency'=>'RUB'];
    return ['amount'=>$amount,'capture'=>true,
      'confirmation'=>['type'=>'redirect','return_url'=>NUMI_ACCOUNT_ORIGIN.'/appointment.html?booking='.$r['id']],
      'description'=>$title,'metadata'=>['numi_appointment'=>$r['id']],
      'receipt'=>['customer'=>['email'=>$r['email']],'items'=>[[
         'description'=>$title,'quantity'=>1.0,'amount'=>$amount,
         'vat_code'=>(int)$r['vat_code'],'payment_mode'=>'full_prepayment','payment_subject'=>'service'
      ]]]];
}
function apVerified(array $r,array $p): bool {
    return ($p['test']??true)===false
       &&is_string($p['id']??null)&&preg_match('/^[A-Za-z0-9-]{1,191}$/D',$p['id'])===1
       &&(!$r['provider_payment_id']||$r['provider_payment_id']===$p['id'])
       &&($p['metadata']['numi_appointment']??null)===$r['id']
       &&($p['amount']['currency']??null)==='RUB'
       &&($p['amount']['value']??null)===apAmount((int)$r['kopeks']);
}
function apApply(PDO $db,array $r,array $p,array $cfg): array {
    if(!apVerified($r,$p))throw new RuntimeException('PAYMENT_VERIFICATION_FAILED');
    $status=$p['status']??null;
    if(!in_array($status,['pending','waiting_for_capture','succeeded','canceled'],true))throw new RuntimeException('PAYMENT_VERIFICATION_FAILED');
    $new=$status==='succeeded'&&($p['paid']??false)===true?'paid':($status==='canceled'?'canceled':'pending');
    $url=naRealPaymentConfirmationUrl($p);
    $db->beginTransaction();
    try{
        $q=$db->prepare('SELECT * FROM numi_appointments WHERE id=? FOR UPDATE');$q->execute([$r['id']]);$fresh=$q->fetch();
        if(!$fresh||!apVerified($fresh,$p))throw new RuntimeException('PAYMENT_VERIFICATION_FAILED');
        if($fresh['status']==='pending'){
            $db->prepare('UPDATE numi_appointments SET provider_payment_id=?, confirmation_url=COALESCE(?,confirmation_url), status=?, active_date=IF(?=\'canceled\',NULL,active_date) WHERE id=?')
              ->execute([$p['id'],$url,$new,$new,$r['id']]);
        }
        $db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    $fresh=apRow($db,$r['id']);
    // Claim notification once. If mail fails, a future status check can retry.
    if($fresh['status']==='paid'&&!$fresh['notified_at']){
        $q=$db->prepare('UPDATE numi_appointments SET notified_at=UTC_TIMESTAMP() WHERE id=? AND notified_at IS NULL');
        $q->execute([$r['id']]);
        if($q->rowCount()===1){
            $text=apServices()[$fresh['service']][0]."\nДата: ".$fresh['slot_date']."\nEmail: ".$fresh['email']."\nTelegram: ".($fresh['telegram']??'Не указан')."\nОплата: ".apAmount((int)$fresh['kopeks'])." RUB\nID: ".$fresh['provider_payment_id']."\nПосле оказания услуги оформите чек зачета предоплаты.";
            if(!naMail($cfg['owner_email'],'Новая оплаченная личная запись',$text)){
                $db->prepare('UPDATE numi_appointments SET notified_at=NULL WHERE id=?')->execute([$r['id']]);
            }
        }
    }
    return $fresh;
}
function apSync(PDO $db,array $r,array $w,array $a,bool $create=false): array {
    if($r['status']!=='pending')return $r;
    if($r['provider_payment_id']){
        $p=naRealWalletFetchPayment($w,$r['provider_payment_id']);
    }else{
        // An uncertain POST never releases the slot or uses a new idempotence key.
        if(!$create||strtotime($r['created_at'].' UTC')<time()-23*3600) return $r;
        $p=naRealPaymentTransport($w,$r['id'],apPayload($r));
    }
    return apApply($db,$r,$p,$a);
}
function apPublic(array $r): array {
    return ['ok'=>true,'id'=>$r['id'],'date'=>$r['slot_date'],'status'=>$r['status'],
        'url'=>$r['status']==='pending'?$r['confirmation_url']:null];
}
function apServe(): never {
    naHeaders();
    try{
        $action=$_GET['action']??'calendar';$a=apConfig();$w=naRealWalletConfig();$enabled=apEnabled($a,$w);
        [$first,$last]=apWindow();
        if($action==='calendar'){
            $slots=[];$owner=false;
            if($enabled){
                $db=naDB();apSchema($db);$owner=naTestOwner(naCurrent($db));
                $q=$db->prepare('SELECT slot_date,service,status FROM numi_appointments WHERE active_date BETWEEN ? AND ?');$q->execute([$first,$last]);
                foreach($q as $r)$slots[$r['slot_date']]=['status'=>$r['status'],'service'=>$r['status']==='paid'?$r['service']:null];
            }
            naReply(200,['ok'=>true,'enabled'=>$enabled,'first'=>$first,'last'=>$last,'slots'=>(object)$slots,'owner'=>$owner]);
        }
        if(!$enabled)naReply(503,['ok'=>false,'error'=>'BOOKING_DISABLED']);
        $db=naDB();apSchema($db);
        if($action==='notify'){
            if(($_SERVER['REQUEST_METHOD']??'')!=='POST')naReply(405,['ok'=>false]);
            $raw=file_get_contents('php://input',false,null,0,32769);
            if(!is_string($raw)||strlen($raw)>32768)naReply(400,['ok'=>false]);
            $body=json_decode($raw,true,20,JSON_THROW_ON_ERROR);$p0=$body['object']??[];
            $id=$p0['metadata']['numi_appointment']??null;$pid=$p0['id']??null;
            if(!is_string($id)||!is_string($pid)||!preg_match('/^[a-f0-9-]{36}$/D',$id)||!preg_match('/^[A-Za-z0-9-]{1,191}$/D',$pid))naReply(200,['ok'=>true]);
            $r=apRow($db,$id);
            if(!$r||($r['provider_payment_id']&&$r['provider_payment_id']!==$pid))naReply(200,['ok'=>true]);
            // Webhook is only a hint: verify with the shop's authenticated API.
            $p=naRealWalletFetchPayment($w,$pid);apApply($db,$r,$p,$a);
            naReply(200,['ok'=>true]);
        }
        $account=naCurrent($db);
        if(!$account)naReply(401,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
        if($action==='owner'){
            if(!naTestOwner($account))naReply(403,['ok'=>false]);
            $rows=$db->query('SELECT slot_date AS date,service,status,email,telegram,provider_payment_id AS payment_id FROM numi_appointments ORDER BY slot_date DESC LIMIT 200')->fetchAll();
            naReply(200,['ok'=>true,'bookings'=>$rows]);
        }
        $b=naReadPost();
        if($action==='status'){
            $id=$b['id']??null;
            if(is_string($id))$r=apRow($db,$id);else{
                $q=$db->prepare("SELECT * FROM numi_appointments WHERE account_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1");$q->execute([$account['id']]);$r=$q->fetch();
            }
            if(!$r||$r['account_id']!==$account['id'])naReply(404,['ok'=>false,'error'=>'BOOKING_NOT_FOUND']);
            naReply(200,apPublic(apSync($db,$r,$w,$a,true)));
        }
        if($action!=='create')naReply(404,['ok'=>false]);
        $s=$b['service']??null;$date=$b['date']??null;$email=naEmail($b['email']??null);$telegram=apTelegram($b['telegram']??null);
        if(!is_string($s)||!isset(apServices()[$s])||!is_string($date)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date)||!checkdate((int)substr($date,5,2),(int)substr($date,8,2),(int)substr($date,0,4))||!$email||!$telegram||($b['accepted']??null)!==true)
            naReply(400,['ok'=>false,'error'=>'INVALID_BOOKING']);
        if($date<$first||$date>$last||apWeekend($date))naReply(409,['ok'=>false,'error'=>'SLOT_UNAVAILABLE']);
        // Serialize per account and let the unique active date enforce one reservation per day.
        $db->beginTransaction();
        try{
            $q=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');$q->execute([$account['id']]);
            $q=$db->prepare("SELECT * FROM numi_appointments WHERE account_id=? AND status='pending' LIMIT 1 FOR UPDATE");$q->execute([$account['id']]);$r=$q->fetch();
            if($r&&($r['slot_date']!==$date||$r['service']!==$s||$r['email']!==$email||($r['telegram']!==null&&$r['telegram']!==$telegram))){
                $db->rollBack();naReply(409,['ok'=>false,'error'=>'PENDING_LIMIT']);
            }
            if(!$r){
                $id=naUuid();$q=$db->prepare('INSERT INTO numi_appointments(id,account_id,slot_date,active_date,service,kopeks,email,telegram,vat_code) VALUES(?,?,?,?,?,?,?,?,?)');
                $q->execute([$id,$account['id'],$date,$date,$s,apServices()[$s][1],$email,$telegram,$a['vat_code']]);$r=apRow($db,$id);
            }
            $db->commit();
        }catch(PDOException $e){if($db->inTransaction())$db->rollBack();if($e->getCode()==='23000')naReply(409,['ok'=>false,'error'=>'SLOT_UNAVAILABLE']);throw $e;}
        catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
        try{naReply(200,apPublic(apSync($db,$r,$w,$a,true)));}
        catch(Throwable $e){naReply(503,['ok'=>false,'error'=>'PAYMENT_UNCERTAIN','id'=>$r['id']]);}
    }catch(Throwable $e){
        error_log('numi_appointment: '.get_class($e));
        naReply(503,['ok'=>false,'error'=>'TEMPORARILY_UNAVAILABLE']);
    }
}
