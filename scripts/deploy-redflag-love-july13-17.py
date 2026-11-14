"""Replace the reviewed July 13–17 answers in the existing private Love banks."""

import argparse
import calendar
from collections import defaultdict
from contextlib import contextmanager
import ftplib
import hashlib
import io
import json
import os
from pathlib import Path
import posixpath
import re
import ssl
import subprocess


ROOT = Path(__file__).resolve().parents[1]
HOST = "server172.hosting.reg.ru"
PREVIOUS = "3bbfe1229ef38593b72e9112a2df7ae44b65372d"
APPROVED = "f79a0d9c9098f103e79391e268c5d71a1ceeced2"
DATES = tuple(f"{day}-7" for day in range(13, 18))
CALENDAR = {
    f"{day}-{month}"
    for month in range(1, 13)
    for day in range(1, calendar.monthrange(2000, month)[1] + 1)
}
QUESTIONS = (
    "first-step", "romance", "relationship-or-comfort", "adult-partner",
    "near-him", "hard-moment", "relationship-format", "family-or-triangle",
    "honest-or-disappear",
)
BANKS = {f"data/redflag/love/{question}.json": question for question in QUESTIONS}
MANIFEST = "account-service/private/store-assets.json"
FILES = (*BANKS, MANIFEST)
FILE_LIMIT = 1_500_000


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def decode_json(raw, label):
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, f"Duplicate JSON key in {label}")
            result[key] = value
        return result

    try:
        return json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object)
    except (UnicodeError, ValueError):
        raise RuntimeError(f"Invalid UTF-8 JSON in {label}") from None


def encode_json(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def parse_bank(raw, path, label):
    bank = decode_json(raw, label)
    require(isinstance(bank, dict), f"Invalid bank object in {label}")
    require(
        bank.get("schemaVersion") == 2
        and bank.get("section") == "love"
        and bank.get("questionId") == BANKS[path]
        and bank.get("keyRule") == "day-month"
        and isinstance(bank.get("status"), str)
        and isinstance(bank.get("question"), str),
        f"Invalid bank metadata in {label}",
    )
    entries = bank.get("entries")
    require(
        isinstance(entries, dict)
        and set(DATES) <= entries.keys() <= CALENDAR
        and all(isinstance(answer, str) and answer.strip() for answer in entries.values()),
        f"Invalid date entries in {label}",
    )
    return bank


def parse_manifest(raw, label):
    manifest = decode_json(raw, label)
    require(
        isinstance(manifest, dict)
        and manifest.get("version") == 2
        and isinstance(manifest.get("files"), dict)
        and set(BANKS) <= manifest["files"].keys(),
        f"Invalid checksum manifest in {label}",
    )
    return manifest


def without_revised_dates(bank):
    return {**bank, "entries": {
        date: answer for date, answer in bank["entries"].items() if date not in DATES
    }}


def verify_hashes(files, manifest, label):
    for path in BANKS:
        require(digest(files[path]) == manifest["files"][path], f"Checksum mismatch in {label}: {path}")


def git(*arguments):
    return subprocess.check_output(["git", *arguments], cwd=ROOT, timeout=40)


def load_revisions():
    git("merge-base", "--is-ancestor", PREVIOUS, APPROVED)
    git("merge-base", "--is-ancestor", APPROVED, "HEAD")
    previous = {path: git("show", f"{PREVIOUS}:{path}") for path in FILES}
    reviewed = {path: git("show", f"{APPROVED}:{path}") for path in FILES}
    checkout = {path: (ROOT / path).read_bytes() for path in FILES}
    old_manifest = parse_manifest(previous[MANIFEST], "previous release")
    approved_manifest = parse_manifest(reviewed[MANIFEST], "approved release")
    verify_hashes(previous, old_manifest, "previous release")
    verify_hashes(reviewed, approved_manifest, "approved release")
    verify_hashes(checkout, parse_manifest(checkout[MANIFEST], "GitHub checkout"), "GitHub checkout")
    require(
        approved_manifest == {
            **old_manifest,
            "files": {**old_manifest["files"], **{path: digest(reviewed[path]) for path in BANKS}},
        },
        "The approved release changed unrelated checksum entries",
    )
    original, approved = {}, {}
    for path in BANKS:
        before = parse_bank(previous[path], path, f"previous release: {path}")
        reviewed_bank = parse_bank(reviewed[path], path, f"approved release: {path}")
        current = parse_bank(checkout[path], path, f"GitHub checkout: {path}")
        require(without_revised_dates(before) == without_revised_dates(reviewed_bank),
                f"The approved release changed other dates or metadata: {path}")
        original[path] = {date: before["entries"][date] for date in DATES}
        approved[path] = {date: current["entries"][date] for date in DATES}
        for date, answer in approved[path].items():
            require(answer == reviewed_bank["entries"][date] and answer != original[path][date],
                    f"Expected the approved replacement in GitHub: {path} {date}")
    print("GITHUB_SOURCE_VERIFIED: 45 approved replacements, 9 bank hashes and all other dates checked")
    return original, approved


def prepare_live_update(live, original, approved):
    manifest = parse_manifest(live[MANIFEST], "REG.RU")
    verify_hashes(live, manifest, "REG.RU before replacement")
    prepared = {}
    for path in BANKS:
        bank = parse_bank(live[path], path, f"REG.RU: {path}")
        for date, answer in approved[path].items():
            require(bank["entries"][date] in (original[path][date], answer),
                    f"Unexpected live revision: {path} {date}")
        entries = {**bank["entries"], **approved[path]}
        replacement = {**bank, "entries": entries}
        prepared[path] = live[path] if bank == replacement else encode_json(replacement)
        require(without_revised_dates(parse_bank(prepared[path], path, path)) == without_revised_dates(bank),
                f"Replacement changes other live dates or metadata: {path}")

    hashes = {**manifest["files"], **{path: digest(prepared[path]) for path in BANKS}}
    prepared[MANIFEST] = live[MANIFEST]
    if hashes != manifest["files"]:
        prepared[MANIFEST] = encode_json({**manifest, "files": hashes})
    return prepared


@contextmanager
def connect():
    user, password = os.environ.get("REG_FTP_USER"), os.environ.get("REG_FTP_PASSWORD")
    require(user and password, "REG.RU credentials are unavailable")
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30)
    try:
        ftp.connect(HOST, 21)
        ftp.login(user, password)
        ftp.prot_p()
        ftp.set_pasv(True)
        yield ftp
    finally:
        ftp.close()


