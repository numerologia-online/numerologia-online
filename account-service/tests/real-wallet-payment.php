<?php
declare(strict_types=1);
/**
 * Invoked from real-wallet.php test fixture AFTER its isolated MySQL schema.
 * There are no HTTP calls to YooKassa and no real credentials in this test.
 */
require_once __DIR__.'/../private/wallet-real-payment.php';
$payAccountId='00000000-0000-4000-8000-000000000104';
$payAccount=['id'=>$payAccountId];
$db->prepare('INSERT INTO numi_accounts(id,email,email_verified_at) VALUES(?,?,NULL)')
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
expectReal(fn()=>naRealReviewedTopupReceipt($db,$payAccount,10000,'payment@example.test'),
    'REAL_FISCAL_ADVANCE_BUILDER_NOT_APPROVED');
$advanceSettings=['advance_receipt_reviewed'=>true,'advance_receipt_vat_code'=>1];
$advanceReceipt=naRealReviewedTopupReceipt($db,$payAccount,10000,'payment@example.test',$advanceSettings);
expectReal(fn()=>naRealReviewedTopupReceipt($db,$payAccount,10000,'invalid-email',$advanceSettings),
    'REAL_FISCAL_CONTACT_REQUIRED');
assertReal($advanceReceipt['customer']['email']==='payment@example.test'
    && $advanceReceipt['items'][0]['payment_mode']==='advance'
    && $advanceReceipt['items'][0]['payment_subject']==='payment'
    && $advanceReceipt['items'][0]['amount']['value']==='100.00',
    'reviewed server-built advance receipt uses verified contact and exact amount');
expectReal(fn()=>naRealReviewedTopupReceipt($db,$payAccount,10000,'payment@example.test',
    ['advance_receipt_reviewed'=>true]),'REAL_FISCAL_ADVANCE_BUILDER_NOT_APPROVED');
expectReal(fn()=>naRealReviewedTopupReceipt($db,$payAccount,10000,'payment@example.test',
    ['advance_receipt_reviewed'=>true,'advance_receipt_vat_code'=>99]),
    'REAL_FISCAL_ADVANCE_BUILDER_NOT_APPROVED');
