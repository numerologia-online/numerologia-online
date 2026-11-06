<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/core.php';require __DIR__.'/store.php';
try{echo json_encode(['ok'=>true,'results'=>naSubscriptionTick(naDB(),naStoreConfig())],JSON_THROW_ON_ERROR)."\n";}
catch(Throwable $e){fwrite(STDERR,"RENEWAL_FAILED: ".$e->getMessage()."\n");exit(1);}
