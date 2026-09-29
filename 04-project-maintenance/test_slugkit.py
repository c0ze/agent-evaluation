import subprocess
import sys
import unittest
from pathlib import Path

import slugkit
from slugkit import normalize_version, slugify


class SlugifyTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_collapses_repeated_punctuation(self):
        self.assertEqual(slugify("Hello,,, World!!!"), "hello-world")
        self.assertEqual(slugify("a -- b __ c"), "a-b-c")
        self.assertEqual(slugify("---Already-Slugged---"), "already-slugged")


class NormalizeVersionTests(unittest.TestCase):
    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_ordinary_versions_are_returned_unchanged(self):
        # Expected values were captured from the previous
        # str(distutils.version.LooseVersion(value)) implementation.
        for version in [
            "0.4.0",
            "1",
            "1.2",
            "1.2.3.4",
            "1.0.0a1",
            "1.0b2",
            "2.0rc1",
            "1.0.post1",
            "1.0.dev0",
            "10.20.30",
        ]:
            with self.subTest(version=version):
                self.assertEqual(normalize_version(version), version)

    def test_non_canonical_strings_are_not_rewritten(self):
        # Compatibility contract for 0.4.0: no canonicalisation, exactly as before.
        for version in ["1.0-rc1", "v1.0", "01.2", "1.0.RC1", "1.0+local"]:
            with self.subTest(version=version):
                self.assertEqual(normalize_version(version), version)

    def test_invalid_input_raises(self):
        for value in [None, 1.2, 12, b"1.0"]:
            with self.subTest(value=value):
                with self.assertRaises(TypeError):
                    normalize_version(value)
        with self.assertRaises(ValueError):
            normalize_version("")

    def test_import_does_not_need_or_warn_about_distutils(self):
        # distutils is gone in Python 3.12+; a stray import must fail this test on
        # every supported version, including where setuptools shims distutils.
        code = "import sys, slugkit; sys.exit('distutils' in sys.modules)"
        result = subprocess.run(
            [sys.executable, "-W", "error::DeprecationWarning", "-c", code],
            cwd=Path(slugkit.__file__).resolve().parent,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)


if __name__ == "__main__":
    unittest.main()
