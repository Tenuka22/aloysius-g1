from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from .models import MapSchool, SchoolRecord, SourceSchool
from .pdf import display_name, division_id, district_id, slugify

LEGACY_ROW = re.compile(
    r'\{\s*id:\s*"(?P<id>[^"]+)",\s*en:\s*"(?P<en>(?:\\.|[^"])*)",\s*si:\s*"(?P<si>(?:\\.|[^"])*)",\s*lat:\s*(?P<lat>null|-?\d+(?:\.\d+)?),\s*lng:\s*(?P<lng>null|-?\d+(?:\.\d+)?),\s*genderType:\s*"(?P<gender>[^\"]+)",\s*schoolType:\s*"(?P<type>[^\"]+)",\s*districtId:\s*"(?P<district>[^\"]+)",\s*dsId:\s*"(?P<ds>[^\"]+)"',
)


def _normalise_name(value: str) -> str:
    value = value.casefold()
    value = value.replace("saint ", "st ")
    value = value.replace("maha vidyalaya", "mv")
    value = value.replace("m.m.v.", "mmv").replace("m.v.", "mv").replace("b.v.", "bv").replace("k.v.", "kv")
    return re.sub(r"[^a-z0-9]+", "", value)


STABLE_SCHOOLS = {
    "staloysiuscollege": ("st-aloysius-galle", "St. Aloysius' College"),
    "richmondcollege": ("richmond-galle", "Richmond College"),
    "mahindacollege": ("mahinda-galle", "Mahinda College"),
    "southlandcollege": ("southlands-galle", "Southlands College"),
}


def load_legacy_schools(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for match in LEGACY_ROW.finditer(path.read_text(encoding="utf-8")):
        rows.append(
            {
                "id": match.group("id"),
                "en": json.loads(f'"{match.group("en")}"'),
                "si": json.loads(f'"{match.group("si")}"'),
                "lat": None if match.group("lat") == "null" else float(match.group("lat")),
                "lng": None if match.group("lng") == "null" else float(match.group("lng")),
                "genderType": match.group("gender"),
                "schoolType": match.group("type"),
                "districtId": match.group("district"),
                "dsId": match.group("ds"),
            }
        )
    return rows


def _find_legacy(source: SourceSchool, legacy: list[dict[str, Any]], used: set[str]) -> dict[str, Any] | None:
    source_key = _normalise_name(source.name)
    exact = next((row for row in legacy if row["id"] not in used and _normalise_name(row["en"]) == source_key), None)
    if exact:
        return exact

    candidates = [row for row in legacy if row["id"] not in used and row["districtId"] == "galle"]
    best: tuple[float, dict[str, Any] | None] = (0.0, None)
    for row in candidates:
        score = SequenceMatcher(None, source_key, _normalise_name(row["en"])).ratio()
        if score > best[0]:
            best = (score, row)
    return best[1] if best[0] >= 0.86 else None


def _load_map_cache(path: Path) -> dict[str, MapSchool]:
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {key: MapSchool(**value) for key, value in raw.items()}


def _unique_id(base: str, source: SourceSchool, used: set[str]) -> str:
    candidate = base
    if candidate in used:
        candidate = f"{base}-{source.school_id}"
    used.add(candidate)
    return candidate


def build_school_records(
    sources: list[SourceSchool],
    *,
    map_cache_path: Path | None = None,
    legacy_ts_path: Path | None = None,
) -> list[SchoolRecord]:
    map_cache = _load_map_cache(map_cache_path) if map_cache_path else {}
    legacy = load_legacy_schools(legacy_ts_path) if legacy_ts_path else []
    used_ids: set[str] = set()
    records: list[SchoolRecord] = []

    for source in sources:
        old = _find_legacy(source, legacy, used_ids)
        map_school = map_cache.get(source.school_id)
        stable = STABLE_SCHOOLS.get(_normalise_name(source.name))
        english_name = stable[1] if stable else (old["en"] if old else display_name(source.name))
        base_id = stable[0] if stable else (old["id"] if old else f"{slugify(english_name)}-{district_id(source.district)}")
        record_id = _unique_id(base_id, source, used_ids)
        if map_school and map_school.latitude is not None and map_school.longitude is not None:
            latitude, longitude = map_school.latitude, map_school.longitude
        else:
            latitude, longitude = None, None

        records.append(
            SchoolRecord(
                id=record_id,
                en=english_name,
                si=old["si"] if old else "",
                lat=latitude,
                lng=longitude,
                gender_type={"Male": "boys", "Female": "girls", "Mixed": "mixed"}[source.sex],
                school_type=source.government_type.casefold(),
                district_id=district_id(source.district),
                ds_id=old["dsId"] if old else division_id(source.division),
                source_school_id=source.school_id,
                source_name=source.name,
                address=source.address,
                zone=source.zone,
                division=source.division,
                map_url=map_school.url if map_school else None,
            )
        )
    return records


def write_records_json(records: list[SchoolRecord], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps([record.to_dict() for record in records], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def render_typescript(records: list[SchoolRecord]) -> str:
    lines = [
        "/**",
        " * Generated by apps/map-scraper from schools.pdf (List of Government Schools - 2018).",
        " * Run `uv run main.py` from apps/map-scraper to refresh this file.",
        " * Sinhala labels and coordinates remain empty until an authoritative source provides them.",
        " */",
        'export type GenderType = "boys" | "girls" | "mixed";',
        'export type SchoolType = "national" | "provincial";',
        "",
        "export interface School {",
        "  id: string;",
        "  en: string;",
        "  si: string;",
        "  lat: number | null;",
        "  lng: number | null;",
        "  genderType: GenderType;",
        "  schoolType: SchoolType;",
        "  districtId: string;",
        "  dsId: string;",
        "}",
        "",
        "export const SCHOOLS: School[] = [",
    ]
    for record in records:
        lat = "null" if record.lat is None else f"{record.lat:.6f}".rstrip("0").rstrip(".")
        lng = "null" if record.lng is None else f"{record.lng:.6f}".rstrip("0").rstrip(".")
        lines.append(
            "  { "
            f"id: {_ts_string(record.id)}, en: {_ts_string(record.en)}, si: {_ts_string(record.si)}, "
            f"lat: {lat}, lng: {lng}, genderType: {_ts_string(record.gender_type)}, "
            f"schoolType: {_ts_string(record.school_type)}, districtId: {_ts_string(record.district_id)}, "
            f"dsId: {_ts_string(record.ds_id)} "
            "},"
        )
    lines.extend(
        [
            "];",
            "",
            'export const HOME_SCHOOL_ID = "st-aloysius-galle";',
            "",
        ]
    )
    return "\n".join(lines)


def write_typescript(records: list[SchoolRecord], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_typescript(records), encoding="utf-8")
