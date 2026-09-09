from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from .models import MapSchool, SchoolRecord, SourceSchool
from .pdf import display_name, division_id, district_id, slugify


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
    """Read the previously generated web catalog so names, ids and any manually
    corrected coordinates survive a regeneration."""
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


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
    legacy_catalog_path: Path | None = None,
) -> list[SchoolRecord]:
    map_cache = _load_map_cache(map_cache_path) if map_cache_path else {}
    legacy = load_legacy_schools(legacy_catalog_path) if legacy_catalog_path else []
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
        elif old and old.get("lat") is not None and old.get("lng") is not None:
            # Fall back to whatever the catalog already knew. Some coordinates
            # only ever existed in the generated file (an admin correction, or
            # an older scrape whose cache entry is gone), and discarding them
            # here silently deleted real data on every regeneration.
            latitude, longitude = old["lat"], old["lng"]
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
    # newline="" keeps LF on Windows, where write_text would otherwise emit CRLF
    # and leave every regenerated file failing the formatter.
    path.write_text(
        json.dumps([record.to_dict() for record in records], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="",
    )


def render_web_catalog(records: list[SchoolRecord]) -> str:
    """Render the catalog the web app imports (apps/web/src/lib/g1/schools.json).

    Formatted the way Biome formats JSON (2-space indent, one field per line)
    so a regenerated catalog is already lint-clean and a refresh shows up as a
    per-field diff rather than one churned line per school.
    """
    catalog = [
        {
            "id": record.id,
            "en": record.en,
            "si": record.si,
            "lat": None if record.lat is None else round(record.lat, 6),
            "lng": None if record.lng is None else round(record.lng, 6),
            "genderType": record.gender_type,
            "schoolType": record.school_type,
            "districtId": record.district_id,
            "dsId": record.ds_id,
        }
        for record in records
    ]
    return json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"


def write_web_catalog(records: list[SchoolRecord], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_web_catalog(records), encoding="utf-8", newline="")
