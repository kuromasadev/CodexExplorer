from io import BytesIO
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
import server


class NetworkFallbackTests(unittest.TestCase):
    def test_fallback_and_cache(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            folder=root/'disney-26'
            folder.mkdir()
            data={'parks':{'Park':{'id':'park','entities':[{'location':{'latitude':28.4,'longitude':-81.58}}]}}}
            (folder/'entity-locations.json').write_text(json.dumps(data))
            xml=b'<osm><node id="1" lat="28.4" lon="-81.58"/><node id="2" lat="28.4001" lon="-81.58"/><way id="10"><nd ref="1"/><nd ref="2"/><tag k="highway" v="footway"/></way></osm>'
            with patch.object(server,'ROOT',root), patch.object(server,'urlopen',side_effect=[HTTPError('https://overpass-api.de',504,'timeout',{},None),BytesIO(xml)]) as request:
                status,payload=server.walk_network('park')
                self.assertEqual(status,200)
                network=json.loads(payload)
                self.assertEqual(network['source'],'OpenStreetMap map API')
                self.assertEqual(len(network['edges']),1)
                self.assertEqual(request.call_count,2)
                self.assertEqual(server.walk_network('park')[0],200)
                self.assertEqual(request.call_count,2,'Cached graph must avoid new upstream calls')
                self.assertEqual(server.walk_network('unknown')[0],404)


if __name__=='__main__':
    unittest.main()
