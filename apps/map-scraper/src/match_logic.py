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

import difflib
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
    "coollege",
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
    "auditorium",
    "mainhall",
    "main hall",
    # Private pre-schools / daycares are not the government school even when
    # they carry the same village name ("Woodland Pre School" vs the listed
    # "Woodland K.V.").
    "preschool",
    "pre school",
    "pre-school",
    "nursery",
    "daycare",
    "day care",
    "montessori",
    "kids",
    "children",
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
    # Listing typo seen in the wild ("MAPALAGAMA CENTRAL COOLLEGE").
    normalized = normalized.replace("coollege", "college")
    normalized = normalized.replace("kanishta viduhala", "kv")
    normalized = normalized.replace("kanistha vidyalaya", "kv")
    normalized = normalized.replace("kanishta vidyalaya", "kv")
    normalized = normalized.replace("kanitu viduhala", "kv")
    normalized = normalized.replace("kanishtavidyalaya", "kv")
    normalized = normalized.replace("kanisthavidyalaya", "kv")
    normalized = normalized.replace("kanituviduhala", "kv")
    normalized = normalized.replace("viduhala", "vidyalaya")
    normalized = normalized.replace("viddayalaya", "vidyalaya")
    normalized = normalized.replace("viddiyalaya", "vidyalaya")
    normalized = normalized.replace("viddyalaya", "vidyalaya")
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
    # "G/" is the Galle-zone code on listing names ("G/Karandeniya K.V").  It
    # survives normalisation as a lone leading "g" token, so strip that rather
    # than the literal "g/" (the slash is already gone by this point).
    normalized = re.sub(r"^g (?=.)", "", normalized)
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


# Suffixes that distinguish sibling schools sharing a village name.
# "Harumalgoda East" must not satisfy "Harumalgoda West".
_DIRECTION_WORDS = {"east", "west", "north", "south"}

# School-type families, matched on the RAW (casefolded) name in priority
# order.  A listing row "... Maha Vidyalaya" and a card "... Kanishta
# Vidyalaya" are different schools in the ministry data (e.g. Yatagala M.V.
# vs Yatagala K.V. in the same village), so a result must carry a compatible
# type family before it can be accepted on a fuzzy score.
_FAMILY_RULES: list[tuple[str, str]] = [
    # Kanishta/primary: any kanishta/kanitu/viduhala/junior/primary spelling,
    # or a trailing "K.V." - checked BEFORE the maha rule because
    # "kanishta vidyalaya" contains a vidyalaya substring too.
    (r"kanishta|kanistha|kanitu|viduhala|prathamika|\bprimary\b|\bprimery\b|\bprirnary\b|\bjunior\b|k\.?\s?v\.?\s*$", "primary"),
    # NOTE: no "national" rule on purpose - ministry names from 2018 predate
    # later upgrades, and Google cards use the CURRENT name ("X Maha Vidyalaya"
    # listing vs "X National School" card is routinely the same school).
    (r"\bbalika\b", "balika"),
    (r"\bmodel\b", "model"),
    (r"\bcentral\b", "central"),
    (r"\bsecondary\b|\bseccondry\b", "secondary"),
    (r"coll[eo]+[ao]?ge", "college"),
    # Maha before bare vidyalaya: "X Maha Vidyalaya" is the maha family.
    (r"maha\s*vi?d[a-z]*|m\.?\s?m\.?\s?v\.?\s*$|b\.?\s?m\.?\s?v\.?\s*$|m\.?\s?v\.?\s*$", "maha"),
    (r"vi?d[a-z]*yalaya", "vidyalaya"),
]

