import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("Hello,,  World!!"), "hello-world")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_normalize_version_ordinary(self):
        for version in (
            "1.2",
            "2.0",
            "3.10",
            "3.10a",
            "1996.07.12",
            "2.0b1pl0",
        ):
            self.assertEqual(normalize_version(version), version)

    def test_normalize_version_preserves_prerelease_suffix(self):
        self.assertEqual(normalize_version("1.2b3"), "1.2b3")
        self.assertEqual(normalize_version("0.4.0rc2"), "0.4.0rc2")


if __name__ == "__main__":
    unittest.main()