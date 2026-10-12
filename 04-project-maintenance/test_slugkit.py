import subprocess
import sys
import unittest
from pathlib import Path

from slugkit import normalize_version, slugify

PROJECT_ROOT = Path(__file__).resolve().parent


class SlugifyTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_repeated_punctuation_collapses_to_one_separator(self):
        self.assertEqual(slugify("Hello,,   World!!"), "hello-world")
        self.assertEqual(slugify("a---b___c"), "a-b-c")

    def test_digits_are_kept(self):
        self.assertEqual(slugify("Release 0.4.0"), "release-0-4-0")


class NormalizeVersionTests(unittest.TestCase):
    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_pre_release_suffixes_are_preserved(self):
        for value in ("2.0rc1", "1.4.0b2", "0.4.0.dev1", "3.0a1"):
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)

    def test_leading_zeros_are_not_stripped(self):
        # Unchanged vs. the distutils-based implementation: no zero padding is
        # rewritten, so callers keep seeing the version they passed in.
        self.assertEqual(normalize_version("1.02"), "1.02")

    def test_value_without_components_is_rejected(self):
        for value in ("", "!!!", "...", "-"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    normalize_version(value)


class StdlibCompatibilityTests(unittest.TestCase):
    def test_import_does_not_use_distutils(self):
        # distutils is gone from the stdlib in 3.12+; the previous
        # implementation imported it at module import time.
        program = "import sys, slugkit; print('distutils' in sys.modules)"
        result = subprocess.run(
            [sys.executable, "-c", program],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertEqual(result.stdout.strip(), "False")


if __name__ == "__main__":
    unittest.main()
