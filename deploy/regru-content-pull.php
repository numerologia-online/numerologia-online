<?php
declare(strict_types=1);
/**
 * REG.RU content-only pull from the public GitHub repository.
 * INSTALL ONLY OUTSIDE THE WEBROOT and run by a trusted CLI cron task.
 * Nothing runs when this file is merely present in GitHub.
 *
 * Configuration (CLI environment):
 *   NUMI_CONTENT_SITE_ROOT = absolute path of the VERIFIED active document root
 *   NUMI_CONTENT_STATE_DIR = absolute path of PRIVATE writable state directory
 *   NUMI_CONTENT_DRY_RUN   = 1 for the first run
 *
 * Never give this script access to credentials or use it from a public URL.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors', '0');
const NUMI_REPO = 'numerologia-online/numerologia-online';
const NUMI_MAX_FILE_BYTES = 700000;
const NUMI_MAX_FILES = 300;

function contentExit(string $message, int $code=1): never {
    fwrite($code ? STDERR : STDOUT, $message."\n");
    exit($code);
}
function contentHttp(string $url): string {
    if (!extension_loaded('curl')) throw new RuntimeException('CURL_REQUIRED');
    $host=parse_url($url,PHP_URL_HOST);
    if (!in_array($host,['api.github.com','raw.githubusercontent.com'],true)
        || parse_url($url,PHP_URL_SCHEME)!=='https') throw new RuntimeException('UNTRUSTED_URL');
    $curl=curl_init($url);
    curl_setopt_array($curl,[
        CURLOPT_RETURNTRANSFER=>true, CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_CONNECTTIMEOUT=>6, CURLOPT_TIMEOUT=>25,
        CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_SSL_VERIFYHOST=>2,
        CURLOPT_USERAGENT=>'NumiContentPull/1.0',
        CURLOPT_HTTPHEADER=>['Accept: application/vnd.github+json','X-GitHub-Api-Version: 2022-11-28'],
        CURLOPT_MAXREDIRS=>0,
    ]);
    $body=curl_exec($curl);
    $code=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);
    curl_close($curl);
    if(!is_string($body)||$code!==200||strlen($body)>4000000)throw new RuntimeException('FETCH_FAILED_'.$code);
    return $body;
}
function contentJson(string $url): array {
    $decoded=json_decode(contentHttp($url),true,128,JSON_THROW_ON_ERROR);
    if(!is_array($decoded)) throw new RuntimeException('INVALID_GITHUB_RESPONSE');
    return $decoded;
}
function contentAllowed(string $path): bool {
    return preg_match('~^guide/(?:index\.html|(?:[a-z0-9-]{1,90}/index\.html)|(?:guide|journal)\.css)$~D',$path)===1;
}
function contentSafeFile(string $root,string $relative): string {
    $parts=explode('/',$relative);
    $p=$root;
    foreach($parts as $i=>$part) {
        if($part===''||$part==='.'||$part==='..') throw new RuntimeException('INVALID_PATH');
        $p.='/'.$part;
        if(is_link($p))throw new RuntimeException('SYMLINK_REJECTED_'.$relative);
        if($i<count($parts)-1 && file_exists($p) && !is_dir($p))
            throw new RuntimeException('NON_DIRECTORY_'.$relative);
    }
    return $p;
}
function contentSync(): void {
    $root=getenv('NUMI_CONTENT_SITE_ROOT') ?: '';
    $stateDir=getenv('NUMI_CONTENT_STATE_DIR') ?: '';
    if($root===''||$stateDir==='')contentExit('NOT_CONFIGURED');
    $root=realpath($root) ?: '';
    $stateDir=realpath($stateDir) ?: '';
    if($root===''||$stateDir===''||$root==='/'||$stateDir==='/'||
        $root===$stateDir||str_starts_with($stateDir,$root.'/')||
        str_starts_with($root,$stateDir.'/'))contentExit('UNSAFE_DIRECTORIES');
    if(!is_dir($root.'/guide')||!is_writable($root.'/guide')||!is_writable($stateDir))contentExit('UNWRITABLE_GUIDE_OR_STATE');
    $lock=fopen($stateDir.'/content-sync.lock','c');
    if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))contentExit('LOCKED');
    try {
        $statePath=$stateDir.'/content-sync-state.json';
        $state=[];
        if(is_file($statePath)){
            $raw=file_get_contents($statePath);
            $state=json_decode((string)$raw,true,128,JSON_THROW_ON_ERROR);
            if(!is_array($state))throw new RuntimeException('INVALID_STATE');
        }
        // Pin one immutable commit for an entire run. No branch races.
        $head=contentJson('https://api.github.com/repos/'.NUMI_REPO.'/commits/main');
        $sha=$head['sha']??'';
        if(!is_string($sha)||preg_match('/^[a-f0-9]{40}$/D',$sha)!==1)throw new RuntimeException('BAD_COMMIT');
        $tree=contentJson('https://api.github.com/repos/'.NUMI_REPO.'/git/trees/'.$sha.'?recursive=1');
        if(($tree['truncated']??true)!==false||!is_array($tree['tree']??null))
            throw new RuntimeException('INCOMPLETE_TREE');
        $files=[];
        foreach($tree['tree'] as $item){
            if(($item['type']??'')!=='blob'||!is_string($item['path']??null))continue;
            if(!contentAllowed($item['path']))continue;
            if(!is_int($item['size']??null)||$item['size']>NUMI_MAX_FILE_BYTES)throw new RuntimeException('FILE_TOO_LARGE');
            $files[$item['path']]=$item;
        }
        if(!$files||count($files)>NUMI_MAX_FILES)throw new RuntimeException('INVALID_FILE_COUNT');
        ksort($files);
        $dry=getenv('NUMI_CONTENT_DRY_RUN')==='1';
        $changed=0;$unchanged=0;$conflicts=[];
        foreach($files as $relative=>$item){
            $file=contentSafeFile($root,$relative);
            $existing=is_file($file)?file_get_contents($file):null;
            if($existing===false)throw new RuntimeException('READ_FAILED_'.$relative);
            $existingHash=$existing===null?null:hash('sha256',$existing);
            $tracked=$state[$relative]??null;
            // Never silently overwrite an unexplained live-server edit.
            if($tracked!==null && $existingHash!==$tracked){
                $conflicts[]=$relative;continue;
            }
            $url='https://raw.githubusercontent.com/'.NUMI_REPO.'/'.$sha.'/'.$relative;
            $incoming=contentHttp($url);
            if(strlen($incoming)>NUMI_MAX_FILE_BYTES
                || sha1('blob '.strlen($incoming)."\0".$incoming)!==($item['sha']??''))
                throw new RuntimeException('CONTENT_HASH_MISMATCH_'.$relative);
            $incomingHash=hash('sha256',$incoming);
            if($existingHash===$incomingHash){
                $state[$relative]=$incomingHash;$unchanged++;continue;
            }
            // On first adoption, only create files that do not exist.
            // Existing divergent pages require a one-time explicit review.
            if($tracked===null&&$existing!==null){$conflicts[]=$relative;continue;}
            if($dry){$changed++;continue;}
            $dir=dirname($file);
            if(!is_dir($dir)&&!mkdir($dir,0755,true)&&!is_dir($dir))
                throw new RuntimeException('MKDIR_FAILED');
            $tmp=tempnam($dir,'.numi-content-');
            if($tmp===false)throw new RuntimeException('TEMP_FILE_FAILED');
            try{
                if(file_put_contents($tmp,$incoming,LOCK_EX)!==strlen($incoming)
                    || !rename($tmp,$file))throw new RuntimeException('WRITE_FAILED');
            }finally{if(is_file($tmp))unlink($tmp);}
            $state[$relative]=$incomingHash;$changed++;
        }
        if(!$dry){
            $tmp=tempnam($stateDir,'.numi-sync-state-');
            if($tmp===false)throw new RuntimeException('STATE_TEMP_FAILED');
            try{
                $json=json_encode($state,JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);
                if(file_put_contents($tmp,$json,LOCK_EX)===false||!rename($tmp,$statePath))
                    throw new RuntimeException('STATE_WRITE_FAILED');
            }finally{if(is_file($tmp))unlink($tmp);}
        }
        echo json_encode(['dry_run'=>$dry,'commit'=>$sha,'would_change_or_changed'=>$changed,
            'unchanged'=>$unchanged,'conflicts'=>$conflicts],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\n";
        // Conflicts are reported, never overwritten or resolved automatically.
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
try{contentSync();}catch(Throwable $e){contentExit('CONTENT_SYNC_ERROR: '.$e->getMessage());}
