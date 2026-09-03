from __future__ import annotations

import json
import random
import re
import time
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote

from scrapling.fetchers import StealthyFetcher

from .match_logic import accept, review_needed, school_aware_score
from .models import MapSchool, SourceSchool

MAPS_URL = "https://www.google.com/maps"
GOVERNMENT_SCHOOL_SEARCH_URL = "https://www.google.com/maps/search/Government+school/@6.0359809,80.2093232,17z?entry=ttu&g_ep=EgoyMDI2MDgyNi4wIKXMDSoASAFQAw%3D%3D"
CARD_SELECTOR = "div.Nv2PK"
CARD_NAME_SELECTORS = ("div.qBF1Pd", "[role=heading]")
MODAL_NAME_SELECTORS = ("h1.DUwDvf.lfPIob", "h1")
MODAL_ADDRESS_SELECTOR = 'button[data-item-id="address"] .Io6YTe'
MODAL_CLOSE_SELECTOR = 'button[aria-label="Close"]'
FEED_SELECTORS = ('div[role="feed"]', ".m6QErb.DxyBCb", ".m6QErb")


def extract_coordinates_from_url(url: str) -> tuple[float | None, float | None]:
    """Extract a place's coordinates, preferring the place pin over viewport data."""
    if not url:
        return None, None
    patterns = (
        r"!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)",
        r"@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)",
        r"ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)",
    )
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return float(match.group(1)), float(match.group(2))
    return None, None


def _normalise_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def _compact_name(value: str) -> str:
    """Normalize common school-name punctuation and abbreviations for matching."""
    normalized = _normalise_name(value)
    normalized = normalized.replace("saint", "st")
    normalized = normalized.replace("maha vidyalaya", "mv")
    normalized = normalized.replace("m m v", "mmv")
    normalized = normalized.replace("m v", "mv")
    normalized = normalized.replace("k v", "kv")
    normalized = normalized.replace("b v", "bv")
    return re.sub(r"[^a-z0-9]+", "", normalized)


def _name_match_score(source: str, result: str) -> float:
    source_name = _compact_name(source)
    result_name = _compact_name(result)
    if not source_name or not result_name:
        return 0.0
    if source_name == result_name:
        return 1.0
    if source_name in result_name or result_name in source_name:
        return 0.96
    return SequenceMatcher(None, source_name, result_name).ratio()


def _is_galle_coordinate(latitude: float | None, longitude: float | None) -> bool:
    return latitude is not None and longitude is not None and 5.6 <= latitude <= 6.6 and 79.7 <= longitude <= 80.7


