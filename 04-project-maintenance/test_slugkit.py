import os
import subprocess
import sys
import unittest

from slugkit import normalize_version, slugify


class SlugifyTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_collapses_repeated_punctuation(self):
        self.assertEqual(slugify("Hello,,   World!!"), "hello-world")
        self.assertEqual(slugify("---a--b---"), "a-b")
        self.assertEqual(slugify("a.b_c d"), "a-b-c-d")

    def test_slugify_digits_are_preserved(self):
        self.assertEqual(slugify("Python 3.10 Release!"), "python-3-10-release")

    def test_slugify_unicode_limitation_is_pinned(self):
        # Known limitation, not fixed in 0.4.0 (see CHANGELOG.md): non-ASCII
        # letters are dropped rather than transliterated. Pinned so that a
        # future fix lands as a deliberate, visible change.
        self.assertEqual(slugify("Ärger"), "rger")

    def test_slugify_empty_input(self):
        self.assertEqual(slugify("   "), "")
        self.assertEqual(slugify("!!!"), "")


class NormalizeVersionTests(unittest.TestCase):
    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_ordinary_versions_round_trip(self):
        for version in ("1", "1.2", "1.2.0", "10.20.30", "1.2.0+build.5", "1.02.0"):
            with self.subTest(version=version):
                self.assertEqual(normalize_version(version), version)

    def test_prerelease_suffixes_are_preserved(self):
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")
        self.assertEqual(normalize_version("1.4.0-beta.2"), "1.4.0-beta.2")
        self.assertEqual(normalize_version("3.0.dev0"), "3.0.dev0")

    def test_empty_version_is_rejected(self):
        for value in ("", ".", "..."):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    normalize_version(value)

    def test_values_without_components_pass_through(self):
        # Fidelity note: the previous distutils-based implementation also
        # returned these unchanged, because its component regex never matched;
        # only input with no text at all is rejected. Defining a stricter
        # contract is maintenance item 2 in MAINTENANCE.md.
        for value in ("   ", "!!!"):
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)

    def test_non_string_is_rejected(self):
        with self.assertRaises(TypeError):
            normalize_version(3)

    def test_module_imports_without_distutils(self):
        # Guards the 0.4.0 compatibility change: importing slugkit must not
        # pull in distutils, which no longer exists on Python 3.12+.
        here = os.path.dirname(os.path.abspath(__file__))
        code = (
            "import sys, slugkit\n"
            "assert not any(m == 'distutils' or m.startswith('distutils.')"
            " for m in sys.modules), sorted(m for m in sys.modules if 'distutils' in m)\n"
        )
        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=here,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
