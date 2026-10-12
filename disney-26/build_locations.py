"""Resolve preference/catalog rows to park-scoped API entities and persist provenance."""
import csv
from datetime import datetime, timezone
import json
from pathlib import Path
import re
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent


def norm(name):
    return re.sub(r'[^a-z0-9]', '', name.lower())


def resolve(row, entities, website):
    explicit = row.get('ThemeParks entity ID', '')
    if explicit:
        hits = [e for e in entities if e['id'] == explicit]
        return (hits[0], 'explicit ID') if len(hits) == 1 else (None, 'invalid explicit ID')
    operator_ids = {r['Website entity ID'] for r in website if norm(r['Experience']) == norm(row['Experience'])}
    if row.get('Website entity ID'):
        operator_ids = {row['Website entity ID']}
    hits = [e for e in entities if e.get('externalId') in operator_ids]
    if len(hits) == 1:
        return hits[0], 'operator ID'
    hits = [e for e in entities if norm(e['name']) == norm(row['Experience'])]
    if not hits and (ROOT / 'entity-aliases.json').exists():
        aliases = json.loads((ROOT / 'entity-aliases.json').read_text(encoding='utf-8'))
        alias = aliases.get(row['Experience'])
        hits = [e for e in entities if alias and e['name'] == alias]
        if len(hits) == 1:
            return hits[0], 'reviewed name expansion'
    return (hits[0], 'unique normalized name') if len(hits) == 1 else (None, 'ambiguous' if len(hits) > 1 else 'unmatched')


def main():
    def get(path):
        with urlopen('http://127.0.0.1:8000/api/' + path, timeout=60) as response:
            return json.load(response)
    with (ROOT / 'choices.csv').open(encoding='utf-8-sig', newline='') as file:
        choices = list(csv.DictReader(file))
    with (ROOT / 'activities.csv').open(encoding='utf-8-sig', newline='') as file:
        activities = list(csv.DictReader(file))
    destination = next(d for d in get('destinations')['destinations'] if 'Walt Disney World' in d['name'])
    document = {'verifiedAt': datetime.now(timezone.utc).isoformat(), 'source': 'https://api.themeparks.wiki/v1', 'parks': {}, 'matches': []}
    for park in sorted({r['Park'] for r in choices}):
        matches = [p for p in destination['parks'] if park.lower() in p['name'].lower()]
        if len(matches) != 1:
            raise ValueError('Ambiguous park: ' + park)
        park_id = matches[0]['id']
        entities = get(f'entity/{park_id}/children')['children']
        document['parks'][park] = {'id': park_id, 'entities': entities}
        website = [r for r in activities if r['Park'] == park]
        for kind, source in [('preference', choices), ('website', activities)]:
            for row in (r for r in source if r['Park'] == park):
                entity, method = resolve(row, entities, website)
                location = entity.get('location', {}) if entity else {}
                lat, lng = location.get('latitude'), location.get('longitude')
                valid = isinstance(lat, (float, int)) and isinstance(lng, (float, int)) and 28.30 < lat < 28.50 and -81.65 < lng < -81.45
                document['matches'].append({'park': park, 'name': row['Experience'], 'kind': kind, 'websiteId': row.get('Website entity ID'), 'entityId': entity['id'] if entity else None, 'entityName': entity['name'] if entity else None, 'method': method, 'location': location if valid else None, 'status': 'verified API location' if valid else 'matched; coordinates unavailable' if entity else method, 'source': f'https://api.themeparks.wiki/v1/entity/{park_id}/children'})
    (ROOT / 'entity-locations.json').write_text(json.dumps(document, indent=2, ensure_ascii=False), encoding='utf-8')
    fields = ['Park', 'Experience', 'Row source', 'ThemeParks entity ID', 'API name', 'Latitude', 'Longitude', 'Match method', 'Location status', 'Verified at', 'Source']
    with (ROOT / 'attraction-locations.csv').open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for r in document['matches']:
            location = r['location'] or {}
            writer.writerow(dict(zip(fields, [r['park'], r['name'], r['kind'], r['entityId'], r['entityName'], location.get('latitude'), location.get('longitude'), r['method'], r['status'], document['verifiedAt'], r['source']])))
    preferences = [r for r in document['matches'] if r['kind'] == 'preference']
    print(f"Preferences: {sum(bool(r['entityId']) for r in preferences)}/{len(preferences)} matched; {sum(bool(r['location']) for r in preferences)} valid locations.")
    print('Unresolved:', ', '.join(r['name'] for r in preferences if not r['entityId']))


if __name__ == '__main__':
    main()
