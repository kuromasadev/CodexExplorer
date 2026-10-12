"""Local planner server. Run python disney-26/server.py from the repository root."""
import hashlib
import json
import os
from pathlib import Path
import re
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'disney-26' / '.cache'
LOCK = threading.Lock()
last_request = 0
blocked_until = 0


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
        if not re.fullmatch(r'(destinations|entity/[a-zA-Z0-9-]+/(children|live|schedule(?:/\d{4}/\d{2})?|history(?:/coverage)?)(?:\?date=\d{4}-\d{2}-\d{2})?)', path):
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
