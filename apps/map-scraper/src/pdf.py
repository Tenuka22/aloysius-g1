from __future__ import annotations

import csv
import re
from pathlib import Path

from .models import SourceSchool

# schools.csv is the formatted conversion of the 2018 "List of Government
# Schools" PDF (island-wide, one row per school).  The raw fixed-width text
# extraction (schools.txt) it was made from is deleted; the one-time converter
# lives in apps/map-scraper/convert_schools_csv.py.
DEFAULT_CSV_NAME = "schools.csv"

# The listing writes these two sex values out in full; downstream code only
# understands Male/Female/Mixed (both variants are mixed-sex schools).
_SEX_ALIASES = {
    "Girls Schools with boys in Primary or A/L": "Mixed",
    "Boys School with Girls in Primary or A/L": "Mixed",
}


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _parse_row(row: dict[str, str], line_no: int) -> SourceSchool:
    try:
        school = SourceSchool(
            sequence=int(row["seq_no"]),
            school_id=row["school_id"],
            census_no=int(row["census_no"]),
            name=_clean(row["name"]),
            address=_clean(row["address"]),
            contact=_clean(row["tel"]),
            province=row["province"],
            district=row["district"],
            zone=row["zone"],
            division=row["division"],
            medium=row["medium"],
            sex=_SEX_ALIASES.get(row["sex"], row["sex"]),
            government_type=row["government_type"],
            school_category=row["school_category"],
            grade_span=row["grade_span"],
            difficulty=row["difficulty"],
            total_students=int(row["total_students"]),
        )
    except (KeyError, ValueError) as exc:
        raise ValueError(f"schools.csv line {line_no}: bad row ({exc})") from exc
    if not school.name:
        raise ValueError(f"schools.csv line {line_no}: empty name")
    if not school.school_id:
        raise ValueError(f"schools.csv line {line_no}: empty school_id")
    return school


def load_schools(
    source_path: Path,
    *,
    district: str | None = "Galle",
) -> list[SourceSchool]:
    """Read the formatted school listing.

    ``district=None`` returns the whole island; the default keeps the historic
    Galle-only behaviour of the pipeline.
    """
    if not source_path.exists():
        raise FileNotFoundError(
            f"{source_path} not found - it is generated from the ministry listing "
            f"by convert_schools_csv.py (see apps/map-scraper/README.md)"
        )
    schools: list[SourceSchool] = []
    seen_ids: set[str] = set()
    with source_path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for line_no, row in enumerate(reader, 2):
            if district is not None and row.get("district") != district:
                continue
            school = _parse_row(row, line_no)
            if school.school_id in seen_ids:
                continue
            seen_ids.add(school.school_id)
            schools.append(school)

    schools.sort(key=lambda school: school.sequence)
    if not schools:
        raise ValueError(f"No {district or 'any'} schools found in {source_path}")
    return schools


def parse_galle_schools(source_path: Path) -> list[SourceSchool]:
    """Backward-compatible alias for load_schools(..., district='Galle')."""
    return load_schools(source_path, district="Galle")


def is_primary_school(school: SourceSchool) -> bool:
    """Whether the listing's grade span marks this as a primary-only school.

    Some rows carry no primary marker in their name ("YATAGALA MALCOM
    VIDYALAYA", Type 3, Grade 1-5) yet Google correctly lists them as
    "... Primary School".  The grade span is authoritative metadata.
    """
    span = school.grade_span.casefold().replace(" ", "")
    return span in {"grade1-5", "grade1-4", "grade1", "grade01-05"}


def display_name(source_name: str) -> str:
    """Turn the listing's uppercase school name into a readable English label."""
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
