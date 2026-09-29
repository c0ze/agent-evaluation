import os
import subprocess
import sys
import unittest
import warnings

import slugkit
from slugkit import normalize_version, slugify

# Ordinary dotted versions, with and without pre-release/post/dev suffixes.  Before
# 0.4.0 each of these was returned unchanged by str(distutils.version.LooseVersion(v)).
ORDINARY_VERSIONS = [
    "1",
    "1.2",
    "1.2.0",
    "0.4.0",
    "1.2.3.4",
    "2.0rc1",
    "1.0a1",
    "1.0b2",
    "1.0.post1",
    "1.0.dev0",
]

# Strings that PEP 440 canonicalisation (packaging.version.Version) would rewrite or
# reject.  The legacy implementation returned them untouched, and so must we.
NON_CANONICAL_VERSIONS = ["1.0-rc1", "01.02", "v1.0", "1.0.RC1", "1_0", "1.2.3.foo"]


class SlugifyTests(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_repeated_punctuation_collapses_to_single_hyphen(self):
        self.assertEqual(slugify("Hello,,, World!!!"), "hello-world")
        self.assertEqual(slugify("a--b__c!!d"), "a-b-c-d")
        self.assertEqual(slugify("--x--"), "x")

    def test_only_separators_gives_empty_slug(self):
        self.assertEqual(slugify("!!!"), "")
        self.assertEqual(slugify("   "), "")

    def test_non_ascii_letters_are_dropped_not_transliterated(self):
        # Characterises the known limitation recorded in CHANGELOG.md and MAINTENANCE.md.
        # Changing this is a deliberate, user-visible change: update those documents too.
        self.assertEqual(slugify("Crème brûlée"), "cr-me-br-l-e")


class NormalizeVersionTests(unittest.TestCase):
    def test_ordinary_versions_are_returned_unchanged(self):
        for version in ORDINARY_VERSIONS:
            with self.subTest(version=version):
                self.assertEqual(normalize_version(version), version)

    def test_non_canonical_versions_are_not_rewritten(self):
        for version in NON_CANONICAL_VERSIONS:
            with self.subTest(version=version):
                self.assertEqual(normalize_version(version), version)

    def test_surrounding_whitespace_is_preserved(self):
        self.assertEqual(normalize_version(" 1.0 "), " 1.0 ")

    def test_empty_string_raises_value_error(self):
        with self.assertRaises(ValueError):
            normalize_version("")

    def test_non_string_raises_type_error(self):
        for value in (None, 1.0, 12, b"1.0"):
            with self.subTest(value=value):
                with self.assertRaises(TypeError):
                    normalize_version(value)

    def test_matches_legacy_distutils_behaviour_when_available(self):
        # Differential check against the implementation used before 0.4.0.  distutils is
        # gone from the stdlib in 3.12+, but setuptools may still provide a shim for it.
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                from distutils.version import LooseVersion
            except ImportError:
                self.skipTest("distutils is not available on this interpreter")
            for version in ORDINARY_VERSIONS + NON_CANONICAL_VERSIONS:
                with self.subTest(version=version):
                    self.assertEqual(normalize_version(version), str(LooseVersion(version)))


class ImportHygieneTests(unittest.TestCase):
    def test_import_and_use_do_not_touch_distutils_or_warn(self):
        # Runs in a fresh interpreter so that the differential test above (which imports
        # distutils on purpose) cannot mask a regression.  "-W error" additionally fails
        # the test if importing or calling the module emits any warning at all.
        code = (
            "import sys\n"
            "import slugkit\n"
            "slugkit.normalize_version('1.2.0')\n"
            "slugkit.slugify('Hello, World!')\n"
            "leaked = sorted(m for m in sys.modules if m.split('.')[0] == 'distutils')\n"
            "assert not leaked, leaked\n"
        )
        result = subprocess.run(
            [sys.executable, "-W", "error", "-c", code],
            cwd=os.path.dirname(os.path.abspath(slugkit.__file__)),
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
