# -*- coding: utf-8 -*-
"""Бүрэн аудитын нэмэлт механик шалгалт.

`audit.py` нь найруулгын хэв шинжийг хардаг. Энэ файл нь цэг таслал,
дугаарлалт, нэр томьёоны нэгдмэл байдал, хуулбарлалтын алдааг хардаг —
өөрөөр хэлбэл гараар уншихад хамгийн амархан өнгөрдөг зүйлсийг.
"""

import os
import re
import sys
from collections import defaultdict

from docx import Document

import audit

CLAUSE = re.compile(r"^(\d+)\.(\d+)\.(?:(\d+)\.)?\s")

# Нэр томьёо нэгдмэл байх ёстой хосууд: аль нэгийг нь л хэрэглэнэ.
TERM_DRIFT = [
    ("ангилал", "зэрэглэл"),
    ("ашиглалтын орчин", "продакшн"),
    ("нөөцлөлт", "бэкап"),
    ("зөрчил", "осол"),
]

ROLES = ["Хэлтсийн ахлах", "Хэлтсийн захирал", "Гүйцэтгэх захирал",
         "Инноваци технологийн хэлтэс"]


def paragraphs(path):
    return [p.text.strip() for p in Document(path).paragraphs if p.text.strip()]


def check_doc(path):
    """Нэг баримтын механик алдааг буцаана."""
    name = os.path.basename(path)
    issues = []
    paras = paragraphs(path)

    seen_top = []          # бүлэг доторх дээд түвшний заалтын дугаар
    seen_sub = defaultdict(list)

    for text in paras:
        m = CLAUSE.match(text)
        body = text[m.end():] if m else text

        # 1. Давхар зай
        if "  " in text:
            issues.append((text, "давхар зай"))

        # 2. Цэг таслалын өмнөх зай
        if re.search(r"\s+[,;.:]", text):
            issues.append((text, "цэг таслалын өмнө зай"))

        # 3. Ишлэлийн хаалт тэнцэхгүй
        if text.count("«") != text.count("»"):
            issues.append((text, "«» хаалт тэнцэхгүй"))

        # 4. Дугуй хаалт тэнцэхгүй
        if text.count("(") != text.count(")"):
            issues.append((text, "() хаалт тэнцэхгүй"))

        if not m:
            continue

        top, sub = int(m.group(1)), int(m.group(2))
        depth = int(m.group(3) or 0)

        # 5. Дээд түвшний заалт цэгээр төгсөнө
        if depth == 0 and not body.rstrip().endswith((".", ":")):
            issues.append((text, "заалт цэг, эсхүл хоёр цэгээр төгсөх ёстой"))

        # 6. Дээд түвшний заалт том үсгээр эхэлнэ
        if depth == 0 and body[:1].islower():
            issues.append((text, "заалт том үсгээр эхлэх ёстой"))

        # 7. Дугаарлалтын тасалдал
        if depth == 0:
            seen_top.append((top, sub))
        else:
            seen_sub[(top, sub)].append(depth)

        # 8а. Нэг заалт дотор ижил өгүүлбэр зэрэгцэн давтагдсан.
        #     Засварын скрипт хоёр удаа ажиллахад үүсдэг бөгөөд автомат
        #     шалгалтаар бус зөвхөн гараар уншиж илэрсэн тул нэмэв.
        sents = [x.strip() for x in re.split(r"(?<=\.)\s+", body) if x.strip()]
        for i in range(len(sents) - 1):
            if sents[i] == sents[i + 1]:
                issues.append((text, f"өгүүлбэр зэрэгцэн давтагдав: «{sents[i][:45]}…»"))

        # 8. Тоог оронгоор бичсэн (үгээр бичих ёстой)
        if re.search(r"(?<![\d.IT-])\b\d{1,3}\s+(хоног|өдөр|сар|жил|цаг|минут|удаа|хувь)", body):
            issues.append((text, "тоог үгээр бичих ёстой"))

    # 9. Дээд түвшний дугаарлалт 1-ээс эхэлж, тасалдалгүй байх
    by_chapter = defaultdict(list)
    for top, sub in seen_top:
        by_chapter[top].append(sub)
    for top, subs in by_chapter.items():
        if subs != list(range(1, len(subs) + 1)):
            issues.append((f"{top}-р бүлэг", f"заалтын дугаарлалт тасалдав: {subs}"))

    # 10. Дэд заалтын дугаарлалт 1-ээс эхэлж, тасалдалгүй байх
    for (top, sub), depths in seen_sub.items():
        if depths != list(range(1, len(depths) + 1)):
            issues.append((f"{top}.{sub}", f"дэд заалтын дугаарлалт тасалдав: {depths}"))

    # 11. Албан тушаалын нэр жижиг үсгээр
    joined = "\n".join(paras)
    for role in ROLES:
        low = role[0].lower() + role[1:]
        for mm in re.finditer(rf"(?<![.:;] )(?<!^){re.escape(low)}", joined, re.M):
            # Бүтэн албан тушаалын нэрийн дотор орсон бол зөв бичлэг:
            # «Инноваци технологийн хэлтсийн ахлах».
            if joined[max(0, mm.start() - 22):mm.start()].endswith(
                    ("Инноваци технологийн ", "Компанийн ")):
                continue
            ctx = joined[max(0, mm.start() - 40):mm.end() + 20].replace("\n", " ")
            issues.append((ctx, f"албан тушаалын нэр жижиг үсгээр: «{low}»"))

    return name, issues


