# -*- coding: utf-8 -*-
"""38 баримтыг 17 болгон нэгтгэх — 2026-09-15.

Анхны багц ISO 27001 Annex A-гийн сэдэв бүрд нэг баримт гэж 1:1 зурсан
байв. Энэ нь аудиторт ойлгомжтой, харин компанид буруу: 38 баримтыг жил
бүр хянах, ажилтанд танилцуулах, хооронд нь зөрчилгүй байлгах боломжгүй.
ISO 27001 нь 38 баримт шаарддаггүй — заавал баримтжуулах 10 орчим зүйл,
бусад нь нэг баримтын бүлэг байж болно.

Энэ скрипт `source/batch*.py`-д хадгалагдсан 37 баримтын агуулгыг
ЗААЛТ АЛДАЛГҮЙ 16 баримтад нэгтгэнэ:
  * эх баримт бүрийн бие бүлгүүд шинэ баримтын бүлэг болно;
  * нэр томьёо нэг Нийтлэг үндэслэлд нэгдэнэ;
  * 69 иш татлага бүр шинэ дугаарт автоматаар хөрвөнө (`crossref.py`
    баталгаажуулна);
  * «энэхүү журмын» гэх өгүүлэмж шинэ баримтын төрөлд тохирно.
"""

import importlib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import builder  # noqa: E402

# ─────────────────────────────────────────────────────────────────────
# 1. Эх баримтуудыг санах ойд барих (файл бичихгүй)
# ─────────────────────────────────────────────────────────────────────
SRC = {}
_real_build = builder.build


def _capture(meta, chapters, filename):
    SRC[meta["no"]] = dict(meta=meta, chapters=chapters, filename=filename)


builder.build = _capture
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "source"))
for i in range(1, 10):
    importlib.import_module("batch%d" % i)
builder.build = _real_build
assert len(SRC) == 37, len(SRC)

# ─────────────────────────────────────────────────────────────────────
# 2. Шинэ баримтын тодорхойлолт
# ─────────────────────────────────────────────────────────────────────
# Эх баримтын товч нэр — бүлгийн нэр давхцахад угтвар болно.
LABEL = {
    "IT-03": "Хэлтэс", "IT-05": "Мэдээллийн хөрөнгө", "IT-06": "Тоног төхөөрөмж",
    "IT-07": "Лиценз", "IT-08": "Нөөц ашиглах", "IT-09": "Эрх нээх, хаах",
    "IT-10": "Сургалт", "IT-11": "Зайнаас ажиллах", "IT-12": "Нууцлал",
    "IT-13": "Хандах эрх", "IT-14": "Нууц үг", "IT-15": "Давуу эрх",
    "IT-16": "Хөгжүүлэлт", "IT-17": "Кодын стандарт", "IT-18": "Өөрчлөлт",
    "IT-19": "Туршилт", "IT-20": "Хүлээлгэн өгөх", "IT-21": "Нөөцлөлт",
    "IT-22": "Тасралтгүй ажиллагаа", "IT-23": "Лог", "IT-24": "Гэмтэл засвар",
    "IT-25": "Хүчин чадал", "IT-26": "Сүлжээ", "IT-27": "Криптограф",
    "IT-28": "Эмзэг байдал", "IT-29": "Хортой код", "IT-30": "Үүлэн үйлчилгээ",
    "IT-32": "Хадгалалт", "IT-33": "Дамжуулах", "IT-36": "Биет орчин",
}

