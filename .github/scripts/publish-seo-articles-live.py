"""One-purpose REG.RU release: eight SEO articles, journal links and sitemap.
Never replace full live journal or unrelated files. Back up existing files outside
the public webroot; verify every write, and roll back after any failed check.
"""
import ftplib
import hashlib
import html
import io
import json
import os
import pathlib
import re
import ssl
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
DOMAIN = "xn--c1adkkdfjbp1a4l.online"
BASE = "https://" + DOMAIN + "/"
TOPICS = [
    ("Ребёнок по дате рождения. Как читать характер без ярлыков", "rebenok-po-date-rozhdeniya"),
    ("Матрица совместимости. С чего начать расшифровку", "matrica-sovmestimosti"),
    ("Денежный код по дате рождения. Как рассчитать и что читать дальше", "denezhnyi-kod-po-date"),
    ("Нумерологический прогноз на 2027 год. Как узнать свой личный период", "prognoz-2027"),
    ("Ред флаги в отношениях. Что настораживает за красивым ухаживанием", "red-flagi-v-otnosheniyah"),
    ("Ангельская нумерология. Что означают повторяющиеся числа", "angelskaya-numerologiya"),
    ("Нумерология с нуля. С чего начать, чтобы не смешать разные школы", "numerologiya-s-nulya"),
    ("Нумерология по дате рождения. Какие расчёты можно сделать онлайн", "numerologiya-po-date-rozhdeniya"),
]

def sha(data):
    return hashlib.sha256(data).hexdigest() if data is not None else None

def read_remote(ftp, path):
    output = io.BytesIO()
    def collect(chunk):
        if output.tell() + len(chunk) > 3_000_000:
            raise RuntimeError("Remote file unexpectedly large: " + path)
        output.write(chunk)
    try:
        ftp.retrbinary("RETR " + path, collect)
    except ftplib.error_perm as error:
        if str(error).startswith("550"):
            return None
        raise
    return output.getvalue()

def write_remote(ftp, path, data):
    ftp.storbinary("STOR " + path, io.BytesIO(data))
    if read_remote(ftp, path) != data:
        raise RuntimeError("FTPS read-back mismatch: " + path)

def patch_journal(original):
    if original is None:
        raise RuntimeError("Live journal is missing")
    value = original.decode("utf-8")
    if 'class="story-row"' not in value or 'data-section="children"' not in value:
        raise RuntimeError("Unexpected journal markup, refusing overwrite")
    for title, slug in TOPICS:
        url = "/guide/" + slug + "/"
        if f'href="{url}"' in value:
            continue
        pattern = re.compile(
            r'<details class="story-row" data-search="([^"]*)"><summary><h3>'
            + re.escape(title)
            + r'</h3><span class="soon">Скоро <b aria-hidden="true">\+</b></span>'
            + r'</summary><div class="draft-copy">.*?</div></details>',
            re.DOTALL,
        )
        matches = list(pattern.finditer(value))
        if len(matches) != 1:
            raise RuntimeError("Journal topic not found uniquely: " + title)
        search = matches[0].group(1)
        replacement = (
            f'<a class="story-row" href="{url}" data-search="{search}">'
            f'<h3>{html.escape(title)}</h3><span class="ready">Читать ↗</span></a>'
        )
        value = value[:matches[0].start()] + replacement + value[matches[0].end():]
    for _, slug in TOPICS:
        if value.count('href="/guide/' + slug + '/"') != 1:
            raise RuntimeError("Missing or duplicate journal link: " + slug)
    return value.encode("utf-8")

def patch_sitemap(original):
    if original is None:
        raise RuntimeError("Live sitemap is missing")
    value = original.decode("utf-8")
    if "<urlset" not in value or value.count("</urlset>") != 1:
        raise RuntimeError("Unexpected sitemap format")
    for _, slug in TOPICS:
        url = BASE + "guide/" + slug + "/"
        if url not in value:
            value = value.replace(
                "</urlset>", "  <url><loc>" + url + "</loc></url>\n</urlset>"
            )
    for _, slug in TOPICS:
        if value.count("<loc>" + BASE + "guide/" + slug + "/</loc>") != 1:
            raise RuntimeError("Missing or duplicate sitemap URL: " + slug)
    return value.encode("utf-8")

