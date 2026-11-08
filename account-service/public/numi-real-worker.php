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
if(!in_array($action,['tick','migrate'],true)){
    http_response_code(400);echo '{"ok":false,"error":"INVALID_WORKER_ACTION"}';exit;
}
try{
    require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
    require dirname(__DIR__,3).'/private/numi-account-20261031/wallet-real-worker.php';
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
