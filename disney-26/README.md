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

Confirmed reservations can be imported using **Import reservation JSON**. The file is an array of objects with `date`, `name`, `start` (HH:MM), and nullable `end`. Details stay in browser local storage and are editable/removable; they are not embedded in application source. Reimporting the same date/name/start does not duplicate it. Enter a planning end time before generating the affected day's itinerary or sections. Imported reservations participate in overlap and visiting-hours validation, and print with the daily plan. Confirmation numbers are unnecessary for planning and are not imported.
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

## Activity catalog and calendar

Run `python disney-26/extract_activities.py` to rebuild `activities.csv` from the four HTML files in `saved wdw`. The extractor reads the embedded `ng-state` JSON without executing page scripts or requesting websites. It filters by park, deduplicates website entity IDs, and includes all embedded listings rather than just the 20 rendered cards per page. Original HTML and preferences are preserved.

The CSV contains activity names, Disney website IDs/URLs, thumbnail URLs and existing local image paths, readable tags, raw tag JSON, summaries, height tags, schedule dates, timezones, exact showtimes, raw schedule JSON and source HTML. It has 57 time columns from `08:00` through `22:00`. Values are `open`, `closed`, `opens:HH:MM`, `show:HH:MM`, or blank (not reported). Non-aligned performance starts are placed in the preceding quarter-hour column with the **exact** time in the cell; a 10:50 performance is `show:10:50` under `10:45`. Saved schedules are dated snapshots, not future confirmations.

The daily calendar replaces section dropdowns. Drag cards from the searchable activity library onto an 8 AM–10 PM grid, or select a card and then a time using touch/keyboard. Drag an appointment to move it; edit its duration in multiples of 15 minutes or remove it. Calendar placement enforces visiting hours, reservation overlaps, other appointments, height requirements and daily category caps. Imported reservation details remain only in browser storage. Unknown reservation end times must be entered before scheduling that day. Duration estimates include walking, experience time and historical wait when available; unknown waits remain explicit.

Website activities are linked to family preferences only by unique normalized names. Unmatched names remain available with zero known family votes and separate preference-only cards; ambiguous matches are not guessed. Calendar selections save per day and older dropdown selections migrate once. Changed constraints show conflicts without deleting saved appointments. Printing produces a chronological activity/reservation list instead of the scrolling calendar.

Additional validation: `node disney-26/calendar.test.js` and `python disney-26/extract_activities_test.py`.