def read_file(ftp, remote):
    data = io.BytesIO()

    def append(chunk):
        require(data.tell() + len(chunk) <= FILE_LIMIT, "Unexpected remote file size")
        data.write(chunk)

    ftp.retrbinary(f"RETR {remote}", append)
    return data.getvalue()


def upload_verified(ftp, remote, raw):
    ftp.storbinary(f"STOR {remote}", io.BytesIO(raw))
    require(read_file(ftp, remote) == raw, f"Upload verification failed: {posixpath.basename(remote)}")


def live_modes(ftp, paths):
    directories = defaultdict(set)
    for path in paths:
        parent, name = posixpath.split(path)
        directories[parent].add(name)
    modes = {}
    for directory, names in directories.items():
        listing = dict(ftp.mlsd(directory, facts=["type", "UNIX.mode"]))
        for name in names:
            facts = listing.get(name, {})
            mode = facts.get("unix.mode", "")
            require(facts.get("type") == "file" and re.fullmatch(r"[0-7]{3,4}", mode),
                    f"Unable to verify REG.RU file type and mode: {name}")
            modes[posixpath.join(directory, name)] = mode
    return modes


def read_targets(ftp, targets):
    return {path: read_file(ftp, remote) for path, remote in targets.items()}


def verify_live(targets, prepared, approved, modes):
    with connect() as ftp:
        final = read_targets(ftp, targets)
        require(live_modes(ftp, modes) == modes, "REG.RU file permissions changed")
    for path in FILES:
        require(final[path] == prepared[path], f"Final private readback differs: {path}")
    verify_hashes(final, parse_manifest(final[MANIFEST], "REG.RU readback"), "REG.RU after replacement")
    for path in BANKS:
        entries = parse_bank(final[path], path, f"REG.RU readback: {path}")["entries"]
        for date, answer in approved[path].items():
            require(entries[date] == answer, f"REG.RU text differs from GitHub: {path} {date}")


