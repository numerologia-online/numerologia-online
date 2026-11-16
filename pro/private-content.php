<?php
declare(strict_types=1);
/**
 * One isolated full-life reader for ready original text banks.
 * Never changes paid orders, subscriptions, shared content, or any other product.
 * HTTP 403 on original JSON assets is intentional. This endpoint authorizes
 * individual report access, then reads the original bytes server-side.
 */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('Vary: Cookie, Origin');
try {
    $db=naDB();
    $account=naCurrent($db);
    if(!$account)naReply(403,['ok'=>false,'error'=>'LOGIN_REQUIRED']);
    $body=naReadPost(); // requires JSON, first-party origin and bounded request size
    $birth=naCatalogDate($body['birth_date']??null);
    if(!$birth)naReply(400,['ok'=>false,'error'=>'INVALID_BIRTH_DATE']);
    $isOwner=naTestOwner($account);
    if(!$isOwner&&!naCatalogHasAccess($db,$account,'life_full','life:'.$birth))
        naReply(403,['ok'=>false,'error'=>'FULL_LIFE_PURCHASE_REQUIRED']);

    $kind=$body['kind']??null;
    if(!is_string($kind))naReply(400,['ok'=>false,'error'=>'INVALID_RESOURCE']);
    $path=null;
    $format='json';
    $privateBank=false;
    $number=$body['energy']??null;
    if($kind==='section'){
        if(!is_int($number)||$number<1||$number>22)
            naReply(400,['ok'=>false,'error'=>'INVALID_ENERGY']);
        $path='knowledge/full-report/sections/energy-'.$number.'.json';
        $privateBank=true;
    }elseif($kind==='purpose'){
        $scope=$body['scope']??null;
        if(!is_string($scope)||!in_array($scope,['personal','social','general','planetary'],true))
            naReply(400,['ok'=>false,'error'=>'INVALID_PURPOSE']);
        $path='pro/purpose/'.$scope.'.json';
    }elseif($kind==='guidance'){
        if(!is_int($number)||!in_array($number,[4,7,10,11,12,13,14,15,16,17,18,19,20,21,22],true))
            naReply(400,['ok'=>false,'error'=>'INVALID_ENERGY']);
        $path='pro/guidance/energy-'.$number.'.json';
    }elseif($kind==='karmic_programs'){
        // Preserve the exact approved GitHub bank in a non-public server folder.
        $path=null;
    }elseif($kind==='karmic_tails'){
        $format='text';
    }elseif($kind==='karmic_deepening'){
        $part=$body['part']??null;
        if(!is_string($part)||!in_array($part,['a','b'],true))
            naReply(400,['ok'=>false,'error'=>'INVALID_PART']);
        $path='pro/karmic-tail-deepening-'.$part.'.json';
    }else{
        naReply(400,['ok'=>false,'error'=>'RESOURCE_NOT_ALLOWED']);
    }

    if($kind==='karmic_tails'){
        $file=dirname(__DIR__,3).'/private/numi-pro-karmic-source/karmic-tails.md';
    }elseif($kind==='karmic_programs'){
        $file=dirname(__DIR__,3).'/private/numi-pro-karmic-source/karmic-programs.json';
    }elseif($privateBank){
        require_once dirname(__DIR__,3).'/private/numi-account-20261031/fulfillment.php';
        $raw=naMaterialRead($path);
        $file=null;
    }else{
        $siteRoot=realpath(dirname(__DIR__));
        $file=$siteRoot?realpath($siteRoot.'/'.$path):false;
        if(!$siteRoot||!$file||!str_starts_with($file,$siteRoot.'/'))
            naReply(404,['ok'=>false,'error'=>'SOURCE_NOT_READY']);
    }
    if($file!==null){
        if(!is_file($file)||is_link($file)||filesize($file)>2_500_000)
            naReply(404,['ok'=>false,'error'=>'SOURCE_NOT_READY']);
        $raw=file_get_contents($file);
        if(!is_string($raw)||$raw==='')
            naReply(404,['ok'=>false,'error'=>'SOURCE_NOT_READY']);
    }
    if($format==='json'){
        // Don't rewrite a single paragraph of the original authored material.
        $decoded=json_decode($raw,true,50,JSON_THROW_ON_ERROR);
        if(!is_array($decoded))naReply(503,['ok'=>false,'error'=>'SOURCE_INVALID']);
    }else{
        header('Content-Type: text/plain; charset=utf-8');
    }
    header('Cache-Control: private, no-store, max-age=0');
    echo $raw;
} catch(JsonException|InvalidArgumentException $e){
    naReply(400,['ok'=>false,'error'=>'REQUEST_INVALID']);
} catch(Throwable $e){
    error_log('NUMI_PRO_SOURCE_GATE:'.get_class($e));
    naReply(503,['ok'=>false,'error'=>'PRO_SOURCE_TEMPORARILY_UNAVAILABLE']);
}
