<?php
declare(strict_types=1);
/**
 * Invoked from real-wallet.php test fixture AFTER its isolated MySQL schema.
 * There are no HTTP calls to YooKassa and no real credentials in this test.
 */
require_once __DIR__.'/../private/wallet-real-payment.php';
$payAccountId='00000000-0000-4000-8000-000000000104';
$payAccount=['id'=>$payAccountId];
$db->prepare('INSERT INTO numi_accounts(id,email,email_verified_at) VALUES(?,?,UTC_TIMESTAMP())')
    ->execute([$payAccountId,'payment@example.test']);
$receipt=static fn(int $rub):array=>[
    'customer'=>['email'=>'payment@example.test'],
    'items'=>[[
        'description'=>'Тестовая позиция фискального макета, не для запуска',
        'quantity'=>1.000,
        'amount'=>['value'=>naStoreAmount($rub*100),'currency'=>'RUB'],
        'vat_code'=>1,
        // Demonstrates how a reviewed external fiscal builder would pass data.
        // This mode has NOT been approved for the connected cash-register service.
        'payment_mode'=>'advance','payment_subject'=>'payment',
    ]],
];
expectReal(fn()=>naRealReviewedTopupReceipt($db,$payAccount,10000),
    'REAL_FISCAL_ADVANCE_BUILDER_NOT_APPROVED');
$advanceSettings=['advance_receipt_reviewed'=>true,'advance_receipt_vat_code'=>1];
$advanceReceipt=naRealReviewedTopupReceipt($db,$payAccount,10000,$advanceSettings);
assertReal($advanceReceipt['customer']['email']==='payment@example.test'
    && $advanceReceipt['items'][0]['payment_mode']==='advance'
    && $advanceReceipt['items'][0]['payment_subject']==='payment'
    && $advanceReceipt['items'][0]['amount']['value']==='100.00',
    'reviewed server-built advance receipt uses verified contact and exact amount');
expectReal(fn()=>naRealReviewedTopupReceipt($db,$payAccount,10000,
    ['advance_receipt_reviewed'=>true]),'REAL_FISCAL_ADVANCE_BUILDER_NOT_APPROVED');
expectReal(fn()=>naRealReviewedTopupReceipt($db,$payAccount,10000,
    ['advance_receipt_reviewed'=>true,'advance_receipt_vat_code'=>99]),
    'REAL_FISCAL_ADVANCE_BUILDER_NOT_APPROVED');
expectReal(fn()=>naRealReviewedTopupReceipt($db,$payAccount,0,$advanceSettings),
    'INVALID_TOPUP_AMOUNT');

$offset=naRealOffsetReceiptPayload(
    'live-payment-example-123','payment@example.test','Подписка на школу нумерологии',
    14900,['offset_receipt_reviewed'=>true,'offset_receipt_vat_code'=>1]);
assertReal($offset['payment_id']==='live-payment-example-123'
    && $offset['type']==='payment'
    && $offset['items'][0]['payment_mode']==='full_payment'
    && $offset['items'][0]['payment_subject']==='service'
    && $offset['items'][0]['amount']['value']==='149.00'
    && $offset['settlements'][0]['type']==='prepayment'
    && $offset['settlements'][0]['amount']['value']==='149.00',
    'subscription offset receipt includes prepayment settlement and exact amount');
expectReal(fn()=>naRealOffsetReceiptPayload('live-payment-example-123',
    'payment@example.test','Вопрос',1000,[]),
    'REAL_OFFSET_FISCAL_POLICY_NOT_APPROVED');
expectReal(fn()=>naRealOffsetReceiptPayload('live-payment-example-123',
    'payment@example.test','Вопрос',1000,
    ['offset_receipt_reviewed'=>true,'offset_receipt_vat_code'=>99]),
    'REAL_OFFSET_FISCAL_POLICY_NOT_APPROVED');
$refundCalls=[];
$refundTransport=static function(array $body,string $key)use(&$refundCalls):array{
    $refundCalls[]=['body'=>$body,'key'=>$key];
    return ['id'=>'rf_mock_123','status'=>'pending',
        'payment_id'=>$body['payment_id'],'amount'=>$body['amount']];
};
$refundCaseId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
expectReal(fn()=>naRealRefundSend([],$refundCaseId,'live-payment-example-123',1000,$refundTransport),
    'REAL_PAYMENTS_DISABLED');
