import os
import subprocess
import sys
import unittest

from slugkit import normalize_version, slugify

PACKAGE_DIR = os.path.dirname(os.path.abspath(__file__))


class SlugifyTests(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_repeated_punctuation_collapses_to_single_separator(self):
        self.assertEqual(slugify("Hello,,, World!!!"), "hello-world")
        self.assertEqual(slugify("a...b"), "a-b")

    def test_underscores_and_whitespace_are_separators(self):
        self.assertEqual(slugify("foo_bar  baz\tqux"), "foo-bar-baz-qux")

    def test_leading_and_trailing_separators_are_stripped(self):
        self.assertEqual(slugify("--Hello--"), "hello")

    def test_empty_and_punctuation_only_strings(self):
        self.assertEqual(slugify(""), "")
        self.assertEqual(slugify("!!!"), "")


class NormalizeVersionTests(unittest.TestCase):
    def test_ordinary_versions_are_returned_unchanged(self):
        for version in ("0.4.0", "1.2.0", "1.2", "10.20.30.4"):
            with self.subTest(version=version):
                self.assertEqual(normalize_version(version), version)

    def test_prerelease_and_post_suffixes_are_preserved(self):
        for version in ("2.0rc1", "1.0b2", "1.0a1", "1.0.post1", "1.0dev3"):
            with self.subTest(version=version):
                self.assertEqual(normalize_version(version), version)

    def test_non_string_raises_type_error(self):
        with self.assertRaises(TypeError):
            normalize_version(123)

    def test_empty_string_raises_value_error(self):
        with self.assertRaises(ValueError):
            normalize_version("")

    def test_module_imports_without_distutils_available(self):
        # distutils is removed in Python 3.12+; block it explicitly so the
        # guarantee is also checked on interpreters that still ship it
        # (3.10/3.11).
        blocker = (
            "import sys\n"
            "class StdlibBlocker:\n"
            "    def find_spec(self, name, path=None, target=None):\n"
            "        if name == 'distutils' or name.startswith('distutils.'):\n"
            "            raise ImportError('blocked for test')\n"
            "sys.meta_path.insert(0, StdlibBlocker())\n"
            "import slugkit\n"
            "assert slugkit.normalize_version('1.2.0') == '1.2.0'\n"
            "print('ok')\n"
        )
        result = subprocess.run(
            [sys.executable, "-c", blocker],
            capture_output=True,
            text=True,
            cwd=PACKAGE_DIR,
            check=False,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(result.stdout.strip(), "ok")


if __name__ == "__main__":
    unittest.main()
