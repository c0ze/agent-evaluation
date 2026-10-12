import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")
        self.assertEqual(slugify("Multiple---dashes"), "multiple-dashes")
        self.assertEqual(slugify("__leading_trailing__"), "leading-trailing")
        self.assertEqual(slugify("UPPERCASE"), "uppercase")
        self.assertEqual(slugify("already-slug"), "already-slug")

    def test_normalize_version(self):
        # Basic dotted versions
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0"), "2.0")
        self.assertEqual(normalize_version("10.20.30"), "10.20.30")

        # Pre-release suffixes preserved
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")
        self.assertEqual(normalize_version("1.0alpha2"), "1.0alpha2")
        self.assertEqual(normalize_version("3.0beta1"), "3.0beta1")
        self.assertEqual(normalize_version("1.0dev4"), "1.0dev4")
        self.assertEqual(normalize_version("2.0post1"), "2.0post1")

        # Whitespace handling
        self.assertEqual(normalize_version("  1.2.3  "), "1.2.3")
        self.assertEqual(normalize_version("\t2.0rc1\n"), "2.0rc1")

        # Unrecognized patterns returned as-is (fallback)
        self.assertEqual(normalize_version("v1.2.3"), "v1.2.3")
        self.assertEqual(normalize_version("1.2.3-custom"), "1.2.3-custom")


if __name__ == "__main__":
    unittest.main()