expectReal(fn()=>naRealReviewedTopupReceipt($db,$payAccount,0,'payment@example.test',$advanceSettings),
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
expectReal(fn()=>naRealRefundSend($refundConfig,$refundCaseId,
    'live-payment-example-123',1000,$refundTransport),
    'REAL_REFUND_RECEIPT_SETTINGS_MISSING');
$refundConfig['refund_receipt_mode']='yookassa_full_auto';
$refundConfig['refund_receipt_status_check']=true;
$refund1=naRealRefundSend($refundConfig,$refundCaseId,'live-payment-example-123',1000,$refundTransport);
$refund2=naRealRefundSend($refundConfig,$refundCaseId,'live-payment-example-123',1000,$refundTransport);
assertReal($refund1['refund_id']==='rf_mock_123'
    && $refund2['status']==='pending'
    && count($refundCalls)===2
    && $refundCalls[0]['key']===$refundCalls[1]['key']
    && $refundCalls[0]['body']['amount']['value']==='10.00'
    && !array_key_exists('receipt',$refundCalls[0]['body']),
    'full refund uses YooKassa automatic original receipt without duplicate payload');
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
    VALUES(?,10000,UTC_TIMESTAMP(),'REFUND_RECONCILIATION')")
    ->execute([$refundAccountId]);
$db->prepare("INSERT INTO numi_real_wallet_ledger
    (id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks)
    VALUES(?,?,'topup',?,?,?)")
    ->execute([naUuid(),$refundAccountId,$refundTopupId,10000,10000]);
$db->prepare("INSERT INTO numi_real_wallet_topups(id,account_id,request_key,kopeks,provider_payment_id,status)
    VALUES(?,?,?,?,?,'credited')")
    ->execute([$refundTopupId,$refundAccountId,'refund-test-request-12345',10000,'live-payment-for-refund-123']);
$db->prepare("INSERT INTO numi_real_wallet_refund_cases(id,account_id,topup_id,kopeks,status)
    VALUES(?,?,?,?,'approved')")
    ->execute([$refundCaseApproved,$refundAccountId,$refundTopupId,10000]);
$bound=naRealRefundApprovedCase($db,$refundCaseApproved);
assertReal($bound['payment_id']==='live-payment-for-refund-123'
    && $bound['kopeks']===10000
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
    'amount'=>['value'=>'100.00','currency'=>'RUB'],
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
    'bank_card','payment@example.test',$receipt(100),$mock),'REAL_PAYMENTS_DISABLED');
$card=naRealWalletCreatePayment($db,$payAccount,$good,100,'card-topup-00000000001',
    'bank_card','payment@example.test',$receipt(100),$mock);
assertReal($card['method']==='bank_card'&&!$card['reused']
    && str_starts_with((string)$card['confirmation_url'],'https://yookassa.ru/')
    && count($mockCalls)===1,'card creates one pending provider payment');
$repeat=naRealWalletCreatePayment($db,$payAccount,$good,100,'card-topup-00000000001',
    'bank_card','payment@example.test',$receipt(100),$mock);
expectReal(fn()=>naRealWalletCreatePayment($db,$payAccount,$good,100,
    'card-topup-00000000001','bank_card','second@example.test',$receipt(100),$mock),
    'REAL_FISCAL_CONTACT_MISMATCH');
assertReal($repeat['reused']===true && $repeat['payment_id']===$card['payment_id']
    && count($mockCalls)===1,'same card topup repeats without creating another provider charge');
expectReal(fn()=>naRealWalletCreatePayment($db,$payAccount,$good,100,
    'card-topup-00000000001','sbp','payment@example.test',$receipt(100),$mock),'REAL_TOPUP_METHOD_CHANGED');
expectReal(fn()=>naRealWalletCreatePayment($db,$payAccount,$good,200,
    'card-topup-00000000001','bank_card','payment@example.test',$receipt(200),$mock),'REAL_TOPUP_KEY_CONFLICT');
$sbp=naRealWalletCreatePayment($db,$payAccount,$good,500,'sbp-topup-00000000002',
    'sbp','payment@example.test',$receipt(500),$mock);
assertReal($sbp['method']==='sbp' && !$sbp['reused']&&count($mockCalls)===2
    && $mockCalls[0]['idempotence']!==$mockCalls[1]['idempotence'],
    'SBP creates separate pending payment with different idempotence key');
$sbpRepeat=naRealWalletCreatePayment($db,$payAccount,$good,500,'sbp-topup-00000000002',
    'sbp','payment@example.test',$receipt(500),$mock);
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
$lost=naRealWalletTopupIntent($db,$payAccount,$good,25,'lost-response-0000000003','payment@example.test');
$db->prepare("UPDATE numi_real_wallet_topups SET payment_method='sbp',
    provider_request_started_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 24 HOUR) WHERE id=?")
    ->execute([$lost['topup_id']]);
expectReal(fn()=>naRealWalletCreatePayment($db,$payAccount,$good,25,'lost-response-0000000003',
    'sbp','payment@example.test',$receipt(25),$mock),'REAL_TOPUP_RECONCILIATION_REQUIRED');
assertReal(count($mockCalls)===3,'expired uncertain payment never POSTs a new external debit');
// A single 20 RUB purchase against multiple fiscalized 10 RUB advances
// must debit ONCE, issue two separately linked offset events, and deliver
// an entitlement immediately. These are isolated MySQL fixtures only.
require_once __DIR__.'/../private/wallet-real-worker.php';
$splitId='00000000-0000-4000-8000-000000000106';
$splitAccount=['id'=>$splitId];
$db->prepare('INSERT INTO numi_accounts(id,email,email_verified_at) VALUES(?,?,UTC_TIMESTAMP())')
    ->execute([$splitId,'split@example.test']);
$db->prepare('INSERT INTO numi_real_wallet_balances(account_id,kopeks) VALUES(?,3000)')
    ->execute([$splitId]);
for($i=1;$i<=3;$i++){
    $sourceId=sprintf('99999999-9999-4999-8999-%012d',$i);
    $db->prepare("INSERT INTO numi_real_wallet_topups
        (id,account_id,request_key,kopeks,receipt_email,provider_payment_id,status,credited_at)
        VALUES(?,?,?,?,?,?,'credited',UTC_TIMESTAMP())")
        ->execute([$sourceId,$splitId,'split-fixture-'.$i,1000,
            'split@example.test','split-provider-'.$i]);
    $db->prepare("INSERT INTO numi_real_wallet_ledger
        (id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks)
        VALUES(?,?,'topup',?,?,?)")
        ->execute([naUuid(),$splitId,$sourceId,1000,$i*1000]);
    $db->prepare("INSERT INTO numi_real_wallet_fiscal_events
        (id,kind,reference_id,kopeks,status)
        VALUES(?,'advance_in',?,1000,'verified')")
        ->execute([naUuid(),$sourceId]);
}
$splitItem=['product_code'=>'redflag_question','category'=>'money',
    'question_id'=>'generosity','birth_date'=>'1986-09-09'];
$splitKey='split-actual-purchase-123';
$splitReady=static fn(array $item):bool=>true;
$splitResult=naRealWalletBuy($db,$splitAccount,$good,$splitItem,$splitKey,$splitReady);
assertReal($splitResult['price_kopeks']===2000
    && $splitResult['balance_kopeks']===1000
    && is_string($splitResult['entitlement_id']),
    'single atomic purchase debits 20 RUB across 10+10 RUB advances');
$q=$db->prepare("SELECT a.id,a.spend_id,a.topup_id,a.kopeks,f.kopeks AS fiscal_amount
    FROM numi_real_wallet_receipt_allocations a
    JOIN numi_real_wallet_fiscal_events f ON f.kind='advance_offset'
        AND f.reference_id=a.id
    JOIN numi_real_wallet_spends s ON s.id=a.spend_id
    WHERE s.account_id=? ORDER BY a.topup_id");
$q->execute([$splitId]);$offsetParts=$q->fetchAll(PDO::FETCH_ASSOC);
assertReal(count($offsetParts)===2
    && array_sum(array_map(static fn($r)=>(int)$r['kopeks'],$offsetParts))===2000
    && (int)$offsetParts[0]['fiscal_amount']===1000
    && (int)$offsetParts[1]['fiscal_amount']===1000,
    'purchase reserves two original advance sources and two exact offset receipts');
$reader=$db->prepare("SELECT id FROM numi_real_wallet_fiscal_events
    WHERE reference_id=? AND kind='advance_offset'");
foreach($offsetParts as $part){
    $reader->execute([$part['id']]);$fiscalId=$reader->fetchColumn();
    $source=naRealWorkerReceiptSource($db,(string)$fiscalId);
    assertReal($source['topup_id']===$part['topup_id']
        && (int)$source['fiscal_kopeks']===(int)$part['kopeks'],
        'fiscal worker binds each receipt to its real original advance');
}
$repeatSplit=naRealWalletBuy($db,$splitAccount,$good,$splitItem,$splitKey,$splitReady);
assertReal($repeatSplit['already_purchased']===true
    && naRealWalletBalance($db,$splitId)===1000,
    'repeated purchase key never causes a second debit');
$q=$db->prepare("SELECT COUNT(*) FROM numi_real_wallet_spends WHERE account_id=?");
$q->execute([$splitId]);
assertReal((int)$q->fetchColumn()===1,'one purchase row despite two fiscal offsets');
$refundId='88888888-8888-4888-8888-888888888888';
$db->prepare("INSERT INTO numi_real_wallet_refund_cases
    (id,account_id,topup_id,kopeks,status) VALUES(?,?,?,1000,'approved')")
    ->execute([$refundId,$splitId,$offsetParts[0]['topup_id']]);
expectReal(fn()=>naRealRefundApprovedCase($db,$refundId),
    'REAL_REFUND_SOURCE_ALREADY_SPENT');
naRealWalletInvariant($db,$splitId);
echo "REAL_MULTI_ADVANCE_PURCHASE_AND_RECEIPT_ALLOCATION_PASS\n";
// Paid personalized reports are keyed to their exact subject and expire
// exactly one calendar year after purchase. Expired access cannot be reused.
$licenseStart=new DateTimeImmutable('2026-11-09 12:30:00',new DateTimeZone('UTC'));
foreach(['year_full','life_full','compatibility_full','child_full_v1'] as $reportCode){
    assertReal(naStoreExpiry($reportCode,$licenseStart)==='2027-11-09 12:30:00',
        $reportCode.' has a one-year paid-access term');
}
assertReal(naStoreExpiry('redflag_question',$licenseStart)===null,
    'one-year license does not change ordinary question access');
assertReal(naStoreExpiry('school_week',$licenseStart)==='2026-11-16 12:30:00',
    'school renewal duration remains weekly');

$licenseAccountId='77777777-7777-4777-8777-777777777777';
$licenseAccount=['id'=>$licenseAccountId];
$licenseTopupId='77777777-7777-4777-8777-777777777778';
$db->prepare('INSERT INTO numi_accounts(id,email,email_verified_at) VALUES(?,?,UTC_TIMESTAMP())')
    ->execute([$licenseAccountId,'license@example.test']);
$db->prepare('INSERT INTO numi_real_wallet_balances(account_id,kopeks) VALUES(?,100000)')
    ->execute([$licenseAccountId]);
$db->prepare("INSERT INTO numi_real_wallet_topups
    (id,account_id,request_key,kopeks,receipt_email,provider_payment_id,status,credited_at)
    VALUES(?,?,?,?,?,?,'credited',UTC_TIMESTAMP())")
    ->execute([$licenseTopupId,$licenseAccountId,'license-topup-20261109',100000,
        'license@example.test','license-provider-fixture']);
$db->prepare("INSERT INTO numi_real_wallet_ledger
    (id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks)
    VALUES(?,?,'topup',?,?,?)")
    ->execute([naUuid(),$licenseAccountId,$licenseTopupId,100000,100000]);
$db->prepare("INSERT INTO numi_real_wallet_fiscal_events
    (id,kind,reference_id,kopeks,status) VALUES(?,'advance_in',?,100000,'verified')")
    ->execute([naUuid(),$licenseTopupId]);
$subject=['product_code'=>'life_full','birth_date'=>'1986-09-09'];
$licenseBought=naRealWalletBuy($db,$licenseAccount,$good,$subject,
    'license-life-purchase-20261109',$splitReady);
assertReal(is_string($licenseBought['expires_at']??null)
    && (new DateTimeImmutable($licenseBought['expires_at'],new DateTimeZone('UTC')))
       >new DateTimeImmutable('now',new DateTimeZone('UTC')),
    'paid life report receives non-null future expiry');
$ownedQuote=naRealWalletQuote($db,$licenseAccount,$subject,$splitReady);
assertReal($ownedQuote['owned']===true,
    'exact same birthday recognizes existing paid report');
$wrongQuote=naRealWalletQuote($db,$licenseAccount,
    ['product_code'=>'life_full','birth_date'=>'1986-09-10'],$splitReady);
assertReal($wrongQuote['owned']===false,
    'another birth date cannot inherit a purchased report');
$wrongKind=naRealWalletQuote($db,$licenseAccount,
    ['product_code'=>'child_full_v1','birth_date'=>'1986-09-09'],$splitReady);
assertReal($wrongKind['owned']===false,
    'another report type cannot inherit a purchased report');
$db->prepare("UPDATE numi_entitlements SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND)
    WHERE id=?")->execute([$licenseBought['entitlement_id']]);
assertReal(naRealWalletQuote($db,$licenseAccount,$subject,$splitReady)['owned']===false
    && !naRealWalletHasAccess($db,$licenseAccount,'life_full','life:1986-09-09'),
    'expired yearly report no longer grants access or duplicate-free purchase');
echo "REAL_ANNUAL_REPORT_SCOPE_AND_EXPIRY_PASS\n";
// Club discount and independently purchased annual report MUST have
// different expiry schedules. Expiring club cannot revoke a paid report.
$clubBuyerId='66666666-6666-4666-8666-666666666666';
$clubBuyer=['id'=>$clubBuyerId];
$clubTopupId='66666666-6666-4666-8666-666666666667';
$db->prepare('INSERT INTO numi_accounts(id,email,email_verified_at) VALUES(?,?,UTC_TIMESTAMP())')
    ->execute([$clubBuyerId,'member-report@example.test']);
$db->prepare('INSERT INTO numi_real_wallet_balances(account_id,kopeks) VALUES(?,150000)')
    ->execute([$clubBuyerId]);
$db->prepare("INSERT INTO numi_real_wallet_topups
    (id,account_id,request_key,kopeks,receipt_email,provider_payment_id,status,credited_at)
    VALUES(?,?,?,?,?,?,'credited',UTC_TIMESTAMP())")
    ->execute([$clubTopupId,$clubBuyerId,'member-report-topup-20261109',150000,
        'member-report@example.test','member-report-provider-fixture']);
$db->prepare("INSERT INTO numi_real_wallet_ledger
    (id,account_id,kind,reference_id,delta_kopeks,balance_after_kopeks)
    VALUES(?,?,'topup',?,?,?)")
    ->execute([naUuid(),$clubBuyerId,$clubTopupId,150000,150000]);
$db->prepare("INSERT INTO numi_real_wallet_fiscal_events
    (id,kind,reference_id,kopeks,status) VALUES(?,'advance_in',?,150000,'verified')")
    ->execute([naUuid(),$clubTopupId]);

$clubReport=['product_code'=>'life_full','birth_date'=>'1986-09-09'];
$beforeClub=naRealWalletQuote($db,$clubBuyer,$clubReport,$splitReady);
assertReal($beforeClub['price_kopeks']===99000
    && $beforeClub['club_active']===false,'full price before membership');

$clubPurchase=naRealWalletBuy($db,$clubBuyer,$good,
    ['product_code'=>'club_month'],'member-club-buy-20261109',$splitReady);
assertReal($clubPurchase['price_kopeks']===49000
    && naRealWalletHasAccess($db,$clubBuyer,'club_month','club'),
    'real paid club opens discounted pricing');
$memberQuote=naRealWalletQuote($db,$clubBuyer,$clubReport,$splitReady);
assertReal($memberQuote['price_kopeks']===49000
    && $memberQuote['club_active']===true,
    'active membership offers 490 RUB report');
$memberReportPurchase=naRealWalletBuy($db,$clubBuyer,$good,$clubReport,
    'member-life-buy-20261109',$splitReady);
assertReal($memberReportPurchase['price_kopeks']===49000
    && $memberReportPurchase['balance_kopeks']===52000,
    'independent report purchase uses club discounted price');
$db->prepare("UPDATE numi_entitlements SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND)
    WHERE id=?")->execute([$clubPurchase['entitlement_id']]);
assertReal(!naRealWalletHasAccess($db,$clubBuyer,'club_month','club'),
    'expired club grants no continuing membership');
assertReal(naRealWalletHasAccess($db,$clubBuyer,'life_full','life:1986-09-09'),
    'already-purchased report survives club expiry');
require_once __DIR__.'/../private/fulfillment.php';
assertReal(naMaterialEntitlement($db,$clubBuyer,$memberReportPurchase['entitlement_id'])!==null,
    'report stays accessible through server material endpoint after club expiry');
$afterClub=naRealWalletQuote($db,$clubBuyer,$clubReport,$splitReady);
assertReal($afterClub['owned']===true && $afterClub['club_active']===false
    && $afterClub['price_kopeks']===99000,
    'expired club removes discount for future purchases but preserves report');
assertReal(naRealWalletQuote($db,$clubBuyer,
    ['product_code'=>'life_full','birth_date'=>'1986-09-10'],$splitReady)['price_kopeks']===99000,
    'new report after club expiry reverts to full price');
$db->prepare("UPDATE numi_entitlements SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND)
    WHERE id=?")->execute([$memberReportPurchase['entitlement_id']]);
assertReal(!naRealWalletHasAccess($db,$clubBuyer,'life_full','life:1986-09-09')
    && naMaterialEntitlement($db,$clubBuyer,$memberReportPurchase['entitlement_id'])===null,
    'expired paid report is blocked even if it was bought with club discount');
naRealWalletInvariant($db,$clubBuyerId);
echo "REAL_CLUB_DISCOUNT_REPORT_SURVIVES_SUBSCRIPTION_EXPIRY_PASS\n";

echo "REAL_CARD_SBP_MOCK_PAYMENT_IDEMPOTENCY_RECEIPTS_PASS\n";


/**
 * Full LIVE subscription path with real MySQL transactions and in-memory
 * YooKassa responses. No network, credentials, real wallet or charges.
 */
$subConfig=array_merge($good,[
    'recurring_merchant_approved'=>true,
    'subscription_receipts_verified'=>true,
    'live_recurring_enabled'=>true,
    'offset_receipt_reviewed'=>true,
    'offset_receipt_vat_code'=>1,
]);
assertReal(naLiveRecurringAllowed($subConfig),'approved config permits reviewed card subscriptions');
foreach(['recurring_merchant_approved','subscription_receipts_verified','live_recurring_enabled'] as $gate){
    $disabled=$subConfig;$disabled[$gate]=false;
    assertReal(!naLiveRecurringAllowed($disabled),'missing '.$gate.' prevents recurring charges');
}
$providerPayments=[];
$providerRequests=[];
$simulatedSend=static function(array $body,string $key)use(&$providerPayments,&$providerRequests):array{
    $id='mock-sub-'.(count($providerRequests)+1);
    $result=[
        'id'=>$id,'test'=>false,'status'=>'pending','paid'=>false,
        'amount'=>$body['amount'],'metadata'=>$body['metadata'],
    ];
    if(isset($body['confirmation'])){
        $result['confirmation']=['type'=>'redirect',
            'confirmation_url'=>'https://yookassa.ru/mock/checkout'];
    }
    $providerRequests[]=['body'=>$body,'key'=>$key,'id'=>$id];
    $providerPayments[$id]=$result;
    return $result;
};
$simulatedRead=static function(string $id)use(&$providerPayments):array{
    if(!isset($providerPayments[$id]))throw new RuntimeException('MOCK_PAYMENT_MISSING');
    return $providerPayments[$id];
};
$subAccountId='00000000-0000-4000-8000-000000000107';
$subAccount=['id'=>$subAccountId];
$db->prepare('INSERT INTO numi_accounts(id,email,email_verified_at) VALUES(?,?,UTC_TIMESTAMP())')
    ->execute([$subAccountId,'recurring@example.test']);
$initial=naLiveSubscriptionStart($db,$subAccount,$subConfig,'club_month',
    'recurring@example.test','recurring-club-start-001',$simulatedSend);
assertReal($initial['status']==='pending' && count($providerRequests)===1,
    'initial card checkout creates one simulated provider request');
$body=$providerRequests[0]['body'];
assertReal(($body['save_payment_method']??null)===true
    && ($body['payment_method_data']['type']??null)==='bank_card'
    && !isset($body['payment_method_id'])
    && ($body['amount']['value']??null)==='490.00'
    && ($body['receipt']['items'][0]['payment_mode']??null)==='full_payment'
    && ($body['receipt']['items'][0]['payment_subject']??null)==='service'
    && ($body['receipt']['items'][0]['vat_code']??null)===1
    && ($body['receipt']['customer']['email']??null)==='recurring@example.test',
    'initial payment saves bank card and attaches correct itemized full-payment receipt');
$initPay=$initial['payment_id'];
$retry=naLiveSubscriptionStart($db,$subAccount,$subConfig,'club_month',
    'recurring@example.test','recurring-club-start-001',$simulatedSend);
assertReal($retry['payment_id']===$initPay && count($providerRequests)===1,
    'same initial request cannot issue a duplicate charge');
assertReal(naLiveSubscriptionSync($db,$subConfig,$initial['checkout_id'],$subAccountId,$simulatedRead)['status']==='pending',
    'pending payment grants no access');
assertReal(!naRealWalletHasAccess($db,$subAccount,'club_month','club'),
    'unconfirmed payment cannot create paid membership');
$providerPayments[$initPay]['status']='succeeded';
$providerPayments[$initPay]['paid']=true;
$providerPayments[$initPay]['receipt_registration']='pending';
$providerPayments[$initPay]['payment_method']=[
    'type'=>'bank_card','saved'=>true,'id'=>'mock-card-abc123'];
assertReal(naLiveSubscriptionSync($db,$subConfig,$initial['checkout_id'],$subAccountId,$simulatedRead)['status']==='pending_receipt',
    'payment waits until receipt registration is confirmed');
assertReal(!naRealWalletHasAccess($db,$subAccount,'club_month','club'),
    'pending receipt cannot activate access');
$providerPayments[$initPay]['receipt_registration']='succeeded';
$settled=naLiveSubscriptionSync($db,$subConfig,$initial['checkout_id'],$subAccountId,$simulatedRead);
assertReal($settled['status']==='paid' && $settled['auto_renew']===true
    && naRealWalletHasAccess($db,$subAccount,'club_month','club'),
    'verified payment and receipt grant membership and enable saved-card renewal');
$rows=$db->prepare("SELECT auto_renew,payment_method_id,source_order_id FROM numi_subscription_settings
    WHERE account_id=? AND product_code='club_month'");
$rows->execute([$subAccountId]);$clubPrefs=$rows->fetch(PDO::FETCH_ASSOC);
assertReal((int)$clubPrefs['auto_renew']===1
    && $clubPrefs['payment_method_id']==='mock-card-abc123',
    'only an opaque provider payment method identifier is stored');
naLiveSubscriptionSync($db,$subConfig,$initial['checkout_id'],$subAccountId,$simulatedRead);
$count=$db->prepare("SELECT COUNT(*) FROM numi_entitlements
    WHERE account_id=? AND product_code='club_month'");
$count->execute([$subAccountId]);
assertReal((int)$count->fetchColumn()===1,'reconciliation never grants duplicate access');
assertReal(naLiveSubscriptionRenewIntent($db,$subConfig,$subAccountId,'club_month')===null,
    'an active paid period cannot be charged early');
$db->prepare("UPDATE numi_entitlements
    SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND)
    WHERE account_id=? AND product_code='club_month'")->execute([$subAccountId]);
$renew=naLiveSubscriptionRenewIntent($db,$subConfig,$subAccountId,'club_month');
assertReal(is_array($renew)&&$renew['has_payment']===false,
    'expired verified club membership produces one renewal intent');
$renewRetry=naLiveSubscriptionRenewIntent($db,$subConfig,$subAccountId,'club_month');
assertReal($renewRetry['checkout_id']===$renew['checkout_id'],
    'retry uses same renewal intent');
$renewCharge=naLiveSubscriptionCreatePayment($db,$subConfig,$renew['checkout_id'],
    $subAccountId,$renew['payment_method_id'],$simulatedSend);
$renewBody=$providerRequests[1]['body'];
assertReal(($renewBody['payment_method_id']??null)==='mock-card-abc123'
    && ($renewBody['save_payment_method']??null)===false
    && !isset($renewBody['confirmation'])
    && ($renewBody['receipt']['items'][0]['amount']['value']??null)==='490.00',
    'renewal uses existing card without redirect, with fresh receipt');
$renewAgain=naLiveSubscriptionCreatePayment($db,$subConfig,$renew['checkout_id'],
    $subAccountId,$renew['payment_method_id'],$simulatedSend);
assertReal($renewAgain['payment_id']===$renewCharge['payment_id'] && count($providerRequests)===2,
    'retry cannot create a second renewal charge');
$renewPay=$renewCharge['payment_id'];
$providerPayments[$renewPay]['status']='succeeded';
$providerPayments[$renewPay]['paid']=true;
$providerPayments[$renewPay]['receipt_registration']='succeeded';
$renewalPaid=naLiveSubscriptionSync($db,$subConfig,$renew['checkout_id'],$subAccountId,$simulatedRead);
assertReal($renewalPaid['status']==='paid'&&$renewalPaid['auto_renew']===true
    &&naRealWalletHasAccess($db,$subAccount,'club_month','club'),
    'confirmed renewal restores paid access automatically');
naLiveSubscriptionSync($db,$subConfig,$renew['checkout_id'],$subAccountId,$simulatedRead);
$count->execute([$subAccountId]);
assertReal((int)$count->fetchColumn()===2,
    'initial membership plus single renewal yields exactly two entitlements');

$school=naLiveSubscriptionStart($db,$subAccount,$subConfig,'school_week',
    'school@example.test','recurring-school-start-001',$simulatedSend);
$schoolPay=$school['payment_id'];
$providerPayments[$schoolPay]['status']='succeeded';
$providerPayments[$schoolPay]['paid']=true;
$providerPayments[$schoolPay]['receipt_registration']='succeeded';
$providerPayments[$schoolPay]['payment_method']=[
    'type'=>'bank_card','saved'=>true,'id'=>'mock-school-card'];
$schoolPaid=naLiveSubscriptionSync($db,$subConfig,$school['checkout_id'],$subAccountId,$simulatedRead);
assertReal($schoolPaid['status']==='paid'&&$schoolPaid['auto_renew']===true
    &&($providerRequests[2]['body']['amount']['value']??null)==='149.00',
    'independent school subscription has weekly price and its own card');
naRealWalletCancelSubscription($db,$subAccount,'school_week');
$schoolAfter=$db->prepare("SELECT auto_renew,payment_method_id,cancelled_at
    FROM numi_subscription_settings WHERE account_id=? AND product_code='school_week'");
$schoolAfter->execute([$subAccountId]);$schoolPrefs=$schoolAfter->fetch(PDO::FETCH_ASSOC);
$rows->execute([$subAccountId]);$clubAfter=$rows->fetch(PDO::FETCH_ASSOC);
assertReal((int)$schoolPrefs['auto_renew']===0
    &&$schoolPrefs['payment_method_id']===null
    &&$schoolPrefs['cancelled_at']!==null
    &&(int)$clubAfter['auto_renew']===1
    &&naRealWalletHasAccess($db,$subAccount,'school_week','school'),
    'cancel school unlinks its card but keeps paid access and independent club renewal');
assertReal(naLiveSubscriptionRenewIntent($db,$subConfig,$subAccountId,'school_week')===null,
    'canceled school never initiates a future charge');

// Detect starvation: 20 valid future subscribers must not hide the 21st
// already-expired subscriber from a bounded scheduled worker.
for($n=1;$n<=21;$n++){
    $id=sprintf('11111111-1111-4111-8111-%012d',$n);
    $orderId=naUuid();
    $db->prepare('INSERT INTO numi_accounts(id,email,email_verified_at) VALUES(?,?,UTC_TIMESTAMP())')
        ->execute([$id,'subscriber'.$n.'@example.test']);
    $db->prepare("INSERT INTO numi_orders
        (id,account_id,product_code,resource_id,amount_kopeks,provider,status,verified_at)
        VALUES(?,?,'club_month','club',49000,'real_subscription','paid',UTC_TIMESTAMP())")
        ->execute([$orderId,$id]);
    $expiration=$n<21?'DATE_ADD(UTC_TIMESTAMP(),INTERVAL 20 DAY)':
        'DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE)';
    $db->prepare("INSERT INTO numi_entitlements
        (id,account_id,order_id,product_code,resource_id,status,expires_at)
        VALUES(?,?,?,'club_month','club','active',".$expiration.")")
        ->execute([naUuid(),$id,$orderId]);
    $db->prepare("INSERT INTO numi_subscription_settings
        (account_id,product_code,auto_renew,payment_method_id,receipt_email,source_order_id)
        VALUES(?,'club_month',1,'mock-batch-card',?,?)")
        ->execute([$id,'subscriber'.$n.'@example.test',$orderId]);
}
$before=count($providerRequests);
$tick=naLiveSubscriptionTick($db,$subConfig,$simulatedSend,$simulatedRead);
$dueId='11111111-1111-4111-8111-000000000021';
$due=$db->prepare("SELECT COUNT(*) FROM numi_checkouts c
    JOIN numi_checkout_items i ON i.checkout_id=c.id
    JOIN numi_orders o ON o.id=i.order_id
    WHERE o.account_id=? AND o.provider='real_subscription' AND o.status='pending'
      AND c.provider_payment_id IS NOT NULL");
$due->execute([$dueId]);
assertReal((int)$due->fetchColumn()===1 &&count($providerRequests)===$before+1,
    '21st expired subscription renews even with 20 earlier active subscribers');

// Additional failure and consent-revocation paths, all using simulated provider data.
function subscriptionMockAccount(PDO $db,string $id,string $email): array {
    $db->prepare('INSERT INTO numi_accounts(id,email,email_verified_at) VALUES(?,?,UTC_TIMESTAMP())')
        ->execute([$id,$email]);
    return ['id'=>$id];
}
$cancelling=subscriptionMockAccount($db,'00000000-0000-4000-8000-000000000108','cancel@example.test');
$pendingCancel=naLiveSubscriptionStart($db,$cancelling,$subConfig,'school_week',
    'cancel@example.test','cancel-during-first-payment',$simulatedSend);
naRealWalletCancelSubscription($db,$cancelling,'school_week');
$providerPayments[$pendingCancel['payment_id']]['status']='succeeded';
$providerPayments[$pendingCancel['payment_id']]['paid']=true;
$providerPayments[$pendingCancel['payment_id']]['receipt_registration']='succeeded';
$providerPayments[$pendingCancel['payment_id']]['payment_method']=[
    'type'=>'bank_card','saved'=>true,'id'=>'cancelled-card-id'];
$cancelSettled=naLiveSubscriptionSync($db,$subConfig,$pendingCancel['checkout_id'],
    $cancelling['id'],$simulatedRead);
assertReal($cancelSettled['status']==='paid'&&$cancelSettled['auto_renew']===false
    &&naRealWalletHasAccess($db,$cancelling,'school_week','school')
    &&naLiveSubscriptionRenewIntent($db,$subConfig,$cancelling['id'],'school_week')===null,
    'cancel during pending first payment keeps paid access but cannot reactivate renewal');
$cancelPref=$db->prepare("SELECT payment_method_id FROM numi_subscription_settings
    WHERE account_id=? AND product_code='school_week'");
$cancelPref->execute([$cancelling['id']]);
assertReal($cancelPref->fetchColumn()===null,
    'a cancellation during payment wins over later provider saved-card response');

$failed=subscriptionMockAccount($db,'00000000-0000-4000-8000-000000000109','failure@example.test');
$failedPay=naLiveSubscriptionStart($db,$failed,$subConfig,'club_month',
    'failure@example.test','initial-payment-failure-case',$simulatedSend);
$providerPayments[$failedPay['payment_id']]['status']='canceled';
$cancelledPayment=naLiveSubscriptionSync($db,$subConfig,$failedPay['checkout_id'],
    $failed['id'],$simulatedRead);
assertReal($cancelledPayment['status']==='cancelled'
    &&!naRealWalletHasAccess($db,$failed,'club_month','club')
    &&naLiveSubscriptionRenewIntent($db,$subConfig,$failed['id'],'club_month')===null,
    'canceled initial payment never grants membership or future charges');

$noSavedCard=subscriptionMockAccount($db,'00000000-0000-4000-8000-000000000110','nosave@example.test');
$noSave=naLiveSubscriptionStart($db,$noSavedCard,$subConfig,'school_week',
    'nosave@example.test','card-not-saved-case-001',$simulatedSend);
$providerPayments[$noSave['payment_id']]['status']='succeeded';
$providerPayments[$noSave['payment_id']]['paid']=true;
$providerPayments[$noSave['payment_id']]['receipt_registration']='succeeded';
$providerPayments[$noSave['payment_id']]['payment_method']=[
    'type'=>'bank_card','saved'=>false,'id'=>'provider-unsaved-card'];
$noSaveResult=naLiveSubscriptionSync($db,$subConfig,$noSave['checkout_id'],
    $noSavedCard['id'],$simulatedRead);
assertReal($noSaveResult['status']==='paid'&&$noSaveResult['auto_renew']===false
    &&naRealWalletHasAccess($db,$noSavedCard,'school_week','school'),
    'no saved provider card means paid access but no future renewal consent');

$badProvider=subscriptionMockAccount($db,'00000000-0000-4000-8000-000000000111','badpay@example.test');
$bad=naLiveSubscriptionStart($db,$badProvider,$subConfig,'club_month',
    'badpay@example.test','bad-provider-response-case',$simulatedSend);
$providerPayments[$bad['payment_id']]['status']='succeeded';
$providerPayments[$bad['payment_id']]['paid']=true;
$providerPayments[$bad['payment_id']]['receipt_registration']='succeeded';
$providerPayments[$bad['payment_id']]['amount']['value']='1.00';
expectReal(fn()=>naLiveSubscriptionSync($db,$subConfig,$bad['checkout_id'],
    $badProvider['id'],$simulatedRead),'REAL_SUBSCRIPTION_PAYMENT_VERIFICATION_FAILED');
assertReal(!naRealWalletHasAccess($db,$badProvider,'club_month','club'),
    'provider payment amount mismatch cannot grant or renew membership');
$providerPayments[$bad['payment_id']]['amount']['value']='490.00';
$providerPayments[$bad['payment_id']]['payment_method']=[
    'type'=>'bank_card','saved'=>true,'id'=>'valid-later-card'];
assertReal(naLiveSubscriptionSync($db,$subConfig,$bad['checkout_id'],
    $badProvider['id'],$simulatedRead)['status']==='paid',
    'a corrected verified provider response may settle exactly once');

// Pending automated renewal is reconciled, not submitted a second time.
$pendingCount=count($providerRequests);
naLiveSubscriptionTick($db,$subConfig,$simulatedSend,$simulatedRead);
assertReal(count($providerRequests)===$pendingCount,
    'scheduled retry never submits a second payment while a renewal is pending');
$duePaymentId=end($providerRequests)['id'];
$providerPayments[$duePaymentId]['status']='succeeded';
$providerPayments[$duePaymentId]['paid']=true;
$providerPayments[$duePaymentId]['receipt_registration']='succeeded';
naLiveSubscriptionTick($db,$subConfig,$simulatedSend,$simulatedRead);
$dueCount=$db->prepare("SELECT COUNT(*) FROM numi_entitlements
    WHERE account_id=? AND product_code='club_month'");
$dueCount->execute([$dueId]);
assertReal((int)$dueCount->fetchColumn()===2
    &&count($providerRequests)===$pendingCount,
    'scheduled reconciliation extends access once after confirmed renewal without charging twice');
echo "REAL_LIVE_SUBSCRIPTIONS_NEGATIVE_PATHS_PASS\n";

echo "REAL_LIVE_SUBSCRIPTIONS_MOCK_END_TO_END_PASS\n";
