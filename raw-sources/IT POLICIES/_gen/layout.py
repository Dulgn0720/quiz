# -*- coding: utf-8 -*-
"""Хуудасны байрлалын шалгалт.

Текстийн шалгалт баримтын АГУУЛГЫГ хардаг. Энэ нь ХЭВЛЭГДСЭН ХЭЛБЭРИЙГ
хардаг — бүлгийн гарчиг хуудасны төгсгөлд ганцаараа үлдсэн, удиртгал
заалт дэд заалтуудаасаа тасарсан, эсхүл сүүлийн хуудсанд ганц мөр
үлдсэн зэрэг нь зөвхөн рендерлэж байж илэрдэг.

LibreOffice болон pdftotext шаардана.
"""

import glob
import os
import re
import shutil
import subprocess
import sys
import tempfile

import audit

CHAPTER = re.compile(
    r"^(Нэг|Хоёр|Гурав|Дөрөв|Тав|Зургаа|Долоо|Найм|Ес|Арав)\.\s")


def render(paths, workdir):
    for p in paths:
        shutil.copy(p, os.path.join(workdir, os.path.basename(p)[:5] + ".docx"))
    subprocess.run(
        ["soffice", "--headless", "--convert-to", "pdf"] +
        sorted(glob.glob(os.path.join(workdir, "*.docx"))),
        cwd=workdir, capture_output=True)
    return sorted(glob.glob(os.path.join(workdir, "*.pdf")))


def page_lines(pdf, page):
    out = subprocess.run(
        ["pdftotext", "-f", str(page), "-l", str(page), pdf, "-"],
        capture_output=True, text=True).stdout
    lines = [x.strip() for x in out.split("\n") if x.strip()]
    # Хөлийн мөрийг хасна.
    return [x for x in lines if not (x.startswith("IT-") and "·" in x)]


def main():
    paths = audit.document_paths()
    issues = []
    with tempfile.TemporaryDirectory() as tmp:
        pdfs = render(paths, tmp)
        if len(pdfs) != len(paths):
            print(f"Рендер бүтсэнгүй: {len(pdfs)} / {len(paths)}")
            return 1

        for pdf in pdfs:
            name = os.path.basename(pdf)[:-4]
            info = subprocess.run(["pdfinfo", pdf], capture_output=True,
                                  text=True).stdout
            total = int(info.split("Pages:")[1].split()[0])

            for pg in range(1, total + 1):
                lines = page_lines(pdf, pg)
                if not lines:
                    issues.append((name, pg, "хоосон хуудас"))
                    continue

                if CHAPTER.match(lines[-1]):
                    issues.append((name, pg, f"өнчин гарчиг: {lines[-1][:55]}"))
                elif lines[-1].endswith(":"):
                    issues.append((name, pg,
                                   f"удиртгал заалт тасарсан: {lines[-1][:55]}"))

                if pg == total and len(lines) < 4:
                    issues.append((name, pg,
                                   f"сүүлийн хуудсанд {len(lines)} мөр үлдсэн"))

    if issues:
        print(f"Хуудасны байрлалын асуудал — {len(issues)}")
        for name, pg, why in issues:
            print(f"    {name} х.{pg}: {why}")
    else:
        print(f"Хуудасны байрлал цэвэр — {len(paths)} баримт шалгав.")
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