def record_attempt(
    status: str,
    *,
    result_name: str | None = None,
    score: float | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    """Outcome of a per-school lookup that did not end up in the coordinate cache."""
    return {
        "status": status,  # "no-match" | "review" | "no-result" | "error"
        "result": result_name,
        "score": score,
        "note": note,
        "ts": round(time.time(), 1),
    }


def load_attempts(path: Path) -> dict[str, dict[str, Any]]:
    """Recorded failed lookups (school_id -> outcome), if any."""
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {key: value for key, value in raw.items() if isinstance(value, dict)}


def save_attempts(path: Path, attempts: dict[str, dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(attempts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def save_cache(path: Path, cache: dict[str, MapSchool]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({key: value.to_dict() for key, value in cache.items()}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


class GoogleMapsScraper:
    """Scrape Google Maps place cards using the same card/modal flow as Doca."""

    def __init__(self, *, headless: bool = True, timeout_ms: int = 45_000):
        self.headless = headless
        self.timeout_ms = timeout_ms

    @staticmethod
    def _first_locator(page: Any, selectors: Iterable[str]) -> Any | None:
        for selector in selectors:
            locator = page.locator(selector).first
            try:
                if locator.count() > 0:
                    return locator
            except Exception:
                continue
        return None

    @classmethod
    def _text(cls, page: Any, selectors: Iterable[str], timeout_ms: int = 2_000) -> str | None:
        locator = cls._first_locator(page, selectors)
        if locator is None:
            return None
        try:
            value = locator.inner_text(timeout=timeout_ms)
            return value.strip() if value else None
        except Exception:
            return None

    @classmethod
    def _extract_modal(cls, page: Any) -> MapSchool | None:
        try:
            page.wait_for_selector(MODAL_NAME_SELECTORS[0], timeout=5_000)
        except Exception:
            pass
        name = cls._text(page, (MODAL_NAME_SELECTORS[0],), timeout_ms=3_000)
        if not name and "/maps/place/" in page.url:
            name = cls._text(page, ("h1",), timeout_ms=1_000)
        if not name:
            return None
        latitude, longitude = extract_coordinates_from_url(page.url)
        if not _is_galle_coordinate(latitude, longitude):
            return None

        address = cls._text(page, (MODAL_ADDRESS_SELECTOR,), timeout_ms=1_000)
        place_id_match = re.search(r"!1s([^!]+)", page.url)
        return MapSchool(
            name=name,
            latitude=latitude,
            longitude=longitude,
            address=address,
            place_id=place_id_match.group(1) if place_id_match else None,
            url=page.url,
        )

    @staticmethod
    def _close_modal(page: Any) -> None:
        try:
            close = page.locator(MODAL_CLOSE_SELECTOR).first
            if close.count() > 0:
                close.click(timeout=1_500)
            else:
                page.keyboard.press("Escape")
            time.sleep(0.25)
            if "/maps/place/" in page.url:
                page.go_back(timeout=5_000)
                page.wait_for_timeout(500)
        except Exception:
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass

    @staticmethod
    def _scroll_feed(page: Any) -> None:
        for selector in FEED_SELECTORS:
            try:
                if page.locator(selector).first.count() > 0:
                    page.evaluate(
                        """(selector) => {
                            const feed = document.querySelector(selector);
                            if (feed) feed.scrollTop += 1200;
                        }""",
                        selector,
                    )
                    time.sleep(1)
                    return
            except Exception:
                continue

    def search_and_extract(
        self,
        query: str,
        *,
        limit: int | None = 1,
        search_url: str | None = None,
        required_category: str | None = None,
        timeout_ms: int | None = None,
    ) -> list[MapSchool]:
        """Extract Galle place cards, optionally filtering by their card category."""
        results: list[MapSchool] = []
        seen_names: set[str] = set()
        processed_cards: set[str] = set()
        maps_url = search_url or f"{MAPS_URL}/search/{quote(query)}"
        effective_timeout_ms = timeout_ms or self.timeout_ms

        def workflow(page: Any) -> Any:
            deadline = time.monotonic() + effective_timeout_ms / 1_000
            page.wait_for_timeout(5_000)
            if "/maps/place/" in page.url:
                place = self._extract_modal(page)
                if place is not None:
                    results.append(place)
                return page

            links: list[tuple[str, str]] = []
            idle_rounds = 0
            while time.monotonic() < deadline:
                cards = page.locator(CARD_SELECTOR)
                card_count = cards.count()
                if card_count == 0:
                    self._scroll_feed(page)
                    page.wait_for_timeout(1_500)
                    continue

                new_cards = 0
                for index in range(card_count):
                    if limit is not None and len(links) >= limit:
                        break
                    card = cards.nth(index)
                    card_name = self._text(card, CARD_NAME_SELECTORS, timeout_ms=750)
                    try:
                        card_text = card.inner_text(timeout=750) or ""
                    except Exception:
                        card_text = ""
                    card_key = _normalise_name(card_name or card_text[:160])
                    if not card_key or card_key in processed_cards:
                        continue
                    processed_cards.add(card_key)
                    new_cards += 1
                    if required_category and required_category.casefold() not in card_text.casefold():
                        continue
                    link = card.locator("a").first
                    try:
                        href = link.get_attribute("href") if link.count() > 0 else None
                    except Exception:
                        href = None
                    if not href or not card_name or _normalise_name(card_name) in seen_names:
                        continue
                    links.append((card_name, href))
                    seen_names.add(_normalise_name(card_name))

                if limit is not None and len(links) >= limit:
                    break
                idle_rounds = idle_rounds + 1 if new_cards == 0 else 0
                if idle_rounds >= 6:
                    break
                self._scroll_feed(page)
                page.wait_for_timeout(1_500)

            seen_places: set[str] = set()
            for card_name, href in links:
                if limit is not None and len(results) >= limit:
                    break
                try:
                    page.goto(href, timeout=min(effective_timeout_ms, 30_000))
                    page.wait_for_timeout(1_200)
                    place = self._extract_modal(page)
                    if place is not None and _normalise_name(place.name) not in seen_places:
                        results.append(place)
                        seen_places.add(_normalise_name(place.name))
                except Exception:
                    continue
            return page

        StealthyFetcher.fetch(
            maps_url,
            headless=self.headless,
            network_idle=False,
            page_action=workflow,
            google_search=False,
            timeout=effective_timeout_ms,
        )
        return results

    def search_school(self, school: SourceSchool) -> MapSchool | None:
        query = f"{school.name}, {school.address}, Galle, Sri Lanka"
        results = self.search_and_extract(query, limit=3)
        if not results:
            return None

        # Rank candidates with the school-aware matcher rather than picking the
        # one that merely shares a name token, so a result Google spells
        # differently (abbreviations, "K.V." vs "Vidyalaya", ...) still surfaces.
        return max(results, key=lambda result: school_aware_score(school.name, result.name))

    def scrape_coordinates(
        self,
        schools: Iterable[SourceSchool],
        *,
        cache_path: Path,
        delay_seconds: float = 1.0,
        scrape_feed: bool = True,
        feed_timeout_seconds: float = 900.0,
        retry_unmatched: bool = False,
    ) -> dict[str, MapSchool]:
        """Scrape the Galle Government school result feed and match it to PDF rows.

        Schools the feed does not cover get an individual Google Maps lookup so
        every PDF row can receive coordinates.

        Already-extracted schools are never re-requested: rows in the
        coordinate cache are kept as-is, and lookups that found nothing are
        recorded next to the cache (map_attempts.json) so later runs skip them
        too. Pass ``retry_unmatched=True`` to re-request previously recorded
        misses (e.g. after reviewing borderline candidates).
        """
        cache: dict[str, MapSchool] = {}
        if cache_path.exists():
            raw = json.loads(cache_path.read_text(encoding="utf-8"))
            cache = {key: MapSchool(**value) for key, value in raw.items()}

        schools = list(schools)
        results_path = cache_path.with_name("government_school_results.json")
        results: list[MapSchool] = []
        if scrape_feed:
            results = self.search_and_extract(
                "Government school",
                limit=None,
                search_url=GOVERNMENT_SCHOOL_SEARCH_URL,
                required_category="Government school",
                timeout_ms=max(int(feed_timeout_seconds * 1_000), 60_000),
            )
            results_path.parent.mkdir(parents=True, exist_ok=True)
            results_path.write_text(
                json.dumps([result.to_dict() for result in results], ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        elif results_path.exists():
            raw = json.loads(results_path.read_text(encoding="utf-8"))
            results = [MapSchool(**value) for value in raw]

        source_by_id = {school.school_id: school for school in schools}
        # Keep every previously extracted school. Re-validating cached rows or
        # dropping those a school-aware pass accepted below the strict feed
        # threshold would force a repeat Google Maps request for the same place.
        cache = {
            school_id: result
            for school_id, result in cache.items()
            if school_id in source_by_id
            and result.latitude is not None
            and result.longitude is not None
            and (result.url or "").startswith("https://www.google.com/maps")
        }
        used_school_ids = set(cache)
        matches = 0

        attempts_path = cache_path.with_name("map_attempts.json")
        attempts = load_attempts(attempts_path)
        for result in results:
            candidates = sorted(
                (
                    (_name_match_score(school.name, result.name), school)
                    for school in schools
                    if school.school_id not in used_school_ids
                ),
                key=lambda item: item[0],
                reverse=True,
            )
            if not candidates:
                continue
            score, school = candidates[0]
            if score < 0.94:
                continue
            cache[school.school_id] = result
            used_school_ids.add(school.school_id)
            attempts.pop(school.school_id, None)
            matches += 1
            print(f"  -> {school.school_id}: {school.name} <= {result.name} ({score:.2f})")
            if delay_seconds > 0:
                time.sleep(delay_seconds * random.uniform(0.7, 1.3))

        previous = {
            school_id: attempt
            for school_id, attempt in attempts.items()
            if school_id in source_by_id and school_id not in used_school_ids
        }
        if previous and not retry_unmatched:
            print(
                f"Skipping {len(previous)} schools already looked up and recorded in "
                f"{attempts_path.name} (pass --retry-unmatched to re-request them)"
            )
        pending = [
            school
            for school in schools
            if school.school_id not in used_school_ids
            and (retry_unmatched or school.school_id not in attempts)
        ]
        if pending:
            print(f"Per-school lookups for {len(pending)} remaining schools...")

        review_lines: list[str] = []
        accepted_new = 0
        for index, school in enumerate(pending, 1):
            school_id = school.school_id
            try:
                result = self.search_school(school)
            except Exception as exc:  # noqa: BLE001
                attempts[school_id] = record_attempt("error", note=f"{type(exc).__name__}: {exc}"[:200])
                print(f"  [{index}/{len(pending)}] {school_id}: {school.name} -- ERROR {exc}")
            else:
                if result is None:
                    attempts[school_id] = record_attempt("no-result")
                    print(f"  [{index}/{len(pending)}] {school_id}: {school.name} -- NO RESULT")
                else:
                    ok, score = accept(school.name, result.name)
                    if ok:
                        cache[school_id] = result
                        used_school_ids.add(school_id)
                        attempts.pop(school_id, None)
                        accepted_new += 1
                        note = "" if score >= 0.94 else " (school-aware match)"
                        print(f"  [{index}/{len(pending)}] {school_id}: {school.name} <= {result.name}{note} ({score:.2f})")
                    else:
                        flag = review_needed(school.name, result.name, score)
                        status = "review" if flag else "no-match"
                        attempts[school_id] = record_attempt(status, result_name=result.name, score=round(score, 2))
                        if flag:
                            review_lines.append(f"{school_id}\t{school.name}\t{result.name}\t{score:.2f}\tborderline-reject")
                        print(f"  [{index}/{len(pending)}] {school_id}: {school.name} -- {'REVIEW' if flag else 'reject'} ({result.name}, {score:.2f})")
            save_cache(cache_path, cache)
            save_attempts(attempts_path, attempts)
            if delay_seconds > 0:
                # Jitter the gap so a long run does not land on a fixed rhythm.
                time.sleep(delay_seconds * random.uniform(0.7, 1.3))

        save_cache(cache_path, cache)
        save_attempts(attempts_path, attempts)
        if review_lines:
            review_path = cache_path.with_name("rescue_review.txt")
            review_path.write_text("\n".join(review_lines) + "\n", encoding="utf-8")
            print(f"Borderline candidates for human review: {len(review_lines)} -> {review_path}")
        print(
            f"Maps Government school results: {len(results)}; matched new PDF rows: {matches}; "
            f"per-school matched this run: {accepted_new}; cached rows: {len(cache)}"
        )
        return cache
