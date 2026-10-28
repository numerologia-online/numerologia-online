<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
/*
 * Call ONLY from a payment-provider webhook AFTER cryptographic/provider-side
 * payment verification. NEVER expose this function in a public POST endpoint.
 * The webhook must set child_purchases.status='paid' and verified_at before calling.
 */
function grantVerifiedChildPurchase(PDO $pdo, string $purchaseId): void {
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "SELECT id,account_id,child_id,product_code,status,amount_kopeks,currency,verified_at
             FROM child_purchases WHERE id=:id FOR UPDATE"
        );
        $stmt->execute(['id'=>$purchaseId]);
        $p = $stmt->fetch();
        if (!$p || $p['status'] !== 'paid' || $p['product_code'] !== 'child_full_v1'
            || $p['currency'] !== 'RUB' || (int)$p['amount_kopeks'] !== 49000
            || $p['verified_at'] === null) {
            throw new RuntimeException('Purchase has not been verified');
        }
        $owner = $pdo->prepare("SELECT 1 FROM child_profiles WHERE id=:child AND account_id=:account");
        $owner->execute(['child'=>$p['child_id'],'account'=>$p['account_id']]);
        if (!$owner->fetchColumn()) throw new RuntimeException('Child does not belong to purchasing account');
        $stmt = $pdo->prepare(
            "INSERT INTO child_entitlements (account_id,child_id,product_code,purchase_id,status,revoked_at)
             VALUES (:account,:child,'child_full_v1',:purchase,'active',NULL)
             ON DUPLICATE KEY UPDATE purchase_id=VALUES(purchase_id),status='active',revoked_at=NULL"
        );
        $stmt->execute(['account'=>$p['account_id'],'child'=>$p['child_id'],'purchase'=>$p['id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
