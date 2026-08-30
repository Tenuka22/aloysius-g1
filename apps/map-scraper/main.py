from __future__ import annotations

import argparse
from pathlib import Path

from src.generator import build_school_records, write_records_json, write_typescript
from src.pdf import parse_galle_schools

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
    parser.add_argument("--scrape-maps", action="store_true", help="Scrape the Galle Government school result feed")
    parser.add_argument("--headful", action="store_true", help="Show the browser while scraping Google Maps")
    parser.add_argument("--delay", type=float, default=1.1, help="Seconds between lookups")
    parser.add_argument("--timeout", type=float, default=900.0, help="Maximum seconds for the Google Maps result feed")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pdf_path = args.pdf.resolve()
    output_json = args.output_json.resolve()
    output_ts = args.output_ts.resolve()
    map_cache = args.map_cache.resolve()

    sources = parse_galle_schools(pdf_path)
    print(f"Extracted {len(sources)} Galle schools from {pdf_path}")

    if args.scrape_maps:
        from src.scraper import GoogleMapsScraper

        print("Looking up remaining coordinates in Google Maps...")
        GoogleMapsScraper(headless=not args.headful, timeout_ms=int(args.timeout * 1_000)).scrape_coordinates(
            sources,
            cache_path=map_cache,
            delay_seconds=args.delay,
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