# A kanishta/primary school is a genuinely DIFFERENT institution from a
# similarly named M.V./college (both routinely coexist in one village -
# "Yatagala M.V." and "Yatagala K.V."), so primary is strict: a primary
# listing never accepts a non-primary card.  Every other family pair is
# compatible because Google cards lag renames and upgrade rebrands ("X Maha
# Vidyalaya" card vs "X National School" listing, "X Secondary School" card
# vs "X M.V." listing, ...).  "College" deserves special looseness: Google
# Maps routinely renames "X Maha Vidyalaya" to "X College" in Sri Lanka
# ("Ananda College - Kithulampitiya" for KITHULAMPITIYA ANANDA M.V.).
_COMPATIBLE_FAMILIES = {
    frozenset({"maha", "national"}),
    frozenset({"maha", "secondary"}),
    frozenset({"maha", "central"}),
    frozenset({"maha", "vidyalaya"}),
    frozenset({"national", "secondary"}),
    frozenset({"national", "central"}),
    frozenset({"central", "secondary"}),
    frozenset({"balika", "college"}),
    frozenset({"balika", "maha"}),
    frozenset({"balika", "national"}),
    frozenset({"balika", "central"}),
    frozenset({"balika", "secondary"}),
    frozenset({"college", "maha"}),
    frozenset({"college", "national"}),
    frozenset({"college", "central"}),
    frozenset({"college", "secondary"}),
    frozenset({"college", "vidyalaya"}),
    # A K.V./primary listing whose card reads plain "... Vidyalaya" or
    # "... School" is routinely the same school: Google cards drop the
    # "Kanishta" qualifier ("Niyagama Vidyadara Vidyalaya" for NIYAGAMA
    # VIDYADARA K.V).  Upgraded families (maha/college/central/...) stay
    # strict so sibling pairs like Yatagala K.V./M.V. still conflict.
    frozenset({"primary", "vidyalaya"}),
}


def _type_family(name: str) -> str | None:
    lowered = name.casefold()
    for pattern, family in _FAMILY_RULES:
        if re.search(pattern, lowered):
            return family
    return None


def _type_family_conflict(source: str, result: str, *, source_is_primary: bool = False) -> bool:
    """True when the two names carry incompatible school-type families."""
    source_family = _type_family(source)
    result_family = _type_family(result)
    name_conflict = (
        source_family is not None
        and result_family is not None
        and source_family != result_family
        and frozenset({source_family, result_family}) not in _COMPATIBLE_FAMILIES
    )
    # The listing's grade span can relax one specific conflict: a row graded
    # "Grade 1-5" is a primary school even when its name carries no primary
    # marker ("YATAGALA MALCOM VIDYALAYA", Type 3), so an explicitly-primary
    # Google card ("... Primary School") is the same school, not a sibling.
    # It must never CREATE conflicts for name-consistent pairs ("Hegoda
    # Sooriya Model School" listing vs identical card).
    if name_conflict and source_is_primary and result_family == "primary":
        return False
    # One-sided village labels (family-less result naming the same core) are
    # handled by _village_only_match; here we only veto explicit conflicts.
    return name_conflict


def _direction_conflict(source: str, result: str) -> bool:
    """True when the names assert different directions (East vs West...)."""
    def direction(name: str) -> str | None:
        words = set(re.findall(r"[a-z]+", name.casefold()))
        present = words & _DIRECTION_WORDS
        if not present:
            return None
        # When several directions appear (unlikely), give up conservatively.
        return next(iter(present)) if len(present) == 1 else "?"

    source_dir = direction(source)
    result_dir = direction(result)
    if source_dir is None or result_dir is None:
        return False
    return source_dir != result_dir and "?" not in {source_dir, result_dir}


_TYPE_WORDS = {
    "kanishta",
    "kanistha",
    "kanitu",
    "viduhala",
    "vidyalaya",
    "vidiyalaya",
    "viddayalaya",
    "viddiyalaya",
    "viddyalaya",
    "vidyalay",
    "prathamika",
    "primary",
    "primery",
    "prirnary",
    "prinary",
    "junior",
    "maha",
    "madhya",
    "madya",
    "mmv",
    "bmv",
    "mv",
    "kv",
    "bv",
    "vv",
    "balika",
    "model",
    "central",
    "national",
    "secondary",
    "seccondry",
    "college",
    "collage",
    "school",
    "mixed",
    "senior",
    "g",  # Galle-zone code ("G/School")
}