DOCS = [
    dict(no="IT-01", kind="Бодлого", title="Мэдээллийн технологийн бодлого",
         sources=["IT-01", "IT-03"], keep_general_of="IT-01",
         filename="IT-01 Мэдээллийн технологийн бодлого.docx"),
    dict(no="IT-02", kind="Бодлого", title="Мэдээллийн аюулгүй байдлын бодлого",
         sources=["IT-02"], keep_general_of="IT-02",
         filename="IT-02 Мэдээллийн аюулгүй байдлын бодлого.docx"),
    dict(no="IT-03", kind="Журам", title="Мэдээллийн аюулгүй байдлын эрсдэлийн удирдлагын журам",
         sources=["IT-04"], keep_general_of="IT-04",
         filename="IT-03 Мэдээллийн аюулгүй байдлын эрсдэлийн удирдлагын журам.docx"),
    dict(no="IT-04", kind="Дүрэм", title="Ажилтны мэдээллийн аюулгүй байдлын дүрэм",
         sources=["IT-08", "IT-11", "IT-12", "IT-10"],
         purpose="Энэхүү дүрмийн зорилго нь Компанийн ажилтан мэдээллийн технологийн нөөц ашиглах, зайнаас ажиллах, нууц хадгалах, мэдээллийн аюулгүй байдлын сургалтад хамрагдахад дагаж мөрдөх нийтлэг шаардлагыг тогтооход оршино.",
         scope="Энэхүү дүрэм Компанийн бүх ажилтан, түүнчлэн Компанийн мэдээллийн системд хандах эрх олгогдсон гэрээт ажилтанд хамаарна.",
         filename="IT-04 Ажилтны мэдээллийн аюулгүй байдлын дүрэм.docx"),
    dict(no="IT-05", kind="Журам", title="Хандах эрх, нэвтрэлтийн удирдлагын журам",
         sources=["IT-13", "IT-09", "IT-14", "IT-15"],
         purpose="Энэхүү журмын зорилго нь Компанийн мэдээллийн системд хандах эрх олгох, өөрчлөх, хаах, нэвтрэлтийг баталгаажуулах, давуу эрхийг удирдах ажиллагааг тогтооход оршино.",
         scope="Энэхүү журам Компанийн бүх мэдээллийн систем, тэдгээрт хандах эрх бүхий ажилтан, гэрээт этгээд, гуравдагч талд хамаарна.",
         filename="IT-05 Хандах эрх, нэвтрэлтийн удирдлагын журам.docx"),
    dict(no="IT-06", kind="Журам", title="Мэдээллийн хөрөнгө, тоног төхөөрөмж, лицензийн удирдлагын журам",
         sources=["IT-05", "IT-06", "IT-07"],
         purpose="Энэхүү журмын зорилго нь Компанийн мэдээллийн хөрөнгийг бүртгэх, ангилах, эзэмшүүлэх, тоног төхөөрөмж болон программ хангамжийн лицензийг олгох, ашиглах, буцаан авах, ашиглалтаас гаргах ажиллагааг тогтооход оршино.",
         scope="Энэхүү журам Компанийн өмчлөл, ашиглалт, хяналтад байгаа бүх мэдээллийн хөрөнгө, тоног төхөөрөмж, программ хангамжид хамаарна.",
         filename="IT-06 Мэдээллийн хөрөнгө, тоног төхөөрөмж, лицензийн удирдлагын журам.docx"),
    dict(no="IT-07", kind="Журам", title="Өгөгдөл хадгалах, дамжуулах, үүлэн үйлчилгээ ашиглах журам",
         sources=["IT-32", "IT-33", "IT-30"],
         purpose="Энэхүү журмын зорилго нь Компанийн өгөгдлийг хадгалах, архивлах, устгах, дотоод болон гадагш дамжуулах, үүлэн үйлчилгээнд байршуулах ажиллагааг тогтооход оршино.",
         scope="Энэхүү журам Компанийн бүх өгөгдөл, түүнийг боловсруулдаг нэгж, ажилтан, ашигладаг үүлэн үйлчилгээнд хамаарна.",
         filename="IT-07 Өгөгдөл хадгалах, дамжуулах, үүлэн үйлчилгээ ашиглах журам.docx"),
    dict(no="IT-08", kind="Журам", title="Программ хангамж хөгжүүлэх, аюулгүй код бичих журам",
         sources=["IT-16", "IT-17"],
         purpose="Энэхүү журмын зорилго нь Компанийн программ хангамжийг хөгжүүлэх үе шат, түүнд тавигдах аюулгүй байдлын шаардлага, код бичих стандартыг тогтооход оршино.",
         scope="Энэхүү журам Компанийн захиалгаар дотооддоо болон гадны гүйцэтгэгчээр хөгжүүлж буй бүх программ хангамжид хамаарна.",
         filename="IT-08 Программ хангамж хөгжүүлэх, аюулгүй код бичих журам.docx"),
    dict(no="IT-09", kind="Журам", title="Өөрчлөлт, туршилт, ашиглалтад хүлээлгэн өгөх журам",
         sources=["IT-18", "IT-19", "IT-20"],
         purpose="Энэхүү журмын зорилго нь мэдээллийн системд өөрчлөлт оруулах, туршилт хийж чанарыг баталгаажуулах, системийг ашиглалтад хүлээлгэн өгөх ажиллагааг тогтооход оршино.",
         scope="Энэхүү журам Компанийн ашиглалтын орчинд оруулах бүх өөрчлөлт, шинээр нэвтрүүлэх бүх системд хамаарна.",
         filename="IT-09 Өөрчлөлт, туршилт, ашиглалтад хүлээлгэн өгөх журам.docx"),
    dict(no="IT-10", kind="Журам", title="Дэд бүтцийн ажиллагаа, биет орчны журам",
         sources=["IT-23", "IT-24", "IT-25", "IT-36"],
         purpose="Энэхүү журмын зорилго нь мэдээллийн системийн лог бүртгэл, үйлчилгээний хүсэлт, гэмтэл засвар, хүчин чадлын төлөвлөлт, биет орчны хамгаалалтын ажиллагааг тогтооход оршино.",
         scope="Энэхүү журам Компанийн бүх мэдээллийн систем, дэд бүтэц, серверийн байр, ажлын байранд хамаарна.",
         filename="IT-10 Дэд бүтцийн ажиллагаа, биет орчны журам.docx"),
    dict(no="IT-11", kind="Журам", title="Дэд бүтцийн хамгаалалтын журам",
         sources=["IT-26", "IT-27", "IT-28", "IT-29"],
         purpose="Энэхүү журмын зорилго нь сүлжээний аюулгүй байдал, криптограф ба түлхүүрийн удирдлага, эмзэг байдлын засвар, хортой кодоос хамгаалах ажиллагааг тогтооход оршино.",
         scope="Энэхүү журам Компанийн бүх сүлжээ, сервер, ажлын станц, мэдээллийн систем, тэдгээрийг хариуцан ажиллуулагч ажилтанд хамаарна.",
         filename="IT-11 Дэд бүтцийн хамгаалалтын журам.docx"),
    dict(no="IT-12", kind="Журам", title="Нөөцлөлт, тасралтгүй ажиллагааны журам",
         sources=["IT-21", "IT-22"],
         purpose="Энэхүү журмын зорилго нь мэдээллийг нөөцлөх, сэргээх, түүнчлэн гамшиг, томоохон тасалдлын үед Компанийн эгзэгтэй үйл ажиллагааг сэргээх дарааллыг тогтооход оршино.",
         scope="Энэхүү журам Компанийн бүх мэдээллийн систем, өгөгдөл, эгзэгтэй үйл ажиллагаанд хамаарна.",
         filename="IT-12 Нөөцлөлт, тасралтгүй ажиллагааны журам.docx"),
    dict(no="IT-13", kind="Журам", title="Хувийн мэдээлэл хамгаалах журам",
         sources=["IT-31"], keep_general_of="IT-31",
         filename="IT-13 Хувийн мэдээлэл хамгаалах журам.docx"),
    dict(no="IT-14", kind="Журам", title="Мэдээллийн аюулгүй байдлын зөрчлийг шийдвэрлэх журам",
         sources=["IT-34"], keep_general_of="IT-34",
         filename="IT-14 Мэдээллийн аюулгүй байдлын зөрчлийг шийдвэрлэх журам.docx"),
    dict(no="IT-15", kind="Журам", title="Ханган нийлүүлэгч, гуравдагч талын удирдлагын журам",
         sources=["IT-35"], keep_general_of="IT-35",
         filename="IT-15 Ханган нийлүүлэгч, гуравдагч талын удирдлагын журам.docx"),
    dict(no="IT-16", kind="Журам", title="Дотоод хяналт, нийцлийн шалгалтын журам",
         sources=["IT-37"], keep_general_of="IT-37",
         filename="IT-16 Дотоод хяналт, нийцлийн шалгалтын журам.docx"),
]

