# Disney 2026 Family Park Planner

Thanksgiving Walt Disney World trip, November 24–28, 2026.

| Date | Park | Fixed plans |
|---|---|---|
| 2026-11-24 | Hollywood Studios | Fantasmic! at night |
| 2026-11-25 | Animal Kingdom | Early hotel/pool evening |
| 2026-11-26 | Magic Kingdom | Fireworks |
| 2026-11-27 | Magic Kingdom | Bibbidi Bobbidi Boutique, Cinderella's Royal Table dinner, early night |
| 2026-11-28 | EPCOT | Festival of the Holidays |

## Preferences
Three selected = priority 1; two selected = priority 2; one selected = priority 3. Unchecked is unknown, not necessarily a rejection. The original photo-transcribed workbook is a separate conversation attachment; import its **All Choices** sheet as `choices.csv` into this directory to populate the dashboard. Expected headers: Park,Experience,Min height (in),Type / description,Alberto,Aria,Me,Transcription note,ThemeParks entity ID.

## Development
Run `python disney-26/server.py` at repository root and open http://localhost:8000/disney-26/. Python 3.10+ is sufficient; no packages are required. The local server proxies ThemeParks.wiki REST API calls, caches history for an hour, spaces upstream requests at least 1.1 seconds apart, and honors 429 cooldowns. Optionally set `THEMEPARKS_API_KEY` in the server environment; keys never reach the browser. The server binds only to localhost. See https://api.themeparks.wiki/docs/v1.

Select a day to automatically request the last 12 months of park-wide daily summaries, following every 31-day API page. The API's `earliestAllowedDate` is used when access is restricted: anonymous access provides seven days, a free key 30 days, and a Pro key up to 400 days. Set `THEMEPARKS_API_KEY` in the server environment and restart the server for year-long access. The UI reports the loaded range and whether last Thanksgiving is available. Year/holiday comparisons show **medians of daily medians**, not pooled annual wait percentiles.

Hourly windows use a separate comparison: six recent completed days, last Thanksgiving week (Monday through Sunday), or one selected historical date. Recent/holiday windows match weekdays versus weekends; a specific date is used as selected. Hourly standby p10/median/p90 are duration-weighted and require 30 observed minutes. Closed/down states, implausible waits, degraded openings and stale queue values are excluded. Historical hours and showtimes help compare patterns; they do not confirm future performances.

The CSV's `Transcription note` column now holds categories (a future `Category` column is also supported). Daily category maximums appear at the top of planning; blank is unlimited, zero excludes that category. Generated itineraries honor those caps. Manual dropdown plans report over-limit categories, repeated experiences, height mismatches, and estimated time overruns. The `Transaction Wet` column is retained in the CSV.

Arrival/departure are assumptions until checked against published monthly park hours. Add confirmed reservations as `14:00-15:00 | Boutique`, and additional time points as `12:00, 15:00`. These boundaries divide the day into open sections and fixed reservations. Add ordered dropdown selections to each open section, even when an experience has no history. Category limits, time points, and selections persist separately for each trip day. Changing boundaries retains old selections and reports any hidden sections; restoring the old boundaries recovers them.

Walking and experience durations are editable estimates. Missing height requirements require manual verification. Exact normalized names resolve only when unique; unmatched names need verified CSV entity IDs. Print daily plan uses print-specific styling to show chosen experience names and reservation sections without dropdown controls.

Validation: `node disney-26/analysis.test.js` and `node disney-26/planning.test.js`. Historical cache lives in ignored `disney-26/.cache/`. The checked-in API schema records the integration contract.

## Codex backlog
1. Import and verify all 172 photographed preference rows and Aria's handwritten checks.
2. Resolve park IDs via destinations and children; persist stable entity IDs for every experience. Do not silently match ambiguous titles.
3. Fetch park live data, opening hours, showtimes, all available queue types, and history coverage.
4. Implement a backend history cache with rate limiting and attribution; obtain permitted historical data, then compute median hourly wait and p10/p90 ranges by comparable day type.
5. Prioritize all-three checks; adjust for predicted wait, height eligibility, walk time, ride downtime, showtime conflicts, and reservations.
6. Treat the Thursday fireworks and Tuesday Fantasmic as anchors; Friday dinner and boutique times are not yet supplied.
7. Confirm seasonal event dates and exact entertainment showtimes; never fabricate them.
8. Add Lightning Lane and rider swap planning as manually editable constraints.
9. Add daily itinerary timeline, printable export, and offline caching.

Implemented: live waits, monthly schedule lookup, backend history cache, comparable hourly windows, editable reservation blocks, height filter, daily draft itinerary and browser printing. Remaining: verified preferences/IDs, holiday-specific historical comparison, exact entertainment anchors, geographic walking estimates, rider swap, and offline support.
