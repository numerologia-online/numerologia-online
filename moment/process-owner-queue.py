#!/usr/bin/env python3
"""Process ONLY owner preview queue for Moment 300 through Groq on GitHub Actions.

No paid requests, no Telegram, no Red Flag, no wallet. Sensitive dates and answers
stay on the private REG.RU hosting area; neither is logged in public Actions.
"""
import datetime
import ftplib
import io
import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.request


def log(message):
    print(message, flush=True)


def sha_safe(record):
    return isinstance(record, dict) and (
        isinstance(record.get("question_id"), str)
        and re.fullmatch(r"[a-z]+-\d{3}", record["question_id"]) is not None
        and isinstance(record.get("title"), str)
        and 5 <= len(record["title"]) <= 180
        and isinstance(record.get("birth_date"), str)
        and re.fullmatch(r"(19|20)\d\d-\d\d-\d\d", record["birth_date"]) is not None
    )


def energy(iso_date):
    _, month, day = map(int, iso_date.split("-"))
    while day > 22:
        day = sum(int(d) for d in str(day))
    return f"день {day}, месяц {month}"


SYSTEM = (
    "Ты профессиональный нумеролог. Пиши качественный, уверенный, конкретный "
    "и интересный разбор в редакционном стиле сайта «Нумерология онлайн». "
    "Отвечай непосредственно на выбранный вопрос, без вводных оправданий и "
    "предупреждений о методе. Учитывай сочетания чисел дня и месяца обоих "
    "людей, сильные и теневые проявления и возможные внутренние противоречия. "
    "Не идеализируй мужчину и не делай его злодеем без оснований. "
    "Не повторяй одинаковые психологические сюжеты между вопросами. "
    "Первый абзац даёт прямой содержательный ответ; второй помогает женщине "
    "разобраться в ситуации и даёт конкретные ориентиры. "
    "Пиши как умный практикующий нумеролог и подруга, без комплиментарности, "
    "без формул, названий энергий, штампов и рекламных предложений. "
    "Без дисклеймеров, самообесценивания и фраз вроде «нельзя узнать чувства». "
    "СТРОГО ЗАПРЕЩЁН символ длинного тире (U+2014); перестраивай предложение "
    "через точку, двоеточие или союз, но не ставь тире. "
    "Два самостоятельных абзаца, ориентир 110–180 слов. Только русский язык."
)


def generate(key, record):
    has_other = bool(record.get("other_date"))
    user = (
        f"Вопрос: {record['title']}\n"
        f"Вопрос ID: {record['question_id']}\n"
        f"РОЛЬ 1: {'женщина, которая спрашивает' if has_other else 'клиент, который спрашивает'}. "
        f"Дата: {energy(record['birth_date'])}."
    )
    if has_other:
        user += (
            f"\nРОЛЬ 2: мужчина, о котором спрашивает женщина. "
            f"Дата: {energy(record['other_date'])}. "
            "В ответе всегда обращайся к женщине, а чувства и действия разбирай у мужчины. "
            "Не меняй роли местами."
        )
    if record.get("moment"):
        user += f"\nМомент вопроса: {record['moment']} (локальное время)"
    payload = {
        "model": "openai/gpt-oss-120b",
        "temperature": 0.65,
        "max_completion_tokens": 1500,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
    }
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "numi-moment-groq-test/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=75) as res:
        if res.status != 200:
            raise RuntimeError("MODEL_HTTP_ERROR")
        response = json.load(res)
    answer = response.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not isinstance(answer, str) or len(answer.strip()) < 140 or len(answer) > 7000:
        raise RuntimeError("MODEL_OUTPUT_NOT_READY")
    # Final deterministic editorial safeguard: no long dash in client-facing text.
    answer = answer.strip().replace(" — ", ": ").replace("—", ":")
    if "—" in answer:
        raise RuntimeError("LONG_DASH_NOT_REMOVED")
    return answer


def read(ftp, path):
    stream = io.BytesIO()
    ftp.retrbinary("RETR " + path, stream.write)
    return stream.getvalue()


def put(ftp, path, data):
    ftp.storbinary("STOR " + path, io.BytesIO(data))
    if read(ftp, path) != data:
        raise RuntimeError("FTP_READBACK_FAILED")


def process():
    key = os.environ.get("GROQ_API_KEY", "")
    if not key.startswith("gsk_"):
        raise RuntimeError("GROQ_KEY_MISSING")
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=35)
    ftp.connect("server172.hosting.reg.ru", 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.set_pasv(True)
    root = ftp.pwd().rstrip("/") + "/private/numi-moment-groq/jobs"
    processed = 0
    try:
        ftp.cwd(root)
        files = [os.path.basename(p) for p in ftp.nlst()]
        pending = sorted(
            p for p in files if re.fullmatch(r"[0-9a-f]{32}\.pending\.json", p)
        )
        for name in pending[:3]:
            id_ = name[:32]
            pending_path = root + "/" + name
            working = root + "/" + id_ + ".working.json"
            result_path = root + "/" + id_ + ".result.json"
            # FTP rename is atomic on this hosting; a failed claim is retried later.
            try:
                ftp.rename(pending_path, working)
            except ftplib.all_errors:
                log("MOMENT_GROQ_QUEUE_CLAIM_SKIPPED")
                continue
            result = None
            try:
                record = json.loads(read(ftp, working))
                if not sha_safe(record):
                    raise RuntimeError("INVALID_QUEUE_RECORD")
                answer = generate(key, record)
                result = {"ok": True, "answer": answer, "model": "openai/gpt-oss-120b"}
            except urllib.error.HTTPError as e:
                log("MOMENT_GROQ_QUEUE_PROVIDER_STATUS_" + str(e.code))
                result = {"ok": False, "error": "MODEL_UNAVAILABLE"}
            except Exception as e:
                log("MOMENT_GROQ_QUEUE_FAILURE_" + type(e).__name__)
                result = {"ok": False, "error": "MODEL_UNAVAILABLE"}
            output = json.dumps(
                result, ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")
            temp_path = root + "/" + id_ + ".result.tmp"
            put(ftp, temp_path, output)
            ftp.rename(temp_path, result_path)
            ftp.delete(working)
            processed += 1
            log(
                "MOMENT_GROQ_OWNER_JOB_COMPLETE success="
                + str(result["ok"]).lower()
                + " answer_chars="
                + str(len(result.get("answer", "")))
            )
        log("MOMENT_GROQ_QUEUE_CYCLE_OK processed=" + str(processed))
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()


if __name__ == "__main__":
    try:
        process()
    except ftplib.error_perm as e:
        # Initialization may not have been deployed yet.
        if "550" in str(e):
            log("MOMENT_GROQ_OWNER_QUEUE_NOT_AVAILABLE")
            sys.exit(0)
        log("MOMENT_GROQ_QUEUE_FTP_ERROR")
        sys.exit(1)
    except Exception as e:
        log("MOMENT_GROQ_QUEUE_WORKER_ERROR_" + type(e).__name__)
        sys.exit(1)
