<?php
declare(strict_types=1);
/**
 * Single owner-only material preview for every READY paid product.
 * No purchase, order, entitlement, subscription or wallet state is created.
 * Same verified REG.RU account identity as /api/numi-owner-access.php.
 */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('X-Robots-Tag: noindex, nofollow, noarchive');
try {
    $db=naDB();
    $account=naCurrent($db);
    if(!naTestOwner($account))naReply(403,['ok'=>false,'error'=>'OWNER_LOGIN_REQUIRED']);
    $body=naReadPost(); // also verifies exact Origin, JSON type and max length
    $item=$body['item']??null;
    if(!is_array($item)||array_is_list($item))naReply(400,['ok'=>false,'error'=>'INVALID_ITEM']);
    $code=$item['product_code']??null;
    $allowed=['life_full','year_full','compatibility_full','child_full_v1','redflag_question','yesno_question'];
    if(!is_string($code)||!in_array($code,$allowed,true))
        naReply(400,['ok'=>false,'error'=>'OWNER_PREVIEW_NOT_SUPPORTED']);
    $quote=naCatalogResolve($item,false);
    if(($quote['product_code']??'')!==$code)naReply(400,['ok'=>false,'error'=>'INVALID_ITEM']);
    if($code==='redflag_question' && ($quote['availability']??'')==='AUTHOR_TEXT_NOT_CONFIRMED')
        naReply(409,['ok'=>false,'error'=>'DRAFT_NOT_PUBLISHED']);
    require_once dirname(__DIR__,3).'/private/numi-account-20261031/fulfillment.php';
    // Same native production generator and answer cache as customers, never
    // the isolated redflag-ai-lab editor. Owner bypasses wallet only after auth.
    if($code==='redflag_question' && str_starts_with((string)$quote['resource_id'],'redflag:family:')){
        require_once dirname(__DIR__,3).'/private/numi-account-20261031/family-live.php';
        if(function_exists('set_time_limit'))@set_time_limit(125);
        nfEnsurePaidResource((string)$quote['resource_id']);
    }
    if($code==='redflag_question' && str_starts_with((string)$quote['resource_id'],'redflag:language:')){
        require_once dirname(__DIR__,3).'/private/numi-account-20261031/language-live.php';
        if(function_exists('set_time_limit'))@set_time_limit(125);
        $document=nlOwnerMaterial((string)$quote['resource_id']);
        naReply(200,['ok'=>true,'owner_preview'=>true,'charged'=>false,
            'product_code'=>$code,'material'=>$document]);
    }
    if($code==='redflag_question' && str_starts_with((string)$quote['resource_id'],'redflag:intimacy:')){
        require_once dirname(__DIR__,3).'/private/numi-account-20261031/intimacy-live.php';
        if(function_exists('set_time_limit'))@set_time_limit(125);
        niEnsurePaidResource((string)$quote['resource_id']);
    }
    if($code==='redflag_question'&&preg_match('/^redflag:money:(?!comic-verdict-money:)/D',(string)$quote['resource_id'])){
        require_once dirname(__DIR__,3).'/private/numi-account-20261031/money-editor-live.php';
        $p=meParse($code,(string)$quote['resource_id']);
        if($p===null)naReply(400,['ok'=>false,'error'=>'INVALID_MONEY_QUESTION']);
        if(function_exists('set_time_limit'))@set_time_limit(125);
        meEnsure(...$p);
    }
    $document=naMaterialBuild($code,(string)$quote['resource_id']);
    // Do not use genuine entitlement UUIDs or fabricated paid receipts.
    naReply(200,['ok'=>true,'owner_preview'=>true,'charged'=>false,
        'product_code'=>$code,'material'=>$document]);
} catch(JsonException|InvalidArgumentException $e) {
    naReply(400,['ok'=>false,'error'=>'INVALID_OWNER_PREVIEW_REQUEST']);
} catch(Throwable $e) {
    error_log('NUMI_OWNER_MATERIAL:'.get_class($e));
    naReply(409,['ok'=>false,'error'=>'MATERIAL_NOT_READY']);
}