def _content_words(name: str) -> list[str]:
    """Name words with school-type words and single letters removed.

    "SRI DHARMARAMA K.V" -> ["sri", "dharmarama"]
    "G/Wickramasinghe K.V" -> ["wickramasinghe"]
    "Sacred Heart Convent" -> ["sacred", "heart", "convent"]
    """
    words = _normalise(name).split()
    return [word for word in words if len(word) > 1 and word not in _TYPE_WORDS]


def _has_type_word(name: str) -> bool:
    """Whether the raw name carries any school-type word at all.

    "YATAGALA M.V." does; the bare village card "Yatagala" does not.
    """
    return _normalise(name).split() != _content_words(name)


def _village_only_match(source: str, result: str) -> bool:
    """True when the result is a bare village label for a longer listing name.

    Village-label cards ("Karandeniya" for "KARANDENIYA K.V.", "Yatagala" for
    "YATAGALA M.V.") usually belong to the village, not to the listed school,
    and are often a sibling's pin.  Rules:

    * identical content words match UNLESS exactly one side carries a school
      type word and the type-less side is a single token ("Yatagala" vs
      "YATAGALA M.V.").  Type-less multi-word names ("Sacred Heart Convent")
      are full school names, not village labels, and type-plus-name spellings
      ("Meepe Amathayana School" for "MEEPE AMATHAYANA PRIMARY SCHOOL") match.
    * a one-token card is only acceptable when it carries a school type word
      ("Samimale School" for "SAMIMALE VIDYANANDA K.V." - Google dropped the
      second name word); a type-less token ("Mahagoda") is the village.
    """
    source_words = _content_words(source)
    result_words = _content_words(result)
    if not source_words or not result_words:
        return False
    if source_words == result_words:
        typed_source, typed_result = _has_type_word(source), _has_type_word(result)
        if typed_source == typed_result:
            return False
        typeless_words = result_words if typed_source else source_words
        return len(typeless_words) == 1
    if len(result_words) == 1 and len(source_words) > 1 and result_words[0] == source_words[0]:
        return not _has_type_word(result)
    return False


def _mid_token_embedding(source: str, result: str) -> bool:
    """True when a short name's word hides mid-word inside the longer name.

    Catches look-alike embeds such as "Ananda" inside "Deerananda" - a real
    Ananda school would be its own word, not the tail of another.  Comparison
    is word-based so legitimate zone prefixes and dropped words ("Galle Muslim
    Ladies College" for "MUSLIM LADIES COLLEGE", "Sri Deerananda..." for
    "Deerananda...") are not punished.
    """
    source_words = _content_words(source)
    result_words = _content_words(result)
    if not source_words or not result_words or source_words == result_words:
        return False
    short_words, long_words = (
        (source_words, result_words) if len(source_words) <= len(result_words) else (result_words, source_words)
    )

    def embeds_mid_word(word: str) -> bool:
        """The word is not a whole word/near-word of the long name but is a
        strict substring of one of its words."""
        for candidate in long_words:
            if candidate == word or difflib.SequenceMatcher(None, word, candidate).ratio() >= 0.8:
                return False  # whole word (or trivial transliteration drift)
            if word in candidate:
                return True
        return False

    return all(embeds_mid_word(word) for word in short_words)


