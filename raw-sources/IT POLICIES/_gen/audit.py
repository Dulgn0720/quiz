# -*- coding: utf-8 -*-
"""Баримтын хэл найруулга, бүтцийн автомат шалгалт.

`ДҮРЭМ.md`-д тогтоосон дүрмээс машинаар шалгаж болохыг нь шалгана.

Худал дохио өгөхийг хориглоно. Зөв бичлэгийг алдаа гэж заадаг шалгагчийг
хүн сонсохоо болих бөгөөд тэр мөчид шалгалт утгагүй болно. Тиймээс дүрэм
бүрд чөлөөлөх нөхцөл нь тодорхой заагдсан байна.

Шалгалт цэвэр гарсан нь баримт зөв гэсэн үг биш — гараар унших нь хэвээр.
"""

import glob
import os
import re
import sys

from docx import Document

GEN_DIR = os.path.dirname(os.path.abspath(__file__))
DOC_DIR = os.path.dirname(GEN_DIR)

# ── А.5 Нэг өгүүлбэрт давтагдахыг хориглосон үндэс ───────────────────
# Гурав ба түүнээс дээш давтагдсан үед л дохио өгнө. Хоёр удаа давтагдах
# нь зэрэгцүүлсэн жагсаалтад хэвийн: «хувийн мэдээлэл, санхүүгийн
# мэдээлэл» гэдэг зөв бичлэг тул алдаа гэж зааж болохгүй.
REPEATED_ROOTS = [
    "байдал", "байдл", "хамаар", "арга хэмжээ", "журм", "журам", "сонголт",
    "хандах", "зайлшгүй", "шаардлаг", "хугацаа", "мэдээлэл", "хяналт",
    "эрсдэл", "хэрэгжил", "тодорхойл", "бүртгэл", "ажиллагаа",
]
REPEAT_LIMIT = 3

# Ижил үгийн хэлбэр ойрхон давтагдах цонх (үгээр).
ADJACENT_WINDOW = 2

# ── А.6 Хэмжүүргүй хэллэг ────────────────────────────────────────────
# Дэд мөрөөр биш, үгийн заагаар хайна: «шаардлагатай болсон» гэдэг зөв
# бичлэгийг «шаардлагатай бол» гэж уншиж алдаа заахыг хориглоно.
VAGUE = [
    r"зохистой харьцаатай", r"боломжийн хэмжээнд", r"аль болох",
    r"шаардлагатай бол\b", r"боломжтой бол\b",
    r"зарим тохиолдолд", r"ерөнхийдөө", r"тухайн үедээ",
]

# ── Хориглосон хэллэг ───────────────────────────────────────────────
# Тоог үгээр бичихэд гардаг алдаа. Гараар уншиж олсон тул шалгалтад нэмэв.
MISSPELLED = {
    "гуччин": "гучин",
    "гуч минут": "гучин минут",
    "гуч цаг": "гучин цаг",
    "гуч хоног": "гучин хоног",
    "гуч өдөр": "гучин өдөр",
    "гуч сар": "гучин сар",
    "гуч жил": "гучин жил",
    "гуч удаа": "гучин удаа",
    "гуч хувь": "гучин хувь",
    "тав минут": "таван минут",
    "тав цаг": "таван цаг",
    "тав хоног": "таван хоног",
    "тав өдөр": "таван өдөр",
    "тав сар": "таван сар",
    "тав жил": "таван жил",
    "тав удаа": "таван удаа",
    "тав хувь": "таван хувь",
    "ес минут": "есөн минут",
    "ес цаг": "есөн цаг",
    "ес хоног": "есөн хоног",
    "ес өдөр": "есөн өдөр",
    "ес сар": "есөн сар",
    "ес жил": "есөн жил",
    "ес удаа": "есөн удаа",
    "ес хувь": "есөн хувь",
    "арав минут": "арван минут",
    "арав цаг": "арван цаг",
    "арав хоног": "арван хоног",
    "арав өдөр": "арван өдөр",
    "арав сар": "арван сар",
    "арав жил": "арван жил",
    "арав удаа": "арван удаа",
    "арав хувь": "арван хувь",
    "ер минут": "ерэн минут",
    "ер цаг": "ерэн цаг",
    "ер хоног": "ерэн хоног",
    "ер өдөр": "ерэн өдөр",
    "ер сар": "ерэн сар",
    "ер жил": "ерэн жил",
    "ер удаа": "ерэн удаа",
    "ер хувь": "ерэн хувь",
    "дал минут": "далан минут",
    "дал цаг": "далан цаг",
    "дал хоног": "далан хоног",
    "дал өдөр": "далан өдөр",
    "дал сар": "далан сар",
    "дал жил": "далан жил",
    "дал удаа": "далан удаа",
    "дал хувь": "далан хувь",
    "ная минут": "наян минут",
    "ная цаг": "наян цаг",
    "ная хоног": "наян хоног",
    "ная өдөр": "наян өдөр",
    "ная сар": "наян сар",
    "ная жил": "наян жил",
    "ная удаа": "наян удаа",
    "ная хувь": "наян хувь",
}

