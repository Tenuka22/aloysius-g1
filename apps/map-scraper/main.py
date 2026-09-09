from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from src.generator import build_school_records, write_records_json, write_web_catalog
from src.pdf import parse_galle_schools

# School names contain Sinhala characters; make sure printing them to a redirected
# stdout (cp1252 on Windows) cannot crash the scrape.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
DEFAULT_SOURCE = HERE / "schools.txt"
DEFAULT_JSON = HERE / "schools_data.json"
DEFAULT_MAP_CACHE = HERE / "map_coordinates.json"
DEFAULT_CATALOG = ROOT / "apps" / "web" / "src" / "lib" / "g1" / "schools.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract Galle government schools and generate web school data.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Government-school listing text source")
    parser.add_argument("--output-json", type=Path, default=DEFAULT_JSON, help="Normalized JSON output")
    parser.add_argument("--output-catalog", type=Path, default=DEFAULT_CATALOG, help="Generated web catalog JSON")
    parser.add_argument("--map-cache", type=Path, default=DEFAULT_MAP_CACHE, help="Google Maps coordinate cache")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_path = args.source.resolve()
    output_json = args.output_json.resolve()
    output_catalog = args.output_catalog.resolve()
    map_cache = args.map_cache.resolve()

    sources = parse_galle_schools(source_path)
    print(f"Extracted {len(sources)} Galle schools from {source_path}")

    # Prune the coordinate cache to only schools present in the listing.
    # Previously scraped Google Maps coordinates for schools that are not in
    # the Galle listing are discarded so the web app never sees them.
    source_school_ids = {school.school_id for school in sources}
    if map_cache.exists():
        raw = json.loads(map_cache.read_text(encoding="utf-8"))
        before = len(raw)
        raw = {key: value for key, value in raw.items() if key in source_school_ids}
        if len(raw) < before:
            print(f"Pruned {before - len(raw)} cached coordinates not in the listing")
            map_cache.write_text(
                json.dumps(raw, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    records = build_school_records(
        sources,
        map_cache_path=map_cache,
        legacy_catalog_path=output_catalog if output_catalog.exists() else None,
    )
    write_records_json(records, output_json)
    write_web_catalog(records, output_catalog)

    located = sum(record.lat is not None and record.lng is not None for record in records)
    print(f"Generated {len(records)} records ({located} with coordinates)")
    print(f"JSON: {output_json}")
    print(f"Web catalog: {output_catalog}")


if __name__ == "__main__":
    main()
