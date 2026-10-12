"""Build an OSM pedestrian graph. Never add straight-line edges between POIs."""
import math


def distance(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    return 6371000 * 2 * math.asin(min(1, math.sqrt(math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2)))


def allowed(tags):
    if tags.get('foot') in ('no', 'private', 'use_sidepath') or tags.get('access') in ('no', 'private', 'agricultural', 'forestry'):
        return False
    if tags.get('indoor') == 'yes' or tags.get('area') == 'yes' or tags.get('construction'):
        return False
    return tags.get('highway') in ('footway', 'pedestrian', 'path', 'steps', 'corridor', 'living_street') or tags.get('foot') in ('yes', 'designated', 'permissive')


def graph(data):
    nodes = {str(e['id']): e for e in data['elements'] if e['type'] == 'node'}
    result = {}
    edges = []
    for way in (e for e in data['elements'] if e['type'] == 'way' and allowed(e.get('tags', {}))):
        for a, b in zip(way.get('nodes', []), way.get('nodes', [])[1:]):
            a, b = str(a), str(b)
            if a not in nodes or b not in nodes:
                continue
            pair = [nodes[a], nodes[b]]
            if any(n.get('tags', {}).get('access') in ('private', 'no') or n.get('tags', {}).get('foot') == 'no' or n.get('tags', {}).get('barrier') in ('wall', 'fence', 'stile') or (n.get('tags', {}).get('barrier') in ('gate', 'lift_gate') and n.get('tags', {}).get('access') not in ('yes', 'permissive', 'customers') and n.get('tags', {}).get('foot') not in ('yes', 'designated')) for n in pair):
                continue
            for key, n in zip([a, b], pair):
                result[key] = [n['lat'], n['lon']]
            foot_direction = way.get('tags', {}).get('oneway:foot')
            direction = 1 if foot_direction in ('yes', '1', 'true') else -1 if foot_direction == '-1' else 0
            edges.append([a, b, round(distance(result[a], result[b]), 2), way['id'], way.get('tags', {}).get('highway'), None, direction])
    return {'nodes': result, 'edges': edges, 'source': 'OpenStreetMap via Overpass', 'attribution': '© OpenStreetMap contributors', 'osmTimestamp': data.get('osm3s', {}).get('timestamp_osm_base')}
