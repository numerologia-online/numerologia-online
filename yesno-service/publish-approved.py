"""Copy only approved yes/no JSON answers to REG.RU and verify them.

One reusable publisher: no question-specific deploy scripts or public answer texts.
Runs only after an explicit publication trigger in the public repository.
"""
import ftplib
import io
import json
import os
import pathlib
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = pathlib.Path(__file__).resolve().parents[1]
WEB = "https://xn--c1adkkdfjbp1a4l.online"
REPO = "numerologia-online/numi-numi-on-private"
CATEGORIES = {"man", "love", "work", "money", "choice", "future", "home"}

def github_get(path, token, raw=False):
    url = "https://api.github.com/repos/" + REPO + "/contents/" + path + "?ref=main"
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github.raw+json" if raw else "application/vnd.github+json",
        "User-Agent": "numi-approved-yesno-publisher",
    })
    with urllib.request.urlopen(req, timeout=35) as r:
        return r.read()

def live_answer(question, clock):
    url = WEB + "/api/numi-yesno-answer.php?" + urllib.parse.urlencode({
        "question": question, "time": clock, "verify": str(time.time_ns())
    })
    try:
        with urllib.request.urlopen(url, timeout=25) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)

def as_json(blob):
    return json.loads(blob.decode("utf-8-sig"))

