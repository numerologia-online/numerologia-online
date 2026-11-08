<?php
/**
 * SAFE TEMPLATE ONLY, no credentials.
 * Future target (outside public REG.RU webroot):
 *     /private/numi-wallet-live/config.local.php
 *
 * Do not upload as a public PHP file, do not put genuine keys in GitHub.
 * All gates remain FALSE until cash-register checks, refunds, the fiscal
 * receipt-offset worker, and an explicit manual go-live decision.
 */
return [
    'wallet_mode' => 'disabled',
    'real_wallet_enabled' => false,
    'fiscalization_verified' => false,
    'refunds_verified' => false,
    'advance_offset_receipts_verified' => false,
    'offset_receipt_worker_verified' => false,
    'launch_approved' => false,
    'provider_test_mode' => true,
    'shop_id' => '',
    'secret_key' => '',
];