NEW_OF = {}          # old no → new no
for d in DOCS:
    for s in d["sources"]:
        NEW_OF[s] = d["no"]
NEW_OF["IT-00"] = "IT-00"
assert len(NEW_OF) == 38
TITLE_OF = {d["no"]: d["title"] for d in DOCS}
TITLE_OF["IT-00"] = "Мэдээллийн технологийн бодлого, журмын бүртгэл"
KIND_OF = {d["no"]: d["kind"] for d in DOCS}
KIND_OF["IT-00"] = "Бүртгэл"

# ─────────────────────────────────────────────────────────────────────
# 3. Хэлний туслах — төрлийн үгийн тийн ялгал, дагаврын нийцэл
# ─────────────────────────────────────────────────────────────────────
DECL = {  # nom, gen, acc, dat, ins, com
    "Журам": ("журам", "журмын", "журмыг", "журамд", "журмаар", "журамтай"),
    "Бодлого": ("бодлого", "бодлогын", "бодлогыг", "бодлогод", "бодлогоор", "бодлоготой"),
    "Дүрэм": ("дүрэм", "дүрмийн", "дүрмийг", "дүрэмд", "дүрмээр", "дүрэмтэй"),
    "Стандарт": ("стандарт", "стандартын", "стандартыг", "стандартад", "стандартаар", "стандарттай"),
    "Бүртгэл": ("бүртгэл", "бүртгэлийн", "бүртгэлийг", "бүртгэлд", "бүртгэлээр", "бүртгэлтэй"),
}
CASES = ("nom", "gen", "acc", "dat", "ins", "com")
# Аль ч төрлийн үг → тийн ялгал
FORM_TO_CASE = {}
for forms in DECL.values():
    for case, f in zip(CASES, forms):
        FORM_TO_CASE[f] = case
