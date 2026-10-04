import sys
import unittest

from slugkit import normalize_version, slugify


class SlugifyTests(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_repeated_punctuation_collapsed(self):
        # Adjacent punctuation collapses to a single dash and trims edges.
        self.assertEqual(slugify("foo---bar"), "foo-bar")
        self.assertEqual(slugify("...leading-and-trailing..."), "leading-and-trailing")
        self.assertEqual(slugify("a   b___c"), "a-b-c")

    def test_lowercases_and_strips(self):
        self.assertEqual(slugify("  ABCdef  "), "abcdef")

    def test_only_punctuation_returns_empty(self):
        self.assertEqual(slugify("!!!"), "")

    def test_digits_kept(self):
        self.assertEqual(slugify("Version 2 Release 3"), "version-2-release-3")


class NormalizeVersionTests(unittest.TestCase):
    def test_ordinary_dotted_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")

    def test_pre_release_suffix_preserved(self):
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_two_part_version(self):
        self.assertEqual(normalize_version("1.2"), "1.2")

    def test_dev_and_alpha_suffixes(self):
        # PEP 440 normalization is acceptable as long as the suffix is preserved.
        self.assertEqual(normalize_version("2.0.dev1"), "2.0.dev1")
        self.assertEqual(normalize_version("2.0a1"), "2.0a1")
        self.assertEqual(normalize_version("2.0b1"), "2.0b1")

    def test_invalid_version_returned_unchanged(self):
        # The replacement for LooseVersion raises on unparseable strings;
        # we surface the original value rather than raising to keep callers stable.
        self.assertEqual(normalize_version("not-a-version"), "not-a-version")


class CompatibilityGuards(unittest.TestCase):
    def test_no_distutils_import(self):
        # Sanity check that the deprecated module is no longer imported.
        import slugkit

        source = sys.modules[slugkit.__name__].__file__
        with open(source, encoding="utf-8") as fh:
            contents = fh.read()
        self.assertNotIn("distutils", contents)

    def test_packaging_dependency_importable(self):
        from packaging.version import Version  # noqa: F401


if __name__ == "__main__":
    unittest.main()