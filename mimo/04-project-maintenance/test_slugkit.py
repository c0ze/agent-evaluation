import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("Hello!!! World"), "hello-world")
        self.assertEqual(slugify("a--b!!c"), "a-b-c")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_normalize_version_ordinary_forms_unchanged(self):
        # Compatibility pin after dropping distutils: common outputs retained.
        self.assertEqual(normalize_version("0.4.0"), "0.4.0")
        self.assertEqual(normalize_version("1.2.3.4"), "1.2.3.4")
        self.assertEqual(normalize_version("1.2.0.dev1"), "1.2.0.dev1")
        self.assertEqual(normalize_version("1.2.0-alpha"), "1.2.0-alpha")


if __name__ == "__main__":
    unittest.main()
