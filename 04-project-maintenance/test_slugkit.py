import unittest

from slugkit import normalize_version, slugify


class SlugifyTests(unittest.TestCase):
    def test_slugify_basic(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("Hello,  World!!"), "hello-world")
        self.assertEqual(slugify("a---b"), "a-b")
        self.assertEqual(slugify("a - - b"), "a-b")

    def test_slugify_strips_surrounding_separators(self):
        self.assertEqual(slugify("--hello--"), "hello")


class NormalizeVersionTests(unittest.TestCase):
    def test_ordinary_dotted_versions(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("0.3.2"), "0.3.2")
        self.assertEqual(normalize_version("1.2"), "1.2")

    def test_pre_release_suffix_preserved(self):
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_invalid_version_raises(self):
        with self.assertRaises(ValueError):
            normalize_version("not a version")


if __name__ == "__main__":
    unittest.main()
