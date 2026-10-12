"""Local planner server. Run python disney-26/server.py from the repository root."""
import hashlib
import json
import os
from pathlib import Path
import re
import threading
import time
import xml.etree.ElementTree as ET
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from walking import graph

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'disney-26' / '.cache'
LOCK = threading.Lock()
last_request = 0
blocked_until = 0
WALK_LOCK = threading.Lock()


def walk_network(park_id):
    locations = json.loads((ROOT / 'disney-26' / 'entity-locations.json').read_text(encoding='utf-8'))
    park = next((p for p in locations['parks'].values() if p['id'] == park_id), None)
    if not park:
        return 404, b'{"error":"Unknown park"}'
    file = ROOT / 'disney-26' / 'walk-networks' / (park_id + '.json')
    with WALK_LOCK:
        if file.exists() and time.time()-file.stat().st_mtime < 7*86400:
            return 200, file.read_bytes()
        points = [e['location'] for e in park['entities'] if e.get('location') and isinstance(e['location'].get('latitude'), (int, float)) and isinstance(e['location'].get('longitude'), (int, float)) and 28.3 < e['location']['latitude'] < 28.5 and -81.65 < e['location']['longitude'] < -81.45]
        south, north = min(p['latitude'] for p in points)-.001, max(p['latitude'] for p in points)+.001
        west, east = min(p['longitude'] for p in points)-.001, max(p['longitude'] for p in points)+.001
        if north-south > .04 or east-west > .04:
            return 422, b'{"error":"Park coordinate bounds need review"}'
        query = f'[out:json][timeout:25];way["highway"]({south},{west},{north},{east});(._;>;);out body;'
        request = Request('https://overpass-api.de/api/interpreter', data=urlencode({'data': query}).encode(), headers={'User-Agent': 'DisneyFamilyPlanner/1.0', 'Content-Type': 'application/x-www-form-urlencoded'})
        try:
            with urlopen(request, timeout=45) as response:
                network = graph(json.load(response))
        except Exception:
            # Small park-sized OSM map downloads provide the same public path geometry
            # when the Overpass query service is temporarily unavailable.
            map_request = Request(f'https://api.openstreetmap.org/api/0.6/map?bbox={west},{south},{east},{north}', headers={'User-Agent': 'DisneyFamilyPlanner/1.0'})
            with urlopen(map_request, timeout=45) as response:
                xml = ET.fromstring(response.read())
            elements = []
            for item in xml:
                if item.tag not in ('node', 'way'):
                    continue
                element = {'type': item.tag, 'id': int(item.attrib['id']), 'tags': {tag.attrib['k']: tag.attrib['v'] for tag in item.findall('tag')}}
                if item.tag == 'node':
                    element.update(lat=float(item.attrib['lat']), lon=float(item.attrib['lon']))
                else:
                    element['nodes'] = [int(n.attrib['ref']) for n in item.findall('nd')]
                elements.append(element)
            network = graph({'elements': elements})
            network['source'] = 'OpenStreetMap map API'
        network['parkId'] = park_id
        network['fetchedAt'] = time.time()
        file.parent.mkdir(exist_ok=True)
        file.write_text(json.dumps(network, separators=(',', ':')), encoding='utf-8')
        return 200, file.read_bytes()


def upstream(path):
    global last_request, blocked_until
    key = hashlib.sha256(path.encode()).hexdigest()
    file = CACHE / (key + '.json')
    ttl = 60 if path.endswith('/live') else 300
    if '/history' in path:
        ttl = 3600
    with LOCK:
        if file.exists() and time.time() - file.stat().st_mtime < ttl:
            return 200, file.read_bytes()
        if time.time() < blocked_until:
            return 429, json.dumps({'error': 'API cooldown', 'retryAfter': round(blocked_until-time.time())}).encode()
        time.sleep(max(0, 1.1 - (time.time() - last_request)))
        headers = {'Accept': 'application/json', 'User-Agent': 'DisneyFamilyPlanner/1.0'}
        if os.environ.get('THEMEPARKS_API_KEY'):
            headers['X-API-Key'] = os.environ['THEMEPARKS_API_KEY']
        last_request = time.time()
        try:
            with urlopen(Request('https://api.themeparks.wiki/v1/' + path, headers=headers), timeout=40) as response:
                data = response.read()
            CACHE.mkdir(exist_ok=True)
            file.write_bytes(data)
            return 200, data
        except HTTPError as error:
            if error.code == 429:
                try:
                    delay = float(error.headers.get('Retry-After', 60))
                except ValueError:
                    delay = 60
                blocked_until = time.time() + max(1, delay)
            return error.code, error.read()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if '/.cache' in self.path:
            self.send_error(404)
            return
        if not self.path.startswith('/api/'):
            return super().do_GET()
        path = self.path[5:]
        if re.fullmatch(r'walk-network/[a-zA-Z0-9-]+', path):
            try:
                status, data = walk_network(path.split('/')[1])
            except Exception:
                status, data = 502, b'{"error":"Pedestrian network unavailable; no straight-line routes substituted"}'
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(data)
            return
        if not re.fullmatch(r'(destinations|entity/[a-zA-Z0-9-]+/(children|live|schedule(?:/\d{4}/\d{2})?|history(?:/coverage|/daily)?)(?:\?(?:date=\d{4}-\d{2}-\d{2}|from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}))?)', path):
            self.send_error(400)
            return
        try:
            status, data = upstream(path)
        except Exception:
            status, data = 502, b'{"error":"ThemeParks.wiki temporarily unavailable"}'
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)


if __name__ == '__main__':
    print('Planner: http://localhost:8000/disney-26/')
    ThreadingHTTPServer(('127.0.0.1', 8000), Handler).serve_forever()