BANNED = {
    r"дарга": "албан тушаалын нэр «ахлах» байх ёстой",
    r"гэх мэт": "жагсаалт нээлттэй үлдэхийг хориглоно",
    r"гэх зэрэг": "жагсаалт нээлттэй үлдэхийг хориглоно",
}

# Заалтын ТӨГСГӨЛД байвал л дүрэм зөрчинө. Дунд нь тодотгол болж орсон
# «эдэлж болохгүй үүрэг» гэдэг нь зөв бичлэг тул дохио өгөхийг хориглоно.
BANNED_ENDING = {
    r"болохгүй[.;]?$": "хориглох заалт «хориглоно» гэж төгсөнө",
    r"хэрэггүй[.;]?$": "хориглох заалт «хориглоно» гэж төгсөнө",
}

# ── А.2 Дугаарласан заалт нь ҮҮРЭГ үүсгэнэ ───────────────────────────
# Тайлбарласан өгүүлбэрийг дугаарлавал уншигч аль нь заавал биелүүлэх,
# аль нь тайлбар болохыг ялгаж чадахгүй. Тайлбарыг «Тайлбар:» гэсэн
# дугаарлагдаагүй мөрөөр бичнэ.
# Зөвхөн ЗААЛТАД шалгана. Тайлбар мөрөнд шалгахыг хориглоно.
DECLARATIVE = {
    r"\bмөн\.$": "тайлбарласан өгүүлбэр — Тайлбар болгоно",
    r"\bюм\.$": "тайлбарласан өгүүлбэр — Тайлбар болгоно",
    r"\bбайдаг\.$": "тайлбарласан өгүүлбэр — Тайлбар болгоно",
    r"\bболдог\.$": "тайлбарласан өгүүлбэр — Тайлбар болгоно",
    r"\bхямд\.$": "тайлбарласан өгүүлбэр — Тайлбар болгоно",
    r"\bгэсэн үг биш\.$": "тайлбарласан өгүүлбэр — Тайлбар болгоно",
}

# ── А.3 Дэд заалт жижиг үсгээр эхэлнэ — чөлөөлөх нэр ─────────────────
# Оноосон нэр, хуулийн нэр, баримтын дугаар том үсгээр эхлэх нь зөв.
PROPER_START = (
    "Компани", "Хэлтс", "Гүйцэтгэх", "Монгол", "Иргэн", "Даатгал",
    "Хүний", "Кибер", "Цахим", "Архив", "Санхүүгийн", "Хөдөлмөр",
    "Инноваци", "Улс", "Төсөл", "Батлагдсан", "Хэрэгжсэн", "Нийтийн",
    "Дотоод", "Нууц", "Онц",
)