$refundConfig=$good;
$refundConfig['refund_worker_verified']=true;
$refund1=naRealRefundSend($refundConfig,$refundCaseId,'live-payment-example-123',1000,$refundTransport);
$refund2=naRealRefundSend($refundConfig,$refundCaseId,'live-payment-example-123',1000,$refundTransport);
assertReal($refund1['refund_id']==='rf_mock_123'
    && $refund2['status']==='pending'
    && count($refundCalls)===2
    && $refundCalls[0]['key']===$refundCalls[1]['key']
    && $refundCalls[0]['body']['amount']['value']==='10.00',
    'refund request is amount-validated and retains stable retry key');
expectReal(fn()=>naRealRefundSend($refundConfig,$refundCaseId,'wrong!',1000,$refundTransport),
    'REAL_REFUND_PAYMENT_INVALID');
expectReal(fn()=>naRealRefundSend($good,$refundCaseId,'live-payment-example-123',1000,$refundTransport),
    'REAL_REFUND_POLICY_NOT_APPROVED');
// Original-payment-only refund approval: linked account, amount and payment ID
// are read from MySQL, never from the refund caller.
$refundAccountId='00000000-0000-4000-8000-000000000105';
$db->prepare('INSERT INTO numi_accounts(id,email,email_verified_at) VALUES(?,?,UTC_TIMESTAMP())')
    ->execute([$refundAccountId,'refund@example.test']);
