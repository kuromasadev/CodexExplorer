import json
from pathlib import Path
import unittest
from build_locations import resolve


class LocationTests(unittest.TestCase):
    def test_match_rules(self):
        entities=[{'id':'one','name':'Ride','externalId':'operator:1'}, {'id':'two','name':'Ride'}]
        self.assertEqual(resolve({'Experience':'Ride'},entities,[])[1],'ambiguous')
        self.assertEqual(resolve({'Experience':'Ride','ThemeParks entity ID':'one'},entities,[])[0]['id'],'one')
        self.assertEqual(resolve({'Experience':'Ride','ThemeParks entity ID':'invalid'},entities,[])[1],'invalid explicit ID')
        self.assertEqual(resolve({'Experience':'Different','Website entity ID':'operator:1'},entities,[])[0]['id'],'one')

    def test_saved_coordinate_provenance(self):
        data=json.loads((Path(__file__).parent/'entity-locations.json').read_text(encoding='utf-8'))
        for row in data['matches']:
            if not row['entityId']:
                self.assertIsNone(row['location'])
                continue
            entity=next(e for e in data['parks'][row['park']]['entities'] if e['id']==row['entityId'])
            if row['location']:
                self.assertEqual(row['location'],entity['location'])
                self.assertTrue(28.3<row['location']['latitude']<28.5)
                self.assertTrue(-81.65<row['location']['longitude']< -81.45)
            self.assertTrue(row['source'].startswith(data['source']))


if __name__=='__main__':
    unittest.main()
