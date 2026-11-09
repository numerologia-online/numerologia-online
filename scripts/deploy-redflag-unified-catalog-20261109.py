"""Guarded Red Flag one-catalog release to REG.RU. No money or DB changes.

Uses existing FTPS credentials, guards exact live baselines, saves backups
outside webroot, verifies HTTPS and rolls back changed files on failure.
"""
import ftplib
import io
import json
import os
from pathlib import Path
import ssl
import subprocess
import urllib.request

HOST = "server172.hosting.reg.ru"
DOMAIN = "xn----8sbhhqijddjgdebdz2c2o.xn--p1ai"
WEBROOT = "xn--c1adkkdfjbp1a4l.online"
MAX = 900_000
PUBLIC = [
    "redflag-public-catalog.js",
    "redflag-text-bank.js",
    "redflag-categories.js",
    "redflag-feature.js",
    "app.js",
]
PRIVATE = {
    "redflag-catalog.json": "account-service/private/redflag-catalog.json",
    "core.php": "account-service/private/core.php",
    "store.php": "account-service/private/store.php",
}
OLD_TAGS = [
    b'app.js?v=redflag-question-stable-20261109',
    b'app.js?v=redflag-status-fix-20261109',
]
NEW_TAG = b'app.js?v=unified-sale-status-20261109'


def read(ftp, path, allow_missing=False):
    output = io.BytesIO()
    def collect(chunk):
        if output.tell() + len(chunk) > MAX:
            raise RuntimeError('REMOTE_TOO_LARGE')
        output.write(chunk)
    try:
        ftp.retrbinary('RETR ' + path, collect)
    except ftplib.error_perm as error:
        if allow_missing and str(error).startswith('550'):
            return None
        raise
    return output.getvalue()


def write(ftp, path, payload):
    ftp.storbinary('STOR ' + path, io.BytesIO(payload))
    if read(ftp, path) != payload:
        raise RuntimeError('FTPS_READBACK_MISMATCH:' + path.rsplit('/', 1)[-1])


def known_git_baseline(path, raw, source):
    if raw == source:
        return True
    commits = subprocess.check_output(
        ['git', 'log', '-100', '--format=%H', '--', path], text=True
    ).splitlines()
    for sha in commits:
        old = subprocess.run(['git', 'show', sha + ':' + path], capture_output=True)
        if old.returncode == 0 and old.stdout == raw:
            return True
    return False


def prepare():
    subprocess.run(['python3', 'scripts/build-store-catalog.py'], check=True)
    generated = ['redflag-public-catalog.js', 'store-catalog.json',
                 'account-service/private/redflag-catalog.json']
    if subprocess.run(['git', 'diff', '--exit-code', '--', *generated],
                      capture_output=True).returncode:
        raise RuntimeError('CATALOG_GENERATION_CHANGED_SOURCE')
    catalog = json.loads(Path(PRIVATE['redflag-catalog.json']).read_text())
    groups = catalog.get('questions', {})
    if catalog.get('version') != 1 or len(groups) != 8 or sum(map(len, groups.values())) != 81:
        raise RuntimeError('INVALID_PRIVATE_CATALOG')
    if sum(x['free'] for bank in groups.values() for x in bank.values()) != 8:
        raise RuntimeError('INVALID_FREE_QUESTION_COUNT')
    sources = {name: Path(name).read_bytes() for name in PUBLIC}
    sources.update({name: Path(path).read_bytes() for name, path in PRIVATE.items()})
    for name, data in sources.items():
        if not data or len(data) > MAX:
            raise RuntimeError('INVALID_SOURCE:' + name)
        if name.endswith('.php') and not data.startswith(b'<?php'):
            raise RuntimeError('INVALID_PHP_SOURCE:' + name)
    return sources


