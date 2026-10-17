import unittest

from sanitize_studio_performance_trace import disclose


class DisclosureTest(unittest.TestCase):
    def event(self, **extra):
        return {'cat': 'devtools.timeline', 'name': 'FunctionCall', 'ph': 'X',
                'pid': 123, 'tid': 456, 'ts': 123.25, 'dur': 67.5, **extra}

    def test_private_arguments_removed_without_changing_order_or_timing(self):
        events = [self.event(args={'data': {'url': 'private-url', 'token': 'secret'}}),
                  self.event(name='Paint', ts=200.5, dur=1)]
        self.assertEqual(disclose(events), [{k: v for k, v in e.items() if k != 'args'} for e in events])

    def test_unexpected_top_field_refused(self):
        with self.assertRaises(ValueError):
            disclose([self.event(url='private-url')])

    def test_path_label_refused(self):
        with self.assertRaises(ValueError):
            disclose([self.event(name='C:/private/file')])

    def test_nested_trace_ids_bounded(self):
        self.assertEqual(disclose([self.event(id2={'local': '0x1a'})])[0]['id2'], {'local': '0x1a'})
        with self.assertRaises(ValueError):
            disclose([self.event(id2={'url': 'private-url'})])

    def test_actual_integer_ids_preserved_and_url_ids_refused(self):
        self.assertEqual(disclose([self.event(id=1234)])[0]['id'], 1234)
        with self.assertRaises(ValueError):
            disclose([self.event(id='https://private')])

    def test_string_timing_refused(self):
        with self.assertRaises(ValueError):
            disclose([self.event(ts='private-value')])


if __name__ == '__main__':
    unittest.main()
