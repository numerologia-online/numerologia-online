"""Release approved 00:00 readings for the first two yes/no questions."""
import ftplib
import io
import json
import os
import pathlib
import re
import ssl
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
PRIVATE_COMMIT = '556348e5176b97989afadb51533680b5693a1b48'
QUESTIONS = {
    'yn-man-001': 'Судьба ещё не определилась. Не торопи события и сохраняй светлые мысли. Всё может измениться.',
    'yn-man-002': 'Судьба ещё не определилась. Не позволяй сомнениям затмить надежду. Будущее открыто.',
}
SITE_URL = 'https://xn--c1adkkdfjbp1a4l.online'

f = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=40)
f.connect('server172.hosting.reg.ru', 21)
f.login(os.environ['REG_FTP_USER'], os.environ['REG_FTP_PASSWORD'])
f.prot_p()
home = f.pwd().rstrip('/')
site = home + '/www/xn--c1adkkdfjbp1a4l.online/'

def read(path):
    buffer = io.BytesIO()
    f.retrbinary('RETR ' + path, buffer.write)
    return buffer.getvalue()

def write(path, content):
    f.storbinary('STOR ' + path, io.BytesIO(content))
    if read(path) != content:
        raise RuntimeError('FTP readback failed for ' + path)

def api(question, clock):
    url = (SITE_URL + '/api/numi-yesno-answer.php?question=' + question
           + '&time=' + clock + '&verify=' + str(time.time_ns()))
    try:
        with urllib.request.urlopen(url, timeout=25) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)

try:
    config = read(home + '/private/numi-secure-access/config.local.php')
    token = re.search(rb'(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}', config)
    if not token:
        raise RuntimeError('Private GitHub access unavailable')
    destinations = {}
    for q, zero_text in QUESTIONS.items():
        url = ('https://api.github.com/repos/numerologia-online/numi-numi-on-private/'
               'contents/moment/yes-no/answers/man/' + q + '.json?ref=' + PRIVATE_COMMIT)
        request = urllib.request.Request(url, headers={
            'Authorization': 'Bearer ' + token[0].decode('ascii'),
            'Accept': 'application/vnd.github.raw+json',
            'User-Agent': 'numi-midnight-release',
        })
        with urllib.request.urlopen(request, timeout=30) as r:
            approved_bytes = r.read(20000)
        approved = json.loads(approved_bytes)
        if (approved.get('question_id') != q
                or approved.get('status') != 'approved'
                or approved.get('calculation_version') != 'time-digit-sum-v1'
                or set(approved['answers']) != set(map(str, range(10)))
                or approved['answers']['0'] != zero_text):
            raise RuntimeError('Unapproved content for ' + q)
        dest = home + '/private/numi-yesno-v1/answers/man/' + q + '.json'
        old = json.loads(read(dest))
        without_zero = dict(approved)
        without_zero['answers'] = {k: v for k, v in approved['answers'].items() if k != '0'}
        if old != without_zero and old != approved:
            raise RuntimeError('Unexpected live private text for ' + q)
        destinations[dest] = approved_bytes

    php_path = site + 'api/numi-yesno-answer.php'
    php = (ROOT.parent / 'public' / 'numi-yesno-answer.php').read_bytes()
    guard = b"if($sum===0)reply(422,['ok'=>false,'error'=>'ZERO_TIME_UNDEFINED']);\n"
    anchor = b"while($sum>9)$sum=array_sum(array_map('intval',str_split((string)$sum)));\n"
    if php.count(anchor) != 1 or guard in php:
        raise RuntimeError('Wrong approved PHP source')
    if read(php_path) not in (php, php.replace(anchor, guard + anchor)):
        raise RuntimeError('Live PHP differs: stop without overwriting')
    destinations[php_path] = php

    original = {path: read(path) for path in destinations}
    changed = [(path, data) for path, data in destinations.items() if original[path] != data]
    if changed:
        backup = (home + '/site-safeguard-backups/yesno-zero-'
                  + time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
                  + '-' + os.environ.get('GITHUB_RUN_ID', 'manual'))
        f.mkd(backup)
        for i, (path, _) in enumerate(changed):
            write(backup + '/' + str(i) + '.bak', original[path])
    touched = []
    try:
        for path, data in changed:
            touched.append(path)
            write(path, data)
            if '/private/numi-yesno-v1/' in path:
                f.sendcmd('SITE CHMOD 600 ' + path)
        for q in QUESTIONS:
            dest = home + '/private/numi-yesno-v1/answers/man/' + q + '.json'
            answers = json.loads(destinations[dest])['answers']
            for n in range(10):
                code, response = api(q, '00:' + str(n).zfill(2))
                if code != 200 or response.get('ok') is not True or response.get('answer') != answers[str(n)]:
                    raise RuntimeError('Live answer mismatch ' + q + ' / ' + str(n))
        if api('yn-man-003', '00:00')[0] != 404 or api('yn-man-001', '25:99')[0] != 400:
            raise RuntimeError('API safeguards failed')
        print('YESNO_MIDNIGHT_SUCCESS: 20 live answers and safeguards verified', flush=True)
    except BaseException:
        for path in reversed(touched):
            write(path, original[path])
            if '/private/numi-yesno-v1/' in path:
                f.sendcmd('SITE CHMOD 600 ' + path)
        raise
finally:
    f.quit()
