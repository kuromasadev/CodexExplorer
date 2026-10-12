"""Extract saved Disney listings without running their scripts or making requests."""
import csv
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urljoin

ROOT = Path(__file__).resolve().parent
PARKS = {'Magic': ('Magic Kingdom', 'magic-kingdom'), 'Animal': ('Animal Kingdom', 'animal-kingdom'),
         'Hollywood': ('Hollywood Studios', 'hollywood-studios'), 'EPCOT': ('EPCOT', 'epcot')}
SLOTS = [f'{minute//60:02}:{minute%60:02}' for minute in range(480, 1321, 15)]


class SavedPage(HTMLParser):
    def __init__(self):
        super().__init__()
        self.state = []
        self.in_state = False
        self.card = None
        self.images = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('id') == 'ng-state':
            self.in_state = True
        if tag == 'finder-list-card':
            self.card = attrs.get('data-entity-id')
        if tag == 'img' and self.card and attrs.get('src'):
            self.images[self.card] = attrs['src']

    def handle_endtag(self, tag):
        if tag == 'script':
            self.in_state = False
        if tag == 'finder-list-card':
            self.card = None

    def handle_data(self, data):
        if self.in_state:
            self.state.append(data)


def activities(value):
    if isinstance(value, dict):
        if value.get('id') and value.get('parkIds') and value.get('name') and value.get('url'):
            yield value
        else:
            for item in value.values():
                yield from activities(item)
    elif isinstance(value, list):
        for item in value:
            yield from activities(item)


def minute(time):
    hours, minutes = map(int, time.split(':')[:2])
    return hours * 60 + minutes


def slot_values(schedules):
    result = {slot: '' for slot in SLOTS}
    for schedule in schedules:
        start, end = schedule.get('startTime'), schedule.get('endTime')
        if not start:
            continue
        if schedule.get('isClosed'):
            continue
        if 'performance' in schedule.get('type', '').lower():
            bucket = minute(start) // 15 * 15
            key = f'{bucket//60:02}:{bucket%60:02}'
            if key in result:
                result[key] = '|'.join(filter(None, [result[key], 'show:' + start[:5]]))
        elif schedule.get('type', '').lower() == 'operating' and end:
            first, last = minute(start), minute(end)
            if last < first:
                last += 1440
            for slot in SLOTS:
                # A non-aligned opening is retained exactly rather than called open early.
                t = minute(slot)
                if first < t + 15 and last > t:
                    result[slot] = 'open' if first <= t else 'opens:' + start[:5]
    if schedules and all(s.get('isClosed') for s in schedules):
        return {slot: 'closed' for slot in SLOTS}
    return result


def extract():
    output = []
    for file in sorted((ROOT / 'saved wdw').glob('*.html')):
        matched = next((v for k, v in PARKS.items() if file.name.startswith(k)), None)
        if not matched:
            continue
        park, slug = matched
        parser = SavedPage()
        parser.feed(file.read_text(encoding='utf-8'))
        document = json.loads(''.join(parser.state))
        seen = set()
        for activity in activities(document):
            if f'/{slug}/' not in activity['url'] or activity['id'] in seen:
                continue
            seen.add(activity['id'])
            thumbnail = activity.get('media', {}).get('finderStandardThumb', {})
            image = parser.images.get(activity['id'], '')
            local = ''
            if image.startswith('./'):
                candidate = file.parent / unquote(image[2:])
                if candidate.is_file() and candidate.resolve().is_relative_to(ROOT):
                    local = candidate.relative_to(ROOT).as_posix()
            schedules = activity.get('schedule', {}).get('schedules', [])
            dates = sorted({s.get('date') for s in schedules if s.get('date')}) or [document.get('date the page was rendered', '')]
            tags = activity.get('facets', {})
            readable = list(dict.fromkeys(tag.replace('-', ' ') for facet in ('thrillFactor', 'interests', 'age', 'height') for tag in tags.get(facet, [])))
            for date in dates:
                daily = [s for s in schedules if s.get('date') == date]
                shows = [s['startTime'][:5] for s in daily if 'performance' in s.get('type', '').lower() and not s.get('isClosed')]
                row = {'Park': park, 'Experience': activity['name'], 'Website entity ID': activity['id'],
                       'Website URL': urljoin('https://disneyworld.disney.go.com', activity['url']),
                       'Thumbnail URL': thumbnail.get('url', ''), 'Thumbnail local': local,
                       'Thumbnail alt': thumbnail.get('alt', ''), 'Summary': activity.get('type', {}).get('facets', ''),
                       'Tags': '|'.join(readable), 'Tags JSON': json.dumps(tags, ensure_ascii=False, separators=(',', ':')),
                       'Height tags': '|'.join(tags.get('height', [])), 'Schedule date': date,
                       'Timezone': activity.get('schedule', {}).get('timeZone', 'America/New_York'),
                       'Showtimes': '|'.join(shows), 'Schedule JSON': json.dumps(daily, separators=(',', ':')),
                       'Schedule status': 'snapshot' if daily else 'unknown', 'Source HTML': file.relative_to(ROOT).as_posix()}
                row.update(slot_values(daily))
                output.append(row)
    fields = list(output[0]) if output else []
    with (ROOT / 'activities.csv').open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(output)
    print(f'Extracted {len(output)} activity/date rows, {sum(bool(r["Thumbnail local"]) for r in output)} local thumbnails.')
    for park, _ in PARKS.values():
        print(park, sum(r['Park'] == park for r in output))


if __name__ == '__main__':
    extract()
