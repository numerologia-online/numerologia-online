"""Generate public product labels and safe Red Flag metadata from existing sources.

The server is the only price/entitlement authority. Paid interpretations stay
private: only approved, full-calendar question banks can be advertised as ready.
No per-question storefront logic or public copy of paid answers is generated.
"""
import calendar
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def published_paid_question(category, question):
    # An item's existing textFile is the only route to its protected bank.
    # The public catalogue never receives the bank content.
    relative = question.get("textFile", category + "/" + question["id"] + ".json").split("?", 1)[0]
    if not re.fullmatch(re.escape(category) + r"/[a-z0-9-]+\\.json", relative):
        raise ValueError("Invalid Red Flag bank path: " + relative)
    path = root / "data/redflag" / relative
    if not path.is_file():
        return False
    bank = read_json(path)
    if bank.get("status") not in ("ready", "complete"):
        return False
    if bank.get("section") != category or bank.get("questionId") != question["id"]:
        return False
    if bank.get("keyRule") != "day-month":
        return False
    entries = bank.get("entries")
    if not isinstance(entries, dict):
        return False
    dates = {
        f"{day}-{month}"
        for month in range(1, 13)
        for day in range(1, calendar.monthrange(2024, month)[1] + 1)
    }
    return set(entries) == dates and all(
        isinstance(entries[date], str) and entries[date].strip()
        for date in dates
    )


products = [
    ("year_full", "Полный разбор года"),
    ("life_full", "Полный разбор жизни"),
    ("compatibility_full", "Совместимость"),
    ("child_full_v1", "Детский разбор"),
    ("redflag_question", "Мужчина или Red Flag"),
    ("yesno_question", "Да или нет?"),
    ("moment_question", "Нумерология момента"),
    ("club_month", "Клуб"),
    ("school_week", "Школа нумерологии"),
    ("money_rituals", "Денежные ритуалы"),
    ("wallet_topup", "Пополнение кошелька"),
]

categories = read_json(root / "data/redflag/catalog.json")
redflag = []
public_questions = {}
private_questions = {}
for category in categories:
    name = category["id"]
    bank_name = "money-questions" if name == "money" else name
    questions = read_json(root / f"data/redflag/banks/{bank_name}.json")["questions"]
    safe = []
    private_questions[name] = {}
    for index, question in enumerate(questions):
        tier = question.get("priceRub")
        if type(tier) is not int or tier not in (10, 29, 49):
            raise ValueError("Invalid Red Flag price tier: " + name + "/" + question["id"])
        ready = index == 0 or published_paid_question(name, question)
        private_questions[name][question["id"]] = {
            "tier": tier,
            "free": index == 0,
            "ready": ready,
        }
        redflag.append({
            "id": question["id"],
            "category": name,
            "title": category["title"] + " · " + question["title"],
        })
        if index == 0:
            # Free answers/variants were already public. Keep them, but never
            # include any paid textFile or variants in this metadata module.
            permitted = ("id", "title", "priceRub", "textFile", "aspect",
                         "variants", "usePeriod", "observation")
            public = {key: question[key] for key in permitted if key in question}
            public["status"] = "ready"
        else:
            public = {
                "id": question["id"],
                "title": question["title"],
                "priceRub": question["priceRub"],
                "status": "ready" if ready else "soon",
            }
        safe.append(public)
    public_questions[name] = safe

catalog = {
    "products": [{"code": code, "title": title} for code, title in products],
    "redflag": redflag,
    "yesno": read_json(root / "moment/yes-no/questions.json")["questions"],
    "moment": read_json(root / "moment/questions.json")["questions"],
}
write_json(root / "store-catalog.json", catalog)
# This file is deployed only alongside the PHP checkout core, outside webroot.
# It contains metadata, not paid answers, and is generated from the SAME banks.
write_json(root / "account-service/private/redflag-catalog.json", {
    "version": 1,
    "questions": private_questions,
})
public_categories = [
    {key: item[key] for key in ("id", "kicker", "title", "description", "bank") if key in item}
    for item in categories
]
public_js = (
    "// GENERATED from data/redflag banks and approved material files.\n"
    "// Public metadata and free answers only. NEVER add paid text here.\n"
    "export const PUBLIC_CATEGORIES = " + json.dumps(public_categories, ensure_ascii=False, indent=2) + ";\n"
    "export const PUBLIC_QUESTIONS = " + json.dumps(public_questions, ensure_ascii=False, indent=2) + ";\n"
)
(root / "redflag-public-catalog.js").write_text(public_js, encoding="utf-8")
print("Generated store catalog, private checkout metadata and public Red Flag statuses; paid texts remain private")
