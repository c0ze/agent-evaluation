import unittest

from packaging.version import InvalidVersion

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("foo---bar...baz"), "foo-bar-baz")
        self.assertEqual(slugify("---hello world---"), "hello-world")
        self.assertEqual(slugify("slug...--..test"), "slug-test")

    def test_normalize_version_ordinary(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("0.4.0"), "0.4.0")
        self.assertEqual(normalize_version("1.0"), "1.0")
        self.assertEqual(normalize_version("3.13.0"), "3.13.0")

    def test_normalize_version_prerelease(self):
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")
        self.assertEqual(normalize_version("1.0a1"), "1.0a1")
        self.assertEqual(normalize_version("1.0b2"), "1.0b2")
        self.assertEqual(normalize_version("1.0.post1"), "1.0.post1")
        self.assertEqual(normalize_version("1.0.dev1"), "1.0.dev1")

    def test_normalize_version_whitespace(self):
        self.assertEqual(normalize_version("  1.2.0  "), "1.2.0")

    def test_normalize_version_invalid(self):
        with self.assertRaises(InvalidVersion):
            normalize_version("not-a-version")
        with self.assertRaises(InvalidVersion):
            normalize_version("abc.def")


if __name__ == "__main__":
    unittest.main()