# «…»-ын гэх дагавар → тийн ялгал, ба төрөл бүрийн зөв дагавар
SUFFIX_TO_CASE = {"ын": "gen", "ийн": "gen", "ыг": "acc", "ийг": "acc", "аар": "ins",
                  "ээр": "ins", "оор": "ins", "д": "dat", "т": "dat", "тай": "com", "тэй": "com"}
SUFFIX_FOR = {
    "Журам": {"gen": "ын", "acc": "ыг", "ins": "аар", "dat": "д", "com": "тай"},
    "Бодлого": {"gen": "ын", "acc": "ыг", "ins": "оор", "dat": "д", "com": "той"},
    "Дүрэм": {"gen": "ийн", "acc": "ийг", "ins": "ээр", "dat": "д", "com": "тэй"},
    "Бүртгэл": {"gen": "ийн", "acc": "ийг", "ins": "ээр", "dat": "д", "com": "тэй"},
}


def kind_form(kind, case):
    return DECL[kind][CASES.index(case)]


# ─────────────────────────────────────────────────────────────────────
# 4. Эх заалтын дугаарлалт (builder-тэй яг ижил дүрмээр)
# ─────────────────────────────────────────────────────────────────────
def numbered(chapters):
    """[(ci, n, k_or_None, item)] — эх баримт дахь заалт бүрийн дугаар."""
    out = []
    for ci, (_, clauses) in enumerate(chapters, start=1):
        n = 0
        for cl in clauses:
            if isinstance(cl, tuple) and cl[0] == "sub":
                out.append((ci, n, cl[1], cl))
            elif isinstance(cl, tuple) and cl[0] == "note":
                out.append((ci, n, None, cl))
            else:
                n += 1
                out.append((ci, n, None, cl))
    return out


STANDARD_FINAL = [
    re.compile(r"хэрэгжилтэд Хэлтэс хяналт тавина\.$"),
    re.compile(r"жилд нэгээс доошгүй удаа.*хянан шинэчилнэ\.$"),
    re.compile(r"тушаалаар батлагдсан өдрөөс эхлэн хүчин төгөлдөр болно\.$"),
]
TERMS_REF = re.compile(r"1\.5-д заасан утгаар ойлгоно")
TERMS_HEAD = re.compile(r"нэр томьёог дараах утгаар ойлгоно:$")


def is_standard_final(text):
    return isinstance(text, str) and any(p.search(text) for p in STANDARD_FINAL)


