from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from src.generator import build_school_records, write_records_json, write_typescript
from src.pdf import parse_galle_schools

# School names contain Sinhala characters; make sure printing them to a redirected
# stdout (cp1252 on Windows) cannot crash the scrape.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PDF = ROOT / "schools.pdf"
DEFAULT_JSON = Path(__file__).resolve().parent / "schools_data.json"
DEFAULT_MAP_CACHE = Path(__file__).resolve().parent / "map_coordinates.json"
DEFAULT_TS = ROOT / "apps" / "web" / "src" / "lib" / "schools.ts"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract Galle government schools and generate web school data.")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF, help="Government-school PDF source")
    parser.add_argument("--output-json", type=Path, default=DEFAULT_JSON, help="Normalized JSON output")
    parser.add_argument("--output-ts", type=Path, default=DEFAULT_TS, help="Generated TypeScript output")
    parser.add_argument("--map-cache", type=Path, default=DEFAULT_MAP_CACHE, help="Google Maps coordinate cache")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pdf_path = args.pdf.resolve()
    output_json = args.output_json.resolve()
    output_ts = args.output_ts.resolve()
    map_cache = args.map_cache.resolve()

    sources = parse_galle_schools(pdf_path)
    print(f"Extracted {len(sources)} Galle schools from {pdf_path}")

    # Prune the coordinate cache to only schools present in the PDF.
    # Previously scraped Google Maps coordinates for schools that are not in
    # the Galle PDF are discarded so the web app never sees them.
    pdf_school_ids = {school.school_id for school in sources}
    if map_cache.exists():
        raw = json.loads(map_cache.read_text(encoding="utf-8"))
        before = len(raw)
        raw = {key: value for key, value in raw.items() if key in pdf_school_ids}
        if len(raw) < before:
            print(f"Pruned {before - len(raw)} cached coordinates not in the PDF")
            map_cache.write_text(
                json.dumps(raw, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    records = build_school_records(
        sources,
        map_cache_path=map_cache,
        legacy_ts_path=output_ts if output_ts.exists() else None,
    )
    write_records_json(records, output_json)
    write_typescript(records, output_ts)

    located = sum(record.lat is not None and record.lng is not None for record in records)
    print(f"Generated {len(records)} records ({located} with coordinates)")
    print(f"JSON: {output_json}")
    print(f"TypeScript: {output_ts}")


if __name__ == "__main__":
    main()
