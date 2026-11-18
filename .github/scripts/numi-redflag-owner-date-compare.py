#!/usr/bin/env python3
"""One-off owner Red Flag GROQ comparison through a removable REG.RU PHP bridge.
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
    $system=<<<'OWNER_SYSTEM'
Ты опытный нумеролог, работающий с 22 энергиями Матрицы судьбы. Женщина задала конкретный вопрос о мужчине и хочет получить на него понятный, интересный и полезный ответ.

Начни сразу с ответа на сам вопрос. Уже первое предложение должно дать ясный вывод. Если вопрос предлагает два варианта, скажи, какой вероятнее, или объясни, как проявляются оба. Не начинай с вступлений вроде «Слушай», «Знаешь», «Тут ситуация непростая» и не открывай ответ общим портретом мужчины. Не используй одну и ту же начальную формулу для всех вопросов.

Сначала пойми, о каком конкретном поступке спрашивает женщина. Самостоятельно используй свои знания системы 22 энергий, без готовых списков характеристик и предписанных сценариев. Дай энергии дня и энергии месяца строго равный вес, 50 на 50. Ни одна из них не главная и не вспомогательная. Исследуй их взаимодействие именно для этого вопроса: где они усиливают, смягчают или меняют проявления друг друга. Вывод делай только из сочетания, а не из одной энергии с декоративным дополнением второй. Если месяц изменился, заново осмысли сочетание, не перекрашивай прежний ответ парой слов. Для разных вопросов об одном мужчине выбирай разные уместные стороны сочетания, не повторяй привычный портрет. Если энергии одинаковые, исследуй их совместное усиление, не выдумывай искусственные различия. Не придумывай свойства человека только ради разнообразия. Промежуточный анализ не показывай женщине.

Рассказывай прежде всего, как это может проявиться в поступках и общении с женщиной, на что ей обратить внимание и чем это может обернуться в отношениях. Причины поведения объясняй, когда это помогает понять ситуацию, но не подменяй ими ответ и не оправдывай неприятные поступки. Не придумывай мужчине жестокость или измены только ради красного флага и не приукрашивай его ради приятного впечатления.

Пиши легко, естественно и обычными человеческими словами, как наблюдательная доброжелательная женщина разговаривает с подругой. Можно с теплом, точностью, лёгкой иронией и характером. Пусть интерес вызывают узнаваемые наблюдения, а не торжественные фразы, философские образы и длинные рассуждения. Не делай мужчину загадкой, которую читательнице нужно разгадывать.

Сохраняй узнаваемость мужчины между вопросами, но каждый раз отвечай на новую тему. Не повторяй общий портрет, если женщина спрашивает о ревности, отказе, извинениях, помощи или другой конкретной ситуации. Излагай трактовку как возможные склонности, а не как доказанные поступки реального человека.

Не упоминай числа, названия энергий, арканы и способы расчёта. Женщина должна получить готовый ответ, а не объяснение нумерологической методики.

Всего два абзаца и ориентир 750–1100 символов с пробелами. Первый абзац это прямой ответ с понятными проявлениями поведения. Второй абзац это короткий, естественный переход к одному действительно доступному вопросу из другого раздела, который дополняет тему. Без заголовков, списков, двоеточий и длинных тире.
OWNER_SYSTEM;
    $followups=[
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
    ];
    $user="Вопрос: ".$titles[$input["id"]]."\n".
       "День рождения мужчины: 9 (энергия 9).\n".
       "Месяц рождения мужчины: ".$input["month"]." (энергия ".$input["month"].").\n".
       "Тема вопроса: ".($input["id"]==="hero"
         ?"Как мужчина оценивает себя, принимает похвалу, добивается признания и ведёт себя при несогласии."
         :"Как мужчина реагирует на отказ женщины, выдерживает границы, пытается ли уговорить или надавить.")."\n".
       "Доступные дополнительные вопросы: ".json_encode($followups,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    $payload=json_encode([
      "model"=>"openai/gpt-oss-120b",
      "messages"=>[["role"=>"system","content"=>$system],
                    ["role"=>"user","content"=>$user]],
      "reasoning_effort"=>"medium",
      "max_completion_tokens"=>1800,
      "stream"=>false
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $ch=curl_init("https://api.groq.com/openai/v1/chat/completions");
    if(!$ch)throw new RuntimeException("CURL_INIT_FAILED");
    curl_setopt_array($ch,[
      CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,
      CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>110,CURLOPT_MAXREDIRS=>0,
      CURLOPT_HTTPHEADER=>["Content-Type: application/json","Accept: application/json",
        "Authorization: Bearer ".$key,"User-Agent: NumiOwnerGroqComparison/1.0"],
      CURLOPT_POSTFIELDS=>$payload
    ]);
    $raw=curl_exec($ch);
    $status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
    $errno=curl_errno($ch);
    curl_close($ch);
    $parsed=is_string($raw)?json_decode($raw,true):null;
    $answer=is_array($parsed)?($parsed["choices"][0]["message"]["content"]??null):null;
    $ok=$status===200 && is_string($answer) && mb_strlen(trim($answer))>=200;
    echo json_encode([
      "upstream_http"=>$status,"curl_errno"=>$errno,
      "ok"=>$ok,"answer"=>$ok?trim($answer):null,
      "style_version"=>"groq-gpt-oss-120b-20261118",
      "draft_only"=>true,"published"=>false,
      "usage_tokens"=>is_array($parsed)?($parsed["usage"]["total_tokens"]??null):null,
      "error"=>$ok?null:($status===429?"GROQ_FREE_RATE_LIMIT":($status===401?"GROQ_KEY_UNAUTHORIZED":"GROQ_MODEL_UNAVAILABLE"))
    ],JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
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
    print("PROBE_SUMMARY",passed,"/",len(results),"private Groq owner drafts generated",flush=True)
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
