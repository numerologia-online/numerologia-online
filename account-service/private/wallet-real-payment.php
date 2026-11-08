<?php
declare(strict_types=1);
/**
 * SERVER-INTERNAL ONLY. Live card/SBP payment preparation for the existing REAL wallet.
 *
 * This module is intentionally NOT routed from core.php or deployed on REG.RU.
 * It must remain disabled until the fiscal receipt scheme, refund operations,
 * account merge, entitlement serving and end-to-end testing are approved.
 * NEVER accept $receipt from a browser. Build it on the server with the
 * actual audited cash-register policy for a freely spendable RUB advance.
 */
require_once __DIR__.'/wallet-real.php';

function naRealPaymentMethod(mixed $method): string {
    if (!is_string($method) || !in_array($method,['bank_card','sbp'],true))
        throw new InvalidArgumentException('REAL_UNSUPPORTED_PAYMENT_METHOD');
    return $method;
}
function naRealPaymentIdempotenceKey(string $topupId): string {
    if (preg_match('/^[a-f0-9-]{36}$/iD',$topupId)!==1)
        throw new InvalidArgumentException('INVALID_REAL_TOPUP_ID');
    // Deterministic per durable topup. Never switch the method or amount on retry.
    return hash('sha256','numi-real-wallet-topup-v1:'.$topupId);
}
function naRealPaymentReceipt(array $receipt,string $verifiedEmail,int $kopeks): array {
    // No fiscal values are invented here. An audited, server-only fiscal builder
    // must supply payment_subject, payment_mode, VAT and description.
    if (($receipt['customer']['email']??null)!==$verifiedEmail)
        throw new RuntimeException('REAL_FISCAL_CONTACT_MISMATCH');
    $items=$receipt['items']??null;
    if (!is_array($items)||array_is_list($items)===false||count($items)!==1)
        throw new RuntimeException('REAL_FISCAL_RECEIPT_NOT_REVIEWED');
    $item=$items[0];
    if (!is_array($item)||!is_string($item['description']??null)
        ||trim($item['description'])===''||mb_strlen($item['description'])>128
        ||!in_array($item['payment_mode']??null,['advance','full_prepayment'],true)
        ||!is_string($item['payment_subject']??null)||!isset($item['vat_code'])
        ||!in_array((string)($item['quantity']??''),['1','1.0','1.000'],true)
        ||($item['amount']['currency']??null)!=='RUB'
        ||($item['amount']['value']??null)!==naStoreAmount($kopeks))
        throw new RuntimeException('REAL_FISCAL_RECEIPT_NOT_REVIEWED');
    return ['customer'=>['email'=>$verifiedEmail],'items'=>[$item]];
}
function naRealPaymentPayload(array $topup,string $method,string $verifiedEmail,array $receipt): array {
    $method=naRealPaymentMethod($method);
    $kopeks=(int)($topup['kopeks']??0);
    if ($kopeks<100||$kopeks>10000000)
        throw new InvalidArgumentException('INVALID_REAL_PAYMENT_AMOUNT');
    $id=$topup['id']??null;
    if (!is_string($id)||preg_match('/^[a-f0-9-]{36}$/iD',$id)!==1)
        throw new InvalidArgumentException('INVALID_REAL_TOPUP_ID');
    return [
        'amount'=>['value'=>naStoreAmount($kopeks),'currency'=>'RUB'],
        'capture'=>true,
        'payment_method_data'=>['type'=>$method],
        'confirmation'=>[
            'type'=>'redirect',
            'return_url'=>'https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/?account=1&wallet_topup='.$id,
        ],
        'description'=>'Пополнение баланса Numerologia Online №'.substr($id,0,8),
        'save_payment_method'=>false,
        'metadata'=>['numi_real_wallet_topup'=>$id],
        'receipt'=>naRealPaymentReceipt($receipt,$verifiedEmail,$kopeks),
    ];
}
function naRealPaymentConfirmationUrl(array $payment): ?string {
    if (($payment['confirmation']['type']??null)!=='redirect')return null;
    $url=$payment['confirmation']['confirmation_url']??null;
    if (!is_string($url)||strlen($url)>2000)return null;
    $parts=parse_url($url);
    if (!is_array($parts)||($parts['scheme']??null)!=='https'||isset($parts['user'])||isset($parts['pass'])
        ||isset($parts['port'])||!is_string($parts['host']??null))return null;
    $host=strtolower($parts['host']);
    $allowed=$host==='yookassa.ru'||$host==='yoomoney.ru'
        ||str_ends_with($host,'.yookassa.ru')||str_ends_with($host,'.yoomoney.ru');
    return $allowed ? $url : null;
}
/** Injectable POST transport for isolated tests. The production transport never logs credentials. */
function naRealPaymentTransport(array $config,string $idempotenceKey,array $payload,?callable $testTransport=null): array {
    naRealWalletRequireLive($config);
    if ($testTransport!==null) {
        $response=$testTransport($payload,$idempotenceKey);
        if (!is_array($response))throw new RuntimeException('REAL_PROVIDER_INVALID_RESPONSE');
        return $response;
    }
    $json=json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    $curl=curl_init('https://api.yookassa.ru/v3/payments');
    if ($curl===false)throw new RuntimeException('REAL_PROVIDER_UNAVAILABLE');
    try {
        curl_setopt_array($curl,[
            CURLOPT_POST=>true,
            CURLOPT_POSTFIELDS=>$json,
            CURLOPT_RETURNTRANSFER=>true,
            CURLOPT_CONNECTTIMEOUT=>5,
            CURLOPT_TIMEOUT=>20,
            CURLOPT_FOLLOWLOCATION=>false,
            CURLOPT_USERPWD=>$config['shop_id'].':'.$config['secret_key'],
            CURLOPT_HTTPHEADER=>[
                'Content-Type: application/json',
                'Idempotence-Key: '.$idempotenceKey,
            ],
        ]);
        $raw=curl_exec($curl);
        $status=curl_getinfo($curl,CURLINFO_HTTP_CODE);
    } finally {
        curl_close($curl);
    }
    // 500/timeout are ambiguous. Retry only with the SAME key within 23h.
    if (!is_string($raw)||!in_array($status,[200,201],true))
        throw new RuntimeException('REAL_PROVIDER_CREATION_UNCERTAIN');
    $response=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
    if (!is_array($response))throw new RuntimeException('REAL_PROVIDER_INVALID_RESPONSE');
    return $response;
}
/**
 * Create exactly one external payment for a durable topup intent.
 * Only a trusted server operation can invoke this; no public API route exists.
 * The same request key never changes the method, amount or fiscal receipt.
 */