def main():
    user, password = os.environ.get('REG_FTP_USER'), os.environ.get('REG_FTP_PASSWORD')
    if not user or not password:
        raise RuntimeError('MISSING_GUARDED_FTPS_SECRET')
    sources = prepare()
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30)
    ftp.connect(HOST, 21)
    ftp.login(user, password)
    ftp.prot_p()
    ftp.set_pasv(True)
    home = ftp.pwd().rstrip('/')
    pub = home + '/www/' + WEBROOT
    private = home + '/private/numi-account-20261031'
    paths = {name: pub + '/' + name for name in PUBLIC}
    paths.update({name: private + '/' + name for name in PRIVATE})
    paths['index.html'] = pub + '/index.html'
    originals = {}
    changed = []
    try:
        ftp.cwd(pub)
        ftp.cwd(private)
        for name, remote in paths.items():
            old = read(ftp, remote, allow_missing=name == 'redflag-catalog.json')
            originals[name] = old
            if name not in ('index.html', 'redflag-catalog.json'):
                src = name if name in PUBLIC else PRIVATE[name]
                if old is None or not known_git_baseline(src, old, sources[name]):
                    raise RuntimeError('UNKNOWN_SERVER_BASELINE:' + name)
            if name == 'redflag-catalog.json' and old is not None:
                try:
                    data = json.loads(old)
                    if data.get('version') != 1 or not isinstance(data.get('questions'), dict):
                        raise ValueError('Unknown private catalog')
                except Exception:
                    raise RuntimeError('UNKNOWN_PRIVATE_CATALOG_BASELINE')
        old_index = originals['index.html']
        if old_index is None:
            raise RuntimeError('SITE_INDEX_MISSING')
        if old_index.count(NEW_TAG) == 1:
            index = old_index
        else:
            matches = [tag for tag in OLD_TAGS if old_index.count(tag) == 1]
            if len(matches) != 1:
                raise RuntimeError('UNKNOWN_INDEX_SCRIPT_TAG')
            index = old_index.replace(matches[0], NEW_TAG, 1)
        sources['index.html'] = index
        print('GUARDED_BASELINES_VERIFIED', len(paths), flush=True)
        backup = home + '/private/numi-redflag-unified-backup-' + os.environ.get('GITHUB_RUN_ID', 'local')
        ftp.mkd(backup)
        for name, old in originals.items():
            if old is not None:
                write(ftp, backup + '/' + name.replace('/', '__') + '.before', old)
        print('PRIVATE_BACKUPS_SAVED', flush=True)
        try:
            # Install private metadata first. No database, payments or balances touched.
            for name in ['redflag-catalog.json', 'store.php', 'core.php', *PUBLIC, 'index.html']:
                remote = paths[name]
                if read(ftp, remote, allow_missing=name == 'redflag-catalog.json') != originals[name]:
                    raise RuntimeError('CONCURRENT_REMOTE_EDIT:' + name)
                if originals[name] != sources[name]:
                    changed.append(name)
                    write(ftp, remote, sources[name])
                print('SOURCE_VERIFIED', name, flush=True)
                if name in PUBLIC:
                    url = 'https://' + DOMAIN + '/' + name + '?unified_check=' + os.environ.get('GITHUB_RUN_ID', '0')
                    with urllib.request.urlopen(urllib.request.Request(url, headers={'Cache-Control': 'no-cache'}), timeout=35) as response:
                        if response.status != 200 or response.read(MAX + 1) != sources[name]:
                            raise RuntimeError('LIVE_HTTP_MISMATCH:' + name)
            url = 'https://' + DOMAIN + '/index.html?unified_check=' + os.environ.get('GITHUB_RUN_ID', '0')
            with urllib.request.urlopen(urllib.request.Request(url, headers={'Cache-Control': 'no-cache'}), timeout=35) as response:
                if response.status != 200 or response.read(MAX + 1) != index:
                    raise RuntimeError('LIVE_INDEX_HTTP_MISMATCH')
            print('REG_RU_REDFLAG_UNIFIED_PUBLISHED', len(changed), flush=True)
        except Exception:
            print('PUBLISH_FAILED_ROLLING_BACK', flush=True)
            for name in reversed(changed):
                try:
                    if originals[name] is None:
                        ftp.delete(paths[name])
                    else:
                        write(ftp, paths[name], originals[name])
                    print('ROLLBACK_OK', name, flush=True)
                except Exception:
                    print('ROLLBACK_FAILED', name, flush=True)
            raise
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()


if __name__ == '__main__':
    main()
