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
Run `python -m http.server 8000` at repository root and open `/disney-26/`. Use ThemeParks.wiki REST API `https://api.themeparks.wiki/v1`. The browser uses anonymous API calls; a free key gives longer historical access but must never be embedded in client-side code. See https://api.themeparks.wiki/docs/v1.

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

The prototype only shows live waits when the API provides them. A future-time recommendation is not yet implemented.
