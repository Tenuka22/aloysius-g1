"""One-time conversion of the layout-preserved schools.txt into schools.csv.

schools.txt was a whitespace-extracted copy of the 2018 "List of Government
Schools" PDF.  Fixed-width scraping worked but was fragile (three rows even
lack the SchoolID column) and unreadable.  This script flattens every row of
the island-wide listing into one CSV row with clean columns; the pipeline then
reads schools.csv via src.pdf.load_schools instead of slicing text columns.

Usage:
    .venv/Scripts/python.exe convert_schools_csv.py [schools.txt [schools.csv]]

Keep the original schools.txt around until the CSV has been verified; delete
it afterwards (the scraper pipeline no longer reads it).
"""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", line_buffering=True)

HERE = Path(__file__).resolve().parent

PROVINCES = (
    "North Central|North Western|Sabaragamuwa|Northern|Southern|Western|Central|Eastern|Uva"
)
PROVINCE_RE = re.compile(rf"(?:^|\s{{2,}})({PROVINCES})(?:\s{{2,}}|$)")

COLUMNS = [
    "seq_no",
    "school_id",
    "census_no",
    "name",
    "address",
    "tel",
    "email",
    "province",
    "district",
    "zone",
    "division",
    "medium",
    "sex",
    "government_type",
    "school_category",
    "grade_span",
    "difficulty",
    "total_students",
]


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _split_contact(raw: str) -> tuple[str, str]:
    """The PDF mashed telephone and email together ("0112522125x@gmail.com")."""
    raw = _clean(raw).strip().strip("-").strip()
    if not raw:
        return ("", "")
    # A phone number is a run of 9-12 digits at the start; everything after it
    # (usually an email glued to its last digit) is the address.
    match = re.match(r"^(\d{9,12})\s*(.*)$", raw)
    if match:
        return (match.group(1), match.group(2).strip())
    return ("", raw if "@" in raw else "")


def _parse_line(line: str) -> dict[str, str] | None:
    province_match = PROVINCE_RE.search(line)
    if not province_match:
        return None

    tail = re.split(r"\s{2,}", line[province_match.start() :].strip())
    if len(tail) < 11:
        return None
    province, district, zone, division, medium, sex, government_type, school_category, grade_span, difficulty, total = (
        tail[:11]
    )

    prefix = line[: province_match.start()]
    head = re.split(r"\s{3,}", prefix.strip())
    # Normal rows: seq, school_id, census, name, address, contact...
    # Three island rows lack the school_id column and yield one field fewer.
    if len(head) >= 5:
        seq, school_id, census = head[0], head[1], head[2]
        name, address = head[3], head[4]
        contact = " ".join(head[5:])
    elif len(head) == 4:
        seq, school_id, census = head[0], "", head[1]
        name, address = head[2], head[3]
        contact = ""
    else:
        return None
    if not (seq.isdigit() and school_id.isdigit() and census.isdigit()):
        return None

    tel, email = _split_contact(contact)
    return {
        "seq_no": seq,
        "school_id": school_id,
        "census_no": census,
        "name": _clean(name),
        "address": _clean(address),
        "tel": tel,
        "email": email,
        "province": province,
        "district": district,
        "zone": zone,
        "division": division,
        "medium": medium,
        "sex": sex,
        "government_type": government_type,
        "school_category": school_category,
        "grade_span": grade_span,
        "difficulty": difficulty,
        "total_students": total,
    }


def convert(source: Path, target: Path) -> int:
    rows: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    for line in source.read_text(encoding="utf-8").splitlines():
        row = _parse_line(line)
        if row is None:
            continue
        if row["school_id"] and row["school_id"] in seen_ids:
            continue
        seen_ids.add(row["school_id"])
        rows.append(row)

    with target.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    galle = sum(1 for row in rows if row["district"] == "Galle")
    print(f"wrote {len(rows)} schools ({galle} in Galle) to {target}")
    return len(rows)


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "schools.txt"
    target = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "schools.csv"
    if not source.exists():
        raise SystemExit(f"source not found: {source}")
    convert(source, target)


if __name__ == "__main__":
    main()