# ДҮРЭМ Г.22 — тодорхой бүтээгдэхүүн, технологийн нэр баримтад орохыг
# хориглоно. Баримт компанийн хэмжээнд, технологи солигдсон ч хэвээр
# үйлчилнэ.
# Үгийн заагаар хайна: «Монгол Улс» гэсэн зөв бичлэг доторх «монго»-г
# мэдээллийн сангийн нэр гэж уншиж алдаа заахыг хориглоно.
SYSTEM_SPECIFIC = [
    # Латин нэрийг угтвараар хайна: «\bmongo\b» гэвэл «MongoDB» баригдахгүй.
    # Кирилл «монго»-г бүтэн үгээр хайна, эс тэгвэл «Монгол» баригдана.
    r"коллекц", r"\bmongo", r"\bмонго\b", r"\bpostgres", r"\bredis\b",
    r"\bdocker", r"\bminio\b", r"\bfirebase", r"\bsentry\b",
    r"\bflutter\b", r"\bkubernetes", r"\bnginx\b", r"\blinux\b",
    r"\bwindows\b", r"\boracle\b", r"\bandroid", r"\bios\b",
    r"\bтелеграм\b", r"\btelegram\b",
]

# Аравтын тоог хоёр удаа дараалуулах алдаа: «ерэн тавь» гэвэл ерэн ба
# тавь буюу 90 ба 50 болно. Зөв нь «ерэн таван».
TENS_MOD = "арван|хорин|гучин|дөчин|тавин|жаран|далан|наян|ерэн"
TENS_ABS = "арав|хорь|гуч|дөч|тавь|жар|дал|ная|ер"
DOUBLE_TENS = re.compile(rf"\b({TENS_MOD})\s+({TENS_ABS})\b")

VALID_DOCS = {f"IT-{n:02d}" for n in range(0, 38)}

CLAUSE = re.compile(r"^(\d+)\.(\d+)\.(?:(\d+)\.)?\s")
BRACKETED = re.compile(r"\[[^\]]*\]")          # [ТОДОРХОЙЛОХ] мэтийг хасна
QUOTED_TERM = re.compile(r"«[^»]*»")
MAX_WORDS = 40


def _sentences(text):
    return [s for s in re.split(r"(?<=[.;:])\s+", text) if s.strip()]


def _is_definition(body):
    """«X» гэж … ойлгоно/-ыг; хэлбэрийн нэр томьёоны тодорхойлолт.

    Тодорхойлолт нь тодорхойлж буй үгээ давтахаас зайлсхийх боломжгүй тул
    давталтын шалгалтаас чөлөөлнө.
    """
    return body.lstrip().startswith("«") and " гэж " in body


def _repeat_issues(body):
    """Давталтыг зөвхөн бодитоор бартаатай болсон үед л заана."""
    issues = []
    # Хаалтад буй тэмдэглэгээ, ишлэлд авсан нэр томьёог тооцохгүй.
    clean = QUOTED_TERM.sub(" ", BRACKETED.sub(" ", body)).lower()

    for sentence in _sentences(clean):
        words = sentence.split()
        for root in REPEATED_ROOTS:
            n = sentence.count(root)
            if n >= REPEAT_LIMIT:
                issues.append(f"«{root}» нэг өгүүлбэрт {n} удаа давтагдав")
        # ижил үгийн хэлбэр хэт ойрхон
        for i, w in enumerate(words):
            token = w.strip(",;:.()«»")
            if len(token) < 6:
                continue
            if token in [x.strip(",;:.()«»") for x in words[i + 1:i + 1 + ADJACENT_WINDOW]]:
                issues.append(f"«{token}» {ADJACENT_WINDOW} үгийн дотор давтагдав")
    return issues


