#!/usr/bin/env python3
"""Conservative, reversible gender-neutral editorial pass for the life report.

Runs ONLY on a dedicated editorial branch; no server operations, deploys, payment
or application-code changes. Rewrites a literal JSON string only when there is a
local, unambiguous second-person predicate. No blanket suffix substitutions.
"""
import argparse
import collections
import difflib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(".")
BASES = (
    "knowledge/full-report/sections/energy-*.json",
    "knowledge/full-report/free/impression/energy-*.json",
    "pro/purpose/*.json",
    "pro/guidance/energy-*.json",
    "pro/karmic-*.json",
    "karmic-tails.md",
    "karmic-programs.md",
)
WORDS = """общительной спокойной легкой лёгкой сильной уверенной любимой щедрой
творческой признанной теплой тёплой богатой честной видимой успешной свободной
надежной надёжной нежной удобной открытой закрытой собранной хорошей важной
идеальной особенной красивой ценной заботливой понятной потерянной нужной
достойной счастливой независимой взрослой мягкой использованной униженной
растворенной растворённой плохой правой виноватой влюбленной влюблённой
услышанной настоящей незаметной достаточной одинокой тихой интуитивной
решительной креативной тактичной внимательной уязвимой слабой пассивной
принятой красивой самостоятельной уверенной требовательной главной
благодарной ответственной живой осторожной интересной заботливой активной
веселой весёлой веселой умной зрелой маленькой скрытной
""".split()
WORDS = sorted(set(WORDS), key=lambda x: (-len(x), x))
def pluralize(fem):
    low=fem.lower()
    if low.endswith("ой"):
        stem=low[:-2]
    elif low.endswith("ей"):
        stem=low[:-2]
    else:
        raise ValueError("Unsupported ending: " + fem)
    ending="ими" if stem.endswith(("г", "к", "х", "ж", "ч", "ш", "щ")) else "ыми"
    result=stem+ending
    if fem[0].isupper():
        result=result[0].upper()+result[1:]
    return result
FORMS={x:pluralize(x) for x in WORDS}
ADJ="(?:"+"|".join(re.escape(x) for x in WORDS)+")"
ADV=r"(?:очень|внешне|внутренне|по-настоящему|одновременно|всё\s+ещё|все\s+еще|настолько|при\s+этом)"
QUAL=rf"(?:(?:{ADV})\s+)*(?:{ADJ})(?:\s*,\s*(?:(?:{ADV})\s+)*(?:{ADJ}))*" \
     +rf"(?:\s+и\s+(?:(?:{ADV})\s+)*(?:{ADJ}))?"
# Narrow syntax: adjective agrees with the SECOND-PERSON reader,
# not with a quoted woman, partner or abstract object.
PRED=rf"(?iu)\b(?:вы\s+(?:не\s+)?(?:(?:можете|могли|хотите|стараетесь|имеете\s+право|мечтаете|должны)\s+)?(?:быть|стать|оставаться|казаться|выглядеть|чувствовать\s+себя)|вам\s+(?:можно|важно|нужно)\s+(?:не\s+)?(?:быть|стать|оставаться))\s+(?P<qual>{QUAL})"
DIRECT=re.compile(PRED)
ADJ_MATCH=re.compile(rf"\b{ADJ}\b",re.I)
QUOTED_JSON=re.compile(r'"(?:\\.|[^"\\])*"',re.S)
FEM_NOUNS=re.compile(r"\b(?:женщин(?:а|ой|у|ы|е)|девушк(?:а|ой|у|и)|девочк(?:а|ой|у|и)|партнёрш(?:а|и|у|ой))\b",re.I)

def apply_to_paragraph(text):
    transformations=[]
    def replace(m):
        old=m.group(0)
        q=m.group("qual")
        modified=ADJ_MATCH.sub(lambda a:FORMS[a.group(0).lower()]
                               if a.group(0).islower() else
                               FORMS[a.group(0).lower()].capitalize(),q)
        if modified==q:return old
        new=old[:-len(q)]+modified
        transformations.append((old,new))
        return new
    new=DIRECT.sub(replace,text)
    return new,transformations

def replace_json_values(original):
    mutations=[]
    def handle(m):
        raw=m.group(0)
        try:decoded=json.loads(raw)
        except json.JSONDecodeError:return raw
        if not isinstance(decoded,str):return raw
        altered,changes=apply_to_paragraph(decoded)
        if not changes:return raw
        mutations.extend(changes)
        return json.dumps(altered,ensure_ascii=False)
    changed=QUOTED_JSON.sub(handle,original)
    # No change whatsoever in keys, structure or paragraph counts.
    if json.loads(original.lstrip("\ufeff"))!=json.loads(changed.lstrip("\ufeff")):
        def shape(x):
            if isinstance(x,dict):return {k:shape(v) for k,v in x.items()}
            if isinstance(x,list):return [shape(v) for v in x]
            return type(x).__name__
        assert shape(json.loads(original.lstrip("\ufeff")))==shape(json.loads(changed.lstrip("\ufeff")))
    return changed,mutations

def paths():
    return sorted(set(p for pattern in BASES for p in ROOT.glob(pattern) if p.is_file()))

def main():
    cli=argparse.ArgumentParser()
    cli.add_argument("--apply",action="store_true")
    cli.add_argument("--report",default="neutral-address-report.json")
    args=cli.parse_args()
    files=paths()
    if len(files)<60:raise RuntimeError("FULL_REPORT_TEXT_FILE_SET_INCOMPLETE")
    report={"operation":"GRAMMATICAL_GENDER_ONLY","published":False,
            "files_checked":len(files),"files_changed":[],"substitutions":0,
            "ambiguous_references_left_unchanged":0}
    for p in files:
        before=p.read_text(encoding="utf-8")
        if p.suffix==".json":
            after,mutations=replace_json_values(before)
        else:
            # Markdown documents: line-scoped, keeping headings and line count.
            changed=[]
            def per_line(line):
                modified,mutations=apply_to_paragraph(line)
                changed.extend(mutations)
                return modified
            after="".join(per_line(line) for line in before.splitlines(True))
            mutations=changed
        if p.suffix==".json":
            assert json.loads(before.lstrip("\ufeff")) is not None
            assert json.loads(after.lstrip("\ufeff")) is not None
        if len(before.splitlines())!=len(after.splitlines()):
            raise RuntimeError("LINE_COUNT_CHANGED "+str(p))
        # Verify every change came from literal direct-address substitution.
        if before!=after and not mutations:raise RuntimeError("UNEXPECTED_DIFF "+str(p))
        if before!=after:
            report["files_changed"].append({"path":str(p),"replacements":len(mutations)})
            report["substitutions"]+=len(mutations)
            if args.apply:p.write_text(after,encoding="utf-8")
        report["ambiguous_references_left_unchanged"]+=len(FEM_NOUNS.findall(after))
    pathlib.Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("NEUTRAL_EDITORIAL_RESULT",json.dumps({
        "files_checked":report["files_checked"],
        "files_changed":len(report["files_changed"]),
        "safe_phrases_changed":report["substitutions"],
        "ambiguous_female_nouns_unchanged":report["ambiguous_references_left_unchanged"],
        "applied":args.apply
    },ensure_ascii=False))
    if not report["substitutions"]:raise RuntimeError("NO_SAFE_DIRECT_ADDRESS_CHANGES")
if __name__=="__main__":main()
