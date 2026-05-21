"""
BC Assessment year-built scraper.

Reads a CSV of addresses, queries bcassessment.ca for each, and writes a JSON
file mapping each address to its year built (and folio/PID where available).

USAGE
    python scraper.py --input addresses.csv --output results.json

CSV FORMAT
    A header row with a column named `address`. Other columns are ignored but
    preserved in the output under `input_row`.

IMPORTANT
    BC Assessment's Terms of Use prohibit automated scraping. Use this at your
    own risk and only for legitimate, low-volume lookups. For bulk data, see
    https://www.bcassessment.ca/Property/Data.

    This script makes a best-effort attempt at the public search flow. The
    exact endpoint paths and HTML structure are NOT verified in this repo's
    build environment (network egress to bcassessment.ca was blocked). The two
    places most likely to need adjustment after a local test run are marked
    with `# VERIFY` comments below: the suggestion endpoint and the year-built
    parser.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import random
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Optional
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

BASE = "https://www.bcassessment.ca"

# Realistic desktop Chrome headers. BC Assessment's edge rejects clients that
# don't look like a browser, so we keep these consistent across the session.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-CA,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
    "Sec-Fetch-Dest": "document",
}

# Conservative defaults. Higher rates will get you blocked quickly.
DEFAULT_DELAY_S = 1.5
DEFAULT_JITTER_S = 0.7
MAX_ATTEMPTS = 4

log = logging.getLogger("bca")


@dataclass
class Result:
    address: str
    year_built: Optional[int] = None
    folio: Optional[str] = None
    property_url: Optional[str] = None
    matched_address: Optional[str] = None
    error: Optional[str] = None
    input_row: dict = field(default_factory=dict)


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    # Warm the session with the homepage so we pick up any anti-CSRF cookies
    # the site sets before the search endpoint will respond.
    try:
        s.get(BASE + "/", timeout=30)
    except requests.RequestException as e:
        log.warning("homepage warmup failed: %s", e)
    return s


def polite_sleep(delay: float, jitter: float) -> None:
    time.sleep(delay + random.uniform(0, jitter))


def request_with_backoff(
    session: requests.Session,
    method: str,
    url: str,
    **kwargs,
) -> requests.Response:
    """GET/POST with exponential backoff on 429 and 5xx."""
    last_exc: Optional[Exception] = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            resp = session.request(method, url, timeout=30, **kwargs)
            if resp.status_code in (429, 500, 502, 503, 504):
                wait = (2 ** attempt) + random.uniform(0, 1)
                log.warning(
                    "got %s from %s, backing off %.1fs (attempt %d/%d)",
                    resp.status_code, url, wait, attempt, MAX_ATTEMPTS,
                )
                time.sleep(wait)
                continue
            return resp
        except requests.RequestException as e:
            last_exc = e
            wait = (2 ** attempt) + random.uniform(0, 1)
            log.warning(
                "request to %s raised %s, retrying in %.1fs",
                url, e, wait,
            )
            time.sleep(wait)
    if last_exc is not None:
        raise last_exc
    raise RuntimeError(f"exhausted retries calling {url}")


# VERIFY: This is the public address-suggestion endpoint used by the search box
# typeahead. Open bcassessment.ca, type an address, and watch the Network tab
# to confirm the exact path and query params. As of recent observation it has
# been served from a path under /Property/UsageAndSales/ or a similar JSON
# endpoint that returns {Suggestions: [{Folio, FullAddress, ...}]}. If the
# endpoint moves, only this function should need updating.
def search_address(session: requests.Session, address: str) -> Optional[dict]:
    candidates = [
        f"{BASE}/Property/UsageAndSales/GetAddressSuggestions",
        f"{BASE}/Property/Search/GetSuggestions",
    ]
    for url in candidates:
        try:
            resp = request_with_backoff(
                session, "GET", url,
                params={"query": address, "count": 5},
                headers={"X-Requested-With": "XMLHttpRequest",
                         "Accept": "application/json, text/javascript, */*; q=0.01"},
            )
        except requests.RequestException:
            continue
        if resp.status_code != 200:
            continue
        try:
            data = resp.json()
        except ValueError:
            continue
        suggestions = data.get("Suggestions") or data.get("suggestions") or data
        if not suggestions:
            continue
        first = suggestions[0] if isinstance(suggestions, list) else suggestions
        return first
    return None


def fetch_property_page(session: requests.Session, folio_or_url: str) -> Optional[str]:
    """Fetch the property detail HTML. `folio_or_url` may be a folio id or
    a full Url returned by the suggestion endpoint."""
    if folio_or_url.startswith("http"):
        url = folio_or_url
    elif folio_or_url.startswith("/"):
        url = BASE + folio_or_url
    else:
        # Folio-based deep link. The site uses a base64-ish encoded id in the
        # URL path; if your suggestion payload contains a `Url` field, prefer
        # that. This is a fallback shape.
        url = f"{BASE}/Property/Info/{quote(folio_or_url)}"
    resp = request_with_backoff(session, "GET", url)
    if resp.status_code != 200:
        log.warning("property page returned %s for %s", resp.status_code, url)
        return None
    return resp.text


# VERIFY: BC Assessment renders the year built under a "Year Built" label in a
# definition-list-like block in the property summary. We try a few strategies
# so small markup changes don't break us; if all fail, inspect the HTML once
# locally and tighten the selector.
YEAR_LABEL_RE = re.compile(r"year\s*built", re.IGNORECASE)
YEAR_VALUE_RE = re.compile(r"\b(1[89]\d{2}|20\d{2}|21\d{2})\b")


def parse_year_built(html: str) -> Optional[int]:
    soup = BeautifulSoup(html, "lxml")

    # Strategy 1: explicit label/value pair (dt/dd, th/td, or label spans).
    for label in soup.find_all(string=YEAR_LABEL_RE):
        parent = label.parent
        # Sibling cell (table / dl).
        sibling = parent.find_next_sibling() if parent else None
        for candidate in (sibling, parent.parent if parent else None):
            if candidate is None:
                continue
            m = YEAR_VALUE_RE.search(candidate.get_text(" ", strip=True))
            if m:
                return int(m.group(1))

    # Strategy 2: any element whose text contains "Year Built ####".
    for el in soup.find_all(string=YEAR_LABEL_RE):
        context = el.parent.get_text(" ", strip=True) if el.parent else ""
        m = YEAR_VALUE_RE.search(context)
        if m:
            return int(m.group(1))

    # Strategy 3: whole-document fallback. Last resort; may catch the wrong
    # year if multiple appear.
    text = soup.get_text(" ", strip=True)
    m = re.search(r"year\s*built[^0-9]{0,15}(1[89]\d{2}|20\d{2}|21\d{2})",
                  text, re.IGNORECASE)
    if m:
        return int(m.group(1))

    return None


def scrape_one(session: requests.Session, address: str, input_row: dict) -> Result:
    result = Result(address=address, input_row=input_row)
    try:
        suggestion = search_address(session, address)
        if not suggestion:
            result.error = "no_suggestion"
            return result

        result.matched_address = (
            suggestion.get("FullAddress")
            or suggestion.get("Address")
            or suggestion.get("Label")
        )
        result.folio = suggestion.get("Folio") or suggestion.get("folio")

        link = (
            suggestion.get("Url")
            or suggestion.get("DetailUrl")
            or result.folio
        )
        if not link:
            result.error = "no_property_link"
            return result

        html = fetch_property_page(session, link)
        if html is None:
            result.error = "property_fetch_failed"
            return result
        result.property_url = link if link.startswith("http") else BASE + link if link.startswith("/") else None

        year = parse_year_built(html)
        if year is None:
            result.error = "year_not_found"
            return result
        result.year_built = year
        return result
    except requests.RequestException as e:
        result.error = f"request_error: {e}"
        return result
    except Exception as e:  # noqa: BLE001 — keep one bad row from killing the run
        result.error = f"unexpected: {e!r}"
        return result


def read_addresses(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None or "address" not in reader.fieldnames:
            raise SystemExit(
                f"{path}: missing required header column `address`. "
                f"Got: {reader.fieldnames}"
            )
        return [row for row in reader if (row.get("address") or "").strip()]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="CSV with an `address` column")
    parser.add_argument("--output", required=True, help="Path to write JSON results")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_S,
                        help="Base delay between requests in seconds (default 1.5)")
    parser.add_argument("--jitter", type=float, default=DEFAULT_JITTER_S,
                        help="Random jitter added to delay (default 0.7)")
    parser.add_argument("--limit", type=int, default=None,
                        help="Only process the first N rows (for testing)")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    rows = read_addresses(args.input)
    if args.limit:
        rows = rows[: args.limit]
    log.info("loaded %d addresses from %s", len(rows), args.input)

    session = make_session()
    results: list[Result] = []

    for i, row in enumerate(rows, 1):
        address = row["address"].strip()
        log.info("[%d/%d] %s", i, len(rows), address)
        result = scrape_one(session, address, input_row=row)
        if result.error:
            log.warning("  -> %s", result.error)
        else:
            log.info("  -> %s (folio %s)", result.year_built, result.folio)
        results.append(result)

        # Persist incrementally so a long run isn't lost on interrupt.
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump([asdict(r) for r in results], f, indent=2, ensure_ascii=False)

        if i < len(rows):
            polite_sleep(args.delay, args.jitter)

    succeeded = sum(1 for r in results if r.year_built is not None)
    log.info("done: %d/%d addresses resolved", succeeded, len(results))
    return 0 if succeeded > 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
