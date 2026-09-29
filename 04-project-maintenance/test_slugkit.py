import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_normalize_version_preserves_spelling(self):
        for value in ("1.2.0", "2.0rc1", "01.002.0", "1.0.dev2"):
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)


if __name__ == "__main__":
    unittest.main()