def check(path):
    name = os.path.basename(path)
    paras = [p.text.strip() for p in Document(path).paragraphs if p.text.strip()]
    issues = []

    prev_was_colon = False

    for text in paras:
        m = CLAUSE.match(text)
        body = text[m.end():] if m else text
        low = body.lower()

        if not _is_definition(body):
            for why in _repeat_issues(body):
                issues.append((text, why))

        for v in VAGUE:
            if re.search(v, low):
                issues.append((text, f"хэмжүүргүй хэллэг: «{v}»"))

        for term in SYSTEM_SPECIFIC:
            m2 = re.search(term, low)
            if m2:
                issues.append((text, f"тодорхой технологийн нэр: «{m2.group(0)}»"))

        dt = DOUBLE_TENS.search(low)
        if dt:
            issues.append((text, f"тооны бичлэг: «{dt.group(0)}» — аравтын тоо хоёр дараалав"))

        for bad, good in MISSPELLED.items():
            if bad in low:
                issues.append((text, f"зөв бичлэг: «{bad}» → «{good}»"))

        for b, why in BANNED.items():
            if re.search(rf"(^|\W){b}", low):
                issues.append((text, f"«{b}» — {why}"))

        if m and not body.startswith("Тайлбар"):
            for s in _sentences(body):
                for d, why in DECLARATIVE.items():
                    if re.search(d, s.strip().lower()):
                        issues.append((text, f"«{s.strip()[-14:]}» — {why}"))

        for b, why in BANNED_ENDING.items():
            if re.search(b, low.strip()):
                issues.append((text, f"заалт «{b[:9]}»-ээр төгсөв — {why}"))

        for s in _sentences(body):
            if len(s.split()) > MAX_WORDS:
                issues.append((text, f"өгүүлбэр {len(s.split())} үгтэй, дээд хэмжээ {MAX_WORDS}"))

        if m:
            depth = int(m.group(3) or 0)

            if prev_was_colon and depth == 0:
                issues.append((text, "хоёр цэгийн дараа бие даасан заалт эхэлж байна"))

            if depth > 0:
                if not body.endswith((";", ".")):
                    issues.append((text, "дэд заалт «;» эсвэл «.»-оор төгсөх ёстой"))
                first = body.split()[0] if body.split() else ""
                if first[:1].isupper() and not first.startswith(PROPER_START) \
                        and not body.startswith(("IT-", "«")):
                    issues.append((text, "дэд заалт жижиг үсгээр эхлэх ёстой"))

            prev_was_colon = body.endswith(":")
        else:
            prev_was_colon = False

        for ref in re.findall(r"IT-\d{2}", text):
            if ref not in VALID_DOCS:
                issues.append((text, f"бүртгэлд байхгүй баримт иш татав: {ref}"))

    return name, issues


def document_paths():
    """Шалгах баримтын жагсаалтыг үүсгэгч скриптүүдээс цуглуулна.

    Хавтас жагсаах эрх байхгүй орчинд `glob` хоосон буцааж, шалгалт
    чимээгүй өнгөрдөг. Хоосон үр дүнг «цэвэр» гэж уншихаас сэргийлж
    жагсаалтыг эх сурвалжаас нь гаргаж авна.
    """
    names = set()
    for script in sorted(glob.glob(os.path.join(GEN_DIR, "*.py"))):
        src = open(script, encoding="utf-8").read()
        names.update(re.findall(r'filename="([^"]+\.docx)"', src))
    return sorted(os.path.join(DOC_DIR, n) for n in names)


def main():
    files = document_paths()
    if not files:
        print("Шалгах баримт олдсонгүй.")
        return 1

    missing = [f for f in files if not os.path.exists(f)]
    if missing:
        print(f"ОЛДСОНГҮЙ {len(missing)} баримт:")
        for f in missing:
            print("   ", os.path.basename(f))
        return 1

    total = 0
    for path in files:
        name, issues = check(path)
        if not issues:
            print(f"ЦЭВЭР    {name}")
            continue
        print(f"АЛДААТАЙ {name} — {len(issues)}")
        for text, why in issues:
            snippet = text if len(text) <= 110 else text[:110] + "…"
            print(f"    · {why}\n      {snippet}")
        total += len(issues)

    print(f"\nНийт асуудал: {total}")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
