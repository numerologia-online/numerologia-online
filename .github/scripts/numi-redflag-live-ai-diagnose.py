#!/usr/bin/env python3
"""One-time authenticated, removable REG.RU -> Cloudflare AI probe.
No customer files, model instructions, payment state, or answer banks changed.
The PHP probe refuses requests without an ephemeral secret header.
Prints only diagnosis status, not model text, credentials, or private data.
"""
import ftplib
import io
import json
import os
import secrets
import ssl
import urllib.error
import urllib.request

url_root = "https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
otp = secrets.token_hex(32)
name = "redflag-ai-lab/redflag-diagnostic-" + secrets.token_hex(24) + ".php"
php = r'''<?php
declare(strict_types=1);
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
if (!hash_equals("__OTP__", (string)($_SERVER["HTTP_X_NUMI_DIAG"]??""))) {
    http_response_code(404);
    exit;
}
$report=["probe"=>"owner-redflag-ai-once","config"=>"unknown","curl"=>null,"upstream_status"=>null,
         "upstream_error"=>null,"answer_length"=>0,"style_version"=>null];
try {
    $conf=dirname(__DIR__,3)."/private/numi-moment-groq/config.local.php";
    if (!is_file($conf)) throw new RuntimeException("PRIVATE_CONFIG_MISSING");
    $data=require $conf;
    $key=is_array($data)?($data["groq_api_key"]??null):null;
    if (!is_string($key)||!str_starts_with($key,"gsk_")) throw new RuntimeException("PRIVATE_KEY_MISSING");
    $report["config"]="ok";
    $proof=hash_hmac("sha256","numi-moment-cloudflare-bridge-v1",$key);
    $payload=json_encode([
      "category"=>"flags","question_id"=>"hero",
      "title"=>"Скромный мужчина или считает себя подарком судьбы?",
      "day"=>9,"month"=>9,"followups"=>[]
    ],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    $ch=curl_init("https://numerologia-300-ai.tankraft431.workers.dev/v1/redflag-owner-question");
    if($ch===false)throw new RuntimeException("CURL_INIT_FAILED");
    curl_setopt_array($ch,[
      CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,
      CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>85,CURLOPT_MAXREDIRS=>0,
      CURLOPT_HTTPHEADER=>["Content-Type: application/json","Accept: application/json",
        "X-Numi-Moment-Proof: ".$proof,"User-Agent: NumiOwnerDiagnostic/1.0"],
      CURLOPT_POSTFIELDS=>$payload
    ]);
    $response=curl_exec($ch);
    $report["upstream_status"]=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
    $report["curl"]=curl_errno($ch);
    curl_close($ch);
    if(is_string($response)) {
      $body=json_decode($response,true);
      if (is_array($body)) {
        $report["upstream_error"]=preg_replace('/[^A-Z0-9_]/','',strval($body["error"]??""))?:null;
        $report["answer_length"]=is_string($body["answer"]??null)?mb_strlen($body["answer"]):0;
        $report["style_version"]=preg_replace('/[^a-zA-Z0-9_-]/','',strval($body["style_version"]??""))?:null;
        $report["draft_only"]=$body["draft_only"]??null;
      } else $report["non_json"]=true;
    }
} catch(Throwable $e) {
    $report["failure_reason"]=preg_replace('/[^A-Z_]/','',strval($e->getMessage()))?:get_class($e);
}
echo json_encode($report,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
'''.replace("__OTP__", otp)
ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=35)
ftp.connect("server172.hosting.reg.ru",21)
ftp.login(os.environ["REG_FTP_USER"],os.environ["REG_FTP_PASSWORD"])
ftp.prot_p()
ftp.set_pasv(True)
remote=ftp.pwd().rstrip("/")+"/www/xn--c1adkkdfjbp1a4l.online/"+name
try:
    # Never overwrite or modify a pre-existing file.
    try:
        ftp.size(remote)
        raise RuntimeError("TEMP_PROBE_ALREADY_EXISTS")
    except ftplib.error_perm as e:
        if not str(e).startswith("550"):raise
    ftp.storbinary("STOR "+remote,io.BytesIO(php.encode("utf-8")))
    for method in ("without_secret","with_secret"):
        headers={"User-Agent":"NumiOwnerDiagnostic/1.0","Cache-Control":"no-store"}
        if method=="with_secret":headers["X-Numi-Diag"]=otp
        req=urllib.request.Request(url_root+name,headers=headers)
        try:
            with urllib.request.urlopen(req,timeout=110) as response:
                code=response.status
                body=response.read(8000)
        except urllib.error.HTTPError as e:
            code=e.code
            body=e.read(8000)
        if method=="without_secret":
            print("REDFLAG_PROBE_GUEST_HTTP",code,flush=True)
            if code not in (403,404):raise RuntimeError("TEMP_PROBE_NOT_PROTECTED")
        else:
            try:
                payload=json.loads(body)
            except Exception:
                payload={"response_type":"not_json","response_size":len(body)}
            print("REDFLAG_REAL_REG_TO_AI_DIAGNOSIS",json.dumps({"probe_http":code,"result":payload},ensure_ascii=False),flush=True)
            if code!=200:raise RuntimeError("TEMP_PROBE_FAILED_HTTP_"+str(code))
finally:
    try:
        ftp.delete(remote)
        print("REDFLAG_TEMP_PROBE_REMOVED",flush=True)
    except ftplib.all_errors:
        print("REDFLAG_TEMP_PROBE_REMOVE_FAILED",flush=True)
        raise
    finally:
        try:ftp.quit()
        except Exception:ftp.close()
