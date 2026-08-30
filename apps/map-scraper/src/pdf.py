from __future__ import annotations

import re
from pathlib import Path

from pypdf import PdfReader

from .models import SourceSchool

# pypdf's layout extraction preserves the fixed-width columns in schools.pdf.
NAME_START = 40
ADDRESS_START = 145
CONTACT_START = 248

TAIL_COLUMNS = 11


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _layout_text(page: object) -> str:
    try:
        return page.extract_text(extraction_mode="layout") or ""  # type: ignore[attr-defined]
    except TypeError:
        return page.extract_text() or ""  # type: ignore[attr-defined]


def _parse_row(line: str) -> SourceSchool | None:
    parts = line.split()
    if len(parts) < 4 or not parts[0].isdigit() or not parts[1].isdigit() or not parts[2].isdigit():
        return None

    province_index = line.find("Southern")
    if province_index < 0:
        return None

    columns = re.split(r"\s{2,}", line[province_index:].strip())
    if len(columns) < TAIL_COLUMNS:
        return None

    province, district, zone, division, medium, sex, government_type, school_category, grade_span, difficulty, total = columns[:TAIL_COLUMNS]
    if district.casefold() != "galle":
        return None
    if province.casefold() != "southern":
        return None
    if sex == "Boys School with Girls in Primary or A/L":
        sex = "Mixed"
    if sex not in {"Male", "Female", "Mixed"}:
        return None
    if government_type not in {"National", "Provincial"}:
        return None
    if not total.isdigit():
        return None

    prefix = line[:province_index].strip()
    fields = re.split(r"\s{3,}", prefix)
    if len(fields) >= 4:
        name = _clean(fields[3])
        address = _clean(fields[4]) if len(fields) >= 5 else ""
        contact = _clean(" ".join(fields[5:])) if len(fields) >= 6 else ""
    else:
        name = _clean(line[NAME_START:ADDRESS_START])
        address = _clean(line[ADDRESS_START:CONTACT_START])
        contact = _clean(line[CONTACT_START:province_index])
    if not name:
        return None

    return SourceSchool(
        sequence=int(parts[0]),
        school_id=parts[1],
        census_no=int(parts[2]),
        name=name,
        address=address,
        contact=contact,
        province=province,
        district=district,
        zone=zone,
        division=division,
        medium=medium,
        sex=sex,
        government_type=government_type,
        school_category=school_category,
        grade_span=grade_span,
        difficulty=difficulty,
        total_students=int(total),
    )


def parse_galle_schools(pdf_path: Path) -> list[SourceSchool]:
    """Extract every Southern/Galle row from the 2018 government-school PDF."""
    reader = PdfReader(str(pdf_path))
    schools: list[SourceSchool] = []
    seen_ids: set[str] = set()

    for page in reader.pages:
        for line in _layout_text(page).splitlines():
            school = _parse_row(line)
            if school is None or school.school_id in seen_ids:
                continue
            seen_ids.add(school.school_id)
            schools.append(school)

    schools.sort(key=lambda school: school.sequence)
    if not schools:
        raise ValueError(f"No Galle schools found in {pdf_path}")
    return schools


def display_name(source_name: str) -> str:
    """Turn the PDF's uppercase school name into a readable English label."""
    name = _clean(source_name).title()
    name = re.sub(r"\bSt\.", "St. ", name)
    name = re.sub(r"\bDr\.", "Dr. ", name)
    name = re.sub(r"\bMr\.", "Mr. ", name)
    name = re.sub(r"\bMrs\.", "Mrs. ", name)
    name = re.sub(r"([A-Za-z])'S\b", r"\1's", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def slugify(value: str) -> str:
    value = value.casefold().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "school"


def district_id(value: str) -> str:
    return slugify(value)


def division_id(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()
    aliases = {
        "galle": "galle-fg",
        "divitura welivitiya": "welivitiya",
        "welivitiya divithura": "welivitiya",
        "welivitiya divitura": "welivitiya",
    }
    return aliases.get(normalized, slugify(value))
