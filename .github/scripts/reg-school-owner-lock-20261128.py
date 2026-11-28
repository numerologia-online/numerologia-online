"""Publish the school closure and apply school-only changes to live billing."""
import concurrent.futures
import ftplib
import io
import json
import os
from pathlib import Path
import ssl
import subprocess
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

PUBLIC = 'https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/'
SOURCES = {
    'private/numi-school-owner-20261103/gate.php': 'server/school-access/private/gate.php',
    'private/numi-school-owner-20261103/offer.html': 'server/school-access/private/offer.html',
    'www/xn--c1adkkdfjbp1a4l.online/assets/numi-school-access-20261103.js': 'assets/numi-school-access-20261103.js',
    'www/xn--c1adkkdfjbp1a4l.online/pro/schools/index.html': 'pro/schools/index.html',
}
BILLING = {
    'store.php': [
        ("$quote['sale_ready']=$published && $quote['product_code']!=='moment_question'",
         "$quote['sale_ready']=$published && $quote['product_code']!=='moment_question' && $quote['product_code']!=='school_week'"),
    ],
    'subscriptions.php': [
        ("$code=$preference['product_code'];if(!naSubscriptionCode($code)",
         "$code=$preference['product_code'];if($code==='school_week'||!naSubscriptionCode($code)"),
        ("    if(!naLiveRecurringAllowed($config))return null;\n    $item=naLiveSubscriptionItem($code);",
         "    if($code==='school_week'||!naLiveRecurringAllowed($config))return null;\n    $item=naLiveSubscriptionItem($code);"),
        ("    $item=naLiveSubscriptionItem($code);\n    $email=naRealWalletReceiptEmail($email);",
         "    if($code==='school_week')throw new RuntimeException('SUBSCRIPTION_PRODUCT_UNAVAILABLE');\n    $item=naLiveSubscriptionItem($code);\n    $email=naRealWalletReceiptEmail($email);"),
        ("        $code=$checkout['product_code'];\n        if($checkout['order_status']!=='pending')",
         "        $code=$checkout['product_code'];\n        if($code==='school_week')throw new RuntimeException('SUBSCRIPTION_PRODUCT_UNAVAILABLE');\n        if($checkout['order_status']!=='pending')"),
        ("AND e.product_code IN ('club_month','school_week')\n            GROUP BY",
         "AND e.product_code='club_month'\n            GROUP BY"),
    ],
}

def http(path, payload=None):
    headers = {'Cache-Control': 'no-cache'}
    if payload is not None:
        headers['Content-Type'] = 'application/json'
    request = Request(PUBLIC + path, data=None if payload is None else json.dumps(payload).encode(), headers=headers)
    try:
        response = urlopen(request, timeout=25)
    except HTTPError as error:
        response = error
    with response:
        return response.status, response.read()

def verify():
    catalog = http('pro/schools/?school_release=20261128')
    assert catalog[0] == 200 and catalog[1].count('>В разработке<'.encode()) == 9
    assert 'Только по подписке'.encode() not in catalog[1]
    routes = ('pro/school/lesson/?id=start', 'pro/schools/classic/lesson/?id=hello', 'pro/schools/angel/')
    with concurrent.futures.ThreadPoolExecutor() as executor:
        for status, body in executor.map(http, routes):
            assert status == 200 and '<h1 id="school-subscription-title">В разработке</h1>'.encode() in body
    status, data = http('api/numi-school.php', {'action': 'session'})
    session = json.loads(data)
    assert status == 200 and session['owner'] is False and session['access'] is False
    assert http('api/numi-school.php', {'action': 'content', 'path': 'pro/school/lessons/start.json'})[0] == 403
    assert http('pro/school/lessons/start.json')[0] in (403, 404)
    print('Verified production catalog, direct lesson pages, static lesson data, and anonymous API responses.')

def main():
    with ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30) as ftp:
        ftp.connect('server172.hosting.reg.ru', 21)
        ftp.login(os.environ['REG_FTP_USER'], os.environ['REG_FTP_PASSWORD'])
        ftp.prot_p()
        home = ftp.pwd().rstrip('/')
        stamp = str(time.time_ns())
        backup = f'{home}/site-safeguard-backups/school-lock-{stamp}'

        def read(path):
            result = io.BytesIO()
            ftp.retrbinary('RETR ' + path, result.write)
            return result.getvalue()

        def upload(path, data):
            ftp.storbinary('STOR ' + path, io.BytesIO(data))
            if read(path) != data:
                raise RuntimeError('Upload byte verification failed.')

        updates = {path: Path(source).read_bytes() for path, source in SOURCES.items()}
        for filename, replacements in BILLING.items():
            path = 'private/numi-account-20261031/' + filename
            data = read(home + '/' + path).decode()
            for before, after in replacements:
                if data.count(after) == 1:
                    continue
                if data.count(before) != 1:
                    raise RuntimeError(f'Billing source requires review: {filename}')
                data = data.replace(before, after, 1)
            updates[path] = data.encode()
        originals = {path: read(home + '/' + path) for path in updates}
        ftp.mkd(backup)
        for path, data in updates.items():
            if path.endswith('.php'):
                subprocess.run(['php', '-l'], input=data, check=True)
            upload(backup + '/' + Path(path).name, originals[path])
            target = home + '/' + path
            stage = target + '.new-' + stamp
            upload(stage, data)
            if path.startswith('private/'):
                ftp.sendcmd('SITE CHMOD 600 ' + stage)
        # Install billing guards before updating the customer-facing catalog.
        for path in [p for p in updates if 'numi-account-' in p] + list(SOURCES):
            target = home + '/' + path
            ftp.rename(target + '.new-' + stamp, target)
            if read(target) != updates[path]:
                raise RuntimeError(f'Installed byte verification failed: {Path(path).name}')
        print('Installed and read back the school access and billing guards.')
    verify()

if __name__ == '__main__':
    main()
