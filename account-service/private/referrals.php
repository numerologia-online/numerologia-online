<?php
declare(strict_types=1);
/** Preview estimates only. No wallet credits, bonus spends or receipt changes. */
function nrEnabled(): bool {
    return is_file(__DIR__.'/referrals-preview.enabled');
}
function nrValidCode(mixed $value): bool {
    return is_string($value)&&preg_match('/^[a-f0-9]{24}$/D',$value)===1;
}
function nrReward(string $code,int $kopeks): int {
    if($code==='club_month')return $kopeks===49000?4900:0;
    if(!in_array($code,['year_full','life_full','compatibility_full','child_full_v1'],true))return 0;
    return match($kopeks){99000=>10000,49000=>5000,default=>0};
}
function nrIssue(PDO $db,string $owner): string {
    $db->beginTransaction();
    try {
        $q=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');
        $q->execute([$owner]);
        if(!$q->fetchColumn())throw new RuntimeException('REF_ACCOUNT_MISSING');
        $q=$db->prepare('SELECT code FROM numi_referral_codes WHERE owner_id=? ORDER BY created_at,code LIMIT 1');
        $q->execute([$owner]);$code=$q->fetchColumn();
        if($code===false){
            $code=bin2hex(random_bytes(12));
            $db->prepare('INSERT INTO numi_referral_codes(code,owner_id,created_at) VALUES(?,?,UTC_TIMESTAMP())')->execute([$code,$owner]);
        }
        $db->commit();return (string)$code;
    } catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
/** Only call inside creation of a genuinely new account. */
function nrBindNew(PDO $db,string $invitee,mixed $code): void {
    if(!nrValidCode($code))return;
    if(!$db->inTransaction())throw new RuntimeException('REF_REGISTRATION_TRANSACTION_REQUIRED');
    $q=$db->prepare('SELECT owner_id FROM numi_referral_codes WHERE code=? FOR UPDATE');
    $q->execute([$code]);$inviter=$q->fetchColumn();
    if(!$inviter||$inviter===$invitee)return;
    $q=$db->prepare("INSERT INTO numi_referral_bindings(invitee_id,inviter_id,bound_at) VALUES(?,?,UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE invitee_id=invitee_id");
    $q->execute([$invitee,$inviter]);
}
/** Preserve inviter links; ambiguous invitee merges stay under review. */
function nrMerge(PDO $db,string $from,string $to): void {
    if($from===$to)return;
    if(!$db->inTransaction())throw new RuntimeException('REF_MERGE_TRANSACTION_REQUIRED');
    $db->prepare('UPDATE numi_referral_codes SET owner_id=? WHERE owner_id=?')->execute([$to,$from]);
    $db->prepare("UPDATE numi_referral_bindings SET state='review' WHERE invitee_id IN (?,?)")->execute([$from,$to]);
    $db->prepare('UPDATE numi_referral_bindings SET inviter_id=? WHERE inviter_id=?')->execute([$to,$from]);
    $db->exec("UPDATE numi_referral_bindings SET state='review' WHERE invitee_id=inviter_id AND state='active'");
}
/** Order PK is idempotency key. Only real paid orders and eligible products.
 * Persistent attribution; every eligible real paid subscription, including renewals.
 * No writes to the order, wallet, entitlement or fiscal tables. */
function nrAccrue(PDO $db,?string $inviter=null): int {
    $filter=$inviter===null?'':' AND b.inviter_id=?';
    $sql="INSERT IGNORE INTO numi_referral_rewards(order_id,invitee_id,amount_kopeks,reward_kopeks,created_at,release_at)
      SELECT o.id,b.invitee_id,o.amount_kopeks,
        CASE WHEN o.product_code='club_month' THEN 4900 WHEN o.amount_kopeks=99000 THEN 10000 ELSE 5000 END,
        UTC_TIMESTAMP(),DATE_ADD(o.verified_at,INTERVAL 14 DAY)
      FROM numi_referral_bindings b JOIN numi_orders o ON o.account_id=b.invitee_id
      WHERE b.state='active' AND b.inviter_id<>b.invitee_id
        AND o.status='paid' AND o.verified_at IS NOT NULL AND o.currency='RUB'
        AND o.provider IN ('real_wallet','real_subscription')
        AND o.created_at>=b.bound_at AND o.verified_at>=b.bound_at
        AND NOT EXISTS (SELECT 1 FROM numi_referral_rewards r WHERE r.order_id=o.id)
        AND ((o.product_code='club_month' AND o.amount_kopeks=49000)
          OR (o.product_code IN ('year_full','life_full','compatibility_full','child_full_v1')
              AND o.amount_kopeks IN (49000,99000)))".$filter."
      ORDER BY o.verified_at,o.id LIMIT 200";
    $q=$db->prepare($sql);$q->execute($inviter===null?[]:[$inviter]);return $q->rowCount();
}
function nrMine(PDO $db,string $owner): array {
    $code=nrIssue($db,$owner);nrAccrue($db,$owner);
    $q=$db->prepare("SELECT COUNT(*) FROM numi_referral_bindings WHERE inviter_id=? AND state='active'");
    $q->execute([$owner]);$invited=(int)$q->fetchColumn();
    $q=$db->prepare("SELECT
        COALESCE(SUM(CASE WHEN r.release_at>UTC_TIMESTAMP() THEN r.reward_kopeks ELSE 0 END),0) pending,
        COALESCE(SUM(CASE WHEN r.release_at<=UTC_TIMESTAMP() THEN r.reward_kopeks ELSE 0 END),0) calculated,
        COUNT(DISTINCT b.invitee_id) buyers
      FROM numi_referral_rewards r JOIN numi_referral_bindings b ON b.invitee_id=r.invitee_id
      JOIN numi_orders o ON o.id=r.order_id AND o.account_id=r.invitee_id
      WHERE b.inviter_id=? AND b.state='active' AND b.inviter_id<>b.invitee_id
        AND o.status='paid' AND o.verified_at IS NOT NULL AND o.currency='RUB'
        AND o.provider IN ('real_wallet','real_subscription') AND o.amount_kopeks=r.amount_kopeks");
    $q->execute([$owner]);$row=$q->fetch(PDO::FETCH_ASSOC);
    return ['enabled'=>true,'preview'=>true,'code'=>$code,'invited'=>$invited,
        'buyers'=>(int)$row['buyers'],'pending_kopeks'=>(int)$row['pending'],
        'calculated_kopeks'=>(int)$row['calculated'],'spendable_kopeks'=>0];
}
function nrWorkerPreview(PDO $db): array {
    if(!nrEnabled())return ['enabled'=>false];
    try{return ['enabled'=>true,'estimated'=>nrAccrue($db)];}
    catch(Throwable $e){error_log('NUMI_REFERRAL_PREVIEW:'.get_class($e));return ['enabled'=>true,'review'=>true];}
}

/** Owner-only aggregate; dates are UTC, same range as existing Insights.
 * No individual invitees or account identifiers. No writes. */
function nrOwnerReport(PDO $db,string $start,string $end): array {
    $q=$db->prepare("SELECT COUNT(*) FROM numi_referral_bindings
        WHERE state='active' AND inviter_id<>invitee_id AND bound_at>=? AND bound_at<?");
    $q->execute([$start,$end]);$invited=(int)$q->fetchColumn();
    $q=$db->prepare("SELECT COUNT(*) orders,COUNT(DISTINCT b.invitee_id) buyers,
        COALESCE(SUM(o.amount_kopeks),0) cash_order_kopeks,
        COALESCE(SUM(r.reward_kopeks),0) reward_kopeks,
        COALESCE(SUM(CASE WHEN r.release_at>UTC_TIMESTAMP() THEN r.reward_kopeks ELSE 0 END),0) pending_kopeks
        FROM numi_referral_rewards r
        JOIN numi_referral_bindings b ON b.invitee_id=r.invitee_id
        JOIN numi_orders o ON o.id=r.order_id AND o.account_id=r.invitee_id
        WHERE b.state='active' AND b.inviter_id<>b.invitee_id
          AND o.status='paid' AND o.verified_at>=? AND o.verified_at<?
          AND o.currency='RUB' AND o.provider IN ('real_wallet','real_subscription')
          AND o.amount_kopeks=r.amount_kopeks");
    $q->execute([$start,$end]);$row=$q->fetch(PDO::FETCH_ASSOC);
    return ['preview'=>true,'invited'=>$invited,'buyers'=>(int)$row['buyers'],
        'orders'=>(int)$row['orders'],'cash_order_kopeks'=>(int)$row['cash_order_kopeks'],
        'reward_kopeks'=>(int)$row['reward_kopeks'],'pending_kopeks'=>(int)$row['pending_kopeks'],
        'spent_kopeks'=>null,'bonus_only_orders'=>null,'mixed_orders'=>null];
}
