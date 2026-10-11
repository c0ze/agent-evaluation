import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")


if __name__ == "__main__":
    unittest.main()

