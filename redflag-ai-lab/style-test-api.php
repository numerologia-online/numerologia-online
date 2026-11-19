<?php
declare(strict_types=1);
/* Owner-only Red Flag model preview was permanently disconnected. */
require dirname(__DIR__,3).'/private/numi-account-20261031/core.php';
naHeaders();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
http_response_code(410);
echo json_encode(['ok'=>false,'error'=>'REDFLAG_GENERATION_REMOVED'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
