"""Offline sanity check of the school-aware matcher against real rejected pairs.

Reads NO MATCH pairs (school_id<TAB>source<TAB>result) from stdin and prints
which pairs the improved matcher would now accept, so the rules can be tuned
without making any Google Maps requests.

    uv run python src/match_test.py < nomatch_pairs.tsv
"""

from __future__ import annotations

import sys

from .match_logic import accept


def main() -> None:
    lines = [line.rstrip("\n") for line in sys.stdin if line.strip()]
    print(f"testing {len(lines)} rejected pairs\n")
    accepted = 0
    for line in lines:
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        school_id, source, result = parts
        ok, score = accept(source, result)
        verdict = "ACCEPT" if ok else "reject"
        accepted += ok
        print(f"{verdict:6s} {score:.2f} {school_id}: {source}  <=  {result[:90]}")
    print(f"\n{accepted}/{len(lines)} would now be accepted")


if __name__ == "__main__":
    main()