def verify_http(path, expected):
    if path.endswith("/index.html"):
        url = BASE + path[:-len("index.html")]
    else:
        url = BASE + path
    url += "?seo_release=20261103" + str(int(time.time() * 1000000))
    req = urllib.request.Request(
        url, headers={"Cache-Control": "no-cache", "User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req, timeout=35) as response:
        actual = response.read(3_000_001)
        if response.status != 200:
            raise RuntimeError("HTTP status not 200: " + path)
        if "noindex" in response.headers.get("X-Robots-Tag", "").lower():
            raise RuntimeError("Search index blocked by HTTP header: " + path)
    if actual != expected:
        raise RuntimeError("Public HTTP differs from uploaded content: " + path)

def main():
    release = json.loads((ROOT / "seo/articles-release.json").read_text("utf-8"))
    marker = release.get("_seo_publication")
    slugs = [slug for _, slug in TOPICS]
    if marker != {"version": "2026-11-03", "slugs": slugs}:
        raise RuntimeError("SEO publication manifest mismatch")
    pages = {}
    for slug in slugs:
        path = "guide/" + slug + "/index.html"
        data = (ROOT / path).read_bytes()
        if (b'<meta name="robots" content="index,follow">' not in data
                or (BASE + "guide/" + slug + "/").encode() not in data):
            raise RuntimeError("Unexpected SEO page: " + path)
        pages[path] = data
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=40)
    ftp.connect("server172.hosting.reg.ru", 21)
    ftp.login(os.environ["REG_FTP_USER"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    home = ftp.pwd().rstrip("/")
    site = home + "/www/" + DOMAIN
    originals = {}
    targets = {}
    changed = []
    try:
        if read_remote(ftp, site + "/index.html") is None:
            raise RuntimeError("Website root could not be verified")
        for path in pages:
            original = read_remote(ftp, site + "/" + path)
            if original is not None and original != pages[path]:
                raise RuntimeError("Existing different article, refusing overwrite: " + path)
            originals[path] = original
            targets[path] = pages[path]
        for path, transform in (
            ("guide/index.html", patch_journal),
            ("sitemap.xml", patch_sitemap),
        ):
            original = read_remote(ftp, site + "/" + path)
            originals[path] = original
            targets[path] = transform(original)
        print("PRECHECK OK: exactly eight pages, journal links and sitemap", flush=True)
        existing_changes = [p for p in targets if originals[p] != targets[p]]
        if existing_changes:
            backup_root = home + "/site-safeguard-backups"
            try:
                ftp.mkd(backup_root)
            except ftplib.error_perm:
                ftp.cwd(backup_root)
            backup = backup_root + "/seo-articles-20261103-" + str(int(time.time()))
            ftp.mkd(backup)
            for path in existing_changes:
                original = originals[path]
                if original is not None:
                    backup_name = hashlib.sha256(path.encode()).hexdigest()[:12] + "-" + pathlib.PurePosixPath(path).name + ".bak"
                    write_remote(ftp, backup + "/" + backup_name, original)
            manifest = json.dumps(
                {"changes": existing_changes, "original_hashes": {p: sha(originals[p]) for p in existing_changes}},
                ensure_ascii=False,
            ).encode("utf-8")
            write_remote(ftp, backup + "/manifest.json", manifest)
            print("BACKUP COMPLETED outside website root", flush=True)
        try:
            for path in existing_changes:
                if read_remote(ftp, site + "/" + path) != originals[path]:
                    raise RuntimeError("Live file changed concurrently: " + path)
                if path.endswith("/index.html") and path != "guide/index.html":
                    folder = site + "/" + path.rsplit("/", 1)[0]
                    try:
                        ftp.mkd(folder)
                    except ftplib.error_perm:
                        ftp.cwd(folder)
                changed.append(path)
                write_remote(ftp, site + "/" + path, targets[path])
                print("UPLOADED: " + path, flush=True)
            for path, expected in targets.items():
                verify_http(path, expected)
                print("HTTP VERIFIED: " + path, flush=True)
            print("SEO REG.RU SUCCESS: " + str(len(targets)) + " HTTP pages verified; " + str(len(changed)) + " changed", flush=True)
        except BaseException:
            for path in reversed(changed):
                try:
                    old = originals[path]
                    if old is None:
                        ftp.delete(site + "/" + path)
                    else:
                        write_remote(ftp, site + "/" + path, old)
                    print("ROLLED BACK: " + path, flush=True)
                except BaseException as error:
                    print("ROLLBACK FAILURE: " + path + " " + str(error)[:100], flush=True)
            raise
    finally:
        try:
            ftp.quit()
        except BaseException:
            ftp.close()

if __name__ == "__main__":
    main()
