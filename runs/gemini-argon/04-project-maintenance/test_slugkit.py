import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("...Hello --- World___2026!!!"), "hello-world-2026")
        self.assertEqual(slugify("---already--slugged---"), "already-slugged")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")
        self.assertEqual(normalize_version("0.4.0"), "0.4.0")

    def test_normalize_version_prerelease_and_formatting(self):
        self.assertEqual(normalize_version("  1.2.0  "), "1.2.0")
        self.assertEqual(normalize_version("1.0.0a1"), "1.0.0a1")
        self.assertEqual(normalize_version("1.0.0b2"), "1.0.0b2")
        self.assertEqual(normalize_version("2.0-RC1"), "2.0rc1")
        self.assertEqual(normalize_version("1.02.0"), "1.2.0")
        self.assertEqual(normalize_version("1.2.0.dev1"), "1.2.0.dev1")

    def test_normalize_version_invalid(self):
        with self.assertRaises(ValueError):
            normalize_version("")
        with self.assertRaises(ValueError):
            normalize_version("not-a-version")


if __name__ == "__main__":
    unittest.main()