def cross_document_checks(paths):
    """Баримт хооронд хамаарах шалгалт."""
    issues = []
    body_index = defaultdict(list)
    terms_defined = {}
    terms_used = defaultdict(set)

    for p in paths:
        name = os.path.basename(p)[:5]
        for text in paragraphs(p):
            m = CLAUSE.match(text)
            body = (text[m.end():] if m else text).strip()

            # Хуулбарлалтаас үүссэн ижил заалт (тогтмол хэсгээс бусад)
            if m and len(body) > 60:
                body_index[body].append(f"{name}:{m.group(0).strip()}")

            # Тодорхойлсон нэр томьёо
            dm = re.match(r"«([^»]+)» гэж ", body)
            if dm:
                terms_defined.setdefault(dm.group(1), []).append(name)

            for um in re.finditer(r"«([^»]+)»", body):
                terms_used[um.group(1)].add(name)

    # 12. Ижил заалт олон баримтад давтагдсан
    boiler = {
        "Энэхүү журмын хэрэгжилтэд Хэлтэс хяналт тавина.",
        "Энэхүү журмыг жилд нэгээс доошгүй удаа хянан шинэчилнэ.",
        "Энэхүү журам Гүйцэтгэх захирлын тушаалаар батлагдсан өдрөөс эхлэн хүчин төгөлдөр болно.",
        "Энэхүү бодлого Гүйцэтгэх захирлын тушаалаар батлагдсан өдрөөс эхлэн хүчин төгөлдөр болно.",
        "Энэхүү журамд шинээр хэрэглэсэн нэр томьёог дараах утгаар ойлгоно:",
        "Дараах үйлдлийг хориглоно:",
    }
    # Цэвэр иш татлага давтагдах нь давхардал биш: хоёр журам нэг дүрэм рүү
    # заасан нь яг л ганц эх сурвалжийг хадгалж буй хэрэг.
    # `[^.]` нь «6.5» доторх цэг дээр тасардаг байв — цэгийг зөвшөөрнө.
    is_reference = re.compile(r"IT-\d{2}.{0,120}?заасн?[ыа]")
    for body, where in body_index.items():
        if is_reference.search(body):
            continue
        if len(where) > 1 and body not in boiler and not body.startswith("Энэхүү журамд хэрэглэсэн"):
            issues.append((body[:90], f"ижил заалт {len(where)} баримтад: {', '.join(where[:4])}"))

    # 13. Хоёр удаа тодорхойлсон нэр томьёо
    for term, where in terms_defined.items():
        if len(where) > 1:
            issues.append((term, f"нэр томьёо {len(where)} удаа тодорхойлогдов: {', '.join(where)}"))

    return issues


def main():
    paths = audit.document_paths()
    total = 0

    for p in paths:
        name, issues = check_doc(p)
        if issues:
            print(f"АЛДААТАЙ {name} — {len(issues)}")
            for text, why in issues:
                print(f"    · {why}\n      {text[:110]}")
            total += len(issues)

    cross = cross_document_checks(paths)
    if cross:
        print(f"\nБАРИМТ ХООРОНД — {len(cross)}")
        for text, why in cross:
            print(f"    · {why}\n      {text[:110]}")
        total += len(cross)

    print(f"\nНийт асуудал: {total}")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
