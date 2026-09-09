"""One-time repair of coordinate data poisoned by duplicate-place assignment.

Problem: the scraper's feed loop and per-school lookups assigned one Google
place to several listing rows, so sibling schools with near-identical names
("Harumalgoda East/West Primary", "Yatagala M.V./K.V.") shared a pin, and some
rows received pins for clearly different schools ("Harumalgoda West" -> East).
The tightened region gate now also rejects Matara-district results.

Actions:
  * drop every cached coordinate whose Google name has no school keyword
    (village labels like "Karandeniya" or "Yatagala" -- they are almost always
    a sibling school's pin, never verifiable as the row's own place);
  * drop the six listed rows whose cached pin belongs to a known sibling;
  * record the correct place for those six where Google's card is unambiguous;
  * clear the attempt records for every scrubbed row so the next scrape or
    rescue run re-requests them.

Usage: .venv/Scripts/python.exe repair_duplicates.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

# School names contain Sinhala; keep prints safe when stdout is cp1252.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", line_buffering=True)

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from src.generator import load_scrubbed_ids as load_scrubbed  # noqa: E402
from src.match_logic import _compact, _has_school_keyword  # noqa: E402
from src.models import MapSchool  # noqa: E402
from src.pdf import load_schools  # noqa: E402
from src.scraper import load_attempts, save_attempts  # noqa: E402

CACHE = HERE / "map_coordinates.json"
ATTEMPTS = HERE / "map_attempts.json"

# place_ids copied from map_coordinates.json entries verified by hand against
# the listing's division and the sibling pair in audit_pairs.py.
VERIFIED: dict[str, MapSchool] = {
    # 0702020 HARUMALGODA EAST PRIMARY SCHOOL (Habaraduwa) - "East" is explicit.
    "0702020": MapSchool(
        name="Harumalgoda East Primary School හරුමල්ගොඩ නැගෙනහිර කණිෂ්ඨ විද්\u200dයාලය",
        latitude=6.0296574,
        longitude=80.2663133,
        address="X969+JX Habaraduwa",
        place_id="0x3ae16d77b71efb83:0x99473c07ce5185e7",
        url="https://www.google.com/maps/place/Harumalgoda+East+Primary+School/@6.0296574,80.2663133,17z",
    ),
    # 0704014 SRI DEERANANDA MAHA VIDYALAYA (Boossa, Hikkaduwa division) - the
    # G/-prefixed card is in Boossa; the Elpitiya "ANANDA M.V." row is a
    # different school and stays unmatched.
    "0704014": MapSchool(
        name="G/Deerananda Maha Vidyalaya",
        latitude=6.0889494,
        longitude=80.1560648,
        address="35Q4+HCG, Boossa",
        place_id="0x3ae176ee77e49db1:0xd48cc59295efe0b8",
        url="https://www.google.com/maps/place/G%2FDeerananda+Maha+Vidyalaya/@6.0889494,80.1560648,17z",
    ),
    # 0714013 WEERAPANA K.V. (WEERAPANA, OPATHA) - plain "Weerapana k v" card;
    # the JANAPADA sibling (WEERAPANA EAST) stays unmatched.
    "0714013": MapSchool(
        name="Weerapana k v",
        latitude=6.2722496,
        longitude=80.3019643,
        address="7GX7+F5, Opatha",
        place_id="0x3ae161d5dd338c8f:0xcf7729de7d2e0d23",
        url="https://www.google.com/maps/place/Weerapana+k+v/@6.2722496,80.3019643,17z",
    ),
    # 0715017 LELWALA WICKRAMASINGHA K.V (PAHALA LELWALA, WANDURAMBA) - the
    # "G/Wickramasinghe K.V" card (its URL names the school) sits inside Pahala
    # Lelwala and previously sat on sibling row 0715016 LELWALA K.V, whose own
    # listing is a different school and stays unmatched.
    "0715017": MapSchool(
        name="Lelwala",
        latitude=6.1392014,
        longitude=80.2418188,
        address="46QR+MPP, Pahala Lelwala, Wanduramba",
        place_id="0x3ae3df43e81a5219:0x23a420a12c4a2550",
        url="https://www.google.com/maps/place/G%2FWickramasinghe+K.V/@6.1392014,80.2418188,17z",
    ),
    # 0704046 WEERAGODA VIJAYABA PRIMARY SCHOOL - dropped (unsure): Google's
    # card reads "... Secondary School" while the 2018 listing has BOTH a
    # secondary row (0704029, whose own exact-name pin lives ~7 km away) and
    # this primary row, and the card's place is a distinct Google place with
    # the identical name.  Which of the two places is the primary school
    # cannot be verified offline, so per the "don't if unsure" rule the row
    # stays unlocated until a properly-named card shows up.
    # 0706028 ST THERESA K.V. (Elpitiya) - "St. Theresa Primary School" card is
    # the K.V.'s own listing; the B.M.V. sibling stays unmatched.
    "0706028": MapSchool(
        name="St. Theresa Primary School",
        latitude=6.2853937,
        longitude=80.1571694,
        address="Elpitiya",
        place_id="0x3ae17facaa3b6c03:0xf89209dfc2ebc8c0",
        url="https://www.google.com/maps/place/St.+Theresa+Primary+School/@6.2853937,80.1571694,17z",
    ),
}

# place_ids of the six entries above, so their duplicates can be dropped.
VERIFIED_PLACE_IDS = {entry.place_id for entry in VERIFIED.values() if entry.place_id}

# Rows whose cached pin is wrong or unverifiable but which the generic drop
# rules cannot see (their card names carry school keywords).  See the comment
# on 0704046 below.
FORCE_DROP = {
    "0704046",  # primary row holds a distinct "... Secondary School" place
    "0715016",  # pin belongs to sibling 0715017 (Wickramasingha K.V.)
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print the plan without writing anything")
    args = parser.parse_args()

    sources = {school.school_id: school for school in load_schools(HERE / "schools.csv")}
    cache = json.loads(CACHE.read_text(encoding="utf-8"))
    attempts = load_attempts(ATTEMPTS)

    drop: list[str] = []
    for school_id in sorted(FORCE_DROP):
        if school_id in cache:
            drop.append(school_id)
    for school_id, entry in sorted(cache.items()):
        name = entry.get("name") or ""
        source = sources.get(school_id)
        source_name = source.name if source else ""
        # An exact name match is trustworthy even when the name carries no
        # keyword ("Sacred Heart Convent", "... K.V" with dotted abbreviations
        # the keyword list does not know).  Only names that merely CONTAIN the
        # source (village labels like "Karandeniya" for "KARANDENIYA K.V.")
        # are unverifiable.
        exact_match = _compact(source_name) == _compact(name)
        if entry.get("place_id") in VERIFIED_PLACE_IDS and school_id not in VERIFIED:
            drop.append(school_id)  # duplicate assigned to the wrong sibling
        elif (
            entry.get("place_id") not in VERIFIED_PLACE_IDS
            and not _has_school_keyword(name)
            and not exact_match
        ):
            drop.append(school_id)  # village-label pin, unverifiable

    print(f"cache entries: {len(cache)}")
    print(f"dropping {len(drop)} unverifiable/duplicate entries:")
    for school_id in drop:
        source = sources.get(school_id)
        label = source.name if source else "?"
        print(f"  - {school_id} {label} (was: {cache[school_id].get('name')!r})")

    for school_id, entry in VERIFIED.items():
        if school_id in cache and cache[school_id] == entry.to_dict():
            continue
        source = sources[school_id]
        print(f"  = {school_id} {source.name} -> {entry.name} @ {entry.latitude},{entry.longitude}")

    if args.dry_run:
        return

    scrubbed_path = HERE / "scrubbed_legacy_pins.json"
    scrubbed = load_scrubbed(scrubbed_path)
    for school_id in sorted(FORCE_DROP):
        # Record the review marker even when the cache entry is already gone
        # (idempotent re-runs), so the row stays visibly unlocated.
        if school_id not in attempts or not attempts[school_id].get("note", "").startswith("scrubbed"):
            attempts[school_id] = {
                "status": "review",
                "result": None,
                "score": None,
                "note": "scrubbed by repair_duplicates.py: pin judged wrong or unverifiable",
                "ts": round(time.time(), 1),
            }
    for school_id in drop:
        cache.pop(school_id, None)
        # Keep a review marker so the row is visibly unlocated (not silently
        # "never looked at"), and rescue passes may still re-request it.
        attempts[school_id] = {
            "status": "review",
            "result": None,
            "score": None,
            "note": "scrubbed by repair_duplicates.py: pin judged wrong or unverifiable",
            "ts": round(time.time(), 1),
        }
    for school_id, entry in VERIFIED.items():
        cache[school_id] = entry.to_dict()
        attempts.pop(school_id, None)

    CACHE.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="",
    )
    # The catalog's legacy pins for scrubbed rows must not resurrect on the
    # next `main.py` run; the generator consults this list.
    scrubbed_path.write_text(
        json.dumps(sorted(set(drop) | set(FORCE_DROP) | scrubbed), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="",
    )
    save_attempts(ATTEMPTS, attempts)
    located = sum(1 for entry in cache.values() if entry.get("latitude") is not None)
    print(f"\nwrote {len(cache)} cache entries ({located} located); "
          f"scrubbed rows will be re-requested on the next scrape/rescue run")
    _ = time.time()


if __name__ == "__main__":
    main()