function naRealWalletCreatePayment(
    PDO $db,array $account,array $config,int $rub,string $requestKey,string $method,
    array $reviewedServerReceipt,?callable $testTransport=null
): array {
    naRealWalletRequireLive($config);
    $method=naRealPaymentMethod($method);
    $email=naRealWalletRequireReceiptContact($db,$account);
    $intent=naRealWalletTopupIntent($db,$account,$config,$rub,$requestKey);
    $topupId=$intent['topup_id'];
    $db->beginTransaction();
    try {
        // Serialize concurrent requests from the same account before any provider POST.
        $q=$db->prepare('SELECT id FROM numi_accounts WHERE id=? FOR UPDATE');
        $q->execute([$account['id']]);
        if (!$q->fetchColumn())throw new RuntimeException('ACCOUNT_NOT_FOUND');
        $q=$db->prepare('SELECT * FROM numi_real_wallet_topups WHERE id=? AND account_id=? FOR UPDATE');
        $q->execute([$topupId,$account['id']]);
        $topup=$q->fetch();
        if (!$topup)throw new RuntimeException('REAL_TOPUP_NOT_FOUND');
        if ($topup['status']!=='pending')throw new RuntimeException('REAL_TOPUP_NOT_PENDING');
        if ($topup['payment_method']!==null && $topup['payment_method']!==$method)
            throw new RuntimeException('REAL_TOPUP_METHOD_CHANGED');
        // Check receipt before registering the intended method: bad fiscal data must fail closed.
        $payload=naRealPaymentPayload($topup,$method,$email,$reviewedServerReceipt);
        if ($topup['provider_payment_id']) {
            $db->commit();
            return [
                'topup_id'=>$topupId,'payment_id'=>$topup['provider_payment_id'],
                'confirmation_url'=>$topup['confirmation_url']?:null,
                'status'=>'pending','method'=>$method,'reused'=>true,
            ];
        }
        // YooKassa Idempotence-Key expires in 24h. Refuse any potentially
        // duplicate POST after 23h; do not silently create another debit.
        if ($topup['provider_request_started_at']!==null) {
            $age=time()-(new DateTimeImmutable(
                $topup['provider_request_started_at'],new DateTimeZone('UTC')))->getTimestamp();
            if ($age>=23*3600||$age<(-60))
                throw new RuntimeException('REAL_TOPUP_RECONCILIATION_REQUIRED');
        } else {
            $db->prepare('UPDATE numi_real_wallet_topups SET payment_method=?,provider_request_started_at=UTC_TIMESTAMP() WHERE id=?')
                ->execute([$method,$topupId]);
        }
        $db->commit();
    } catch(Throwable $e) {
        if ($db->inTransaction())$db->rollBack();
        throw $e;
    }
    // Outside the DB transaction, but always using the persisted stable topup ID.
    $response=naRealPaymentTransport(
        $config,naRealPaymentIdempotenceKey($topupId),$payload,$testTransport);
    naRealWalletPaymentVerify($response,$topup,$config);
    if (($response['payment_method']['type']??$method)!==$method)
        throw new RuntimeException('REAL_PROVIDER_METHOD_MISMATCH');
    $url=naRealPaymentConfirmationUrl($response);
    if (($response['status']??null)==='pending' && $url===null)
        throw new RuntimeException('REAL_PROVIDER_CONFIRMATION_MISSING');
    naRealWalletAttachVerifiedProvider($db,$topup,$response,$config);
    $db->prepare('UPDATE numi_real_wallet_topups SET confirmation_url=? WHERE id=? AND provider_payment_id=?')
        ->execute([$url,$topupId,$response['id']]);
    return [
        'topup_id'=>$topupId,'payment_id'=>$response['id'],'confirmation_url'=>$url,
        'status'=>$response['status']??'pending','method'=>$method,'reused'=>false,
    ];
}