$refundTopupId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
$refundCaseApproved='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
$db->prepare("INSERT INTO numi_real_wallet_balances(account_id,kopeks,blocked_at,block_reason)
    VALUES(?,1000,UTC_TIMESTAMP(),'REFUND_RECONCILIATION')")
    ->execute([$refundAccountId]);
$db->prepare("INSERT INTO numi_real_wallet_ledger
    (id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks)
    VALUES(?,?,'topup',?,?,?)")
    ->execute([naUuid(),$refundAccountId,$refundTopupId,1000,1000]);
$db->prepare("INSERT INTO numi_real_wallet_topups(id,account_id,request_key,kopeks,provider_payment_id,status)
    VALUES(?,?,?,?,?,'credited')")
    ->execute([$refundTopupId,$refundAccountId,'refund-test-request-12345',10000,'live-payment-for-refund-123']);
$db->prepare("INSERT INTO numi_real_wallet_refund_cases(id,account_id,topup_id,kopeks,status)
    VALUES(?,?,?,?,'approved')")
    ->execute([$refundCaseApproved,$refundAccountId,$refundTopupId,1000]);
$bound=naRealRefundApprovedCase($db,$refundCaseApproved);
assertReal($bound['payment_id']==='live-payment-for-refund-123'
    && $bound['kopeks']===1000
    && $bound['account_id']===$refundAccountId,
    'approved refund resolves original payment and amount from protected DB records');
$boundResult=naRealRefundSendApprovedCase($db,$refundConfig,$refundCaseApproved,$refundTransport);
assertReal($boundResult['refund_id']==='rf_mock_123',
    'approved source-bound refund submits through validated refund primitive');
expectReal(fn()=>naRealRefundSendApprovedCase($db,$refundConfig,$refundCaseApproved,$refundTransport),
    'REAL_REFUND_ALREADY_SUBMITTED');
$refundSaved=$db->prepare('SELECT provider_refund_id FROM numi_real_wallet_refund_cases WHERE id=?');
$refundSaved->execute([$refundCaseApproved]);
assertReal($refundSaved->fetchColumn()==='rf_mock_123',
    'refund result identifier persisted to case for reconciliation');
$refundGet=static fn(string $id):array=>[
    'id'=>$id,'payment_id'=>'live-payment-for-refund-123',
    'amount'=>['value'=>'10.00','currency'=>'RUB'],
    'status'=>'succeeded','receipt_registration'=>'succeeded'];
assertReal(naRealRefundReconcile($db,$refundConfig,$refundCaseApproved,$refundGet)==='completed',
    'verified YooKassa refund atomically settles reserved wallet amount');
assertReal(naRealRefundReconcile($db,$refundConfig,$refundCaseApproved,$refundGet)==='completed',
    'repeated refund reconciliation does not debit wallet again');
assertReal(naRealWalletBalance($db,$refundAccountId)===0,
    'settled refund debits balance exactly once');
naRealWalletInvariant($db,$refundAccountId);
$refundRow=$db->prepare("SELECT COUNT(*) FROM numi_real_wallet_ledger
    WHERE kind='refund' AND reference_id=?");
$refundRow->execute([$refundCaseApproved]);
assertReal((int)$refundRow->fetchColumn()===1,
    'exactly one durable real refund ledger event');
$offsetCalls=[];
$offsetMock=static function(array $body,string $key)use(&$offsetCalls):array{
    $offsetCalls[]=['body'=>$body,'key'=>$key];
    return ['id'=>'rt_test_offset_123','type'=>'payment','status'=>'pending',
        'payment_id'=>$body['payment_id']];
};
$eventId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
expectReal(fn()=>naRealOffsetReceiptSend([],$eventId,$offset,$offsetMock),
    'REAL_PAYMENTS_DISABLED');
$notApproved=$good;$notApproved['offset_receipt_reviewed']=false;
expectReal(fn()=>naRealOffsetReceiptSend($notApproved,$eventId,$offset,$offsetMock),
    'REAL_OFFSET_FISCAL_POLICY_NOT_APPROVED');
$offsetGood=$good;$offsetGood['offset_receipt_reviewed']=true;
$sent=naRealOffsetReceiptSend($offsetGood,$eventId,$offset,$offsetMock);
$repeated=naRealOffsetReceiptSend($offsetGood,$eventId,$offset,$offsetMock);
assertReal($sent['receipt_id']==='rt_test_offset_123'
    && $sent['status']==='pending'
    && $repeated['receipt_id']===$sent['receipt_id']
    && count($offsetCalls)===2
    && $offsetCalls[0]['key']===$offsetCalls[1]['key'],
    'offset send is guarded and stable-key retries do not change provider request');
expectReal(fn()=>naRealOffsetReceiptSend($offsetGood,$eventId,
    array_replace($offset,['type'=>'refund']),$offsetMock),
    'REAL_OFFSET_PAYLOAD_INVALID');
assertReal(naRealPaymentMethod('bank_card')==='bank_card','bank card method');
assertReal(naRealPaymentMethod('sbp')==='sbp','SBP method');
expectReal(fn()=>naRealPaymentMethod('yoomoney'),'REAL_UNSUPPORTED_PAYMENT_METHOD');
expectReal(fn()=>naRealPaymentReceipt($receipt(100),'wrong@example.test',10000),
    'REAL_FISCAL_CONTACT_MISMATCH');
$fakeTopup=['id'=>'11111111-1111-4111-8111-111111111111','kopeks'=>10000];
$built=naRealPaymentPayload($fakeTopup,'sbp','payment@example.test',$receipt(100));
assertReal($built['payment_method_data']['type']==='sbp'
    && $built['capture']===true && $built['save_payment_method']===false
    && $built['confirmation']['type']==='redirect'
    && $built['amount']['value']==='100.00'
    && $built['receipt']['customer']['email']==='payment@example.test',
    'SBP payload uses reviewed fiscal data and exact amount');
assertReal(str_starts_with($built['confirmation']['return_url'],'https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/')
    && str_contains($built['confirmation']['return_url'],'wallet_topup='.$fakeTopup['id']),
    'return URL includes verified topup ID and canonical production host');
assertReal(strlen(naRealPaymentIdempotenceKey($fakeTopup['id']))===64
    && naRealPaymentIdempotenceKey($fakeTopup['id'])===naRealPaymentIdempotenceKey($fakeTopup['id']),
    'stable 64-char idempotence key');
expectReal(fn()=>naRealPaymentPayload($fakeTopup,'cash','payment@example.test',$receipt(100)),
    'REAL_UNSUPPORTED_PAYMENT_METHOD');
expectReal(fn()=>naRealPaymentPayload($fakeTopup,'sbp','payment@example.test',$receipt(200)),
    'REAL_FISCAL_RECEIPT_NOT_REVIEWED');
assertReal(naRealPaymentConfirmationUrl(['confirmation'=>[
    'type'=>'redirect','confirmation_url'=>'https://yookassa.ru/checkout/payments/id',
]])!==null,'trusted payment confirmation URL');
assertReal(naRealPaymentConfirmationUrl(['confirmation'=>[
    'type'=>'redirect','confirmation_url'=>'https://evil.example/checkout/payments/id',
]])===null,'reject attacker redirect URL');
assertReal(naRealPaymentConfirmationUrl(['confirmation'=>[
    'type'=>'redirect','confirmation_url'=>'http://yookassa.ru/checkout/payments/id',
]])===null,'reject HTTP redirect URL');
$mockCalls=[];
$mock=function(array $payload,string $idem)use(&$mockCalls):array{
    assertReal(preg_match('/^[a-f0-9]{64}$/D',$idem)===1,'provider idempotence exactly 64 hex chars');
    $method=$payload['payment_method_data']['type'];
    $id=$method==='sbp'?'22222222-2222-4222-8222-222222222222':'33333333-3333-4333-8333-333333333333';
    $mockCalls[]=['method'=>$method,'idempotence'=>$idem,'amount'=>$payload['amount']['value']];
    return [
        'id'=>$id,'test'=>false,'status'=>'pending','paid'=>false,
        'amount'=>$payload['amount'],
        'recipient'=>['account_id'=>'1234567'],
        'metadata'=>$payload['metadata'],
        'payment_method'=>['type'=>$method],
        'confirmation'=>['type'=>'redirect','confirmation_url'=>'https://yookassa.ru/checkout/payments/'.$id],
    ];
};
expectReal(fn()=>naRealWalletCreatePayment($db,$payAccount,[],100,'card-topup-00000000001',
    'bank_card',$receipt(100),$mock),'REAL_PAYMENTS_DISABLED');
$card=naRealWalletCreatePayment($db,$payAccount,$good,100,'card-topup-00000000001',
    'bank_card',$receipt(100),$mock);
assertReal($card['method']==='bank_card'&&!$card['reused']
    && str_starts_with((string)$card['confirmation_url'],'https://yookassa.ru/')
    && count($mockCalls)===1,'card creates one pending provider payment');
$repeat=naRealWalletCreatePayment($db,$payAccount,$good,100,'card-topup-00000000001',
    'bank_card',$receipt(100),$mock);
assertReal($repeat['reused']===true && $repeat['payment_id']===$card['payment_id']
    && count($mockCalls)===1,'same card topup repeats without creating another provider charge');
expectReal(fn()=>naRealWalletCreatePayment($db,$payAccount,$good,100,
    'card-topup-00000000001','sbp',$receipt(100),$mock),'REAL_TOPUP_METHOD_CHANGED');
expectReal(fn()=>naRealWalletCreatePayment($db,$payAccount,$good,200,
    'card-topup-00000000001','bank_card',$receipt(200),$mock),'REAL_TOPUP_KEY_CONFLICT');
$sbp=naRealWalletCreatePayment($db,$payAccount,$good,500,'sbp-topup-00000000002',
    'sbp',$receipt(500),$mock);
assertReal($sbp['method']==='sbp' && !$sbp['reused']&&count($mockCalls)===2
    && $mockCalls[0]['idempotence']!==$mockCalls[1]['idempotence'],
    'SBP creates separate pending payment with different idempotence key');
$sbpRepeat=naRealWalletCreatePayment($db,$payAccount,$good,500,'sbp-topup-00000000002',
    'sbp',$receipt(500),$mock);
assertReal($sbpRepeat['reused']===true&&count($mockCalls)===2,'SBP repeated retry does not POST');
assertReal(naRealWalletBalance($db,$payAccountId)===0,
    'pending card and SBP never credit wallet');
$db->prepare('SELECT 1 FROM numi_real_wallet_topups WHERE id=? AND provider_payment_id=?');
$q=$db->prepare('SELECT * FROM numi_real_wallet_topups WHERE id=?');
$q->execute([$card['topup_id']]);$savedCard=$q->fetch();
assertReal($savedCard['payment_method']==='bank_card'&&$savedCard['provider_payment_id']===$card['payment_id'],
    'provider reference and method stored in independent REAL tables');
$settledCard=$mock(naRealPaymentPayload($savedCard,'bank_card','payment@example.test',$receipt(100)),
    naRealPaymentIdempotenceKey($savedCard['id']));
$settledCard['status']='succeeded';$settledCard['paid']=true;
$settledCard['receipt_registration']='pending';
assertReal(naRealWalletApplyVerifiedPayment($db,$savedCard,$settledCard,$good)==='pending_receipt',
    'payment success without confirmed receipt does not credit real RUB');
assertReal(naRealWalletBalance($db,$payAccountId)===0,'receipt pending keeps REAL balance zero');
$settledCard['receipt_registration']='succeeded';
assertReal(naRealWalletApplyVerifiedPayment($db,$savedCard,$settledCard,$good)==='credited',
    'verified fiscal payment credits once');
assertReal(naRealWalletApplyVerifiedPayment($db,$savedCard,$settledCard,$good)==='credited'
    && naRealWalletBalance($db,$payAccountId)===10000,
    'duplicate settlement after card payment does not double credit');
naRealWalletInvariant($db,$payAccountId);
$lost=naRealWalletTopupIntent($db,$payAccount,$good,25,'lost-response-0000000003');
$db->prepare("UPDATE numi_real_wallet_topups SET payment_method='sbp',
    provider_request_started_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 24 HOUR) WHERE id=?")
    ->execute([$lost['topup_id']]);
expectReal(fn()=>naRealWalletCreatePayment($db,$payAccount,$good,25,'lost-response-0000000003',
    'sbp',$receipt(25),$mock),'REAL_TOPUP_RECONCILIATION_REQUIRED');
assertReal(count($mockCalls)===3,'expired uncertain payment never POSTs a new external debit');
echo "REAL_CARD_SBP_MOCK_PAYMENT_IDEMPOTENCY_RECEIPTS_PASS\n";
