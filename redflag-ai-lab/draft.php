<?php
declare(strict_types=1);
/* Owner Red Flag catalog remains available. Remote AI generation has been removed. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
function rfLabReply(int $status,array $response): never {
    http_response_code($status);
    echo json_encode($response,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}
try {
    if (!naTestOwner(naCurrent(naDB()))) rfLabReply(403,['ok'=>false,'error'=>'OWNER_ONLY']);
    if (($_SERVER['REQUEST_METHOD']??'')==='GET') {
        $catalog=json_decode((string)file_get_contents(__DIR__.'/catalog.json'),true,20,JSON_THROW_ON_ERROR);
        rfLabReply(200,['ok'=>true,'owner'=>true,'draft_only'=>true,'auto_publish'=>false,
            'generation_enabled'=>false,'catalog'=>$catalog]);
    }
    rfLabReply(410,['ok'=>false,'error'=>'REDFLAG_GENERATION_REMOVED']);
} catch(Throwable $exception) {
    error_log('REDFLAG_OWNER_CATALOG:'.get_class($exception));
    rfLabReply(503,['ok'=>false,'error'=>'TEMPORARILY_UNAVAILABLE']);
}
