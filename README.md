# BC Assessment year-built scraper

Looks up the **year built** for a list of BC addresses by querying
`bcassessment.ca`'s public property search.

## Warning — Terms of Use

BC Assessment's site Terms of Use prohibit automated access. Using this script
puts you at risk of IP blocks and (at scale) legal complaint. For anything
beyond ad-hoc personal lookups, use BC Assessment's paid bulk data products:
<https://www.bcassessment.ca/Property/Data>.

## Install

```sh
pip install -r requirements.txt
```

## Use

Create an `addresses.csv` with a header row:

```csv
address
1234 Main St, Vancouver, BC
567 Oak Ave, Victoria, BC
```

Run:

```sh
python scraper.py --input addresses.csv --output results.json
```

Optional flags:

- `--delay 1.5` — base seconds between requests (default 1.5)
- `--jitter 0.7` — extra random delay (default 0.7)
- `--limit 5` — only process the first N rows (useful for first run / debugging)
- `-v` — verbose logging

Output is incremental, so killing the run mid-way still leaves a valid JSON
file of everything completed so far.

## Output

```json
[
  {
    "address": "1234 Main St, Vancouver, BC",
    "year_built": 1978,
    "folio": "...",
    "property_url": "https://www.bcassessment.ca/Property/Info/...",
    "matched_address": "1234 MAIN ST, VANCOUVER",
    "error": null,
    "input_row": {"address": "1234 Main St, Vancouver, BC"}
  }
]
```

If `year_built` is `null`, `error` describes why:
- `no_suggestion` — search returned no match for the address string
- `no_property_link` — match returned but no usable URL/folio
- `property_fetch_failed` — non-200 fetching the detail page
- `year_not_found` — page loaded but no Year Built parsed (check selector)
- `request_error: ...` — network/HTTP error after retries

## You will need to verify two things on first run

I couldn't reach `bcassessment.ca` from the environment where this was written,
so the exact endpoint paths and HTML selectors are best-effort. The two
`# VERIFY` comments in `scraper.py` mark the places to confirm:

1. **Suggestion endpoint** in `search_address()` — open the site in a browser,
   type an address in the search box, watch the Network tab, and confirm the
   JSON endpoint path and response shape. Update the `candidates` list if
   it's different.
2. **Year Built selector** in `parse_year_built()` — view-source on one
   property detail page. The parser tries three strategies (label/value pair,
   sibling text, regex over the whole document); if all three miss, tighten
   to the actual element.

Run with `--limit 1 -v` first to validate end-to-end on a single address
before unleashing on hundreds.

## Rate limiting and being a good citizen

Defaults are 1.5s + up to 0.7s jitter between requests (~30 req/min). On 429
or 5xx the script backs off exponentially (2s, 4s, 8s, 16s) before retrying,
up to 4 attempts. **Do not lower these.** If you start seeing 403s or
repeated 429s, you are being rate-limited; stop and back off for hours, not
minutes.
