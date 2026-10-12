import csv
import json
from pathlib import Path
import unittest
from extract_activities import SLOTS, slot_values


class ExtractionTests(unittest.TestCase):
    def test_non_aligned_showtime(self):
        slots = slot_values([{'type': 'Performance Time', 'startTime': '10:50:00', 'endTime': '10:50:00'}])
        self.assertEqual(slots['10:45'], 'show:10:50')
        self.assertEqual(slots['11:00'], '')

    def test_hours_and_close(self):
        slots = slot_values([{'type': 'Operating', 'startTime': '08:10:00', 'endTime': '22:00:00'}])
        self.assertEqual(slots['08:00'], 'opens:08:10')
        self.assertEqual(slots['21:45'], 'open')
        self.assertEqual(slots['22:00'], '')

    def test_catalog_integrity(self):
        root = Path(__file__).parent
        with (root / 'activities.csv').open(encoding='utf-8-sig', newline='') as file:
            reader = csv.DictReader(file)
            self.assertTrue(set(SLOTS).issubset(reader.fieldnames))
            rows = list(reader)
        self.assertEqual(len(SLOTS), 57)
        self.assertEqual(len({(r['Park'], r['Website entity ID'], r['Schedule date']) for r in rows}), len(rows))
        self.assertEqual({r['Park'] for r in rows}, {'Magic Kingdom','Animal Kingdom','Hollywood Studios','EPCOT'})
        for row in rows:
            json.loads(row['Tags JSON'])
            json.loads(row['Schedule JSON'])
            self.assertTrue((root / row['Source HTML']).is_file())
            if row['Thumbnail local']:
                self.assertTrue((root / row['Thumbnail local']).is_file())
        pianist = next(r for r in rows if r['Experience'] == "Casey's Corner Pianist")
        self.assertIn('10:50', pianist['Showtimes'])
        self.assertIn('show:10:50', pianist['10:45'])


if __name__ == '__main__':
    unittest.main()