# ─────────────────────────────────────────────────────────────────────
# 5. Нэгтгэх
# ─────────────────────────────────────────────────────────────────────
MAP = {}   # (old_no, "N.M" | "N.M.K") → (new_no, "N.M" | "N.M.K")


def record(old_no, oci, on, ok, new_no, nci, nn, nk):
    if ok is None:
        MAP[(old_no, f"{oci}.{on}")] = (new_no, f"{nci}.{nn}")
    else:
        MAP[(old_no, f"{oci}.{on}.{ok}")] = (new_no, f"{nci}.{nn}.{nk}")


def split_general(chapters):
    """Эх баримтын Нийтлэг үндэслэлээс: нэр томьёоны дэд заалт, бусад."""
    _, clauses = chapters[0]
    terms, rest, in_terms = [], [], False
    for cl in clauses:
        s = cl if isinstance(cl, str) else None
        if s and TERMS_HEAD.search(s):
            in_terms = True
            continue
        if in_terms and isinstance(cl, tuple) and cl[0] == "sub":
            terms.append(cl[2])
            continue
        in_terms = False
        if s and (("зорилго нь" in s) or ("хамаарна." in s) or ("нэгэн адил үйлчилнэ" in s)
                  or ("дагаж мөрдөнө." in s) or TERMS_REF.search(s)):
            continue
        rest.append(cl)
    return terms, rest


def norm_terms(terms):
    """Дэд заалтын төгсгөлийг нэгтгэнэ: дунд «;», сүүлд « ойлгоно.»."""
    out = []
    for t in terms:
        t = re.sub(r"\s*ойлгоно\.\s*$", "", t).rstrip(";").rstrip(".").rstrip()
        out.append(t)
    return [t + ";" for t in out[:-1]] + [out[-1] + " ойлгоно."] if out else []


