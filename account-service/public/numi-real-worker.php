<?php
declare(strict_types=1);
/**
 * HTTPS-only private automation gateway. The scheduler knows a derived token;
 * only its SHA256 digest is stored outside the webroot on REG.RU.
 * This endpoint accepts NO money, account, payment, or receipt inputs.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){
    http_response_code(405);echo '{"ok":false,"error":"METHOD_NOT_ALLOWED"}';exit;
}
$cfgFile=dirname(__DIR__,3).'/private/numi-wallet-live/worker.local.php';
if(!is_file($cfgFile)){
    http_response_code(503);echo '{"ok":false,"error":"WORKER_NOT_CONFIGURED"}';exit;
}
$settings=require $cfgFile;
$token=$_SERVER['HTTP_X_NUMI_WORKER_TOKEN']??'';
if(!is_array($settings)
   ||!is_string($token) || strlen($token)!==64
   ||!preg_match('/^[a-f0-9]{64}$/D',$token)
   ||!is_string($settings['worker_token_hash']??null)
   ||!hash_equals($settings['worker_token_hash'],hash('sha256',$token))){
    http_response_code(403);echo '{"ok":false,"error":"WORKER_FORBIDDEN"}';exit;
}
$raw=file_get_contents('php://input',false,null,0,1000);
if($raw===false||strlen($raw)>900){
    http_response_code(400);echo '{"ok":false,"error":"INVALID_WORKER_REQUEST"}';exit;
}
$request=json_decode($raw,true);
$action=is_array($request)?($request['action']??null):null;
if(!in_array($action,['tick','migrate','probe'],true)){
    http_response_code(400);echo '{"ok":false,"error":"INVALID_WORKER_ACTION"}';exit;
}
try{
    require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
    require dirname(__DIR__,3).'/private/numi-account-20261031/wallet-real-worker.php';
    if($action==='probe'){
        // Safe read-only credential verification. Never expose key, shop ID,
        // provider payment records, or identifying customer data.
        $live=naRealWalletConfig();
        $required=[
            'real_wallet_enabled','fiscalization_verified','refunds_verified',
            'advance_offset_receipts_verified','offset_receipt_worker_verified',
            'refund_worker_verified','advance_receipt_reviewed',
            'offset_receipt_reviewed','launch_approved',
        ];
        $flags=[];
        foreach($required as $flag)$flags[$flag]=($live[$flag]??false)===true;
        $validKey=is_string($live['secret_key']??null)
            && preg_match('/^live_[A-Za-z0-9_-]{12,480}$/D',$live['secret_key'])===1;
        $validShop=preg_match('/^[0-9]+$/D',(string)($live['shop_id']??''))===1;
        $authenticated=false;
        if($validKey&&$validShop){
            $curl=curl_init('https://api.yookassa.ru/v3/payments?limit=1');
            if($curl!==false){
                try{
                    curl_setopt_array($curl,[
                        CURLOPT_RETURNTRANSFER=>true,
                        CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,
                        CURLOPT_FOLLOWLOCATION=>false,
                        CURLOPT_USERPWD=>$live['shop_id'].':'.$live['secret_key'],
                        CURLOPT_HTTPHEADER=>['Accept: application/json'],
                    ]);
                    $body=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);
                }finally{curl_close($curl);}
                $authenticated=is_string($body)&&$status===200;
            }
        }
        // Protected read-only-style diagnostic for the newly activated REAL wallet.
        // Exercise the same account status code in a rolled-back transaction;
        // return only exception type/code and no account data or credentials.
        $walletStatusCheck=['result'=>'unavailable'];
        $probeDb=null;
        try {
            $probeDb=naDB();
            $sampleId=$probeDb->query('SELECT id FROM numi_accounts LIMIT 1')->fetchColumn();
            if(!$sampleId){
                $walletStatusCheck=['result'=>'no_accounts'];
            }else{
                $probeDb->beginTransaction();
                try{
                    naRealWalletStatus($probeDb,['id'=>(string)$sampleId]);
                    // Reproduce the additional subscription query used only by
                    // the live wallet HTTP status route (not the base status helper).
                    $clubQ=$probeDb->prepare("SELECT MAX(e.expires_at) FROM numi_entitlements e
                        JOIN numi_orders o ON o.id=e.order_id AND o.account_id=e.account_id
                        WHERE e.account_id=? AND e.product_code='club_month'
                          AND e.status='active' AND (e.expires_at IS NULL OR e.expires_at>UTC_TIMESTAMP())
                          AND o.status='paid' AND o.verified_at IS NOT NULL AND o.provider='real_wallet'");
                    $clubQ->execute([(string)$sampleId]);
                    $clubQ->fetchColumn();
                    $walletStatusCheck=['result'=>'ok','including_club_query'=>true];
                }finally{
                    if($probeDb->inTransaction())$probeDb->rollBack();
                }
            }
        }catch(Throwable $diagnosticError){
            if($probeDb instanceof PDO && $probeDb->inTransaction())$probeDb->rollBack();
            $walletStatusCheck=['result'=>'error',
                'exception'=>get_class($diagnosticError),
                'code'=>(string)$diagnosticError->getCode()];
            error_log('NUMI_REAL_WALLET_STATUS_DIAG class='.get_class($diagnosticError)
                .' code='.(string)$diagnosticError->getCode());
        }
        echo json_encode(['ok'=>true,'action'=>'probe',
            'private_credentials_present'=>$validKey&&$validShop,
            'provider_authenticated'=>$authenticated,
            'wallet_mode_live'=>($live['wallet_mode']??null)==='live',
            'provider_test_mode_false'=>($live['provider_test_mode']??null)===false,
            'vat_codes_set'=>is_int($live['advance_receipt_vat_code']??null)
                &&is_int($live['offset_receipt_vat_code']??null),
            'flags'=>$flags,'wallet_status_diagnostic'=>$walletStatusCheck],JSON_THROW_ON_ERROR);
        exit;
    }
    $db=naDB();
    if($action==='migrate'){
        // Schema DDL is an explicit authenticated operation, never performed
        // inside a wallet payment or transaction. Additive tables only.
        if(($settings['allow_additive_migration']??false)!==true)
            throw new RuntimeException('WORKER_MIGRATION_DISABLED');
        naRealWalletSchema($db);
        echo '{"ok":true,"action":"migrate","result":"REAL_SCHEMA_READY"}';exit;
    }
    $live=naRealWalletConfig();
    if(!naRealWalletGate($live)){
        http_response_code(503);
        echo '{"ok":false,"error":"LIVE_WALLET_NOT_ACTIVATED"}';exit;
    }
    $result=naRealWalletWorkerTick($db,$live);
    echo json_encode(['ok'=>true,'action'=>'tick','results'=>$result],JSON_THROW_ON_ERROR);
}catch(Throwable $error){
    error_log('NUMI_REAL_WORKER_FAILURE type='.get_class($error));
    http_response_code(503);
    echo '{"ok":false,"error":"WORKER_UNAVAILABLE"}';
}