def main():
    f = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=40)
    f.connect("server172.hosting.reg.ru", 21)
    f.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    f.prot_p()
    home = f.pwd().rstrip("/")
    site = home + "/www/xn--c1adkkdfjbp1a4l.online/"
    private = home + "/private/numi-yesno-v1/answers/"

    def read(path, allow_missing=False):
        buff = io.BytesIO()
        try:
            f.retrbinary("RETR " + path, buff.write)
        except ftplib.error_perm as exc:
            if allow_missing and str(exc).startswith("550"):
                return None
            raise
        return buff.getvalue()

    def put(path, data):
        f.storbinary("STOR " + path, io.BytesIO(data))
        if read(path) != data:
            raise RuntimeError("FTP readback mismatch: " + path)

    try:
        config = read(home + "/private/numi-secure-access/config.local.php")
        secret = re.search(rb"(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}", config)
        if not secret:
            raise RuntimeError("Private source access unavailable")
        token = secret.group().decode("ascii")

        public_catalogue = as_json((BASE / "moment/yes-no/questions.json").read_bytes())
        allowed = {q["id"]: q["category"] for q in public_catalogue["questions"]}
        incoming = {}
        top = as_json(github_get("moment/yes-no/answers", token))
        folders = [a["name"] for a in top if a.get("type") == "dir" and a.get("name") in CATEGORIES]
        for category in folders:
            items = as_json(github_get("moment/yes-no/answers/" + category, token))
            for item in items:
                name = item.get("name", "")
                if item.get("type") != "file" or not re.fullmatch(r"yn-" + category + r"-[0-9]{3}\.json", name):
                    continue
                q = name.removesuffix(".json")
                if allowed.get(q) != category:
                    continue
                blob = github_get("moment/yes-no/answers/" + category + "/" + name, token, raw=True)
                data = as_json(blob)
                if data.get("status") != "approved":
                    continue
                if (data.get("question_id") != q
                        or data.get("calculation_version") != "time-digit-sum-v1"
                        or not isinstance(data.get("answers"), dict)
                        or set(data["answers"]) != set(map(str, range(10)))
                        or not all(isinstance(x, str) and x for x in data["answers"].values())):
                    raise RuntimeError("Invalid approved answers: " + q)
                incoming[private + category + "/" + name] = blob
        if not incoming:
            raise RuntimeError("No approved answer files found")

        php = (BASE / "yesno-service/public/numi-yesno-answer.php").read_bytes()
        js = (BASE / "moment/yes-no/yes-no.js").read_bytes()
        html = (BASE / "moment/yes-no/index.html").read_bytes()

        # Reconstruct exactly the old accepted versions for guarded first release.
        new_guard = (b"// Only IDs matching the public question catalogue format; no arbitrary file paths.\n"
                     b"if(!is_string($q)||!preg_match('/^yn-(man|love|work|money|choice|future|home)-[0-9]{3}$/D',$q,$parts))reply(404,['ok'=>false,'error'=>'ANSWER_NOT_READY']);\n"
                     b"$category=$parts[1];\n")
        old_guard = (b"// Explicit approved trial question allowlist. No arbitrary file paths.\n"
                     b"if(!in_array($q,['yn-man-001','yn-man-002'],true))reply(404,['ok'=>false,'error'=>'ANSWER_NOT_READY']);\n")
        new_path = (b"$path=$root.'/answers/'.$category.'/'.$q.'.json';\n"
                    b"if(!is_file($path))reply(404,['ok'=>false,'error'=>'ANSWER_NOT_READY']);\n"
                    b"$data=json_decode((string)@file_get_contents($path),true);\n")
        old_path = b"$data=json_decode((string)@file_get_contents($root.'/answers/man/'.$q.'.json'),true);\n"
        if php.count(new_guard) != 1 or php.count(new_path) != 1:
            raise RuntimeError("Unexpected PHP publisher version")
        old_php = php.replace(new_guard, old_guard).replace(new_path, old_path)
        reduction = b"while($sum>9)$sum=array_sum(array_map('intval',str_split((string)$sum)));\n"
        zero_guard = b"if($sum===0)reply(422,['ok'=>false,'error'=>'ZERO_TIME_UNDEFINED']);\n"
        if old_php.count(reduction) != 1:
            raise RuntimeError("Unexpected time calculation")
        old_php_with_zero_rejection = old_php.replace(reduction, zero_guard + reduction)

        new_selection = b"if (!selectedQuestion) {"
        old_selection = b'if (!selectedQuestion || !["yn-man-001", "yn-man-002"].includes(selectedQuestion.id)) {'
        new_error = b'if (data.error === "ANSWER_NOT_READY") {timeResult.textContent = "\xd0\x9e\xd1\x82\xd0\xb2\xd0\xb5\xd1\x82 \xd0\xbd\xd0\xb0 \xd1\x8d\xd1\x82\xd0\xbe\xd1\x82 \xd0\xb2\xd0\xbe\xd0\xbf\xd1\x80\xd0\xbe\xd1\x81 \xd0\xb5\xd1\x89\xd1\x91 \xd0\xb3\xd0\xbe\xd1\x82\xd0\xbe\xd0\xb2\xd0\xb8\xd1\x82\xd1\x81\xd1\x8f.";return;}'
        old_error = 'if (data.error === "ZERO_TIME_UNDEFINED") {timeResult.textContent = "Для времени 00.00 правило ответа ещё не утверждено.";return;}'.encode("utf-8")
        if js.count(new_selection) != 1 or js.count(new_error) != 1:
            raise RuntimeError("Unexpected public JS release version")
        old_js = js.replace(new_selection, old_selection).replace(new_error, old_error)
        if js.count(b'./questions.json?v=3') != 1:
            raise RuntimeError("Unexpected question catalogue version")
        previous_js = js.replace(b'./questions.json?v=3', b'./questions.json?v=2')
        previous_old_js = old_js.replace(b'./questions.json?v=3', b'./questions.json?v=2')
        if html.count(b'./yes-no.js?v=13') != 1:
            raise RuntimeError("Unexpected public HTML release version")
        old_html = html.replace(b'./yes-no.js?v=13', b'./yes-no.js?v=12')
        legacy_html = html.replace(b'./yes-no.js?v=13', b'./yes-no.js?v=11')

        code_paths = {
            site + "api/numi-yesno-answer.php": (php, {php, old_php, old_php + b"\n", old_php_with_zero_rejection, old_php_with_zero_rejection + b"\n"}),
            site + "moment/yes-no/yes-no.js": (js, {js, previous_js, old_js, previous_old_js}),
            site + "moment/yes-no/index.html": (html, {html, old_html, legacy_html}),
        }

        # Publish the public question catalogue with a narrow allowlist for title corrections.
        # Refuse to overwrite any independent live catalogue changes.
        catalogue_path = site + "moment/yes-no/questions.json"
        catalogue_blob = (BASE / "moment/yes-no/questions.json").read_bytes()
        expected_catalogue = as_json(catalogue_blob)
        live_catalogue_blob = read(catalogue_path)
        live_catalogue = as_json(live_catalogue_blob)
        if not isinstance(live_catalogue, dict) or not isinstance(live_catalogue.get("questions"), list):
            raise RuntimeError("Invalid live question catalogue")
        normalized = json.loads(json.dumps(live_catalogue, ensure_ascii=False))
        known_title_changes = {
            "yn-man-019": {
                "Стоит ли мне писать ему первой?",
                "Ответит ли он, если я напишу первой?",
            },
            "yn-love-007": {
                "Сможем ли мы преодолеть нынешние разногласия?",
                "Найдём ли мы общий язык?",
            },
        }
        title_by_id = {q["id"]: q["title"] for q in expected_catalogue["questions"]}
        for question in normalized["questions"]:
            if not isinstance(question, dict) or not isinstance(question.get("id"), str):
                raise RuntimeError("Invalid live catalogue question")
            qid = question["id"]
            if qid in known_title_changes:
                if question.get("title") not in known_title_changes[qid]:
                    raise RuntimeError("Unexpected live question title: " + qid)
                question["title"] = title_by_id[qid]
        if normalized != expected_catalogue:
            raise RuntimeError("Live catalogue changed independently; refusing overwrite")
        code_paths[catalogue_path] = (catalogue_blob, {catalogue_blob, live_catalogue_blob})

        for path, (new, allowed_live) in code_paths.items():
            if read(path) not in allowed_live:
                raise RuntimeError("Live site changed independently; refusing overwrite: " + path)

        desired = dict(incoming)
        desired.update({path: data for path, (data, _) in code_paths.items()})
        existing = {path: read(path, allow_missing=path in incoming) for path in desired}
        modified = [(path, data) for path, data in desired.items() if existing[path] != data]
        if modified:
            backup = (home + "/site-safeguard-backups/yesno-approved-"
                      + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
                      + "-" + os.environ.get("GITHUB_RUN_ID", "manual")
                      + "-" + os.environ.get("GITHUB_RUN_ATTEMPT", "1"))
            f.mkd(backup)
            for n, (path, _) in enumerate(modified):
                if existing[path] is not None:
                    put(backup + "/" + str(n) + ".bak", existing[path])

        touched = []
        try:
            for path, blob in modified:
                if path.startswith(private):
                    folder = path.rsplit("/", 1)[0]
                    try:
                        f.mkd(folder)
                    except ftplib.error_perm as e:
                        if not str(e).startswith("550"):
                            raise
                touched.append(path)
                put(path, blob)
                if path.startswith(private):
                    f.sendcmd("SITE CHMOD 600 " + path)
            # Verify all ten numerological numbers for each changed approved question.
            for path in incoming:
                if existing[path] == incoming[path]:
                    continue
                data = as_json(incoming[path])
                for n in range(10):
                    code, result = live_answer(data["question_id"], "00:" + str(n).zfill(2))
                    if code != 200 or result.get("answer") != data["answers"][str(n)]:
                        raise RuntimeError("Incorrect live answer: " + data["question_id"] + "/" + str(n))
            if as_json(read(catalogue_path)) != expected_catalogue:
                raise RuntimeError("Published catalogue does not match approved catalogue")
            catalogue_url = WEB + "/moment/yes-no/questions.json?verify=" + str(time.time_ns())
            with urllib.request.urlopen(catalogue_url, timeout=25) as response:
                live_web_catalogue = json.load(response)
            if live_web_catalogue != expected_catalogue:
                raise RuntimeError("Public website catalogue was not updated")
            if live_answer("yn-man-099", "00:00")[0] != 404:
                raise RuntimeError("Unknown answer not rejected")
            if live_answer("yn-man-001", "25:99")[0] != 400:
                raise RuntimeError("Invalid time accepted")
            print("APPROVED_YESNO_PUBLISH_SUCCESS",
                  "approved_questions=", len(incoming),
                  "changed_files=", len(modified),
                  flush=True)
        except BaseException:
            for path in reversed(touched):
                if existing[path] is None:
                    f.delete(path)
                else:
                    put(path, existing[path])
                    if path.startswith(private):
                        f.sendcmd("SITE CHMOD 600 " + path)
            raise
    finally:
        f.quit()

if __name__ == "__main__":
    main()