def assemble(spec):
    """Шинэ баримтын бүлгүүдийг эх баримтуудаас угсарна; MAP-ыг бөглөнө.

    Буцаах: (chapters, origin) — origin[i] нь i-р бүлгийн эх баримтын дугаар.
    """
    new_no, kind = spec["no"], spec["kind"]
    keep = spec.get("keep_general_of")
    chapters, origin = [], []

    # ── Нийтлэг үндэслэл ──
    if keep:
        src = SRC[keep]
        gen_title, gen_clauses = src["chapters"][0]
        gen = list(gen_clauses)
        extra_terms = []
        for s in spec["sources"]:
            if s != keep:
                extra_terms += split_general(SRC[s]["chapters"])[0]
        if extra_terms:
            for i, cl in enumerate(gen):
                if isinstance(cl, str) and TERMS_HEAD.search(cl):
                    j = i + 1
                    while j < len(gen) and isinstance(gen[j], tuple) and gen[j][0] == "sub":
                        j += 1
                    existing = [gen[x][2] for x in range(i + 1, j)]
                    gen[i + 1:j] = [("sub", k, tt) for k, tt in enumerate(norm_terms(existing + extra_terms), start=1)]
                    break
        chapters.append((gen_title, gen)); origin.append(keep)
        on = 0
        for c in gen_clauses:
            if isinstance(c, tuple) and c[0] == "sub":
                record(keep, 1, on, c[1], new_no, 1, on, c[1]); continue
            if isinstance(c, tuple):
                continue
            on += 1
            record(keep, 1, on, None, new_no, 1, on, None)
    else:
        all_terms, leftovers = [], []
        for s in spec["sources"]:
            terms, rest = split_general(SRC[s]["chapters"])
            all_terms += terms
            leftovers += rest
        seen, uniq = set(), []
        for tt in all_terms:
            m = re.match(r"«([^»]+)»", tt)
            key = m.group(1).lower() if m else tt
            if key in seen:
                continue
            seen.add(key); uniq.append(tt)
        gen = [spec["purpose"], spec["scope"],
               f"Энэхүү {kind_form(kind, 'dat')} хэрэглэсэн «Компани», «Хэлтэс», «Хэлтсийн захирал», "
               f"«Хэлтсийн ахлах», «Хэрэглэгч» зэрэг нэр томьёог IT-01 «Мэдээллийн технологийн бодлого»-ын "
               f"1.5-д заасан утгаар ойлгоно."]
        if uniq:
            gen.append(f"Энэхүү {kind_form(kind, 'dat')} шинээр хэрэглэсэн нэр томьёог дараах утгаар ойлгоно:")
            gen += [("sub", k, tt) for k, tt in enumerate(norm_terms(uniq), start=1)]
        gen += leftovers
        chapters.append(("Нийтлэг үндэслэл", gen)); origin.append(spec["sources"][0])

    # ── Бие бүлгүүдийн дараалал ──
    # (src, oci, strip_standard) гурвалууд. IT-01 онцгой: өөрийн 2–5-р
    # бүлэг, дараа нь IT-03-ын бие, дараа нь өөрийн 6–7 (хэвээр).
    plan = []
    if new_no == "IT-01":
        n1 = len(SRC["IT-01"]["chapters"])
        plan += [("IT-01", ci, False) for ci in range(2, n1 - 1)]
        n3 = len(SRC["IT-03"]["chapters"])
        plan += [("IT-03", ci, ci == n3) for ci in range(2, n3 + 1)]
        plan += [("IT-01", ci, False) for ci in range(n1 - 1, n1 + 1)]
    else:
        for s in spec["sources"]:
            n = len(SRC[s]["chapters"])
            plan += [(s, ci, ci == n) for ci in range(2, n + 1)]

    used_titles = {chapters[0][0]}
    for s, oci, strip in plan:
        title, clauses = SRC[s]["chapters"][oci - 1]
        body = [c for c in clauses if not (strip and is_standard_final(c))]
        if strip and not any(isinstance(c, str) for c in body):
            on = 0
            for c in clauses:
                if isinstance(c, str):
                    on += 1
                    MAP[(s, f"{oci}.{on}")] = (new_no, "__FINAL__")
            continue
        t = title
        if strip:
            # Стандарт «хянан шинэчлэх» заалт нь шинэ эцсийн бүлэгт очсон;
            # үлдсэн заалт нь хяналт/хариуцлагынх тул нэр нь тэгж хэлнэ.
            t = re.sub(r",?\s*хянан шинэчлэх", "", t).strip() or "Хяналт"
        # Нэгтгэсэн баримтад бүлгийн нэр эх сэдвээ хэлдэг байх ёстой:
        # «Бүртгэл», «Холболт», «Хяналт» гэх нэр дангаараа юуг хэлэхээ
        # алддаг. Сэдвийн үг нэрэнд аль хэдийн байвал угтвар тавихгүй.
        if len(spec["sources"]) > 1 and s in LABEL:
            stem = LABEL[s].split()[0].lower()[:4]
            if stem not in t.lower():
                t = f"{LABEL[s]} — {t}"
        if t in used_titles:
            t = f"{t} ({s})"
        used_titles.add(t)
        nci = len(chapters) + 1
        chapters.append((t, body)); origin.append(s)
        on = nn = 0
        for c in clauses:
            if isinstance(c, tuple) and c[0] == "sub":
                record(s, oci, on, c[1], new_no, nci, nn, c[1]); continue
            if isinstance(c, tuple):
                continue
            on += 1
            if strip and is_standard_final(c):
                MAP[(s, f"{oci}.{on}")] = (new_no, "__FINAL__"); continue
            nn += 1
            record(s, oci, on, None, new_no, nci, nn, None)

    # ── Эцсийн бүлэг ──
    if new_no != "IT-01":
        chapters.append(("Хяналт, хянан шинэчлэх", [
            f"Энэхүү {kind_form(kind, 'gen')} хэрэгжилтэд Хэлтэс хяналт тавина.",
            f"Энэхүү {kind_form(kind, 'acc')} жилд нэгээс доошгүй удаа хянан шинэчилнэ.",
            f"Энэхүү {kind_form(kind, 'nom')} Гүйцэтгэх захирлын тушаалаар батлагдсан өдрөөс эхлэн хүчин төгөлдөр болно.",
        ])); origin.append(spec["sources"][0])
        fci = len(chapters)
        final_target = f"{fci}.1"
    else:
        # IT-03-ын стандарт заалт → IT-01-ийн өөрийн эцсийн бүлгийн 1-р заалт
        fci = len(chapters)
        final_target = f"{fci}.1"
    for k, v in list(MAP.items()):
        if v == (new_no, "__FINAL__"):
            MAP[k] = (new_no, final_target)
    assert len(chapters) == len(origin)
    return chapters, origin


