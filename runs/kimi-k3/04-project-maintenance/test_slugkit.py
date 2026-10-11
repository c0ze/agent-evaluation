import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("Hello!! --World??"), "hello-world")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_normalize_version_ordinary_dotted(self):
        self.assertEqual(normalize_version("1.10.3"), "1.10.3")
        self.assertEqual(normalize_version("0.4.0"), "0.4.0")

    def test_normalize_version_prerelease_suffixes(self):
        self.assertEqual(normalize_version("1.0a2"), "1.0a2")
        self.assertEqual(normalize_version("1.0b1"), "1.0b1")
        self.assertEqual(normalize_version("3.1.4.post1"), "3.1.4.post1")

    def test_normalize_version_fallback(self):
        # Non-PEP 440 strings are echoed back, as LooseVersion did.
        self.assertEqual(normalize_version("not-a-version"), "not-a-version")


if __name__ == "__main__":
    unittest.main()
