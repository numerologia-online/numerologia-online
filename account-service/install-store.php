<?php
declare(strict_types=1);
/** Run from an extracted PRIVATE release directory. No HTTP entry, credentials or CRON. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
function releaseHash(string $path): ?string {if(is_link($path))throw new RuntimeException('Symlink refused: '.$path);return is_file($path)?hash_file('sha256',$path):null;}
function releaseTarget(string $home,string $site,array $item): string {
    $relative=$item['target'];if(!is_string($relative)||!preg_match('~^[a-zA-Z0-9_./-]+$~D',$relative)||preg_match('~(^|/)\.\.?(/|$)~',$relative))throw new RuntimeException('Invalid release path');
    $base=$item['scope']==='private'?$home.'/private':$site;
    $path=$base.'/'.$relative;$cursor=dirname($path);
    while(strlen($cursor)>=strlen($base)){if(is_link($cursor))throw new RuntimeException('Symlink directory refused: '.$cursor);if($cursor===$base)break;$cursor=dirname($cursor);}
    return $path;
}
function releaseHealth(string $origin): void {
    if(!preg_match('~^https://(?:www\.)?xn----8sbhhqijddjgdebdz2c2o\.xn--p1ai$~D',$origin))throw new RuntimeException('Unexpected verification origin');
    foreach([['action'=>'health'],['action'=>'session'],['action'=>'cart_quote','items'=>[['product_code'=>'school_week']]]]as$body){
        $c=curl_init($origin.'/api/numi-account.php');curl_setopt_array($c,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Origin: '.$origin],CURLOPT_POSTFIELDS=>json_encode($body,JSON_THROW_ON_ERROR)]);$raw=curl_exec($c);$status=curl_getinfo($c,CURLINFO_HTTP_CODE);curl_close($c);
        $data=is_string($raw)?json_decode($raw,true):null;if($status!==200||!is_array($data)||($data['ok']??false)!==true)throw new RuntimeException('Post-release API verification failed');
        if($body['action']==='health'&&($data['database']??false)!==true)throw new RuntimeException('Database health failed');
        if($body['action']==='cart_quote'&&($data['total_kopeks']??null)!==14900)throw new RuntimeException('New store version not confirmed');
    }
}
function releaseRun(array $args): array {
    $manifest=json_decode((string)file_get_contents(__DIR__.'/release-manifest.json'),true,32,JSON_THROW_ON_ERROR);
    $home=realpath($args['home']??'');$site=realpath($args['site']??'');
    if(!$home||!$site||!is_dir($home.'/private')||!str_starts_with($site,$home.'/'))throw new RuntimeException('Verified home and site directories required');
    if(str_starts_with(realpath(__DIR__),$site.'/'))throw new RuntimeException('Release package must be OUTSIDE webroot');
    $lock=fopen($home.'/private/.numi-store-release.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))throw new RuntimeException('Another store release is running');
    $apply=isset($args['apply']);$offline=isset($args['offline-test'])&&getenv('NUMI_INSTALL_TEST')==='1';
    if($apply&&!$offline&&!isset($args['verify-origin']))throw new RuntimeException('--verify-origin is required for publication');
    $planned=[];$conflicts=[];
    foreach($manifest['files']as$i=>$item){
        $payload=__DIR__.'/payload/'.$item['payload'];if(releaseHash($payload)!==$item['sha256'])throw new RuntimeException('Package integrity failed');
        if(str_ends_with($item['target'],'.php'))token_get_all((string)file_get_contents($payload),TOKEN_PARSE);
        $target=releaseTarget($home,$site,$item);$actual=releaseHash($target);
        if($actual===$item['sha256'])continue;
        if($actual!==$item['base_sha256'])$conflicts[]=$item['scope'].'/'.$item['target'];
        $planned[]=['item'=>$item,'target'=>$target,'payload'=>$payload,'before'=>$actual,'mode'=>is_file($target)?(fileperms($target)&0777):null];
    }
    if($conflicts)throw new RuntimeException('CONFLICT — no files changed: '.implode(', ',$conflicts));
    if(!$apply)return ['ok'=>true,'mode'=>'check-only','files'=>count($planned),'writes'=>0];
    $backup=$home.'/private/numi-store-backup-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4));if(!mkdir($backup,0700,true))throw new RuntimeException('Backup directory failed');
    $rollback=[];$staged=[];
    try{
        // Every old byte is saved and checked BEFORE any destination is replaced.
        foreach($planned as$i=>$entry){
            if($entry['before']!==null){$saved=$backup.'/'.$i.'.bak';if(!copy($entry['target'],$saved)||releaseHash($saved)!==$entry['before'])throw new RuntimeException('Backup verification failed');chmod($saved,0600);}
            $dir=dirname($entry['target']);if(!is_dir($dir)&&!mkdir($dir,0755,true))throw new RuntimeException('Destination directory failed');
            $temp=$dir.'/.numi-'.bin2hex(random_bytes(8)).'-'.basename($entry['target']);
            if(!copy($entry['payload'],$temp)||releaseHash($temp)!==$entry['item']['sha256'])throw new RuntimeException('Staging failed');
            chmod($temp,$entry['item']['scope']==='private'?0600:0644);$staged[$i]=$temp;
        }
        file_put_contents($backup.'/rollback.json',json_encode($planned,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));chmod($backup.'/rollback.json',0600);
        foreach($planned as$i=>$entry){
            if(releaseHash($entry['target'])!==$entry['before'])throw new RuntimeException('Concurrent change; publication stopped');
            if(!rename($staged[$i],$entry['target']))throw new RuntimeException('Atomic replacement failed');$rollback[]=$i;
            if(releaseHash($entry['target'])!==$entry['item']['sha256'])throw new RuntimeException('Read-back verification failed');
        }
        if(!$offline)releaseHealth(rtrim($args['verify-origin'],'/'));
        return ['ok'=>true,'mode'=>$offline?'local-test':'published','files'=>count($planned),'backup'=>$backup];
    }catch(Throwable$e){
        $unrestored=[];
        foreach(array_reverse($rollback)as$i){$entry=$planned[$i];if(releaseHash($entry['target'])!==$entry['item']['sha256']){$unrestored[]=$entry['target'];continue;}
            if($entry['before']===null){if(!unlink($entry['target']))$unrestored[]=$entry['target'];}
            else{$temp=$entry['target'].'.rollback-'.bin2hex(random_bytes(4));if(!copy($backup.'/'.$i.'.bak',$temp))$unrestored[]=$entry['target'];else{chmod($temp,$entry['mode']??0644);if(!rename($temp,$entry['target']))$unrestored[]=$entry['target'];}}
        }
        throw new RuntimeException($e->getMessage().'; backup retained'.($unrestored?'; manual recovery required: '.implode(',',$unrestored):'; installed files rolled back'));
    }finally{foreach($staged as$temp)if(is_file($temp))unlink($temp);}
}
try{$args=getopt('',['home:','site:','apply','verify-origin:','offline-test']);echo json_encode(releaseRun($args),JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n";}
catch(Throwable$e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
