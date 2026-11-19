import sys
import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        # Repeated/mixed punctuation is collapsed into a single separator, and
        # leading/trailing punctuation does not produce empty slug segments.
        self.assertEqual(slugify("Hello,,,   World!!"), "hello-world")
        self.assertEqual(slugify("...a---b___c..."), "a-b-c")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_normalize_version_is_identity_for_ordinary_versions(self):
        # str(LooseVersion(v)) returned v verbatim. The replacement must not
        # canonicalize these: str(Version(v)) would change them.
        cases = [
            "1.2.0",
            "2.0rc1",
            "1.10.3",
            "0.4.0",
            "3.13",
            "1",
            "1.02",  # str(Version) would drop the leading zero -> "1.2"
            "v1.2",  # str(Version) would drop the "v" -> "1.2"
            "1.2.0-beta",  # str(Version) would rewrite -> "1.2.0b0"
            "1.2.0.0",
            " 1.2 ",  # str(Version) would strip whitespace
            "1.0-1",  # str(Version) would rewrite -> "1.0.post1"
            "1.2.0.post1",
            "1.2.0+local",
            "2.0a1",
            "1.0.dev1",
            "1.2.3rc2",
            "10.20.30",
        ]
        for case in cases:
            with self.subTest(version=case):
                self.assertEqual(normalize_version(case), case)

    def test_normalize_version_passes_through_non_pep440_text(self):
        # The old LooseVersion was permissive; invalid text was returned as-is.
        self.assertEqual(normalize_version("not a version"), "not a version")
        self.assertEqual(normalize_version(""), "")

    def test_no_distutils_dependency(self):
        # distutils was removed from the standard library in Python 3.12.
        # Importing slugkit must not pull it in on any supported interpreter.
        self.assertNotIn("distutils", sys.modules)
        import slugkit

        self.assertFalse(hasattr(slugkit, "LooseVersion"))
        self.assertNotIn("distutils.version", sys.modules)


if __name__ == "__main__":
    unittest.main()
