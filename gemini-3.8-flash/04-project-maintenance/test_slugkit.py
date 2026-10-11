import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("Hello... World---Again!!!"), "hello-world-again")
        self.assertEqual(slugify("foo---bar...baz"), "foo-bar-baz")
        self.assertEqual(slugify("--leading and trailing--"), "leading-and-trailing")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_normalize_version_ordinary_dotted(self):
        self.assertEqual(normalize_version("1.0"), "1.0")
        self.assertEqual(normalize_version("0.4.0"), "0.4.0")
        self.assertEqual(normalize_version("1.2.3.4"), "1.2.3.4")

    def test_normalize_version_prereleases(self):
        self.assertEqual(normalize_version("1.0a1"), "1.0a1")
        self.assertEqual(normalize_version("1.2b3"), "1.2b3")
        self.assertEqual(normalize_version("2.0.0rc2"), "2.0.0rc2")

    def test_normalize_version_post_and_dev_releases(self):
        self.assertEqual(normalize_version("1.2.0.post1"), "1.2.0.post1")
        self.assertEqual(normalize_version("1.2.0.dev1"), "1.2.0.dev1")

    def test_normalize_version_whitespace(self):
        self.assertEqual(normalize_version("  1.2.0  "), "1.2.0")

    def test_normalize_version_invalid(self):
        with self.assertRaises(ValueError):
            normalize_version("not-a-version")


if __name__ == "__main__":
    unittest.main()