# ─────────────────────────────────────────────────────────────────────
# 6. Иш татлагыг шинэ дугаарт хөрвүүлэх
# ─────────────────────────────────────────────────────────────────────
CITE = re.compile(
    r"IT-(\d{2}) «[^»]+»"
    r"(?:-(?P<suf>тай|тэй|аар|ээр|оор|ийн|ийг|ын|ыг|д|т))?"
    r"(?P<num>\s+(?P<a>\d+\.\d+(?:\.\d+)?)(?:\s*[-–]\s*(?P<b>\d+\.\d+(?:\.\d+)?))?-?(?P<dt>[дт]))?")
CITE_SHORT = re.compile(r"IT-01 бодлогын (?P<a>\d+\.\d+)(?:\s*[-–]\s*(?P<b>\d+\.\d+))?-(?P<dt>[дт])")
SELF = re.compile(
    r"(?P<lead>[Ээ]нэхүү) (?P<w>журмын|бодлогын|стандартын|дүрмийн) "
    r"(?P<a>\d+\.\d+(?:\.\d+)?)(?:\s*[-–]\s*(?P<b>\d+\.\d+(?:\.\d+)?))?-?(?P<dt>[дт])")
KINDWORD = re.compile(r"(?P<lead>[Ээ]нэхүү) (?P<w>журам|журмын|журмыг|журамд|журмаар|журамтай|"
                      r"бодлого|бодлогын|бодлогыг|бодлогод|бодлогоор|бодлоготой|"
                      r"стандарт|стандартын|стандартыг|стандартад|стандартаар|стандарттай|"
                      r"дүрэм|дүрмийн|дүрмийг|дүрэмд|дүрмээр|дүрэмтэй)\b")

UNRESOLVED = []


def remap(old_no, num):
    hit = MAP.get((old_no, num))
    if hit is None:
        # дэд заалт заасан бол эцэг заалтаар оролдоно
        parts = num.split(".")
        if len(parts) == 3:
            hit = MAP.get((old_no, ".".join(parts[:2])))
            if hit:
                return hit[0], hit[1] + "." + parts[2]
        UNRESOLVED.append((old_no, num))
        return NEW_OF.get(old_no, old_no), num
    return hit


def rewrite(text, src_no, cur_new_no):
    """Нэг заалтын текст дэх бүх иш татлагыг шинэ дугаарлалтад хөрвүүлнэ."""
    cur_kind = KIND_OF[cur_new_no]

    def cite_repl(m):
        old = "IT-" + m.group(1)
        suf = m.group("suf")
        if m.group("num"):
            tgt_no, a = remap(old, m.group("a"))
            b = None
            if m.group("b"):
                _, b = remap(old, m.group("b"))
            nums = a + ("-" + b if b else "") + "-" + m.group("dt")
        else:
            tgt_no, nums = NEW_OF.get(old, old), None
        case = SUFFIX_TO_CASE.get(suf) if suf else None
        if tgt_no == cur_new_no:
            # дотоод иш татлага
            word = kind_form(cur_kind, case or "gen")
            return "энэхүү " + word + (" " + nums if nums else "")
        title = TITLE_OF[tgt_no]
        tkind = KIND_OF[tgt_no]
        newsuf = "-" + SUFFIX_FOR[tkind][case] if case else ""
        return f"{tgt_no} «{title}»{newsuf}" + (" " + nums if nums else "")

    def short_repl(m):
        tgt_no, a = remap("IT-01", m.group("a"))
        nums = a
        if m.group("b"):
            _, b = remap("IT-01", m.group("b"))
            nums = a + "-" + b
        if tgt_no == cur_new_no:
            return f"энэхүү {kind_form(cur_kind, 'gen')} {nums}-{m.group('dt')}"
        return f"IT-01 бодлогын {nums}-{m.group('dt')}"

    def self_repl(m):
        tgt_no, a = remap(src_no, m.group("a"))
        b = None
        if m.group("b"):
            _, b = remap(src_no, m.group("b"))
        nums = a + ("-" + b if b else "") + "-" + m.group("dt")
        if tgt_no == cur_new_no:
            return f"{m.group('lead')} {kind_form(cur_kind, 'gen')} {nums}"
        return f"{tgt_no.replace('-', chr(0x2011))} «{TITLE_OF[tgt_no]}»-{SUFFIX_FOR[KIND_OF[tgt_no]]['gen']} {nums}"

    def kind_repl(m):
        case = FORM_TO_CASE[m.group("w")]
        return f"{m.group('lead')} {kind_form(cur_kind, case)}"

    # Дараалал чухал: өөрийн иш татлагыг ЭХЛЭЭД хөрвүүлнэ (эх дугаараар),
    # түүний гаргасан «IT‑NN» (тасрахгүй зураастай) хэлбэрийг CITE дахин
    # барихгүй; төгсгөлд нь энгийн зураас болгоно.
    text = SELF.sub(self_repl, text)
    text = CITE.sub(cite_repl, text)
    text = CITE_SHORT.sub(short_repl, text)
    text = KINDWORD.sub(kind_repl, text)
    text = text.replace("IT-02-оос IT-37 хүртэлх", "IT-02-оос IT-16 хүртэлх")
    return text.replace("\u2011", "-")


