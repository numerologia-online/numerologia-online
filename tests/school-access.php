<?php
declare(strict_types=1);
require dirname(__DIR__).'/server/school-access/private/gate.php';
function check(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);}
function numiBotToken(array $config):string{return 'isolated-test-bot-secret-never-production';}
function numiTelegramUser(string $signed,string $token):?array{
    $parts=explode(':',$signed,2);if(count($parts)!==2||!hash_equals(hash_hmac('sha256',$parts[0],$token),$parts[1]))return null;
    return ['id'=>$parts[0]];
}
function numiIsOwner(?array $user,array $config):bool{return $user!==null&&hash_equals($config['owner_id'],$user['id']);}
function numiManifest():array{return ['files'=>['pro/school/lessons/base.json'=>['cached'=>true]]];}
function numiPrivateRead(string $path,array $config):string{return '{"canonical":true}';}
$config=['owner_id'=>'123456789'];$now=1793680000;$key='isolated-test-purpose-key';$binding=hash('sha256','session-a');
$token=nsCookie($config['owner_id'],$key,$binding,$now);
check(nsValidCookie($token,$config['owner_id'],$key,$binding,$now),'confirmed owner cookie');
check(!nsValidCookie($token,'987654321',$key,$binding,$now),'other account cannot use owner cookie');
check(!nsValidCookie($token,$config['owner_id'],$key,hash('sha256','session-b'),$now),'switching accounts invalidates cookie');
check(!nsValidCookie($token,$config['owner_id'],$key,$binding,$now+NS_TTL),'expired cookie is denied');
check(!nsValidCookie($token,$config['owner_id'],$key,$binding,$now-1),'future cookie is denied');
check(!nsValidCookie(substr($token,0,-1).'x',$config['owner_id'],$key,$binding,$now),'changed signature is denied');
check(!nsValidCookie('owner=true',$config['owner_id'],$key,$binding,$now),'browser flags are denied');
check(!nsValidCookie($token,$config['owner_id'],'wrong-key',$binding,$now),'wrong signing key is denied');
$_COOKIE=[];$noAccount=fn(string $owner)=>false;
$signed=fn(string $id)=>$id.':'.hash_hmac('sha256',$id,numiBotToken($config));
check(nsOwner($config,$key,$signed($config['owner_id']),$noAccount),'verified Telegram owner admitted');
check(!nsOwner($config,$key,$signed('987654321'),$noAccount),'other verified Telegram user denied');
check(!nsOwner($config,$key,'123456789:forged',$noAccount),'forged Telegram identity denied');
check(!nsOwner($config,$key,'',$noAccount),'anonymous denied');
check(nsOwner($config,$key,'',fn(string $owner)=>$owner===$config['owner_id']),'server-confirmed management account admitted');
$_COOKIE['__Host-numi_session']='account-a';
$_COOKIE[NS_COOKIE]=nsCookie($config['owner_id'],$key,nsBinding(),time());
check(nsOwner($config,$key,'',$noAccount),'bound current owner cookie admitted');
check(!nsOwner($config,$key,$signed('987654321'),$noAccount),'switching Telegram users invalidates the owner exception');
$_COOKIE['__Host-numi_session']='account-b';
check(!nsOwner($config,$key,'',$noAccount),'same browser with another account denied');
foreach(['/pro/school/../index.html','/pro/school/%2e%2e/index.html','/pro/school/%252e%252e/index.html','/pro/school//lesson/','/pro/school/.htaccess','/api/numi-account.php','/pro/schools/../index.html']as$path){
 $normalized=nsPath($path);check($normalized===null||!nsAllowed($normalized,json_decode(file_get_contents(dirname(__DIR__).'/server/school-access/private/allowlist.json'),true)),'unsafe path denied: '.$path);
}
check(nsPath('/pro/school/?id=start&owner=true')==='pro/school/index.html','query flags do not select protected source');
check(nsPath('/pro/school/lesson/?id=base')==='pro/school/lesson/index.html','lesson route resolves');
$allowed=json_decode(file_get_contents(dirname(__DIR__).'/server/school-access/private/allowlist.json'),true);
foreach(['pro/school/lessons/start.json','pro/school/lessons/base.json','pro/schools/classic/lesson/index.html','pro/schools/angel/index.html']as$path)check(nsAllowed($path,$allowed),'known course included: '.$path);
foreach(['index.html','api/numi-account.php','pro/index.html','server/school-access/private/gate.php']as$path)check(!nsAllowed($path,$allowed),'other site paths excluded');
$dir=sys_get_temp_dir().'/numi-school-test-'.bin2hex(random_bytes(6));mkdir($dir.'/pro/school/lessons',0700,true);file_put_contents($dir.'/pro/school/lessons/base.json','{"stale":true}');
check(nsFile($dir,'pro/school/lessons/base.json',$allowed,$config)==='{"canonical":true}','private canonical content preserved');
unlink($dir.'/pro/school/lessons/base.json');rmdir($dir.'/pro/school/lessons');rmdir($dir.'/pro/school');rmdir($dir.'/pro');rmdir($dir);
$offer=file_get_contents(dirname(__DIR__).'/server/school-access/private/offer.html');
check(str_contains($offer,'150 ₽')&&str_contains($offer,'/ месяц')&&str_contains($offer,'ТОЛЬКО ПО ПОДПИСКЕ'),'scoped monthly school price');
$hub=file_get_contents(dirname(__DIR__).'/pro/schools/index.html');
check(substr_count($hub,'data-school-entry')===3,'all three prepared directions use owner gate');
check(substr_count($hub,'В разработке — пока недоступно')===6,'every unfinished direction labelled');
check(str_contains(file_get_contents(dirname(__DIR__).'/index.html'),'8 школ нумерологии'),'home button count');
echo "PASS: owner, other account, anonymous, forged/expired cookies, account switching, route traversal, canonical content and all catalog locks.\n";
