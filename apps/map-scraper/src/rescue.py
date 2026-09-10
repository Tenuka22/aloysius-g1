"""Second-pass rescuer for Galle schools the main scrape left without coordinates.

The main scrape only accepts exact-ish name matches (score >= 0.94).  This pass
re-runs the per-school Google Maps lookup for every school still missing
coordinates and accepts results the school-aware matcher recognises -- same
school with abbreviations/qualifiers/transliteration differences -- while
refusing landmarks, businesses and people.

Usage:
    uv run python -m src.rescue [--max-schools N] [--delay SECONDS] [--dry-run]

Writes accepted results straight into map_coordinates.json (like the main
scraper does) and prints a REVIEW list of borderline rejections for eyeballing.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .match_logic import accept, location_hints, review_needed
from .models import MapSchool, SourceSchool
from .pdf import is_primary_school, load_schools
from .scraper import GoogleMapsScraper, load_attempts, record_attempt, save_attempts

HERE = Path(__file__).resolve().parent
DEFAULT_SOURCE = HERE.parent / "schools.csv"
DEFAULT_CACHE = HERE.parent / "map_coordinates.json"  # same cache the main scraper writes
REVIEW_PATH = HERE / "rescue_review.txt"

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", line_buffering=True)


def load_sources(source_path: Path) -> list[SourceSchool]:
    return load_schools(source_path)


def load_cache(cache_path: Path) -> dict[str, MapSchool]:
    if not cache_path.exists():
        return {}
    raw = json.loads(cache_path.read_text(encoding="utf-8"))
    return {key: MapSchool(**value) for key, value in raw.items()}


def save_cache(cache_path: Path, cache: dict[str, MapSchool]) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(
        json.dumps({key: value.to_dict() for key, value in cache.items()}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--map-cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--delay", type=float, default=1.1)
    parser.add_argument("--headful", action="store_true")
    parser.add_argument("--timeout", type=float, default=60.0)
    parser.add_argument("--dry-run", action="store_true", help="Print what would be accepted without saving or searching")
    parser.add_argument(
        "--retry-unmatched",
        action="store_true",
        help="Re-request schools already attempted and recorded in map_attempts.json",
    )
    args = parser.parse_args()

    sources = load_sources(args.source)
    cache = load_cache(args.map_cache)
    located = {
        school_id
        for school_id, result in cache.items()
        if result.latitude is not None and result.longitude is not None
    }
    missing = [school for school in sources if school.school_id not in located]
    print(f"{len(sources)} schools; {len(located)} already located; {len(missing)} missing")

    attempts_path = args.map_cache.with_name("map_attempts.json")
    attempts = load_attempts(attempts_path)
    if not args.retry_unmatched:
        skipped = [school for school in missing if school.school_id in attempts]
        if skipped:
            print(
                f"Skipping {len(skipped)} schools already attempted and recorded "
                f"({attempts_path.name}); use --retry-unmatched to re-request them"
            )
        missing = [school for school in missing if school.school_id not in attempts]

    if args.dry_run:
        # Offline mode: read previously saved (source, result) review pairs.
        pairs_path = Path(__file__).resolve().parent / "review_pairs.tsv"
        if pairs_path.exists():
            for line in pairs_path.read_text(encoding="utf-8").splitlines():
                school_id, source, result = line.split("\t")
                ok, score = accept(source, result)
                print(f"{'ACCEPT' if ok else 'reject':6s} {score:.2f} {school_id}: {source} <= {result}")
        return

    scraper = GoogleMapsScraper(headless=not args.headful, timeout_ms=int(args.timeout * 1_000))
    # One Google place may only serve one listing row (see scraper.scrape_coordinates).
    used_place_ids = {result.place_id for result in cache.values() if result.place_id}

    def siblings_of(school: SourceSchool) -> tuple[str, ...]:
        return tuple(
            other.name for other in sources if other.division == school.division and other.school_id != school.school_id
        )
    accepted = 0
    review_notes: list[str] = []
    for index, school in enumerate(missing, 1):
        school_id = school.school_id
        if school_id in cache and cache[school_id].latitude is not None:
            continue
        try:
            result = scraper.search_school(school, used_place_ids=used_place_ids, all_schools=sources)
        except Exception as exc:  # noqa: BLE001
            attempts[school_id] = record_attempt("error", note=f"{type(exc).__name__}: {exc}"[:200])
            print(f"  [{index}/{len(missing)}] {school_id}: {school.name} -- ERROR {exc}")
            save_attempts(attempts_path, attempts)
            continue
        if result is None:
            attempts[school_id] = record_attempt("no-result")
            print(f"  [{index}/{len(missing)}] {school_id}: {school.name} -- NO RESULT")
            save_attempts(attempts_path, attempts)
            if args.delay > 0:
                time.sleep(args.delay)
            continue
        ok, score = accept(
            school.name,
            result.name,
            source_is_primary=is_primary_school(school),
            result_address=result.address,
            location_hints=location_hints(school.address, school.division, school.name),
            sibling_names=siblings_of(school),
        )
        if ok:
            cache[school_id] = result
            if result.place_id:
                used_place_ids.add(result.place_id)
            attempts.pop(school_id, None)
            accepted += 1
            note = "" if score >= 0.9 else "borderline-accept"
            print(f"  [{index}/{len(missing)}] ACCEPT {score:.2f} {school_id}: {school.name} <= {result.name}")
            if note:
                review_notes.append(f"{school_id}\t{school.name}\t{result.name}\t{score:.2f}\t{note}")
        else:
            if review_needed(school.name, result.name, score):
                attempts[school_id] = record_attempt("review", result_name=result.name, score=round(score, 2))
                print(f"  [{index}/{len(missing)}] REVIEW {score:.2f} {school_id}: {school.name} <= {result.name}")
                review_notes.append(f"{school_id}\t{school.name}\t{result.name}\t{score:.2f}\tborderline-reject")
            else:
                attempts[school_id] = record_attempt("no-match", result_name=result.name, score=round(score, 2))
                print(f"  [{index}/{len(missing)}] reject {score:.2f} {school_id}: {school.name} <= {result.name}")
        save_cache(args.map_cache, cache)
        save_attempts(attempts_path, attempts)
        if args.delay > 0:
            time.sleep(args.delay)

    REVIEW_PATH.write_text("\n".join(review_notes) + "\n", encoding="utf-8")
    print(f"\nRescue accepted {accepted} more schools; review notes: {len(review_notes)} -> {REVIEW_PATH}")
    print(f"Cached with coordinates: {sum(1 for r in cache.values() if r.latitude is not None)}")


if __name__ == "__main__":
    main()
