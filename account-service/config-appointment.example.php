<?php
// Copy only outside the public webroot to private/numi-appointment/config.local.php.
// Independent from the active wallet. Never enable without the acceptance checklist.
return ['enabled'=>false,'fiscal_reviewed'=>false,'webhook_verified'=>false,
 'delivery_and_refunds_reviewed'=>false,'vat_code'=>null,'owner_email'=>''];