def is_galle_coordinate(latitude: float | None, longitude: float | None) -> bool:
    """Rough Galle-district box, tightened on the south-east corner.

    The original box (lat >= 5.6, lng <= 80.7) also swallowed Matara-district
    results: Google happily returns places 30+ km away that merely share name
    tokens (e.g. "Telijjawila Central College", "Weligama").  Galle's real
    south-east shoreline runs through (5.95, 80.45); everything south-east of
    that line is Matara.  The north-west was trimmed the same way because the
    district border there sits near lat 6.35 / lng 80.05 (Bentota river and the
    Elpitiya ridge), not at the old 5.6/80.7 extremes.
    """
    if latitude is None or longitude is None:
        return False
    if not (5.9 <= latitude <= 6.45 and 79.85 <= longitude <= 80.45):
        return False
    if latitude < 5.95 and longitude > 80.45 - (latitude - 5.6):
        return False
    return True


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


# Tokens too generic to prove two addresses are in the same town.
_GENERIC_HINTS = {
    "galle",
    "southern",
    "sri",
    "lanka",
    "road",
    "street",
    "junction",
    "road,",
}


def location_hints(address: str, division: str, school_name: str) -> tuple[str, ...]:
    """Place tokens from the listing that should appear in a correct Google card.

    Built from the listing's address and division minus the school's own name
    words: for "YATAGALA MALCOM VIDYALAYA / YATAGALA UNAWATUNA (Akmeemana)" the
    useful hint is "unawatuna", not "yatagala" (which all same-village
    siblings share).  The scraper's card addresses carry the nearest town
    ("27C6+XFV, Unawatuna"), so an overlap corroborates an otherwise weak
    name match and its absence keeps us conservative.
    """
    name_words = set(_normalise(school_name).split())
    tokens: list[str] = []
    for token in _normalise(f"{address} {division}").split():
        if len(token) < 4 or token in _GENERIC_HINTS or token in name_words:
            continue
        if token not in tokens:
            tokens.append(token)
    return tuple(tokens)


def location_corroborated(result_address: str | None, hints: tuple[str, ...]) -> bool:
    if not result_address or not hints:
        return False
    address_words = set(_normalise(result_address).split())
    return any(hint in address_words for hint in hints)


def words_match(a: str, b: str) -> bool:
    """Whether two name words are the same word despite Sinhala
    transliteration drift ("Gintota"/"Ginthota", "Mawanana"/"Mawenana")."""
    if a == b:
        return True
    if abs(len(a) - len(b)) <= 1:
        # Longest-common-subsequence similarity handles both insertion drift
        # ("Gintota"/"Ginthota") and substitution drift
        # ("Metiwiliya"/"Mativiliya").
        return difflib.SequenceMatcher(None, a, b).ratio() >= 0.75
    return False


def _claimed_by_sibling(source: str, result: str, sibling_names: tuple[str, ...]) -> bool:
    """Whether another listing row's name plausibly names the same place as ``result``.

    Used to adjudicate type-family conflicts: a "... Kanitu Viduhala" card is
    only dangerous to a "... M.V." listing when a K.V. sibling row exists that
    the card actually matches (Thotagoda Attadassi K.V. vs its M.V. sibling).
    Word-based so order/abbreviations don't matter, but deliberately name-only
    (no family logic) to avoid recursion.
    """
    if not sibling_names:
        return False
    result_words = _content_words(result)
    result_set = set(result_words)
    if not result_words:
        return False
    for sibling in sibling_names:
        if sibling == source:
            continue
        sibling_words = _content_words(sibling)
        if not sibling_words:
            continue
        smaller, larger = (result_set, set(sibling_words)) if len(result_set) <= len(sibling_words) else (set(sibling_words), result_set)
        if len(smaller) < 2:
            continue
        if all(any(words_match(word, other) for other in larger) for word in smaller):
            return True
    return False


