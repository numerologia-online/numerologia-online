#!/usr/bin/env python3
"""One-off owner Red Flag date comparison through a removable REG.RU PHP bridge.
No customer files, paid answers, live purchases or secret material written to logs.
"""
import concurrent.futures
import ftplib
import io
import json
import os
import pathlib
import secrets
import ssl
import urllib.error
import urllib.request

ROOT = "https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/"
OTP = secrets.token_hex(32)
NAME = "redflag-ai-lab/redflag-private-date-probe-" + secrets.token_hex(24) + ".php"
PHP = r'''<?php
declare(strict_types=1);
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: private, no-store");
if (!hash_equals("__OTP__", (string)($_SERVER["HTTP_X_NUMI_DIAG"]??""))) {
    http_response_code(404); exit;
}
try {
    if(($_SERVER["REQUEST_METHOD"]??"")!=="POST") {http_response_code(405);exit;}
    $input=json_decode((string)file_get_contents("php://input"),true,8,JSON_THROW_ON_ERROR);
    if(!is_array($input)||($input["day"]??null)!==9
       ||!in_array(($input["month"]??null),[1,3,9,10],true)
       ||!in_array(($input["id"]??null),["hero","say-no"],true))
       throw new RuntimeException("INVALID_FIXTURE");
    $titles=[
      "hero"=>"Скромный мужчина или считает себя подарком судьбы?",
      "say-no"=>"Уважает женское «нет» или начинает давить?"
    ];
    $conf=dirname(__DIR__,3)."/private/numi-moment-groq/config.local.php";
    if(!is_file($conf))throw new RuntimeException("PRIVATE_CONFIG_MISSING");
    $data=require $conf;
    $key=is_array($data)?($data["groq_api_key"]??null):null;
    if(!is_string($key)||!str_starts_with($key,"gsk_"))throw new RuntimeException("PRIVATE_KEY_MISSING");
    $proof=hash_hmac("sha256","numi-moment-cloudflare-bridge-v1",$key);
    $payload=json_encode([
      "category"=>"flags","question_id"=>$input["id"],
      "title"=>$titles[$input["id"]],
      "day"=>9,"month"=>$input["month"],
      "followups"=>[
        "Держит слово или опять одни красивые разговоры?",
        "Будет опорой для семьи или всё снова окажется на твоих плечах?",
        "Щедрый мужчина или считает каждую копейку?",
        "Пишет первым или ждёт инициативы от женщины?",
        "Верный или у него каждая вторая «просто подруга»?",
        "На каком языке любви он вообще понимает чувства?",
        "Самостоятельный мужчина или мамина корзиночка?",
        "Какой финальный вердикт по этому мужчине без розовых очков?",
        "Будет ли мужчина жить за твой счёт?",
        "Сексуальный огонь или пять минут — и спасибо?"
      ]
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $ch=curl_init("https://numerologia-redflag-draft-ai.tankraft431.workers.dev/v1/redflag-owner-question");
    if(!$ch)throw new RuntimeException("CURL_INIT_FAILED");
    curl_setopt_array($ch,[
      CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,
      CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>95,CURLOPT_MAXREDIRS=>0,
      CURLOPT_HTTPHEADER=>["Content-Type: application/json","Accept: application/json",
        "X-Numi-Moment-Proof: ".$proof,"User-Agent: NumiOwnerDateComparison/1.0"],
      CURLOPT_POSTFIELDS=>$payload
    ]);
    $text=curl_exec($ch);
    $status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
    $errno=curl_errno($ch);
    curl_close($ch);
    $parsed=is_string($text)?json_decode($text,true):null;
    echo json_encode(["upstream_http"=>$status,"curl_errno"=>$errno,
      "ok"=>$parsed["ok"]??false,"answer"=>$parsed["answer"]??null,
      "style_version"=>$parsed["style_version"]??null,
      "draft_only"=>$parsed["draft_only"]??null,
      "published"=>$parsed["published"]??null,
      "error"=>$parsed["error"]??null],JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
} catch(Throwable $e) {
    echo json_encode(["ok"=>false,"error"=>preg_replace("/[^A-Z_]/","",strtoupper($e->getMessage()))]);
}
'''.replace("__OTP__", OTP)

ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=40)
ftp.connect("server172.hosting.reg.ru", 21)
ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
ftp.prot_p()
ftp.set_pasv(True)
remote = ftp.pwd().rstrip("/") + "/www/xn--c1adkkdfjbp1a4l.online/" + NAME

def invoke(data=None, *, authenticated=True):
    headers = {"Cache-Control":"no-store", "User-Agent":"NumiOwnerDateComparison/1.0"}
    if authenticated:
        headers["X-Numi-Diag"] = OTP
    body = None if data is None else json.dumps(data).encode("utf-8")
    if body:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(ROOT + NAME, data=body, headers=headers,
                                 method="POST" if body else "GET")
    try:
        with urllib.request.urlopen(req,timeout=120) as response:
            return response.status, json.loads(response.read(15000))
    except urllib.error.HTTPError as exc:
        return exc.code, {"error":"HTTP_"+str(exc.code)}

try:
    try:
        ftp.size(remote)
        raise RuntimeError("REFUSE_TO_OVERWRITE_EXISTING_PROBE")
    except ftplib.error_perm as exc:
        if not str(exc).startswith("550"):
            raise
    ftp.storbinary("STOR "+remote, io.BytesIO(PHP.encode("utf-8")))
    req = urllib.request.Request(ROOT+NAME,method="GET",headers={"Cache-Control":"no-store"})
    try:
        with urllib.request.urlopen(req,timeout=30) as response:
            guest = response.status
    except urllib.error.HTTPError as exc:
        guest = exc.code
    print("PROBE_GUEST_HTTP",guest,flush=True)
    if guest not in (403,404):
        raise RuntimeError("PROBE_ACCESS_GUARD_FAILED")
    pairs = [{"day":9,"month":month,"id":qid}
             for month in [1,3,9,10] for qid in ["hero","say-no"]]
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        tasks = {executor.submit(invoke,pair):pair for pair in pairs}
        for future in concurrent.futures.as_completed(tasks):
            pair = tasks[future]
            try:
                status,payload = future.result()
            except Exception as exc:
                status,payload=0,{"error":type(exc).__name__}
            entry = {"date":"09."+str(pair["month"]).zfill(2),
                     "question":pair["id"],"proxy_http":status}
            entry.update(payload)
            results.append(entry)
            print("PROBE_RESULT",entry["date"],entry["question"],"http",status,
                  "upstream",entry.get("upstream_http"),
                  "answer_chars",len(entry.get("answer") or ""),
                  "version",entry.get("style_version"),
                  "error",entry.get("error"),flush=True)
    results.sort(key=lambda x:(x["date"],x["question"]))
    output=pathlib.Path("redflag-probe-output")
    output.mkdir(exist_ok=True)
    (output/"owner-date-comparison.json").write_text(
        json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
    passed=sum(r.get("ok") is True and r.get("draft_only") is True and
               r.get("published") is False and isinstance(r.get("answer"),str)
               for r in results)
    print("PROBE_SUMMARY",passed,"/",len(results),"private owner drafts generated",flush=True)
    if passed==0:
        raise RuntimeError("NO_OWNER_MODEL_ANSWERS")
finally:
    try:
        ftp.delete(remote)
        print("PROBE_TEMP_PHP_REMOVED",flush=True)
    except ftplib.all_errors:
        print("PROBE_TEMP_PHP_REMOVAL_FAILED",flush=True)
        raise
    finally:
        try: ftp.quit()
        except ftplib.all_errors: ftp.close()
