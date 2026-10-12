import unittest
from walking import graph, allowed


class WalkingTests(unittest.TestCase):
    def test_restricted_ways(self):
        self.assertFalse(allowed({'highway': 'footway', 'access': 'private'}))
        self.assertFalse(allowed({'highway': 'service'}))
        self.assertFalse(allowed({'highway': 'pedestrian', 'area': 'yes'}))
        self.assertTrue(allowed({'highway': 'service', 'foot': 'yes'}))

    def test_graph_excludes_restricted_barrier(self):
        data={'elements':[{'type':'node','id':1,'lat':28.4,'lon':-81.58},{'type':'node','id':2,'lat':28.4001,'lon':-81.58},{'type':'node','id':3,'lat':28.4002,'lon':-81.58,'tags':{'barrier':'gate','access':'private'}},{'type':'way','id':10,'nodes':[1,2,3],'tags':{'highway':'footway'}}]}
        network=graph(data)
        self.assertEqual(len(network['edges']),1)
        self.assertNotIn('3',network['nodes'])
        self.assertGreater(network['edges'][0][2],10)


if __name__=='__main__':
    unittest.main()