def accept(
    source: str,
    result: str,
    *,
    source_is_primary: bool = False,
    result_address: str | None = None,
    location_hints: tuple[str, ...] = (),
    sibling_names: tuple[str, ...] = (),
) -> tuple[bool, float]:
    """True when ``result`` can be trusted as the Google Maps listing of ``source``.

    ``source_is_primary`` comes from the listing's grade span (a "Grade 1-5"
    row is primary regardless of its name), ``result_address`` plus
    ``location_hints`` let listing-place tokens corroborate a borderline name
    match, and ``sibling_names`` are the other listing rows a card could
    belong to - a type-word conflict ("K.V." listing vs "Maha Vidyalaya"
    card) only vetoes when one of those siblings actually matches the card;
    without a sibling the conflict is just Google lagging a rename/upgrade.
    All extras are optional; the plain two-name call stays authoritative.
    """
    score = school_aware_score(source, result)
    # Even a perfect score is untrustworthy when the names actively disagree:
    # sibling schools share every token except the distinguishing one (East vs
    # West, M.V. vs K.V., "Ananda" inside "Deerananda").  These vetoes run
    # before the score threshold, not only under it.
    if _direction_conflict(source, result):
        return False, score
    if _mid_token_embedding(source, result):
        return False, score
    if _village_only_match(source, result):
        return False, score
    if _type_family_conflict(source, result, source_is_primary=source_is_primary):
        # Not every family mismatch is a sibling trap - Google cards lag
        # renames and upgrades ("K.V." became "College").  When another
        # listing row claims this card the card belongs THERE; otherwise a
        # strong name match is the same school despite the stale type word.
        if _claimed_by_sibling(source, result, sibling_names):
            return False, score
        if score < 0.9:
            return False, score
    if score >= 0.94:
        return True, score
    # Below the strict threshold the result must still look like a school and
    # not like a landmark/business/person for us to accept it.
    if _has_non_school_marker(result):
        return False, score
    if not _has_school_keyword(result):
        return False, score
    # Word order never matters ("Kithulampitiya Ananda M.V." vs "Ananda Maha
    # Vidyalaya Kithulampitiya"), so before scoring on bare similarity check
    # whether one name's content words all appear in the other.  Pair words up
    # tolerating one-letter transliteration drift ("Gintota"/"Ginthota",
    # "Mawanana"/"Mawenana") rather than demanding exact equality.
    source_words = _content_words(source)
    result_words = _content_words(result)
    if source_words and result_words:
        def joined(words: list[str]) -> set[str]:
            """Adjacent-word compounds: cards split Sinhala compounds
            ("Dhamma Rathana" for "Dhammarathana")."""
            out = set(words)
            for index in range(len(words) - 1):
                out.add(words[index] + words[index + 1])
            return out

        source_set, result_set = joined(source_words), joined(result_words)
        smaller, larger = (source_set, result_set) if len(source_set) <= len(result_set) else (result_set, source_set)
        if len(smaller) >= 2 and all(any(words_match(word, other) for other in larger) for word in smaller):
            return True, max(score, 0.9)
    # When the cores only resemble each other ("Gihan Pathirana" vs
    # "Dr Richard Pathirana"), require a much stronger similarity than when
    # one core is literally contained in the other ("Gramani Maha V" in
    # "Gramani Maha Vidyalaya"), which is a safe abbreviation pattern.
    source_compact = _compact(source)
    result_compact = _compact(result)
    source_core = _strip_types(source_compact)
    result_core = _strip_types(result_compact)
    substring = bool(source_core and result_core and (source_core in result_core or result_core in source_core))
    threshold = 0.75 if substring else 0.80
    # The listing's place tokens proving the card's address still count for
    # something: with geographic corroboration a near-threshold name match
    # (0.75+) is trustworthy, without one we keep the floors.
    if score >= threshold:
        return True, score
    if score >= 0.75 and location_corroborated(result_address, location_hints):
        return True, max(score, 0.8)
    return False, score


def review_needed(source: str, result: str, score: float) -> bool:
    """Whether this pair deserves a human eyeball in the rescue review list."""
    if score >= 0.94:
        return False
    if _has_non_school_marker(result):
        return False
    return score >= 0.5
