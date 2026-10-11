import sys
import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_collapses_repeated_punctuation(self):
        self.assertEqual(slugify("Hello,  World!! -- Again??"), "hello-world-again")
        self.assertEqual(slugify("...a---b..."), "a-b")
        self.assertEqual(slugify("  ***  "), "")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_normalize_version_round_trips_ordinary_versions(self):
        for value in ("0.4.0", "0.1", "10.20.30", "1.2.3.4", "2.0rc1", "3.13.0rc2"):
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)

    def test_slugkit_does_not_import_distutils(self):
        self.assertNotIn("distutils", sys.modules)


if __name__ == "__main__":
    unittest.main()
