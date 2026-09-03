"""School-aware name matching for Google Maps scrape results.

The main scraper accepts results only when the compacted names are nearly
identical (>= 0.94).  That misses legitimate matches where Google spells the
same school differently -- abbreviations (K.V. -> "Kanishta Vidyalaya"),
qualifiers ("National School", "(Girls) College"), government prefixes
("G/ ..."), and Sinhala romanisation variants ("Kanitu Viduhala",
"Vijayabahu"/"Wijayabahu", "thth"/"tt").

This module adds a second tier that still refuses landmarks, businesses,
people and other schools (e.g. "Karandeniya Central College" must not satisfy
"Warukandeniya K.V.") but accepts genuine same-school results.

The rules were tuned offline against 123 real rejected pairs from a scrape
run of the 429 Galle government schools (apps/map-scraper/src/match_test.py).
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher

# Type words/phrases applied to the compact (alnum) name, longest first.
TYPE_PATTERNS = [
    "kanishtaviduhala",
    "kanisthavidyalaya",
    "kanishtavidyalaya",
    "kanishtaviddayalaya",
    "kanituviduhala",
    "vidiyalaya",
    "viddayalaya",
    "viduhala",
    "vidyalaya",
    "secondary",
    "janapada",
    "national",
    "primary",
    "central",
    "balika",
    "royal",
    "college",
    "school",
    "mixed",
    "junior",
    "senior",
    "vidyalay",
    "model",
    "girls",
    "boys",
    "maha",
    "mmv",
]

NON_SCHOOL_MARKERS = [
    "waterfall",
    "road",
    "lane",
    "postoffice",
    "wellness",
    "ayurveda",
    "medical",
    "center",
    "centre",
    "temple",
    "aramaya",
    "dera",
    "mandiraya",
    "mandir",
    "garden",
    "villa",
    "hotel",
    "restaurant",
    "resort",
    "cafe",
    "bakery",
    "shop",
    "store",
    "supermarket",
    "pharmacy",
    "hospital",
    "bank",
    "stadium",
    "ground",
    "park",
    "falls",
    "factory",
    "estate",
    "plantation",
    "busstand",
    "busstation",
    "dewalaya",
    "gedara",
    "vithanage",
    "gurugamage",
    "office",
    "authority",
    "trust",
    "pvt",
    "llc",
    "pool",
    "villa",
    "rest",
    "bar",
    "juice",
]

SCHOOL_KEYWORDS = [
    "school",
    "college",
    "vidyalaya",
    "viduhala",
    "vidyalay",
    "vidiyalaya",
    "kanishta",
    "kanistha",
    "kanitu",
    "primary",
    "national",
    "janapada",
    "maha",
    "mmv",
    "kv",
    "mv",
    "bv",
    "academy",
    "institute",
    "k v",
    "k/v",
    "m v",
    "m.v",
    "m/v",
]


def _normalise(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def _compact(value: str) -> str:
    normalized = _normalise(value)
    normalized = normalized.replace("saint", "st")
    normalized = normalized.replace("sent ", "st ")
    normalized = normalized.replace("kanishta viduhala", "kv")
    normalized = normalized.replace("kanistha vidyalaya", "kv")
    normalized = normalized.replace("kanishta vidyalaya", "kv")
    normalized = normalized.replace("kanitu viduhala", "kv")
    normalized = normalized.replace("kanishtavidyalaya", "kv")
    normalized = normalized.replace("kanisthavidyalaya", "kv")
    normalized = normalized.replace("kanituviduhala", "kv")
    normalized = normalized.replace("viduhala", "vidyalaya")
    normalized = normalized.replace("viddayalaya", "vidyalaya")
    normalized = normalized.replace("vidiyalaya", "vidyalaya")
    normalized = normalized.replace("maha vidyalaya", "mv")
    normalized = normalized.replace("m m v", "mmv")
    normalized = normalized.replace("m v", "mv")
    normalized = normalized.replace("k v", "kv")
    normalized = normalized.replace("b v", "bv")
    normalized = normalized.replace("vijayabahu", "wijayabahu")
    normalized = normalized.replace("abhayathissa", "abhayatissa")
    normalized = normalized.replace("daththa", "dattha")
    normalized = normalized.replace("thth", "tt")
    normalized = re.sub(r"^g / ", "", normalized)
    normalized = normalized.replace("g/", "")
    return re.sub(r"[^a-z0-9]+", "", normalized)


def _strip_types(compact: str) -> str:
    out = compact
    for pattern in TYPE_PATTERNS:
        out = out.replace(pattern, "")
    # Letter school codes only count as types when they end the name.
    for code in ("mmv", "bmv", "kv", "mv", "bv", "vv"):
        if out.endswith(code) and len(out) > len(code):
            out = out[: -len(code)]
    return out


def _has_school_keyword(name: str) -> bool:
    lowered = name.casefold()
    return any(keyword in lowered for keyword in SCHOOL_KEYWORDS)


def _has_non_school_marker(name: str) -> bool:
    lowered = name.casefold()
    return any(marker in lowered for marker in NON_SCHOOL_MARKERS)


def school_aware_score(source: str, result: str) -> float:
    """Score whether ``result`` names the same school as ``source``."""
    source_compact = _compact(source)
    result_compact = _compact(result)
    if not source_compact or not result_compact:
        return 0.0
    if source_compact == result_compact:
        return 1.0
    if source_compact in result_compact or result_compact in source_compact:
        return 0.97
    source_core = _strip_types(source_compact)
    result_core = _strip_types(result_compact)
    if not source_core or not result_core:
        return 0.0
    if source_core == result_core:
        return 0.95
    if source_core in result_core or result_core in source_core:
        return 0.9
    return SequenceMatcher(None, source_core, result_core).ratio()


def accept(source: str, result: str) -> tuple[bool, float]:
    """True when ``result`` can be trusted as the Google Maps listing of ``source``."""
    score = school_aware_score(source, result)
    if score >= 0.94:
        return True, score
    # Below the strict threshold the result must still look like a school and
    # not like a landmark/business/person for us to accept it.
    if _has_non_school_marker(result):
        return False, score
    if not _has_school_keyword(result):
        return False, score
    return score >= 0.75, score


def review_needed(source: str, result: str, score: float) -> bool:
    """Whether this pair deserves a human eyeball in the rescue review list."""
    if score >= 0.94:
        return False
    if _has_non_school_marker(result):
        return False
    return score >= 0.5
