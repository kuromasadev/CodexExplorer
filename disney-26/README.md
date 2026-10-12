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

Select a day, click **Analyze recent history**, then **Build itinerary**. Six completed recent park-local days are fetched park-wide (plus one coverage request), within the anonymous seven-day window. Hourly standby p10/median/p90 are weighted by time, filtered to weekdays or weekends matching the visit, and require 30 observed minutes. Closed/down states, implausible waits, degraded openings and stale queue values are excluded. A conservative four-hour queue freshness cap can leave gaps in unchanged waits. These recent patterns do not model Thanksgiving crowds; sample days and minutes are retained in the analysis output.

Arrival/departure are assumptions until checked against published monthly park hours. Walk and attraction duration are editable estimates. Add confirmed reservations and arrival buffers as `14:00-15:00 | Boutique`; settings persist per day in the browser. The greedy itinerary prioritizes family votes, then lower hourly medians, respects blocks and optional rider height, and lists unscheduled choices. Missing height values require manual verification. Exact normalized names resolve only when unique; unmatched names need verified CSV entity IDs. Live showtimes and current closures are not treated as predictions for November. The print button exports the displayed plan through the browser.

Validation: `node disney-26/analysis.test.js`. Historical data cache lives in ignored `disney-26/.cache/`. The checked-in API schema records the integration contract.

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