def rollback(touched, targets, stages, staged, modes, previous, prepared):
    failed = []
    for path in reversed(touched):
        remote, stage = targets[path], stages[path]
        for attempt in range(2):
            try:
                with connect() as ftp:
                    actual = read_file(ftp, remote)
                    if actual != previous[path]:
                        require(actual == prepared[path], f"Concurrent change during rollback: {path}")
                        staged.add(stage)
                        upload_verified(ftp, stage, previous[path])
                        ftp.sendcmd(f"SITE CHMOD {modes[remote]} {stage}")
                        require(read_file(ftp, remote) == actual, f"Concurrent change during rollback: {path}")
                        ftp.rename(stage, remote)
                        staged.discard(stage)
                        require(read_file(ftp, remote) == previous[path], f"Rollback readback differs: {path}")
                print(f"ROLLBACK_VERIFIED: {path}")
                break
            except (RuntimeError, *ftplib.all_errors) as error:
                print(f"ROLLBACK_ATTEMPT_FAILED: {path} ({type(error).__name__})")
                if attempt == 1:
                    failed.append(path)
    require(not failed, "Rollback could not be verified for: " + ", ".join(failed))
    print("REG_RU_ROLLBACK_VERIFIED")


def publish(original, approved):
    run = f"{os.environ['GITHUB_RUN_ID']}-{os.environ['GITHUB_RUN_ATTEMPT']}"
    require(re.fullmatch(r"\d+-\d+", run), "Invalid GitHub Actions run identifier")
    with connect() as ftp:
        home = ftp.pwd().rstrip("/")
        private = f"{home}/private/numi-account-20261031"
        targets = {path: f"{private}/store-content/{path}" for path in BANKS}
        targets[MANIFEST] = f"{private}/store-assets.json"
        live = read_targets(ftp, targets)
        prepared = prepare_live_update(live, original, approved)
        changed = [path for path in FILES if live[path] != prepared[path]]
        modes = live_modes(ftp, [targets[path] for path in changed])
        print("REG_RU_PREFLIGHT_VERIFIED: 9 live bank hashes, dates and private manifest checked")

        backup_name = f"love-july13-17-revision-{run}"
        backup = f"{home}/site-safeguard-backups/{backup_name}"
        ftp.mkd(backup)
        ftp.sendcmd(f"SITE CHMOD 700 {backup}")
        for path in FILES:
            upload_verified(ftp, f"{backup}/{posixpath.basename(path)}.before", live[path])
        print(f"REG_RU_BACKUP_VERIFIED: {backup_name}, {len(FILES)} files")

        stages = {path: f"{targets[path]}.staged-{run}" for path in changed}
        staged = set()
        touched = []
        try:
            for path in changed:
                stage = stages[path]
                staged.add(stage)
                upload_verified(ftp, stage, prepared[path])
                ftp.sendcmd(f"SITE CHMOD {modes[targets[path]]} {stage}")
            require(not changed or read_targets(ftp, targets) == live, "REG.RU files changed during staging")
            # Install the manifest last and keep this switch free of data transfers.
            for path in changed:
                touched.append(path)
                ftp.rename(stages[path], targets[path])
                staged.discard(stages[path])
            verify_live(targets, prepared, approved, modes)
        except BaseException:
            if touched:
                rollback(touched, targets, stages, staged, modes, live, prepared)
            raise
        finally:
            for stage in staged:
                try:
                    ftp.delete(stage)
                except ftplib.all_errors:
                    pass

    preserved = sum(len(parse_bank(live[path], path, path)["entries"]) - len(DATES) for path in BANKS)
    print(f"REG_RU_JULY13_17_VERIFIED: 45/45 answers match GitHub, {preserved} other date entries preserved")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-source", action="store_true", help="Verify the approved GitHub revision locally")
    args = parser.parse_args()
    original, approved = load_revisions()
    if not args.check_source:
        publish(original, approved)


if __name__ == "__main__":
    main()