def rewrite_all(chapters, origin, new_no):
    """origin: [(chapter_index → source no)] — бүлэг бүрийн эх баримт."""
    out = []
    for ci, (title, clauses) in enumerate(chapters):
        src_no = origin[ci]
        new_clauses = []
        for c in clauses:
            if isinstance(c, str):
                new_clauses.append(rewrite(c, src_no, new_no))
            elif c[0] == "sub":
                new_clauses.append(("sub", c[1], rewrite(c[2], src_no, new_no)))
            else:
                new_clauses.append(("note", rewrite(c[1], src_no, new_no)))
        out.append((title, dedupe_subs(new_clauses)))
    return out


def dedupe_subs(clauses):
    """Нэг удиртгал заалтын дэд заалтууд нэгтгэлтийн дараа ижил болвол
    (хоёр хуучин баримт нэг шинэ баримт болсон) нэгийг үлдээж дахин
    дугаарлана; сүүлчийнх нь цэгээр төгсөх дүрмийг хадгална."""
    out, group = [], []

    def flush():
        if not group:
            return
        seen, kept = set(), []
        for _, _, text in group:
            key = text.rstrip(";.").strip().lower()
            if key in seen:
                continue
            seen.add(key)
            kept.append(text)
        if len(kept) != len(group):
            kept = [k.rstrip(";.") + ";" for k in kept[:-1]] + [kept[-1].rstrip(";.") + "."]
        out.extend(("sub", i, k) for i, k in enumerate(kept, start=1))
        group.clear()

    for c in clauses:
        if isinstance(c, tuple) and c[0] == "sub":
            group.append(c)
            continue
        flush()
        out.append(c)
    flush()
    return out


# ─────────────────────────────────────────────────────────────────────
# 7. Ажиллуулах
# ─────────────────────────────────────────────────────────────────────
def main():
    built = []
    for spec in DOCS:
        chapters, origin = assemble(spec)
        built.append((spec, chapters, origin))

    total = 0
    for spec, chapters, origin in built:
        chapters = rewrite_all(chapters, origin, spec["no"])
        meta = dict(no=spec["no"], kind=spec["kind"], title=spec["title"],
                    owner=builder.HEAD, approver=builder.CEO,
                    review="Жилд нэгээс доошгүй удаа")
        builder.build(meta=meta, chapters=chapters, filename=spec["filename"])
        n = sum(1 for _, cl in chapters for c in cl if isinstance(c, str))
        total += n
        print(f"{spec['no']}  бүлэг {len(chapters):2}  заалт {n:3}  {spec['title']}")
    print(f"Нийт {len(built)} баримт, {total} заалт.")
    if UNRESOLVED:
        print("ШИЙДЭГДЭЭГҮЙ ИШ ТАТЛАГА:")
        for u in sorted(set(UNRESOLVED)):
            print("  ", u)
        sys.exit(1)


if __name__ == "__main__":
    main()
