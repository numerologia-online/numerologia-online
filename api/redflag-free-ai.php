<?php
declare(strict_types=1);
/* Red Flag free answer is intentionally unavailable until a non-AI version is approved.
   No external model, bridge, cache, purchases, or generated texts are accessed. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
http_response_code(503);
echo json_encode(['ok'=>false,'error'=>'REDFLAG_NOT_READY'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
