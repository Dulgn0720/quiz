# -*- coding: utf-8 -*-
"""Баримт хоорондын иш татлагыг шалгах.

`audit.py` нь иш татсан баримтын ДУГААР бүртгэлд байгаа эсэхийг шалгадаг
боловч иш татсан ЗААЛТ бодитоор байгаа эсэхийг шалгадаггүй. Байхгүй
заалт руу заасан иш татлага нь уншигчийг хаана ч хүргэхгүй бөгөөд
баримтыг найдваргүй болгоно.

Шалгах хэлбэрүүд:
    IT-21 «…»-ын 6.1-6.7-д
    IT-02 «…»-ын 7.2-т
    IT-01 бодлогын 1.5-д
    энэхүү журмын 3.1-д
"""

import os
import re
import sys

from docx import Document

import audit

CLAUSE_LINE = re.compile(r"^(\d+)\.(\d+)\.(?:(\d+)\.)?\s")

# IT-NN … 1.2-д / 1.2-1.7-д / 1.2, 1.3-т
REF = re.compile(
    r"(IT-\d{2}|энэхүү (?:журм|бодлого|стандарт|дүрм)\w*)"
    r"[^.;:]{0,90}?"
    r"(\d+\.\d+)(?:\s*[-–]\s*(\d+\.\d+))?"
    r"-?[дт]"
)


def clauses_of(path):
    """Баримт дахь бүх заалтын дугаарыг цуглуулна."""
    found = set()
    for p in Document(path).paragraphs:
        m = CLAUSE_LINE.match(p.text.strip())
        if m:
            found.add(f"{m.group(1)}.{m.group(2)}")
            if m.group(3):
                found.add(f"{m.group(1)}.{m.group(2)}.{m.group(3)}")
    return found


# Мужийн ХОЁУЛАНГ нь барина. Эхний хувилбар «8.3-8.5-д» гэснээс зөвхөн
# сүүлчийнхийг нь уншиж, IT-34 → IT-31 → IT-34 тойргийг алдсан.
RANGE_REF = re.compile(
    r"IT-(\d{2})[^»]{0,90}?»?[^\d]{0,12}(\d+)\.(\d+)(?:\s*[-–]\s*(\d+)\.(\d+))?")


def reference_graph(paths):
    """Заалт хоорондын иш татлагын граф."""
    edges = {}
    for p in paths:
        no = os.path.basename(p)[:5]
        for para in Document(p).paragraphs:
            text = para.text.strip()
            m = re.match(r"^(\d+\.\d+)\.\s", text)
            if not m:
                continue
            for r in RANGE_REF.finditer(text):
                tgt = f"IT-{r.group(1)}"
                a = int(r.group(3))
                b = int(r.group(5)) if r.group(5) else a
                for k in range(a, b + 1):
                    edges.setdefault((no, m.group(1)), set()).add(
                        (tgt, f"{r.group(2)}.{k}"))
    return edges


def find_cycles(edges):
    """A → B → A хэлбэрийн тойрог. Уншигчийг хаана ч хүргэдэггүй."""
    out = []
    for (a, ac), tgts in sorted(edges.items()):
        for (b, bc) in tgts:
            for (c, cc) in edges.get((b, bc), set()):
                if c == a:
                    out.append((a, ac, b, bc, cc))
    return out


def main():
    paths = audit.document_paths()
    by_no = {}
    for p in paths:
        no = os.path.basename(p)[:5]
        by_no[no] = p

    clause_cache = {no: clauses_of(p) for no, p in by_no.items()}

    problems = 0
    checked = 0
    for no, path in sorted(by_no.items()):
        own = clause_cache[no]
        for para in Document(path).paragraphs:
            text = para.text.strip()
            for m in REF.finditer(text):
                target_raw, first, last = m.group(1), m.group(2), m.group(3)
                target = target_raw if target_raw.startswith("IT-") else no

                if target not in clause_cache:
                    print(f"{no}: бүртгэлд байхгүй баримт руу иш татав — {target}")
                    problems += 1
                    continue

                for ref in filter(None, (first, last)):
                    checked += 1
                    if ref not in clause_cache[target]:
                        where = "өөрийн" if target == no else target
                        print(f"{no}: {where} баримтад {ref} заалт байхгүй")
                        print(f"     {text[:100]}")
                        problems += 1

    cycles = find_cycles(reference_graph(paths))
    for a, ac, b, bc, cc in cycles:
        print(f"ТОЙРОГ ИШ ТАТЛАГА: {a} {ac} → {b} {bc} → {a} {cc}")
        problems += 1

    print(f"\nШалгасан иш татлага: {checked}. Тойрог: {len(cycles)}. "
          f"Асуудал: {problems}.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
