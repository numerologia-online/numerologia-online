<?php
declare(strict_types=1);
// Read-only Club benefit delivery. Uses the current verified session; never charges.
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('X-Robots-Tag: noindex, nofollow, noarchive');
try {
    $request=naReadPost();
    $benefit=$request['benefit']??null;
    if(!in_array($benefit,['calendar','rituals'],true))naReply(400,['ok'=>false,'error'=>'INVALID_BENEFIT']);
    $db=naDB();
    $account=naCurrent($db);
    $allowed=$account!==null && (naTestOwner($account)||naCatalogHasAccess($db,$account,'club_month','club'));
    if(!$allowed)naReply(200,['ok'=>true,'allowed'=>false]);
    if($benefit==='calendar')naReply(200,['ok'=>true,'allowed'=>true]);
    $path=dirname(__DIR__,3).'/private/numi-account-20261031/club-money-rituals.json';
    $raw=file_get_contents($path);
    $rituals=json_decode((string)$raw,true,32,JSON_THROW_ON_ERROR);
    if(!is_array($rituals)||count($rituals)!==10)throw new RuntimeException('RITUAL_LIBRARY_UNAVAILABLE');
    naReply(200,['ok'=>true,'allowed'=>true,'rituals'=>$rituals]);
} catch(Throwable $e) {
    error_log('NUMI_CLUB_BENEFITS:'.get_class($e));
    naReply(503,['ok'=>false,'error'=>'BENEFIT_UNAVAILABLE']);
}
