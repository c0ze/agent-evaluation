import unittest

from packaging.version import InvalidVersion

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("Hello... World!!!"), "hello-world")
        self.assertEqual(slugify("a--b__c"), "a-b-c")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_normalize_version_ordinary_versions_unchanged(self):
        # Ordinary versions must keep the former LooseVersion string output.
        for version in ("1.0", "0.4.0", "1.2.3.4", "1.0a1", "1.0b2", "1.0.dev1", "1.0.post1"):
            with self.subTest(version=version):
                self.assertEqual(normalize_version(version), version)

    def test_normalize_version_pep440_normalization(self):
        # Documented difference from LooseVersion, which echoed input verbatim.
        self.assertEqual(normalize_version("v1.2"), "1.2")
        self.assertEqual(normalize_version("1.02"), "1.2")
        self.assertEqual(normalize_version("2.0RC1"), "2.0rc1")

    def test_normalize_version_invalid(self):
        for version in ("", "not-a-version", "1..2"):
            with self.subTest(version=version):
                with self.assertRaises(InvalidVersion):
                    normalize_version(version)


if __name__ == "__main__":
    unittest.main()
