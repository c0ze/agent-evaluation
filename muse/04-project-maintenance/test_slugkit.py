import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("Hello,,,   World!!"), "hello-world")
        self.assertEqual(slugify("a...b"), "a-b")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_normalize_version_ordinary_versions(self):
        self.assertEqual(normalize_version("1.0"), "1.0")
        self.assertEqual(normalize_version("0.4.0"), "0.4.0")
        self.assertEqual(normalize_version("1.2.3a1"), "1.2.3a1")
        self.assertEqual(normalize_version("1.2.3.post1"), "1.2.3.post1")

    def test_normalize_version_invalid_passthrough(self):
        self.assertEqual(normalize_version("not-a-version"), "not-a-version")


if __name__ == "__main__":
    unittest.main()
